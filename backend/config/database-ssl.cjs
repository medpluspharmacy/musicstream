/**
 * Postgres connection settings, shared by the app and sequelize-cli migrations.
 *
 * SSL is decided here, not by the URL: ssl* query options (e.g. DigitalOcean's
 * ?sslmode=require) are removed so they can't override the settings below.
 * - SSL is off by default; DATABASE_SSL=true enables it.
 * - DATABASE_CA_CERT (the PEM text; App Platform provides it as ${db.CA_CERT})
 *   makes the connection verify the server certificate.
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

  const mode = (process.env.DATABASE_SSL || "").trim().toLowerCase();
  if (mode !== "true") return { url, ssl: false };
  const ca = process.env.DATABASE_CA_CERT?.trim();
  return { url, ssl: ca ? { require: true, rejectUnauthorized: true, ca } : { require: true, rejectUnauthorized: false } };
}

module.exports = { databaseConfig };
