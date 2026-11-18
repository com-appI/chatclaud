'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getProviderConfig } = require('../lib/providers/config');

const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');

test('Nemotron is the only primary text provider and Groq failover is disabled', () => {
  const oldPrimary = process.env.PRIMARY_PROVIDER;
  const oldFallback = process.env.AUTO_FALLBACK;
  process.env.PRIMARY_PROVIDER = 'groq';
  process.env.AUTO_FALLBACK = 'true';
  try {
    const cfg = getProviderConfig();
    assert.equal(cfg.primary, 'nvidia');
    assert.equal(cfg.fallbackEnabled, false);
  } finally {
    if (oldPrimary == null) delete process.env.PRIMARY_PROVIDER; else process.env.PRIMARY_PROVIDER = oldPrimary;
    if (oldFallback == null) delete process.env.AUTO_FALLBACK; else process.env.AUTO_FALLBACK = oldFallback;
  }
  assert.match(server, /ModelProvider\.generate\(trimmed, providerMessages, isReasoning\)/);
  assert.match(server, /ModelProvider\.stream\(trimmed, providerMessages, isReasoning\)/);
  assert.match(envExample, /NVIDIA_API_KEY=/);
  assert.match(envExample, /NVIDIA_MODEL=nvidia\/nemotron-3-ultra-550b-a55b/);
});

test('Groq Vision is a separate multimodal route with the official model ID', () => {
  assert.match(server, /const model = 'qwen\/qwen3\.8-27b'/);
  assert.match(server, /function groqVision\(/);
  assert.match(server, /function normalizeVisionImages\(/);
  assert.match(server, /Vision is temporarily unavailable/);
  assert.doesNotMatch(server, /Groq is the only language\/vision\/speech provider/);
});

test('browser contains no provider API keys or direct Groq/NVIDIA/Search provider requests', () => {
  assert.doesNotMatch(html, /api\.groq\.com|integrate\.api\.nvidia\.com|api\.tavily\.com|google\.serper\.dev|GROQ_KEY\s*=\s*['"][^'"]{8,}|NVIDIA_API_KEY\s*=\s*['"][^'"]{8,}/i);
});

test('Serper and Tavily keys remain backend-only and their routes remain configured', () => {
  assert.match(server, /process\.env\.SERPER_KEY/);
  assert.match(server, /process\.env\.TAVILY_KEY/);
  assert.match(server, /process\.env\.SERPER_API_KEY/);
  assert.match(server, /process\.env\.TAVILY_API_KEY/);
  assert.match(server, /https:\/\/google\.serper\.dev\//);
  assert.match(server, /https:\/\/api\.tavily\.com\/search/);
  assert.match(envExample, /SERPER_KEY=/);
  assert.match(envExample, /TAVILY_KEY=/);
});

test('CORS no longer grants wildcard access', () => {
  assert.doesNotMatch(server, /Access-Control-Allow-Origin['"]?\s*:\s*['"]\*['"]/);
  assert.match(server, /CORS_ORIGINS/);
});

test('browser Vision errors are not silently converted to text-only answers', () => {
  const start = html.indexOf("if (this.currentImageB64) {", html.indexOf('let fullPrompt'));
  const end = html.indexOf("if (this.currentFileText)", start);
  const block = html.slice(start, end);
  assert.match(block, /throw e;/);
  assert.match(block, /Сообщение не отправлено/);
  assert.doesNotMatch(block, /разбор не удался.*Ответь по вопросу пользователя/s);
});
