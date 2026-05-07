import { DeliveryStatus } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../db/prisma";
import { HttpError } from "../errors/httpError";
import { asyncHandler } from "../middleware/asyncHandler";
import { userValidation } from "./users";

const requireString = (value: unknown, field: string) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "Field is required", { field });
  }

  return value.trim();
};

const parseSeq = (value: unknown) => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new HttpError(400, "VALIDATION_ERROR", "seq must be a positive integer", {
      field: "seq"
    });
  }

  return value;
};

const parseDate = (value: unknown, field: string) => {
  if (typeof value !== "string") {
    throw new HttpError(400, "VALIDATION_ERROR", "Date must be an ISO string", { field });
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid date", { field });
  }

  return date;
};

export const internalMessagesRouter = Router();

internalMessagesRouter.post(
  "/internal/conversations/:conversationId/validate-membership",
  asyncHandler(async (req, res) => {
    userValidation.requireUuid(req.params.conversationId, "conversationId");
    const authorId = requireString(req.body.authorId, "authorId");
    userValidation.requireUuid(authorId, "authorId");

    const conversation = await prisma.conversation.findUnique({
      where: {
        id: req.params.conversationId
      },
      select: {
        id: true
      }
    });

    if (!conversation) {
      throw new HttpError(404, "CONVERSATION_NOT_FOUND", "Conversation not found");
    }

    const membership = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: req.params.conversationId,
          userId: authorId
        }
      }
    });

    if (!membership) {
      throw new HttpError(403, "CONVERSATION_MEMBERSHIP_REQUIRED", "User is not a conversation member");
    }

    res.json({
      ok: true,
      conversationId: conversation.id,
      authorId
    });
  })
);

internalMessagesRouter.post(
  "/internal/conversations/:conversationId/reserve-seq",
  asyncHandler(async (req, res) => {
    userValidation.requireUuid(req.params.conversationId, "conversationId");

    const [reservation] = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string; lastSeq: number }[]>`
        SELECT id, "lastSeq"
        FROM conversations
        WHERE id = ${req.params.conversationId}::uuid
        FOR UPDATE
      `;

      if (!rows[0]) {
        throw new HttpError(404, "CONVERSATION_NOT_FOUND", "Conversation not found");
      }

      const nextSeq = rows[0].lastSeq + 1;

      await tx.conversation.update({
        where: {
          id: req.params.conversationId
        },
        data: {
          lastSeq: nextSeq
        }
      });

      return [
        {
          conversationId: rows[0].id,
          nextSeq
        }
      ];
    });

    res.json(reservation);
  })
);

internalMessagesRouter.post(
  "/internal/messages/finalize",
  asyncHandler(async (req, res) => {
    if (req.body.simulateFailure === true) {
      throw new HttpError(500, "SIMULATED_PG_FINALIZE_FAILURE", "Simulated PG finalization failure");
    }

    const conversationId = requireString(req.body.conversationId, "conversationId");
    const mongoId = requireString(req.body.mongoId, "mongoId");
    const authorId = requireString(req.body.authorId, "authorId");
    const seq = parseSeq(req.body.seq);
    const createdAt = parseDate(req.body.createdAt, "createdAt");
    userValidation.requireUuid(conversationId, "conversationId");
    userValidation.requireUuid(authorId, "authorId");

    const pointer = await prisma.$transaction(async (tx) => {
      const created = await tx.messagePointer.create({
        data: {
          conversationId,
          seq,
          mongoId,
          authorId,
          deliveryStatus: DeliveryStatus.server_received,
          createdAt
        }
      });

      await tx.conversation.update({
        where: {
          id: conversationId
        },
        data: {
          lastMessageAt: createdAt,
          lastSeq: {
            set: seq
          }
        }
      });

      return created;
    });

    res.status(201).json(pointer);
  })
);

internalMessagesRouter.post(
  "/internal/messages/cancel-reservation",
  asyncHandler(async (req, res) => {
    const conversationId = requireString(req.body.conversationId, "conversationId");
    const seq = parseSeq(req.body.seq);
    userValidation.requireUuid(conversationId, "conversationId");

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.$executeRaw`
        UPDATE conversations
        SET "lastSeq" = "lastSeq" - 1
        WHERE id = ${conversationId}::uuid
          AND "lastSeq" = ${seq}
          AND NOT EXISTS (
            SELECT 1
            FROM message_pointers
            WHERE "conversationId" = ${conversationId}::uuid
              AND seq = ${seq}
          )
      `;

      return {
        cancelled: updated === 1
      };
    });

    res.json(result);
  })
);
