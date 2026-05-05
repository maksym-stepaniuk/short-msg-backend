import type { ObjectId } from "mongodb";

export type DeliveryStatus = "server_received" | "delivered" | "read";

export type AttachmentMeta = {
  fileName: string;
  mimeType: string;
  size: number;
  storageKey: string;
};

export type MessageDocument = {
  _id?: ObjectId;
  conversationId: string;
  authorId: string;
  seq: number;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  deliveryStatus: DeliveryStatus;
  attachments: AttachmentMeta[];
  clientMessageId?: string;
};
