import { Prisma } from "@prisma/client";
import { HttpError } from "./httpError";

export const mapPrismaError = (err: unknown): HttpError | null => {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return new HttpError(409, "PRISMA_UNIQUE_CONSTRAINT", "Resource already exists", {
        target: err.meta?.target
      });
    }

    if (err.code === "P2003") {
      return new HttpError(409, "PRISMA_FOREIGN_KEY_CONSTRAINT", "Referenced resource does not exist", {
        field: err.meta?.field_name
      });
    }

    if (err.code === "P2025") {
      return new HttpError(404, "PRISMA_NOT_FOUND", "Resource not found");
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return new HttpError(400, "VALIDATION_ERROR", "Invalid request data");
  }

  return null;
};
