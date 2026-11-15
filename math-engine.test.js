'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const math = require('../lib/math-engine');

describe('math-engine arithmetic', () => {
  const cases = [
    ['2+2', 4], ['10-3', 7], ['6*7', 42], ['100/4', 25],
    ['2+3*4', 14], ['(2+3)*4', 20], ['2^3', 8], ['10% of ignored', null],
  ];
  for (const [expr, expected] of cases) {
    it('arith ' + expr, () => {
      const v = math.evalArithmetic(expr);
      if (expected == null) return;
      assert.equal(v, expected);
    });
  }
  it('solve 17+25 via solveMath', () => {
    const r = math.solveMath('Сколько будет 17+25?');
    assert.equal(r.ok, true);
    assert.equal(r.answer, 42);
    assert.equal(r.verified, true);
  });
});

describe('math-engine linear', () => {
  it('2x+3=11', () => {
    const r = math.solveLinear('2x+3=11');
    assert.ok(r);
    assert.equal(r.x, 4);
  });
  it('5x=20', () => {
    assert.equal(math.solveLinear('5x=20').x, 4);
  });
});

describe('math-engine quadratic', () => {
  it('x^2-5x+6=0', () => {
    const q = math.solveQuadratic('x^2-5x+6=0');
    assert.ok(q);
    const roots = q.roots.map((x) => Math.round(x * 1000) / 1000).sort();
    assert.deepEqual(roots, [2, 3]);
    // verify substitution
    for (const r of q.roots) {
      assert.ok(Math.abs(q.a * r * r + q.b * r + q.c) < 1e-8);
    }
  });
  it('x^2+1=0 no real', () => {
    const q = math.solveQuadratic('x^2+0x+1=0');
    assert.ok(q);
    assert.equal(q.roots.length, 0);
  });
});

describe('math-engine derivative', () => {
  it('x^3', () => {
    assert.equal(math.differentiatePolynomial('x^3'), '3x^2');
  });
  it('3x^2+2x+1', () => {
    const d = math.differentiatePolynomial('3x^2+2x+1');
    assert.ok(d.includes('6x'));
  });
});

describe('math-engine combinatorics', () => {
  it('5!', () => assert.equal(math.factorial(5), 120));
  it('C(5,2)', () => assert.equal(math.combination(5, 2), 10));
  it('C(10,3)', () => assert.equal(math.combination(10, 3), 120));
});

describe('math-engine intent', () => {
  it('detects arithmetic', () => assert.equal(math.detectMathIntent('2+2').kind, 'arithmetic'));
  it('detects quadratic', () => assert.equal(math.detectMathIntent('solve x^2-1=0').kind, 'quadratic'));
  it('detects derivative', () => assert.ok(math.detectMathIntent('derivative of x^2').isMath));
});

describe('math-engine solveMath batch', () => {
  const problems = [
    '2+2', '3*3', '100-1', '8/2', '2*(3+4)',
    '2x=10', '3x+1=10',
  ];
  for (const p of problems) {
    it('solves ' + p, () => {
      const r = math.solveMath(p, { useSympy: false, force: true });
      assert.equal(r.ok, true, p + ' ' + JSON.stringify(r));
    });
  }
});

describe('math-engine sympy optional', () => {
  it('sympy simplify if available', () => {
    const r = math.sympyEval('2+2');
    if (r) {
      assert.ok(String(r.result).includes('4'));
    }
  });
});
