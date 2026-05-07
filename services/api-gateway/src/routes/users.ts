import { Router } from "express";
import { pgServiceClient } from "../clients/pgServiceClient";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireObjectBody, requireString, requireUuid } from "./validators";

export const usersRouter = Router();

usersRouter.post(
  "/users",
  asyncHandler(async (req, res) => {
    const body = requireObjectBody(req.body);
    const payload = {
      email: requireString(body.email, "email").toLowerCase(),
      username: requireString(body.username, "username")
    };

    const user = await pgServiceClient.request({
      method: "POST",
      path: "/users",
      body: payload
    });

    res.status(201).json(user);
  })
);

usersRouter.get(
  "/users/:id",
  asyncHandler(async (req, res) => {
    requireUuid(req.params.id, "id");

    const user = await pgServiceClient.request({
      path: `/users/${req.params.id}`
    });

    res.json(user);
  })
);

usersRouter.delete(
  "/users/:id",
  asyncHandler(async (req, res) => {
    requireUuid(req.params.id, "id");

    const user = await pgServiceClient.request({
      method: "DELETE",
      path: `/users/${req.params.id}`
    });

    res.json(user);
  })
);
