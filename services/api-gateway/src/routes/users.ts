import { Router } from "express";
import { pgServiceClient } from "../clients/pgServiceClient";
import { enqueueWorkerJob } from "../clients/workerServiceClient";
import { asyncHandler } from "../middleware/asyncHandler";
import { validateRequest } from "../middleware/validateRequest";
import { createUserBodySchema, idParamsSchema } from "./schemas";
import { requireObjectBody, requireString, requireUuid } from "./validators";

export const usersRouter = Router();

usersRouter.post(
  "/users",
  validateRequest({
    body: createUserBodySchema
  }),
  asyncHandler(async (req, res) => {
    const body = requireObjectBody(req.body);
    const payload = {
      email: requireString(body.email, "email").toLowerCase(),
      username: requireString(body.username, "username")
    };

    const user = await pgServiceClient.request<Record<string, unknown>>({
      method: "POST",
      path: "/users",
      body: payload
    });

    const workerQueued = await enqueueWorkerJob({
      id: `user-created-${String(user.id)}`,
      type: "user.created",
      payload: {
        userId: user.id,
        email: user.email,
        username: user.username
      }
    });

    res.setHeader("X-Worker-Job", workerQueued ? "queued" : "skipped");
    res.status(201).json(user);
  })
);

usersRouter.get(
  "/users/:id",
  validateRequest({
    params: idParamsSchema
  }),
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
  validateRequest({
    params: idParamsSchema
  }),
  asyncHandler(async (req, res) => {
    requireUuid(req.params.id, "id");

    const user = await pgServiceClient.request({
      method: "DELETE",
      path: `/users/${req.params.id}`
    });

    res.json(user);
  })
);
