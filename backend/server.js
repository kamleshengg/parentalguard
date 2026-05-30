const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ─── In-Memory Database (Production: use PostgreSQL/MongoDB) ───
const db = {
  users: [],           // parent accounts
  children: [],        // child device registrations
  locations: [],       // GPS location history
  appUsage: [],        // app usage reports
  alerts: [],          // security alerts
  sessions: [],        // auth sessions
  screenTime: [],      // screen time logs
  contacts: [],        // synced contacts
  webActivity: [],     // browser activity
  messages: [],        // monitored messages (with consent)
};

// ─── Seed demo data ───
const demoParentId = 'parent-001';
const demoChildId  = 'child-001';
db.users.push({
  id: demoParentId,
  email: 'parent@demo.com',
  password: '$2b$10$demo_hashed_password',  // "demo1234"
  name: 'Ahmed Al-Rashid',
  plan: 'premium',
  createdAt: new Date().toISOString(),
  children: [demoChildId],
});
db.children.push({
  id: demoChildId,
  parentId: demoParentId,
  name: "Sara",
  age: 12,
  deviceName: "Samsung Galaxy A54",
  deviceId: "device-samsung-001",
  consentGiven: true,
  consentDate: new Date().toISOString(),
  isOnline: true,
  lastSeen: new Date().toISOString(),
  batteryLevel: 78,
  settings: {
    locationTracking: true,
    appMonitoring: true,
    webFiltering: true,
    screenTimeLimit: 180,
    contactsAccess: true,
    messageMonitoring: false,
  }
});

// Seed location history
const locations = [
  { lat: 25.2048, lng: 55.2708, label: 'Home', time: new Date(Date.now() - 3600000) },
  { lat: 25.1972, lng: 55.2796, label: 'School', time: new Date(Date.now() - 7200000) },
  { lat: 25.2085, lng: 55.2765, label: 'Mall', time: new Date(Date.now() - 1800000) },
  { lat: 25.2048, lng: 55.2708, label: 'Home', time: new Date() },
];
locations.forEach((l, i) => db.locations.push({ id: `loc-${i}`, childId: demoChildId, ...l }));

// Seed app usage
const apps = [
  { name: 'YouTube', icon: '▶️', minutes: 95, category: 'Entertainment', safe: true },
  { name: 'WhatsApp', icon: '💬', minutes: 45, category: 'Social', safe: true },
  { name: 'TikTok', icon: '🎵', minutes: 72, category: 'Social', safe: false },
  { name: 'Snapchat', icon: '👻', minutes: 38, category: 'Social', safe: true },
  { name: 'Chrome', icon: '🌐', minutes: 30, category: 'Browser', safe: true },
  { name: 'Instagram', icon: '📷', minutes: 55, category: 'Social', safe: true },
  { name: 'Games', icon: '🎮', minutes: 25, category: 'Gaming', safe: true },
];
apps.forEach((a, i) => db.appUsage.push({ id: `app-${i}`, childId: demoChildId, date: new Date().toISOString(), ...a }));

// Seed alerts
db.alerts.push(
  { id: 'alert-1', childId: demoChildId, type: 'location', severity: 'info', message: 'Sara arrived at School', time: new Date(Date.now() - 7200000).toISOString(), read: true },
  { id: 'alert-2', childId: demoChildId, type: 'app', severity: 'warning', message: 'TikTok used for 72 minutes today — exceeds limit', time: new Date(Date.now() - 3600000).toISOString(), read: false },
  { id: 'alert-3', childId: demoChildId, type: 'web', severity: 'danger', message: 'Blocked access to inappropriate content', time: new Date(Date.now() - 1200000).toISOString(), read: false },
  { id: 'alert-4', childId: demoChildId, type: 'screen', severity: 'info', message: 'Screen time limit (3h) reached', time: new Date(Date.now() - 600000).toISOString(), read: false }
);

// ─── Auth helper ───
function generateToken(userId) {
  return crypto.randomBytes(32).toString('hex') + '.' + userId;
}
function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  return parts.length === 2 ? parts[1] : null;
}
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const userId = verifyToken(token);
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.user = user;
  next();
}

