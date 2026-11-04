module.exports = {
  async up(queryInterface) {
    // The station plays either the uploaded playlist or a connected AzuraCast
    // station. The AzuraCast API key is stored encrypted (lib/secret-cipher).
    await queryInterface.sequelize.query(`ALTER TABLE station_state
      ADD COLUMN IF NOT EXISTS source VARCHAR(16) NOT NULL DEFAULT 'playlist' CHECK (source IN ('playlist', 'azuracast')),
      ADD COLUMN IF NOT EXISTS azuracast_url VARCHAR(500) NULL,
      ADD COLUMN IF NOT EXISTS azuracast_station VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS azuracast_api_key TEXT NULL;`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`ALTER TABLE station_state
      DROP COLUMN IF EXISTS source,
      DROP COLUMN IF EXISTS azuracast_url,
      DROP COLUMN IF EXISTS azuracast_station,
      DROP COLUMN IF EXISTS azuracast_api_key;`);
  },
};
