module.exports = {
  async up(queryInterface) {
    // Anyone can sign up; listeners wait for an admin to approve them.
    // Accounts that already exist were let in by the old domain rule, so they
    // start approved; new rows default to pending.
    await queryInterface.sequelize.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS approval_status VARCHAR(16) NOT NULL DEFAULT 'approved'
          CHECK (approval_status IN ('pending', 'approved', 'declined'));
      ALTER TABLE users ALTER COLUMN approval_status SET DEFAULT 'pending';
      CREATE INDEX IF NOT EXISTS users_approval_status_idx ON users (approval_status);
      DROP TABLE IF EXISTS approved_domains;`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS users_approval_status_idx;
      ALTER TABLE users DROP COLUMN IF EXISTS approval_status;
      CREATE TABLE IF NOT EXISTS approved_domains (
        id SERIAL PRIMARY KEY,
        domain TEXT NOT NULL UNIQUE,
        created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
  },
};
