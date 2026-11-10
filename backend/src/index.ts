import "dotenv/config";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import app from "./app";
import { connectDatabase } from "./db/sequelize.js";
import { migrateOnStart } from "./db/migrate-on-start.js";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function startServer() {
  try {
    await connectDatabase();
  } catch (err) {
    logger.error({ err }, "Database connection failed on startup");
    process.exit(1);
  }

  try {
    await migrateOnStart(path.resolve(__dirname, ".."));
  } catch (err: any) {
    // Refuse to start rather than serve errors; on App Platform the previous version keeps running.
    logger.error({ err: err?.message, output: String(err?.stdout ?? "") + String(err?.stderr ?? "") }, "Database migrations failed on startup");
    process.exit(1);
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");

    if (process.env.NODE_ENV === "development") {
      const frontendDir = path.resolve(__dirname, "../../frontend");
      const viteBin = path.resolve(frontendDir, "node_modules/.bin/vite");
      const basePath = process.env.BASE_PATH || "/";
      const frontendPort = process.env.FRONTEND_PORT || "5000";
      const vite = spawn(viteBin, ["--host", "0.0.0.0", "--port", frontendPort, "--strictPort"], {
        cwd: frontendDir,
        env: { ...process.env, FRONTEND_PORT: frontendPort, BASE_PATH: basePath },
        stdio: "inherit",
      });
      vite.on("exit", (code) => {
        logger.warn({ code }, "MusicStream Vite dev server exited");
      });
      logger.info({ frontendPort }, "MusicStream Vite dev server spawned");

      const shutdown = (signal: string) => {
        logger.info({ signal }, "Shutting down");
        try {
          vite.kill("SIGTERM");
        } catch {
          // ignore
        }
        process.exit(0);
      };
      process.on("SIGTERM", () => shutdown("SIGTERM"));
      process.on("SIGINT", () => shutdown("SIGINT"));
    }
  });
}

void startServer();
