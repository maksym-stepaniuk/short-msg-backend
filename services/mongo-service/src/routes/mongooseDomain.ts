import { Types } from "mongoose";
import { Router } from "express";
import { HttpError } from "../errors/httpError";
import { asyncHandler } from "../middleware/asyncHandler";
import { ActivityEvent, activityEventTypes, type ActivityEventType } from "../models/mongoose/activityEvent";
import { MessageDraft, type DraftAttachment } from "../models/mongoose/messageDraft";

const maxAttachmentSize = 10 * 1024 * 1024;

const requireString = (value: unknown, field: string) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "Field is required", { field });
  }

  return value.trim();
};

const parseObjectId = (value: string, field: string) => {
  if (!Types.ObjectId.isValid(value)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid ObjectId", { field });
  }

  return new Types.ObjectId(value);
};

const parseBody = (value: unknown) => {
  const body = requireString(value, "body");

  if (body.length > 2000) {
    throw new HttpError(400, "VALIDATION_ERROR", "Draft body is too long", {
      field: "body",
      maxLength: 2000
    });
  }

  return body;
};

const parseAttachments = (value: unknown): DraftAttachment[] => {
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

    if (typeof item.size !== "number" || !Number.isInteger(item.size) || item.size <= 0 || item.size > maxAttachmentSize) {
      throw new HttpError(400, "VALIDATION_ERROR", "attachment size must be > 0 and <= 10 MB", {
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

const parseEventType = (value: unknown) => {
  const type = requireString(value, "type") as ActivityEventType;

  if (!activityEventTypes.includes(type)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Activity event type is not allowed", { field: "type" });
  }

  return type;
};

const parsePayload = (value: unknown) => {
  if (value === undefined) {
    return {};
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "VALIDATION_ERROR", "payload must be an object", { field: "payload" });
  }

  return value as Record<string, unknown>;
};

const parseLimit = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return 20;
  }

  if (Array.isArray(value)) {
    throw new HttpError(400, "VALIDATION_ERROR", "limit must be provided once", { field: "limit" });
  }

  const limit = Number(value);

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new HttpError(400, "VALIDATION_ERROR", "limit must be between 1 and 100", { field: "limit" });
  }

  return limit;
};

export const mongooseDomainRouter = Router();

mongooseDomainRouter.post(
  "/drafts",
  asyncHandler(async (req, res) => {
    const lastActivityEvent =
      typeof req.body.lastActivityEvent === "string"
        ? parseObjectId(req.body.lastActivityEvent, "lastActivityEvent")
        : undefined;

    const draft = await MessageDraft.create({
      userId: requireString(req.body.userId, "userId"),
      conversationId: requireString(req.body.conversationId, "conversationId"),
      body: parseBody(req.body.body),
      attachments: parseAttachments(req.body.attachments),
      lastActivityEvent
    });

    res.status(201).json({
      ...draft.toObject(),
      preview: draft.preview()
    });
  })
);

mongooseDomainRouter.get(
  "/drafts/:id",
  asyncHandler(async (req, res) => {
    const draft = await MessageDraft.findById(parseObjectId(req.params.id, "id")).exec();

    if (!draft) {
      throw new HttpError(404, "DRAFT_NOT_FOUND", "Draft not found");
    }

    res.json({
      ...draft.toObject(),
      preview: draft.preview()
    });
  })
);

mongooseDomainRouter.get(
  "/drafts/:id/with-activity",
  asyncHandler(async (req, res) => {
    const draft = await MessageDraft.findById(parseObjectId(req.params.id, "id"))
      .populate("lastActivityEvent")
      .exec();

    if (!draft) {
      throw new HttpError(404, "DRAFT_NOT_FOUND", "Draft not found");
    }

    res.json({
      ...draft.toObject(),
      preview: draft.preview()
    });
  })
);

mongooseDomainRouter.post(
  "/activity-events",
  asyncHandler(async (req, res) => {
    const draftRef = typeof req.body.draftRef === "string" ? parseObjectId(req.body.draftRef, "draftRef") : undefined;

    const event = await ActivityEvent.create({
      userId: requireString(req.body.userId, "userId"),
      conversationId: requireString(req.body.conversationId, "conversationId"),
      type: parseEventType(req.body.type),
      payload: parsePayload(req.body.payload),
      draftRef
    });

    if (draftRef) {
      await MessageDraft.findByIdAndUpdate(draftRef, {
        lastActivityEvent: event._id
      }).exec();
    }

    res.status(201).json(event);
  })
);

mongooseDomainRouter.get(
  "/activity-events/recent/:conversationId",
  asyncHandler(async (req, res) => {
    const limit = parseLimit(req.query.limit);
    const events = await ActivityEvent.findRecentForConversation(req.params.conversationId, limit);

    res.json(events);
  })
);
