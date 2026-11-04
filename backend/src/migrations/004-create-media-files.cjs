module.exports = {
  async up(queryInterface) {
    // provider/provider_ref leave room for external sources (e.g. Spotify)
    // alongside uploaded files.
    await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS media_files (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('audio', 'video')),
      provider TEXT NOT NULL DEFAULT 'upload',
      provider_ref TEXT NULL,
      mime_type TEXT NOT NULL,
      size_bytes BIGINT NOT NULL DEFAULT 0,
      duration_seconds DOUBLE PRECISION NOT NULL CHECK (duration_seconds > 0),
      storage_key TEXT NULL,
      original_name TEXT NULL,
      uploaded_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS media_files;`);
  },
};
