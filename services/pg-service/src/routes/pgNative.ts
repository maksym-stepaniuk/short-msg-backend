import { Router } from "express";
import { pgPool } from "../db/pgPool";
import { HttpError } from "../errors/httpError";
import { asyncHandler } from "../middleware/asyncHandler";

type RawUserRow = {
  id: string;
  email: string;
  username: string;
  createdAt: Date;
  deletedAt: Date | null;
};

const requireString = (value: unknown, field: string) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "Field is required", { field });
  }

  return value.trim();
};

export const pgNativeRouter = Router();

pgNativeRouter.get(
  "/pg/users/by-email",
  asyncHandler(async (req, res) => {
    const email = requireString(req.query.email, "email").toLowerCase();

    const result = await pgPool.query<RawUserRow>(
      `SELECT id, email, username, "createdAt", "deletedAt"
       FROM users
       WHERE email = $1`,
      [email]
    );

    if (!result.rows[0]) {
      throw new HttpError(404, "USER_NOT_FOUND", "User not found");
    }

    res.json(result.rows[0]);
  })
);

pgNativeRouter.post(
  "/pg/users-raw",
  asyncHandler(async (req, res) => {
    const email = requireString(req.body.email, "email").toLowerCase();
    const username = requireString(req.body.username, "username");

    const result = await pgPool.query<RawUserRow>(
      `INSERT INTO users (id, email, username)
       VALUES (gen_random_uuid(), $1, $2)
       RETURNING id, email, username, "createdAt", "deletedAt"`,
      [email, username]
    );

    res.status(201).json(result.rows[0]);
  })
);
