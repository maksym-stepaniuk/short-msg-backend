import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const idParamsSchema = z.object({
  id: uuidSchema
});

export const conversationIdParamsSchema = z.object({
  conversationId: uuidSchema
});

export const userIdParamsSchema = z.object({
  userId: uuidSchema
});

export const createUserBodySchema = z.object({
  email: z.string().trim().email(),
  username: z.string().trim().min(1).max(100)
});

export const createConversationBodySchema = z.object({
  type: z.enum(["direct", "group"]),
  title: z.string().trim().min(1).max(200).nullable().optional(),
  createdById: uuidSchema,
  memberIds: z.array(uuidSchema)
});

export const addMemberBodySchema = z.object({
  requesterId: uuidSchema,
  userId: uuidSchema,
  role: z.enum(["admin", "member"]).optional()
});

export const attachmentSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(255),
  size: z.number().int().nonnegative(),
  storageKey: z.string().trim().min(1).max(500)
});

export const sendMessageBodySchema = z
  .object({
    authorId: uuidSchema,
    body: z.string().max(2000).optional(),
    attachments: z.array(attachmentSchema).optional(),
    clientMessageId: z.string().trim().min(1).max(200).optional()
  })
  .refine((value) => (value.body?.trim().length ?? 0) > 0 || (value.attachments?.length ?? 0) > 0, {
    message: "Message body is required unless attachments are provided",
    path: ["body"]
  });

const optionalIntegerString = z
  .string()
  .regex(/^\d+$/)
  .optional();

export const listMessagesQuerySchema = z
  .object({
    requesterId: uuidSchema.optional(),
    afterSeq: optionalIntegerString,
    beforeSeq: optionalIntegerString,
    limit: optionalIntegerString,
    mimeType: z.string().trim().min(1).optional()
  })
  .passthrough();

export const searchMessagesQuerySchema = z
  .object({
    requesterId: uuidSchema.optional(),
    q: z.string().trim().min(1),
    limit: optionalIntegerString
  })
  .passthrough();

export const userIdHeaderSchema = z
  .object({
    "x-user-id": uuidSchema.optional()
  })
  .passthrough();

export const analyticsPerDayQuerySchema = z
  .object({
    conversationId: uuidSchema,
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional()
  })
  .passthrough();

export const analyticsPerConversationQuerySchema = z
  .object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional()
  })
  .passthrough();

