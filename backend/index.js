const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./db'); 

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); 
app.use(express.json()); 

app.get('/api/test', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({
      message: "Local Look API is live!",
      databaseTime: result.rows[0].now
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// 1. ADD STORE: Upgraded to use a Database Transaction and the new Junction Table
app.post('/api/stores', async (req, res) => {
  // We use a specific client from the pool to handle the Transaction (BEGIN/COMMIT)
  const client = await db.connect();
  
  try {
    const { store_name, store_category, lat, lng, owner_id, email } = req.body;
    
    await client.query('BEGIN'); // Start transaction

    // 1. Ensure user exists
    await client.query(`
      INSERT INTO users (id, email, role) 
      VALUES ($1, $2, 'merchant') 
      ON CONFLICT (id) DO NOTHING;
    `, [owner_id, email]);

    // 2. Insert the store
    // (We keep merchant_id here temporarily for backwards compatibility, but rely on operators table)
    const storeResult = await client.query(`
      INSERT INTO stores (merchant_id, store_name, store_category, location, is_open, is_approved)
      VALUES ($1, $2, $3, ST_GeomFromText($4, 4326), true, true)
      RETURNING id, store_name;
    `, [owner_id, store_name, store_category, `POINT(${lng} ${lat})`]); 
    
    const newStoreId = storeResult.rows[0].id;

    // 3. NEW: Link the user to the store in the junction table
    await client.query(`
      INSERT INTO store_operators (store_id, user_id, role)
      VALUES ($1, $2, 'merchant');
    `, [newStoreId, owner_id]);

    await client.query('COMMIT'); // Save all changes

    res.json(storeResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK'); // Undo everything if any step failed
    console.error(err.message);
    res.status(500).send("Server Error");
  } finally {
    client.release(); // Return client to pool
  }
});

// 2a. GET ALL STORES (Public Map)
app.get('/api/stores', async (req, res) => {
  try {
    const { minLng, minLat, maxLng, maxLat } = req.query;
    
    let query = `
      SELECT 
        id, 
        store_name, 
        store_category, 
        is_open, 
        ST_Y(location::geometry) AS lat, 
        ST_X(location::geometry) AS lng 
      FROM stores
    `;
    
    const queryParams = [];
    
    if (minLng && minLat && maxLng && maxLat) {
      query += ` WHERE location && ST_MakeEnvelope($1, $2, $3, $4, 4326)`;
      queryParams.push(minLng, minLat, maxLng, maxLat);
    }

    const result = await db.query(query, queryParams);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// 2b. GET A SPECIFIC STORE BY ID 
app.get('/api/stores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT 
        id, 
        store_name, 
        store_category, 
        is_open, 
        ST_Y(location::geometry) AS lat, 
        ST_X(location::geometry) AS lng 
      FROM stores 
      WHERE id = $1;
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Store not found" });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// 3. GET MERCHANT STORES: (Upgraded to handle MULTIPLE stores via JOIN)
app.get('/api/merchant/store/:owner_id', async (req, res) => {
  try {
    const { owner_id } = req.params;
    
    // NEW: We join the tables and return an ARRAY of stores! No more LIMIT 1.
    const result = await db.query(`
      SELECT 
        s.id, 
        s.store_name, 
        s.store_category, 
        s.is_open, 
        ST_Y(s.location::geometry) as lat, 
        ST_X(s.location::geometry) as lng,
        so.role
      FROM stores s
      JOIN store_operators so ON s.id = so.store_id
      WHERE so.user_id = $1
    `, [owner_id]);
    
    // Note: We now return the full array, so if they have 3 stores, they get 3 back.
    // We will need to update the React frontend to map over an array instead of a single object.
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// 4. TOGGLE STORE STATUS
app.patch('/api/stores/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_open } = req.body;

    const result = await db.query(
      'UPDATE stores SET is_open = $1 WHERE id = $2 RETURNING id, is_open',
      [is_open, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// 5. ADD AN ITEM
app.post('/api/items', async (req, res) => {
  try {
    const { store_id, item_name, description, price, image_url } = req.body;
    
    const result = await db.query(`
      INSERT INTO items (store_id, item_name, description, price, image_url, is_available)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING *;
    `, [store_id, item_name, description, price, image_url]); 

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// 6. GET STORE ITEMS
app.get('/api/stores/:store_id/items', async (req, res) => {
  try {
    const { store_id } = req.params;
    const result = await db.query(
      'SELECT * FROM items WHERE store_id = $1 ORDER BY created_at DESC',
      [store_id]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// 7. UNIFIED GLOBAL SEARCH
app.get('/api/search/items', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);

    const result = await db.query(`
      SELECT 
        items.id AS item_id, 
        items.item_name, 
        items.price, 
        stores.id AS store_id, 
        stores.store_name,
        stores.is_open
      FROM items
      JOIN stores ON items.store_id = stores.id
      WHERE items.item_name ILIKE $1
      ORDER BY stores.is_open DESC, items.item_name ASC
      LIMIT 10;
    `, [`%${q}%`]);
    
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});