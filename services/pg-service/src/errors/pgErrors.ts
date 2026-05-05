import { DatabaseError } from "pg";
import { HttpError } from "./httpError";

const pgErrorMap: Record<string, { statusCode: number; code: string; message: string }> = {
  "23505": {
    statusCode: 409,
    code: "PG_UNIQUE_VIOLATION",
    message: "Unique constraint violation"
  },
  "23503": {
    statusCode: 400,
    code: "PG_FOREIGN_KEY_VIOLATION",
    message: "Foreign key constraint violation"
  },
  "23514": {
    statusCode: 400,
    code: "PG_CHECK_VIOLATION",
    message: "Check constraint violation"
  },
  "22P02": {
    statusCode: 400,
    code: "PG_INVALID_TEXT_REPRESENTATION",
    message: "Invalid text representation"
  }
};

export const mapPgError = (err: unknown): HttpError | null => {
  if (!(err instanceof DatabaseError)) {
    return null;
  }

  if (!err.code) {
    return null;
  }

  const mapped = pgErrorMap[err.code];

  if (!mapped) {
    return null;
  }

  return new HttpError(mapped.statusCode, mapped.code, mapped.message, {
    constraint: err.constraint ?? null,
    table: err.table ?? null,
    column: err.column ?? null
  });
};
