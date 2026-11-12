const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const rateLimit = require('express-rate-limit'); 
require('dotenv').config();

const db = require('./db'); 

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

// --- 1. SECURITY HEADERS & STRICT CORS ---
app.use(helmet());

const allowedOrigins = [
  'https://locallookph.com',
  'http://localhost:5173',
  'http://localhost:5174', 
  'http://localhost:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS security policy.'));
    }
  },
  credentials: true
}));

app.use(express.json()); 

// --- 2. RATE LIMITERS ---
const apiLimiter = rateLimit({ 
  windowMs: 15 * 60 * 1000,
  max: 500, 
  message: { error: "Too many requests from this IP. Please try again later." } 
});

const inviteLimiter = rateLimit({ 
  windowMs: 60 * 60 * 1000, 
  max: 10, 
  message: { error: "Too many invites sent. Please wait an hour." } 
});

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many payment attempts. Try again later." }
});

const voucherLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, 
  message: { error: "Too many voucher attempts. Please try again later." }
});

app.use('/api/', apiLimiter); 

// --- 3. SUPABASE & SERVICES INITIALIZATION ---
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

// --- 4. AUTHENTICATION & SECURITY MIDDLEWARES ---
const verifyUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Unauthorized: Missing authentication token." });
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: "Unauthorized: Invalid or expired token." });
  }

  req.user = user;
  next();
};

const verifySuperAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Unauthorized: Missing authentication token." });
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) return res.status(401).json({ error: "Unauthorized: Invalid token." });

  try {
    const result = await db.query('SELECT role FROM users WHERE id = $1', [user.id]);
    if (result.rows.length === 0 || result.rows[0].role !== 'super_admin') {
      return res.status(403).json({ error: "Forbidden: Super Admin clearance required." });
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ error: "Server error verifying administrative rights." });
  }
};

const isStoreOperator = async (storeId, userId) => {
  const check = await db.query('SELECT 1 FROM store_operators WHERE store_id = $1 AND user_id = $2', [storeId, userId]);
  return check.rows.length > 0;
};

// 🚀 PREMIUM VERIFICATION MIDDLEWARE
const verifyPremium = async (req, res, next) => {
  try {
    let storeId = req.body.store_id || req.params.store_id;

    // Handle store routes using :id (like theme updates)
    if (!storeId && req.params.id && req.originalUrl.includes('/api/stores/')) {
      storeId = req.params.id;
    }

    // Handle item routes using :id (like updating/deleting specific items)
    if (!storeId && req.params.id && req.originalUrl.includes('/api/items/')) {
      const itemCheck = await db.query('SELECT store_id FROM items WHERE id = $1', [req.params.id]);
      if (itemCheck.rows.length === 0) return res.status(404).json({ error: "Item not found." });
      storeId = itemCheck.rows[0].store_id;
    }

    if (!storeId) {
      return res.status(400).json({ error: "Store ID is required for this operation." });
    }

    const subCheck = await db.query(`
      SELECT plan_type, end_date 
      FROM subscriptions 
      WHERE store_id = $1 
      ORDER BY created_at DESC LIMIT 1
    `, [storeId]);

    const sub = subCheck.rows[0];
    const isPremium = sub && sub.plan_type === 'premium' && new Date(sub.end_date) > new Date();

    if (!isPremium) {
      return res.status(403).json({ 
        error: "Premium Required", 
        message: "This action requires an active LocalLook Premium subscription." 
      });
    }

    next(); 
  } catch (err) {
    console.error("Premium Verification Error:", err);
    res.status(500).json({ error: "Server error verifying subscription status." });
  }
};

// ---------------------------------------------------------
// 🚀 ADMIN PANEL ROUTES (Protected)
// ---------------------------------------------------------
app.get('/api/admin/stores', verifySuperAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        s.id, 
        s.store_name, 
        s.store_category, 
        s.is_approved, 
        s.is_open, 
        u.email as owner_email,
        u.display_name as merchant_name
      FROM stores s
      LEFT JOIN users u ON s.merchant_id = u.id
      ORDER BY s.created_at DESC;
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stores." });
  }
});

app.patch('/api/admin/stores/:id/status', verifySuperAdmin, async (req, res) => {
  const storeId = req.params.id;
  const { is_approved } = req.body;

  try {
    const { data: storeData, error: storeError } = await supabaseAdmin
      .from('stores')
      .update({ is_approved })
      .eq('id', storeId)
      .select()
      .single();

    if (storeError) throw storeError;

    if (storeData.merchant_id) {
      const statusMessage = is_approved 
        ? 'Your store has been officially approved! You are now live on the platform.' 
        : 'Your store has been temporarily suspended. Please contact support.';

      await supabaseAdmin.from('notifications').insert([{
        user_id: storeData.merchant_id,
        title: is_approved ? 'Store Approved 🚀' : 'Store Suspended ⚠️',
        message: statusMessage,
        type: is_approved ? 'success' : 'moderation'
      }]);
    }

    res.json({ message: 'Store status updated successfully', store: storeData });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update store status' });
  }
});

