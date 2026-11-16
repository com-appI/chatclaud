'use strict';
/**
 * Math Verifier 4.58.1 — verifies solution completeness and exact deterministic operations.
 * It never promotes an engine's own boolean flag into independent verification.
 */
const { spawnSync } = require('child_process');
const math = require('../math-engine');

function clampTimeout(ms) {
  const value = Number(ms);
  return Number.isFinite(value) ? Math.max(1000, Math.min(10000, value)) : 4500;
}
function runSympy(script, args, timeoutMs) {
  try {
    const result = spawnSync('python3', ['-c', script, ...args], {
      encoding: 'utf8', timeout: clampTimeout(timeoutMs), maxBuffer: 64 * 1024, windowsHide: true,
    });
    if (result.error || result.status !== 0 || !result.stdout) return null;
    const data = JSON.parse(String(result.stdout).trim().split('\n').pop());
    return data && data.ok ? data : null;
  } catch (_) { return null; }
}
function sympyIsZero(expression, timeoutMs) {
  const expr = math.safeSympyExpression(expression);
  if (!expr) return null;
  const py = [
    'import json,sys',
    'try:',
    ' import sympy as sp',
    ' x,y,z,t,n,a,b,c = sp.symbols("x y z t n a b c")',
    ' allowed={"x":x,"y":y,"z":z,"t":t,"n":n,"a":a,"b":b,"c":c,"pi":sp.pi,"E":sp.E,"sqrt":sp.sqrt,"sin":sp.sin,"cos":sp.cos,"tan":sp.tan,"log":sp.log,"ln":sp.log,"exp":sp.exp,"Abs":sp.Abs}',
    ' e=sp.sympify(sys.argv[1], locals=allowed)',
    ' r=sp.simplify(sp.expand(e))',
    ' print(json.dumps({"ok":True,"zero":r == 0,"repr":str(r)}))',
    'except Exception as e:',
    ' print(json.dumps({"ok":False,"error":str(e)}))',
  ].join('\n');
  return runSympy(py, [expr], timeoutMs);
}
function sympyEqual(left, right, timeoutMs) {
  const a = math.safeSympyExpression(left);
  const b = math.safeSympyExpression(right);
  if (!a || !b) return null;
  const py = [
    'import json,sys',
    'try:',
    ' import sympy as sp',
    ' x,y,z,t,n,a,b,c = sp.symbols("x y z t n a b c")',
    ' allowed={"x":x,"y":y,"z":z,"t":t,"n":n,"a":a,"b":b,"c":c,"pi":sp.pi,"E":sp.E,"sqrt":sp.sqrt,"sin":sp.sin,"cos":sp.cos,"tan":sp.tan,"log":sp.log,"ln":sp.log,"exp":sp.exp,"Abs":sp.Abs}',
    ' ea=sp.sympify(sys.argv[1], locals=allowed)',
    ' eb=sp.sympify(sys.argv[2], locals=allowed)',
    ' diff=sp.simplify(sp.expand(ea-eb))',
    ' print(json.dumps({"ok":True,"equal":diff == 0,"diff":str(diff)}))',
    'except Exception as e:',
    ' print(json.dumps({"ok":False,"error":str(e)}))',
  ].join('\n');
  return runSympy(py, [a, b], timeoutMs);
}
function closeEnough(a, b, eps) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const tolerance = eps == null ? 1e-8 : eps;
  return Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));
}
function verifyQuadraticRoots(a, b, c, roots, eps) {
  const tolerance = eps == null ? 1e-8 : eps;
  const issues = [];
  if (![a, b, c].every(Number.isFinite) || Math.abs(a) < 1e-14) return { verified: false, issues: ['invalid quadratic coefficients'], method: 'quadratic-completeness-and-vieta' };
  if (!Array.isArray(roots)) return { verified: false, issues: ['roots not array'], method: 'quadratic-completeness-and-vieta' };
  const discriminant = b * b - 4 * a * c;
  const scale = Math.max(1, Math.abs(b * b), Math.abs(4 * a * c));
  const d = Math.abs(discriminant) <= 1e-13 * scale ? 0 : discriminant;
  if (d < 0) {
    if (roots.length !== 0) issues.push('quadratic has no real roots but candidate roots were returned');
    return { verified: issues.length === 0, issues, method: 'negative-discriminant-proof' };
  }
  const expectedCount = d === 0 ? 1 : 2;
  if (roots.length !== expectedCount) issues.push(`expected ${expectedCount} distinct real root(s), received ${roots.length}`);
  for (const root of roots) {
    if (typeof root !== 'number' || !Number.isFinite(root)) { issues.push('root is not a finite number'); continue; }
    const residual = a * root * root + b * root + c;
    if (!closeEnough(residual, 0, tolerance)) issues.push(`root ${root} has residual ${residual}`);
  }
  if (roots.length === expectedCount && roots.every((root) => typeof root === 'number' && Number.isFinite(root))) {
    const sum = roots.reduce((acc, value) => acc + value, 0);
    const product = roots.reduce((acc, value) => acc * value, 1);
    if (!closeEnough(sum, -b / a, tolerance)) issues.push('Vieta sum check failed');
    if (!closeEnough(product, c / a, tolerance)) issues.push('Vieta product check failed');
  }
  return { verified: issues.length === 0, issues, method: 'substitution-plus-vieta-completeness' };
}
function verifyLinear(a, b, x, eps) {
  const tolerance = eps == null ? 1e-9 : eps;
  if (![a, b, x].every(Number.isFinite) || Math.abs(a) < 1e-14) return { verified: false, issues: ['invalid linear solution data'], method: 'linear-substitution' };
  const residual = a * x + b;
  return { verified: closeEnough(residual, 0, tolerance), residual, issues: closeEnough(residual, 0, tolerance) ? [] : ['linear substitution failed'], method: 'linear-substitution' };
}
function checkDomainNotes(text) {
  const notes = [];
  const source = String(text || '');
  if (/\/\s*\(?\s*0+(?:\.0+)?\s*\)?(?=$|[\s),])/u.test(source) || /÷\s*0+(?:\.0+)?(?=$|[\s),])/u.test(source)) notes.push('possible division by zero');
  if (/(?:log|ln)\s*\(\s*-|log\s*-\s*\d/i.test(source)) notes.push('logarithm argument may be non-positive');
  if (/(?:sqrt|√)\s*\(\s*-/i.test(source)) notes.push('square root of a negative value may require complex numbers');
  return notes;
}
function nearlyEqual(a, b, eps) {
  if (typeof a === 'number' && typeof b === 'number') return closeEnough(a, b, eps);
  return String(a) === String(b);
}
function normalizedPolynomialString(value) {
  return String(value || '').replace(/\s+/g, '').replace(/\*+/g, '').replace(/²/g, '^2').replace(/\+\-/g, '-');
}
function expectedDerivative(expression) {
  const parsed = math.parsePolynomial(expression, 1000);
  if (!parsed) return null;
  const coefficients = Object.create(null);
  for (const [powerString, coefficient] of Object.entries(parsed.coefficients)) {
    const power = Number(powerString);
    if (power > 0) coefficients[power - 1] = (coefficients[power - 1] || 0) + coefficient * power;
  }
  const powers = Object.keys(coefficients).map(Number).filter((p) => Math.abs(coefficients[p]) > 1e-14).sort((a, b) => b - a);
  if (!powers.length) return '0';
  return powers.map((power, index) => {
    const coefficient = coefficients[power];
    const sign = coefficient < 0 ? '-' : '+';
    const magnitude = Math.abs(coefficient);
    const body = power === 0 ? String(magnitude) : `${magnitude === 1 ? '' : magnitude}x${power === 1 ? '' : '^' + power}`;
    return (index === 0 ? (sign === '-' ? '-' : '') : sign) + body;
  }).join('');
}
function extractNumbers(text) {
  return (String(text || '').match(/(?<![A-Za-zА-Яа-я])[-+]?(?:\d+\.?\d*|\.\d+)/g) || []).map(Number).filter(Number.isFinite);
}

/** High-level verifier. Unknown engines remain unverified. */
function verifySolved(solved, originalText) {
  const report = {
    verified: false,
    method: null,
    issues: [],
    domainNotes: checkDomainNotes(originalText),
    formalProof: false,
    engine: solved && solved.engine || null,
  };
  if (!solved || !solved.ok) { report.issues.push('no successful solve'); return report; }

  if (solved.engine === 'js-arithmetic' && solved.detail && solved.detail.expression) {
    const rerun = math.evaluateArithmeticDetailed(solved.detail.expression);
    const correct = !!rerun && rerun.exact === solved.detail.exact && String(rerun.value) === String(solved.answer);
    report.verified = correct;
    report.method = 'exact-rational-recalculation';
    report.issues = correct ? [] : ['arithmetic recomputation did not match the reported answer'];
    return report;
  }

  if (solved.engine === 'js-quadratic' && solved.detail) {
    const check = verifyQuadraticRoots(solved.detail.a, solved.detail.b, solved.detail.c, solved.detail.roots || []);
    report.verified = check.verified;
    report.method = check.method;
    report.issues = check.issues;
    return report;
  }

  if (solved.engine === 'js-linear' && solved.detail) {
    const detail = solved.detail;
    if (detail.kind === 'identity') {
      report.verified = Math.abs(detail.a || 0) < 1e-14 && Math.abs(detail.b || 0) < 1e-14 && solved.answer === 'all real numbers';
      report.method = 'linear-identity-check';
    } else if (detail.kind === 'contradiction') {
      report.verified = Math.abs(detail.a || 0) < 1e-14 && Math.abs(detail.b || 0) > 1e-14 && solved.answer === 'no solution';
      report.method = 'linear-contradiction-check';
    } else {
      const check = verifyLinear(detail.a, detail.b, detail.x);
      report.verified = check.verified && nearlyEqual(detail.x, solved.answer);
      report.method = check.method;
      report.issues = check.issues;
    }
    if (!report.verified && !report.issues.length) report.issues.push('linear solution did not match its equation data');
    return report;
  }

  if (solved.engine === 'js-derivative' && solved.detail) {
    const expected = expectedDerivative(solved.detail.sourceExpression);
    const correct = expected != null && normalizedPolynomialString(expected) === normalizedPolynomialString(solved.answer);
    report.verified = correct;
    report.method = 'polynomial-power-rule-coefficient-check';
    report.issues = correct ? [] : ['derivative coefficients do not match the power rule'];
    return report;
  }

  if (solved.engine === 'js-variance' || solved.engine === 'js-mean' || solved.engine === 'js-median') {
    const values = extractNumbers(originalText);
    if (values.length !== solved.detail.values.length || values.length === 0) {
      report.issues.push('statistics input values could not be reconstructed');
      return report;
    }
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    const populationVariance = values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / values.length;
    const sampleVariance = values.length > 1 ? values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / (values.length - 1) : null;
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const medianValue = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    const expected = solved.engine === 'js-mean' ? average : solved.engine === 'js-median' ? medianValue : (/sample|выборочн/i.test(originalText) ? sampleVariance : populationVariance);
    report.verified = Number.isFinite(expected) && closeEnough(Number(solved.answer), expected);
    report.method = solved.engine === 'js-median' ? 'independent-median-recalculation' : 'independent-statistical-recalculation';
    report.issues = report.verified ? [] : ['statistical result does not match the reconstructed input values'];
    return report;
  }

  if (solved.engine === 'js-factorial' && solved.detail) {
    let expected = 1n;
    for (let i = 2n; i <= BigInt(solved.detail.n); i++) expected *= i;
    report.verified = String(expected) === String(solved.answer);
    report.method = 'bigint-factorial-recalculation';
    report.issues = report.verified ? [] : ['factorial result mismatch'];
    return report;
  }

  if (solved.engine === 'js-combination' && solved.detail) {
    const { n, k } = solved.detail;
    let expected = 1n;
    for (let i = 1; i <= Math.min(k, n - k); i++) expected = (expected * BigInt(n - Math.min(k, n - k) + i)) / BigInt(i);
    report.verified = String(expected) === String(solved.answer);
    report.method = 'bigint-binomial-recalculation';
    report.issues = report.verified ? [] : ['binomial coefficient mismatch'];
    return report;
  }

  if (solved.engine === 'js-matrix' && solved.detail) {
    const [a, b, c, d] = solved.detail.cells;
    const expected = a * d - b * c;
    report.verified = closeEnough(expected, Number(solved.answer));
    report.method = '2x2-determinant-recalculation';
    report.issues = report.verified ? [] : ['determinant mismatch'];
    return report;
  }

  // SymPy output is not independently trusted unless the expression can be checked again.
  if (solved.engine === 'sympy' && solved.detail && solved.detail.expression) {
    const check = sympyEqual(solved.detail.expression, String(solved.answer));
    report.verified = !!(check && check.equal);
    report.method = check ? 'sympy-equivalence-recheck' : null;
    if (!report.verified) report.issues.push('symbolic result could not be independently confirmed');
    return report;
  }

  report.issues.push('no independent verifier is implemented for this solver type');
  return report;
}

module.exports = {
  sympyIsZero,
  sympyEqual,
  verifyQuadraticRoots,
  verifyLinear,
  checkDomainNotes,
  nearlyEqual,
  verifySolved,
};
