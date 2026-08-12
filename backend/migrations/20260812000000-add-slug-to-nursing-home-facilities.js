'use strict';

function slugifyFacilityName(name) {
  if (!name || typeof name !== 'string') return 'facility';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'facility';
}

async function addEnumValueIfMissing(queryInterface, enumName, value) {
  await queryInterface.sequelize.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = '${enumName}' AND e.enumlabel = '${value}'
      ) THEN
        ALTER TYPE "${enumName}" ADD VALUE '${value}';
      END IF;
    END $$;
  `);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('nursing_home_facilities');
    if (!tableDesc.slug) {
      await queryInterface.addColumn('nursing_home_facilities', 'slug', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }

    const [facilities] = await queryInterface.sequelize.query(
      `SELECT id, name, slug FROM nursing_home_facilities ORDER BY created_at ASC`
    );

    const usedSlugs = new Set(
      (facilities || [])
        .map((f) => f.slug)
        .filter(Boolean)
    );

    for (const facility of facilities || []) {
      if (facility.slug) continue;

      const base = slugifyFacilityName(facility.name);
      let slug = base;
      let suffix = 2;
      while (usedSlugs.has(slug)) {
        slug = `${base}-${suffix}`;
        suffix += 1;
      }
      usedSlugs.add(slug);

      await queryInterface.sequelize.query(
        `UPDATE nursing_home_facilities SET slug = :slug WHERE id = :id`,
        { replacements: { slug, id: facility.id } }
      );
    }

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS nursing_home_facilities_slug_unique
      ON nursing_home_facilities (slug)
      WHERE slug IS NOT NULL;
    `);

    const residentsDesc = await queryInterface.describeTable('nursing_home_residents');
    if (!residentsDesc.stripe_customer_id) {
      await queryInterface.addColumn('nursing_home_residents', 'stripe_customer_id', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }

    // Support monthly billing filters used by run-monthly
    try {
      await addEnumValueIfMissing(queryInterface, 'enum_nursing_home_resident_orders_status', 'confirmed');
    } catch (_err) {
      // ignore if type name differs or already exists
    }
    try {
      await addEnumValueIfMissing(queryInterface, 'enum_nursing_home_resident_orders_payment_status', 'pending_monthly');
    } catch (_err) {
      // ignore if type name differs or already exists
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DROP INDEX IF EXISTS nursing_home_facilities_slug_unique;`
    );

    const tableDesc = await queryInterface.describeTable('nursing_home_facilities');
    if (tableDesc.slug) {
      await queryInterface.removeColumn('nursing_home_facilities', 'slug');
    }

    const residentsDesc = await queryInterface.describeTable('nursing_home_residents');
    if (residentsDesc.stripe_customer_id) {
      await queryInterface.removeColumn('nursing_home_residents', 'stripe_customer_id');
    }
  }
};
