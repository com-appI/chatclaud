'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const workspace = require('../project-workspace');
const server = require('../server');

test('project path normalization rejects traversal and normalizes Windows separators', () => {
  assert.equal(workspace.normalizeProjectPath('src\\components\\App.tsx'), 'src/components/App.tsx');
  assert.equal(workspace.normalizeProjectPath('../../server.js'), '');
  assert.equal(workspace.normalizeProjectPath('/src/main.js'), 'src/main.js');
});

test('project ingestion filters secrets, binary assets and generated folders', () => {
  assert.equal(workspace.shouldIncludeProjectFile('src/app.tsx'), true);
  assert.equal(workspace.shouldIncludeProjectFile('node_modules/react/index.js'), false);
  assert.equal(workspace.shouldIncludeProjectFile('.env'), false);
  assert.equal(workspace.shouldIncludeProjectFile('secrets/prod.pem'), false);
  assert.equal(workspace.shouldIncludeProjectFile('assets/logo.png'), false);
});

test('project indexing redacts common API keys and bearer tokens before persistence', () => {
  const source = 'GROQ_API_KEY=gsk_abcdefghijklmnopqrstuvwxyz123456\nAuthorization: Bearer abcdefghijklmnopqrstuvwxyz123456\napiKey: sk-abcdefghijklmnopqrstuvwxyz123456';
  const redacted = workspace.redactProjectText(source);
  assert.doesNotMatch(redacted, /gsk_[A-Za-z0-9_-]{16,}/);
  assert.doesNotMatch(redacted, /Bearer abcdefghijklmnopqrstuvwxyz123456/);
  assert.doesNotMatch(redacted, /sk-abcdefghijklmnopqrstuvwxyz123456/);
  assert.match(redacted, /\[REDACTED\]/);
});

test('import extraction collects static, dynamic and re-exported local imports', () => {
  const refs = workspace.extractImports(`
    const fs = require('./fs');
    import Widget from '../ui/Widget.jsx';
    const lazy = import('./lazy.js');
    export { run } from './runner';
    import 'react';
  `);
  assert.deepEqual(refs.sort(), ['./fs', '../ui/Widget.jsx', './lazy.js', './runner'].sort());
});

test('query-based retrieval ranks named modules and includes local dependencies', () => {
  const files = [
    { path: 'package.json', text: '{"name":"sample"}', bytes: 18, imports: [] },
    { path: 'src/auth/session.ts', text: "import { token } from './token';\nexport function createSession(){ return token; }", bytes: 80, imports: ["./token"] },
    { path: 'src/auth/token.ts', text: 'export const token = getTokenFromCookie();', bytes: 44, imports: [] },
    { path: 'src/ui/Button.tsx', text: 'export function Button(){ return null; }', bytes: 40, imports: [] },
  ];
  const selected = workspace.selectRelevantFiles(files, 'исправь ошибку session auth token', 12000);
  const paths = selected.map((x) => x.path);
  assert.ok(paths.includes('src/auth/session.ts'));
  assert.ok(paths.includes('src/auth/token.ts'));
  assert.ok(paths.includes('package.json'));
});

test('ChatClaud preserves useful long project context instead of truncating every user message at 8 KB', () => {
  const long = 'PROJECT_CONTEXT_' + 'x'.repeat(30000);
  const normalized = server.normalizeChatMessages([
    { role: 'user', content: 'earlier question' },
    { role: 'assistant', content: 'earlier answer' },
    { role: 'user', content: long },
  ], 'system');
  assert.equal(normalized[0].role, 'system');
  assert.ok(normalized[3].content.length >= 30000);
  assert.ok(normalized[3].content.startsWith('PROJECT_CONTEXT_'));
});

test('ChatClaud bounds total history while retaining the newest user turn', () => {
  const messages = [];
  for (let i = 0; i < 20; i += 1) messages.push({ role: i % 2 ? 'assistant' : 'user', content: String(i) + 'a'.repeat(9000) });
  messages.push({ role: 'user', content: 'LAST_TURN_' + 'z'.repeat(55000) });
  const normalized = server.normalizeChatMessages(messages, 'system');
  const total = normalized.reduce((n, m) => n + m.content.length, 0);
  assert.ok(total <= 115000);
  assert.ok(normalized[normalized.length - 1].content.startsWith('LAST_TURN_'));
});
