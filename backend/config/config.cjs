require("dotenv").config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const { databaseConfig } = require("./database-ssl.cjs");

const { url, ssl } = databaseConfig(DATABASE_URL);

module.exports = {
  development: {
    url,
    dialect: "postgres",
    dialectOptions: { ssl },
    migrationStorageTableName: "migrations",
  },
  production: {
    url,
    dialect: "postgres",
    dialectOptions: { ssl },
    migrationStorageTableName: "migrations",
  },
};
