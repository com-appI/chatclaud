'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { ROOT, safeJoin, contentType } = require('../server.js');

test('all PWA and brand images referenced by the app are publicly served', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const iconFiles = [
    ...manifest.icons.map((icon) => icon.src),
    'apple-touch-icon.png',
    'chatclaud-avatar-transparent.png',
  ];
  for (const file of new Set(iconFiles)) {
    assert.equal(fs.existsSync(path.join(ROOT, file)), true, `${file} must exist`);
    assert.equal(safeJoin(ROOT, `/${file}`), path.join(ROOT, file), `${file} must be allowlisted`);
  }
});

test('public page and verification file are accessible', () => {
  assert.equal(safeJoin(ROOT, '/'), path.join(ROOT, 'index.html'));
  assert.equal(
    safeJoin(ROOT, '/google9da876d4cf2a261c.html'),
    path.join(ROOT, 'google9da876d4cf2a261c.html')
  );
});

test('private server and data files are not publicly served', () => {
  for (const file of [
    '/server.js',
    '/package.json',
    '/.env',
    '/CHANGELOG-ALE.txt',
    '/data/ale/knowledge.json',
    '/tests/example.test.js',
    '/%2e%2e/server.js',
  ]) {
    assert.equal(safeJoin(ROOT, file), null, `${file} must stay private`);
  }
});

test('static assets receive appropriate MIME types', () => {
  assert.equal(contentType('icon-192.png'), 'image/png');
  assert.equal(contentType('sw.js'), 'application/javascript; charset=utf-8');
  assert.equal(contentType('manifest.json'), 'application/json; charset=utf-8');
});

test('HTML keeps unique element IDs and project-relative branding assets', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'element IDs should be unique');
  assert.doesNotMatch(html, /src=["']\/(?:icon-192|icon-512|apple-touch-icon|chatclaud-avatar-transparent)\.png["']/i);
  assert.match(html, /serviceWorker\.register\(['"]\.\/sw\.js['"]\)/);
});
