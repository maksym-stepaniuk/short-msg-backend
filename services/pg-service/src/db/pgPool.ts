import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL ?? "postgresql://chat_user:chat_password@localhost:5432/chat_backend";

export const pgPool = new Pool({
  connectionString
});
