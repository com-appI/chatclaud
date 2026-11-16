'use strict';
const { detectSearchIntent } = require('./intent-router');

function stripSearchCommand(value) {
  return String(value || '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^(?:\/(?:search|find)\s*|search(?:\s+the\s+web|\s+for)?\s+|find\s+|look\s+up\s+|найди\s+|поищи\s+|загугли\s+|погугли\s+)/i, '')
    .trim();
}

function planQueries(userText, options) {
  const opts = options || {};
  const query = stripSearchCommand(userText).slice(0, 400);
  const intent = detectSearchIntent(userText, opts.context);
  if (!query) return { intent, queries: [], mode: null };

  const defaultLimit = intent.mode === 'DEEP_RESEARCH' ? 4 : intent.mode === 'FAST_LOOKUP' ? 1 : 2;
  const maxQueries = Math.max(1, Math.min(8, Number(opts.maxQueries) || defaultLimit));
  const candidates = [query];
  const year = new Date().getFullYear();
  const append = (suffix) => candidates.push((query + ' ' + suffix).slice(0, 240));

  switch (intent.mode) {
    case 'LATEST':
      if (!/\b(20\d{2})\b/.test(query)) append(String(year));
      append('official updates');
      break;
    case 'OFFICIAL_SOURCE':
      append('official documentation');
      append('API reference examples');
      break;
    case 'DEEP_RESEARCH':
      append('primary sources');
      append('research papers evidence');
      append('independent analysis limitations');
      break;
    case 'COMPARISON':
      append('independent benchmark comparison');
      append('technical differences strengths limitations');
      break;
    case 'FACT_CHECK':
      append('reliable primary sources');
      append('official statements evidence');
      break;
    case 'FAST_LOOKUP':
      if (maxQueries > 1) append('reliable sources');
      break;
    default:
      if (maxQueries > 1) append('official primary sources');
      break;
  }

  if (intent.expandFrom) candidates.push((stripSearchCommand(intent.expandFrom) + ' ' + query).slice(0, 240));
  const seen = new Set();
  const queries = [];
  for (const candidate of candidates) {
    const value = String(candidate || '').replace(/\s+/g, ' ').trim().slice(0, 240);
    const key = value.toLocaleLowerCase();
    if (value.length >= 1 && !seen.has(key)) {
      seen.add(key);
      queries.push(value);
    }
    if (queries.length >= maxQueries) break;
  }
  return { intent, mode: intent.mode || 'FAST_LOOKUP', queries };
}

module.exports = { planQueries, stripSearchCommand };
