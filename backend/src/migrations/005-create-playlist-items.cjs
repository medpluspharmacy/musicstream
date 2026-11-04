module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS playlist_items (
      id SERIAL PRIMARY KEY,
      media_id INTEGER NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_playlist_items_position ON playlist_items (position);`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS playlist_items;`);
  },
};
