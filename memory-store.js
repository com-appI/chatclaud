'use strict';
/**
 * ChatClaud Memory Store v2 (Node-native, Mem0-inspired concepts without Python).
 * - Facts with source, confidence, category, links
 * - Keyword retrieval + simple scoring
 * - Duplicate merge + contradiction flags
 * - File-backed persistence
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function nowIso() { return new Date().toISOString(); }
function id() { return 'f_' + crypto.randomBytes(8).toString('hex'); }

function normalizeText(s) {
  return String(s || '').normalize('NFKC').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function tokens(s) {
  const stop = new Set(['и','в','во','на','по','для','с','со','из','к','от','как','что','это','the','a','an','and','or','of','to','for','in','on','with','is','are']);
  return [...new Set(normalizeText(s).split(' ').filter((t) => t.length > 2 && !stop.has(t)))].slice(0, 48);
}

function scoreOverlap(queryTokens, factTokens) {
  if (!queryTokens.length || !factTokens.length) return 0;
  let hits = 0;
  const set = new Set(factTokens);
  for (const t of queryTokens) if (set.has(t)) hits += 1;
  return hits / queryTokens.length;
}

class MemoryStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = { schemaVersion: 2, updatedAt: nowIso(), facts: [] };
    this.load();
  }

  load() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (fs.existsSync(this.filePath)) {
        const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        if (raw && Array.isArray(raw.facts)) this.data = raw;
      }
    } catch (e) {
      this.data = { schemaVersion: 2, updatedAt: nowIso(), facts: [] };
    }
  }

  save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      this.data.updatedAt = nowIso();
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    } catch (e) { /* non-fatal */ }
  }

  upsertFact(input) {
    const text = String(input.text || input.claim || '').trim().slice(0, 2000);
    if (!text || text.length < 8) return null;
    const tok = tokens(text);
    const existing = this.data.facts.find((f) => {
      const ot = tokens(f.text);
      return scoreOverlap(tok, ot) >= 0.72 && scoreOverlap(ot, tok) >= 0.72;
    });
    if (existing) {
      existing.updatedAt = nowIso();
      existing.hits = (existing.hits || 1) + 1;
      if (input.source && input.source.url) {
        existing.sources = existing.sources || [];
        if (!existing.sources.some((s) => s.url === input.source.url)) {
          existing.sources.push({
            url: input.source.url,
            title: input.source.title || '',
            provider: input.source.provider || '',
            retrievedAt: nowIso(),
          });
        }
      }
      if (input.confidence != null) {
        existing.confidence = Math.max(Number(existing.confidence) || 0, Number(input.confidence) || 0);
      }
      this.save();
      return existing;
    }
    const fact = {
      id: id(),
      text,
      category: String(input.category || 'general').slice(0, 64),
      confidence: Math.max(0, Math.min(1, Number(input.confidence) != null ? Number(input.confidence) : 0.55)),
      status: input.status || 'supported',
      sources: input.source && input.source.url ? [{
        url: input.source.url,
        title: input.source.title || '',
        provider: input.source.provider || '',
        retrievedAt: nowIso(),
      }] : [],
      related: [],
      contradictions: [],
      hits: 1,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      lastVerifiedAt: nowIso(),
    };
    this.data.facts.push(fact);
    // keep bounded
    if (this.data.facts.length > 2000) {
      this.data.facts = this.data.facts
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0) || String(b.updatedAt).localeCompare(String(a.updatedAt)))
        .slice(0, 1800);
    }
    this.save();
    return fact;
  }

  search(query, limit) {
    const q = tokens(query);
    const lim = Math.max(1, Math.min(20, Number(limit) || 5));
    const scored = this.data.facts
      .filter((f) => f.status !== 'deleted')
      .map((f) => ({ fact: f, score: scoreOverlap(q, tokens(f.text)) * (0.7 + 0.3 * (f.confidence || 0.5)) }))
      .filter((x) => x.score > 0.12)
      .sort((a, b) => b.score - a.score)
      .slice(0, lim);
    return scored.map((x) => ({ ...x.fact, _score: x.score }));
  }

  linkRelated(idA, idB) {
    const a = this.data.facts.find((f) => f.id === idA);
    const b = this.data.facts.find((f) => f.id === idB);
    if (!a || !b || a.id === b.id) return false;
    a.related = Array.from(new Set([...(a.related || []), b.id])).slice(0, 20);
    b.related = Array.from(new Set([...(b.related || []), a.id])).slice(0, 20);
    this.save();
    return true;
  }

  markContradiction(idA, idB, note) {
    const a = this.data.facts.find((f) => f.id === idA);
    const b = this.data.facts.find((f) => f.id === idB);
    if (!a || !b) return false;
    const entry = { id: b.id, note: String(note || '').slice(0, 200), at: nowIso() };
    a.contradictions = [...(a.contradictions || []), entry].slice(-10);
    a.status = 'conflict';
    this.save();
    return true;
  }

  stats() {
    return {
      total: this.data.facts.length,
      supported: this.data.facts.filter((f) => f.status === 'supported').length,
      conflict: this.data.facts.filter((f) => f.status === 'conflict').length,
      updatedAt: this.data.updatedAt,
    };
  }

  exportFacts(limit) {
    return this.data.facts.slice(0, Math.max(1, Math.min(100, Number(limit) || 20)));
  }
}

module.exports = { MemoryStore, tokens, normalizeText, scoreOverlap };
