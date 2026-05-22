import knex, { type Knex } from "knex";

const connection = process.env.DATABASE_URL;

if (!connection) {
  throw new Error("DATABASE_URL environment variable is required");
}

export const knexDb: Knex = knex({
  client: "pg",
  connection
});
