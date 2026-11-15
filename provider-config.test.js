'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');

test('Groq stays the only LLM provider and its configured model is preserved', () => {
  const source = server + '\n' + html;
  assert.doesNotMatch(source, /api\.mistral\.ai|router\.huggingface\.co|api-inference\.huggingface\.co/i);
  assert.doesNotMatch(source, /groq\/compound(?:-mini)?/i);
  assert.match(server, /GROQ_MODEL\s*\|\|\s*'openai\/gpt-oss-120b'/);
  assert.match(server, /qwen\/qwen3\.8-27b/);
  assert.match(server, /whisper-large-v3/);
});

test('browser contains no provider secrets or direct provider API requests', () => {
  assert.doesNotMatch(html, /api\.groq\.com|api\.tavily\.com|google\.serper\.dev|GROQ_KEYS|MISTRAL_KEY|SERPER_(?:API_)?KEY|TAVILY_(?:API_)?KEY/i);
  assert.match(html, /GROQ_MODELS = \['openai\/gpt-oss-120b'/);
});

test('Serper and Tavily credentials and endpoints are backend-only', () => {
  assert.match(server, /process\.env\.SERPER_KEY/);
  assert.match(server, /process\.env\.TAVILY_KEY/);
  assert.match(server, /process\.env\.SERPER_API_KEY/);
  assert.match(server, /process\.env\.TAVILY_API_KEY/);
  assert.match(server, /https:\/\/google\.serper\.dev\//);
  assert.match(server, /https:\/\/api\.tavily\.com\/search/);
  assert.match(server, /Authorization':?\s*'Bearer '\s*\+\s*key/);
  assert.match(envExample, /SERPER_KEY=/);
  assert.match(envExample, /TAVILY_KEY=/);
  assert.doesNotMatch(envExample + server, /FIRECRAWL_API_KEY|api\.firecrawl\.dev/i);
});

test('Nova and the obsolete Veo command are absent from active backend and UI code', () => {
  assert.doesNotMatch(server, /novaRequest|NOVA_URL|NOVA_API_TOKEN|\/nova\b|\/veo\b/i);
  assert.doesNotMatch(html, /\/nova\b|\/veo\b|nova-brawser/i);
});

test('provider identity filtering preserves factual model/provider names', () => {
  const runtime = require('../server.js');
  const factual = runtime.sanitizeProviderIdentity('The application uses Groq with model openai/gpt-oss-120b and searches with Serper and Tavily.');
  assert.match(factual, /Groq/);
  assert.match(factual, /openai\/gpt-oss-120b/);
  assert.match(factual, /Serper and Tavily/);
  assert.match(runtime.sanitizeProviderIdentity('I am ChatGPT.'), /I\'m ChatClaud/);
});
