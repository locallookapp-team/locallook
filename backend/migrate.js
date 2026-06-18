const db = require('./db');

async function runMigrations() {
  try {
    console.log('Starting database indexing and migrations...');

    // 1. Existing spatial and standard indexes
    await db.query('CREATE INDEX IF NOT EXISTS idx_stores_location ON stores USING GIST (location);');
    console.log('- Created spatial index on stores(location)');

    await db.query('CREATE INDEX IF NOT EXISTS idx_stores_merchant_id ON stores (merchant_id);');
    console.log('- Created index on stores(merchant_id)');

    await db.query('CREATE INDEX IF NOT EXISTS idx_items_store_id ON items (store_id);');
    console.log('- Created index on items(store_id)');

    // ==========================================
    // NEW ARCHITECTURE MIGRATION
    // ==========================================

    // 2. Create the new Junction Table for Multi-Tenancy
    await db.query(`
      CREATE TABLE IF NOT EXISTS store_operators (
        store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) DEFAULT 'merchant',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (store_id, user_id)
      );
    `);
    console.log('- Ensured store_operators junction table exists');

    // 3. Migrate existing data (so you don't lose current owners!)
    // This safely copies the owner from the old 'merchant_id' column into the new table.
    await db.query(`
      INSERT INTO store_operators (store_id, user_id, role)
      SELECT id, merchant_id, 'merchant'
      FROM stores
      WHERE merchant_id IS NOT NULL
      ON CONFLICT (store_id, user_id) DO NOTHING;
    `);
    console.log('- Migrated existing owners to store_operators table');

    console.log('Database indexing and migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error running migrations:', err);
    process.exit(1);
  }
}

runMigrations();