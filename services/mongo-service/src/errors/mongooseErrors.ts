import mongoose from "mongoose";
import { HttpError } from "./httpError";

export const mapMongooseError = (err: unknown): HttpError | null => {
  if (err instanceof mongoose.Error.ValidationError) {
    return new HttpError(400, "MONGOOSE_VALIDATION_ERROR", "Mongoose validation failed", {
      fields: Object.keys(err.errors)
    });
  }

  if (err instanceof mongoose.Error.CastError) {
    return new HttpError(400, "MONGOOSE_CAST_ERROR", "Invalid Mongoose value", {
      path: err.path,
      value: err.value
    });
  }

  return null;
};
