import { createApp } from "./app";
import { closeMongo } from "./db/mongoClient";
import { ensureMessageIndexes } from "./db/messagesCollection";
import { closeMongoose, connectMongoose } from "./db/mongoose";

const port = Number(process.env.MONGO_SERVICE_PORT ?? 3002);
const app = createApp();
let server: ReturnType<typeof app.listen> | undefined;

Promise.all([ensureMessageIndexes(), connectMongoose()]).then(() => {
  server = app.listen(port, () => {
    console.log(`mongo-service listening on port ${port}`);
  });
}).catch((err) => {
  console.error("Failed to initialize MongoDB indexes", err);
  process.exit(1);
});

const shutdown = async () => {
  const closeConnections = async () => {
    await closeMongoose();
    await closeMongo();
    process.exit(0);
  };

  if (server) {
    server.close(closeConnections);
    return;
  }

  await closeConnections();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
