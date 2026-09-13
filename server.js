const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const config = require('./config');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

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
    phone: m.phone,
    visits: m.visits,
    cycle: m.cycle,
    totalVisits: m.totalVisits,
    redeemed: m.redeemed
  };
}

// ---------------- Customer ----------------

app.post('/api/customer/signup', (req, res) => {
  const { name, password, phone } = req.body || {};
  const cleanName = String(name || '').trim();
  if(!cleanName || !password){
    return res.status(400).json({ error: 'Name and password are required' });
  }
  const exists = Object.values(db.data.members).some(m => m.name.toLowerCase() === cleanName.toLowerCase());
  if(exists){
    return res.status(409).json({ error: 'That name already has a card — try logging in instead' });
  }
  const cardNumber = 'KY-' + String(db.data.nextCardNum++).padStart(4, '0');
  const member = {
    cardNumber,
    name: cleanName,
    passwordHash: bcrypt.hashSync(password, 10),
    phone: String(phone || '').trim(),
    visits: 0,
    cycle: 10,
    totalVisits: 0,
    redeemed: []
  };
  db.data.members[cardNumber] = member;
  logActivity('card_created', cardNumber, '');
  db.save();
  const token = sign({ role: 'customer', cardNumber });
  res.status(201).json({ token, member: publicMember(member) });
});

app.post('/api/customer/login', (req, res) => {
  const { name, password } = req.body || {};
  const member = Object.values(db.data.members).find(
    m => m.name.toLowerCase() === String(name || '').trim().toLowerCase()
  );
  if(!member || !bcrypt.compareSync(String(password || ''), member.passwordHash)){
    return res.status(401).json({ error: 'Name or password not recognized' });
  }
  const token = sign({ role: 'customer', cardNumber: member.cardNumber });
  res.json({ token, member: publicMember(member) });
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

app.listen(config.PORT, () => {
  const url = `http://localhost:${config.PORT}`;
  console.log(`Kaya Lounge server running at ${url}`);
  console.log('Opening it in your browser now... (if nothing opens, just visit the address above yourself)');

  const openCommand = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}"`;
  require('child_process').exec(openCommand, () => {});
});
