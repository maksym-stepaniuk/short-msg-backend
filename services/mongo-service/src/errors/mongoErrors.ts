import { MongoServerError } from "mongodb";
import { HttpError } from "./httpError";

export const mapMongoError = (err: unknown): HttpError | null => {
  if (!(err instanceof MongoServerError)) {
    return null;
  }

  if (err.code === 11000) {
    if (err.errmsg?.includes("messages_client_message_id_unique")) {
      return new HttpError(409, "IDEMPOTENCY_CONFLICT", "Message with this clientMessageId already exists", {
        keyPattern: err.keyPattern ?? null,
        keyValue: err.keyValue ?? null
      });
    }

    return new HttpError(409, "MONGO_DUPLICATE_KEY", "Duplicate MongoDB key", {
      keyPattern: err.keyPattern ?? null,
      keyValue: err.keyValue ?? null
    });
  }

  return null;
};
