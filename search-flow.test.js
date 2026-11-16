'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const serverText = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const chatclaud = require('../server.js');

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  };
}

function withEnv(changes, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(changes)) {
    previous[key] = process.env[key];
    if (value === null) delete process.env[key];
    else process.env[key] = value;
  }
  return Promise.resolve().then(fn).finally(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test('server provides the direct Serper/Tavily hybrid adapter used by /api/search', () => {
  assert.match(serverText, /async function searchProvidersQuery\(query, type, options\)/);
  assert.match(serverText, /async function runSearchPipeline\(query, options\)/);
  assert.match(serverText, /async function webSearch\(query, type\)/);
  assert.match(serverText, /await webSearch\(query,/);
  assert.match(serverText, /const rate = checkRate\(req, isPlusUser\)/);
  assert.match(serverText, /https:\/\/google\.serper\.dev\//);
  assert.match(serverText, /https:\/\/api\.tavily\.com\/search/);
  assert.doesNotMatch(serverText, /novaRequest|api\.firecrawl\.dev|api\.serper\.live/i);
});

test('browser does not create duplicate thinking rows for one request', () => {
  assert.match(html, /Render a single fixed status pill/);
  assert.doesNotMatch(html, /box\.appendChild\(el\); try \{ box\.scrollTop/);
});

test('public error mapping has no undeclared response-data reference', () => {
  const start = html.indexOf('function ccPublicError(err)');
  const end = html.indexOf('\n        }', start);
  assert.ok(start >= 0 && end > start);
  const mapper = html.slice(start, end);
  assert.doesNotMatch(mapper, /\bdata\s*&&/);
});

test('adaptive hybrid search expands in stages from 4 to 10 to 20 only while evidence stays weak', async () => {
  const calls = [];
  const statusStages = [];
  const seeds = Array.from({ length: 20 }, (_, i) => 'focused search angle ' + (i + 1));
  const result = await chatclaud.runSearchPipeline(seeds[0], {
    queries: seeds,
    maxSearchCalls: 20,
    maxResults: 8,
    maxFetch: 0,
    deadlineMs: 5000,
    request: async (endpoint, body) => {
      calls.push({ endpoint, q: body.q });
      return { organic: [] };
    },
    onStatus: (state, meta) => { if (state === 'searching') statusStages.push(meta.stage); },
  });
  assert.equal(result.stats.searchCalls, 20);
  assert.equal(calls.filter((x) => x.endpoint === '/api/search').length, 20);
  assert.deepEqual(statusStages, [4, 10, 20]);
});

test('search pipeline runs focused queries in parallel, deduplicates, ranks and fetches source pages', async () => {
  const calls = [];
  const request = async (endpoint, body) => {
    calls.push({ endpoint, body });
    if (endpoint === '/api/search') {
      if (body.q.includes('memory')) return { organic: [
        { title: 'Agent memory architecture', url: 'https://docs.example.net/memory', snippet: 'Persistent memory and context management for agents.' },
      ] };
      return { organic: [
        { title: 'ChatClaud agent architecture', link: 'https://example.com/docs?utm_source=search', snippet: 'ChatClaud planning, tools, and agent architecture.' },
        { title: 'Open agent architecture', link: 'https://docs.example.net/agents', snippet: 'Planning delegation and tool use.' },
        { title: 'Private address should be ignored', link: 'http://127.0.0.1/admin', snippet: 'ChatClaud internal server.' },
        { title: 'Duplicate result', link: 'https://example.com/docs', snippet: 'Duplicate canonical URL.' },
      ] };
    }
    if (endpoint === '/api/fetch-url') return {
      ok: true, title: 'Fetched evidence',
      text: ('This is fetched page content with architecture, planning, memory, and agent delegation details. ').repeat(3),
    };
    throw new Error('unexpected endpoint');
  };

  const result = await chatclaud.runSearchPipeline('ChatClaud agent architecture', {
    queries: ['ChatClaud agent architecture', 'agent memory architecture'],
    maxSearchCalls: 2, maxResults: 6, maxFetch: 2, expand: false, request,
  });

  assert.equal(result.stats.searchCalls, 2);
  assert.equal(calls.filter((x) => x.endpoint === '/api/search').length, 2);
  assert.equal(calls.filter((x) => x.endpoint === '/api/fetch-url').length, 2);
  assert.equal(new Set(result.sources.map((x) => x.url)).size, result.sources.length);
  assert.ok(result.sources.every((x) => !x.url.includes('127.0.0.1')));
  assert.ok(result.sources.some((x) => x.fetched && x.text.length > 80));
  assert.match(result.context, /Fetched page text/);
});

test('Serper and Tavily execute in parallel with backend-only authentication', async () => {
  const previousFetch = global.fetch;
  const calls = [];
  await withEnv({ SERPER_KEY: 'serper-test-secret', TAVILY_KEY: 'tavily-test-secret' }, async () => {
    global.fetch = async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).includes('google.serper.dev')) return jsonResponse({ organic: [
        { title: 'Serper result', link: 'https://serper.example/docs', snippet: 'Serper test evidence.' },
      ] });
      if (String(url).includes('api.tavily.com/search')) return jsonResponse({ results: [
        { title: 'Tavily result', url: 'https://tavily.example/docs', content: 'Tavily test evidence.', score: 0.91 },
      ] });
      throw new Error('unexpected provider URL');
    };
    const result = await chatclaud.runSearchPipeline('ChatClaud', {
      queries: ['ChatClaud'], maxSearchCalls: 1, maxResults: 6, maxFetch: 0, expand: false,
    });
    assert.equal(calls.length, 2);
    const serper = calls.find((call) => call.url.includes('google.serper.dev'));
    const tavily = calls.find((call) => call.url.includes('api.tavily.com/search'));
    assert.ok(serper);
    assert.ok(tavily);
    assert.equal(serper.options.headers['X-API-KEY'], 'serper-test-secret');
    assert.equal(JSON.parse(serper.options.body).q, 'ChatClaud');
    assert.equal(tavily.options.headers.Authorization, 'Bearer tavily-test-secret');
    const tavilyBody = JSON.parse(tavily.options.body);
    assert.equal(tavilyBody.query, 'ChatClaud');
    assert.equal(Object.hasOwn(tavilyBody, 'api_key'), false);
    assert.equal(result.stats.providerRequests, 2);
    assert.equal(result.stats.providerResults.SERPER, 1);
    assert.equal(result.stats.providerResults.TAVILY, 1);
    assert.ok(result.sources.some((source) => source.url === 'https://serper.example/docs'));
    assert.ok(result.sources.some((source) => source.url === 'https://tavily.example/docs'));
  }).finally(() => { global.fetch = previousFetch; });
});

test('Tavily Extract reads a public URL as Markdown using server-side bearer auth', async () => {
  const previousFetch = global.fetch;
  const calls = [];
  await withEnv({ TAVILY_KEY: 'tavily-extract-test-secret' }, async () => {
    global.fetch = async (url, options) => {
      calls.push({ url: String(url), options });
      return jsonResponse({ results: [{
        url: 'https://docs.example.org/guide', title: 'Guide', raw_content: '# Guide\nPublic page text.',
      }], failed_results: [] });
    };
    const result = await chatclaud.tavilyExtract(['https://docs.example.org/guide'], { timeoutMs: 5000 });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.tavily.com/extract');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer tavily-extract-test-secret');
    assert.deepEqual(JSON.parse(calls[0].options.body), {
      urls: ['https://docs.example.org/guide'], format: 'markdown',
    });
    assert.match(result.results[0].raw_content, /Public page text/);
  }).finally(() => { global.fetch = previousFetch; });
});


