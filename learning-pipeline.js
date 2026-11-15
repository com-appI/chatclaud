'use strict';
/**
 * Autonomous learning pipeline (Collector → Memory Manager → Cleaner hooks).
 * Uses injected search + page reader + memory store. Bounded, no infinite loops.
 */
const fs = require('fs');
const path = require('path');

const DEFAULT_TOPICS = [
  'artificial intelligence safety latest',
  'web development best practices 2026',
  'Node.js security updates',
  'open source LLM news',
];

class LearningPipeline {
  constructor(opts) {
    this.search = opts.search;
    this.readPage = opts.readPage;
    this.memory = opts.memory;
    this.stateFile = opts.stateFile;
    this.maxItemsPerTick = Math.max(1, Math.min(5, Number(opts.maxItemsPerTick) || 2));
    this.maxReadsPerTick = Math.max(0, Math.min(3, Number(opts.maxReadsPerTick) || 1));
    this.enabled = false;
    this.state = this._loadState();
  }

  _loadState() {
    try {
      if (fs.existsSync(this.stateFile)) return JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
    } catch (e) {}
    return {
      enabled: false,
      lastTickAt: 0,
      ticks: 0,
      collected: 0,
      errors: [],
      topics: DEFAULT_TOPICS.slice(),
      log: [],
    };
  }

  _saveState() {
    try {
      const dir = path.dirname(this.stateFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
    } catch (e) {}
  }

  start() {
    this.state.enabled = true;
    this.enabled = true;
    this._log('start');
    this._saveState();
    return this.status();
  }

  stop() {
    this.state.enabled = false;
    this.enabled = false;
    this._log('stop');
    this._saveState();
    return this.status();
  }

  _log(event, detail) {
    this.state.log = (this.state.log || []).concat([{ event, detail: detail || null, at: new Date().toISOString() }]).slice(-100);
  }

  status() {
    return {
      enabled: !!this.state.enabled,
      lastTickAt: this.state.lastTickAt || 0,
      ticks: this.state.ticks || 0,
      collected: this.state.collected || 0,
      topics: this.state.topics || [],
      memory: this.memory && this.memory.stats ? this.memory.stats() : null,
      recentLog: (this.state.log || []).slice(-10),
    };
  }

  /**
   * One bounded tick: search topics → read a page → upsert facts.
   */
  async tick() {
    if (!this.state.enabled) return { ok: false, error: 'disabled', status: this.status() };
    if (typeof this.search !== 'function') return { ok: false, error: 'no_search' };

    const topic = (this.state.topics && this.state.topics[this.state.ticks % this.state.topics.length]) || DEFAULT_TOPICS[0];
    const collected = [];
    try {
      const res = await this.search(topic);
      const sources = (res && res.sources) || [];
      let reads = 0;
      for (const s of sources.slice(0, this.maxItemsPerTick)) {
        if (!s || !s.url) continue;
        let text = s.snippet || '';
        if (reads < this.maxReadsPerTick && this.readPage) {
          try {
            const page = await this.readPage(s.url);
            if (page && page.ok && page.text) {
              text = page.text.slice(0, 800);
              reads += 1;
            }
          } catch (e) {
            this.state.errors = (this.state.errors || []).concat([String(e.message || e)]).slice(-20);
          }
        }
        if (this.memory && text) {
          const fact = this.memory.upsertFact({
            text: ((s.title ? s.title + '. ' : '') + text).slice(0, 900),
            category: 'autolearn',
            confidence: 0.5,
            source: { url: s.url, title: s.title || '', provider: s.provider || 'search' },
          });
          if (fact) collected.push(fact.id);
        }
      }
      this.state.ticks = (this.state.ticks || 0) + 1;
      this.state.collected = (this.state.collected || 0) + collected.length;
      this.state.lastTickAt = Date.now();
      this._log('tick', { topic, collected: collected.length });
      this._saveState();
      return { ok: true, topic, collected: collected.length, status: this.status() };
    } catch (e) {
      this.state.errors = (this.state.errors || []).concat([String(e.message || e)]).slice(-20);
      this._log('tick_error', String(e.message || e));
      this._saveState();
      return { ok: false, error: String(e.message || e), status: this.status() };
    }
  }

  /** Simple cleaner: drop low-confidence duplicates already handled by upsert; flag very old low-hit facts */
  clean() {
    if (!this.memory || !this.memory.data) return { ok: false };
    const facts = this.memory.data.facts || [];
    let removed = 0;
    const kept = [];
    for (const f of facts) {
      if (f.confidence < 0.25 && (f.hits || 0) < 2 && f.category === 'autolearn') {
        removed += 1;
        continue;
      }
      kept.push(f);
    }
    this.memory.data.facts = kept;
    this.memory.save();
    this._log('clean', { removed });
    this._saveState();
    return { ok: true, removed, total: kept.length };
  }
}

module.exports = { LearningPipeline, DEFAULT_TOPICS };
