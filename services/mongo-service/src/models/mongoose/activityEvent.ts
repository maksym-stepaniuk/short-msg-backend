import { Model, Schema, model, models, type HydratedDocument } from "mongoose";

export const activityEventTypes = [
  "MESSAGE_SENT",
  "MEMBER_ADDED",
  "MESSAGE_READ",
  "CONVERSATION_CREATED"
] as const;

export type ActivityEventType = (typeof activityEventTypes)[number];

export type ActivityEventAttrs = {
  userId: string;
  conversationId: string;
  type: ActivityEventType;
  payload: Record<string, unknown>;
  draftRef?: Schema.Types.ObjectId;
  createdAt: Date;
};

export interface ActivityEventModel extends Model<ActivityEventAttrs> {
  findRecentForConversation(conversationId: string, limit: number): Promise<HydratedDocument<ActivityEventAttrs>[]>;
}

const activityEventSchema = new Schema<ActivityEventAttrs, ActivityEventModel>(
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
    type: {
      type: String,
      required: true,
      validate: {
        validator: (value: string) => activityEventTypes.includes(value as ActivityEventType),
        message: "ActivityEvent type is not allowed"
      }
    },
    payload: {
      type: Schema.Types.Mixed,
      default: {}
    },
    draftRef: {
      type: Schema.Types.ObjectId,
      ref: "MessageDraft",
      required: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    versionKey: false
  }
);

activityEventSchema.pre("save", function ensureCreatedAt(next) {
  this.createdAt = this.createdAt ?? new Date();
  next();
});

activityEventSchema.statics.findRecentForConversation = function findRecentForConversation(
  conversationId: string,
  limit: number
) {
  return this.find({ conversationId }).sort({ createdAt: -1 }).limit(limit).exec();
};

export const ActivityEvent =
  (models.ActivityEvent as ActivityEventModel | undefined) ??
  model<ActivityEventAttrs, ActivityEventModel>("ActivityEvent", activityEventSchema);
