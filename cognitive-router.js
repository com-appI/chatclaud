'use strict';
/**
 * Cognitive Router 4.56.0 — routes chat intents to math / tutor / analyzer / chal / chat
 */
const math = require('./math-engine');
const mathSolver = require('./math/math-solver');
const tutor = require('./student-tutor');

function routeCognitive(text, options) {
  const t = String(text || '').trim();
  const opts = options || {};

  // Project analysis: code fences or explicit analyze
  if (
    opts.files ||
    (/```/.test(t) && /(html|css|javascript|js|typescript|json)/i.test(t)) ||
    /(проанализируй\s+(проект|код|файл)|analyze\s+(project|code|file)|найди\s+ошибк)/i.test(t)
  ) {
    return { type: 'analyze', confidence: 0.8, reason: 'code/project diagnostics' };
  }

  const tut = tutor.detectTutorIntent(t);
  if (tut.isTutor) {
    return { type: 'tutor', confidence: 0.85, mode: tut.mode, reason: 'student tutor' };
  }

  const m = math.detectMathIntent(t);
  if (m.isMath) {
    return { type: 'math', confidence: 0.85, kind: m.kind, reason: 'mathematical' };
  }

  if (/(почему|how does|причин|следстви|проанализируй)/i.test(t) && t.length > 40) {
    return { type: 'analysis', confidence: 0.6, reason: 'causal/analysis' };
  }

  if (/(найди|search|latest|новост)/i.test(t)) {
    return { type: 'research', confidence: 0.7, reason: 'research' };
  }

  return { type: 'chat', confidence: 0.9, reason: 'default' };
}

/**
 * Try deterministic handlers before LLM.
 * Returns { handled, text, meta } or { handled:false }
 */
function tryDeterministic(text, options) {
  const route = routeCognitive(text, options);
  const lang = /[а-яё]/i.test(text) ? 'ru' : 'en';

  if (route.type === 'math') {
    const result = mathSolver.solve(text, { useSympy: options && options.useSympy !== false });
    if (result.ok && result.verified) {
      return {
        handled: true,
        text: mathSolver.formatResponse(result, lang),
        meta: { route, result },
      };
    }
    // Never fall back to the legacy solver: it could bypass the independent verifier.
    return {
      handled: true,
      text: mathSolver.formatResponse(result, lang),
      meta: { route, result, verificationRequired: true },
    };
  }

  if (route.type === 'tutor' && route.mode === 'check') {
    // Expect problem in first sentence and answer after
    const parts = String(text).split(/\n+/);
    const problem = parts[0];
    const student = parts.slice(1).join('\n') || text;
    const check = tutor.checkStudentSolution(problem, student);
    return {
      handled: true,
      text: tutor.formatTutorResponse(check, lang),
      meta: { route, check },
    };
  }

  if (route.type === 'tutor' && route.mode === 'hint') {
    const h = tutor.buildHint(text, 'school');
    return {
      handled: true,
      text: (lang === 'ru' ? 'Подсказка: ' : 'Hint: ') + h.hint,
      meta: { route, hint: h },
    };
  }

  if (route.type === 'analyze' && options && options.files) {
    const codeIntel = require('./code-intelligence');
    const report = codeIntel.analyzeCodebase(options.files);
    const lines = (report.issues || []).slice(0, 25).map((i) => {
      return `- [${i.severity}] ${i.file || ''}: ${i.message}` + (i.fix ? ` → ${i.fix}` : '');
    });
    const extra = [];
    if (report.summary && report.summary.imports != null) extra.push('imports=' + report.summary.imports);
    if (report.summary && report.summary.symbols != null) extra.push('symbols=' + report.summary.symbols);
    if (report.unresolved && report.unresolved.length) {
      report.unresolved.slice(0, 5).forEach((u) => lines.push(`- [likely] unresolved: ${u.to} from ${u.from}`));
    }
    return {
      handled: true,
      text: `Project analysis: ${report.summary.files} files, confirmed=${report.summary.confirmed}, likely=${report.summary.likely}` + (extra.length ? ', ' + extra.join(', ') : '') + `\n` + lines.join('\n'),
      meta: { route, report },
    };
  }

  return { handled: false, route };
}

module.exports = {
  routeCognitive,
  tryDeterministic,
};
