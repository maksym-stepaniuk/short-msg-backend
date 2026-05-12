import { Router } from "express";
import { mongoServiceClient } from "../clients/mongoServiceClient";
import { HttpError } from "../errors/httpError";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  optionalString,
  parseLimit,
  parseOptionalInteger,
  requireObjectBody,
  requireString,
  requireUuid
} from "./validators";
import { pgServiceClient } from "../clients/pgServiceClient";
import { validateRequest } from "../middleware/validateRequest";
import {
  conversationIdParamsSchema,
  listMessagesQuerySchema,
  searchMessagesQuerySchema,
  sendMessageBodySchema,
  userIdHeaderSchema
} from "./schemas";

export const gatewayMessagesRouter = Router();

type SeqReservation = {
  conversationId: string;
  nextSeq: number;
};

type MongoMessage = {
  _id: string;
  conversationId: string;
  authorId: string;
  seq: number;
  body: string;
  createdAt: string;
  attachments: unknown[];
  clientMessageId?: string;
};

const parseAttachments = (value: unknown) => {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new HttpError(400, "VALIDATION_ERROR", "attachments must be an array", {
      field: "attachments"
    });
  }

  return value;
};

const parseMessageBody = (value: unknown, attachments: unknown[]) => {
  const body = typeof value === "string" ? value.trim() : "";

  if (body.length === 0 && attachments.length === 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "Message body is required unless attachments are provided", {
      field: "body"
    });
  }

  if (body.length > 2000) {
    throw new HttpError(400, "VALIDATION_ERROR", "Message body is too long", {
      field: "body",
      maxLength: 2000
    });
  }

  return body;
};

const parseRequesterId = (queryValue: unknown, headerValue: string | undefined) => {
  const requesterId = optionalString(queryValue, "requesterId") ?? headerValue;

  return requireUuid(requireString(requesterId, "requesterId"), "requesterId");
};

const parseSearchLimit = (value: unknown) => {
  const limit = parseLimit(value, 20);

  if (limit > 50) {
    throw new HttpError(400, "VALIDATION_ERROR", "Limit must be between 1 and 50", {
      field: "limit"
    });
  }

  return limit;
};

const parseOptionalSeqCursor = (value: unknown, field: string) => {
  const cursor = parseOptionalInteger(value, field);

  if (cursor !== undefined && cursor < 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "Cursor must be a non-negative integer", {
      field
    });
  }

  return cursor;
};

const validateMembership = async (conversationId: string, requesterId: string) => {
  await pgServiceClient.request({
    method: "POST",
    path: `/internal/conversations/${conversationId}/validate-membership`,
    body: {
      authorId: requesterId
    }
  });
};

const compensateMongoMessage = async (mongoId: string) => {
  try {
    await mongoServiceClient.request({
      method: "DELETE",
      path: `/internal/messages/${mongoId}`
    });
    console.log(`Compensation succeeded: removed Mongo message ${mongoId}`);
  } catch (err) {
    console.error(`Compensation failed: could not remove Mongo message ${mongoId}`, err);
  }
};

const cancelReservation = async (conversationId: string, seq: number) => {
  try {
    await pgServiceClient.request({
      method: "POST",
      path: "/internal/messages/cancel-reservation",
      body: {
        conversationId,
        seq
      }
    });
  } catch (err) {
    console.error(`Reservation cancellation failed for conversation ${conversationId} seq ${seq}`, err);
  }
};

gatewayMessagesRouter.post(
  "/conversations/:conversationId/messages",
  validateRequest({
    params: conversationIdParamsSchema,
    body: sendMessageBodySchema
  }),
  asyncHandler(async (req, res) => {
    const body = requireObjectBody(req.body);
    const conversationId = requireUuid(requireString(req.params.conversationId, "conversationId"), "conversationId");
    const authorId = requireUuid(requireString(body.authorId, "authorId"), "authorId");
    const attachments = parseAttachments(body.attachments);
    const messageBody = parseMessageBody(body.body, attachments);
    const clientMessageId = optionalString(body.clientMessageId, "clientMessageId");
    const createdAt = new Date().toISOString();

    await validateMembership(conversationId, authorId);

    const reservation = await pgServiceClient.request<SeqReservation>({
      method: "POST",
      path: `/internal/conversations/${conversationId}/reserve-seq`
    });

    let message: MongoMessage | null = null;

    try {
      message = await mongoServiceClient.request<MongoMessage>({
        method: "POST",
        path: "/internal/messages",
        body: {
          conversationId,
          authorId,
          seq: reservation.nextSeq,
          body: messageBody,
          attachments,
          clientMessageId,
          createdAt
        }
      });
    } catch (err) {
      await cancelReservation(conversationId, reservation.nextSeq);
      throw err;
    }

    try {
      await pgServiceClient.request({
        method: "POST",
        path: "/internal/messages/finalize",
        body: {
          conversationId,
          seq: reservation.nextSeq,
          mongoId: message._id,
          authorId,
          createdAt: message.createdAt,
          simulateFailure: req.header("x-simulate-pg-finalize-failure") === "true"
        }
      });
    } catch (err) {
      await compensateMongoMessage(message._id);
      await cancelReservation(conversationId, reservation.nextSeq);
      throw err;
    }

    res.status(201).json(message);
  })
);

gatewayMessagesRouter.get(
  "/conversations/:conversationId/messages/search",
  validateRequest({
    params: conversationIdParamsSchema,
    query: searchMessagesQuerySchema,
    headers: userIdHeaderSchema
  }),
  asyncHandler(async (req, res) => {
    const conversationId = requireUuid(requireString(req.params.conversationId, "conversationId"), "conversationId");
    const requesterId = parseRequesterId(req.query.requesterId, req.header("x-user-id"));
    const q = requireString(req.query.q, "q");
    const limit = parseSearchLimit(req.query.limit);

    await validateMembership(conversationId, requesterId);

    const messages = await mongoServiceClient.request({
      path: "/messages/search",
      query: {
        conversationId,
        q,
        limit
      }
    });

    res.json(messages);
  })
);

gatewayMessagesRouter.get(
  "/conversations/:conversationId/messages",
  validateRequest({
    params: conversationIdParamsSchema,
    query: listMessagesQuerySchema,
    headers: userIdHeaderSchema
  }),
  asyncHandler(async (req, res) => {
    const conversationId = requireUuid(requireString(req.params.conversationId, "conversationId"), "conversationId");
    const requesterId = parseRequesterId(req.query.requesterId, req.header("x-user-id"));
    const afterSeq = parseOptionalSeqCursor(req.query.afterSeq, "afterSeq");
    const beforeSeq = parseOptionalSeqCursor(req.query.beforeSeq, "beforeSeq");
    const limit = parseLimit(req.query.limit, 20);
    const mimeType = optionalString(req.query.mimeType, "mimeType");

    await validateMembership(conversationId, requesterId);

    const messages = await mongoServiceClient.request({
      path: `/conversations/${encodeURIComponent(conversationId)}/messages`,
      query: {
        afterSeq,
        beforeSeq,
        limit,
        mimeType
      }
    });

    res.json(messages);
  })
);
