import { Sequelize } from "sequelize";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://chat_user:chat_password@localhost:5432/chat_backend";

export const sequelize = new Sequelize(databaseUrl, {
  dialect: "postgres",
  logging: false
});
