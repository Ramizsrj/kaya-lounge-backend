const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const config = require('./config');
const email = require('./email');

const app = express();

// The native app (and any other site) loads this page from a different
// origin than this server, so without these headers the browser/WebView
// silently blocks every request as a CORS violation — that's what was
// causing "Can't reach the app's server" even though the server was up.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

function sign(payload){
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: '90d' });
}

function auth(role){
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if(!token) return res.status(401).json({ error: 'Missing token' });
    try{
      const payload = jwt.verify(token, config.JWT_SECRET);
      if(payload.role !== role) return res.status(403).json({ error: 'Wrong account type' });
      req.auth = payload;
      next();
    }catch(e){
      return res.status(401).json({ error: 'Session expired, please log in again' });
    }
  };
}

function logActivity(action, cardNumber, staffName, detail){
  const member = db.data.members[cardNumber];
  db.data.activity.unshift({
    ts: Date.now(),
    action,
    cardNumber,
    memberName: member ? member.name : '',
    staffName: staffName || '',
    detail: detail || ''
  });
}

function publicMember(m){
  return {
    cardNumber: m.cardNumber,
    name: m.name,
    email: m.email || '',
    phone: m.phone,
    visits: m.visits,
    cycle: m.cycle,
    totalVisits: m.totalVisits,
    redeemed: m.redeemed
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------- Customer ----------------

app.post('/api/customer/signup', async (req, res) => {
  const { name, email: emailInput, password, phone } = req.body || {};
  const cleanName = String(name || '').trim();
  const cleanEmail = String(emailInput || '').trim().toLowerCase();
  if(!cleanName || !password){
    return res.status(400).json({ error: 'Name and password are required' });
  }
  if(!cleanEmail || !EMAIL_RE.test(cleanEmail)){
    return res.status(400).json({ error: 'A valid email is required' });
  }
  const nameTaken = Object.values(db.data.members).some(m => m.name.toLowerCase() === cleanName.toLowerCase());
  if(nameTaken){
    return res.status(409).json({ error: 'That name already has a card — try logging in instead' });
  }
  const emailTaken = Object.values(db.data.members).some(m => m.email && m.email.toLowerCase() === cleanEmail);
  if(emailTaken){
    return res.status(409).json({ error: 'That email is already registered — try logging in instead' });
  }
  const cardNumber = 'KY-' + String(db.data.nextCardNum++).padStart(4, '0');
  const code = email.generateCode();
  const member = {
    cardNumber,
    name: cleanName,
    email: cleanEmail,
    passwordHash: bcrypt.hashSync(password, 10),
    phone: String(phone || '').trim(),
    visits: 0,
    cycle: 10,
    totalVisits: 0,
    redeemed: [],
    emailVerified: false,
    verificationCode: code,
    verificationExpiry: Date.now() + 15 * 60 * 1000
  };
  db.data.members[cardNumber] = member;
  logActivity('card_created', cardNumber, '');
  db.save();
  await email.sendVerificationEmail(cleanEmail, code);
  res.status(201).json({ pendingVerification: true, cardNumber, email: cleanEmail });
});

app.post('/api/customer/verify-email', (req, res) => {
  const { cardNumber, code } = req.body || {};
  const member = db.data.members[String(cardNumber || '').toUpperCase()];
  if(!member) return res.status(404).json({ error: 'Card not found' });
  if(member.emailVerified){
    const token = sign({ role: 'customer', cardNumber: member.cardNumber });
    return res.json({ token, member: publicMember(member) });
  }
  if(!member.verificationCode || member.verificationCode !== String(code || '').trim() || Date.now() > member.verificationExpiry){
    return res.status(400).json({ error: 'That code is incorrect or has expired' });
  }
  member.emailVerified = true;
  member.verificationCode = null;
  member.verificationExpiry = null;
  db.save();
  const token = sign({ role: 'customer', cardNumber: member.cardNumber });
  res.json({ token, member: publicMember(member) });
});

app.post('/api/customer/resend-verification', async (req, res) => {
  const { cardNumber } = req.body || {};
  const member = db.data.members[String(cardNumber || '').toUpperCase()];
  if(!member) return res.status(404).json({ error: 'Card not found' });
  if(member.emailVerified) return res.status(400).json({ error: 'This email is already verified' });
  const code = email.generateCode();
  member.verificationCode = code;
  member.verificationExpiry = Date.now() + 15 * 60 * 1000;
  db.save();
  await email.sendVerificationEmail(member.email, code);
  res.json({ sent: true });
});

app.post('/api/customer/login', (req, res) => {
  const { identifier, password } = req.body || {};
  const clean = String(identifier || '').trim().toLowerCase();
  const member = Object.values(db.data.members).find(
    m => m.name.toLowerCase() === clean || (m.email && m.email.toLowerCase() === clean)
  );
  if(!member || !bcrypt.compareSync(String(password || ''), member.passwordHash)){
    return res.status(401).json({ error: 'Name/email or password not recognized' });
  }
  if(member.emailVerified === false){
    return res.status(403).json({ error: 'Please verify your email before logging in', needsVerification: true, cardNumber: member.cardNumber });
  }
  const token = sign({ role: 'customer', cardNumber: member.cardNumber });
  res.json({ token, member: publicMember(member) });
});

app.post('/api/customer/forgot-password', async (req, res) => {
  const { email: emailInput } = req.body || {};
  const cleanEmail = String(emailInput || '').trim().toLowerCase();
  const member = Object.values(db.data.members).find(m => m.email && m.email.toLowerCase() === cleanEmail);
  // Always respond the same way whether or not the email exists, so this
  // endpoint can't be used to check who has an account.
  if(member){
    const code = email.generateCode();
    member.resetCode = code;
    member.resetExpiry = Date.now() + 15 * 60 * 1000;
    db.save();
    await email.sendPasswordResetEmail(member.email, code);
  }
  res.json({ sent: true });
});

app.post('/api/customer/reset-password', (req, res) => {
  const { email: emailInput, code, newPassword } = req.body || {};
  const cleanEmail = String(emailInput || '').trim().toLowerCase();
  const member = Object.values(db.data.members).find(m => m.email && m.email.toLowerCase() === cleanEmail);
  if(!member || !member.resetCode || member.resetCode !== String(code || '').trim() || Date.now() > member.resetExpiry){
    return res.status(400).json({ error: 'That code is incorrect or has expired' });
  }
  if(!newPassword || String(newPassword).length < 4){
    return res.status(400).json({ error: 'Choose a password at least 4 characters long' });
  }
  member.passwordHash = bcrypt.hashSync(String(newPassword), 10);
  member.resetCode = null;
  member.resetExpiry = null;
  db.save();
  res.json({ ok: true });
});

app.get('/api/customer/me', auth('customer'), (req, res) => {
  const member = db.data.members[req.auth.cardNumber];
  if(!member) return res.status(404).json({ error: 'Card not found' });
  res.json({ member: publicMember(member) });
});

// ---------------- Rewards (public read) ----------------

app.get('/api/rewards', (req, res) => {
  res.json(db.data.rewards);
});

app.get('/api/announcement', (req, res) => {
  res.json(db.data.announcement || null);
});

app.get('/api/popups', (req, res) => {
  res.json(db.data.popupNotifications);
});

// ---------------- Menu (public read) ----------------

app.get('/api/menu', (req, res) => {
  const { category } = req.query;
  let items = db.data.menuItems.filter(i => i.available);
  if(category) items = items.filter(i => i.category === category);
  res.json(items);
});

app.get('/api/menu/categories', (req, res) => {
  const order = ['Food', 'Drinks', 'Shisha'];
  const present = new Set(db.data.menuItems.filter(i => i.available).map(i => i.category));
  const categories = [...order.filter(c => present.has(c)), ...[...present].filter(c => !order.includes(c))];
  res.json(categories);
});

// ---------------- Orders (customer) ----------------
// No online payment gateways are wired up — every order is "pay in cash at
// the counter/table", so no merchant credentials are needed for this to work.

app.post('/api/orders', auth('customer'), (req, res) => {
  const { tableNumber, items, notes, promoCode } = req.body || {};
  if(!Array.isArray(items) || items.length === 0){
    return res.status(400).json({ error: 'Add at least one item to your order' });
  }

  // Look up real prices server-side (never trust prices sent from the app)
  let subtotal = 0;
  const resolvedItems = [];
  for(const item of items){
    const menuItem = db.data.menuItems.find(m => m.id === item.menuItemId && m.available);
    if(!menuItem) return res.status(400).json({ error: 'One of the items in your cart is no longer available' });
    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
    subtotal += menuItem.price * qty;
    resolvedItems.push({ menuItemId: menuItem.id, name: menuItem.name, price: menuItem.price, quantity: qty });
  }

  let discount = 0;
  let appliedCode = null;
  if(promoCode){
    const promo = db.data.promoCodes.find(p => p.code === String(promoCode).toUpperCase() && p.active);
    if(!promo) return res.status(400).json({ error: 'Invalid or expired promo code' });
    discount = Math.round(subtotal * (promo.discountPercent / 100));
    appliedCode = promo.code;
  }
  const total = subtotal - discount;

  const order = {
    id: db.data.nextOrderId++,
    cardNumber: req.auth.cardNumber,
    tableNumber: tableNumber ? String(tableNumber).trim() : null,
    items: resolvedItems,
    subtotal, discount, promoCode: appliedCode, total,
    notes: notes ? String(notes).trim() : '',
    status: 'placed',
    paymentMethod: 'cod',
    rating: null,
    createdAt: Date.now()
  };
  db.data.orders.unshift(order);
  db.save();
  res.status(201).json({ order, message: 'Pay in cash at the counter when your order arrives.' });
});

app.get('/api/orders', auth('customer'), (req, res) => {
  const orders = db.data.orders.filter(o => o.cardNumber === req.auth.cardNumber);
  res.json(orders);
});

app.get('/api/orders/:id', auth('customer'), (req, res) => {
  const order = db.data.orders.find(o => o.id === parseInt(req.params.id, 10) && o.cardNumber === req.auth.cardNumber);
  if(!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

app.post('/api/orders/:id/rating', auth('customer'), (req, res) => {
  const value = parseInt(req.body && req.body.rating, 10);
  if(!Number.isInteger(value) || value < 1 || value > 5){
    return res.status(400).json({ error: 'Rating must be an integer from 1 to 5' });
  }
  const order = db.data.orders.find(o => o.id === parseInt(req.params.id, 10) && o.cardNumber === req.auth.cardNumber);
  if(!order) return res.status(404).json({ error: 'Order not found' });
  order.rating = value;
  db.save();
  res.json({ ok: true });
});

// ---------------- Table service requests ----------------
// Calling a waiter or asking for the bill mirrors pressing a physical call
// button at the table — no customer login required for this one.

app.post('/api/service', (req, res) => {
  const { tableNumber, type } = req.body || {};
  const validTypes = ['waiter', 'bill'];
  if(!tableNumber || !validTypes.includes(type)){
    return res.status(400).json({ error: 'Table number and a valid request type are required' });
  }
  const request = {
    id: db.data.nextServiceId++,
    tableNumber: String(tableNumber).trim(),
    type,
    status: 'pending',
    createdAt: Date.now()
  };
  db.data.serviceRequests.unshift(request);
  db.save();
  res.status(201).json({ ok: true, id: request.id });
});

// ---------------- Staff ----------------

app.post('/api/staff/login', (req, res) => {
  const { name, pin } = req.body || {};
  const found = db.data.staff.find(
    s => s.pin === pin && s.name.toLowerCase() === String(name || '').trim().toLowerCase()
  );
  if(!found) return res.status(401).json({ error: 'Name or PIN not recognized' });
  const token = sign({ role: 'staff', staffName: found.name });
  res.json({ token, staffName: found.name });
});

app.get('/api/staff/members/:cardNumber', auth('staff'), (req, res) => {
  const cardNumber = req.params.cardNumber.toUpperCase();
  const member = db.data.members[cardNumber];
  if(!member) return res.status(404).json({ error: 'No card found with that number' });
  logActivity('scan', cardNumber, req.auth.staffName);
  db.save();
  res.json({ member: publicMember(member) });
});

app.post('/api/staff/members/:cardNumber/stamp', auth('staff'), (req, res) => {
  const cardNumber = req.params.cardNumber.toUpperCase();
  const member = db.data.members[cardNumber];
  if(!member) return res.status(404).json({ error: 'No card found with that number' });
  const delta = req.body && req.body.delta === -1 ? -1 : 1;
  if(delta === 1){
    member.visits = Math.min(member.cycle, member.visits + 1);
    member.totalVisits += 1;
    logActivity('stamp_added', cardNumber, req.auth.staffName);
  }else{
    member.visits = Math.max(0, member.visits - 1);
    logActivity('stamp_removed', cardNumber, req.auth.staffName);
  }
  db.save();
  res.json({ member: publicMember(member) });
});

app.post('/api/staff/members/:cardNumber/redeem', auth('staff'), (req, res) => {
  const cardNumber = req.params.cardNumber.toUpperCase();
  const member = db.data.members[cardNumber];
  if(!member) return res.status(404).json({ error: 'No card found with that number' });
  const stamps = Number(req.body && req.body.stamps);
  const reward = db.data.rewards.find(r => r.stamps === stamps);
  if(!reward) return res.status(400).json({ error: 'Unknown reward' });
  if(member.visits < reward.stamps) return res.status(400).json({ error: 'Not enough stamps yet' });
  member.visits = 0;
  member.redeemed.push({ stamps: reward.stamps, label: reward.label, ts: Date.now() });
  logActivity('reward_redeemed', cardNumber, req.auth.staffName, reward.label);
  db.save();
  res.json({ member: publicMember(member) });
});

app.post('/api/staff/rewards', auth('staff'), (req, res) => {
  const stamps = parseInt(req.body && req.body.stamps, 10);
  const label = String((req.body && req.body.label) || '').trim();
  if(!stamps || stamps < 1 || !label){
    return res.status(400).json({ error: 'Stamps and a reward label are required' });
  }
  const reward = { id: db.data.nextRewardId++, stamps, label };
  db.data.rewards.push(reward);
  db.save();
  res.status(201).json(reward);
});

app.delete('/api/staff/rewards/:id', auth('staff'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.data.rewards = db.data.rewards.filter(r => r.id !== id);
  db.save();
  res.status(204).end();
});

// Staff: live order board (kitchen/floor view)
app.get('/api/staff/orders', auth('staff'), (req, res) => {
  const active = db.data.orders.filter(o => ['placed', 'preparing', 'ready'].includes(o.status));
  res.json(active);
});

app.patch('/api/staff/orders/:id/status', auth('staff'), (req, res) => {
  const validStatuses = ['placed', 'preparing', 'ready', 'served', 'cancelled'];
  const { status } = req.body || {};
  if(!validStatuses.includes(status)){
    return res.status(400).json({ error: `status must be one of ${validStatuses.join(', ')}` });
  }
  const order = db.data.orders.find(o => o.id === parseInt(req.params.id, 10));
  if(!order) return res.status(404).json({ error: 'Order not found' });
  order.status = status;
  db.save();
  res.json({ ok: true, status });
});

// Staff: pending table-service requests
app.get('/api/staff/service', auth('staff'), (req, res) => {
  res.json(db.data.serviceRequests.filter(r => r.status === 'pending'));
});

app.patch('/api/staff/service/:id', auth('staff'), (req, res) => {
  const request = db.data.serviceRequests.find(r => r.id === parseInt(req.params.id, 10));
  if(!request) return res.status(404).json({ error: 'Request not found' });
  request.status = 'resolved';
  db.save();
  res.json({ ok: true });
});

// ---------------- Admin ----------------

app.post('/api/admin/login', (req, res) => {
  const { pin } = req.body || {};
  if(pin !== config.ADMIN_PIN) return res.status(401).json({ error: 'Incorrect PIN, try again' });
  const token = sign({ role: 'admin' });
  res.json({ token });
});

app.get('/api/admin/stats', auth('admin'), (req, res) => {
  const activity = db.data.activity;
  const scans = activity.filter(a => a.action === 'scan').length;
  const stampsGiven = activity.filter(a => a.action === 'stamp_added').length;
  const redemptions = activity.filter(a => a.action === 'reward_redeemed').length;
  const memberCount = Object.keys(db.data.members).length;

  const byStaff = {};
  activity.forEach(a => {
    if(!a.staffName) return;
    byStaff[a.staffName] = byStaff[a.staffName] || { name: a.staffName, scans: 0, stamps: 0, redemptions: 0 };
    if(a.action === 'scan') byStaff[a.staffName].scans++;
    if(a.action === 'stamp_added') byStaff[a.staffName].stamps++;
    if(a.action === 'reward_redeemed') byStaff[a.staffName].redemptions++;
  });

  res.json({
    memberCount,
    scans,
    stampsGiven,
    redemptions,
    byStaff: Object.values(byStaff),
    activity: activity.slice(0, 30)
  });
});

app.get('/api/admin/staff', auth('admin'), (req, res) => {
  res.json(db.data.staff.map(s => ({ name: s.name })));
});

app.post('/api/admin/staff', auth('admin'), (req, res) => {
  const name = String((req.body && req.body.name) || '').trim();
  const pin = String((req.body && req.body.pin) || '').trim();
  if(!name || !pin){
    return res.status(400).json({ error: 'Name and PIN are required' });
  }
  const exists = db.data.staff.some(s => s.name.toLowerCase() === name.toLowerCase());
  if(exists){
    return res.status(409).json({ error: 'A staff member with that name already exists' });
  }
  db.data.staff.push({ name, pin });
  db.save();
  res.status(201).json({ name });
});

app.delete('/api/admin/staff/:name', auth('admin'), (req, res) => {
  const name = decodeURIComponent(req.params.name);
  db.data.staff = db.data.staff.filter(s => s.name.toLowerCase() !== name.toLowerCase());
  db.save();
  res.status(204).end();
});

app.patch('/api/admin/staff/:name/pin', auth('admin'), (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const pin = String((req.body && req.body.pin) || '').trim();
  if(!pin) return res.status(400).json({ error: 'A new PIN is required' });
  const staffMember = db.data.staff.find(s => s.name.toLowerCase() === name.toLowerCase());
  if(!staffMember) return res.status(404).json({ error: 'Staff member not found' });
  staffMember.pin = pin;
  db.save();
  res.json({ ok: true });
});

// ---------------- Admin: menu management ----------------

app.get('/api/admin/menu', auth('admin'), (req, res) => {
  res.json(db.data.menuItems);
});

app.post('/api/admin/menu', auth('admin'), (req, res) => {
  const name = String((req.body && req.body.name) || '').trim();
  const description = String((req.body && req.body.description) || '').trim();
  const price = parseFloat(req.body && req.body.price);
  const category = String((req.body && req.body.category) || '').trim();
  if(!name || !price || price <= 0 || !category){
    return res.status(400).json({ error: 'Name, price, and category are required' });
  }
  const item = { id: db.data.nextMenuItemId++, name, description, price, category, available: true };
  db.data.menuItems.push(item);
  db.save();
  res.status(201).json(item);
});

app.patch('/api/admin/menu/:id', auth('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = db.data.menuItems.find(i => i.id === id);
  if(!item) return res.status(404).json({ error: 'Menu item not found' });
  const body = req.body || {};
  if(body.name !== undefined) item.name = String(body.name).trim();
  if(body.description !== undefined) item.description = String(body.description).trim();
  if(body.price !== undefined) item.price = parseFloat(body.price);
  if(body.category !== undefined) item.category = String(body.category).trim();
  if(body.available !== undefined) item.available = !!body.available;
  db.save();
  res.json(item);
});

app.delete('/api/admin/menu/:id', auth('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.data.menuItems = db.data.menuItems.filter(i => i.id !== id);
  db.save();
  res.status(204).end();
});

// ---------------- Admin: customer announcements ----------------
// A single active message shown to every customer (banner on the wallet
// screen) — used for promotions, reminders, or general updates.

app.post('/api/admin/announcement', auth('admin'), (req, res) => {
  const message = String((req.body && req.body.message) || '').trim();
  if(!message) return res.status(400).json({ error: 'Message is required' });
  db.data.announcement = { message, ts: Date.now() };
  db.save();
  res.json(db.data.announcement);
});

app.delete('/api/admin/announcement', auth('admin'), (req, res) => {
  db.data.announcement = null;
  db.save();
  res.status(204).end();
});

// ---------------- Admin: scheduled popup reminders ----------------

app.post('/api/admin/popups', auth('admin'), (req, res) => {
  const time = String((req.body && req.body.time) || '').trim();
  const message = String((req.body && req.body.message) || '').trim();
  if(!/^\d{2}:\d{2}$/.test(time) || !message){
    return res.status(400).json({ error: 'A valid time and a message are required' });
  }
  const popup = { id: db.data.nextPopupId++, time, message };
  db.data.popupNotifications.push(popup);
  db.save();
  res.status(201).json(popup);
});

app.delete('/api/admin/popups/:id', auth('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.data.popupNotifications = db.data.popupNotifications.filter(p => p.id !== id);
  db.save();
  res.status(204).end();
});

app.post('/api/admin/members/:cardNumber/reset-password', auth('admin'), (req, res) => {
  const cardNumber = req.params.cardNumber.toUpperCase();
  const member = db.data.members[cardNumber];
  if(!member) return res.status(404).json({ error: 'No card found with that number' });
  const password = String((req.body && req.body.password) || '').trim();
  if(!password || password.length < 4) return res.status(400).json({ error: 'New password must be at least 4 characters' });
  member.passwordHash = bcrypt.hashSync(password, 10);
  logActivity('password_reset', cardNumber, 'admin');
  db.save();
  res.json({ ok: true, name: member.name });
});

db.ready().then(() => {
  app.listen(config.PORT, () => {
    const url = `http://localhost:${config.PORT}`;
    console.log(`Kaya Lounge server running at ${url}`);
    console.log('Opening it in your browser now... (if nothing opens, just visit the address above yourself)');

    const openCommand = process.platform === 'win32' ? `start "" "${url}"`
      : process.platform === 'darwin' ? `open "${url}"`
      : `xdg-open "${url}"`;
    require('child_process').exec(openCommand, () => {});
  });
});
