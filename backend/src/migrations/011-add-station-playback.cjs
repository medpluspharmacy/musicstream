module.exports = {
  async up(queryInterface) {
    // Station-wide playback settings for the playlist. Crossfade overlaps the end
    // of each item with the start of the next; gapless has players load the next
    // item early so it starts on time.
    await queryInterface.sequelize.query(`ALTER TABLE station_state
      ADD COLUMN IF NOT EXISTS crossfade_seconds INTEGER NOT NULL DEFAULT 0 CHECK (crossfade_seconds BETWEEN 0 AND 12),
      ADD COLUMN IF NOT EXISTS gapless BOOLEAN NOT NULL DEFAULT TRUE;`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`ALTER TABLE station_state
      DROP COLUMN IF EXISTS crossfade_seconds,
      DROP COLUMN IF EXISTS gapless;`);
  },
};
