import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { logger } from "../lib/logger.js";

const run = promisify(execFile);

/**
 * Applies any pending migrations before the server takes requests, so new code
 * never runs against an older database (which shows up as "Server error" on
 * every media and playlist request). Migrations only ever apply once.
 * MIGRATE_ON_START=false turns this off, e.g. if a separate job owns migrations.
 */
export async function migrateOnStart(backendDir: string) {
  if ((process.env.MIGRATE_ON_START ?? "").trim().toLowerCase() === "false") return;
  const cli = path.join(backendDir, "node_modules", "sequelize-cli", "lib", "sequelize");
  const { stdout } = await run(process.execPath, [cli, "db:migrate"], { cwd: backendDir, env: process.env, maxBuffer: 4 * 1024 * 1024 });
  const applied = stdout.split("\n").filter(l => /: migrated/.test(l)).map(l => l.replace(/^==\s*|\s*:.*$/g, ""));
  if (applied.length) logger.info({ applied }, "Applied database migrations");
  else logger.info("Database is up to date");
}
