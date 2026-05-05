import { Router } from "express";
import { sequelize } from "../modules/sequelize/sequelize";
import { ConversationAuditLog, DeliveryReceipt } from "../modules/sequelize/models";
import type { DeliveryReceiptStatus } from "../modules/sequelize/models/deliveryReceipt";
import { HttpError } from "../errors/httpError";
import { asyncHandler } from "../middleware/asyncHandler";
import { userValidation } from "./users";

const allowedStatuses = new Set<DeliveryReceiptStatus>(["server_received", "delivered", "read"]);

const requireString = (value: unknown, field: string) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "Field is required", { field });
  }

  return value.trim();
};

const optionalDate = (value: unknown, field: string) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "VALIDATION_ERROR", "Date must be a string", { field });
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid date", { field });
  }

  return date;
};

const parseMetadata = (value: unknown) => {
  if (value === undefined) {
    return {};
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "VALIDATION_ERROR", "metadata must be an object", {
      field: "metadata"
    });
  }

  return value as Record<string, unknown>;
};

const parseStatus = (value: unknown) => {
  const status = requireString(value, "status") as DeliveryReceiptStatus;

  if (!allowedStatuses.has(status)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid delivery receipt status", {
      field: "status"
    });
  }

  return status;
};

export const sequelizeAuditRouter = Router();

sequelizeAuditRouter.post(
  "/sequelize/receipts-with-audit",
  asyncHandler(async (req, res) => {
    const conversationId = requireString(req.body.conversationId, "conversationId");
    const actorId = requireString(req.body.actorId, "actorId");
    const action = requireString(req.body.action, "action");
    const messagePointerId = requireString(req.body.messagePointerId, "messagePointerId");
    const userId = requireString(req.body.userId, "userId");
    const status = parseStatus(req.body.status);
    const metadata = parseMetadata(req.body.metadata);
    const deliveredAt = optionalDate(req.body.deliveredAt, "deliveredAt");
    const readAt = optionalDate(req.body.readAt, "readAt");

    userValidation.requireUuid(conversationId, "conversationId");
    userValidation.requireUuid(actorId, "actorId");
    userValidation.requireUuid(messagePointerId, "messagePointerId");
    userValidation.requireUuid(userId, "userId");

    const result = await sequelize.transaction(async (transaction) => {
      const auditLog = await ConversationAuditLog.create(
        {
          conversationId,
          actorId,
          action,
          metadata
        },
        { transaction }
      );

      const deliveryReceipt = await DeliveryReceipt.create(
        {
          auditLogId: auditLog.id,
          messagePointerId,
          userId,
          status,
          deliveredAt,
          readAt
        },
        { transaction }
      );

      return ConversationAuditLog.findByPk(auditLog.id, {
        include: [
          {
            model: DeliveryReceipt,
            as: "deliveryReceipts",
            where: {
              id: deliveryReceipt.id
            },
            required: false
          }
        ],
        transaction
      });
    });

    res.status(201).json(result);
  })
);

sequelizeAuditRouter.get(
  "/sequelize/audit-logs/:conversationId",
  asyncHandler(async (req, res) => {
    userValidation.requireUuid(req.params.conversationId, "conversationId");

    const auditLogs = await ConversationAuditLog.findAll({
      where: {
        conversationId: req.params.conversationId
      },
      include: [
        {
          model: DeliveryReceipt,
          as: "deliveryReceipts"
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    res.json(auditLogs);
  })
);
