'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const search = require('../lib/search');

describe('search intent', () => {
  it('RU explicit', () => assert.equal(search.detectSearchIntent('найди информацию о node').needSearch, true));
  it('EN explicit', () => assert.equal(search.detectSearchIntent('search for langchain docs').needSearch, true));
  it('greeting no', () => assert.equal(search.detectSearchIntent('привет').needSearch, false));
  it('math no', () => assert.equal(search.detectSearchIntent('2+2').needSearch, false));
  it('latest mode', () => assert.equal(search.detectSearchIntent('latest news about AI').mode, 'LATEST'));
  it('follow-up', () => {
    const r = search.detectSearchIntent('А что изменилось?', {
      previousUserMessages: ['Найди последнюю версию Node.js'],
    });
    assert.equal(r.needSearch, true);
    assert.equal(r.reason, 'follow_up');
  });
});

describe('query planner', () => {
  it('fast single query', () => {
    const p = search.planQueries('find X');
    assert.ok(p.queries.length >= 1);
    assert.ok(p.queries.length <= 2);
  });
  it('does not explode queries', () => {
    const p = search.planQueries('найди документацию express official');
    assert.ok(p.queries.length <= 4);
  });
});

describe('fusion RRF', () => {
  it('merges and dedupes', () => {
    const a = [{ url: 'https://www.example.com/a?utm_source=x', title: 'A', provider: 'SERPER', rank: 1 }];
    const b = [{ url: 'https://example.com/a', title: 'A2', provider: 'TAVILY', rank: 1 }, { url: 'https://other.com/b', title: 'B', provider: 'TAVILY', rank: 2 }];
    const fused = search.reciprocalRankFusion([a, b]);
    assert.ok(fused.length >= 2);
    assert.equal(fused.filter((x) => x.url.includes('example.com')).length, 1);
  });
  it('canonical strips utm', () => {
    assert.ok(!search.canonicalizeUrl('https://x.com/?utm_source=1').includes('utm_'));
  });
});

describe('evidence', () => {
  it('rejects invented urls', () => {
    const { allowed, rejected } = search.filterCitations(
      [{ url: 'https://fake.example/made-up' }],
      [{ url: 'https://real.example/page', title: 'Real' }]
    );
    assert.equal(allowed.length, 0);
    assert.equal(rejected.length, 1);
  });
  it('allows real urls', () => {
    const { allowed } = search.filterCitations(
      [{ url: 'https://real.example/page', text: 'hello world test' }],
      [{ url: 'https://real.example/page', title: 'Real', snippet: 'hello world test page' }]
    );
    assert.equal(allowed.length, 1);
  });
  it('support score', () => {
    const s = search.claimSupportScore('nodejs version release notes', { snippet: 'nodejs version release notes available' });
    assert.ok(s >= 0.25);
  });
});

describe('search trace', () => {
  it('creates id without secrets', () => {
    const t = search.createTrace({ query: 'x', reason: 'explicit' });
    assert.ok(t.searchTraceId);
    search.markProvider(t, 'SERPER', 'ok', 5);
    const f = search.finalizeTrace(t, { uniqueResults: 5 });
    assert.ok(f.finishedAt);
    assert.equal(f.providersCalled[0], 'SERPER');
  });
});

// volume intentional scenarios
describe('intent volume', () => {
  const yes = ['найди X', 'поищи Y', 'search Z', 'find docs', 'latest news', 'текущая версия react', 'проверь в интернете'];
  const no = ['привет', 'hello', 'спасибо', '3*7', '10+5'];
  for (const q of yes) it('yes ' + q, () => assert.equal(search.detectSearchIntent(q).needSearch, true));
  for (const q of no) it('no ' + q, () => assert.equal(search.detectSearchIntent(q).needSearch, false));
});
