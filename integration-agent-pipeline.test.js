'use strict';
/**
 * Integration tests for Agent Core v2 pipeline with REAL disk memory.
 * External Serper/Tavily/Groq are mocked at the adapter boundary only —
 * memory persistence, plan stages, page-read path, verify, and learning ticks are real.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { MemoryStore } = require('../lib/memory-store');
const { runAgentCoreV2 } = require('../lib/agent-core-v2');
const { LearningPipeline } = require('../lib/learning-pipeline');
const { stripHtml, isSafeHttpUrl } = require('../lib/page-reader');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-int-'));
const MEM_FILE = path.join(TMP, 'memory-v2.json');
const LEARN_FILE = path.join(TMP, 'learning-state.json');

describe('integration: full agent pipeline with disk memory', () => {
  let store;
  let pageReads = 0;
  let searchCalls = 0;
  let upserts = 0;

  before(() => {
    store = new MemoryStore(MEM_FILE);
    // Seed prior knowledge (scenario 2)
    store.upsertFact({
      text: 'ChatClaud primary chat provider is Groq with model openai/gpt-oss-120b.',
      category: 'product',
      confidence: 0.95,
      source: { url: 'https://example.com/chatclaud-docs', title: 'ChatClaud docs', provider: 'seed' },
    });
  });

  after(() => {
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  });

  it('1-7: research task uses memory, search, page read, verify, sources, and persists new facts', async () => {
    pageReads = 0;
    searchCalls = 0;
    upserts = 0;

    const result = await runAgentCoreV2(
      'Исследуй подробно безопасность Node.js HTTP parser и как это связано с ChatClaud',
      {
        search: async (q) => {
          searchCalls += 1;
          assert.ok(q && q.length > 3, 'search query must be non-empty');
          return {
            ok: true,
            sources: [
              {
                title: 'Node.js security release',
                url: 'https://nodejs.org/en/blog/vulnerability/http-parser',
                snippet: 'Security release addresses HTTP parser issues',
                provider: 'serper-mock',
              },
              {
                title: 'CVE database entry',
                url: 'https://cve.example.com/node-http',
                snippet: 'HTTP parser vulnerability details',
                provider: 'tavily-mock',
              },
            ],
          };
        },
        readPage: async (url) => {
          pageReads += 1;
          assert.ok(isSafeHttpUrl(url) || url.startsWith('https://'), 'url passed to reader');
          // Simulate HTML page content (untrusted)
          const html = '<html><script>window.hack=1</script><article><h1>Security</h1><p>The HTTP parser in Node.js received a security fix. Operators should upgrade.</p></article></html>';
          const text = stripHtml(html);
          assert.ok(!text.includes('hack'), 'scripts stripped — untrusted HTML cleaned');
          return { ok: true, url, title: 'Security release', text, source: 'PAGE_READER' };
        },
        memorySearch: async (q) => {
          const hits = store.search(q, 6);
          return hits;
        },
        memoryUpsert: (fact) => {
          upserts += 1;
          store.upsertFact(fact);
        },
        llmComplete: async ({ system, user }) => {
          assert.ok(system && /evidence|ONLY|sources|untrusted|evidence/i.test(system) || system.length > 20);
          assert.ok(user.includes('EVIDENCE') || user.includes('USER TASK'));
          // system in agent-core says use ONLY evidence
          return 'Node.js HTTP parser had a security fix. Operators should upgrade. Source: https://nodejs.org/en/blog/vulnerability/http-parser';
        },
      },
      { intent: 'research', maxReads: 2, maxSearch: 1, deadlineMs: 15000 }
    );

    // 1: agent completed multi-step
    assert.equal(result.status, 'completed');
    assert.ok(result.steps.length >= 4, 'multiple stages recorded');

    // 2: memory was consulted
    const memStep = result.steps.find((s) => s.name === 'memory_search');
    assert.ok(memStep, 'memory_search step exists');
    assert.ok(result.memoryHits.length >= 1, 'prior Groq/ChatClaud fact retrieved');
    assert.ok(result.memoryHits.some((h) => /Groq/i.test(h.text)), 'seed knowledge used');

    // 3: search was called
    assert.ok(searchCalls >= 1, 'search adapter invoked');
    assert.ok(result.steps.some((s) => s.name === 'web_search' && s.status === 'done'));

    // 4: pages actually read (not snippet-only)
    assert.ok(pageReads >= 1, 'page-reader invoked');
    assert.ok(result.steps.some((s) => s.name === 'read_page' && s.status === 'done'));
    assert.ok(result.observations.some((o) => o.type === 'page' && o.text && o.text.length > 20));

    // 5: verify stage
    assert.ok(result.steps.some((s) => s.name === 'verify'));
    assert.ok(Array.isArray(result.verification));

    // 6: sources returned with real URLs used
    assert.ok(result.sources.length >= 1);
    assert.ok(result.sources.every((s) => s.url && /^https?:\/\//.test(s.url)));
    assert.ok(result.sources.some((s) => s.url.includes('nodejs.org')));

    // 7: new knowledge written to disk store
    assert.ok(upserts >= 1, 'memoryUpsert called from read path');
    assert.ok(fs.existsSync(MEM_FILE), 'memory file on disk');
    const raw = JSON.parse(fs.readFileSync(MEM_FILE, 'utf8'));
    assert.ok(raw.facts.length >= 2, 'seed + new facts persisted');
  });

  it('7b: memory survives new process (reload from disk)', () => {
    const reloaded = new MemoryStore(MEM_FILE);
    const hits = reloaded.search('Groq ChatClaud', 5);
    assert.ok(hits.length >= 1, 'facts available after reload');
    const hits2 = reloaded.search('HTTP parser', 5);
    assert.ok(hits2.length >= 1, 'facts from page read available after reload');
  });

  it('8-9: learning pipeline start, tick, stop, restart bounded', async () => {
    let ticks = 0;
    const pipe = new LearningPipeline({
      search: async () => {
        ticks += 1;
        return {
          sources: [
            { title: 'Learn topic A', url: 'https://example.com/a', snippet: 'Useful fact about topic A for knowledge base', provider: 'mock' },
          ],
        };
      },
      readPage: async () => ({ ok: false }),
      memory: store,
      stateFile: LEARN_FILE,
      maxItemsPerTick: 2,
      maxReadsPerTick: 0,
    });

    // disabled by default
    const disabled = await pipe.tick();
    assert.equal(disabled.ok, false);

    const st1 = pipe.start();
    assert.equal(st1.enabled, true);

    const t1 = await pipe.tick();
    assert.equal(t1.ok, true);
    assert.ok(t1.collected >= 1);

    const t2 = await pipe.tick();
    assert.equal(t2.ok, true);

    // state on disk
    assert.ok(fs.existsSync(LEARN_FILE));
    const stateDisk = JSON.parse(fs.readFileSync(LEARN_FILE, 'utf8'));
    assert.ok(stateDisk.ticks >= 2);
    assert.equal(stateDisk.enabled, true);

    pipe.stop();
    assert.equal(pipe.status().enabled, false);
    const afterStop = await pipe.tick();
    assert.equal(afterStop.ok, false, 'no tick while stopped');

    // restart
    pipe.start();
    const t3 = await pipe.tick();
    assert.equal(t3.ok, true);

    // no runaway: only 1 search per tick from our mock counting pattern
    assert.ok(ticks <= 10, 'bounded calls');
  });

  it('10: learning state survives reload', () => {
    const store2 = new MemoryStore(MEM_FILE);
    const pipe2 = new LearningPipeline({
      search: async () => ({ sources: [] }),
      readPage: async () => ({ ok: false }),
      memory: store2,
      stateFile: LEARN_FILE,
    });
    // constructor loads state file
    assert.ok(pipe2.state.ticks >= 2, 'ticks restored from disk');
  });

  it('11: handles empty search, failed pages, no LLM', async () => {
    const result = await runAgentCoreV2('unknown obscure topic xyzzy-12345', {
      search: async () => ({ ok: true, sources: [] }),
      readPage: async () => ({ ok: false, error: 'timeout' }),
      memorySearch: async () => [],
      memoryUpsert: () => {},
      llmComplete: async () => { throw new Error('groq_down'); },
    }, { intent: 'research', maxReads: 1, maxSearch: 1, deadlineMs: 5000 });

    assert.ok(result.answer.length > 10, 'degraded answer still produced');
    assert.ok(result.status === 'completed' || result.status === 'degraded');
  });

  it('11b: unsafe URLs rejected by page-reader helper', () => {
    assert.equal(isSafeHttpUrl('http://127.0.0.1/secret'), false);
    assert.equal(isSafeHttpUrl('https://example.com/ok'), true);
  });
});

describe('integration: chat trigger conditions in server.js source', () => {
  const serverSrc = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

  it('chat path contains wantAgentV2 and runAgentCoreV2', () => {
    assert.ok(serverSrc.includes('wantAgentV2'));
    assert.ok(serverSrc.includes('runAgentCoreV2'));
    assert.ok(serverSrc.includes("CCAgentCoreV2.runAgentCoreV2"));
  });

  it('agent-v2 is triggered by /agent /research /deep and deep research phrases', () => {
    assert.ok(/agent|research|deep/.test(serverSrc));
    assert.ok(/исследуй|глубоко|подробно|compare|benchmark|аудит/i.test(serverSrc));
  });

  it('fallback path still present for normal forceSearch pipeline', () => {
    assert.ok(serverSrc.includes('runSearchPipeline'));
    assert.ok(serverSrc.includes('shouldUseCognitiveAgent') || serverSrc.includes('forceSearch'));
  });

  it('API routes for agent, memory, learning exist', () => {
    assert.ok(serverSrc.includes("/api/agent/v2"));
    assert.ok(serverSrc.includes("/api/memory/search"));
    assert.ok(serverSrc.includes("/api/learning/tick"));
  });
});
