import express from "express";
import { HttpError } from "./errors/httpError";
import { errorHandler } from "./middleware/errorHandler";
import { analyticsRouter } from "./routes/analytics";
import { healthRouter } from "./routes/health";
import { internalMessagesRouter } from "./routes/internalMessages";
import { messagesRouter } from "./routes/messages";
import { mongooseDomainRouter } from "./routes/mongooseDomain";

export const createApp = () => {
  const app = express();

  app.use(express.json());
  app.use(healthRouter);
  app.use(internalMessagesRouter);
  app.use(analyticsRouter);
  app.use(messagesRouter);
  app.use(mongooseDomainRouter);

  app.use((_req, _res, next) => {
    next(new HttpError(404, "ROUTE_NOT_FOUND", "Route not found"));
  });

  app.use(errorHandler);

  return app;
};
