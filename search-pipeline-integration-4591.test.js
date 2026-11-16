'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const EventEmitter = require('node:events');
const http = require('node:http');
const server = require('../server');
const search = require('../lib/search');

function jsonResponse(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}

async function withEnv(values, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value === null) delete process.env[key];
    else process.env[key] = value;
  }
  try { return await fn(); }
  finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('main pipeline calls RRF, validates citations and finalizes a real search trace', async () => {
  const requests = [];
  const result = await server.runSearchPipeline('ChatClaud search pipeline', {
    queries: ['ChatClaud search pipeline', 'ChatClaud search architecture'],
    maxSearchCalls: 2,
    maxResults: 8,
    maxFetch: 0,
    expand: false,
    request: async (endpoint, body) => {
      requests.push({ endpoint, query: body.q });
      if (body.q.includes('architecture')) return { organic: [
        { title: 'Unified search architecture', link: 'https://docs.example.test/search', snippet: 'Query planning ranking fusion and evidence validation.' },
        { title: 'Search pipeline guide', link: 'https://guide.example.test/pipeline', snippet: 'Search pipeline source extraction and citation validation.' },
      ] };
      return { organic: [
        { title: 'Search pipeline guide', link: 'https://guide.example.test/pipeline?utm_source=serper', snippet: 'Search pipeline source extraction and citation validation.' },
        { title: 'Search intelligence overview', link: 'https://research.example.test/overview', snippet: 'RRF fusion across multiple providers improves search ranking.' },
      ] };
    },
  });

  assert.equal(requests.length, 2);
  assert.equal(result.stats.searchCalls, 2);
  assert.equal(result.stats.rrfLists, 2);
  assert.ok(result.sources.length >= 2);
  assert.ok(result.sources.every((source) => Number.isInteger(source.fusionRank) && source.fusionRank > 0));
  assert.ok(result.searchTrace.searchTraceId);
  assert.equal(result.searchTrace.status, 'completed');
  assert.ok(result.searchTrace.providersCalled.includes('TEST_ADAPTER'));
  assert.equal(result.searchTrace.providerStatus.TEST_ADAPTER, 'ok');
  assert.ok(result.searchTrace.events.some((event) => event.step === 'citation-validation'));
  assert.equal(result.evidence.citationUrlsRejected, 0);
});

test('Serper and Tavily provider lists are actually fused inside runSearchPipeline', async () => {
  const previousFetch = global.fetch;
  const calls = [];
  await withEnv({ SERPER_KEY: 'serper-integration-secret', TAVILY_KEY: 'tavily-integration-secret' }, async () => {
    global.fetch = async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).includes('google.serper.dev')) return jsonResponse({ organic: [
        { title: 'Shared result from Serper', link: 'https://shared.example.test/page', snippet: 'Same source returned by both web providers.' },
        { title: 'Serper unique result', link: 'https://serper.example.test/page', snippet: 'Serper provider result for integration testing.' },
      ] });
      if (String(url).includes('api.tavily.com/search')) return jsonResponse({ results: [
        { title: 'Shared result from Tavily', url: 'https://shared.example.test/page?utm_medium=test', content: 'Same source returned by both web providers.', score: 0.94 },
        { title: 'Tavily unique result', url: 'https://tavily.example.test/page', content: 'Tavily provider result for integration testing.', score: 0.83 },
      ] });
      throw new Error('Unexpected network request: ' + url);
    };
    const result = await server.runSearchPipeline('Search integration test', {
      maxSearchCalls: 1, maxResults: 6, maxFetch: 0, expand: false,
    });
    assert.equal(calls.length, 2);
    assert.equal(result.stats.providerRequests, 2);
    assert.equal(result.stats.rrfLists, 2);
    assert.ok(result.sources.some((source) => source.url === 'https://shared.example.test/page'));
    assert.equal(result.sources.filter((source) => source.url === 'https://shared.example.test/page').length, 1);
    assert.equal(result.searchTrace.providerStatus.SERPER, 'ok');
    assert.equal(result.searchTrace.providerStatus.TAVILY, 'ok');
    assert.ok(result.searchTrace.events.filter((event) => event.step === 'provider').length >= 2);
  }).finally(() => { global.fetch = previousFetch; });
});

test('command prefixes are removed before provider queries', async () => {
  const queries = await server.planSearchQueries('find OpenAI model documentation', {
    maxSearchCalls: 1, expand: false,
  });
  assert.deepEqual(queries, ['OpenAI model documentation']);
});

test('URL canonicalization fails closed for unsafe schemes, credentials and private address ranges', () => {
  for (const url of [
    'javascript:alert(1)',
    'ftp://example.com/file',
    'http://user:pass@example.com/',
    'http://127.0.0.1/admin',
    'http://2130706433/admin',
    'http://192.168.1.10/',
    'http://[::1]/',
    'http://[fd00::1]/',
    'http://[::ffff:7f00:1]/',
  ]) assert.equal(search.canonicalizeUrl(url), '', url);
  assert.equal(search.canonicalizeUrl('https://www.example.com/docs?utm_source=x#top'), 'https://example.com/docs');
});

