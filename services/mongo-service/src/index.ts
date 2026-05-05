import { createApp } from "./app";
import { closeMongo } from "./db/mongoClient";
import { ensureMessageIndexes } from "./db/messagesCollection";
import { closeMongoose, connectMongoose } from "./db/mongoose";

const port = Number(process.env.MONGO_SERVICE_PORT ?? 3002);
const app = createApp();

Promise.all([ensureMessageIndexes(), connectMongoose()]).then(() => {
  app.listen(port, () => {
    console.log(`mongo-service listening on port ${port}`);
  });
}).catch((err) => {
  console.error("Failed to initialize MongoDB indexes", err);
  process.exit(1);
});

const shutdown = async () => {
  await closeMongoose();
  await closeMongo();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
