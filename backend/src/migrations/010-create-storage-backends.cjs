module.exports = {
  async up(queryInterface) {
    // Storage locations chosen on the Settings page. A row is kept after it stops
    // being active, because files uploaded to it stay there and keep playing.
    // storage_backend_id NULL means the file uses the server's environment settings.
    // The secret key is stored encrypted (lib/secret-cipher).
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS storage_backends (
        id SERIAL PRIMARY KEY,
        driver VARCHAR(16) NOT NULL CHECK (driver IN ('local', 's3')),
        provider VARCHAR(32) NOT NULL,
        location VARCHAR(100) NOT NULL DEFAULT '',
        endpoint VARCHAR(500) NOT NULL DEFAULT '',
        bucket VARCHAR(100) NOT NULL DEFAULT '',
        prefix VARCHAR(200) NOT NULL DEFAULT '',
        access_key_id TEXT NULL,
        secret_access_key TEXT NULL,
        force_path_style BOOLEAN NOT NULL DEFAULT FALSE,
        is_active BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (driver, endpoint, bucket, prefix)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS storage_backends_one_active ON storage_backends (is_active) WHERE is_active;
      ALTER TABLE media_files ADD COLUMN IF NOT EXISTS storage_backend_id INTEGER NULL REFERENCES storage_backends(id) ON DELETE RESTRICT;`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE media_files DROP COLUMN IF EXISTS storage_backend_id;
      DROP TABLE IF EXISTS storage_backends;`);
  },
};
