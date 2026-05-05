import { createApp } from "./app";
import { closeMongo } from "./db/mongoClient";
import { ensureMessageIndexes } from "./db/messagesCollection";

const port = Number(process.env.MONGO_SERVICE_PORT ?? 3002);
const app = createApp();

ensureMessageIndexes().then(() => {
  app.listen(port, () => {
    console.log(`mongo-service listening on port ${port}`);
  });
}).catch((err) => {
  console.error("Failed to initialize MongoDB indexes", err);
  process.exit(1);
});

const shutdown = async () => {
  await closeMongo();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