test('trusted-domain boosts require an exact domain boundary', () => {
  assert.ok(search.domainTrust('github.com') > 0);
  assert.ok(search.domainTrust('docs.github.com') > 0);
  assert.equal(search.domainTrust('evilgithub.com'), 0);
  assert.equal(search.domainTrust('github.com.attacker.test'), 0);
  assert.equal(search.domainTrust('example.gov.attacker.test'), 0);
});

test('evidence scoring rejects changed numeric claims and labels lexical matches honestly', () => {
  const source = {
    url: 'https://data.example.test/report',
    text: 'The benchmark reported a latency of 120 milliseconds across the measured workload.',
  };
  const checks = search.verifyClaimsAgainstSources([
    { url: source.url, text: 'The benchmark reported a latency of 120 milliseconds.' },
    { url: source.url, text: 'The benchmark reported a latency of 220 milliseconds.' },
  ], [source]);
  assert.equal(checks[0].supported, true);
  assert.equal(checks[0].evidenceLevel, 'textual_match_not_fact_proof');
  assert.equal(checks[1].supported, false);
  assert.equal(checks[1].reason, 'insufficient_textual_support');
});

test('private and mapped IPv6 address checks are blocked', () => {
  for (const ip of ['127.0.0.1', '10.0.0.1', '192.168.1.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:7f00:1']) {
    assert.equal(search.isPrivateIp(ip), true, ip);
  }
  assert.equal(search.isPrivateIp('8.8.8.8'), false);
  assert.equal(server.isSafeUrl('http://127.0.0.1/'), false);
  assert.equal(server.isSafeUrl('http://[::ffff:7f00:1]/'), false);
  assert.equal(server.isSafeUrl('https://example.com/'), true);
});

test('DNS checks reject mixed public/private answers and the HTTP socket pins to a checked address', async () => {
  const safe = await server.resolvePublicAddresses('http://example.test/page', async () => [
    { address: '8.8.8.8', family: 4 },
  ]);
  assert.deepEqual(safe, [{ address: '8.8.8.8', family: 4 }]);
  const mixed = await server.resolvePublicAddresses('http://example.test/page', async () => [
    { address: '8.8.8.8', family: 4 },
    { address: '10.0.0.5', family: 4 },
  ]);
  assert.deepEqual(mixed, []);

  const originalRequest = http.request;
  let requestOptions;
  try {
    http.request = (options, onResponse) => {
      requestOptions = options;
      const req = new EventEmitter();
      req.setTimeout = () => {};
      req.end = () => {
        const response = new EventEmitter();
        response.statusCode = 200;
        response.headers = { 'content-type': 'text/plain' };
        process.nextTick(() => {
          onResponse(response);
          response.emit('data', Buffer.from('Pinned response body'));
          response.emit('end');
        });
      };
      req.destroy = (error) => { if (error) process.nextTick(() => req.emit('error', error)); };
      return req;
    };
    const response = await server.fetchPinnedWithTimeout('http://example.test/page', {}, 5000, async () => [
      { address: '8.8.8.8', family: 4 },
    ]);
    assert.equal(await response.text(), 'Pinned response body');
    assert.equal(requestOptions.hostname, 'example.test');
    assert.equal(requestOptions.servername, undefined);
    assert.equal(requestOptions.lookup('example.test', {}, (error, address, family) => {
      assert.equal(error, null);
      assert.equal(address, '8.8.8.8');
      assert.equal(family, 4);
    }), undefined);
  } finally {
    http.request = originalRequest;
  }
});

test('main request handler wires the shared intent router, not just helper exports', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const pipelineStart = source.indexOf('async function runSearchPipeline(');
  const pipelineEnd = source.indexOf('\nasync function webSearch(', pipelineStart);
  assert.ok(pipelineStart >= 0 && pipelineEnd > pipelineStart);
  const pipeline = source.slice(pipelineStart, pipelineEnd);
  for (const required of [
    'CCSearch.detectSearchIntent',
    'planSearchQueries(q',
    'rankWithReciprocalFusion(rawItems',
    'CCSearch.filterCitations',
    'CCSearch.verifyClaimsAgainstSources',
    'CCSearch.createTrace',
    'CCSearch.finalizeTrace',
  ]) assert.ok(pipeline.includes(required), 'missing integration: ' + required);
  const plannerStart = source.indexOf('async function planSearchQueries(');
  const plannerEnd = source.indexOf('\nasync function runSearchPipeline(', plannerStart);
  const planner = source.slice(plannerStart, plannerEnd);
  assert.ok(planner.includes('CCSearch.planQueries'), 'shared query planner is not invoked');
  const fusionStart = source.indexOf('function rankWithReciprocalFusion(');
  const fusionEnd = source.indexOf('\nasync function planSearchQueries(', fusionStart);
  assert.ok(source.slice(fusionStart, fusionEnd).includes('CCSearch.reciprocalRankFusion'), 'RRF helper is not invoked');
  assert.match(source, /const routedChatIntent = CCSearch\.detectSearchIntent/);
  assert.match(source, /if \(webSearchTraceForClient\) result\.searchTrace = webSearchTraceForClient/);
  assert.match(source, /if \(webSearchEvidenceForClient\) result\.searchEvidence = webSearchEvidenceForClient/);
});