// ─── Middleware ───
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Serve static files ───
app.use(express.static(path.join(__dirname, '../parent-dashboard')));
app.use('/child', express.static(path.join(__dirname, '../child-app')));

// ═══════════════════════════════════════
//  AUTH ROUTES
// ═══════════════════════════════════════
app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body;
  if (db.users.find(u => u.email === email))
    return res.status(400).json({ error: 'Email already registered' });
  const user = {
    id: 'parent-' + Date.now(),
    email, password, name,
    plan: 'free',
    createdAt: new Date().toISOString(),
    children: [],
  };
  db.users.push(user);
  const token = generateToken(user.id);
  res.json({ token, user: { id: user.id, email, name, plan: user.plan } });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  // Demo login
  if (email === 'parent@demo.com' && password === 'demo1234') {
    const user = db.users.find(u => u.email === email);
    const token = generateToken(user.id);
    return res.json({ token, user: { id: user.id, email: user.email, name: user.name, plan: user.plan } });
  }
  const user = db.users.find(u => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const token = generateToken(user.id);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, plan: user.plan } });
});

// ═══════════════════════════════════════
//  DASHBOARD ROUTES
// ═══════════════════════════════════════
app.get('/api/dashboard/overview', authMiddleware, (req, res) => {
  const children = db.children.filter(c => c.parentId === req.user.id);
  const unreadAlerts = db.alerts.filter(a =>
    children.some(c => c.id === a.childId) && !a.read
  ).length;
  res.json({ children, unreadAlerts, alerts: db.alerts.slice(-10).reverse() });
});

app.get('/api/children', authMiddleware, (req, res) => {
  const children = db.children.filter(c => c.parentId === req.user.id);
  res.json(children);
});

app.post('/api/children/register', authMiddleware, (req, res) => {
  const { name, age, deviceName } = req.body;
  const pairingCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const child = {
    id: 'child-' + Date.now(),
    parentId: req.user.id,
    name, age, deviceName,
    pairingCode,
    consentGiven: false,
    isOnline: false,
    batteryLevel: 0,
    lastSeen: null,
    settings: {
      locationTracking: true,
      appMonitoring: true,
      webFiltering: true,
      screenTimeLimit: 120,
      contactsAccess: false,
      messageMonitoring: false,
    }
  };
  db.children.push(child);
  req.user.children.push(child.id);
  res.json({ child, pairingCode });
});

// ═══════════════════════════════════════
//  LOCATION ROUTES
// ═══════════════════════════════════════
app.get('/api/location/:childId', authMiddleware, (req, res) => {
  const child = db.children.find(c => c.id === req.params.childId && c.parentId === req.user.id);
  if (!child) return res.status(404).json({ error: 'Child not found' });
  const history = db.locations.filter(l => l.childId === req.params.childId);
  const current = history[history.length - 1] || null;
  res.json({ current, history: history.slice(-50) });
});

app.post('/api/location/update', (req, res) => {
  const { childId, lat, lng, label, accuracy } = req.body;
  const location = {
    id: 'loc-' + Date.now(),
    childId, lat, lng,
    label: label || 'Unknown',
    accuracy: accuracy || 0,
    time: new Date().toISOString()
  };
  db.locations.push(location);
  // Real-time push to parent
  io.emit(`location:${childId}`, location);
  res.json({ success: true });
});

// ═══════════════════════════════════════
//  APP USAGE ROUTES
// ═══════════════════════════════════════
app.get('/api/apps/:childId', authMiddleware, (req, res) => {
  const apps = db.appUsage.filter(a => a.childId === req.params.childId);
  res.json(apps);
});

app.post('/api/apps/report', (req, res) => {
  const { childId, apps } = req.body;
  apps.forEach(app => {
    db.appUsage.push({ id: 'app-' + Date.now() + Math.random(), childId, date: new Date().toISOString(), ...app });
  });
  res.json({ success: true });
});

// ═══════════════════════════════════════
//  ALERTS ROUTES
// ═══════════════════════════════════════
app.get('/api/alerts', authMiddleware, (req, res) => {
  const childIds = req.user.children;
  const alerts = db.alerts.filter(a => childIds.includes(a.childId)).reverse();
  res.json(alerts);
});

