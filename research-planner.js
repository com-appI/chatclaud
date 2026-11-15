'use strict';
/**
 * Research Intelligence helpers — plan + claim registry (no fake sources).
 * Actual web search remains Serper/Tavily via existing server adapters.
 */

function isResearchQuery(text) {
  return /(исследуй|research|найди\s+источник|сравни\s+источник|what\s+is\s+the\s+current|latest|новост|проверь\s+факт)/i.test(String(text || ''));
}

/**
 * Build a research plan without inventing sources.
 */
function buildResearchPlan(query) {
  const q = String(query || '').trim();
  return {
    query: q,
    steps: [
      { id: 1, action: 'clarify', detail: 'Identify the core claim and time sensitivity' },
      { id: 2, action: 'search', detail: 'Gather multiple independent sources (Serper/Tavily)' },
      { id: 3, action: 'extract', detail: 'Extract dated facts with URLs' },
      { id: 4, action: 'reconcile', detail: 'Mark agreements, conflicts, and unknowns' },
      { id: 5, action: 'report', detail: 'Answer with confidence and citations only from found sources' },
    ],
    rules: [
      'Never invent URLs or quotes',
      'Separate facts from speculation',
      'Prefer primary/official sources when available',
      'State if evidence is insufficient',
    ],
  };
}

/**
 * Claim registry: track assertions with support/contradiction status.
 */
class ClaimRegistry {
  constructor() {
    this.claims = [];
  }
  add(text, meta) {
    const c = {
      id: 'c_' + (this.claims.length + 1),
      text: String(text || '').slice(0, 500),
      status: 'unverified', // unverified | supported | contradicted | unknown
      sources: [],
      createdAt: new Date().toISOString(),
      ...(meta || {}),
    };
    this.claims.push(c);
    return c;
  }
  support(id, url) {
    const c = this.claims.find((x) => x.id === id);
    if (!c) return null;
    c.status = 'supported';
    if (url) c.sources.push(String(url));
    return c;
  }
  contradict(id, url) {
    const c = this.claims.find((x) => x.id === id);
    if (!c) return null;
    c.status = 'contradicted';
    if (url) c.sources.push(String(url));
    return c;
  }
  list() {
    return this.claims.slice();
  }
}

/**
 * Merge search hits into a structured brief (does not invent content).
 */
function synthesizeResearchBrief(query, sources) {
  const list = Array.isArray(sources) ? sources : [];
  const lines = list.slice(0, 8).map((s, i) => {
    const title = s.title || s.url || 'source';
    const url = s.url || '';
    const snip = (s.snippet || s.text || '').slice(0, 180);
    return (i + 1) + '. ' + title + (url ? ' — ' + url : '') + (snip ? '\n   ' + snip : '');
  });
  return {
    query: String(query || ''),
    sourceCount: list.length,
    confidence: list.length >= 3 ? 'medium' : list.length >= 1 ? 'low' : 'none',
    brief:
      list.length === 0
        ? 'No sources available. Cannot verify claims.'
        : 'Sources found (not generated):\n' + lines.join('\n'),
    sources: list.slice(0, 10),
  };
}

module.exports = {
  isResearchQuery,
  buildResearchPlan,
  ClaimRegistry,
  synthesizeResearchBrief,
};
