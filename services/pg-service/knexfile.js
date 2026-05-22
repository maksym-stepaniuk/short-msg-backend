const connection = process.env.DATABASE_URL;

if (!connection) {
  throw new Error("DATABASE_URL environment variable is required");
}

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
