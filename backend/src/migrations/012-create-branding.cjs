module.exports = {
  async up(queryInterface) {
    // Company branding, edited by the super admin under Settings → Appearance.
    // Image fields hold references: "builtin:<file>" for the MedPlus images
    // shipped in frontend/public/branding, or the id of an uploaded image.
    // The defaults are Medplus Limited's logo and banners from medplusnig.com.
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS branding_assets (
        id UUID PRIMARY KEY,
        storage_key TEXT NOT NULL,
        storage_backend_id INTEGER NULL REFERENCES storage_backends(id) ON DELETE RESTRICT,
        mime_type VARCHAR(32) NOT NULL,
        size_bytes INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS branding (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        company_name VARCHAR(80) NOT NULL,
        logo TEXT NULL,
        sign_in_images TEXT[] NOT NULL DEFAULT '{}',
        sidebar_image TEXT NULL,
        banner_image TEXT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      INSERT INTO branding (id, company_name, logo, sign_in_images, sidebar_image, banner_image)
      VALUES (1, 'Medplus Limited', 'builtin:medplus-logo.png',
        ARRAY['builtin:medplus-banner-1.webp', 'builtin:medplus-banner-2.webp', 'builtin:medplus-banner-3.webp', 'builtin:medplus-banner-4.webp'],
        'builtin:medplus-banner-6.webp', 'builtin:medplus-banner-1.webp')
      ON CONFLICT (id) DO NOTHING;`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS branding; DROP TABLE IF EXISTS branding_assets;`);
  },
};