// ---------------------------------------------------------
// 🚀 STORE MANAGEMENT ROUTES
// ---------------------------------------------------------
app.post('/api/stores', verifyUser, async (req, res) => {
  const client = await db.connect();
  try {
    const { store_name, store_category, industry, description, phone, email, website, lat, lng, tos_accepted_at } = req.body;
    const user_id = req.user.id; 
    
    if (!store_name || !store_category || !lat || !lng || !tos_accepted_at) {
      return res.status(400).json({ error: "Missing required fields or Terms of Service consent." });
    }

    await client.query('BEGIN');
    
    const storeResult = await client.query(`
      INSERT INTO stores (store_name, store_category, industry, description, phone, email, website, location, is_open, is_approved, merchant_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, ST_GeomFromText($8, 4326), false, true, $9)
      RETURNING id, store_name;
    `, [store_name, store_category, industry, description, phone, email, website, `POINT(${lng} ${lat})`, user_id]); 
    
    const newStoreId = storeResult.rows[0].id;
    await client.query(`INSERT INTO store_operators (store_id, user_id, role, status) VALUES ($1, $2, 'merchant', 'confirmed');`, [newStoreId, user_id]);
    
    await client.query(`
      INSERT INTO users (id, role, tos_accepted_at) 
      VALUES ($1, 'merchant', $2) 
      ON CONFLICT (id) DO UPDATE 
      SET role = 'merchant', tos_accepted_at = EXCLUDED.tos_accepted_at;
    `, [user_id, tos_accepted_at]);
    
    await client.query('COMMIT');
    
    res.json(storeResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).send("Server Error");
  } finally {
    client.release();
  }
});

