module.exports = {
  async up(queryInterface) {
    // Single-row table: the universal station. started_at anchors the loop so
    // every listener can compute the same playback position.
    await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS station_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      is_live BOOLEAN NOT NULL DEFAULT FALSE,
      started_at TIMESTAMPTZ NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    INSERT INTO station_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS station_state;`);
  },
};
