require("dotenv").config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const ssl =
  DATABASE_URL.includes("localhost") || DATABASE_URL.includes("127.0.0.1")
    ? false
    : { require: true, rejectUnauthorized: false };

module.exports = {
  development: {
    url: DATABASE_URL,
    dialect: "postgres",
    dialectOptions: { ssl },
    migrationStorageTableName: "migrations",
  },
  production: {
    url: DATABASE_URL,
    dialect: "postgres",
    dialectOptions: { ssl },
    migrationStorageTableName: "migrations",
  },
};
