import knex, { type Knex } from "knex";

const connection = process.env.DATABASE_URL ?? "postgresql://chat_user:chat_password@localhost:5432/chat_backend";

export const knexDb: Knex = knex({
  client: "pg",
  connection
});
