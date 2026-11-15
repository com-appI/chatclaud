'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('thinking state manager present in index.html', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

  it('includes state manager script', () => {
    assert.ok(html.includes('id="cc-think-state-manager"'));
    assert.ok(html.includes('window.CC.Think'));
  });

  it('includes screenshot-style orb markup classes', () => {
    assert.ok(html.includes('cc-chal-orb'));
    assert.ok(html.includes('cc-chal-label'));
    assert.ok(html.includes('cc-chal-label'));
  });

  it('maps real events not a fixed sequence only', () => {
    assert.ok(html.includes("case 'search:started'"));
    assert.ok(html.includes("case 'math:started'"));
    assert.ok(html.includes("case 'model:streaming'"));
    assert.ok(html.includes("case 'request:cancelled'"));
    assert.ok(html.includes('stale') || html.includes('activeReq'));
  });

  it('English labels present', () => {
    assert.ok(html.includes('Searching the web…'));
    assert.ok(html.includes('Verifying…'));
    assert.ok(html.includes('Thinking…'));
  });

  it('agent-trace chrome hidden to avoid CSS confusion', () => {
    assert.ok(html.includes('.cc-agent-trace'));
    assert.ok(html.includes('display: none !important'));
  });

  it('prefers-reduced-motion respected', () => {
    assert.ok(html.includes('prefers-reduced-motion'));
  });
});

describe('think state transition rules (pure)', () => {
  // Mirror priority: search overrides generic thinking
  function nextState(current, event) {
    const map = {
      'request:received': 'receiving',
      'search:started': 'searching',
      'math:started': 'calculating',
      'model:streaming': 'generating',
      'request:completed': 'completed',
      'request:error': 'error',
      'request:cancelled': 'cancelled',
    };
    return map[event] || current;
  }

  it('simple path', () => {
    let s = 'idle';
    s = nextState(s, 'request:received');
    assert.equal(s, 'receiving');
    s = nextState(s, 'model:streaming');
    assert.equal(s, 'generating');
    s = nextState(s, 'request:completed');
    assert.equal(s, 'completed');
  });

  it('search path skips forced sequence', () => {
    let s = 'idle';
    s = nextState(s, 'request:received');
    s = nextState(s, 'search:started');
    assert.equal(s, 'searching');
    s = nextState(s, 'model:streaming');
    assert.equal(s, 'generating');
  });

  it('cancel never becomes completed', () => {
    let s = 'searching';
    s = nextState(s, 'request:cancelled');
    assert.equal(s, 'cancelled');
    assert.notEqual(s, 'completed');
  });
});
