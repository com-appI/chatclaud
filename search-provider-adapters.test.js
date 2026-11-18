'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('../server.js');

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

test('Serper adapter sends its key server-side and normalizes organic search response', async () => {
  const oldKey = process.env.SERPER_KEY;
  const oldFetch = global.fetch;
  process.env.SERPER_KEY = 'test-serper-key';
  global.fetch = async (url, options) => {
    assert.equal(String(url), 'https://google.serper.dev/search');
    assert.equal(options.headers['X-API-KEY'], 'test-serper-key');
    return jsonResponse({ organic: [{ title: 'Example result', link: 'https://example.org', snippet: 'Test snippet' }] });
  };
  try {
    const result = await runtime.serperSearch('example query');
    assert.equal(result.organic[0].link, 'https://example.org');
  } finally {
    global.fetch = oldFetch;
    if (oldKey == null) delete process.env.SERPER_KEY; else process.env.SERPER_KEY = oldKey;
  }
});

test('Tavily adapter sends its key server-side and returns search results', async () => {
  const oldKey = process.env.TAVILY_KEY;
  const oldFetch = global.fetch;
  process.env.TAVILY_KEY = 'test-tavily-key';
  global.fetch = async (url, options) => {
    assert.equal(String(url), 'https://api.tavily.com/search');
    assert.equal(options.headers.Authorization, 'Bearer test-tavily-key');
    return jsonResponse({ results: [{ title: 'Example result', url: 'https://example.org', content: 'Test snippet' }] });
  };
  try {
    const result = await runtime.tavilySearch('example query');
    assert.equal(result.results[0].url, 'https://example.org');
  } finally {
    global.fetch = oldFetch;
    if (oldKey == null) delete process.env.TAVILY_KEY; else process.env.TAVILY_KEY = oldKey;
  }
});
