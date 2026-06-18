const db = require('./db');

async function runMigrations() {
  try {
    console.log('Starting database indexing and RBAC setup...');

    await db.query('CREATE INDEX IF NOT EXISTS idx_stores_location ON stores USING GIST (location);');
    await db.query('CREATE INDEX IF NOT EXISTS idx_stores_merchant_id ON stores (merchant_id);');
    await db.query('CREATE INDEX IF NOT EXISTS idx_items_store_id ON items (store_id);');

    // CREATE THE MULTI-TENANT JUNCTION TABLE
    await db.query(`
      CREATE TABLE IF NOT EXISTS store_operators (
        store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (store_id, user_id)
      );
    `);
    console.log('- RBAC store_operators table verified.');

    // OPTIONAL: Clean up ghost data from previous testing if you wiped your auth users
    await db.query(`DELETE FROM users WHERE id NOT IN (SELECT id FROM auth.users);`).catch(() => {});

    console.log('Database architecture ready.');
    process.exit(0);
  } catch (err) {
    console.error('Error running migrations:', err);
    process.exit(1);
  }
}

runMigrations();