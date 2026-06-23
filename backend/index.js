const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const rateLimit = require('express-rate-limit'); 
require('dotenv').config();

const db = require('./db'); 

const app = express();
const PORT = process.env.PORT || 3000;

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

app.use(cors()); 
app.use(express.json()); 

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { error: "Too many requests." } });
const inviteLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: { error: "Too many invites." } });
app.use('/api/', apiLimiter); 

app.post('/api/stores', async (req, res) => {
  const client = await db.connect();
  try {
    const { store_name, store_category, description, phone, email, website, lat, lng, user_id } = req.body;
    await client.query('BEGIN');

    const storeResult = await client.query(`
      INSERT INTO stores (store_name, store_category, description, phone, email, website, location, is_open, is_approved)
      VALUES ($1, $2, $3, $4, $5, $6, ST_GeomFromText($7, 4326), false, true)
      RETURNING id, store_name;
    `, [store_name, store_category, description, phone, email, website, `POINT(${lng} ${lat})`]); 
    
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

app.patch('/api/stores/:id', async (req, res) => {
  try {
    const { store_name, store_category, description, phone, email, website, lat, lng } = req.body;
    const result = await db.query(`
      UPDATE stores 
      SET store_name = $1, store_category = $2, description = $3, phone = $4, email = $5, website = $6, location = ST_GeomFromText($7, 4326) 
      WHERE id = $8 
      RETURNING id, store_name, store_category, description, phone, email, website, is_open, theme_settings, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
    `, [store_name, store_category, description, phone, email, website, `POINT(${lng} ${lat})`, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

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
      SELECT s.id, s.store_name, s.store_category, s.description, s.phone, s.email, s.website, s.is_open, s.theme_settings, ST_Y(s.location::geometry) as lat, ST_X(s.location::geometry) as lng, so.role
      FROM stores s JOIN store_operators so ON s.id = so.store_id WHERE so.user_id = $1
    `, [user_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

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
        to: email, subject: "You've been added to a store on LocalLook!",
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
    res.json({ message: "Invite processed!" });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.get('/api/stores/:store_id/operators', async (req, res) => {
  try {
    const result = await db.query(`SELECT u.id, u.email, so.role, so.status FROM store_operators so JOIN users u ON so.user_id = u.id WHERE so.store_id = $1 AND so.role != 'merchant'`, [req.params.store_id]);
    res.json(result.rows);
  } catch (err) { res.status(500).send("Server Error"); }
});

app.delete('/api/stores/:store_id/staff/:staff_id', async (req, res) => {
  try {
    await db.query(`DELETE FROM store_operators WHERE store_id = $1 AND user_id = $2 RETURNING *`, [req.params.store_id, req.params.staff_id]);
    res.status(200).json({ message: "Staff removed." });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// GET ALL STORES (Upgraded with Spatial Queries for Map Bounding Box & Radius Browsing)
app.get('/api/stores', async (req, res) => {
  try {
    const { minLng, minLat, maxLng, maxLat, userLat, userLng, radius } = req.query;
    
    // Base Select statement
    let selectClause = `SELECT id, store_name, store_category, description, phone, email, website, is_open, theme_settings, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng`;
    let fromClause = ` FROM stores`;
    let whereClauses = [];
    let queryParams = [];
    let paramIndex = 1;
    let orderByClause = '';

    // SCENARIO 1: Browse Page (Radius Query + Distance Sorting)
    if (userLat && userLng) {
      // 1a. Calculate exact distance in meters from the user
      selectClause += `, ST_Distance(location::geography, ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex+1}), 4326)::geography) AS distance_meters`;
      queryParams.push(userLng, userLat);
      paramIndex += 2;
      
      // 1b. Filter stores within a specific radius (default: 5000 meters / 5km)
      const searchRadius = radius ? parseInt(radius) : 5000; 
      whereClauses.push(`ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $${paramIndex})`);
      queryParams.push(searchRadius);
      paramIndex++;
      
      // 1c. Sort the results so the closest store is at the top of the feed
      orderByClause = ` ORDER BY distance_meters ASC`;
    } 
    // SCENARIO 2: Map Page (Bounding Box Query)
    else if (minLng && minLat && maxLng && maxLat) {
      whereClauses.push(`location && ST_MakeEnvelope($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, 4326)`);
      queryParams.push(minLng, minLat, maxLng, maxLat);
      paramIndex += 4;
    }

    // Stitch the SQL query together
    let query = selectClause + fromClause;
    if (whereClauses.length > 0) {
      query += ` WHERE ` + whereClauses.join(' AND ');
    }
    query += orderByClause;

    const result = await db.query(query, queryParams);
    res.json(result.rows);
  } catch (err) { 
    console.error("Store Fetch Error:", err);
    res.status(500).send("Server Error"); 
  }
});

app.listen(PORT, () => { console.log(`Server is running on http://localhost:${PORT}`); });