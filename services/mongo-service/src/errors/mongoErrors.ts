import { MongoServerError } from "mongodb";
import { HttpError } from "./httpError";

export const mapMongoError = (err: unknown): HttpError | null => {
  if (!(err instanceof MongoServerError)) {
    return null;
  }

  if (err.code === 11000) {
    return new HttpError(409, "MONGO_DUPLICATE_KEY", "Duplicate MongoDB key", {
      keyPattern: err.keyPattern ?? null,
      keyValue: err.keyValue ?? null
    });
  }

  return null;
};
