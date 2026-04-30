import express from "express";
import { HttpError } from "./errors/httpError";
import { errorHandler } from "./middleware/errorHandler";
import { conversationsRouter } from "./routes/conversations";
import { healthRouter } from "./routes/health";
import { usersRouter } from "./routes/users";

export const createApp = () => {
  const app = express();

  app.use(express.json());
  app.use(healthRouter);
  app.use(usersRouter);
  app.use(conversationsRouter);

  app.use((_req, _res, next) => {
    next(new HttpError(404, "ROUTE_NOT_FOUND", "Route not found"));
  });

  app.use(errorHandler);

  return app;
};
