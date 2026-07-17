const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const rateLimit = require('express-rate-limit'); 
require('dotenv').config();

const db = require('./db'); 

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

app.use(cors()); 
app.use(express.json()); 

const apiLimiter = rateLimit({ 
  windowMs: 15 * 60 * 1000,
  max: 2000, 
  message: { error: "Too many requests." } 
});
const inviteLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: { error: "Too many invites." } });
app.use('/api/', apiLimiter); 

// 🚀 SUPER ADMIN GATEKEEPER MIDDLEWARE
const verifySuperAdmin = async (req, res, next) => {
  const adminId = req.headers['x-admin-id'];
  
  if (!adminId) {
    return res.status(401).json({ error: "Unauthorized: Admin ID missing." });
  }

  try {
    const result = await db.query('SELECT role FROM users WHERE id = $1', [adminId]);
    
    if (result.rows.length === 0 || result.rows[0].role !== 'super_admin') {
      return res.status(403).json({ error: "Forbidden: Super Admin clearance required." });
    }
    
    // User is a super_admin, allow the request to proceed
    next();
  } catch (err) {
    console.error("Admin Verification Error:", err);
    res.status(500).json({ error: "Server error verifying administrative rights." });
  }
};

// 🚀 ADMIN PANEL ROUTES
app.get('/api/admin/stores', verifySuperAdmin, async (req, res) => {
  try {
    // Fetches all stores, regardless of distance or approval status
    const result = await db.query(`
      SELECT s.id, s.store_name, s.store_category, s.is_approved, s.is_open, u.email as owner_email
      FROM stores s
      LEFT JOIN users u ON s.merchant_id = u.id
      ORDER BY s.created_at DESC;
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Admin Store Fetch Error:", err);
    res.status(500).json({ error: "Failed to fetch stores." });
  }
});

// --- ADMIN: Update Store Approval Status ---
app.patch('/api/admin/stores/:id/status', verifySuperAdmin, async (req, res) => {
  const storeId = req.params.id;
  const { is_approved } = req.body;

  try {
    const { data, error } = await supabase
      .from('stores')
      .update({ is_approved })
      .eq('id', storeId)
      .select();

    if (error) throw error;
    res.json({ message: 'Store status updated successfully', store: data[0] });
  } catch (error) {
    console.error("Error updating store status:", error);
    res.status(500).json({ error: 'Failed to update store status' });
  }
});

app.post('/api/stores', async (req, res) => {
  const client = await db.connect();
  try {
    const { store_name, store_category, description, phone, email, website, lat, lng, user_id } = req.body;
    
    if (!store_name || !store_category || !lat || !lng || !user_id) {
      return res.status(400).json({ error: "Missing required store fields or location." });
    }

    await client.query('BEGIN');

    const storeResult = await client.query(`
      INSERT INTO stores (store_name, store_category, description, phone, email, website, location, is_open, is_approved, merchant_id)
      VALUES ($1, $2, $3, $4, $5, $6, ST_GeomFromText($7, 4326), false, true, $8)
      RETURNING id, store_name;
    `, [store_name, store_category, description, phone, email, website, `POINT(${lng} ${lat})`, user_id]); 
    
    const newStoreId = storeResult.rows[0].id;

    await client.query(`
      INSERT INTO store_operators (store_id, user_id, role, status)
      VALUES ($1, $2, 'merchant', 'confirmed');
    `, [newStoreId, user_id]);

    await client.query(`
      INSERT INTO users (id, role)
      VALUES ($1, 'merchant')
      ON CONFLICT (id) DO UPDATE 
      SET role = 'merchant';
    `, [user_id]);

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
    const result = await db.query(`
      SELECT s.id, s.store_name, s.store_category, s.industry, s.description, s.phone, s.email, s.website, s.is_open, s.theme_settings, ST_Y(s.location::geometry) as lat, ST_X(s.location::geometry) as lng, so.role, s.merchant_id
      FROM stores s JOIN store_operators so ON s.id = so.store_id WHERE so.user_id = $1 AND so.status = 'confirmed'
    `, [user_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// 🚀 NEW APPLICATION-LEVEL INVITE ROUTE
app.post('/api/stores/:store_id/invite', inviteLimiter, async (req, res) => {
  const client = await db.connect();
  try {
    const { store_id } = req.params;
    const { email, requester_id } = req.body;

    if (!email || !email.includes('@')) return res.status(400).json({ error: "Invalid email address." });

    // Verify ownership and get store name for the email
    const authCheck = await client.query(
      `SELECT merchant_id, store_name FROM stores WHERE id = $1 AND merchant_id = $2`, 
      [store_id, requester_id]
    );

    if (authCheck.rows.length === 0) {
      return res.status(403).json({ error: "Only the store owner can invite staff." });
    }
    const storeName = authCheck.rows[0].store_name;

    await client.query('BEGIN');

    // Check if the user is already an active operator
    const existingOpCheck = await client.query(
      `SELECT 1 FROM store_operators so JOIN users u ON so.user_id = u.id WHERE so.store_id = $1 AND u.email = $2`,
      [store_id, email]
    );
    if (existingOpCheck.rows.length > 0) {
      throw new Error("This user is already an active staff member at this store.");
    }

    // Insert into the new store_invitations table
    const inviteInsert = await client.query(
      `INSERT INTO store_invitations (store_id, email, status) VALUES ($1, $2, 'pending') ON CONFLICT (store_id, email) DO NOTHING RETURNING id;`,
      [store_id, email]
    );

    if (inviteInsert.rows.length === 0) {
       throw new Error("A pending invitation has already been sent to this email.");
    }

    // Send the customized Application-Level Email via Resend
    await resend.emails.send({
      from: 'LocalLook <invitation@locallookph.com>', 
      to: email, 
      subject: `You've been invited to manage ${storeName}!`,
      html: `<div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 12px;">
               <h2 style="color: #0F172A; margin-top: 0;">Store Access Invitation</h2>
               <p style="color: #475569; line-height: 1.6;">You have been invited to join the staff team for <strong>${storeName}</strong> on LocalLook.</p>
               <p style="color: #475569; line-height: 1.6;">Click the secure link below to sign up for an account. Once logged in, click the notification bell to accept your invite!</p>
               <br/>
               <a href="https://locallookph.com/dashboard" style="display: inline-block; padding: 12px 24px; background-color: #2563EB; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Log In or Sign Up</a>
               <br/><br/>
               <p style="color: #94A3B8; font-size: 12px;"><em>Tip: Use "Sign in with Google" to automatically sync your profile picture and name!</em></p>
             </div>`
    });
    
    await client.query('COMMIT');
    res.json({ message: "Invitation sent successfully!" });
    
  } catch (err) {
    await client.query('ROLLBACK');
    const safeErrorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: safeErrorMsg });
  } finally {
    client.release();
  }
});

