import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Server } from 'socket.io';
import { checkUrl } from './detector.js';
import { IncidentStore } from './store.js';
import { createNotifier } from './sms.js';

const env = process.env;
// Render (and similar hosts) set RENDER=true and route traffic through their own proxy.
const behindProxy = env.TRUST_PROXY === '1' || env.RENDER === 'true';
const HOST = env.HOST || (behindProxy ? '0.0.0.0' : '127.0.0.1');
const PORT = Number(env.PORT || 3000);
const timeoutSeconds = Math.max(15, Math.min(3600, Number(env.INCIDENT_TIMEOUT_SECONDS) || 180));
const seniorPin = env.SENIOR_PIN || '1357';
const guardianPin = env.GUARDIAN_PIN || '2468';
const seniorName = env.SENIOR_NAME || 'Puan Rosnah';
const guardianName = env.GUARDIAN_NAME || 'Anak';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// On the public internet, never run with the published demo PINs or with short PINs.
if (behindProxy) {
  const weak = pin => pin === '1357' || pin === '2468' || pin.length < 6;
  if (weak(seniorPin) || weak(guardianPin) || seniorPin === guardianPin) {
    console.error('Refusing to start: set SENIOR_PIN and GUARDIAN_PIN to different PINs of at least 6 digits (not the demo PINs).');
    process.exit(1);
  }
}

const app = express();
app.disable('x-powered-by');
// Behind a proxy, use the visitor's real address so the PIN rate limit applies per visitor,
// not to everyone at once.
if (behindProxy) app.set('trust proxy', 1);
app.use(express.json({ limit: '8kb' }));
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  next();
});

const server = createServer(app);
const io = new Server(server, { cors: { origin: false } });
const store = new IncidentStore();
const notifier = createNotifier(env);
const sessions = new Map(); // prototype only; reset on restart
const attempts = new Map();
let timer = null;

function validRole(role) { return role === 'senior' || role === 'guardian'; }
function tokenRole(token) {
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expires < Date.now()) { sessions.delete(token); return null; }
  return session.role;
}
function requireAuth(req, res, next) {
  const token = /^Bearer (.+)$/i.exec(req.headers.authorization || '')?.[1];
  const role = tokenRole(token);
  if (!role) return res.status(401).json({ error: 'Sesi tamat. Sila log masuk semula.' });
  req.role = role;
  req.token = token;
  next();
}
function onlyGuardian(req, res, next) {
  if (req.role !== 'guardian') return res.status(403).json({ error: 'Akses anak (penjaga) diperlukan.' });
  next();
}
function onlySenior(req, res, next) {
  if (req.role !== 'senior') return res.status(403).json({ error: 'Akses ibu/bapa diperlukan.' });
  next();
}

function lastResolvedSummary() {
  const done = store.incidents.find(x => x.status === 'RESOLVED');
  return done ? { id: done.id, decision: done.decision, decidedBy: done.decidedBy || 'ANAK', domain: done.domain, resolvedAt: done.resolvedAt } : null;
}
function payload(role) {
  const active = store.active;
  return {
    role,
    seniorName,
    guardianName,
    timeoutSeconds,
    active,
    stats: store.stats(),
    // Lets the senior's screen learn the guardian's decision after a tapped link was reviewed.
    lastResolved: lastResolvedSummary(),
    deletedMessages: store.deletedMessageIds(),
    ...(role === 'guardian' ? { history: store.incidents.slice(0, 30) } : {}),
    guardianPhone: notifier.guardianPhone,
    // Backup number is not shown in senior UI.
    ...(role === 'guardian' ? { backupPhone: notifier.backupPhone, smsEnabled: notifier.smsEnabled } : {})
  };
}
function pushState() {
  io.to('senior').emit('state', payload('senior'));
  io.to('guardian').emit('state', payload('guardian'));
}
function scheduleEscalation() {
  if (timer) clearTimeout(timer);
  const active = store.active;
  if (!active || active.status !== 'WAITING') return;
  const ms = Math.max(0, new Date(active.expiresAt).getTime() - Date.now());
  timer = setTimeout(() => escalateIncident(active.id), ms);
}
function escalateIncident(id) {
  const active = store.active;
  if (!active || active.id !== id || active.status !== 'WAITING') return;
  const updated = store.update(id, { status: 'ESCALATED', escalatedAt: new Date().toISOString() });
  pushState();
  // Never auto-dials emergency services. This only messages a family backup if configured.
  void notifier.alertBackup(updated);
}

app.post('/api/auth', (req, res) => {
  const { role, pin } = req.body ?? {};
  const ip = req.ip;
  const entry = attempts.get(ip) || { count: 0, reset: Date.now() + 10 * 60_000 };
  if (Date.now() >= entry.reset) { entry.count = 0; entry.reset = Date.now() + 10 * 60_000; }
  if (entry.count >= 12) return res.status(429).json({ error: 'Terlalu banyak cubaan. Sila cuba lagi nanti.' });
  const expected = role === 'guardian' ? guardianPin : role === 'senior' ? seniorPin : null;
  const correct = expected && typeof pin === 'string' && pin.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(pin), Buffer.from(expected));
  if (!validRole(role) || !correct) {
    entry.count++;
    attempts.set(ip, entry);
    return res.status(401).json({ error: 'PIN akses salah.' });
  }
  attempts.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { role, expires: Date.now() + 12 * 60 * 60_000 });
  res.json({ token, role });
});

