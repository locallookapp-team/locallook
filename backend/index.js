const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const rateLimit = require('express-rate-limit'); 
require('dotenv').config();

const db = require('./db'); 

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize clients
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

app.use(cors()); 
app.use(express.json()); 

// ==========================================
// SECURITY: API RATE LIMITING
// ==========================================

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  message: { error: "Too many requests from this IP, please try again after 15 minutes." }
});

const inviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 10, 
  message: { error: "Security restriction: You can only send 10 invites per hour." }
});

app.use('/api/', apiLimiter); 

// ==========================================
// STORE CREATION, EDITING & RBAC
// ==========================================

app.post('/api/stores', async (req, res) => {
  const client = await db.connect();
  try {
    const { store_name, store_category, description, lat, lng, user_id } = req.body;
    await client.query('BEGIN');

    const storeResult = await client.query(`
      INSERT INTO stores (store_name, store_category, description, location, is_open, is_approved)
      VALUES ($1, $2, $3, ST_GeomFromText($4, 4326), false, true)
      RETURNING id, store_name;
    `, [store_name, store_category, description, `POINT(${lng} ${lat})`]); 
    
    const newStoreId = storeResult.rows[0].id;

    await client.query(`
      INSERT INTO store_operators (store_id, user_id, role, status)
      VALUES ($1, $2, 'merchant', 'confirmed');
    `, [newStoreId, user_id]);

    await client.query('COMMIT');
    res.json(storeResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).send("Server Error");
  } finally {
    client.release();
  }
});

// UPDATE STORE INFO (Name, Category, Description, Location)
app.patch('/api/stores/:id', async (req, res) => {
  try {
    const { store_name, store_category, description, lat, lng } = req.body;
    const result = await db.query(`
      UPDATE stores 
      SET store_name = $1, store_category = $2, description = $3, location = ST_GeomFromText($4, 4326) 
      WHERE id = $5 
      RETURNING id, store_name, store_category, description, is_open, theme_settings, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
    `, [store_name, store_category, description, `POINT(${lng} ${lat})`, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// DELETE STORE
app.delete('/api/stores/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM stores WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Store not found" });
    res.json({ message: "Store deleted successfully" });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

app.get('/api/merchant/stores/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;

    await db.query(`UPDATE store_operators SET status = 'confirmed' WHERE user_id = $1 AND status = 'pending'`, [user_id]);

    const result = await db.query(`
      SELECT s.id, s.store_name, s.store_category, s.description, s.is_open, ST_Y(s.location::geometry) as lat, ST_X(s.location::geometry) as lng, so.role
      FROM stores s JOIN store_operators so ON s.id = so.store_id WHERE so.user_id = $1
    `, [user_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// ==========================================
// STORE OPERATORS & INVITES
// ==========================================

app.post('/api/stores/:store_id/invite', inviteLimiter, async (req, res) => {
  const client = await db.connect();
  try {
    const { store_id } = req.params;
    const { email, requester_id } = req.body;

    const authCheck = await client.query(`SELECT role FROM store_operators WHERE store_id = $1 AND user_id = $2`, [store_id, requester_id]);
    if (authCheck.rows.length === 0 || authCheck.rows[0].role !== 'merchant') return res.status(403).json({ error: "Only merchants can invite." });

    let targetUserId;
    let inviteStatus = 'pending'; 

    const existingUserCheck = await client.query(`SELECT id FROM users WHERE email = $1`, [email]);

    await client.query('BEGIN');

    if (existingUserCheck.rows.length > 0) {
      targetUserId = existingUserCheck.rows[0].id;
      inviteStatus = 'confirmed'; 
      
      await resend.emails.send({
        from: 'onboarding@resend.dev', 
        to: email,
        subject: "You've been added to a store on LocalLook!",
        html: `<div style="font-family: sans-serif; padding: 20px;"><h2>Store Access Granted</h2><a href="https://locallook.vercel.app/dashboard">Go to Dashboard</a></div>`
      });
    } else {
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
      if (inviteError) throw new Error(inviteError.message);
      targetUserId = inviteData.user.id;
      await client.query(`INSERT INTO users (id, email, role) VALUES ($1, $2, 'operator') ON CONFLICT (id) DO NOTHING;`, [targetUserId, email]);
    }

    const existingOp = await client.query(`SELECT 1 FROM store_operators WHERE store_id = $1 AND user_id = $2`, [store_id, targetUserId]);
    if (existingOp.rows.length === 0) {
      await client.query(`INSERT INTO store_operators (store_id, user_id, role, status) VALUES ($1, $2, 'operator', $3);`, [store_id, targetUserId, inviteStatus]);
    } else {
      throw new Error("This user is already an operator.");
    }

    await client.query('COMMIT');
    res.json({ message: existingUserCheck.rows.length > 0 ? "Existing staff member re-added and notified!" : "Invite sent successfully!", operator_id: targetUserId });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.get('/api/stores/:store_id/operators', async (req, res) => {
  try {
    const { store_id } = req.params;
    const result = await db.query(`
      SELECT u.id, u.email, so.role, so.status FROM store_operators so JOIN users u ON so.user_id = u.id WHERE so.store_id = $1 AND so.role != 'merchant'
    `, [store_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

app.delete('/api/stores/:store_id/staff/:staff_id', async (req, res) => {
  try {
    const { store_id, staff_id } = req.params;
    const result = await db.query(`DELETE FROM store_operators WHERE store_id = $1 AND user_id = $2 RETURNING *`, [store_id, staff_id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Staff member not found." });
    res.status(200).json({ message: "Staff removed." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// PUBLIC STORE & ITEM ROUTES
// ==========================================

app.get('/api/stores', async (req, res) => {
  try {
    const { minLng, minLat, maxLng, maxLat } = req.query;
    let query = `SELECT id, store_name, store_category, description, is_open, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng FROM stores`;
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
    const result = await db.query(`SELECT id, store_name, store_category, description, is_open, theme_settings, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng FROM stores WHERE id = $1;`, [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

app.patch('/api/stores/:id/theme', async (req, res) => {
  try {
    const { theme_settings } = req.body;
    const result = await db.query(`UPDATE stores SET theme_settings = $1 WHERE id = $2 RETURNING id, theme_settings`, [theme_settings, req.params.id]);
    res.json(result.rows[0]);
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

app.get('/api/stores/:store_id/items', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM items WHERE store_id = $1 ORDER BY created_at DESC', [req.params.store_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

app.post('/api/items', async (req, res) => {
  try {
    const { store_id, item_name, description, price, image_url, item_category } = req.body;
    const result = await db.query(`
      INSERT INTO items (store_id, item_name, description, price, image_url, item_category, is_available) 
      VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'General'), true) RETURNING *;
    `, [store_id, item_name, description, price, image_url, item_category]); 
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

app.patch('/api/items/:id', async (req, res) => {
  try {
    const { item_name, description, price, item_category, image_url } = req.body;
    let query = `UPDATE items SET item_name = $1, description = $2, price = $3, item_category = $4`;
    let values = [item_name, description, price, item_category];
    
    if (image_url) {
      query += `, image_url = $5 WHERE id = $6 RETURNING *`;
      values.push(image_url, req.params.id);
    } else {
      query += ` WHERE id = $5 RETURNING *`;
      values.push(req.params.id);
    }

    const result = await db.query(query, values);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

app.delete('/api/items/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM items WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Item not found" });
    res.json({ message: "Item deleted successfully" });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});