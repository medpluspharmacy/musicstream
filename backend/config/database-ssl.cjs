/**
 * Postgres connection settings, shared by the app and sequelize-cli migrations.
 *
 * SSL is decided here, not by the URL: ssl* query options (e.g. DigitalOcean's
 * ?sslmode=require) are removed so they can't override the settings below.
 * - Otherwise SSL is off for localhost and required for remote database hosts.
 * - A non-empty DATABASE_CERT (PEM text, not a filepath) enables server certificate verification.
 */
function databaseConfig(rawUrl) {
  let url = rawUrl;
  let host = "";
  try {
    const parsed = new URL(rawUrl);
    host = parsed.hostname;
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith("ssl")) parsed.searchParams.delete(key);
    }
    url = parsed.toString();
  } catch {
    // Leave unparseable URLs to Sequelize, which reports a clearer error.
  }

  const local = host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "";
  if (local) return { url, ssl: false };
  const ca = process.env.DATABASE_CERT?.trim();
  return {
    url,
    ssl: ca
      ? { require: true, rejectUnauthorized: true, ca }
      : { require: true, rejectUnauthorized: false },
  };
}

module.exports = { databaseConfig };
