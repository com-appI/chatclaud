'use strict';
/** Math Intelligence Solver 4.58.1 — route → solve → independent verification. */
const router = require('./math-router');
const verifier = require('./math-verifier');
const engine = require('../math-engine');

const MAX_CORRECT_LOOPS = 1;
function solve(text, options) {
  const opts = options || {};
  const classification = router.classifyMath(text);
  const steps = [{ stage: 'route', type: classification.type, confidence: classification.confidence }];
  let solved = engine.solveMath(text, {
    useSympy: opts.useSympy !== false,
    force: opts.force === true,
    sympyTimeoutMs: opts.sympyTimeoutMs,
  });
  steps.push({ stage: 'solve', engine: solved.engine, ok: solved.ok });
  let verification = verifier.verifySolved(solved, text);
  steps.push({ stage: 'verify', verified: verification.verified, method: verification.method, issues: verification.issues });

  let loops = 0;
  // One bounded retry is permitted only when a symbolic fallback is available.
  while (!verification.verified && solved.ok && loops < MAX_CORRECT_LOOPS && opts.correct === true && router.needsSymbolicEngine(classification.type)) {
    loops++;
    const retry = engine.solveMath(text, { useSympy: true, force: true, sympyTimeoutMs: opts.sympyTimeoutMs });
    steps.push({ stage: 'correct-retry', loop: loops, engine: retry.engine, ok: retry.ok });
    if (!retry.ok || retry.engine === solved.engine) break;
    solved = retry;
    verification = verifier.verifySolved(solved, text);
    steps.push({ stage: 're-verify', verified: verification.verified, method: verification.method, issues: verification.issues });
  }

  if (solved) {
    // Keep the nested solver payload consistent with the authoritative verifier result.
    solved.verified = !!(verification && verification.verified);
    solved.verification = {
      verified: !!(verification && verification.verified),
      method: verification && verification.method || null,
    };
  }

  const formalProof = classification.type === 'proof'
    ? { available: false, reason: 'Lean 4/Mathlib is not installed or invoked in this deployment; no formal proof is claimed.' }
    : { available: false, reason: 'not a formal-proof task' };

  return {
    ok: !!(solved && solved.ok),
    answer: solved ? solved.answer : null,
    classification,
    solved,
    verification,
    formalProof,
    steps,
    warnings: [].concat(solved && solved.warnings || [], verification.domainNotes || [], verification.issues || []),
    verified: !!(verification && verification.verified),
  };
}

function formatResponse(result, lang) {
  const ru = lang === 'ru';
  if (!result || !result.ok) {
    return ru
      ? 'Не удалось получить математическое решение, которое можно надёжно проверить. Я не буду угадывать ответ.'
      : 'Could not produce a mathematical solution that can be reliably checked. I will not guess.';
  }
  let answer = result.answer;
  if (Array.isArray(answer)) answer = answer.map((value) => typeof value === 'number' ? String(Number(value.toPrecision(12))) : String(value)).join(', ');
  else if (typeof answer === 'number') answer = String(Number(answer.toPrecision(12)));
  else answer = String(answer);

  if (result.solved && result.solved.engine === 'js-variance' && result.solved.detail) {
    const detail = result.solved.detail;
    const fmt = (value) => value == null ? 'недоступна' : String(Number(value.toPrecision(12)));
    answer = ru
      ? `Дисперсия генеральной совокупности: ${fmt(detail.populationVariance)}; выборочная дисперсия: ${fmt(detail.sampleVariance)}.`
      : `Population variance: ${fmt(detail.populationVariance)}; sample variance: ${fmt(detail.sampleVariance)}.`;
  }

  if (result.verified) {
    const method = result.verification && result.verification.method || 'independent-check';
    return answer + (ru ? ` [проверено: ${method}]` : ` [verified: ${method}]`);
  }
  return ru
    ? `Кандидат ответа: ${answer}. Независимая проверка не пройдена, поэтому считать результат подтверждённым нельзя.`
    : `Candidate answer: ${answer}. Independent verification did not pass, so this result must not be treated as confirmed.`;
}

module.exports = { solve, formatResponse, MAX_CORRECT_LOOPS };
