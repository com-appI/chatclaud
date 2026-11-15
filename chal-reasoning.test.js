'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  routeTask,
  buildAdaptivePlan,
  independentVerify,
  extractSimpleEquation,
  evalSafeArithmetic,
  runChal,
} = require('../lib/chal-reasoning');

describe('CHAL router', () => {
  it('routes math', () => {
    assert.equal(routeTask('Сколько будет 17 + 25?').type, 'math');
  });
  it('routes logic', () => {
    assert.equal(routeTask('Если все люди смертны, и Сократ человек, то...').type, 'logic');
  });
  it('routes research', () => {
    assert.equal(routeTask('Найди последние новости про Node.js security').type, 'research');
  });
  it('routes code', () => {
    assert.equal(routeTask('Исправь bug в function foo() { return x }').type, 'code');
  });
  it('routes chat default', () => {
    assert.equal(routeTask('Привет!').type, 'chat');
  });
});

describe('CHAL math helpers', () => {
  it('evaluates safe arithmetic', () => {
    assert.equal(evalSafeArithmetic('12 + 30'), 42);
    assert.equal(evalSafeArithmetic('100 / 4'), 25);
  });
  it('rejects unsafe expressions', () => {
    assert.equal(evalSafeArithmetic('process.exit(1)'), null);
    assert.equal(evalSafeArithmetic('require("fs")'), null);
  });
  it('extracts equation consistency', () => {
    const eq = extractSimpleEquation('7 + 5 = 12');
    assert.ok(eq);
    assert.equal(eq.result, 12);
    assert.equal(eq.consistent, true);
    const bad = extractSimpleEquation('7 + 5 = 13');
    assert.equal(bad.consistent, false);
  });
});

describe('CHAL verifier', () => {
  it('flags arithmetic mismatch', () => {
    const v = independentVerify('The sum is 13', { task: '7 + 5 = 13', taskType: 'math' });
    assert.ok(v.issues.some((i) => i.kind === 'arithmetic'));
  });
  it('accepts solid short answers for chat', () => {
    const v = independentVerify('Hello, how can I help?', { taskType: 'chat' });
    assert.equal(v.ok, true);
  });
});

describe('CHAL planner', () => {
  it('math plan includes compute and verify', () => {
    const plan = buildAdaptivePlan('math', '2+2');
    assert.ok(plan.some((p) => p.kind === 'compute'));
    assert.ok(plan.some((p) => p.kind === 'verify'));
  });
  it('chat plan is short', () => {
    const plan = buildAdaptivePlan('chat', 'hi');
    assert.ok(plan.length <= 3);
  });
});

describe('CHAL run pipeline', () => {
  it('solves simple math without LLM', async () => {
    const r = await runChal('17 + 25', {
      llmComplete: async () => '',
    }, { maxLlmCalls: 0, taskType: 'math' });
    assert.ok(String(r.answer).includes('42') || (r.localMath && r.localMath.result === 42));
    assert.ok(r.steps.length >= 2);
  });

  it('runs analysis with mocked LLM and verify', async () => {
    const r = await runChal('Почему кэширование ускоряет API?', {
      llmComplete: async ({ user }) => {
        if (/verifier|critique|VALID/i.test(user) || /independent/i.test(user)) return 'VALID';
        return 'Caching reduces repeated work, lowering latency when data is reused.';
      },
    }, { maxLlmCalls: 2, taskType: 'analysis', useHypotheses: false });
    assert.equal(r.status, 'completed');
    assert.ok(r.answer.length > 20);
    assert.ok(r.verification);
  });

  it('research path calls search adapter', async () => {
    let searched = false;
    const r = await runChal('Найди информацию о HTTP parser security', {
      search: async () => {
        searched = true;
        return { sources: [{ title: 'Node security', url: 'https://nodejs.org/sec', snippet: 'fix' }] };
      },
      readPage: async () => ({ ok: false }),
      memorySearch: async () => [],
      llmComplete: async () => 'Based on sources, a security fix was published.',
    }, { maxLlmCalls: 1, taskType: 'research', useHypotheses: false });
    assert.ok(searched);
    assert.ok(r.sources.length >= 1);
  });
});

/** Benchmark-style cases (public set) */
describe('CHAL benchmark public set', () => {
  const cases = [
    { id: 'math-1', q: 'What is 19 * 3?', type: 'math', expectIncludes: '57' },
    { id: 'math-2', q: '12 + 8 = 20?', type: 'math', check: (r) => r.localMath && r.localMath.consistent === true },
    { id: 'logic-route', q: 'Если все A это B, и все B это C, то все A это C?', type: 'logic' },
    { id: 'code-route', q: 'Find the bug: function add(a,b){ return a - b }', type: 'code' },
    { id: 'research-route', q: 'Search for current Node.js LTS version', type: 'research' },
    { id: 'uncertainty', q: 'Возможно ли, что это совпадение?', type: 'uncertainty' },
    { id: 'analysis', q: 'Проанализируй trade-off между latency и consistency', type: 'analysis' },
    { id: 'chat', q: 'Hello there', type: 'chat' },
  ];

  for (const c of cases) {
    it('route:' + c.id, () => {
      const r = routeTask(c.q);
      assert.equal(r.type, c.type);
    });
  }

  it('math-1 end answer', async () => {
    const r = await runChal('What is 19 * 3?', { llmComplete: async () => '' }, { maxLlmCalls: 0, taskType: 'math' });
    assert.ok(String(r.answer).includes('57') || (r.localMath && r.localMath.result === 57));
  });
});
