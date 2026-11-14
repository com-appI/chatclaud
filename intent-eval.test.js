'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { intel } = require('../server.js');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'evals', 'core-cases.json'), 'utf8'));
const expectedCounts = {
  logic_reasoning: 20, programming: 15, research: 15, mathematics: 10,
  documents: 10, memory_context: 10, multi_step: 10, error_detection: 10,
};

test('v1.6.0 evaluation set contains the required 100 cases by category', () => {
  assert.equal(fixture.version, '1.6.0');
  assert.equal(fixture.cases.length, 100);
  assert.deepEqual(fixture.categoryCounts, expectedCounts);
  const ids = fixture.cases.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const item of fixture.cases) {
    assert.ok(item.input && item.expected && Array.isArray(item.criteria));
    assert.ok(item.expected.intent && item.expected.complexity);
  }
});

for (const item of fixture.cases) {
  test('intent eval ' + item.id + ': ' + item.category, () => {
    const actual = intel.classifyIntent(item.input, { hasContext: !!item.contextAvailable });
    assert.equal(actual.intent, item.expected.intent, 'intent mismatch');
    assert.equal(actual.complexity, item.expected.complexity, 'complexity mismatch');
    assert.equal(actual.requiresTools, item.expected.requiresTools, 'tool routing mismatch');
  });
}

test('simple and continuation routes are handled without false autonomy', () => {
  const hello = intel.classifyIntent('Привет');
  assert.equal(hello.intent, 'question');
  assert.equal(hello.complexity, 'SIMPLE');
  assert.equal(hello.requiresTools, false);
  const noContext = intel.classifyIntent('Продолжи предыдущий этап', { hasContext: false });
  assert.equal(noContext.intent, 'question');
  assert.equal(noContext.complexity, 'SIMPLE');
});
