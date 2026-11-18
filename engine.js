'use strict';
/**
 * Self-Improvement Engine (Level 1) — analyzes outcomes, stores strategies.
 * Does NOT modify Groq model weights. Controlled proposals only.
 */
const fs = require('fs');
const path = require('path');

const MAX_EVENTS = 400;
const MAX_STRATEGIES = 120;
const MAX_PROPOSALS = 40;

function dataDir() {
  const base = process.env.ALE_DATA_DIR || process.env.DATA_DIR || path.join(process.cwd(), 'data');
  const dir = path.join(base, 'self-improve');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  return dir;
}

function loadJson(name, fallback) {
  try {
    const p = path.join(dataDir(), name);
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function saveJson(name, obj) {
  try {
    fs.writeFileSync(path.join(dataDir(), name), JSON.stringify(obj, null, 2));
    return true;
  } catch (e) {
    return false;
  }
}

function recordOutcome(event) {
  const store = loadJson('outcomes.json', { events: [] });
  const item = {
    id: 'ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    at: new Date().toISOString(),
    kind: String(event.kind || 'response'),
    success: !!event.success,
    domain: String(event.domain || 'general').slice(0, 40),
    strategy: String(event.strategy || '').slice(0, 120),
    error: event.error ? String(event.error).slice(0, 300) : null,
    notes: event.notes ? String(event.notes).slice(0, 400) : null,
    metrics: event.metrics || null,
  };
  store.events.unshift(item);
  store.events = store.events.slice(0, MAX_EVENTS);
  saveJson('outcomes.json', store);

  if (item.success && item.strategy) {
    rememberStrategy({
      domain: item.domain,
      strategy: item.strategy,
      source: 'outcome',
      verified: false,
    });
  }
  return item;
}

function rememberStrategy(s) {
  const store = loadJson('strategies.json', { items: [] });
  const key = (s.domain + '|' + s.strategy).toLowerCase();
  const existing = store.items.find((x) => (x.domain + '|' + x.strategy).toLowerCase() === key);
  if (existing) {
    existing.hits = (existing.hits || 0) + 1;
    existing.updatedAt = new Date().toISOString();
  } else {
    store.items.unshift({
      id: 'st_' + Date.now().toString(36),
      domain: String(s.domain || 'general').slice(0, 40),
      strategy: String(s.strategy || '').slice(0, 200),
      hits: 1,
      verified: !!s.verified,
      source: s.source || 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  store.items = store.items.slice(0, MAX_STRATEGIES);
  saveJson('strategies.json', store);
  return true;
}

function suggestStrategies(domain, limit) {
  const store = loadJson('strategies.json', { items: [] });
  const d = String(domain || '').toLowerCase();
  let items = store.items.slice();
  if (d) items = items.filter((x) => String(x.domain).toLowerCase() === d || String(x.strategy).toLowerCase().includes(d));
  items.sort((a, b) => (b.hits || 0) - (a.hits || 0));
  return items.slice(0, limit || 5);
}

function analyzeWeaknesses() {
  const store = loadJson('outcomes.json', { events: [] });
  const fails = store.events.filter((e) => !e.success);
  const byDomain = {};
  for (const e of fails) {
    byDomain[e.domain] = (byDomain[e.domain] || 0) + 1;
  }
  const ranked = Object.entries(byDomain).sort((a, b) => b[1] - a[1]);
  return {
    totalEvents: store.events.length,
    failures: fails.length,
    topWeakDomains: ranked.slice(0, 8).map(([domain, count]) => ({ domain, count })),
    recentFailures: fails.slice(0, 10),
  };
}

/**
 * Controlled proposal — never auto-applies to production code.
 */
function createProposal(proposal) {
  const store = loadJson('proposals.json', { items: [] });
  const item = {
    id: 'pr_' + Date.now().toString(36),
    at: new Date().toISOString(),
    title: String(proposal.title || 'Improvement').slice(0, 120),
    description: String(proposal.description || '').slice(0, 2000),
    target: String(proposal.target || 'prompt').slice(0, 80), // prompt | tool | algorithm
    status: 'pending_admin', // pending_admin | approved | rejected | tested
    risk: String(proposal.risk || 'low'),
    testPlan: String(proposal.testPlan || 'run npm test').slice(0, 500),
    applied: false,
  };
  store.items.unshift(item);
  store.items = store.items.slice(0, MAX_PROPOSALS);
  saveJson('proposals.json', store);
  return item;
}

function listProposals(status) {
  const store = loadJson('proposals.json', { items: [] });
  if (!status) return store.items;
  return store.items.filter((x) => x.status === status);
}

/** Dataset sample for Level-2 fine-tune prep (no actual training). */
function appendTrainingExample(ex) {
  const store = loadJson('ft-dataset.json', { examples: [], note: 'Prepared for external fine-tuning only; Groq weights are not modified in-app.' });
  store.examples.unshift({
    id: 'ex_' + Date.now().toString(36),
    at: new Date().toISOString(),
    input: String(ex.input || '').slice(0, 4000),
    ideal: String(ex.ideal || '').slice(0, 4000),
    domain: String(ex.domain || 'general').slice(0, 40),
    quality: Number(ex.quality) || 0,
  });
  store.examples = store.examples.slice(0, 500);
  saveJson('ft-dataset.json', store);
  return true;
}

function getStatus() {
  return {
    level1: true,
    level2_dataset: true,
    level3_finetune: false,
    level3_note: 'Groq openai/gpt-oss-120b weights are not trainable from this app. Dataset export only.',
    weaknesses: analyzeWeaknesses(),
    strategies: suggestStrategies(null, 5).length,
    pendingProposals: listProposals('pending_admin').length,
  };
}

module.exports = {
  recordOutcome,
  rememberStrategy,
  suggestStrategies,
  analyzeWeaknesses,
  createProposal,
  listProposals,
  appendTrainingExample,
  getStatus,
};
