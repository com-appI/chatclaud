'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const runtime = require('../server.js');

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

test('Vision accepts up to three supported base64 image formats and rejects malformed input', () => {
  const png = 'data:image/png;base64,' + Buffer.from('png-image').toString('base64');
  const jpeg = 'data:image/jpeg;base64,' + Buffer.from('jpeg-image').toString('base64');
  const webp = 'data:image/webp;base64,' + Buffer.from('webp-image').toString('base64');
  assert.equal(runtime.normalizeVisionImages([png, jpeg, webp]).length, 3);
  assert.throws(() => runtime.normalizeVisionImages([png, jpeg, webp, png]), (e) => e.code === 'VISION_TOO_MANY_IMAGES');
  assert.throws(() => runtime.normalizeVisionImages('data:text/html;base64,PGh0bWw+'), (e) => e.code === 'VISION_INVALID_IMAGE');
  const oversized = 'data:image/jpeg;base64,' + Buffer.alloc(14 * 1024 * 1024 + 1, 1).toString('base64');
  assert.throws(() => runtime.normalizeVisionImages(oversized), (e) => e.code === 'VISION_TOO_LARGE');
});

test('Groq Vision sends the dedicated vision model and all supplied images, with no text fallback', async () => {
  const oldKey = process.env.GROQ_KEY;
  const oldFetch = global.fetch;
  process.env.GROQ_KEY = 'test-groq-vision-key';
  const first = 'data:image/png;base64,' + Buffer.from('one').toString('base64');
  const second = 'data:image/jpeg;base64,' + Buffer.from('two').toString('base64');
  let requestBody;
  global.fetch = async (url, options) => {
    assert.match(String(url), /api\.groq\.com\/openai\/v1\/chat\/completions$/);
    assert.equal(options.headers.Authorization, 'Bearer test-groq-vision-key');
    requestBody = JSON.parse(options.body);
    return response({ choices: [{ message: { content: 'A test image description.' } }] });
  };
  try {
    const result = await runtime.groqVision([first, second], 'Describe both');
    assert.equal(result.text, 'A test image description.');
    assert.equal(result.imageCount, 2);
    assert.equal(requestBody.model, 'qwen/qwen3.8-27b');
    assert.equal(requestBody.messages[0].content.filter((part) => part.type === 'image_url').length, 2);
  } finally {
    global.fetch = oldFetch;
    if (oldKey == null) delete process.env.GROQ_KEY; else process.env.GROQ_KEY = oldKey;
  }
});

test('Groq Vision failure is surfaced as an explicit error and does not return a text-only result', async () => {
  const oldKey = process.env.GROQ_KEY;
  const oldFetch = global.fetch;
  process.env.GROQ_KEY = 'test-groq-vision-key';
  global.fetch = async () => response({ error: { message: 'unavailable' } }, 503);
  try {
    const image = 'data:image/png;base64,' + Buffer.from('image').toString('base64');
    await assert.rejects(() => runtime.groqVision(image, 'analyze'), (e) => e.code === 'VISION_PROVIDER_UNAVAILABLE');
  } finally {
    global.fetch = oldFetch;
    if (oldKey == null) delete process.env.GROQ_KEY; else process.env.GROQ_KEY = oldKey;
  }
});

test('CORS resolver accepts configured and same-origin values, rejects arbitrary origins', () => {
  const oldOrigins = process.env.CORS_ORIGINS;
  process.env.CORS_ORIGINS = 'https://app.example.test, https://www.example.test';
  const makeReq = (origin, host = 'api.example.test') => ({
    headers: { origin, host, 'x-forwarded-proto': 'https' }, socket: {},
  });
  try {
    assert.equal(runtime.resolveCorsOrigin(makeReq('https://app.example.test')), 'https://app.example.test');
    assert.equal(runtime.resolveCorsOrigin(makeReq('https://api.example.test')), 'https://api.example.test');
    assert.equal(runtime.resolveCorsOrigin(makeReq('https://evil.example')), null);
  } finally {
    if (oldOrigins == null) delete process.env.CORS_ORIGINS; else process.env.CORS_ORIGINS = oldOrigins;
  }
});

test('CORS default allows the deployed GitHub Pages frontend origin', () => {
  const oldOrigins = process.env.CORS_ORIGINS;
  delete process.env.CORS_ORIGINS;
  const req = {
    headers: {
      origin: 'https://com-appi.github.io',
      host: 'servierte.onrender.com',
      'x-forwarded-proto': 'https',
    },
    socket: {},
  };
  try {
    assert.equal(runtime.resolveCorsOrigin(req), 'https://com-appi.github.io');
  } finally {
    if (oldOrigins == null) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = oldOrigins;
  }
});

test('chat UI allows selecting multiple images and routes the selected array through Vision', () => {
  const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(html.includes('id="flashFileInput" multiple accept="image/*'));
  assert.ok(html.includes('id="expertFileInput" multiple accept="image/*'));
  assert.match(html, /this\.currentImagesB64 = dataUrls/);
  assert.match(html, /describeImageForChat\(imagesForVision\)/);
});
