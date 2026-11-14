const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('server provides a Nova-backed search adapter used by /api/search', () => {
  assert.match(server, /async function runSearchPipeline\(query, options\)/);
  assert.match(server, /async function webSearch\(query, type\)/);
  assert.match(server, /await webSearch\(query,/);
  assert.match(server, /const rate = checkRate\(req, isPlusUser\)/);
  assert.match(server, /novaRequest\('\/api\/search'/);
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

const chatclaud = require('../server.js');

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


test('optional Firecrawl adapter uses server-side credentials and developer index for repository queries', async () => {
  const previousKey = process.env.FIRECRAWL_API_KEY;
  const previousFetch = global.fetch;
  const calls = [];
  process.env.FIRECRAWL_API_KEY = 'test-only-secret-not-real';
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { web: [
        { title: 'Repository guide', url: 'https://github.com/example/project', description: 'Developer docs' },
      ] } }),
    };
  };
  try {
    const data = await chatclaud.firecrawlSearch('best open source agent repositories', { maxResults: 6 });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.firecrawl.dev/v2/search');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer test-only-secret-not-real');
    const body = JSON.parse(calls[0].options.body);
    assert.equal(body.query, 'best open source agent repositories');
    assert.deepEqual(body.categories, ['developer']);
    assert.equal(data.success, true);
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.FIRECRAWL_API_KEY;
    else process.env.FIRECRAWL_API_KEY = previousKey;
  }
});
