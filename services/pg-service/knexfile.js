const connection = process.env.DATABASE_URL ?? "postgresql://chat_user:chat_password@localhost:5432/chat_backend";

module.exports = {
  client: "pg",
  connection,
  migrations: {
    directory: "./knex/migrations"
  },
  seeds: {
    directory: "./knex/seeds"
  }
};
