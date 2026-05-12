import { Router } from "express";
import { prisma } from "../db/prisma";
import { HttpError } from "../errors/httpError";
import { asyncHandler } from "../middleware/asyncHandler";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type UserConversationRow = {
  id: string;
  type: string;
  title: string | null;
  createdById: string;
  lastMessageAt: Date | null;
  lastSeq: number;
  createdAt: Date;
  role: string;
  joinedAt: Date;
};

const requireUuid = (value: string, field: string) => {
  if (!uuidPattern.test(value)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid UUID", { field });
  }
};

const requireString = (value: unknown, field: string) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "Field is required", { field });
  }

  return value.trim();
};

export const usersRouter = Router();

usersRouter.post(
  "/users",
  asyncHandler(async (req, res) => {
    const email = requireString(req.body.email, "email").toLowerCase();
    const username = requireString(req.body.username, "username");

    const user = await prisma.user.create({
      data: {
        email,
        username
      }
    });

    res.status(201).json(user);
  })
);

usersRouter.get(
  "/users/:id",
  asyncHandler(async (req, res) => {
    requireUuid(req.params.id, "id");

    const user = await prisma.user.findUnique({
      where: {
        id: req.params.id
      }
    });

    if (!user) {
      throw new HttpError(404, "NOT_FOUND", "User not found");
    }

    res.json(user);
  })
);

usersRouter.delete(
  "/users/:id",
  asyncHandler(async (req, res) => {
    requireUuid(req.params.id, "id");

    const user = await prisma.user.update({
      where: {
        id: req.params.id
      },
      data: {
        deletedAt: new Date()
      }
    });

    res.json(user);
  })
);

usersRouter.get(
  "/users/:userId/conversations",
  asyncHandler(async (req, res) => {
    requireUuid(req.params.userId, "userId");

    const conversations = await prisma.$queryRaw<UserConversationRow[]>`
      SELECT
        c.id,
        c.type::text AS type,
        c.title,
        c."createdById",
        c."lastMessageAt",
        c."lastSeq",
        c."createdAt",
        cm.role::text AS role,
        cm."joinedAt"
      FROM conversations c
      INNER JOIN conversation_members cm ON cm."conversationId" = c.id
      WHERE cm."userId" = ${req.params.userId}::uuid
      ORDER BY c."lastMessageAt" DESC NULLS LAST, c."createdAt" DESC
    `;

    res.json(conversations);
  })
);

export const userValidation = {
  requireString,
  requireUuid
};
