import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "../errors/httpError";
import { mapMongooseError } from "../errors/mongooseErrors";
import { mapMongoError } from "../errors/mongoErrors";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation error",
      code: "VALIDATION_ERROR",
      details: {
        issues: err.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      }
    });
    return;
  }

  const mongooseError = mapMongooseError(err);

  if (mongooseError) {
    res.status(mongooseError.statusCode).json({
      error: mongooseError.message,
      code: mongooseError.code,
      details: mongooseError.details
    });
    return;
  }

  const mongoError = mapMongoError(err);

  if (mongoError) {
    res.status(mongoError.statusCode).json({
      error: mongoError.message,
      code: mongoError.code,
      details: mongoError.details
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details
    });
    return;
  }

  res.status(500).json({
    error: "Internal server error",
    code: "INTERNAL_SERVER_ERROR",
    details: null
  });
};