// 🚀 ACCEPT INVITATION ENDPOINT (Ready for Notification Bell)
app.post('/api/invitations/:invite_id/accept', async (req, res) => {
  const client = await db.connect();
  try {
    const { invite_id } = req.params;
    const { user_id, email } = req.body; 

    await client.query('BEGIN');

    const inviteCheck = await client.query(`SELECT store_id, email FROM store_invitations WHERE id = $1 AND status = 'pending'`, [invite_id]);
    if (inviteCheck.rows.length === 0) throw new Error("Invalid or expired invitation.");
    
    const invite = inviteCheck.rows[0];
    if (invite.email !== email) throw new Error("This invite was sent to a different email address.");

    await client.query(`INSERT INTO store_operators (store_id, user_id, role, status) VALUES ($1, $2, 'operator', 'confirmed') ON CONFLICT DO NOTHING`, [invite.store_id, user_id]);
    await client.query(`DELETE FROM store_invitations WHERE id = $1`, [invite_id]);

    await client.query('COMMIT');
    res.json({ message: "Invitation accepted!" });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 🚀 DECLINE INVITATION ENDPOINT
app.post('/api/invitations/:invite_id/decline', async (req, res) => {
  try {
    await db.query(`DELETE FROM store_invitations WHERE id = $1`, [req.params.invite_id]);
    res.json({ message: "Invitation declined." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🚀 UNIFIED STAFF FETCHING: Pulls from both operators and pending invitations
app.get('/api/stores/:store_id/operators', async (req, res) => {
  try {
    const store_id = req.params.store_id;
    
    const confirmedOps = await db.query(`
      SELECT u.id, u.email, so.role, so.status, so.user_id 
      FROM store_operators so JOIN users u ON so.user_id = u.id 
      WHERE so.store_id = $1
    `, [store_id]);
    
    const pendingInvites = await db.query(`
      SELECT id as user_id, email, 'operator' as role, 'pending' as status 
      FROM store_invitations 
      WHERE store_id = $1
    `, [store_id]);

    res.json([...confirmedOps.rows, ...pendingInvites.rows]);
  } catch (err) { res.status(500).send("Server Error"); }
});

// 🚀 UNIFIED STAFF DELETION: Removes from operators OR invitations based on UUID
app.delete('/api/stores/:store_id/staff/:identifier', async (req, res) => {
  try {
    const { store_id, identifier } = req.params;
    
    await db.query(`DELETE FROM store_operators WHERE store_id = $1 AND user_id = $2`, [store_id, identifier]);
    await db.query(`DELETE FROM store_invitations WHERE store_id = $1 AND id = $2`, [store_id, identifier]);
    
    res.status(200).json({ message: "Staff/Invite removed successfully." });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/stores', async (req, res) => {
  try {
    const { minLng, minLat, maxLng, maxLat, userLat, userLng, radius } = req.query;
    
    let selectClause = `SELECT id, store_name, store_category, industry, description, phone, email, website, is_open, theme_settings, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng`;
    let fromClause = ` FROM stores`;
    let whereClauses = [];
    let queryParams = [];
    let paramIndex = 1;
    let orderByClause = '';

    if (userLat && userLng) {
      selectClause += `, ST_Distance(location::geography, ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex+1}), 4326)::geography) AS distance_meters`;
      queryParams.push(userLng, userLat);
      paramIndex += 2;
      
      const searchRadius = radius ? parseInt(radius) : 5000; 
      whereClauses.push(`ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $${paramIndex})`);
      queryParams.push(searchRadius);
      paramIndex++;
      
      orderByClause = ` ORDER BY distance_meters ASC`;
    } 
    else if (minLng && minLat && maxLng && maxLat) {
      whereClauses.push(`location && ST_MakeEnvelope($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, 4326)`);
      queryParams.push(minLng, minLat, maxLng, maxLat);
      paramIndex += 4;
    }

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

app.get('/api/stores/:id', async (req, res) => {
  try {
    const result = await db.query(`SELECT id, store_name, store_category, industry, description, phone, email, website, is_open, theme_settings, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng, cover_image_url FROM stores WHERE id = $1;`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Store not found" });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).send("Server Error"); }
});

app.patch('/api/stores/:id/theme', async (req, res) => {
  try {
    const result = await db.query(`UPDATE stores SET theme_settings = $1 WHERE id = $2 RETURNING id, theme_settings`, [req.body.theme_settings, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).send("Server Error"); }
});

app.patch('/api/stores/:id/toggle', async (req, res) => {
  try {
    const result = await db.query('UPDATE stores SET is_open = $1 WHERE id = $2 RETURNING id, is_open', [req.body.is_open, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).send("Server Error"); }
});

app.get('/api/stores/:store_id/items', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM items WHERE store_id = $1 ORDER BY created_at DESC', [req.params.store_id]);
    res.json(result.rows);
  } catch (err) { res.status(500).send("Server Error"); }
});

app.post('/api/items', async (req, res) => {
  try {
    const { store_id, item_name, description, price, image_url, item_category } = req.body;
    
    if (!store_id || !item_name || isNaN(parseFloat(price))) {
      return res.status(400).json({ error: "Invalid item data. Name and valid price are required." });
    }

    const result = await db.query(`
      INSERT INTO items (store_id, item_name, description, price, image_url, item_category, is_available) 
      VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'General'), true) RETURNING *;
    `, [store_id, item_name, description, parseFloat(price), image_url, item_category]); 
    res.json(result.rows[0]);
  } catch (err) { res.status(500).send("Server Error"); }
});

app.patch('/api/items/:id', async (req, res) => {
  try {
    const { item_name, description, price, item_category, image_url } = req.body;
    let query = `UPDATE items SET item_name = $1, description = $2, price = $3, item_category = $4`;
    let values = [item_name, description, price, item_category];
    if (image_url) { query += `, image_url = $5 WHERE id = $6 RETURNING *`; values.push(image_url, req.params.id); } 
    else { query += ` WHERE id = $5 RETURNING *`; values.push(req.params.id); }
    const result = await db.query(query, values);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).send("Server Error"); }
});

app.delete('/api/items/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM items WHERE id = $1 RETURNING *', [req.params.id]);
    res.json({ message: "Item deleted successfully" });
  } catch (err) { res.status(500).send("Server Error"); }
});

app.get('/api/search/items', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const result = await db.query(`
      SELECT i.id, i.item_name, i.price, i.store_id, s.store_name 
      FROM items i JOIN stores s ON i.store_id = s.id 
      WHERE i.item_name ILIKE $1 OR i.item_category ILIKE $1 LIMIT 15;
    `, [`%${q}%`]);
    res.json(result.rows);
  } catch (err) { res.status(500).send("Server Error"); }
});

app.post('/api/create-checkout-session', async (req, res) => {
  const { store_id } = req.body;

  try {
    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!secretKey) throw new Error("PayMongo Secret Key is missing.");

    const options = {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
        authorization: `Basic ${Buffer.from(secretKey).toString('base64')}`
      },
      body: JSON.stringify({
        data: {
          attributes: {
            send_email_receipt: true,
            show_description: true,
            show_line_items: true,
            line_items: [
              {
                currency: 'PHP',
                amount: 19900, 
                name: 'LocalLook Premium Plan - 30 Days',
                quantity: 1
              }
            ],
            payment_method_types: ['gcash', 'paymaya', 'grab_pay', 'card'],
            reference_number: store_id, 
            success_url: 'https://locallookph.com/dashboard?payment=success',
            cancel_url: 'https://locallookph.com/dashboard?payment=cancelled'
          }
        }
      })
    };

    const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', options);
    const data = await response.json();

    if (data.errors) {
      throw new Error(data.errors[0].detail);
    }

    res.json({ checkoutUrl: data.data.attributes.checkout_url });

  } catch (error) {
    console.error("Checkout Session Error:", error.message);
    res.status(500).json({ error: 'Failed to create payment session.' });
  }
});

app.post('/api/webhooks/paymongo', async (req, res) => {
  try {
    const eventType = req.body?.data?.attributes?.type;
    
    if (eventType === 'checkout_session.payment.paid') {
      const storeId = req.body?.data?.attributes?.data?.attributes?.reference_number;
      
      if (storeId) {
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

        const { error } = await supabaseAdmin.from('subscriptions').insert([{
          store_id: storeId,
          plan_type: 'premium',
          end_date: thirtyDaysFromNow.toISOString(),
          status: 'active'
        }]);

        if (error) {
          console.error("Webhook Database Error:", error);
          return res.status(500).send("Database Update Failed");
        }
        
        console.log(`✅ Webhook Success: Store ${storeId} is now Premium.`);
      }
    }
    
    res.status(200).send("Webhook Received");

  } catch (err) {
    console.error("Webhook Processing Error:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.get('/api/stores/:store_id/reviews', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT r.id, r.rating, r.comment, r.created_at, u.display_name, u.avatar_url 
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.store_id = $1
      ORDER BY r.created_at DESC;
    `, [req.params.store_id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.post('/api/reviews', async (req, res) => {
  try {
    const { store_id, user_id, rating, comment } = req.body;
    
    if (!store_id || !user_id || !rating) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const result = await db.query(`
      INSERT INTO reviews (store_id, user_id, rating, comment) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *;
    `, [store_id, user_id, rating, comment]); 
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.post('/api/saved-places/toggle', async (req, res) => {
  try {
    const { store_id, user_id } = req.body;
    
    const check = await db.query('SELECT id FROM saved_places WHERE store_id = $1 AND user_id = $2', [store_id, user_id]);
    
    if (check.rows.length > 0) {
      await db.query('DELETE FROM saved_places WHERE id = $1', [check.rows[0].id]);
      res.json({ saved: false, message: "Removed from saved places." });
    } else {
      await db.query('INSERT INTO saved_places (store_id, user_id) VALUES ($1, $2)', [store_id, user_id]);
      res.json({ saved: true, message: "Added to saved places." });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.get('/api/users/:user_id/saved-places', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT s.id, s.store_name, s.store_category, s.cover_image_url, sp.created_at
      FROM saved_places sp
      JOIN stores s ON sp.store_id = s.id
      WHERE sp.user_id = $1
      ORDER BY sp.created_at DESC;
    `, [req.params.user_id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, email, role, display_name, avatar_url 
      FROM users 
      WHERE id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.patch('/api/users/:id', async (req, res) => {
  try {
    const { display_name, avatar_url } = req.body;
    
    const result = await db.query(`
      UPDATE users 
      SET display_name = $1, avatar_url = $2
      WHERE id = $3 
      RETURNING id, email, role, display_name, avatar_url
    `, [display_name, avatar_url, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.listen(PORT, () => { console.log(`Server is running on http://localhost:${PORT}`); });