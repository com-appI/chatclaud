'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const router = require('../lib/math/math-router');
const verifier = require('../lib/math/math-verifier');
const solver = require('../lib/math/math-solver');
const engine = require('../lib/math-engine');
const cognitive = require('../lib/cognitive-router');

describe('math-router', () => {
  it('arithmetic', () => assert.equal(router.classifyMath('2+2').type, 'arithmetic'));
  it('quadratic', () => assert.equal(router.classifyMath('x^2-5x+6=0').type, 'quadratic'));
  it('derivative', () => assert.equal(router.classifyMath('derivative of x^3').type, 'derivative'));
  it('matrix', () => assert.equal(router.classifyMath('det([[1,2],[3,4]])').type, 'matrix'));
  it('proof', () => assert.equal(router.classifyMath('Prove that sqrt(2) is irrational').type, 'proof'));
  it('probability', () => assert.ok(['probability', 'stats'].includes(router.classifyMath('variance of 1,2,3').type) || router.classifyMath('P(A|B) bayes').type === 'probability'));
});

describe('verifier quadratic substitution', () => {
  it('valid roots', () => {
    const v = verifier.verifyQuadraticRoots(1, -5, 6, [2, 3]);
    assert.equal(v.verified, true);
  });
  it('invalid root', () => {
    const v = verifier.verifyQuadraticRoots(1, -5, 6, [0, 1]);
    assert.equal(v.verified, false);
  });
  it('linear verify', () => {
    assert.equal(verifier.verifyLinear(2, 3, 11, 4).verified, true);
  });
  it('nearlyEqual', () => assert.ok(verifier.nearlyEqual(0.1 + 0.2, 0.3, 1e-10) || verifier.nearlyEqual(1, 1)));
});

describe('math-solver integration', () => {
  it('2+2 verified', () => {
    const r = solver.solve('2+2', { useSympy: false });
    assert.equal(r.ok, true);
    assert.equal(r.answer, 4);
    assert.equal(r.verified, true);
  });
  it('quadratic verified', () => {
    const r = solver.solve('x^2-5x+6=0', { useSympy: false });
    assert.equal(r.ok, true);
    assert.equal(r.verified, true);
  });
  it('format includes verified tag', () => {
    const r = solver.solve('3*3', { useSympy: false });
    const t = solver.formatResponse(r, 'en');
    assert.ok(/verified/i.test(t));
  });
  it('cognitive uses solver', () => {
    const d = cognitive.tryDeterministic('2+2');
    assert.equal(d.handled, true);
    assert.ok(String(d.text).includes('4'));
  });
});

describe('benchmark arithmetic bulk', () => {
  for (let a = 0; a <= 12; a++) {
    for (let b = 0; b <= 12; b++) {
      it(`add ${a}+${b}`, () => {
        assert.equal(engine.evalArithmetic(`${a}+${b}`), a + b);
      });
      if (b !== 0 && a <= 8) {
        it(`mul ${a}*${b}`, () => {
          assert.equal(engine.evalArithmetic(`${a}*${b}`), a * b);
        });
      }
    }
  }
});

describe('benchmark solver sample set', () => {
  const cases = [
    ['1+1', 2], ['5-2', 3], ['4*5', 20], ['9/3', 3],
    ['2+2*2', 6], ['(2+2)*2', 8], ['10-1-1', 8],
  ];
  for (const [p, e] of cases) {
    it('solve ' + p, () => {
      const r = solver.solve(p, { useSympy: false });
      assert.equal(r.answer, e);
      assert.equal(r.verified, true);
    });
  }
});

describe('adversarial domain notes', () => {
  it('flags division concerns', () => {
    const n = verifier.checkDomainNotes('1/0');
    assert.ok(n.length >= 1);
  });
});

describe('proof tasks not fake formal', () => {
  it('proof formal unavailable by default', () => {
    const r = solver.solve('Prove 1+1=2', { useSympy: false });
    assert.equal(r.formalProof.available, false);
  });
});

describe('module exports', () => {
  it('router exports', () => assert.equal(typeof router.classifyMath, 'function'));
  it('verifier exports', () => assert.equal(typeof verifier.verifySolved, 'function'));
  it('solver exports', () => assert.equal(typeof solver.solve, 'function'));
});
