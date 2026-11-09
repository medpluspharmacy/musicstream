import { Sequelize } from "sequelize";
import { logger } from "../lib/logger.js";
import { databaseConfig } from "../../config/database-ssl.cjs";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const { url, ssl } = databaseConfig(DATABASE_URL);
if (ssl && !ssl.rejectUnauthorized) {
  logger.warn("Database SSL is on but the server certificate isn't verified. Set DATABASE_CERT to verify it.");
}

export const sequelize = new Sequelize(url, {
  dialect: "postgres",
  dialectOptions: {
    ssl,
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
