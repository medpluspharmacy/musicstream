module.exports = {
  async up(queryInterface) {
    // Several named playlists, and a weekly schedule: each day of the week has
    // a queue of playlists played in order and looped (day 0 = Sunday ... 6 =
    // Saturday); days without their own queue use the default queue (day 7).
    // Existing playlist items move into "Main playlist", which becomes the
    // default queue, so the station plays exactly as before.
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS playlists (
        id SERIAL PRIMARY KEY,
        name VARCHAR(80) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      INSERT INTO playlists (name) SELECT 'Main playlist' WHERE NOT EXISTS (SELECT 1 FROM playlists);
      ALTER TABLE playlist_items ADD COLUMN IF NOT EXISTS playlist_id INTEGER REFERENCES playlists(id) ON DELETE CASCADE;
      UPDATE playlist_items SET playlist_id = (SELECT MIN(id) FROM playlists) WHERE playlist_id IS NULL;
      ALTER TABLE playlist_items ALTER COLUMN playlist_id SET NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON playlist_items (playlist_id, position);
      CREATE TABLE IF NOT EXISTS playlist_schedule (
        id SERIAL PRIMARY KEY,
        day SMALLINT NOT NULL CHECK (day BETWEEN 0 AND 7),
        position INTEGER NOT NULL,
        playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE
      );
      INSERT INTO playlist_schedule (day, position, playlist_id)
        SELECT 7, 0, MIN(id) FROM playlists WHERE NOT EXISTS (SELECT 1 FROM playlist_schedule);
      ALTER TABLE station_state
        ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) NOT NULL DEFAULT 'Africa/Lagos',
        ADD COLUMN IF NOT EXISTS anchor_day VARCHAR(10) NULL;`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE station_state DROP COLUMN IF EXISTS timezone, DROP COLUMN IF EXISTS anchor_day;
      DROP TABLE IF EXISTS playlist_schedule;
      DELETE FROM playlist_items WHERE playlist_id <> (SELECT MIN(id) FROM playlists);
      ALTER TABLE playlist_items DROP COLUMN IF EXISTS playlist_id;
      DROP TABLE IF EXISTS playlists;`);
  },
};