app.put('/api/alerts/:alertId/read', authMiddleware, (req, res) => {
  const alert = db.alerts.find(a => a.id === req.params.alertId);
  if (alert) alert.read = true;
  res.json({ success: true });
});

app.post('/api/alerts/create', (req, res) => {
  const { childId, type, severity, message } = req.body;
  const alert = { id: 'alert-' + Date.now(), childId, type, severity, message, time: new Date().toISOString(), read: false };
  db.alerts.push(alert);
  io.emit(`alert:${childId}`, alert);
  res.json(alert);
});

// ═══════════════════════════════════════
//  SETTINGS ROUTES
// ═══════════════════════════════════════
app.put('/api/children/:childId/settings', authMiddleware, (req, res) => {
  const child = db.children.find(c => c.id === req.params.childId && c.parentId === req.user.id);
  if (!child) return res.status(404).json({ error: 'Not found' });
  child.settings = { ...child.settings, ...req.body };
  io.emit(`settings:${child.id}`, child.settings);
  res.json({ success: true, settings: child.settings });
});

app.post('/api/children/:childId/lock', authMiddleware, (req, res) => {
  const { lock } = req.body;
  io.emit(`device:${req.params.childId}`, { action: lock ? 'lock' : 'unlock' });
  res.json({ success: true });
});

// ═══════════════════════════════════════
//  SCREEN TIME ROUTES
// ═══════════════════════════════════════
app.get('/api/screentime/:childId', authMiddleware, (req, res) => {
  const child = db.children.find(c => c.id === req.params.childId);
  const todayTotal = db.appUsage.filter(a => a.childId === req.params.childId).reduce((s, a) => s + (a.minutes || 0), 0);
  res.json({
    todayMinutes: todayTotal,
    limitMinutes: child?.settings?.screenTimeLimit || 120,
    weeklyData: [65, 120, 95, 180, 145, 200, todayTotal],
  });
});

// ═══════════════════════════════════════
//  CHILD DEVICE PAIRING
// ═══════════════════════════════════════
app.post('/api/pair', (req, res) => {
  const { pairingCode, deviceId, deviceName } = req.body;
  const child = db.children.find(c => c.pairingCode === pairingCode);
  if (!child) return res.status(404).json({ error: 'Invalid pairing code' });
  child.deviceId = deviceId;
  child.deviceName = deviceName;
  child.isOnline = true;
  child.lastSeen = new Date().toISOString();
  child.consentGiven = true;
  child.consentDate = new Date().toISOString();
  const childToken = generateToken(child.id);
  res.json({ success: true, childToken, childId: child.id, settings: child.settings });
});

// ═══════════════════════════════════════
//  WEB FILTER ROUTES
// ═══════════════════════════════════════
const blockedDomains = ['tiktok.com', 'adult-site.com', 'gambling.com'];
app.get('/api/webfilter/check', (req, res) => {
  const { url } = req.query;
  const blocked = blockedDomains.some(d => url?.includes(d));
  res.json({ blocked, url });
});

app.get('/api/webfilter/domains', authMiddleware, (req, res) => {
  res.json({ blocked: blockedDomains });
});

app.post('/api/webfilter/domains', authMiddleware, (req, res) => {
  const { domain, action } = req.body;
  if (action === 'block' && !blockedDomains.includes(domain)) blockedDomains.push(domain);
  else if (action === 'unblock') blockedDomains.splice(blockedDomains.indexOf(domain), 1);
  res.json({ success: true, blocked: blockedDomains });
});

// ─── Socket.io ───
io.on('connection', (socket) => {
  socket.on('join:parent', ({ parentId }) => socket.join(`parent:${parentId}`));
  socket.on('join:child', ({ childId }) => {
    socket.join(`child:${childId}`);
    const child = db.children.find(c => c.id === childId);
    if (child) { child.isOnline = true; child.lastSeen = new Date().toISOString(); }
  });
  socket.on('disconnect', () => {});
});

// ─── Fallback to dashboard ───
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../parent-dashboard/index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`ParentalGuard server running on port ${PORT}`));
module.exports = { app, io };
