module.exports = {
  async up(queryInterface) {
    // Sub-admins (role "admin") get access per area; super_admin has everything.
    // Admins that already exist keep the full access they had before.
    await queryInterface.sequelize.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT '{}';
      UPDATE users SET permissions = ARRAY['station', 'listeners', 'integrations'] WHERE role = 'admin';`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`ALTER TABLE users DROP COLUMN IF EXISTS permissions;`);
  },
};
