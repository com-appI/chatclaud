'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const htmlPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const scriptTags = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
let checked = 0;

for (let i = 0; i < scriptTags.length; i += 1) {
  const attrs = scriptTags[i][1] || '';
  const source = scriptTags[i][2] || '';
  if (/\bsrc\s*=/.test(attrs) || !source.trim()) continue;
  try {
    new vm.Script(source, { filename: `index.html:inline-script-${i + 1}` });
    checked += 1;
  } catch (error) {
    console.error(`Inline script ${i + 1} failed syntax check: ${error.message}`);
    process.exitCode = 1;
  }
}

if (!process.exitCode) {
  console.log(`Inline JavaScript syntax: ${checked} scripts checked.`);
}
