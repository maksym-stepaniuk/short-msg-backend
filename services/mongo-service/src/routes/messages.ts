import { ObjectId } from "mongodb";
import { Router } from "express";
import { messagesCollection } from "../db/messagesCollection";
import { HttpError } from "../errors/httpError";
import { asyncHandler } from "../middleware/asyncHandler";
import type { AttachmentMeta, DeliveryStatus, MessageDocument } from "../types/message";

const allowedStatuses = new Set<DeliveryStatus>(["server_received", "delivered", "read"]);

const requireString = (value: unknown, field: string) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "Field is required", { field });
  }

  return value.trim();
};

const optionalString = (value: unknown, field: string) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return requireString(value, field);
};

const parseObjectId = (value: string, field: string) => {
  if (!ObjectId.isValid(value)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid ObjectId", { field });
  }

  return new ObjectId(value);
};

const parseInteger = (value: unknown, field: string) => {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Field must be an integer", { field });
  }

  return value;
};

const parseOptionalIntegerQuery = (value: unknown, field: string) => {
  if (Array.isArray(value)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Query parameter must be provided once", { field });
  }

  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Query parameter must be an integer", { field });
  }

  return parsed;
};

const parseLimit = (value: unknown) => {
  const limit = parseOptionalIntegerQuery(value, "limit") ?? 50;

  if (limit < 1 || limit > 100) {
    throw new HttpError(400, "VALIDATION_ERROR", "Limit must be between 1 and 100", { field: "limit" });
  }

  return limit;
};

const parseStatus = (value: unknown, fallback: DeliveryStatus) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const status = requireString(value, "deliveryStatus") as DeliveryStatus;

  if (!allowedStatuses.has(status)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid delivery status", { field: "deliveryStatus" });
  }

  return status;
};

const parseBody = (value: unknown) => {
  const body = requireString(value, "body");

  if (body.length > 2000) {
    throw new HttpError(400, "VALIDATION_ERROR", "Message body is too long", {
      field: "body",
      maxLength: 2000
    });
  }

  return body;
};

const parseAttachments = (value: unknown): AttachmentMeta[] => {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new HttpError(400, "VALIDATION_ERROR", "attachments must be an array", { field: "attachments" });
  }

  return value.map((attachment, index) => {
    if (typeof attachment !== "object" || attachment === null || Array.isArray(attachment)) {
      throw new HttpError(400, "VALIDATION_ERROR", "attachment must be an object", { field: `attachments[${index}]` });
    }

    const item = attachment as Record<string, unknown>;
    const size = item.size;

    if (typeof size !== "number" || !Number.isInteger(size) || size < 0) {
      throw new HttpError(400, "VALIDATION_ERROR", "attachment size must be a non-negative integer", {
        field: `attachments[${index}].size`
      });
    }

    return {
      fileName: requireString(item.fileName, `attachments[${index}].fileName`),
      mimeType: requireString(item.mimeType, `attachments[${index}].mimeType`),
      size,
      storageKey: requireString(item.storageKey, `attachments[${index}].storageKey`)
    };
  });
};

const parseMimeTypes = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => requireString(item, `mimeType[${index}]`));
  }

  return requireString(value, "mimeType")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

export const messagesRouter = Router();

messagesRouter.post(
  "/messages",
  asyncHandler(async (req, res) => {
    const now = new Date();
    const message: MessageDocument = {
      conversationId: requireString(req.body.conversationId, "conversationId"),
      authorId: requireString(req.body.authorId, "authorId"),
      seq: parseInteger(req.body.seq, "seq"),
      body: parseBody(req.body.body),
      createdAt: now,
      editedAt: null,
      deliveryStatus: parseStatus(req.body.deliveryStatus, "server_received"),
      attachments: parseAttachments(req.body.attachments)
    };

    const clientMessageId = optionalString(req.body.clientMessageId, "clientMessageId");

    if (clientMessageId) {
      message.clientMessageId = clientMessageId;
    }

    const collection = await messagesCollection();
    const result = await collection.insertOne(message);
    const created = await collection.findOne({ _id: result.insertedId });

    res.status(201).json(created);
  })
);

