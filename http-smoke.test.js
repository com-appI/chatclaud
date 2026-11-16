'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const net = require('node:net');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..');

async function findFreePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test('HTTP server serves the app and public assets while keeping source files private', { timeout: 20000 }, async (t) => {
  const port = await findFreePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatclaud-test-'));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      ALE_DATA_DIR: dataDir,
    },
    stdio: 'ignore',
  });

  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      await new Promise((resolve) => {
        child.once('exit', resolve);
        setTimeout(resolve, 2000);
      });
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch (error) {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(ready, true, 'server should start and answer /api/health');

  const page = await fetch(baseUrl);
  assert.equal(page.status, 200);
  assert.equal((await page.text()).includes('<title>ChatClaud</title>'), true);

  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).ok, true);

  const quadraticResponse = await fetch(`${baseUrl}/api/math/intelligence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ problem: '3x^2 - 14x + 8 = 0', sympy: false, lang: 'en' }),
  });
  assert.equal(quadraticResponse.status, 200);
  const quadraticPayload = await quadraticResponse.json();
  assert.equal(quadraticPayload.verified, true);
  assert.equal(quadraticPayload.solved.verified, true);
  assert.deepEqual(quadraticPayload.answer, [2 / 3, 4]);

  const largeIntegerResponse = await fetch(`${baseUrl}/api/math/intelligence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ problem: '30939392939929292983838 * 102', sympy: false, lang: 'en' }),
  });
  assert.equal(largeIntegerResponse.status, 200);
  const largeIntegerPayload = await largeIntegerResponse.json();
  assert.equal(largeIntegerPayload.verified, true);
  assert.equal(largeIntegerPayload.answer, '3155818079872787884351476');

  for (const file of [
    'icon-192.png',
    'icon-512.png',
    'apple-touch-icon.png',
    'chatclaud-avatar-transparent.png',
    'google9da876d4cf2a261c.html',
  ]) {
    const response = await fetch(`${baseUrl}/${file}`);
    assert.equal(response.status, 200, `${file} should be served`);
  }

  for (const file of ['server.js', 'package.json']) {
    const response = await fetch(`${baseUrl}/${file}`);
    assert.equal(response.status, 403, `${file} should remain private`);
  }
});
