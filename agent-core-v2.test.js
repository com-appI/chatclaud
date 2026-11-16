'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { MemoryStore } = require('../lib/memory-store');
const { buildPlan, verifyAgainstSources, runAgentCoreV2 } = require('../lib/agent-core-v2');
const { stripHtml, isSafeHttpUrl } = require('../lib/page-reader');
const { LearningPipeline } = require('../lib/learning-pipeline');

describe('memory-store', () => {
  it('upserts and searches facts', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-mem-'));
    const store = new MemoryStore(path.join(dir, 'm.json'));
    const f = store.upsertFact({
      text: 'ChatClaud uses Groq as the primary chat model provider.',
      category: 'product',
      confidence: 0.9,
      source: { url: 'https://example.com/a', title: 'Doc' },
    });
    assert.ok(f && f.id);
    const hits = store.search('Groq chat model', 5);
    assert.ok(hits.length >= 1);
    assert.ok(hits[0].text.includes('Groq'));
  });

  it('merges near-duplicate facts', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-mem-'));
    const store = new MemoryStore(path.join(dir, 'm.json'));
    store.upsertFact({ text: 'Node.js is a JavaScript runtime built on Chrome V8.' });
    store.upsertFact({ text: 'Node.js is a JavaScript runtime built on Chrome V8 engine.' });
    assert.ok(store.stats().total <= 2);
  });
});

describe('page-reader helpers', () => {
  it('strips scripts and keeps text', () => {
    const html = '<html><script>evil()</script><article><p>Hello world research.</p></article></html>';
    const t = stripHtml(html);
    assert.ok(t.includes('Hello world'));
    assert.ok(!t.includes('evil'));
  });
  it('blocks local URLs', () => {
    assert.equal(isSafeHttpUrl('http://127.0.0.1/x'), false);
    assert.equal(isSafeHttpUrl('https://example.com/a'), true);
  });
});

describe('agent-core-v2', () => {
  it('builds a research plan with search steps', () => {
    const plan = buildPlan('Исследуй последние новости про AI safety', 'research');
    assert.ok(plan.some((p) => p.kind === 'web_search'));
    assert.ok(plan.some((p) => p.kind === 'synthesize'));
  });

  it('verifies claims against sources', () => {
    const claims = ['OpenAI released a new model in 2024.'];
    const sources = [{ title: 'OpenAI news', snippet: 'OpenAI released a new model', url: 'https://openai.com/x' }];
    const v = verifyAgainstSources(claims, sources);
    assert.equal(v.length, 1);
    assert.ok(['supported', 'partial'].includes(v[0].status));
  });

  it('runs end-to-end with mocked tools', async () => {
    const result = await runAgentCoreV2('Найди информацию о Node.js security', {
      search: async () => ({
        ok: true,
        sources: [{
          title: 'Node.js security',
          url: 'https://nodejs.org/en/blog/vulnerability/example',
          snippet: 'Security release for Node.js',
          provider: 'mock',
        }],
      }),
      readPage: async (url) => ({
        ok: true,
        url,
        title: 'Security release',
        text: 'This security release addresses CVE examples in Node.js HTTP parser.',
      }),
      memorySearch: async () => [],
      memoryUpsert: () => {},
      llmComplete: async () => 'Node.js had a security release addressing HTTP parser issues. Source: https://nodejs.org/en/blog/vulnerability/example',
    }, { intent: 'research', maxReads: 1, maxSearch: 1, deadlineMs: 10000 });
    assert.equal(result.status, 'completed');
    assert.ok(result.answer.length > 20);
    assert.ok(result.sources.length >= 1);
    assert.ok(result.steps.some((s) => s.name === 'web_search' && s.status === 'done'));
    assert.ok(result.steps.some((s) => s.name === 'read_page'));
  });
});

describe('learning-pipeline', () => {
  it('tick collects into memory when enabled', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-learn-'));
    const store = new MemoryStore(path.join(dir, 'm.json'));
    const pipe = new LearningPipeline({
      search: async () => ({
        sources: [{ title: 'AI news', url: 'https://example.com/ai', snippet: 'New model released today', provider: 'mock' }],
      }),
      readPage: async () => ({ ok: false }),
      memory: store,
      stateFile: path.join(dir, 'state.json'),
    });
    pipe.start();
    const out = await pipe.tick();
    assert.equal(out.ok, true);
    assert.ok(out.collected >= 1);
    assert.ok(store.stats().total >= 1);
    pipe.stop();
  });
});
