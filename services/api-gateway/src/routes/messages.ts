import { Router } from "express";
import { mongoServiceClient } from "../clients/mongoServiceClient";
import { HttpError } from "../errors/httpError";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  optionalString,
  parseLimit,
  parseOptionalInteger,
  requireMessageBody,
  requireObjectBody,
  requireString
} from "./validators";

export const gatewayMessagesRouter = Router();

gatewayMessagesRouter.post(
  "/conversations/:conversationId/messages",
  asyncHandler(async (req, res) => {
    const body = requireObjectBody(req.body);
    const conversationId = requireString(req.params.conversationId, "conversationId");
    const authorId = requireString(body.authorId, "authorId");
    const messageBody = requireMessageBody(body.body);

    if (typeof body.seq !== "number" || !Number.isInteger(body.seq)) {
      throw new HttpError(400, "VALIDATION_ERROR", "Message seq must be an integer", {
        field: "seq"
      });
    }

    const message = await mongoServiceClient.request({
      method: "POST",
      path: "/messages",
      body: {
        ...body,
        conversationId,
        authorId,
        body: messageBody
      }
    });

    res.status(201).json(message);
  })
);

gatewayMessagesRouter.get(
  "/conversations/:conversationId/messages/search",
  asyncHandler(async (req, res) => {
    const conversationId = requireString(req.params.conversationId, "conversationId");
    const q = requireString(req.query.q, "q");
    const limit = parseLimit(req.query.limit);

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
  asyncHandler(async (req, res) => {
    const conversationId = requireString(req.params.conversationId, "conversationId");
    const afterSeq = parseOptionalInteger(req.query.afterSeq, "afterSeq");
    const beforeSeq = parseOptionalInteger(req.query.beforeSeq, "beforeSeq");
    const limit = parseLimit(req.query.limit);
    const mimeType = optionalString(req.query.mimeType, "mimeType");

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
