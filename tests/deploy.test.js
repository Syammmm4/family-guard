import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function exitCodeWith(env) {
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: project,
    stdio: 'ignore',
    // Values passed here take priority over the local .env file.
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1', ...env }
  });
  const timer = setTimeout(() => child.kill(), 4000);
  const [code] = await once(child, 'exit');
  clearTimeout(timer);
  return code;
}

test('public deployment refuses to start with the demo PINs', async () => {
  assert.equal(await exitCodeWith({ RENDER: 'true', SENIOR_PIN: '1357', GUARDIAN_PIN: '2468' }), 1);
});

test('public deployment refuses short or identical PINs', async () => {
  assert.equal(await exitCodeWith({ RENDER: 'true', SENIOR_PIN: '1234', GUARDIAN_PIN: '987654' }), 1);
  assert.equal(await exitCodeWith({ RENDER: 'true', SENIOR_PIN: '864213', GUARDIAN_PIN: '864213' }), 1);
});

test('public deployment starts with strong PINs and answers the health check', async () => {
  const net = await import('node:net');
  const probe = net.createServer().listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(r => probe.close(r));
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: project,
    stdio: 'ignore',
    env: { ...process.env, RENDER: 'true', PORT: String(port), SENIOR_PIN: '582614', GUARDIAN_PIN: '937105' }
  });
  try {
    let ok = false;
    for (let i = 0; i < 100 && !ok; i++) {
      try { ok = (await fetch(`http://127.0.0.1:${port}/api/health`)).ok; } catch { await new Promise(r => setTimeout(r, 100)); }
    }
    assert.equal(ok, true);
  } finally {
    child.kill();
  }
});
