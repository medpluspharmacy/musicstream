module.exports = {
  async up(queryInterface) {
    // "Forgot password" requests. No email is sent, so an admin approves each
    // one; the new password only takes effect then. The new password is stored
    // as a bcrypt hash, like users.password_hash.
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS password_reset_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        password_hash TEXT NOT NULL,
        verified_with_2fa BOOLEAN NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'replaced')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        decided_at TIMESTAMPTZ NULL,
        decided_by_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS password_reset_requests_one_pending ON password_reset_requests (user_id) WHERE status = 'pending';`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS password_reset_requests;`);
  },
};
