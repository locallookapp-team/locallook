const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const db = require('./db'); 

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase Admin for secure backend operations (like sending invites)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(cors()); 
app.use(express.json()); 

// ==========================================
// STORE CREATION & RBAC ASSIGNMENT
// ==========================================

// 1. CREATE STORE & ASSIGN MERCHANT ROLE
app.post('/api/stores', async (req, res) => {
  const client = await db.connect();
  try {
    const { store_name, store_category, lat, lng, user_id } = req.body;
    
    await client.query('BEGIN');

    // Insert the store
    const storeResult = await client.query(`
      INSERT INTO stores (store_name, store_category, location, is_open, is_approved)
      VALUES ($1, $2, ST_GeomFromText($3, 4326), false, true)
      RETURNING id, store_name;
    `, [store_name, store_category, `POINT(${lng} ${lat})`]); 
    
    const newStoreId = storeResult.rows[0].id;

    // Grant the creator the 'merchant' role in the junction table
    await client.query(`
      INSERT INTO store_operators (store_id, user_id, role)
      VALUES ($1, $2, 'merchant');
    `, [newStoreId, user_id]);

    await client.query('COMMIT');
    res.json(storeResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).send("Server Error");
  } finally {
    client.release();
  }
});

// 2. GET ALL STORES FOR A SPECIFIC USER (Sidebar Navigation)
app.get('/api/merchant/stores/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    
    // Finds every store the user has a role in (Merchant OR Operator)
    const result = await db.query(`
      SELECT 
        s.id, s.store_name, s.store_category, s.is_open, 
        ST_Y(s.location::geometry) as lat, ST_X(s.location::geometry) as lng,
        so.role
      FROM stores s
      JOIN store_operators so ON s.id = so.store_id
      WHERE so.user_id = $1
    `, [user_id]);
    
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// 3. SECURE OPERATOR EMAIL INVITE SYSTEM
app.post('/api/stores/:store_id/invite', async (req, res) => {
  const client = await db.connect();
  try {
    const { store_id } = req.params;
    const { email, requester_id } = req.body;

    // A. Verify the person requesting the invite is actually the 'merchant' of this store
    const authCheck = await client.query(
      `SELECT role FROM store_operators WHERE store_id = $1 AND user_id = $2`, 
      [store_id, requester_id]
    );

    if (authCheck.rows.length === 0 || authCheck.rows[0].role !== 'merchant') {
      return res.status(403).json({ error: "Only the primary merchant can invite operators." });
    }

    // B. Send the email invite via Supabase Auth
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
    if (inviteError) throw new Error(inviteError.message);
    
    const newOperatorId = inviteData.user.id;

    await client.query('BEGIN');

    // C. Prep the public users table to prevent Foreign Key errors
    await client.query(`
      INSERT INTO users (id, email, role) VALUES ($1, $2, 'operator')
      ON CONFLICT (id) DO NOTHING;
    `, [newOperatorId, email]);

    // D. Link the newly invited user to the store as an 'operator'
    await client.query(`
      INSERT INTO store_operators (store_id, user_id, role)
      VALUES ($1, $2, 'operator')
      ON CONFLICT (store_id, user_id) DO NOTHING;
    `, [store_id, newOperatorId]);

    await client.query('COMMIT');
    res.json({ message: "Invite sent successfully!", operator_id: newOperatorId });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Invite Error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ==========================================
// STANDARD ROUTES (Items, Toggles, Public Map)
// ==========================================

app.get('/api/stores', async (req, res) => {
  try {
    const { minLng, minLat, maxLng, maxLat } = req.query;
    let query = `SELECT id, store_name, store_category, is_open, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng FROM stores`;
    const queryParams = [];
    if (minLng && minLat && maxLng && maxLat) {
      query += ` WHERE location && ST_MakeEnvelope($1, $2, $3, $4, 4326)`;
      queryParams.push(minLng, minLat, maxLng, maxLat);
    }
    const result = await db.query(query, queryParams);
    res.json(result.rows);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// ==========================================
// UPGRADED STORE AND ITEM ROUTES
// ==========================================

// UPGRADED: Get single store (Now includes theme_settings)
app.get('/api/stores/:id', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, store_name, store_category, is_open, theme_settings, 
      ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng 
      FROM stores WHERE id = $1;
    `, [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// NEW: Endpoint specifically for merchants to save custom themes
app.patch('/api/stores/:id/theme', async (req, res) => {
  try {
    const { theme_settings } = req.body;
    
    // Simple backend validation to ensure they pass an object
    if (typeof theme_settings !== 'object') {
      return res.status(400).json({ error: "Invalid theme format" });
    }

    const result = await db.query(`
      UPDATE stores SET theme_settings = $1 WHERE id = $2 RETURNING id, theme_settings
    `, [theme_settings, req.params.id]);
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

app.get('/api/stores/:store_id/items', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM items WHERE store_id = $1 ORDER BY created_at DESC', [req.params.store_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

app.get('/api/search/items', async (req, res) => {
  try {
    if (!req.query.q) return res.json([]);
    const result = await db.query(`SELECT items.id AS item_id, items.item_name, items.price, stores.id AS store_id, stores.store_name, stores.is_open FROM items JOIN stores ON items.store_id = stores.id WHERE items.item_name ILIKE $1 ORDER BY stores.is_open DESC, items.item_name ASC LIMIT 10;`, [`%${req.query.q}%`]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// RESTORED: Toggle Store Open/Close
app.patch('/api/stores/:id/toggle', async (req, res) => {
  try {
    const result = await db.query('UPDATE stores SET is_open = $1 WHERE id = $2 RETURNING id, is_open', [req.body.is_open, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// UPGRADED: Add Item (Now accepts item_category)
app.post('/api/items', async (req, res) => {
  try {
    const { store_id, item_name, description, price, image_url, item_category } = req.body;
    
    const result = await db.query(`
      INSERT INTO items (store_id, item_name, description, price, image_url, item_category, is_available) 
      VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'General'), true) 
      RETURNING *;
    `, [store_id, item_name, description, price, image_url, item_category]); 
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});