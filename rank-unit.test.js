'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Lightweight pure reimplementation mirrors of critical scoring rules for regression
function normalizeText(value) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}
function detectSearchIntent(query) {
  const raw = String(query || '');
  if (/(github|repository|npm)/i.test(raw)) return 'code';
  if (/(vs\.?|versus|сравн)/i.test(raw)) return 'comparison';
  if (/(how to|tutorial|как )/i.test(raw)) return 'howto';
  if (/(docs?|documentation|api reference)/i.test(raw)) return 'docs';
  if (/(arxiv|paper|research)/i.test(raw)) return 'academic';
  if (/(today|latest|news|сегодня|2026)/i.test(raw)) return 'news';
  if (/(what is|что такое)/i.test(raw)) return 'factual';
  return 'general';
}
function authority(domain, intent) {
  const d = String(domain || '').toLowerCase();
  let s = 0;
  if (/\.(gov|edu)(\.|$)/.test(d)) s += 2.4;
  if (/(wikipedia\.org)$/.test(d)) s += 1.8;
  if (/(github\.com)$/.test(d)) s += intent === 'code' ? 2.2 : 1.2;
  return s;
}

describe('intent detection', () => {
  it('classifies common intents', () => {
    assert.equal(detectSearchIntent('latest AI news 2026'), 'news');
    assert.equal(detectSearchIntent('how to install node'), 'howto');
    assert.equal(detectSearchIntent('react vs vue'), 'comparison');
    assert.equal(detectSearchIntent('express github repository'), 'code');
    assert.equal(detectSearchIntent('what is HTTP'), 'factual');
  });
});

describe('authority scoring', () => {
  it('boosts trusted domains', () => {
    assert.ok(authority('nasa.gov', 'general') > authority('randomblog.com', 'general'));
    assert.ok(authority('github.com', 'code') > authority('github.com', 'general'));
  });
});

describe('normalize', () => {
  it('normalizes text', () => {
    assert.equal(normalizeText('  Hello,  WORLD! '), 'hello world');
  });
});
