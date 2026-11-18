'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('../server.js');

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function withServer(fn) {
  const server = runtime.httpServer;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const address = server.address();
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('ordinary /api/chat request reaches Nemotron, not Groq', { timeout: 20000 }, async () => {
  const oldKey = process.env.NVIDIA_API_KEY;
  const oldFetch = global.fetch;
  process.env.NVIDIA_API_KEY = 'test-nvidia-key';
  let requestedModel = '';
  global.fetch = async (url, options) => {
    if (!/integrate\.api\.nvidia\.com\/v1\/chat\/completions$/.test(String(url))) return oldFetch(url, options);
    const body = JSON.parse(options.body);
    requestedModel = body.model;
    assert.equal(options.headers.Authorization, 'Bearer test-nvidia-key');
    return jsonResponse({
      choices: [{ message: { role: 'assistant', content: 'Nemotron integration answer', reasoning_content: 'private internal reasoning must not appear' } }],
      usage: { prompt_tokens: 5, completion_tokens: 6, total_tokens: 11 },
    });
  };
  try {
    await withServer(async (base) => {
      const response = await fetch(base + '/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'привет' }] }),
      });
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.text, 'Nemotron integration answer');
      assert.doesNotMatch(JSON.stringify(payload), /private internal reasoning/);
      assert.equal(requestedModel, 'nvidia/nemotron-3-ultra-550b-a55b');
    });
  } finally {
    global.fetch = oldFetch;
    if (oldKey == null) delete process.env.NVIDIA_API_KEY; else process.env.NVIDIA_API_KEY = oldKey;
  }
});

test('CORS preflight denies an unconfigured external origin', { timeout: 10000 }, async () => {
  const oldOrigins = process.env.CORS_ORIGINS;
  process.env.CORS_ORIGINS = 'https://allowed.example.test';
  try {
    await withServer(async (base) => {
      const response = await fetch(base + '/api/health', {
        method: 'OPTIONS', headers: { Origin: 'https://evil.example.test', 'Access-Control-Request-Method': 'POST' },
      });
      assert.equal(response.status, 204);
      assert.equal(response.headers.get('access-control-allow-origin'), null);
    });
  } finally {
    if (oldOrigins == null) delete process.env.CORS_ORIGINS; else process.env.CORS_ORIGINS = oldOrigins;
  }
});

test('streaming /api/chat emits final content from Nemotron and never reasoning_content', { timeout: 20000 }, async () => {
  const oldKey = process.env.NVIDIA_API_KEY;
  const oldFetch = global.fetch;
  process.env.NVIDIA_API_KEY = 'test-nvidia-key';
  global.fetch = async (url, options) => {
    if (!/integrate\.api\.nvidia\.com\/v1\/chat\/completions$/.test(String(url))) return oldFetch(url, options);
    const request = JSON.parse(options.body);
    assert.equal(request.stream, true);
    const payload = 'data: ' + JSON.stringify({ choices: [{ delta: { reasoning_content: 'private stream reasoning', content: 'Nemotron streamed answer' } }] }) + '\n\n' + 'data: [DONE]\n\n';
    return new Response(payload, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  };
  try {
    await withServer(async (base) => {
      const response = await fetch(base + '/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stream: true, messages: [{ role: 'user', content: 'привет' }] }),
      });
      assert.equal(response.status, 200);
      const text = await response.text();
      assert.match(text, /Nemotron streamed answer/);
      assert.doesNotMatch(text, /private stream reasoning/);
    });
  } finally {
    global.fetch = oldFetch;
    if (oldKey == null) delete process.env.NVIDIA_API_KEY; else process.env.NVIDIA_API_KEY = oldKey;
  }
});

