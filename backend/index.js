const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./db'); // Imports your database connection

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allows the future React frontend to talk to this API
app.use(express.json()); // Allows the server to read JSON data

// A simple test route to verify the database
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

// 1. ADD STORE: Updated to include email in the user table sync
app.post('/api/stores', async (req, res) => {
  try {
    // Extract email along with the other form details
    const { store_name, store_category, lat, lng, owner_id, email } = req.body;
    
    // Insert the newly authenticated user into our public.users table with their email
    await db.query(`
      INSERT INTO users (id, email, role) 
      VALUES ($1, $2, 'merchant') 
      ON CONFLICT (id) DO NOTHING;
    `, [owner_id, email]);

    // Insert the store data
    const result = await db.query(`
      INSERT INTO stores (merchant_id, store_name, store_category, location, is_open, is_approved)
      VALUES ($1, $2, $3, ST_GeomFromText($4, 4326), true, true)
      RETURNING id, store_name;
    `, [owner_id, store_name, store_category, `POINT(${lng} ${lat})`]); 

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// STORE DATA ROUTES
// ==========================================

// 2a. GET ALL STORES: (This was missing! Feeds the public consumer map)
app.get('/api/stores', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id, 
        store_name, 
        store_category, 
        is_open, 
        ST_Y(location::geometry) AS lat, 
        ST_X(location::geometry) AS lng 
      FROM stores;
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// 2b. GET A SPECIFIC STORE BY ID (For the Public Store Profile Page)
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

// 3. GET SPECIFIC STORE: (For the Operator Dashboard)
app.get('/api/merchant/store/:owner_id', async (req, res) => {
  try {
    const { owner_id } = req.params;
    const result = await db.query(
      `SELECT id, store_name, store_category, is_open, 
       ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng 
       FROM stores WHERE merchant_id = $1 LIMIT 1`,
      [owner_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No store found for this operator." });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// 4. TOGGLE STORE STATUS: (Flip open/closed from the Dashboard)
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

// 5. ADD AN ITEM: (Upgraded to accept image_url)
app.post('/api/items', async (req, res) => {
  try {
    // 1. Notice we added image_url here to catch the link from React
    const { store_id, item_name, description, price, image_url } = req.body;
    
    // 2. Notice we added image_url and $5 to the SQL query
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

// 6. GET STORE ITEMS: (For both Dashboard and Consumer Map)
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

// 7. UNIFIED GLOBAL SEARCH: (Find items across all stores)
app.get('/api/search/items', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);

    // UPGRADED: Grabs is_open, and sorts OPEN stores to the top!
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