'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
process.chdir(root);

const required = [
  'server.js',
  'package.json',
  'index.html',
  'lib/search/index.js',
  'lib/search/intent-router.js',
  'lib/search/query-planner.js',
  'lib/search/fusion.js',
  'lib/search/evidence.js',
  'lib/search/search-trace.js',
  'lib/providers/config.js',
  'lib/providers/nvidia.js',
  'lib/providers/router.js',
  'lib/router/hardened.js',
  'lib/math-engine.js',
  'lib/math/math-solver.js',
  'lib/cognitive-router.js',
  'lib/unified-memory.js',
];

const missing = [];
for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) missing.push(rel);
}

if (missing.length) {
  console.error('[chatclaud] MODULE PACK incomplete. Missing files:');
  missing.forEach((m) => console.error('  - ' + m));
  console.error('[chatclaud] Push FULL repo root including lib/search/** then redeploy.');
  process.exit(1);
}

try {
  require(path.join(root, 'lib/search/index.js'));
  require(path.join(root, 'lib/providers/config.js'));
  require(path.join(root, 'lib/router/hardened.js'));
} catch (e) {
  console.error('[chatclaud] require failed:', e.message);
  process.exit(1);
}

console.log('[chatclaud] module pack OK (' + required.length + ' files)');
