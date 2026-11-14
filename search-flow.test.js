const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('server provides a Nova-backed search adapter used by /api/search', () => {
  assert.match(server, /async function runSearchPipeline\(query, options\)/);
  assert.match(server, /async function webSearch\(query, type\)/);
  assert.match(server, /await webSearch\(body\.q \|\| body\.query/);
  assert.match(server, /novaRequest\('\/api\/search'/);
});

test('browser does not create duplicate thinking rows for one request', () => {
  assert.match(html, /Render a single fixed status pill/);
  assert.doesNotMatch(html, /box\.appendChild\(el\); try \{ box\.scrollTop/);
});

test('public error mapping has no undeclared response-data reference', () => {
  const start = html.indexOf('function ccPublicError(err)');
  const end = html.indexOf('\n        }', start);
  assert.ok(start >= 0 && end > start);
  const mapper = html.slice(start, end);
  assert.doesNotMatch(mapper, /\bdata\s*&&/);
});
