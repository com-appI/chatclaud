'use strict';
const fs = require('node:fs');
const path = require('node:path');
const posix = path.posix;

const root = path.resolve(__dirname, '..');
const sourceDirs = ['lib', 'scripts'];
const failures = [];

function collect(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collect(full));
    else if (/\.(?:c|m)?js$/.test(entry.name)) out.push(full);
  }
  return out;
}

function resolveRelative(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [
    base, base + '.js', base + '.cjs', base + '.mjs', base + '.json',
    path.join(base, 'index.js'), path.join(base, 'index.cjs'), path.join(base, 'index.mjs'),
  ];
  return candidates.find((candidate) => {
    try { return fs.statSync(candidate).isFile(); } catch (_) { return false; }
  }) || null;
}

function checkSource(file) {
  const text = fs.readFileSync(file, 'utf8');
  const regexes = [
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  const seen = new Set();
  for (const re of regexes) {
    let match;
    while ((match = re.exec(text))) {
      const spec = match[1];
      if (!spec || (!spec.startsWith('.') && !spec.startsWith('/'))) continue;
      if (seen.has(spec)) continue;
      seen.add(spec);
      const resolved = resolveRelative(file, spec);
      if (!resolved) failures.push(`${path.relative(root, file)} -> ${spec} (not found)`);
    }
  }
}

for (const dir of sourceDirs) {
  const full = path.join(root, dir);
  if (fs.existsSync(full)) for (const file of collect(full)) checkSource(file);
}

// The server embeds the intelligence package in a tiny local module registry.
// Validate the embedded dependency graph separately from on-disk CommonJS modules.
const serverPath = path.join(root, 'server.js');
const serverText = fs.readFileSync(serverPath, 'utf8');
// Server-side modules loaded from the real filesystem (not the embedded registry).
for (const match of serverText.matchAll(/require\s*\(\s*['"](\.\/lib\/[^'"]+)['"]\s*\)/g)) {
  const spec = match[1];
  if (!resolveRelative(serverPath, spec)) failures.push(`server.js -> ${spec} (not found)`);
}
const definitions = new Set([...serverText.matchAll(/__ccDefs\[['"]([^'"]+)['"]\]\s*=\s*function/g)].map((m) => m[1]));
for (const match of serverText.matchAll(/__ccDefs\[['"]([^'"]+)['"]\]\s*=\s*function[\s\S]*?\n};/g)) {
  const from = match[1];
  const body = match[0];
  for (const dep of body.matchAll(/require\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
    const normalized = posix.normalize(posix.join(posix.dirname(from), dep[1]));
    const candidates = [normalized, normalized + '.js', normalized + '/index.js'];
    if (!candidates.some((c) => definitions.has(c))) failures.push(`server.js embedded ${from} -> ${dep[1]} (not found in bundle)`);
  }
}

// All local script tags in the shipped page must resolve to files in the release.
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
  const src = match[1];
  if (/^(?:https?:)?\/\//i.test(src) || /^(?:data:|blob:)/i.test(src)) continue;
  const clean = src.split('?')[0].split('#')[0].replace(/^\.\//, '');
  if (!clean) continue;
  const target = path.resolve(root, clean);
  if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
    failures.push(`index.html script -> ${src} (not found in release)`);
  }
}

if (failures.length) {
  console.error('Module/asset resolution failed:\n' + failures.map((x) => ' - ' + x).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Module/asset resolution: ${definitions.size} bundled modules and local script assets verified.`);
}
// deploy check
