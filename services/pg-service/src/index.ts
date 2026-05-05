import { createApp } from "./app";
import { knexDb } from "./db/knex";
import { pgPool } from "./db/pgPool";
import { prisma } from "./db/prisma";

const port = Number(process.env.PG_SERVICE_PORT ?? 3001);
const app = createApp();

app.listen(port, () => {
  console.log(`pg-service listening on port ${port}`);
});

const shutdown = async () => {
  await pgPool.end();
  await knexDb.destroy();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
