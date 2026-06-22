const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
require('dotenv').config();

const db = require('./db'); 

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase Admin for secure backend operations
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Resend for existing user notifications
const resend = new Resend(process.env.RESEND_API_KEY);

app.use(cors()); 
app.use(express.json()); 

// ==========================================
// STORE CREATION & RBAC ASSIGNMENT
// ==========================================

// 1. CREATE STORE
app.post('/api/stores', async (req, res) => {
  const client = await db.connect();
  try {
    const { store_name, store_category, lat, lng, user_id } = req.body;
    await client.query('BEGIN');

    const storeResult = await client.query(`
      INSERT INTO stores (store_name, store_category, location, is_open, is_approved)
      VALUES ($1, $2, ST_GeomFromText($3, 4326), false, true)
      RETURNING id, store_name;
    `, [store_name, store_category, `POINT(${lng} ${lat})`]); 
    
    const newStoreId = storeResult.rows[0].id;

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

// 2. GET ALL STORES FOR USER
app.get('/api/merchant/stores/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
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

// 3. SECURE HYBRID INVITE (Supabase for New, Resend for Existing)
app.post('/api/stores/:store_id/invite', async (req, res) => {
  const client = await db.connect();
  try {
    const { store_id } = req.params;
    const { email, requester_id } = req.body;

    // A. Verify the person requesting the invite is the 'merchant'
    const authCheck = await client.query(
      `SELECT role FROM store_operators WHERE store_id = $1 AND user_id = $2`, 
      [store_id, requester_id]
    );

    if (authCheck.rows.length === 0 || authCheck.rows[0].role !== 'merchant') {
      return res.status(403).json({ error: "Only the primary merchant can invite operators." });
    }

    let targetUserId;

    // B. Check if the user ALREADY exists in our database
    const existingUserCheck = await client.query(
      `SELECT id FROM users WHERE email = $1`,
      [email]
    );

    await client.query('BEGIN');

    if (existingUserCheck.rows.length > 0) {
      // THE FIX: User already exists! Grab their ID and skip the Supabase invite
      targetUserId = existingUserCheck.rows[0].id;
      
      // Send them a standard email via Resend to tell them they've been granted access
      await resend.emails.send({
        from: 'LocalLook <locallookapp@gmail.com>', // Update this if/when you verify a custom domain
        to: email,
        subject: "You've been added to a store on LocalLook!",
        html: `
          <div style="font-family: 'Segoe UI', sans-serif; padding: 30px; border: 1px solid #e5e7eb; border-radius: 12px; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #2563eb; margin-top: 0;">Store Access Granted</h2>
            <p style="color: #4b5563; line-height: 1.6;">A merchant has granted you Operator access to their store on LocalLook.</p>
            <p style="color: #4b5563; line-height: 1.6;">You can now manage their menu and availability directly from your Merchant Hub.</p>
            <div style="text-align: center; margin-top: 30px;">
              <a href="https://locallook.netlify.app/dashboard" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">Go to Dashboard</a>
            </div>
          </div>
        `
      });

    } else {
      // NEW USER: Ask Supabase to create them and send the setup invite link
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
      
      if (inviteError) {
        if (inviteError.message.includes('already been registered')) {
          throw new Error("This user already has an account but is missing from the public directory.");
        }
        throw new Error(inviteError.message);
      }
      
      targetUserId = inviteData.user.id;

      // Add the brand new user to our public table
      await client.query(`
        INSERT INTO users (id, email, role) VALUES ($1, $2, 'operator')
        ON CONFLICT (id) DO NOTHING;
      `, [targetUserId, email]);
    }

    // C. Check if they are somehow already assigned to this store
    const existingOp = await client.query(
      `SELECT 1 FROM store_operators WHERE store_id = $1 AND user_id = $2`,
      [store_id, targetUserId]
    );

    if (existingOp.rows.length === 0) {
      // D. Link them to the store as an operator!
      await client.query(`
        INSERT INTO store_operators (store_id, user_id, role)
        VALUES ($1, $2, 'operator');
      `, [store_id, targetUserId]);
    } else {
      throw new Error("This user is already an operator for this store.");
    }

    await client.query('COMMIT');
    
    // Send a dynamic success message based on what happened
    res.json({ 
      message: existingUserCheck.rows.length > 0 
        ? "Existing staff member re-added and notified!" 
        : "Invite sent successfully!", 
      operator_id: targetUserId 
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Invite Error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 4. GET OPERATORS FOR STORE
app.get('/api/stores/:store_id/operators', async (req, res) => {
  try {
    const { store_id } = req.params;
    const result = await db.query(`
      SELECT u.id, u.email, so.role
      FROM store_operators so
      JOIN users u ON so.user_id = u.id
      WHERE so.store_id = $1 AND so.role = 'operator'
    `, [store_id]);
    
    const operatorsList = result.rows.map(row => ({
      id: row.id, email: row.email, role: row.role, status: 'confirmed' 
    }));
    
    res.json(operatorsList);
  } catch (err) {
    console.error("Fetch Operators Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// 5. REMOVE STAFF FROM STORE
app.delete('/api/stores/:store_id/staff/:staff_id', async (req, res) => {
  try {
    const { store_id, staff_id } = req.params;

    const result = await db.query(`
      DELETE FROM store_operators 
      WHERE store_id = $1 AND user_id = $2 
      RETURNING *
    `, [store_id, staff_id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Staff member not found in this store." });
    }

    res.status(200).json({ message: "Staff successfully removed from store" });
  } catch (error) {
    console.error("Remove Staff Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// STANDARD STORE & ITEM ROUTES
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

app.patch('/api/stores/:id/theme', async (req, res) => {
  try {
    const { theme_settings } = req.body;
    if (typeof theme_settings !== 'object') return res.status(400).json({ error: "Invalid theme format" });
    const result = await db.query(`UPDATE stores SET theme_settings = $1 WHERE id = $2 RETURNING id, theme_settings`, [theme_settings, req.params.id]);
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

app.patch('/api/stores/:id/toggle', async (req, res) => {
  try {
    const result = await db.query('UPDATE stores SET is_open = $1 WHERE id = $2 RETURNING id, is_open', [req.body.is_open, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

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