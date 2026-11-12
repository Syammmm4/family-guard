import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wait = ms => new Promise(r => setTimeout(r, ms));
async function freePort() {
  const listener = net.createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise(r => listener.close(r));
  return port;
}

test('isolated API workflow, permissions and restored server timer', { timeout: 45000 }, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'family-guard-test-'));
  await fs.cp(path.join(project, 'server'), path.join(root, 'server'), { recursive: true });
  await fs.copyFile(path.join(project, 'package.json'), path.join(root, 'package.json'));
  await fs.symlink(path.join(project, 'node_modules'), path.join(root, 'node_modules'), 'dir');
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  let child;
  async function boot(timeout) {
    child = spawn(process.execPath, ['server/index.js'], { cwd: root, stdio: 'ignore', env: {
      ...process.env, HOST: '127.0.0.1', PORT: String(port), SENIOR_PIN: '1357', GUARDIAN_PIN: '2468',
      INCIDENT_TIMEOUT_SECONDS: timeout || '', GUARDIAN_PHONE: '', BACKUP_GUARDIAN_PHONE: '',
      TWILIO_ACCOUNT_SID: '', TWILIO_AUTH_TOKEN: '', TWILIO_FROM_NUMBER: ''
    }});
    for (let i = 0; i < 80; i++) {
      try { if ((await fetch(base + '/api/health')).ok) return; } catch {}
      await wait(50);
    }
    throw new Error('Server did not start');
  }
  async function stop() { if (child && child.exitCode === null) { const ended = once(child, 'exit'); child.kill('SIGTERM'); await ended; } }
  async function call(route, token, body) {
    const response = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers: {
      'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {})
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() };
  }
  async function login(role) {
    const r = await call('/api/auth', null, { role, pin: role === 'senior' ? '1357' : '2468' });
    assert.equal(r.status, 200);
    return r.data.token;
  }
  try {
    await boot();
    await t.test('state requires authentication', async () => assert.equal((await call('/api/state')).status, 401));
    await t.test('incorrect PIN is rejected', async () => assert.equal((await call('/api/auth', null, { role: 'guardian', pin: '0000' })).status, 401));
    let senior = await login('senior'), guardian = await login('guardian');
    await t.test('guardian cannot create senior scans', async () => assert.equal((await call('/api/scan', guardian, { url: 'https://example.org' })).status, 403));
    await t.test('invalid URL schemes return a validation error', async () => assert.equal((await call('/api/scan', senior, { url: 'javascript://alert(1)' })).status, 400));
    await t.test('ordinary URL produces no incident', async () => {
      const r = await call('/api/scan', senior, { url: 'https://www.google.com' });
      assert.equal(r.status, 200); assert.equal(r.data.triggered, false);
    });
    let incident;
    await t.test('lookalike URL creates a real prototype alert with default 180-second deadline', async () => {
      const r = await call('/api/scan', senior, { url: 'https://maybank-secure-verification.example/verify?token=private#secret' });
      assert.equal(r.status, 201); incident = r.data.incident;
      assert.equal(incident.status, 'WAITING'); assert.equal(incident.simulated, false);
      assert.equal(Date.parse(incident.expiresAt) - Date.parse(incident.createdAt), 180000);
      assert.ok(!incident.displayUrl.includes('private'));
    });
    await t.test('senior cannot resolve the guardian decision', async () => assert.equal((await call(`/api/incidents/${incident.id}/resolve`, senior, { decision: 'BLOCKED' })).status, 403));
    await t.test('second scan cannot overwrite the active incident', async () => assert.equal((await call('/api/scan', senior, { url: 'https://example.org' })).status, 409));
    await t.test('guardian block clears the active alert and retains history', async () => {
      assert.equal((await call(`/api/incidents/${incident.id}/resolve`, guardian, { decision: 'BLOCKED' })).status, 200);
      const state = (await call('/api/state', guardian)).data;
      assert.equal(state.active, null); assert.equal(state.history[0].decision, 'BLOCKED'); assert.equal(state.smsEnabled, false);
    });
    await stop(); await boot('15'); senior = await login('senior'); guardian = await login('guardian');
    // A different site: the Maybank lookalike was blocked above and is now remembered as BLOCKED.
    const late = (await call('/api/scan', senior, { url: 'https://cimb-secure-login.example/verify' })).data.incident;
    await stop(); await boot('15'); senior = await login('senior'); guardian = await login('guardian');
    await t.test('server restart preserves the unresolved deadline', async () => {
      const active = (await call('/api/state', guardian)).data.active;
      assert.equal(active.expiresAt, late.expiresAt);
    });
    await t.test('timer escalates without guardian activity or browser connection', async () => {
      await wait(Math.max(0, Date.parse(late.expiresAt) - Date.now()) + 250);
      const active = (await call('/api/state', guardian)).data.active;
      assert.equal(active.status, 'ESCALATED'); assert.ok(active.escalatedAt);
    });
    await t.test('parent cannot allow an escalated link alone', async () => {
      const r = await call(`/api/incidents/${late.id}/report-997`, senior, { decision: 'SAFE' });
      assert.equal(r.status, 403);
      assert.equal((await call('/api/state', senior)).data.active.status, 'ESCALATED');
    });
    await t.test('guardian can resolve an escalated incident', async () => {
      assert.equal((await call(`/api/incidents/${late.id}/resolve`, guardian, { decision: 'BLOCKED' })).status, 200);
      assert.equal((await call('/api/state', senior)).data.active, null);
    });
  } finally { await stop(); await fs.rm(root, { recursive: true, force: true }); }
});
