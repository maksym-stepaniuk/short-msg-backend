import { createApp } from "./app";

const port = Number(process.env.API_GATEWAY_PORT ?? 3000);
const app = createApp();

const server = app.listen(port, () => {
  console.log(`api-gateway listening on port ${port}`);
});

const shutdown = () => {
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
