CREATE TYPE "ConversationType" AS ENUM ('direct', 'group');
CREATE TYPE "MemberRole" AS ENUM ('admin', 'member');
CREATE TYPE "DeliveryStatus" AS ENUM ('accepted', 'delivered', 'failed');

CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversations" (
  "id" UUID NOT NULL,
  "type" "ConversationType" NOT NULL,
  "title" TEXT,
  "createdById" UUID NOT NULL,
  "lastMessageAt" TIMESTAMP(3),
  "lastSeq" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversation_members" (
  "conversationId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "role" "MemberRole" NOT NULL DEFAULT 'member',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversation_members_pkey" PRIMARY KEY ("conversationId", "userId")
);

CREATE TABLE "message_pointers" (
  "id" UUID NOT NULL,
  "conversationId" UUID NOT NULL,
  "seq" INTEGER NOT NULL,
  "mongoId" TEXT NOT NULL,
  "authorId" UUID NOT NULL,
  "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'accepted',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "message_pointers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "message_pointers_mongoId_key" ON "message_pointers"("mongoId");
CREATE UNIQUE INDEX "message_pointers_conversationId_seq_key" ON "message_pointers"("conversationId", "seq");

ALTER TABLE "conversations"
  ADD CONSTRAINT "conversations_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conversation_members"
  ADD CONSTRAINT "conversation_members_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversation_members"
  ADD CONSTRAINT "conversation_members_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "message_pointers"
  ADD CONSTRAINT "message_pointers_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "message_pointers"
  ADD CONSTRAINT "message_pointers_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