test('a failed provider does not discard valid results from the other provider', async () => {
  const previousFetch = global.fetch;
  const calls = [];
  await withEnv({ SERPER_KEY: 'serper-test-secret', TAVILY_KEY: 'tavily-test-secret' }, async () => {
    global.fetch = async (url, options) => {
      calls.push(String(url));
      if (String(url).includes('google.serper.dev')) return jsonResponse({ error: 'temporarily unavailable' }, 503);
      return jsonResponse({ results: [
        { title: 'Tavily fallback source', url: 'https://tavily.example/fallback', content: 'A valid source still remains available.', score: 0.82 },
      ] });
    };
    const result = await chatclaud.runSearchPipeline('ChatClaud fallback', {
      queries: ['ChatClaud fallback'], maxSearchCalls: 1, maxResults: 5, maxFetch: 0, expand: false,
    });
    assert.equal(calls.length, 2);
    assert.ok(result.sources.some((source) => source.url === 'https://tavily.example/fallback'));
    assert.equal(result.stats.providerResults.TAVILY, 1);
    assert.equal(result.stats.providerRequests, 1);
  }).finally(() => { global.fetch = previousFetch; });
});

test('hybrid retrieval bounds concurrent search groups while providers stay parallel', async () => {
  const previousFetch = global.fetch;
  let active = 0;
  let peak = 0;
  await withEnv({ SERPER_KEY: 'serper-test-secret', TAVILY_KEY: 'tavily-test-secret' }, async () => {
    global.fetch = async (url) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 6));
      active -= 1;
      return String(url).includes('google.serper.dev')
        ? jsonResponse({ organic: [] })
        : jsonResponse({ results: [] });
    };
    const queries = Array.from({ length: 10 }, (_, index) => 'bounded query ' + (index + 1));
    const result = await chatclaud.runSearchPipeline(queries[0], {
      queries, maxSearchCalls: 10, maxResults: 6, maxFetch: 0, expand: false,
    });
    assert.equal(result.stats.searchCalls, 10);
    assert.equal(result.stats.providerRequests, 20);
    assert.ok(peak > 2, 'the two providers should overlap');
    assert.ok(peak <= 12, 'six query groups times two providers is the concurrency ceiling');
  }).finally(() => { global.fetch = previousFetch; });
});

test('search URL canonicalization removes tracking parameters but preserves meaningful query values', () => {
  assert.equal(
    chatclaud.searchNormalizeUrl('https://Example.com/path/?q=chatclaud&utm_source=news#top'),
    'https://example.com/path?q=chatclaud'
  );
  assert.notEqual(
    chatclaud.searchNormalizeUrl('https://example.com/page?id=1'),
    chatclaud.searchNormalizeUrl('https://example.com/page?id=2')
  );
  assert.equal(chatclaud.searchNormalizeUrl('http://127.0.0.1/private'), '');
});

test('relevance ranking prefers title and snippet matches and limits same-domain repetition', () => {
  const results = chatclaud.rankAndDedupeSearchResults([
    { title: 'Random page', url: 'https://random.example/a', snippet: 'Unrelated topic' },
    { title: 'ChatClaud search architecture', url: 'https://one.example/guide', snippet: 'Agent retrieval and ranking' },
    { title: 'ChatClaud search memory', url: 'https://one.example/memory', snippet: 'Memory retrieval and planning' },
    { title: 'ChatClaud search official guide', url: 'https://two.example/docs', snippet: 'Architecture and search ranking' },
  ], ['ChatClaud search architecture'], 3);
  assert.equal(results.length, 3);
  assert.equal(results[0].domain, 'one.example');
  assert.ok(results.some((x) => x.domain === 'two.example'));
});
