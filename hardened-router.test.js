'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../lib/router/hardened');

describe('hardened router classify', () => {
  it('search on найди', () => {
    const d = R.classify([{ role: 'user', content: 'найди новости про AI' }]);
    assert.equal(d.needSearch, true);
  });
  it('no search on hello', () => {
    const d = R.classify([{ role: 'user', content: 'привет' }]);
    assert.equal(d.needSearch, false);
    assert.equal(d.action, 'model');
  });
  it('math arithmetic', () => {
    const d = R.classify([{ role: 'user', content: '2+2*3' }]);
    assert.equal(d.needMath, true);
  });
  it('force search', () => {
    const d = R.classify([{ role: 'user', content: 'tell me about cats' }], { forceSearch: true });
    assert.equal(d.needSearch, true);
  });
});

describe('hardened runTools isolation', () => {
  it('search failure does not throw', async () => {
    const d = R.classify([{ role: 'user', content: 'найди X' }]);
    const out = await R.runTools(d, {
      search: async () => { throw new Error('boom'); },
    });
    assert.ok(out.errors.some((e) => e.tool === 'search'));
  });
  it('merges search context as untrusted', async () => {
    const d = { needSearch: true, needMath: false, query: 'q', action: 'search', reason: 't' };
    const out = await R.runTools(d, {
      search: async () => ({ sources: [{ title: 'T', url: 'https://example.com', snippet: 'hi' }] }),
    });
    const sys = R.mergeToolContext('SYS', out);
    assert.match(sys, /untrusted/i);
    assert.match(sys, /example.com/);
  });
});