app.patch('/api/stores/:id', verifyUser, async (req, res) => {
  try {
    if (!(await isStoreOperator(req.params.id, req.user.id))) {
      return res.status(403).json({ error: "Unauthorized access to store." });
    }

    const updates = req.body;
    
    const allowedFields = [
      'store_name', 'store_category', 'industry', 'description', 
      'phone', 'email', 'website', 'cover_image_url', 'logo_url'
    ];

    let queryParams = [];
    let setClauses = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClauses.push(`${field} = $${paramIndex}`);
        queryParams.push(updates[field]);
        paramIndex++;
      }
    }

    if (updates.lat && updates.lng) {
      setClauses.push(`location = ST_GeomFromText($${paramIndex}, 4326)`);
      queryParams.push(`POINT(${updates.lng} ${updates.lat})`);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: "No valid fields provided for update." });
    }

    queryParams.push(req.params.id);
    const query = `UPDATE stores SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    const result = await db.query(query, queryParams);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Store Update Error:", err);
    res.status(500).send("Server Error");
  }
});

app.delete('/api/stores/:id', verifyUser, async (req, res) => {
  try {
    if (!(await isStoreOperator(req.params.id, req.user.id))) return res.status(403).json({ error: "Unauthorized access to store." });
    
    const result = await db.query('DELETE FROM stores WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Store not found" });
    res.json({ message: "Store deleted successfully" });
  } catch (err) { res.status(500).send("Server Error"); }
});

// 🔓 Theme Modification is now FREE
app.patch('/api/stores/:id/theme', verifyUser, async (req, res) => {
  try {
    if (!(await isStoreOperator(req.params.id, req.user.id))) return res.status(403).json({ error: "Unauthorized." });
    const result = await db.query(`UPDATE stores SET theme_settings = $1 WHERE id = $2 RETURNING id, theme_settings`, [req.body.theme_settings, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).send("Server Error"); }
});

app.patch('/api/stores/:id/toggle', verifyUser, async (req, res) => {
  try {
    if (!(await isStoreOperator(req.params.id, req.user.id))) return res.status(403).json({ error: "Unauthorized." });
    const result = await db.query('UPDATE stores SET is_open = $1 WHERE id = $2 RETURNING id, is_open', [req.body.is_open, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).send("Server Error"); }
});

// 🚀 Update Operating Hours & Auto-Schedule Toggle
app.patch('/api/stores/:id/schedule', verifyUser, async (req, res) => {
  try {
    if (!(await isStoreOperator(req.params.id, req.user.id))) {
      return res.status(403).json({ error: "Unauthorized." });
    }

    const { auto_schedule_enabled, operating_hours } = req.body;
    
    // 1. Prepare dynamic SQL variables
    let isOpenUpdate = ''; 
    let queryParams = [auto_schedule_enabled, operating_hours, req.params.id];
    let paramIndex = 4;

    // 2. INSTANT EVALUATION: If automation is turned on, evaluate the time right now
    if (auto_schedule_enabled && operating_hours) {
      const options = { timeZone: 'Asia/Manila', hour12: false };
      const now = new Date();
      
      const currentDay = new Intl.DateTimeFormat('en-US', { ...options, weekday: 'long' }).format(now);
      const currentHour = new Intl.DateTimeFormat('en-US', { ...options, hour: '2-digit' }).format(now);
      const currentMinute = new Intl.DateTimeFormat('en-US', { ...options, minute: '2-digit' }).format(now);
      const currentTime = `${currentHour.padStart(2, '0')}:${currentMinute.padStart(2, '0')}`;

      const todaySchedule = operating_hours[currentDay];
      let shouldBeOpen = false;

      // Check if current time falls inside their open window
      if (todaySchedule && todaySchedule.isOpen) {
        if (currentTime >= todaySchedule.open && currentTime < todaySchedule.close) {
          shouldBeOpen = true;
        }
      }

      // Add the instantaneous status flip to our SQL query
      isOpenUpdate = `, is_open = $${paramIndex}`;
      queryParams.push(shouldBeOpen);
    }

    // 3. Execute the save and the status flip simultaneously
    const result = await db.query(`
      UPDATE stores 
      SET auto_schedule_enabled = $1, operating_hours = $2 ${isOpenUpdate}
      WHERE id = $3 
      RETURNING *
    `, queryParams);

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Schedule Update Error:", err);
    res.status(500).send("Server Error");
  }
}); 

// ---------------------------------------------------------
// 🚀 ITEM MANAGEMENT ROUTES (Secured - Premium Only)
// ---------------------------------------------------------
app.post('/api/items', verifyUser, verifyPremium, async (req, res) => {
  try {
    const { store_id, item_name, description, options, price, image_url, item_category } = req.body;
    if (!(await isStoreOperator(store_id, req.user.id))) return res.status(403).json({ error: "Unauthorized." });

    if (!store_id || !item_name || isNaN(parseFloat(price))) {
      return res.status(400).json({ error: "Invalid item data. Name and valid price are required." });
    }

    const result = await db.query(`
      INSERT INTO items (store_id, item_name, description, options, price, image_url, item_category, is_available) 
      VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'General'), true) RETURNING *;
    `, [store_id, item_name, description, options, parseFloat(price), image_url, item_category]); 
    res.json(result.rows[0]);
  } catch (err) { res.status(500).send("Server Error"); }
});

app.patch('/api/items/:id', verifyUser, verifyPremium, async (req, res) => {
  try {
    const itemCheck = await db.query('SELECT store_id FROM items WHERE id = $1', [req.params.id]);
    if (itemCheck.rows.length === 0) return res.status(404).json({error: "Not found"});
    if (!(await isStoreOperator(itemCheck.rows[0].store_id, req.user.id))) return res.status(403).json({ error: "Unauthorized." });

    const { item_name, description, options, price, item_category, image_url } = req.body;
    let query = `UPDATE items SET item_name = $1, description = $2, options = $3, price = $4, item_category = $5`;
    let values = [item_name, description, options, price, item_category];
    if (image_url) { query += `, image_url = $6 WHERE id = $7 RETURNING *`; values.push(image_url, req.params.id); } 
    else { query += ` WHERE id = $6 RETURNING *`; values.push(req.params.id); }
    const result = await db.query(query, values);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).send("Server Error"); }
});

app.delete('/api/items/:id', verifyUser, async (req, res) => {
  try {
    // Check if item exists and user has permission
    const itemCheck = await db.query('SELECT store_id FROM items WHERE id = $1', [req.params.id]);
    if (itemCheck.rows.length === 0) return res.status(404).json({error: "Item not found"});
    
    if (!(await isStoreOperator(itemCheck.rows[0].store_id, req.user.id))) {
      return res.status(403).json({ error: "Unauthorized." });
    }

    // Delete the item
    await db.query('DELETE FROM items WHERE id = $1', [req.params.id]);
    res.json({ message: "Item deleted successfully" });
  } catch (err) { 
    console.error("Delete Error:", err);
    res.status(500).json({ error: "Internal Server Error" }); 
  }
});

// ---------------------------------------------------------
// 🚀 INVITATIONS & STAFF (Protected)
// ---------------------------------------------------------
app.get('/api/invitations/pending', verifyUser, async (req, res) => {
  try {
    const email = req.user.email;
    const result = await db.query(`
      SELECT si.id, si.store_id, si.email, si.status, s.store_name
      FROM store_invitations si
      JOIN stores s ON si.store_id = s.id
      WHERE si.email = $1 AND si.status = 'pending'
    `, [email]);
    
    const mappedData = result.rows.map(row => ({
      id: row.id,
      store_id: row.store_id,
      email: row.email,
      status: row.status,
      stores: { store_name: row.store_name }
    }));
    
    res.json(mappedData);
  } catch (err) {
    console.error("Failed to fetch user invitations:", err);
    res.status(500).json({ error: "Failed to load invitations." });
  }
});

// 🛡️ Securing Staff Invites
app.post('/api/stores/:store_id/invite', inviteLimiter, verifyUser, verifyPremium, async (req, res) => {
  const client = await db.connect();
  try {
    const { store_id } = req.params;
    const { email } = req.body;
    const requester_id = req.user.id;

    if (!email || !email.includes('@')) return res.status(400).json({ error: "Invalid email address." });

    const authCheck = await client.query(`SELECT store_name FROM stores WHERE id = $1 AND merchant_id = $2`, [store_id, requester_id]);
    if (authCheck.rows.length === 0) return res.status(403).json({ error: "Only the store owner can invite staff." });
    
    const storeName = authCheck.rows[0].store_name;
    await client.query('BEGIN');

    const existingOpCheck = await client.query(`SELECT 1 FROM store_operators so JOIN users u ON so.user_id = u.id WHERE so.store_id = $1 AND u.email = $2`, [store_id, email]);
    if (existingOpCheck.rows.length > 0) throw new Error("This user is already an active staff member at this store.");

    const inviteInsert = await client.query(`INSERT INTO store_invitations (store_id, email, status) VALUES ($1, $2, 'pending') ON CONFLICT (store_id, email) DO NOTHING RETURNING id;`, [store_id, email]);
    if (inviteInsert.rows.length === 0) throw new Error("A pending invitation has already been sent to this email.");

    await resend.emails.send({
      from: 'LocalLook <invitation@locallookph.com>', 
      to: email, 
      subject: `You've been invited to manage ${storeName}!`,
      html: `<div style="font-family: sans-serif; padding: 20px;">
               <h2>Store Access Invitation</h2>
               <p>You have been invited to join the staff team for <strong>${storeName}</strong> on LocalLook.</p>
               <a href="https://locallookph.com/dashboard">Log In or Sign Up</a>
             </div>`
    });
    
    await client.query('COMMIT');
    res.json({ message: "Invitation sent successfully!" });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.post('/api/invitations/:invite_id/accept', verifyUser, async (req, res) => {
  const client = await db.connect();
  try {
    const { invite_id } = req.params;
    const user_id = req.user.id; 
    const email = req.user.email; 

    await client.query('BEGIN');
    const inviteCheck = await client.query(`SELECT store_id, email FROM store_invitations WHERE id = $1 AND status = 'pending'`, [invite_id]);
    if (inviteCheck.rows.length === 0) throw new Error("Invalid or expired invitation.");
    if (inviteCheck.rows[0].email !== email) throw new Error("This invite was sent to a different email address.");

    await client.query(`INSERT INTO store_operators (store_id, user_id, role, status) VALUES ($1, $2, 'operator', 'confirmed') ON CONFLICT DO NOTHING`, [inviteCheck.rows[0].store_id, user_id]);
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

app.post('/api/invitations/:invite_id/decline', verifyUser, async (req, res) => {
  try {
    await db.query(`DELETE FROM store_invitations WHERE id = $1`, [req.params.invite_id]);
    res.json({ message: "Invitation declined." });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/stores/:store_id/operators', verifyUser, async (req, res) => {
  try {
    if (!(await isStoreOperator(req.params.store_id, req.user.id))) return res.status(403).json({ error: "Unauthorized." });
    
    const store_id = req.params.store_id;
    const confirmedOps = await db.query(`SELECT u.id, u.email, so.role, so.status, so.user_id FROM store_operators so JOIN users u ON so.user_id = u.id WHERE so.store_id = $1`, [store_id]);
    const pendingInvites = await db.query(`SELECT id as user_id, email, 'operator' as role, 'pending' as status FROM store_invitations WHERE store_id = $1`, [store_id]);
    res.json([...confirmedOps.rows, ...pendingInvites.rows]);
  } catch (err) { res.status(500).send("Server Error"); }
});

app.delete('/api/stores/:store_id/staff/:identifier', verifyUser, async (req, res) => {
  try {
    if (!(await isStoreOperator(req.params.store_id, req.user.id))) return res.status(403).json({ error: "Unauthorized." });
    const { store_id, identifier } = req.params;
    
    await db.query(`DELETE FROM store_operators WHERE store_id = $1 AND user_id = $2`, [store_id, identifier]);
    await db.query(`DELETE FROM store_invitations WHERE store_id = $1 AND id = $2`, [store_id, identifier]);
    res.status(200).json({ message: "Staff/Invite removed successfully." });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ---------------------------------------------------------
// 🚀 VOUCHER REDEMPTION (ACID Compliant Database Transaction)
// ---------------------------------------------------------
app.post('/api/vouchers/redeem', voucherLimiter, verifyUser, async (req, res) => {
  const client = await db.connect();
  try {
    const { store_id, voucher_code } = req.body;
    const user_id = req.user.id;

    if (!store_id || !voucher_code) {
      return res.status(400).json({ error: "Store ID and Voucher Code are required." });
    }

    const authCheck = await client.query('SELECT 1 FROM store_operators WHERE store_id = $1 AND user_id = $2', [store_id, user_id]);
    if (authCheck.rows.length === 0) {
      return res.status(403).json({ error: "Unauthorized access to store." });
    }

    await client.query('BEGIN');

    const voucherResult = await client.query(
      `SELECT * FROM vouchers WHERE code = $1 FOR UPDATE`, 
      [voucher_code.toUpperCase()]
    );

    if (voucherResult.rows.length === 0) throw new Error("Invalid voucher code.");
    const voucher = voucherResult.rows[0];

    if (voucher.max_uses && voucher.current_uses >= voucher.max_uses) {
      throw new Error("This voucher has reached its maximum usage limit.");
    }
    if (voucher.valid_until && new Date(voucher.valid_until) < new Date()) {
      throw new Error("This voucher has expired.");
    }
    
    if (voucher.discount_type !== 'free_days') {
      throw new Error("This voucher provides a payment discount. Please apply it during checkout instead of direct redemption.");
    }

    const existingRedemption = await client.query(
      `SELECT 1 FROM voucher_redemptions WHERE store_id = $1 AND voucher_id = $2`,
      [store_id, voucher.id]
    );
    if (existingRedemption.rows.length > 0) {
      throw new Error("Your store has already claimed this voucher.");
    }

    const subResult = await client.query(
      `SELECT id, plan_type, end_date FROM subscriptions WHERE store_id = $1 ORDER BY created_at DESC LIMIT 1`, 
      [store_id]
    );
    
    let newEndDate = new Date();
    const currentSub = subResult.rows[0];
    
    if (currentSub && currentSub.plan_type === 'premium' && currentSub.end_date && new Date(currentSub.end_date) > new Date()) {
      newEndDate = new Date(currentSub.end_date);
    }
    
    newEndDate.setDate(newEndDate.getDate() + Number(voucher.discount_value));

    if (currentSub) {
      await client.query(
        `UPDATE subscriptions SET plan_type = 'premium', status = 'active', end_date = $1 WHERE id = $2`,
        [newEndDate.toISOString(), currentSub.id]
      );
    } else {
      await client.query(
        `INSERT INTO subscriptions (store_id, plan_type, status, end_date) VALUES ($1, 'premium', 'active', $2)`,
        [store_id, newEndDate.toISOString()]
      );
    }

    await client.query(
      `INSERT INTO voucher_redemptions (store_id, voucher_id) VALUES ($1, $2)`,
      [store_id, voucher.id]
    );

    await client.query(
      `INSERT INTO transaction_logs (store_id, voucher_id, event_type, amount, reference_number) VALUES ($1, $2, 'VOUCHER_REDEEMED', 0, $3)`,
      [store_id, voucher.id, voucher.code]
    );

    await client.query(
      `UPDATE vouchers SET current_uses = current_uses + 1 WHERE id = $1`,
      [voucher.id]
    );

    await client.query('COMMIT');
    res.json({ message: `Success! Applied ${voucher.discount_value} free days to your account.` });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------
// 🚀 SAVED PLACES & REVIEWS (Protected IDORs)
// ---------------------------------------------------------
app.post('/api/saved-places/toggle', verifyUser, async (req, res) => {
  try {
    const { store_id } = req.body;
    const user_id = req.user.id; 
    
    const check = await db.query('SELECT id FROM saved_places WHERE store_id = $1 AND user_id = $2', [store_id, user_id]);
    if (check.rows.length > 0) {
      await db.query('DELETE FROM saved_places WHERE id = $1', [check.rows[0].id]);
      res.json({ saved: false, message: "Removed from saved places." });
    } else {
      await db.query('INSERT INTO saved_places (store_id, user_id) VALUES ($1, $2)', [store_id, user_id]);
      res.json({ saved: true, message: "Added to saved places." });
    }
  } catch (err) { res.status(500).send("Server Error"); }
});

app.post('/api/reviews', verifyUser, async (req, res) => {
  try {
    const { store_id, rating, comment } = req.body;
    const user_id = req.user.id; 
    
    if (!store_id || !rating) return res.status(400).json({ error: "Missing required fields." });

    const result = await db.query(`INSERT INTO reviews (store_id, user_id, rating, comment) VALUES ($1, $2, $3, $4) RETURNING *;`, [store_id, user_id, rating, comment]); 
    res.json(result.rows[0]);
  } catch (err) { res.status(500).send("Server Error"); }
});

// ---------------------------------------------------------
// 🚀 USER PROFILE (Protected)
// ---------------------------------------------------------
app.patch('/api/users/:id', verifyUser, async (req, res) => {
  try {
    if (req.user.id !== req.params.id) return res.status(403).json({ error: "Cannot modify another user's profile." });

    const { display_name, avatar_url } = req.body;
    const result = await db.query(`UPDATE users SET display_name = $1, avatar_url = $2 WHERE id = $3 RETURNING id, email, role, display_name, avatar_url`, [display_name, avatar_url, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).send("Server Error"); }
});

// ---------------------------------------------------------
// 🚀 PUBLIC ENDPOINTS (Read-Only)
// ---------------------------------------------------------

// 🚀 Keep-Alive Ping (Prevents Render and Supabase from sleeping)
app.get('/api/keep-awake', async (req, res) => {
  try {
    // Ultra-lightweight query to keep the DB connection and Render server awake
    await db.query('SELECT 1');
    res.status(200).json({ status: "Awake", time: new Date().toISOString() });
  } catch (err) { 
    console.error("Keep-awake error:", err);
    res.status(500).json({ status: "Error waking up" }); 
  }
});

app.get('/api/merchant/stores/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    const result = await db.query(`
      SELECT s.id, s.store_name, s.store_category, s.industry, s.description, 
             s.phone, s.email, s.website, s.is_open, s.theme_settings, 
             ST_Y(s.location::geometry) as lat, ST_X(s.location::geometry) as lng, 
             so.role, s.merchant_id, 
             s.cover_image_url, s.logo_url,
             s.auto_schedule_enabled, s.operating_hours
      FROM stores s 
      JOIN store_operators so ON s.id = so.store_id 
      WHERE so.user_id = $1 AND so.status = 'confirmed'
    `, [user_id]);
    res.json(result.rows);
  } catch (err) { 
    res.status(500).send("Server Error"); 
  }
});

app.get('/api/stores', async (req, res) => {
  try {
    const { minLng, minLat, maxLng, maxLat, userLat, userLng, radius } = req.query;
    
    // 🚀 FIXED: Added auto_schedule_enabled and operating_hours to the SELECT clause
    let selectClause = `SELECT id, store_name, store_category, industry, description, phone, email, website, is_open, theme_settings, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng, cover_image_url, logo_url, auto_schedule_enabled, operating_hours`;
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
    } else if (minLng && minLat && maxLng && maxLat) {
      whereClauses.push(`location && ST_MakeEnvelope($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, 4326)`);
      queryParams.push(minLng, minLat, maxLng, maxLat);
      paramIndex += 4;
    }

    let query = selectClause + fromClause + (whereClauses.length > 0 ? ` WHERE ` + whereClauses.join(' AND ') : '') + orderByClause;
    const result = await db.query(query, queryParams);
    res.json(result.rows);
  } catch (err) { 
    res.status(500).send("Server Error"); 
  }
});

app.get('/api/stores/:id', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, store_name, store_category, industry, description, phone, email, 
             website, is_open, theme_settings, ST_Y(location::geometry) AS lat, 
             ST_X(location::geometry) AS lng, cover_image_url, logo_url,
             auto_schedule_enabled, operating_hours
      FROM stores WHERE id = $1;
    `, [req.params.id]);
    
    if (result.rows.length === 0) return res.status(404).json({ error: "Store not found" });
    res.json(result.rows[0]);
  } catch (err) { 
    res.status(500).send("Server Error"); 
  }
});

app.get('/api/stores/:store_id/items', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM items WHERE store_id = $1 ORDER BY created_at DESC', [req.params.store_id]);
    res.json(result.rows);
  } catch (err) { res.status(500).send("Server Error"); }
});

app.get('/api/search/items', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const result = await db.query(`SELECT i.id, i.item_name, i.price, i.store_id, s.store_name FROM items i JOIN stores s ON i.store_id = s.id WHERE i.item_name ILIKE $1 OR i.item_category ILIKE $1 LIMIT 15;`, [`%${q}%`]);
    res.json(result.rows);
  } catch (err) { res.status(500).send("Server Error"); }
});

app.get('/api/stores/:store_id/reviews', async (req, res) => {
  try {
    const result = await db.query(`SELECT r.id, r.rating, r.comment, r.created_at, u.display_name, u.avatar_url FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.store_id = $1 ORDER BY r.created_at DESC;`, [req.params.store_id]);
    res.json(result.rows);
  } catch (err) { res.status(500).send("Server Error"); }
});

app.get('/api/users/:user_id/saved-places', async (req, res) => {
  try {
    const result = await db.query(`SELECT s.id, s.store_name, s.store_category, s.cover_image_url, sp.created_at FROM saved_places sp JOIN stores s ON sp.store_id = s.id WHERE sp.user_id = $1 ORDER BY sp.created_at DESC;`, [req.params.user_id]);
    res.json(result.rows);
  } catch (err) { res.status(500).send("Server Error"); }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const result = await db.query(`SELECT id, email, role, display_name, avatar_url FROM users WHERE id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).send("Server Error"); }
});

// ---------------------------------------------------------
// 🚀 PAYMONGO INTEGRATION (CRYPTOGRAPHICALLY VERIFIED & DYNAMIC PRICING)
// ---------------------------------------------------------
app.post('/api/create-checkout-session', checkoutLimiter, verifyUser, async (req, res) => {
  const client = await db.connect();
  try {
    const { store_id, voucher_code } = req.body;
    
    // 1. Fetch dynamic base pricing
    const planResult = await client.query("SELECT price FROM subscription_plans WHERE name = 'LocalLook Premium - 30 Days' LIMIT 1");
    let basePrice = 199; // Standard fallback
    
    if (planResult.rows.length > 0) {
      basePrice = parseFloat(planResult.rows[0].price);
    }
    
    let finalPrice = basePrice;
    let appliedVoucherId = null;
    let discountName = '';

    // 2. Validate and Apply Voucher Math (If Provided)
    if (voucher_code) {
      const voucherResult = await client.query(`SELECT * FROM vouchers WHERE code = $1`, [voucher_code.toUpperCase()]);
      
      if (voucherResult.rows.length === 0) {
        throw new Error("Invalid checkout promo code.");
      }
      
      const voucher = voucherResult.rows[0];
      
      if (voucher.discount_type === 'free_days') {
        throw new Error("This code is for free days. Use the 'Claim Free Days' button instead of the checkout form.");
      }
      if (voucher.max_uses && voucher.current_uses >= voucher.max_uses) {
        throw new Error("This voucher has reached its maximum usage limit.");
      }
      if (voucher.valid_until && new Date(voucher.valid_until) < new Date()) {
        throw new Error("This voucher has expired.");
      }

      const existingRedemption = await client.query(
        `SELECT 1 FROM voucher_redemptions WHERE store_id = $1 AND voucher_id = $2`,
        [store_id, voucher.id]
      );
      
      if (existingRedemption.rows.length > 0) {
        throw new Error("Your store has already claimed this voucher.");
      }

      if (voucher.discount_type === 'percentage') {
        finalPrice = basePrice - (basePrice * (parseFloat(voucher.discount_value) / 100));
        discountName = ` (${voucher.discount_value}% OFF)`;
      } else if (voucher.discount_type === 'fixed') {
        finalPrice = basePrice - parseFloat(voucher.discount_value);
        discountName = ` (₱${voucher.discount_value} OFF)`;
      }

      // 3. Absolute Floor Limit: PayMongo API restricts checkouts below ₱20
      if (finalPrice < 20) {
        finalPrice = 20; 
      }
      
      appliedVoucherId = voucher.id;
    }

    // 4. Pack the Reference Number (Format: storeId|voucherId)
    const amountInCentavos = Math.round(finalPrice * 100);
    const refNumber = appliedVoucherId ? `${store_id}|${appliedVoucherId}` : store_id;

    const secretKey = process.env.PAYMONGO_SECRET_KEY;
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
            send_email_receipt: true, show_description: true, show_line_items: true,
            line_items: [{ currency: 'PHP', amount: amountInCentavos, name: `LocalLook Premium Plan - 30 Days${discountName}`, quantity: 1 }],
            payment_method_types: ['gcash', 'paymaya', 'grab_pay', 'card'],
            reference_number: refNumber, 
            success_url: 'https://locallookph.com/dashboard?payment=success',
            cancel_url: 'https://locallookph.com/dashboard?payment=cancelled'
          }
        }
      })
    };
    
    const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', options);
    const data = await response.json();
    if (data.errors) throw new Error(data.errors[0].detail);
    res.json({ checkoutUrl: data.data.attributes.checkout_url });

  } catch (error) { 
    res.status(400).json({ error: error.message || 'Failed to create payment session.' }); 
  } finally {
    client.release();
  }
});

app.post('/api/webhooks/paymongo', async (req, res) => {
  try {
    const signatureHeader = req.headers['paymongo-signature'];
    const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET; 

    if (!signatureHeader || !webhookSecret) {
      console.warn("⚠️ Webhook missing signature or secret is not configured.");
      return res.status(400).send("Bad Request");
    }

    const signatureParts = signatureHeader.split(',').reduce((acc, part) => {
      const [key, value] = part.split('=');
      acc[key] = value;
      return acc;
    }, {});

    const timestamp = signatureParts.t;
    const signature = process.env.NODE_ENV === 'production' ? signatureParts.li : signatureParts.te; 

    if (!timestamp || !signature) {
      return res.status(400).send("Invalid signature format");
    }

    const signaturePayload = `${timestamp}.${JSON.stringify(req.body)}`;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(signaturePayload)
      .digest('hex');

    if (crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))) {
      const eventType = req.body?.data?.attributes?.type;
      
      if (eventType === 'checkout_session.payment.paid') {
        const rawRef = req.body?.data?.attributes?.data?.attributes?.reference_number;
        const amountPaid = req.body?.data?.attributes?.data?.attributes?.amount / 100; // Convert back to PHP from centavos
        
        if (rawRef) {
          // Unpack the metadata mapping (storeId|voucherId)
          const parts = rawRef.split('|');
          const storeId = parts[0];
          const voucherId = parts[1] || null;

          const thirtyDaysFromNow = new Date();
          thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
          
          // 1. Grant Premium Subscription
          const subCheck = await db.query(`SELECT id FROM subscriptions WHERE store_id = $1 LIMIT 1`, [storeId]);
          if (subCheck.rows.length > 0) {
             await db.query(`UPDATE subscriptions SET plan_type = 'premium', status = 'active', end_date = $1 WHERE store_id = $2`, [thirtyDaysFromNow.toISOString(), storeId]);
          } else {
             await db.query(`INSERT INTO subscriptions (store_id, plan_type, status, end_date) VALUES ($1, 'premium', 'active', $2)`, [storeId, thirtyDaysFromNow.toISOString()]);
          }
          
          // 2. Consume Voucher & Log Transaction
          if (voucherId) {
            await db.query(`INSERT INTO voucher_redemptions (store_id, voucher_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [storeId, voucherId]);
            await db.query(`UPDATE vouchers SET current_uses = current_uses + 1 WHERE id = $1`, [voucherId]);
            await db.query(`INSERT INTO transaction_logs (store_id, voucher_id, event_type, amount, reference_number) VALUES ($1, $2, 'VOUCHER_REDEEMED_PAYMENT', $3, $4)`, [storeId, voucherId, amountPaid, rawRef]);
          } else {
            await db.query(`INSERT INTO transaction_logs (store_id, event_type, amount, reference_number) VALUES ($1, 'PAYMENT_SUCCESS', $2, $3)`, [storeId, amountPaid, rawRef]);
          }
        }
      }
      
      return res.status(200).send("Webhook Received & Verified");
      
    } else {
      console.error("🚨 Webhook signature mismatch. Possible spoofing attempt.");
      return res.status(401).send("Unauthorized");
    }

  } catch (err) { 
    console.error("Webhook processing error:", err);
    res.status(500).send("Internal Server Error"); 
  }
});

