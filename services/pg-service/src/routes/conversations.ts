import { Router } from "express";
import { MemberRole } from "@prisma/client";
import { knexDb } from "../db/knex";
import { prisma } from "../db/prisma";
import { HttpError } from "../errors/httpError";
import { asyncHandler } from "../middleware/asyncHandler";
import { userValidation } from "./users";

type ConversationTypeInput = "direct" | "group";

type SearchConversationRow = {
  id: string;
  type: ConversationTypeInput;
  title: string | null;
  createdById: string;
  lastMessageAt: Date | null;
  lastSeq: number;
  createdAt: Date;
};

const requireStringArray = (value: unknown, field: string) => {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new HttpError(400, "VALIDATION_ERROR", "Expected string array", { field });
  }

  return value;
};

const parseConversationType = (value: unknown): ConversationTypeInput => {
  if (value !== "direct" && value !== "group") {
    throw new HttpError(400, "VALIDATION_ERROR", "Conversation type must be direct or group", {
      field: "type"
    });
  }

  return value;
};

const uniqueUserIds = (userIds: string[]) => [...new Set(userIds)];

export const conversationsRouter = Router();

const singleQueryParam = (value: unknown, field: string) => {
  if (Array.isArray(value)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Query parameter must be provided once", { field });
  }

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
};

const parseOptionalDate = (value: unknown, field: string) => {
  const param = singleQueryParam(value, field);

  if (!param) {
    return undefined;
  }

  const date = new Date(param);

  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid date", { field });
  }

  return date;
};

const parseLimit = (value: unknown) => {
  const param = singleQueryParam(value, "limit");

  if (!param) {
    return 50;
  }

  const limit = Number(param);

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new HttpError(400, "VALIDATION_ERROR", "Limit must be an integer between 1 and 100", {
      field: "limit"
    });
  }

  return limit;
};

conversationsRouter.get(
  "/conversations/search",
  asyncHandler(async (req, res) => {
    const userId = singleQueryParam(req.query.userId, "userId");
    const type = singleQueryParam(req.query.type, "type");
    const title = singleQueryParam(req.query.title, "title");
    const createdAfter = parseOptionalDate(req.query.createdAfter, "createdAfter");
    const createdBefore = parseOptionalDate(req.query.createdBefore, "createdBefore");
    const limit = parseLimit(req.query.limit);

    if (userId) {
      userValidation.requireUuid(userId, "userId");
    }

    if (type && type !== "direct" && type !== "group") {
      throw new HttpError(400, "VALIDATION_ERROR", "Type must be direct or group", { field: "type" });
    }

    const query = knexDb<SearchConversationRow>("conversations as c")
      .select([
        "c.id",
        "c.type",
        "c.title",
        "c.createdById",
        "c.lastMessageAt",
        "c.lastSeq",
        "c.createdAt"
      ])
      .modify((builder) => {
        if (userId) {
          builder
            .innerJoin("conversation_members as cm", "cm.conversationId", "c.id")
            .where("cm.userId", userId);
        }

        if (type) {
          builder.where("c.type", type);
        }

        if (title) {
          builder.whereILike("c.title", `%${title}%`);
        }

        if (createdAfter) {
          builder.where("c.createdAt", ">=", createdAfter);
        }

        if (createdBefore) {
          builder.where("c.createdAt", "<=", createdBefore);
        }
      })
      .orderBy([
        { column: "c.lastMessageAt", order: "desc", nulls: "last" },
        { column: "c.createdAt", order: "desc" }
      ])
      .limit(limit);

    const conversations = await query;

    await knexDb("conversation_search_audit").insert({
      userId: userId ?? null,
      type: type ?? null,
      title: title ?? null,
      createdAfter: createdAfter ?? null,
      createdBefore: createdBefore ?? null,
      resultCount: conversations.length
    });

    res.json(conversations);
  })
);

