import { ServiceClient } from "./serviceClient";

export const pgServiceClient = new ServiceClient(
  process.env.PG_SERVICE_URL ?? "http://localhost:3001",
  "pg-service"
);
