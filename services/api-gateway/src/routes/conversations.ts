import { Router } from "express";
import { pgServiceClient } from "../clients/pgServiceClient";
import { HttpError } from "../errors/httpError";
import { asyncHandler } from "../middleware/asyncHandler";
import { validateRequest } from "../middleware/validateRequest";
import {
  addMemberBodySchema,
  conversationIdParamsSchema,
  createConversationBodySchema,
  idParamsSchema,
  userIdParamsSchema
} from "./schemas";
import { requireObjectBody, requireString, requireUuid } from "./validators";

export const conversationsRouter = Router();

conversationsRouter.post(
  "/conversations",
  validateRequest({
    body: createConversationBodySchema
  }),
  asyncHandler(async (req, res) => {
    const body = requireObjectBody(req.body);
    const type = requireString(body.type, "type");
    const createdById = requireUuid(requireString(body.createdById, "createdById"), "createdById");

    if (type !== "direct" && type !== "group") {
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid conversation type", {
        field: "type"
      });
    }

    const conversation = await pgServiceClient.request({
      method: "POST",
      path: "/conversations",
      body: {
        ...body,
        type,
        createdById
      }
    });

    res.status(201).json(conversation);
  })
);

conversationsRouter.get(
  "/conversations/:id",
  validateRequest({
    params: idParamsSchema
  }),
  asyncHandler(async (req, res) => {
    requireUuid(req.params.id, "id");

    const conversation = await pgServiceClient.request({
      path: `/conversations/${req.params.id}`
    });

    res.json(conversation);
  })
);

conversationsRouter.get(
  "/users/:userId/conversations",
  validateRequest({
    params: userIdParamsSchema
  }),
  asyncHandler(async (req, res) => {
    requireUuid(req.params.userId, "userId");

    const conversations = await pgServiceClient.request({
      path: `/users/${req.params.userId}/conversations`
    });

    res.json(conversations);
  })
);

conversationsRouter.post(
  "/conversations/:conversationId/members",
  validateRequest({
    params: conversationIdParamsSchema,
    body: addMemberBodySchema
  }),
  asyncHandler(async (req, res) => {
    requireUuid(req.params.conversationId, "conversationId");
    const body = requireObjectBody(req.body);
    requireUuid(requireString(body.userId, "userId"), "userId");
    requireUuid(requireString(body.requesterId, "requesterId"), "requesterId");

    const member = await pgServiceClient.request({
      method: "POST",
      path: `/conversations/${req.params.conversationId}/members`,
      body
    });

    res.status(201).json(member);
  })
);

conversationsRouter.get(
  "/conversations/:conversationId/members",
  validateRequest({
    params: conversationIdParamsSchema
  }),
  asyncHandler(async (req, res) => {
    requireUuid(req.params.conversationId, "conversationId");

    const members = await pgServiceClient.request({
      path: `/conversations/${req.params.conversationId}/members`
    });

    res.json(members);
  })
);
