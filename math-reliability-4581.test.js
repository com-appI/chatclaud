'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const math = require('../lib/math-engine');
const router = require('../lib/math/math-router');
const solver = require('../lib/math/math-solver');
const verifier = require('../lib/math/math-verifier');
const cognitive = require('../lib/cognitive-router');

describe('4.58.1 regression: equation routing and complete roots', () => {
  it('routes a numeric-leading quadratic to the quadratic solver, not arithmetic', () => {
    assert.equal(router.classifyMath('3x^2 - 14x + 8 = 0').type, 'quadratic');
    const result = solver.solve('3x^2 - 14x + 8 = 0', { useSympy: false });
    assert.equal(result.ok, true);
    assert.equal(result.verified, true);
    assert.deepEqual(result.answer, [2 / 3, 4]);
  });
  it('solves x^2 - 5x + 6 with both roots', () => {
    const result = solver.solve('x^2-5x+6=0', { useSympy: false });
    assert.deepEqual(result.answer, [2, 3]);
    assert.equal(result.verified, true);
  });
  it('rejects an incomplete root set even when one candidate root is valid', () => {
    const result = verifier.verifyQuadraticRoots(1, -5, 6, [2]);
    assert.equal(result.verified, false);
    assert.ok(result.issues.some((issue) => /expected 2/.test(issue)));
  });
  it('verifies that x^2 + 1 = 0 has no real roots', () => {
    const result = solver.solve('x^2+1=0', { useSympy: false });
    assert.equal(result.answer, 'no real roots');
    assert.equal(result.verified, true);
    assert.equal(result.verification.method, 'negative-discriminant-proof');
  });
  it('solves a linear equation with the equation normalized to zero', () => {
    const result = solver.solve('2x + 3 = 11', { useSympy: false });
    assert.equal(result.answer, 4);
    assert.equal(result.verified, true);
  });
});

describe('4.58.1 regression: derivatives', () => {
  for (const prompt of [
    'derivative of x^3 + 2x^2 + x + 7',
    'Найди производную x^3 + 2x^2 + x + 7',
    'Найди производную функции x^3 + 2x^2 + x + 7',
  ]) {
    it(`differentiates correctly: ${prompt}`, () => {
      const result = solver.solve(prompt, { useSympy: false });
      assert.equal(result.answer, '3x^2+4x+1');
      assert.equal(result.verified, true);
    });
  }
  it('does not verify a tampered derivative result', () => {
    const solved = math.solveMath('derivative of x^3', { useSympy: false });
    solved.answer = '9x^2';
    solved.detail.derivative = '9x^2';
    const result = verifier.verifySolved(solved, 'derivative of x^3');
    assert.equal(result.verified, false);
  });
});

describe('4.58.1 regression: exact arithmetic', () => {
  it('preserves integers beyond Number.MAX_SAFE_INTEGER', () => {
    const result = solver.solve('30939392939929292983838 * 102', { useSympy: false });
    assert.equal(result.answer, '3155818079872787884351476');
    assert.equal(result.verified, true);
  });
  it('preserves a repeating rational exactly', () => {
    assert.equal(math.evalArithmetic('1/3 + 1/3'), '2/3');
    const result = solver.solve('1/3 + 1/3', { useSympy: false });
    assert.equal(result.answer, '2/3');
    assert.equal(result.verified, true);
  });
  it('keeps terminating decimal arithmetic exact', () => {
    const result = math.evaluateArithmeticDetailed('0.1 + 0.2');
    assert.equal(result.exact, '0.3');
    assert.equal(result.value, 0.3);
  });
  it('supports large powers without floating-point rounding', () => {
    assert.equal(math.evalArithmetic('2^100'), '1267650600228229401496703205376');
  });
  it('rejects division by zero and malformed expressions', () => {
    assert.equal(math.evalArithmetic('1/0'), null);
    assert.equal(math.evalArithmetic('2 + process.exit()'), null);
  });
  it('does not use the JavaScript Function constructor for arithmetic', () => {
    const source = require('node:fs').readFileSync(require.resolve('../lib/math-engine'), 'utf8');
    assert.equal(/\bFunction\s*\(/.test(source), false);
  });
});

describe('4.58.1 regression: statistics', () => {
  it('reports population and sample variance separately', () => {
    const result = solver.solve('variance of 1, 2, 3', { useSympy: false });
    assert.equal(result.verified, true);
    assert.ok(Math.abs(result.solved.detail.populationVariance - (2 / 3)) < 1e-12);
    assert.equal(result.solved.detail.sampleVariance, 1);
  });
  it('uses sample variance only when explicitly requested', () => {
    const result = solver.solve('sample variance of 1, 2, 3', { useSympy: false });
    assert.equal(result.answer, 1);
    assert.equal(result.verified, true);
  });
  it('does not confuse mean with variance', () => {
    const result = solver.solve('mean of 1, 2, 3', { useSympy: false });
    assert.equal(result.answer, 2);
    assert.equal(result.solved.engine, 'js-mean');
    assert.equal(result.verified, true);
  });
  it('computes median instead of incorrectly returning the mean', () => {
    const result = solver.solve('median of 1, 2, 100', { useSympy: false });
    assert.equal(result.answer, 2);
    assert.equal(result.solved.engine, 'js-median');
    assert.equal(result.verified, true);
  });
});

describe('4.58.1 regression: verification and safe symbolic input', () => {
  it('does not trust an arbitrary engine verified flag', () => {
    const result = verifier.verifySolved({ ok: true, engine: 'unknown', answer: 42, verified: true }, '42');
    assert.equal(result.verified, false);
  });
  it('rejects a tampered linear candidate', () => {
    const result = verifier.verifySolved({ ok: true, engine: 'js-linear', answer: 999, detail: { x: 999, a: 2, b: -8 } }, '2x+3=11');
    assert.equal(result.verified, false);
  });
  it('rejects Python/SymPy code-like payloads before invoking Python', () => {
    assert.equal(math.safeSympyExpression('__import__("os").system("id")'), null);
    assert.equal(math.safeSympyExpression('x.__class__'), null);
    assert.equal(math.safeSympyExpression('sqrt(x^2 + 1)'), 'sqrt(x^2 + 1)');
  });
  it('cognitive deterministic route returns only verified mathematical output', () => {
    const response = cognitive.tryDeterministic('3x^2 - 14x + 8 = 0');
    assert.equal(response.handled, true);
    assert.ok(response.meta.result.verified);
    assert.match(response.text, /verified/i);
  });
});
