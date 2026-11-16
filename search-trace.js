'use strict';
function createTrace(meta) {
  const m = meta || {};
  return {
    searchTraceId: 'st_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
    startedAt: new Date().toISOString(),
    reason: m.reason || null,
    mode: m.mode || null,
    originalQuery: String(m.query || '').slice(0, 500),
    plannedQueries: [], providersCalled: [], providerStatus: {}, resultCounts: {},
    uniqueResults: 0, pagesOpened: 0, pagesExtracted: 0, sourcesInAnswer: 0, correctiveLoops: 0,
    events: [], error: null, finishedAt: null,
  };
}
function addTraceEvent(trace, event) {
  if (!trace || !Array.isArray(trace.events)) return;
  const safe = Object.assign({}, event || {});
  if (safe.error) safe.error = String(safe.error).replace(/(?:Bearer\s+|X-API-KEY\s*[:=]\s*)\S+/gi, '[redacted]').slice(0, 140);
  if (safe.query) safe.query = String(safe.query).slice(0, 240);
  trace.events.push(safe);
  if (trace.events.length > 100) trace.events.shift();
}
function markProvider(trace, name, status, count, error) {
  if (!trace) return;
  const key = String(name || 'UNKNOWN').toUpperCase().slice(0, 32);
  if (!trace.providersCalled.includes(key)) trace.providersCalled.push(key);
  trace.providerStatus[key] = String(status || 'unknown').slice(0, 32);
  if (count != null) trace.resultCounts[key] = (trace.resultCounts[key] || 0) + Math.max(0, Number(count) || 0);
  addTraceEvent(trace, { step: 'provider', provider: key, status: trace.providerStatus[key], count: count == null ? null : Math.max(0, Number(count) || 0), error });
}
function finalizeTrace(trace, extra) {
  if (!trace) return null;
  Object.assign(trace, extra || {});
  trace.finishedAt = new Date().toISOString();
  return trace;
}
module.exports = { createTrace, markProvider, addTraceEvent, finalizeTrace };
