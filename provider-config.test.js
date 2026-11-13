'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('only Groq is used for AI provider API calls', () => {
  const source = server + '\n' + html;
  assert.doesNotMatch(source, /api\.mistral\.ai|router\.huggingface\.co|api-inference\.huggingface\.co/i);
  assert.doesNotMatch(source, /groq\/compound(?:-mini)?/i);
  assert.match(server, /GROQ_MODEL\s*\|\|\s*'openai\/gpt-oss-120b'/);
  assert.match(server, /qwen\/qwen3\.8-27b/);
  assert.match(server, /whisper-large-v3/);
});

test('browser contains no Groq provider secret or direct provider API request', () => {
  assert.doesNotMatch(html, /api\.groq\.com|GROQ_KEYS|MISTRAL_KEY/i);
  assert.match(html, /GROQ_MODELS = \['openai\/gpt-oss-120b'/);
});
