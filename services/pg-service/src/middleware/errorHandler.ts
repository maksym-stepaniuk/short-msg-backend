import type { ErrorRequestHandler } from "express";
import { HttpError } from "../errors/httpError";
import { mapPrismaError } from "../errors/prismaErrors";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const prismaError = mapPrismaError(err);

  if (prismaError) {
    res.status(prismaError.statusCode).json({
      error: prismaError.message,
      code: prismaError.code,
      details: prismaError.details
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