test('image chat follows Groq Vision -> Nemotron and Vision failures stop the request', { timeout: 20000 }, async () => {
  const oldNvidia = process.env.NVIDIA_API_KEY;
  const oldGroq = process.env.GROQ_KEY;
  const oldFetch = global.fetch;
  process.env.NVIDIA_API_KEY = 'test-nvidia-key';
  process.env.GROQ_KEY = 'test-groq-key';
  let visionCalls = 0;
  let nvidiaCalls = 0;
  global.fetch = async (url, options) => {
    if (/api\.groq\.com\/openai\/v1\/chat\/completions/.test(String(url))) {
      visionCalls += 1;
      const request = JSON.parse(options.body);
      assert.equal(request.model, 'qwen/qwen3.8-27b');
      return jsonResponse({ choices: [{ message: { content: 'A red apple on a wooden table.' } }] });
    }
    if (/integrate\.api\.nvidia\.com\/v1\/chat\/completions$/.test(String(url))) {
      nvidiaCalls += 1;
      const request = JSON.parse(options.body);
      assert.match(request.messages.map((m) => String(m.content || '')).join(' '), /A red apple on a wooden table/);
      return jsonResponse({ choices: [{ message: { content: 'The image shows a red apple.' } }] });
    }
    return oldFetch(url, options);
  };
  try {
    await withServer(async (base) => {
      const image = 'data:image/png;base64,' + Buffer.from('mock-png-bytes').toString('base64');
      const response = await fetch(base + '/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, messages: [{ role: 'user', content: 'Describe this picture.' }] }),
      });
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.match(payload.text, /red apple/i);
      assert.equal(visionCalls, 1);
      assert.equal(nvidiaCalls, 1);
    });

    visionCalls = 0;
    nvidiaCalls = 0;
    global.fetch = async (url, options) => {
      if (/api\.groq\.com\/openai\/v1\/chat\/completions/.test(String(url))) {
        visionCalls += 1;
        return jsonResponse({ error: { message: 'vision unavailable' } }, 503);
      }
      if (/integrate\.api\.nvidia\.com\/v1\/chat\/completions$/.test(String(url))) nvidiaCalls += 1;
      return oldFetch(url, options);
    };
    await withServer(async (base) => {
      const image = 'data:image/png;base64,' + Buffer.from('mock-png-bytes').toString('base64');
      const response = await fetch(base + '/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, messages: [{ role: 'user', content: 'Describe this picture.' }] }),
      });
      assert.equal(response.status, 503);
      const payload = await response.json();
      assert.equal(payload.code, 'VISION_PROVIDER_UNAVAILABLE');
      assert.equal(nvidiaCalls, 0);
    });
  } finally {
    global.fetch = oldFetch;
    if (oldNvidia == null) delete process.env.NVIDIA_API_KEY; else process.env.NVIDIA_API_KEY = oldNvidia;
    if (oldGroq == null) delete process.env.GROQ_KEY; else process.env.GROQ_KEY = oldGroq;
  }
});

test('Vision endpoint accepts a base64 payload above the general 14 MiB limit while respecting the tighter raw-image cap', { timeout: 30000 }, async () => {
  const oldKey = process.env.GROQ_KEY;
  const oldFetch = global.fetch;
  process.env.GROQ_KEY = 'test-groq-key';
  let upstreamCalled = false;
  global.fetch = async (url, options) => {
    if (/api\.groq\.com\/openai\/v1\/chat\/completions/.test(String(url))) {
      upstreamCalled = true;
      const request = JSON.parse(options.body);
      assert.equal(request.model, 'qwen/qwen3.8-27b');
      return jsonResponse({ choices: [{ message: { content: 'Large image accepted.' } }] });
    }
    return oldFetch(url, options);
  };
  try {
    const largeImage = 'data:image/jpeg;base64,' + Buffer.alloc(11 * 1024 * 1024, 7).toString('base64');
    await withServer(async (base) => {
      const response = await fetch(base + '/api/vision', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: largeImage, prompt: 'Describe this image.' }),
      });
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.text, 'Large image accepted.');
      assert.equal(upstreamCalled, true);
    });
  } finally {
    global.fetch = oldFetch;
    if (oldKey == null) delete process.env.GROQ_KEY; else process.env.GROQ_KEY = oldKey;
  }
});