const cron = require('node-cron');

// ---------------------------------------------------------
// 🚀 AUTOMATED STORE SCHEDULER (Runs every 1 minute)
// ---------------------------------------------------------
cron.schedule('* * * * *', async () => {
  try {
    // 1. Get the current time exactly in Philippine Standard Time (PHT)
    const options = { timeZone: 'Asia/Manila', hour12: false };
    const now = new Date();
    
    // Format: "Monday"
    const currentDay = new Intl.DateTimeFormat('en-US', { ...options, weekday: 'long' }).format(now);
    
    // Format: "14:30" (HH:MM)
    const currentHour = new Intl.DateTimeFormat('en-US', { ...options, hour: '2-digit' }).format(now);
    const currentMinute = new Intl.DateTimeFormat('en-US', { ...options, minute: '2-digit' }).format(now);
    const currentTime = `${currentHour.padStart(2, '0')}:${currentMinute.padStart(2, '0')}`;

    // 2. Fetch all stores that have automation turned ON
    const { rows: stores } = await db.query(`
      SELECT id, is_open, operating_hours 
      FROM stores 
      WHERE auto_schedule_enabled = true
    `);

    for (const store of stores) {
      if (!store.operating_hours) continue;

      const todaySchedule = store.operating_hours[currentDay];
      let shouldBeOpen = false;

      // 3. Evaluate if the store should be open right now
      if (todaySchedule && todaySchedule.isOpen) {
        if (currentTime >= todaySchedule.open && currentTime < todaySchedule.close) {
          shouldBeOpen = true;
        }
      }

      // 4. If the database status doesn't match reality, flip the switch!
      if (store.is_open !== shouldBeOpen) {
        console.log(`[Auto-Scheduler] Switching ${store.id} is_open to ${shouldBeOpen}`);
        await db.query('UPDATE stores SET is_open = $1 WHERE id = $2', [shouldBeOpen, store.id]);
      }
    }
  } catch (error) {
    console.error("[Auto-Scheduler Error]:", error);
  }
});

app.listen(PORT, () => { console.log(`Server is running securely on http://localhost:${PORT}`); });