messagesRouter.get(
  "/messages/search",
  asyncHandler(async (req, res) => {
    const q = requireString(req.query.q, "q");
    const conversationId = optionalString(req.query.conversationId, "conversationId");
    const limit = parseLimit(req.query.limit);

    const filter: Record<string, unknown> = {
      $text: {
        $search: q
      }
    };

    if (conversationId) {
      filter.conversationId = conversationId;
    }

    const collection = await messagesCollection();
    const messages = await collection
      .find(filter, {
        projection: {
          score: {
            $meta: "textScore"
          }
        }
      })
      .sort({
        score: {
          $meta: "textScore"
        }
      })
      .limit(limit)
      .toArray();

    res.json(messages);
  })
);

messagesRouter.get(
  "/messages/:id",
  asyncHandler(async (req, res) => {
    const _id = parseObjectId(req.params.id, "id");
    const collection = await messagesCollection();
    const message = await collection.findOne({ _id });

    if (!message) {
      throw new HttpError(404, "MESSAGE_NOT_FOUND", "Message not found");
    }

    res.json(message);
  })
);

messagesRouter.get(
  "/conversations/:conversationId/messages",
  asyncHandler(async (req, res) => {
    const afterSeq = parseOptionalIntegerQuery(req.query.afterSeq, "afterSeq");
    const beforeSeq = parseOptionalIntegerQuery(req.query.beforeSeq, "beforeSeq");
    const limit = parseLimit(req.query.limit);
    const mimeTypes = parseMimeTypes(req.query.mimeType);

    const seqFilter: Record<string, number> = {};

    if (afterSeq !== undefined) {
      seqFilter.$gt = afterSeq;
    }

    if (beforeSeq !== undefined) {
      seqFilter.$lt = beforeSeq;
    }

    const filter: Record<string, unknown> = {
      conversationId: req.params.conversationId
    };

    if (Object.keys(seqFilter).length > 0) {
      filter.seq = seqFilter;
    }

    if (mimeTypes && mimeTypes.length > 0) {
      filter["attachments.mimeType"] = {
        $in: mimeTypes
      };
    }

    const collection = await messagesCollection();
    const messages = await collection.find(filter).sort({ seq: 1 }).limit(limit).toArray();

    res.json(messages);
  })
);

messagesRouter.patch(
  "/messages/:id",
  asyncHandler(async (req, res) => {
    const _id = parseObjectId(req.params.id, "id");
    const update: Partial<Pick<MessageDocument, "body" | "editedAt" | "deliveryStatus" | "attachments">> = {};

    if (req.body.body !== undefined) {
      update.body = parseBody(req.body.body);
      update.editedAt = new Date();
    }

    if (req.body.deliveryStatus !== undefined) {
      update.deliveryStatus = parseStatus(req.body.deliveryStatus, "server_received");
    }

    if (req.body.attachments !== undefined) {
      update.attachments = parseAttachments(req.body.attachments);
    }

    if (Object.keys(update).length === 0) {
      throw new HttpError(400, "VALIDATION_ERROR", "No supported fields provided", {
        fields: ["body", "deliveryStatus", "attachments"]
      });
    }

    const collection = await messagesCollection();
    const result = await collection.findOneAndUpdate(
      { _id },
      {
        $set: update
      },
      {
        returnDocument: "after"
      }
    );

    if (!result) {
      throw new HttpError(404, "MESSAGE_NOT_FOUND", "Message not found");
    }

    res.json(result);
  })
);

messagesRouter.delete(
  "/messages/:id",
  asyncHandler(async (req, res) => {
    const _id = parseObjectId(req.params.id, "id");
    const collection = await messagesCollection();
    const result = await collection.findOneAndDelete({ _id });

    if (!result) {
      throw new HttpError(404, "MESSAGE_NOT_FOUND", "Message not found");
    }

    res.json(result);
  })
);