conversationsRouter.post(
  "/conversations",
  asyncHandler(async (req, res) => {
    const type = parseConversationType(req.body.type);
    const createdById = userValidation.requireString(req.body.createdById, "createdById");
    userValidation.requireUuid(createdById, "createdById");

    const memberIds = requireStringArray(req.body.memberIds, "memberIds");
    memberIds.forEach((userId) => userValidation.requireUuid(userId, "memberIds"));

    const participantIds = uniqueUserIds([createdById, ...memberIds]);

    if (type === "direct" && participantIds.length !== 2) {
      throw new HttpError(400, "DIRECT_CONVERSATION_REQUIRES_TWO_MEMBERS", "Direct conversation requires exactly two participants");
    }

    if (type === "group" && participantIds.length < 1) {
      throw new HttpError(400, "GROUP_CONVERSATION_REQUIRES_MEMBERS", "Group conversation requires at least one participant");
    }

    const title = typeof req.body.title === "string" && req.body.title.trim().length > 0 ? req.body.title.trim() : null;

    const conversation = await prisma.$transaction(async (tx) => {
      const created = await tx.conversation.create({
        data: {
          type,
          title,
          createdById
        }
      });

      await tx.conversationMember.createMany({
        data: participantIds.map((userId) => ({
          conversationId: created.id,
          userId,
          role: type === "group" && userId === createdById ? MemberRole.admin : MemberRole.member
        }))
      });

      return tx.conversation.findUniqueOrThrow({
        where: {
          id: created.id
        },
        include: {
          members: {
            include: {
              user: true
            }
          }
        }
      });
    });

    res.status(201).json(conversation);
  })
);

conversationsRouter.get(
  "/conversations/:id",
  asyncHandler(async (req, res) => {
    userValidation.requireUuid(req.params.id, "id");

    const conversation = await prisma.conversation.findUnique({
      where: {
        id: req.params.id
      },
      include: {
        members: {
          include: {
            user: true
          }
        },
        messagePointers: {
          orderBy: {
            seq: "asc"
          }
        }
      }
    });

    if (!conversation) {
      throw new HttpError(404, "CONVERSATION_NOT_FOUND", "Conversation not found");
    }

    res.json(conversation);
  })
);

conversationsRouter.post(
  "/conversations/:conversationId/members",
  asyncHandler(async (req, res) => {
    userValidation.requireUuid(req.params.conversationId, "conversationId");
    const userId = userValidation.requireString(req.body.userId, "userId");
    userValidation.requireUuid(userId, "userId");

    const conversation = await prisma.conversation.findUnique({
      where: {
        id: req.params.conversationId
      }
    });

    if (!conversation) {
      throw new HttpError(404, "CONVERSATION_NOT_FOUND", "Conversation not found");
    }

    if (conversation.type === "direct") {
      throw new HttpError(409, "DIRECT_CONVERSATION_MEMBERS_LOCKED", "Direct conversation cannot have more than two members");
    }

    const requesterId = userValidation.requireString(req.body.requesterId, "requesterId");
    userValidation.requireUuid(requesterId, "requesterId");

    const requesterMembership = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: req.params.conversationId,
          userId: requesterId
        }
      }
    });

    if (!requesterMembership || requesterMembership.role !== "admin") {
      throw new HttpError(403, "ADMIN_REQUIRED", "Only group admin can add members");
    }

    const role = req.body.role === "admin" ? MemberRole.admin : MemberRole.member;

    const member = await prisma.conversationMember.create({
      data: {
        conversationId: req.params.conversationId,
        userId,
        role
      },
      include: {
        user: true
      }
    });

    res.status(201).json(member);
  })
);

conversationsRouter.get(
  "/conversations/:conversationId/members",
  asyncHandler(async (req, res) => {
    userValidation.requireUuid(req.params.conversationId, "conversationId");

    const members = await prisma.conversationMember.findMany({
      where: {
        conversationId: req.params.conversationId
      },
      include: {
        user: true
      },
      orderBy: {
        joinedAt: "asc"
      }
    });

    res.json(members);
  })
);
