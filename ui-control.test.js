'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function scriptById(id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`<script\\b[^>]*id=["']${escaped}["'][^>]*>([\\s\\S]*?)<\\/script>`, 'i'));
  assert.ok(match, `script ${id} must exist`);
  return match[1];
}

test('assistant interface control has a finite allowlist and explicit-user-intent gate', () => {
  const script = scriptById('cc-v160-interface-control');
  assert.match(script, /function explicitForAction/);
  assert.match(script, /source==='assistant'&&!explicitForAction\(action,payload\)/);
  assert.match(script, /requiresExplicitUserIntent:true/);
  assert.match(script, /arbitraryCode:false/);
  assert.match(script, /secretAccess:false/);
  for (const action of ['setTheme', 'openSettings', 'closeSettings', 'newChat', 'openSidebar', 'closeSidebar', 'setMode', 'scrollBottom']) {
    assert.ok(script.includes(`'${action}'`), `action ${action} must be explicit in the implementation`);
  }
});

test('assistant interface control does not evaluate arbitrary JavaScript', () => {
  const script = scriptById('cc-v160-interface-control');
  assert.doesNotMatch(script, /\beval\s*\(/);
  assert.doesNotMatch(script, /new\s+Function\s*\(/);
  assert.doesNotMatch(script, /document\.write\s*\(/);
});

test('Agent Trace uses backend task evidence and does not fabricate search stages', () => {
  const script = scriptById('cc-agent-trace');
  assert.match(script, /agent\.task/);
  assert.match(script, /agent\.receipts/);
  assert.match(script, /agent\.reviewStatus/);
  assert.match(script, /agent\.tokenUsage/);
  assert.match(script, /agent\.durationMs/);
  assert.doesNotMatch(script, /push\(['"]Поиск выполнен/);
  assert.doesNotMatch(script, /push\(['"]Страница открыта/);
});

test('global reduced-motion policy covers all frontend animation and transition effects', () => {
  const block = html.match(/\/\* v1\.6\.0 global motion policy \*\/([\s\S]*?)\/\* Cheaper paints \*\//);
  assert.ok(block, 'global motion policy block must exist');
  assert.match(block[1], /prefers-reduced-motion:\s*reduce/);
  assert.match(block[1], /animation-duration:\s*0\.01ms/);
  assert.match(block[1], /transition-duration:\s*0\.01ms/);
  assert.match(block[1], /scroll-behavior:\s*auto/);
});

test('system prompt accurately describes real tool evidence and interface control limits', () => {
  const start = html.indexOf("let sys = '", html.indexOf('const cm = window.chatMode'));
  assert.ok(start >= 0);
  const end = html.indexOf("\n                if (typeof MODE_BRAINS", start);
  const prompt = html.slice(start, end);
  assert.match(prompt, /только реально переданные результаты Nova/i);
  assert.match(prompt, /не выдумывай источники/i);
  assert.match(prompt, /произвольный код/i);
  assert.doesNotMatch(prompt, /у тебя ЕСТЬ интернет/i);
  assert.doesNotMatch(prompt, /Никогда не пиши.*нет доступа/i);
});
