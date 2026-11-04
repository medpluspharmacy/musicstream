/**
 * Postgres connection settings, shared by the app and sequelize-cli migrations.
 *
 * SSL is decided here, not by the URL: ssl* query options (e.g. DigitalOcean's
 * ?sslmode=require) are removed so they can't override the settings below.
 * - DATABASE_SSL=false|true forces SSL off or on.
 * - Otherwise ?sslmode=disable turns it off, and it's on for any host that isn't
 *   localhost/127.0.0.1.
 * - DATABASE_CA_CERT (the PEM text; App Platform provides it as ${db.CA_CERT})
 *   makes the connection verify the server certificate.
 */
function databaseConfig(rawUrl) {
  let url = rawUrl;
  let host = "";
  let sslmode = "";
  try {
    const parsed = new URL(rawUrl);
    host = parsed.hostname;
    sslmode = (parsed.searchParams.get("sslmode") || "").toLowerCase();
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith("ssl")) parsed.searchParams.delete(key);
    }
    url = parsed.toString();
  } catch {
    // Leave unparseable URLs to Sequelize, which reports a clearer error.
  }

  const mode = (process.env.DATABASE_SSL || "").trim().toLowerCase();
  const local = host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "";
  const off = mode === "false" || (!mode && (sslmode === "disable" || (!sslmode && local)));
  if (off) return { url, ssl: false };
  const ca = process.env.DATABASE_CA_CERT?.trim();
  return { url, ssl: ca ? { require: true, rejectUnauthorized: true, ca } : { require: true, rejectUnauthorized: false } };
}

module.exports = { databaseConfig };
