'use strict';
/**
 * Student Tutor — detect student errors, hints, levels (no LLM required for checks).
 */
const math = require('./math-engine');

const LEVELS = ['beginner', 'school', 'advanced_school', 'university', 'expert'];

function detectTutorIntent(text) {
  const t = String(text || '');
  if (/(проверь\s+мо[её]|check\s+my|где\s+ошибка|where\s+is\s+the\s+mistake|я\s+решил)/i.test(t)) {
    return { isTutor: true, mode: 'check' };
  }
  if (/(подсказ|hint|не\s+решай\s+за\s+меня|help\s+me\s+understand)/i.test(t)) {
    return { isTutor: true, mode: 'hint' };
  }
  if (/(объясни|explain|как\s+решать|teach|научи)/i.test(t) && math.detectMathIntent(t).isMath) {
    return { isTutor: true, mode: 'explain' };
  }
  return { isTutor: false, mode: null };
}

/**
 * Extract claimed final answer from student text (e.g. x=3, ответ: 5)
 */
function extractClaimedAnswer(text) {
  const t = String(text || '');
  let m = t.match(/(?:ответ|answer|x)\s*[=:]\s*([+-]?\d+(?:\.\d+)?)/i);
  if (m) return Number(m[1]);
  m = t.match(/=\s*([+-]?\d+(?:\.\d+)?)\s*$/m);
  if (m) return Number(m[1]);
  return null;
}

/**
 * Check student solution against independent math engine.
 */
function checkStudentSolution(problemText, studentText) {
  const solved = math.solveMath(problemText, { useSympy: false, force: true });
  const claimed = extractClaimedAnswer(studentText);
  const report = {
    ok: false,
    problemSolved: solved.ok,
    engineAnswer: solved.answer,
    claimed,
    verdict: 'unknown',
    errorStep: null,
    message: '',
  };

  if (!solved.ok || solved.answer == null) {
    report.verdict = 'cannot_verify';
    report.message = 'Could not independently solve the problem to check the student.';
    return report;
  }

  const eng = solved.answer;
  const engNum = typeof eng === 'number' ? eng : Array.isArray(eng) ? eng[0] : Number(eng);

  if (claimed == null) {
    report.verdict = 'no_claim';
    report.message = 'No numeric final answer found in the student solution.';
    return report;
  }

  if (typeof engNum === 'number' && Number.isFinite(engNum) && Math.abs(engNum - claimed) < 1e-6) {
    report.ok = true;
    report.verdict = 'correct';
    report.message = 'Student answer matches independent computation.';
    return report;
  }

  if (Array.isArray(eng) && eng.some((r) => Math.abs(Number(r) - claimed) < 1e-6)) {
    report.ok = true;
    report.verdict = 'correct';
    report.message = 'Student answer is one of the roots.';
    return report;
  }

  report.verdict = 'incorrect';
  report.errorStep = 'final_answer';
  report.message = 'Claimed answer ' + claimed + ' does not match computed ' + JSON.stringify(eng);
  return report;
}

function buildHint(problemText, level) {
  const intent = math.detectMathIntent(problemText);
  const hints = {
    arithmetic: 'Сначала выполни действия в скобках, затем * и /, затем + и -.',
    quadratic: 'Приведи к виду ax²+bx+c=0, найди дискриминант D=b²-4ac.',
    equation: 'Изолируй переменную: перенеси слагаемые и раздели коэффициент.',
    derivative: 'Для x^n производная n*x^(n-1). Сумма дифференцируется почленно.',
    combinatorics: 'C(n,k)=n!/(k!(n-k)!). Упрости до вычисления.',
  };
  return {
    level: LEVELS.includes(level) ? level : 'school',
    hint: hints[intent.kind] || 'Выпиши данные, неизвестные и формулу, подходящую к типу задачи.',
    kind: intent.kind,
  };
}

function formatTutorResponse(check, lang) {
  if (!check) return '';
  if (check.verdict === 'correct') {
    return lang === 'ru' ? 'Решение верное: ответ совпадает с проверкой.' : 'Correct: answer matches independent check.';
  }
  if (check.verdict === 'incorrect') {
    return (lang === 'ru' ? 'Ошибка в ответе. ' : 'Incorrect answer. ') + check.message;
  }
  return check.message || '';
}

module.exports = {
  LEVELS,
  detectTutorIntent,
  extractClaimedAnswer,
  checkStudentSolution,
  buildHint,
  formatTutorResponse,
};
