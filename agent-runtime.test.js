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
  const result = await registry.call('calculator', { expression: '10 / 2 + 7' }, { permissions: ['compute'] });
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


test('agent registry supports safe multi-query search and bounded delegated research', () => {
  const search = intel.validateToolInput('search', {
    query: 'primary query', queries: ['primary query', 'second focused angle', 'third angle', 'ignored fourth'], maxResults: 6,
  });
  assert.equal(search.ok, true);
  assert.deepEqual(search.input.queries, ['primary query', 'second focused angle', 'third angle']);
  const delegated = intel.validateToolInput('delegate_research', {
    tasks: [
      { role: 'official', query: 'official documentation and design' },
      { role: 'countercheck', query: 'independent limitations and critiques' },
      { role: 'extra', query: 'additional implementation examples' },
      { role: 'ignored', query: 'this fourth worker must be ignored' },
    ],
  });
  assert.equal(delegated.ok, true);
  assert.equal(delegated.input.tasks.length, 3);
  assert.equal(intel.normalizeAgentAction({ type: 'tool', name: 'delegate_research', input: { tasks: [] } }).name, 'delegate_research');
  assert.ok(intel.listTools().some((x) => x.name === 'delegate_research'));
  assert.equal(intel.validateToolInput('delegate_research', { tasks: [{ query: 'only one worker' }] }).ok, false);
});


test('tool registry requires explicit permissions and validates handler output', async () => {
  const registry = intel.createToolRegistry({ calculator: async () => ({ value: 'not-a-number' }) });
  const denied = await registry.call('calculator', { expression: '1+1' });
  assert.equal(denied.errorCode, 'TOOL_PERMISSION_DENIED');
  const invalid = await registry.call('calculator', { expression: '1+1' }, { permissions: ['compute'] });
  assert.equal(invalid.errorCode, 'INVALID_TOOL_OUTPUT');
});

test('tool registry enforces timeout and clears its timer', async () => {
  const registry = intel.createToolRegistry({ calculator: async () => new Promise(() => {}) });
  const result = await registry.call('calculator', { expression: '1+1' }, { permissions: ['compute'], stepTimeoutMs: 100 });
  assert.equal(result.errorCode, 'TOOL_TIMEOUT');
  assert.equal(registry.getCallCounts().calculator, 1);
});

test('agent task record carries stable task id, plan steps and completion state', async () => {
  const result = await intel.runAgentGraph('track this task', {
    nextAction: async (_state, initial) => initial
      ? { plan: ['Collect evidence', 'Write answer'], next_action: { type: 'final', answer: 'Done.' } }
      : { next_action: { type: 'final', answer: 'Done.' } },
    review: async () => ({ verdict: 'pass' }),
  }, { requestId: 'req-test-123', intent: { intent: 'question', complexity: 'MEDIUM' } });
  assert.equal(result.state.taskRecord.taskId, 'req-test-123');
  assert.equal(result.state.taskRecord.status, 'completed');
  assert.ok(Array.isArray(result.state.taskRecord.steps));
  assert.ok(result.state.taskRecord.updatedAt);
});

test('v1.6.0 intent router distinguishes continuation and multi-step tasks', () => {
  assert.equal(intel.classifyIntent('Продолжай с прошлого этапа', { hasContext: true }).intent, 'continuation');
  assert.equal(intel.classifyIntent('Продолжай с прошлого этапа', { hasContext: false }).intent, 'question');
  const route = intel.classifyIntent('Сначала проведи аудит, затем исправь код и протестируй сборку');
  assert.equal(route.intent, 'multi_step');
  assert.equal(route.complexity, 'MULTI_STEP');
});

test('v1.6.0 task record captures plan, tool outcome and review state', async () => {
  const result = await intel.runAgentGraph('check a bounded task', {
    nextAction: async (_state, initial) => initial
      ? { plan: ['Collect one result'], next_action: { type: 'tool', name: 'calculator', input: { expression: '4*5' } } }
      : { next_action: { type: 'final', answer: 'The result is 20.' } },
    executeTool: async () => ({ ok: true, result: { value: 20 } }),
    review: async () => ({ verdict: 'pass' }),
  }, { maxSteps: 4, maxToolCalls: 2, intent: { intent: 'question', complexity: 'MEDIUM' }, requestId: 'test-req-160' });
  assert.equal(result.ok, true);
  assert.equal(result.state.taskRecord.taskId, 'test-req-160');
  assert.equal(result.state.taskRecord.status, 'completed');
  assert.equal(result.state.taskRecord.finalAnswerProduced, true);
  assert.ok(result.state.taskRecord.steps.some((step) => step.tool === 'calculator' && step.status === 'completed'));
  assert.equal(result.state.review.status, 'passed');
});

test('tool registry fails closed when a caller lacks required permissions', async () => {
  const registry = intel.createToolRegistry({ calculator: async () => ({ value: 2 }) });
  const result = await registry.call('calculator', { expression: '1+1' }, { permissions: ['read'] });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'TOOL_PERMISSION_DENIED');
});

test('tool registry aborts timed-out handlers and reports a stable timeout code', async () => {
  const registry = intel.createToolRegistry({ calculator: async () => new Promise((resolve) => setTimeout(() => resolve({ value: 2 }), 300)) });
  const result = await registry.call('calculator', { expression: '1+1' }, { stepTimeoutMs: 100, permissions: ['compute'] });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'TOOL_TIMEOUT');
});
