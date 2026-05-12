import { Router } from "express";
import { mongoServiceClient } from "../clients/mongoServiceClient";
import { asyncHandler } from "../middleware/asyncHandler";
import { validateRequest } from "../middleware/validateRequest";
import { analyticsPerConversationQuerySchema, analyticsPerDayQuerySchema } from "./schemas";
import { optionalString, requireString } from "./validators";

export const gatewayAnalyticsRouter = Router();

gatewayAnalyticsRouter.get(
  "/analytics/messages-per-day",
  validateRequest({
    query: analyticsPerDayQuerySchema
  }),
  asyncHandler(async (req, res) => {
    const conversationId = requireString(req.query.conversationId, "conversationId");
    const from = optionalString(req.query.from, "from");
    const to = optionalString(req.query.to, "to");

    const result = await mongoServiceClient.request({
      path: "/analytics/messages-per-day",
      query: {
        conversationId,
        from,
        to
      }
    });

    res.json(result);
  })
);

gatewayAnalyticsRouter.get(
  "/analytics/messages-per-conversation",
  validateRequest({
    query: analyticsPerConversationQuerySchema
  }),
  asyncHandler(async (req, res) => {
    const from = optionalString(req.query.from, "from");
    const to = optionalString(req.query.to, "to");

    const result = await mongoServiceClient.request({
      path: "/analytics/messages-per-conversation",
      query: {
        from,
        to
      }
    });

    res.json(result);
  })
);
