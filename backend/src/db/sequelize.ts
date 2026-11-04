import { Sequelize } from "sequelize";
import { logger } from "../lib/logger.js";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

export const sequelize = new Sequelize(DATABASE_URL, {
  dialect: "postgres",
  dialectOptions: {
    ssl: DATABASE_URL.includes("localhost") || DATABASE_URL.includes("127.0.0.1")
      ? false
      : { require: true, rejectUnauthorized: false },
  },
  logging: process.env.NODE_ENV === "development"
    ? (msg: string) => logger.debug(msg)
    : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

export async function connectDatabase(): Promise<void> {
  await sequelize.authenticate();
  logger.info("Database connection established");
}

export default sequelize;
