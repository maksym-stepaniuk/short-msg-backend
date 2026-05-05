import type { ErrorRequestHandler } from "express";
import { HttpError } from "../errors/httpError";
import { mapPgError } from "../errors/pgErrors";
import { mapPrismaError } from "../errors/prismaErrors";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const pgError = mapPgError(err);

  if (pgError) {
    res.status(pgError.statusCode).json({
      error: pgError.message,
      code: pgError.code,
      details: pgError.details
    });
    return;
  }

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