app.post('/api/logout', requireAuth, (req, res) => {
  sessions.delete(req.token);
  res.json({ ok: true });
});

app.get('/api/state', requireAuth, (req, res) => res.json(payload(req.role)));

app.post('/api/scan', requireAuth, onlySenior, (req, res) => {
  if (store.active) return res.status(409).json({ error: 'Amaran masih aktif. Sila tunggu jawapan anak anda.' });
  let result;
  try {
    // The simulate flag exists solely for teaching and is clearly labelled in the UI.
    result = checkUrl(req.body?.url, { simulate: req.body?.simulate === true });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  // A website anak (or 997) already decided on is answered straight away. A blocked site stays blocked.
  const remembered = result.simulated ? null : store.rememberedDecision(result.domain);
  if (remembered) return res.json({ triggered: false, remembered, scan: result });
  if (result.risk === 'LOW') return res.json({ triggered: false, scan: result });
  const now = Date.now();
  // Optional label of where the link was tapped, e.g. "+60 11-5555 0000 (WhatsApp)". Plain text, length-limited.
  const source = typeof req.body?.source === 'string' ? req.body.source.trim().slice(0, 60) : '';
  // Optional ID of the demo chat message, so a confirmed scam message can be deleted from the chat.
  const messageId = typeof req.body?.messageId === 'string' && /^[a-z0-9-]{1,40}$/i.test(req.body.messageId) ? req.body.messageId : '';
  const incident = {
    id: crypto.randomUUID(),
    ...result,
    ...(source ? { source } : {}),
    ...(messageId ? { messageId } : {}),
    status: 'WAITING',
    decision: null,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + timeoutSeconds * 1000).toISOString(),
    resolvedAt: null,
    escalatedAt: null
  };
  store.add(incident);
  scheduleEscalation();
  pushState();
  void notifier.alertGuardian(incident);
  res.status(201).json({ triggered: true, scan: result, incident });
});

app.post('/api/incidents/:id/resolve', requireAuth, onlyGuardian, (req, res) => {
  const active = store.active;
  if (!active || active.id !== req.params.id) return res.status(404).json({ error: 'Tiada amaran aktif dengan ID ini.' });
  const { decision } = req.body || {};
  if (decision !== 'SAFE' && decision !== 'BLOCKED') return res.status(400).json({ error: 'Pilih SAFE atau BLOCKED.' });
  const incident = store.update(active.id, { status: 'RESOLVED', decision, decidedBy: 'ANAK', resolvedAt: new Date().toISOString() });
  scheduleEscalation();
  pushState();
  res.json({ ok: true, incident });
});

// Scenario 2: anak did not answer in time. The parent may choose to BLOCK the link themselves
// (for example after speaking to family, the bank or NSRC 997). Allowed ONLY after escalation.
// Only anak can ALLOW a link: a trusting parent must never be able to unlock a risky link alone.
app.post('/api/incidents/:id/report-997', requireAuth, onlySenior, (req, res) => {
  const active = store.active;
  if (!active || active.id !== req.params.id) return res.status(404).json({ error: 'Tiada amaran aktif dengan ID ini.' });
  if (active.status !== 'ESCALATED') return res.status(409).json({ error: 'Pilihan ini hanya tersedia selepas masa menunggu anak tamat.' });
  const { decision } = req.body || {};
  if (decision === 'SAFE') return res.status(403).json({ error: 'Hanya anak boleh membenarkan pautan ini.' });
  if (decision !== 'BLOCKED') return res.status(400).json({ error: 'Pilih BLOCKED.' });
  const incident = store.update(active.id, { status: 'RESOLVED', decision, decidedBy: 'IBU_BAPA', resolvedAt: new Date().toISOString() });
  scheduleEscalation();
  pushState();
  res.json({ ok: true, incident });
});

app.post('/api/incidents/:id/escalate', requireAuth, onlyGuardian, (req, res) => {
  const active = store.active;
  if (!active || active.id !== req.params.id) return res.status(404).json({ error: 'Tiada amaran aktif dengan ID ini.' });
  escalateIncident(active.id);
  res.json({ ok: true });
});

// Demo helper: bring back deleted chat messages so the presentation can be repeated.
app.post('/api/demo/reset', requireAuth, (req, res) => {
  if (store.active) return res.status(409).json({ error: 'Selesaikan amaran yang aktif dahulu.' });
  store.resetDemo();
  pushState();
  res.json({ ok: true });
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use(express.static(path.join(root, 'public'), { index: 'index.html', maxAge: 0 }));
app.use((err, _req, res, _next) => {
  console.error('Request error:', err.message);
  res.status(400).json({ error: 'Permintaan ini tidak dapat diproses.' });
});

io.use((socket, next) => {
  const role = tokenRole(socket.handshake.auth?.token);
  if (!role) return next(new Error('Authentication required'));
  socket.data.role = role;
  next();
});
io.on('connection', socket => {
  socket.join(socket.data.role);
  socket.emit('state', payload(socket.data.role));
});

// Restore any unresolved timer after process restart.
scheduleEscalation();
server.listen(PORT, HOST, () => {
  console.log(`\n🛡️  Family Guard is running at http://${HOST}:${PORT}`);
  console.log('Private prototype. Do NOT expose this demo to the public internet.');
  if (seniorPin === '1357' || guardianPin === '2468') console.log('⚠ Change the demo PINs in .env before using a shared network.');
  if (!notifier.smsEnabled) console.log('ℹ️  Real SMS disabled (Twilio configuration not supplied).');
});

export { app, server };