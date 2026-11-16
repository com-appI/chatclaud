'use strict';
const { canonicalizeUrl } = require('./fusion');

function normalizeEvidenceText(value) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function filterCitations(claims, sources) {
  const byUrl = new Map();
  for (const source of sources || []) {
    const url = canonicalizeUrl(source && (source.url || source.link));
    if (url) byUrl.set(url, source);
  }
  const allowed = [];
  const rejected = [];
  for (const claim of claims || []) {
    const url = canonicalizeUrl(claim && (claim.url || claim.link));
    if (url && byUrl.has(url)) {
      const source = byUrl.get(url);
      allowed.push(Object.assign({}, claim, { url, title: source.title || claim.title || '' }));
    } else {
      rejected.push(Object.assign({}, claim, { reason: 'url_not_in_sources' }));
    }
  }
  return { allowed, rejected };
}

function claimSupportScore(claimText, source) {
  const claim = normalizeEvidenceText(claimText);
  const sourceText = normalizeEvidenceText([source && source.title, source && source.snippet, source && source.text, source && source.content].filter(Boolean).join(' '));
  if (!claim || !sourceText) return 0;
  if (sourceText.includes(claim)) return 1;
  const claimNumbers = claim.match(/\b\d+(?:[.,]\d+)?%?\b/g) || [];
  const sourceNumbers = new Set(sourceText.match(/\b\d+(?:[.,]\d+)?%?\b/g) || []);
  if (claimNumbers.some((number) => !sourceNumbers.has(number))) return 0;
  const stop = new Set(['this','that','with','from','have','will','your','about','для','это','как','что','или','при','про','этот','эта','также']);
  const tokens = [...new Set(claim.split(' ').filter((token) => token.length > 2 && !stop.has(token)))];
  if (tokens.length < 3) return tokens.length && sourceText.includes(tokens[0]) ? 0.45 : 0;
  let matched = 0;
  for (const token of tokens) if (sourceText.includes(token)) matched += 1;
  const coverage = matched / tokens.length;
  const claimPhrases = [];
  for (let i = 0; i < tokens.length - 1; i += 1) claimPhrases.push(tokens[i] + ' ' + tokens[i + 1]);
  const phraseHits = claimPhrases.filter((phrase) => sourceText.includes(phrase)).length;
  const phraseCoverage = claimPhrases.length ? phraseHits / claimPhrases.length : 0;
  return Math.max(0, Math.min(1, coverage * 0.65 + phraseCoverage * 0.35));
}

function verifyClaimsAgainstSources(claims, sources) {
  return (claims || []).map((claim) => {
    const url = canonicalizeUrl(claim && claim.url);
    const source = (sources || []).find((item) => canonicalizeUrl(item && item.url) === url);
    if (!source) return { claim, supported: false, score: 0, reason: 'missing_source', evidenceLevel: 'none' };
    const score = claimSupportScore(claim.text || claim.claim, source);
    const supported = score >= 0.68;
    return {
      claim, supported, score: Math.round(score * 1000) / 1000,
      reason: supported ? 'textual_overlap' : 'insufficient_textual_support',
      evidenceLevel: supported ? 'textual_match_not_fact_proof' : 'weak_or_missing_match', url,
    };
  });
}

module.exports = { filterCitations, claimSupportScore, verifyClaimsAgainstSources, normalizeEvidenceText };
