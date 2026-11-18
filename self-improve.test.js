'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const eng = require('../lib/self-improve/engine');

describe('self-improve engine', () => {
  it('records outcome', () => {
    const o = eng.recordOutcome({ kind: 'unit', success: true, domain: 'math', strategy: 'substitution-check' });
    assert.ok(o.id);
  });
  it('suggests strategies', () => {
    eng.rememberStrategy({ domain: 'math', strategy: 'verify-roots', verified: true });
    const list = eng.suggestStrategies('math', 3);
    assert.ok(list.length >= 1);
  });
  it('analyzes weaknesses', () => {
    eng.recordOutcome({ kind: 'unit', success: false, domain: 'search', error: 'timeout' });
    const w = eng.analyzeWeaknesses();
    assert.ok(w.totalEvents >= 1);
  });
  it('proposals pending admin only', () => {
    const p = eng.createProposal({ title: 'Better search prompt', description: 'test', target: 'prompt' });
    assert.equal(p.status, 'pending_admin');
    assert.equal(p.applied, false);
  });
  it('status levels honest', () => {
    const st = eng.getStatus();
    assert.equal(st.level1, true);
    assert.equal(st.level3_finetune, false);
  });
  it('dataset append', () => {
    assert.equal(eng.appendTrainingExample({ input: '2+2', ideal: '4', domain: 'math', quality: 1 }), true);
  });
});
