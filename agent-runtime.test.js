'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const server = require('../server.js');
const { intel } = server;

test('safe calculator handles arithmetic without evaluating JavaScript', () => {
  assert.equal(server.evaluateSafeExpression('2 + 3 * (4 - 1)').value, 11);
  assert.equal(server.evaluateSafeExpression('2^3^2').value, 512);
  assert.equal(server.evaluateSafeExpression('-2^2').value, -4);
  assert.throws(() => server.evaluateSafeExpression('1/0'), /division_by_zero/);
  assert.throws(() => server.evaluateSafeExpression('process.exit()'), /invalid_character/);
});

test('calculator is an allowlisted, validated agent tool', async () => {
  const validated = intel.validateToolInput('calculator', { expression: '10 / 2 + 7' });
  assert.equal(validated.ok, true);
  const registry = intel.createToolRegistry({
    calculator: async ({ expression }) => server.evaluateSafeExpression(expression),
  });
  const result = await registry.call('calculator', { expression: '10 / 2 + 7' });
  assert.equal(result.ok, true);
  assert.equal(result.result.value, 12);
  assert.equal((await registry.call('shell', {})).error, 'unknown_tool');
});

test('agent graph performs bounded action-observation transitions and records receipts', async () => {
  const calls = [];
  const result = await intel.runAgentGraph('compare two topics', {
    nextAction: async (state, initial) => {
      calls.push(initial ? 'plan' : 'decide');
      if (initial) return {
        plan: ['Collect evidence', 'Synthesize findings'],
        next_action: { type: 'tool', name: 'search', input: { query: 'topic A' } },
      };
      return { next_action: { type: 'final', answer: 'Evidence-based result.' } };
    },
    executeTool: async () => ({ ok: true, result: { sources: [{ title: 'Source', url: 'https://example.com', snippet: 'Evidence' }] } }),
    review: async () => ({ verdict: 'pass' }),
  }, { maxSteps: 4, maxToolCalls: 2 });

  assert.equal(result.ok, true);
  assert.equal(result.answer, 'Evidence-based result.');
  assert.equal(result.state.toolCalls, 1);
  assert.equal(result.state.receipts[0].id, 'r1');
  assert.equal(result.state.receipts[0].status, 'completed');
  assert.ok(result.state.transitions.some((x) => x.node === 'observe'));
  assert.ok(result.state.transitions.some((x) => x.node === 'review'));
  assert.deepEqual(calls, ['plan', 'decide']);
});

test('agent graph cannot execute a tool outside its allowlist', async () => {
  const result = await intel.runAgentGraph('unsafe task', {
    nextAction: async () => ({ next_action: { type: 'tool', name: 'shell', input: { command: 'whoami' } } }),
    executeTool: async () => { throw new Error('must not run'); },
    synthesize: async () => 'Stopped safely.',
  }, { maxSteps: 2, maxToolCalls: 1 });
  assert.equal(result.ok, true);
  assert.equal(result.state.toolCalls, 0);
  assert.ok(result.state.errors.includes('agent_action_invalid'));
});

test('agent mode routing only activates for explicit or complex requests', () => {
  assert.equal(server.shouldUseCognitiveAgent({}, [{ role: 'user', content: 'Привет' }]), false);
  assert.equal(server.shouldUseCognitiveAgent({}, [{ role: 'user', content: 'Сравни два подхода и обоснуй выбор для нашего проекта.' }]), true);
  assert.equal(server.shouldUseCognitiveAgent({ mode: 'agent' }, [{ role: 'user', content: 'Привет' }]), true);
  assert.equal(server.shouldUseCognitiveAgent({}, [{ role: 'user', content: '/agent проверь архитектуру проекта' }]), true);
});

test('agent JSON parser accepts raw objects and safely rejects malformed text', () => {
  assert.deepEqual(server.parseAgentJson('{"next_action":{"type":"final","answer":"ok"}}'), {
    next_action: { type: 'final', answer: 'ok' },
  });
  assert.equal(server.parseAgentJson('not json'), null);
});


test('agent tool budget is enforced even if the controller keeps requesting tools', async () => {
  let decisions = 0;
  let executions = 0;
  const result = await intel.runAgentGraph('budget task', {
    nextAction: async () => {
      decisions += 1;
      return { plan: ['Use one tool'], next_action: { type: 'tool', name: 'calculator', input: { expression: '1+1' } } };
    },
    executeTool: async () => { executions += 1; return { ok: true, result: { value: 2 } }; },
    synthesize: async () => 'Finished within the budget.',
  }, { maxSteps: 6, maxToolCalls: 1 });
  assert.equal(result.ok, true);
  assert.equal(executions, 1);
  assert.equal(result.state.toolCalls, 1);
  assert.ok(result.state.errors.includes('agent_execution_budget_reached'));
  assert.equal(decisions, 1);
});
