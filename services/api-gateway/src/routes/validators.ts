import { HttpError } from "../errors/httpError";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const requireString = (value: unknown, field: string) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "Field is required", { field });
  }

  return value.trim();
};

export const optionalString = (value: unknown, field: string) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (Array.isArray(value)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Query parameter must be provided once", { field });
  }

  return requireString(value, field);
};

export const requireUuid = (value: string, field: string) => {
  if (!uuidPattern.test(value)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid UUID", { field });
  }

  return value;
};

export const parseOptionalInteger = (value: unknown, field: string) => {
  const raw = optionalString(value, field);

  if (!raw) {
    return undefined;
  }

  const parsed = Number(raw);

  if (!Number.isInteger(parsed)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Expected integer", { field });
  }

  return parsed;
};

export const parseLimit = (value: unknown, defaultValue = 50) => {
  const limit = parseOptionalInteger(value, "limit") ?? defaultValue;

  if (limit < 1 || limit > 100) {
    throw new HttpError(400, "VALIDATION_ERROR", "Limit must be between 1 and 100", {
      field: "limit"
    });
  }

  return limit;
};

export const requireObjectBody = (value: unknown) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Request body must be an object");
  }

  return value as Record<string, unknown>;
};

export const requireMessageBody = (value: unknown) => {
  const body = requireString(value, "body");

  if (body.length > 2000) {
    throw new HttpError(400, "VALIDATION_ERROR", "Message body is too long", {
      field: "body",
      maxLength: 2000
    });
  }

  return body;
};
