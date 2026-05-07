import { ObjectId } from "mongodb";
import { messagesCollection } from "../db/messagesCollection";
import { HttpError } from "../errors/httpError";
import { asyncHandler } from "../middleware/asyncHandler";
import { Router } from "express";
import type { AttachmentMeta, MessageDocument } from "../types/message";

const requireString = (value: unknown, field: string) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "Field is required", { field });
  }

  return value.trim();
};

const parseObjectId = (value: string, field: string) => {
  if (!ObjectId.isValid(value)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid ObjectId", { field });
  }

  return new ObjectId(value);
};

const parseSeq = (value: unknown) => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new HttpError(400, "VALIDATION_ERROR", "seq must be a positive integer", {
      field: "seq"
    });
  }

  return value;
};

const parseCreatedAt = (value: unknown) => {
  if (value === undefined || value === null) {
    return new Date();
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "VALIDATION_ERROR", "createdAt must be an ISO string", {
      field: "createdAt"
    });
  }

  const createdAt = new Date(value);

  if (Number.isNaN(createdAt.getTime())) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid createdAt", {
      field: "createdAt"
    });
  }

  return createdAt;
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

    if (typeof item.size !== "number" || !Number.isInteger(item.size) || item.size < 0) {
      throw new HttpError(400, "VALIDATION_ERROR", "attachment size must be a non-negative integer", {
        field: `attachments[${index}].size`
      });
    }

    return {
      fileName: requireString(item.fileName, `attachments[${index}].fileName`),
      mimeType: requireString(item.mimeType, `attachments[${index}].mimeType`),
      size: item.size,
      storageKey: requireString(item.storageKey, `attachments[${index}].storageKey`)
    };
  });
};

export const internalMessagesRouter = Router();

internalMessagesRouter.post(
  "/internal/messages",
  asyncHandler(async (req, res) => {
    const message: MessageDocument = {
      conversationId: requireString(req.body.conversationId, "conversationId"),
      authorId: requireString(req.body.authorId, "authorId"),
      seq: parseSeq(req.body.seq),
      body: parseBody(req.body.body),
      createdAt: parseCreatedAt(req.body.createdAt),
      editedAt: null,
      deliveryStatus: "server_received",
      attachments: parseAttachments(req.body.attachments)
    };

    const clientMessageId = typeof req.body.clientMessageId === "string" && req.body.clientMessageId.trim().length > 0
      ? req.body.clientMessageId.trim()
      : undefined;

    if (clientMessageId) {
      message.clientMessageId = clientMessageId;
    }

    const collection = await messagesCollection();
    const result = await collection.insertOne(message);
    const created = await collection.findOne({ _id: result.insertedId });

    res.status(201).json(created);
  })
);

internalMessagesRouter.delete(
  "/internal/messages/:id",
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
