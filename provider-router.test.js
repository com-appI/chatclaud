'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getProviderConfig, nvidiaConfigured, moduleEnabled } = require('../lib/providers/config');
const { createRouter, isRetryable } = require('../lib/providers/router');

function response(body, status = 200, contentType = 'application/json') {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status, headers: { 'Content-Type': contentType },
  });
}

describe('provider config', () => {
  it('keeps NVIDIA as the only primary text provider, ignoring legacy overrides', () => {
    const oldPrimary = process.env.PRIMARY_PROVIDER;
    const oldFallback = process.env.AUTO_FALLBACK;
    process.env.PRIMARY_PROVIDER = 'groq';
    process.env.AUTO_FALLBACK = 'true';
    const cfg = getProviderConfig();
    assert.equal(cfg.primary, 'nvidia');
    assert.equal(cfg.fallbackEnabled, false);
    if (oldPrimary == null) delete process.env.PRIMARY_PROVIDER; else process.env.PRIMARY_PROVIDER = oldPrimary;
    if (oldFallback == null) delete process.env.AUTO_FALLBACK; else process.env.AUTO_FALLBACK = oldFallback;
  });
  it('modules retain their established defaults', () => {
    assert.equal(moduleEnabled('webSearch'), true);
    assert.equal(moduleEnabled('memory'), true);
  });
  it('reports NVIDIA unconfigured without its environment key', () => {
    const prev = process.env.NVIDIA_API_KEY;
    delete process.env.NVIDIA_API_KEY;
    assert.equal(nvidiaConfigured(), false);
    if (prev != null) process.env.NVIDIA_API_KEY = prev;
  });
});

describe('strict NVIDIA router', () => {
  it('uses NVIDIA even if legacy fallback/force-Groq options are supplied', async () => {
    const oldKey = process.env.NVIDIA_API_KEY;
    const oldFallback = process.env.AUTO_FALLBACK;
    const oldFetch = global.fetch;
    process.env.NVIDIA_API_KEY = 'test-nvidia-key';
    process.env.AUTO_FALLBACK = 'true';
    let seenUrl = '';
    global.fetch = async (url, options) => {
      seenUrl = String(url);
      assert.equal(options.headers.Authorization, 'Bearer test-nvidia-key');
      return response({ choices: [{ message: { role: 'assistant', content: 'from-nemotron', reasoning_content: 'private reasoning' } }] });
    };
    try {
      const router = createRouter({ groqChat: async () => { throw new Error('Groq must not be called'); } });
      const out = await router.chat([{ role: 'user', content: 'hello' }], 'system', false, { forceProvider: 'groq' });
      assert.equal(out.text, 'from-nemotron');
      assert.equal(out.provider, 'nvidia');
      assert.match(seenUrl, /integrate\.api\.nvidia\.com\/v1\/chat\/completions$/);
      assert.doesNotMatch(JSON.stringify(out), /private reasoning/);
      assert.deepEqual(router.modelInfo().fallback, null);
    } finally {
      global.fetch = oldFetch;
      if (oldKey == null) delete process.env.NVIDIA_API_KEY; else process.env.NVIDIA_API_KEY = oldKey;
      if (oldFallback == null) delete process.env.AUTO_FALLBACK; else process.env.AUTO_FALLBACK = oldFallback;
    }
  });
  it('does not expose reasoning_content when content is empty', async () => {
    const oldKey = process.env.NVIDIA_API_KEY;
    const oldFetch = global.fetch;
    process.env.NVIDIA_API_KEY = 'test-nvidia-key';
    global.fetch = async () => response({ choices: [{ message: { content: '', reasoning_content: 'do not expose this' } }] });
    try {
      const router = createRouter({});
      await assert.rejects(() => router.chat([{ role: 'user', content: 'hi' }], 'sys', true), /nvidia_empty_response/);
    } finally {
      global.fetch = oldFetch;
      if (oldKey == null) delete process.env.NVIDIA_API_KEY; else process.env.NVIDIA_API_KEY = oldKey;
    }
  });
  it('isRetryable detects transient status but excludes auth failure', () => {
    assert.equal(isRetryable({ status: 429 }), true);
    assert.equal(isRetryable({ status: 401 }), false);
  });
});
