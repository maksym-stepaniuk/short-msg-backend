import { ServiceClient } from "./serviceClient";

export const mongoServiceClient = new ServiceClient(
  process.env.MONGO_SERVICE_URL ?? "http://localhost:3002",
  "mongo-service"
);
