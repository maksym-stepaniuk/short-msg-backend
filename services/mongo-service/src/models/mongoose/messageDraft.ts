import { Schema, model, models, type HydratedDocument, type Model } from "mongoose";

const maxAttachmentSize = 10 * 1024 * 1024;

export type DraftAttachment = {
  fileName: string;
  mimeType: string;
  size: number;
  storageKey: string;
};

export type MessageDraftAttrs = {
  userId: string;
  conversationId: string;
  body: string;
  attachments: DraftAttachment[];
  lastActivityEvent?: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type MessageDraftMethods = {
  preview(): string;
};

export type MessageDraftDocument = HydratedDocument<MessageDraftAttrs, MessageDraftMethods>;

type MessageDraftModel = Model<MessageDraftAttrs, Record<string, never>, MessageDraftMethods>;

const attachmentSchema = new Schema<DraftAttachment>(
  {
    fileName: {
      type: String,
      required: true,
      trim: true
    },
    mimeType: {
      type: String,
      required: true,
      trim: true
    },
    size: {
      type: Number,
      required: true,
      validate: {
        validator: (value: number) => value > 0 && value <= maxAttachmentSize,
        message: "attachment size must be > 0 and <= 10 MB"
      }
    },
    storageKey: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    _id: false
  }
);

const messageDraftSchema = new Schema<MessageDraftAttrs, MessageDraftModel, MessageDraftMethods>(
  {
    userId: {
      type: String,
      required: true,
      trim: true
    },
    conversationId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    body: {
      type: String,
      required: true,
      validate: {
        validator: (value: string) => value.trim().length > 0 && value.length <= 2000,
        message: "draft body must be non-empty and at most 2000 characters"
      }
    },
    attachments: {
      type: [attachmentSchema],
      default: []
    },
    lastActivityEvent: {
      type: Schema.Types.ObjectId,
      ref: "ActivityEvent",
      required: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    versionKey: false
  }
);

messageDraftSchema.pre("save", function setUpdatedAt(next) {
  this.updatedAt = new Date();
  next();
});

messageDraftSchema.method("preview", function preview(this: MessageDraftDocument) {
  return this.body.slice(0, 50);
});

export const MessageDraft =
  (models.MessageDraft as MessageDraftModel | undefined) ??
  model<MessageDraftAttrs, MessageDraftModel>("MessageDraft", messageDraftSchema);
