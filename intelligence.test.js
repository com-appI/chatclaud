'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { intel, aleNormalizeUrlKey, aleQuoteInSource, aleMapVerdictToStatus } = require('../server.js');

test('intelligence planning is bounded and deterministic', () => {
  const plan = intel.createPlan('research safe-fetch behavior', { maxSteps: 3, maxToolCalls: 4 });
  assert.equal(plan.steps.length, 3);
  assert.equal(plan.maxSteps, 3);
  assert.deepEqual(plan.steps.map((step) => step.index), [0, 1, 2]);
});

test('claim verification is clearly heuristic and returns bounded statuses', () => {
  const result = intel.verifyClaims(
    ['The server checks public source evidence'],
    [{ text: 'The server checks public source evidence and validates the result.' }]
  );
  assert.equal(result.ok, true);
  assert.equal(result.claims.length, 1);
  assert.equal(result.claims[0].status, 'supported');
});

test('URL normalization preserves meaningful query parameters', () => {
  assert.equal(
    aleNormalizeUrlKey('HTTPS://Example.COM:443/path/?q=hello#section'),
    'https://example.com/path?q=hello'
  );
  assert.notEqual(
    aleNormalizeUrlKey('https://example.com/path?q=one'),
    aleNormalizeUrlKey('https://example.com/path?q=two')
  );
});

test('quoted evidence must actually appear in the source body', () => {
  const source = 'A sufficiently long sentence that is available in the fetched page body.';
  assert.equal(aleQuoteInSource('A sufficiently long sentence', source), true);
  assert.equal(aleQuoteInSource('This different unsupported sentence', source), false);
});

test('legacy partial verdict maps to uncertain, not supported', () => {
  assert.equal(aleMapVerdictToStatus('partial'), 'uncertain');
  assert.equal(aleMapVerdictToStatus('supported'), 'supported');
});
