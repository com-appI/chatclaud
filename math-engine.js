'use strict';
/**
 * ChatClaud Mathematical Intelligence Engine 4.58.1
 * Deterministic JavaScript solvers with exact integer/rational arithmetic.
 * Optional SymPy calls are restricted to a small expression grammar.
 */
const { spawnSync } = require('child_process');

const DEFAULT_SYMPY_TIMEOUT_MS = 4500;
const MAX_EXPR_LENGTH = 500;
const MAX_TOKENS = 256;
const MAX_PARSE_DEPTH = 64;

function clamp(n, a, b) {
  n = Number(n);
  return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : a;
}

function absBigInt(n) { return n < 0n ? -n : n; }
function gcdBigInt(a, b) {
  a = absBigInt(a); b = absBigInt(b);
  while (b) { const t = a % b; a = b; b = t; }
  return a || 1n;
}
function rational(n, d) {
  if (d === 0n) throw new Error('division by zero');
  if (d < 0n) { n = -n; d = -d; }
  const g = gcdBigInt(n, d);
  return { n: n / g, d: d / g };
}
function addR(a, b) { return rational(a.n * b.d + b.n * a.d, a.d * b.d); }
function subR(a, b) { return rational(a.n * b.d - b.n * a.d, a.d * b.d); }
function mulR(a, b) { return rational(a.n * b.n, a.d * b.d); }
function divR(a, b) {
  if (b.n === 0n) throw new Error('division by zero');
  return rational(a.n * b.d, a.d * b.n);
}
function powR(a, exponent) {
  if (exponent < -1000n || exponent > 1000n) throw new Error('exponent out of supported range');
  if (exponent < 0n && a.n === 0n) throw new Error('zero cannot have a negative exponent');
  if (exponent < 0n) return rational(a.d ** (-exponent), a.n ** (-exponent));
  return rational(a.n ** exponent, a.d ** exponent);
}
function parseDecimalRational(s) {
  const value = String(s);
  if (!/^\d*(?:\.\d*)?$/.test(value) || !/\d/.test(value)) throw new Error('invalid number');
  if (!value.includes('.')) return rational(BigInt(value), 1n);
  const [whole, fraction] = value.split('.');
  const digits = fraction || '';
  const denominator = 10n ** BigInt(digits.length);
  return rational(BigInt((whole || '0') + digits), denominator);
}
function rationalToExactString(r) {
  if (r.d === 1n) return r.n.toString();
  let d = r.d;
  let twos = 0; let fives = 0;
  while (d % 2n === 0n) { d /= 2n; twos++; }
  while (d % 5n === 0n) { d /= 5n; fives++; }
  if (d !== 1n) return `${r.n}/${r.d}`;
  const places = Math.max(twos, fives);
  const scaled = r.n * (10n ** BigInt(places)) / r.d;
  const negative = scaled < 0n;
  const raw = absBigInt(scaled).toString().padStart(places + 1, '0');
  if (places === 0) return scaled.toString();
  const whole = raw.slice(0, -places) || '0';
  const fraction = raw.slice(-places).replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? '.' + fraction : ''}`;
}
function rationalToValue(r) {
  const exact = rationalToExactString(r);
  // Preserve exact large integers and repeating fractions as strings.
  if (r.d === 1n) {
    if (absBigInt(r.n) <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(r.n);
    return exact;
  }
  if (exact.includes('/')) return exact;
  const n = Number(exact);
  if (Number.isFinite(n) && Math.abs(n) <= Number.MAX_SAFE_INTEGER && exact.replace('-', '').length <= 18) return n;
  return exact;
}

/** Recursive-descent arithmetic parser. No eval/Function and no identifiers. */
function evaluateArithmeticDetailed(expression) {
  let source = String(expression == null ? '' : expression)
    .replace(/[−–]/g, '-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/\*\*/g, '^')
    .trim();
  if (!source || source.length > MAX_EXPR_LENGTH) return null;
  const tokens = [];
  const tokenRe = /\d+(?:\.\d*)?|\.\d+|[()+\-*/^%]/gy;
  let pos = 0;
  while (pos < source.length) {
    if (/\s/.test(source[pos])) { pos++; continue; }
    tokenRe.lastIndex = pos;
    const m = tokenRe.exec(source);
    if (!m) return null;
    tokens.push(m[0]);
    pos = tokenRe.lastIndex;
    if (tokens.length > MAX_TOKENS) return null;
  }
  let index = 0;
  let depth = 0;
  function peek() { return tokens[index]; }
  function take() { return tokens[index++]; }
  function primary() {
    const token = take();
    if (token === '(') {
      depth++;
      if (depth > MAX_PARSE_DEPTH) throw new Error('expression nesting too deep');
      const value = expressionNode();
      if (take() !== ')') throw new Error('missing closing parenthesis');
      depth--;
      return value;
    }
    if (token == null || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) throw new Error('expected number');
    let value = parseDecimalRational(token);
    while (peek() === '%') { take(); value = divR(value, rational(100n, 1n)); }
    return value;
  }
  function power() {
    const base = primary();
    if (peek() === '^') {
      take();
      const exponent = unary();
      if (exponent.d !== 1n) throw new Error('exponent must be an integer');
      return powR(base, exponent.n);
    }
    return base;
  }
  function unary() {
    if (peek() === '+') { take(); return unary(); }
    if (peek() === '-') { take(); const v = unary(); return rational(-v.n, v.d); }
    return power();
  }
  function term() {
    let value = unary();
    while (peek() === '*' || peek() === '/') {
      const op = take(); const right = unary();
      value = op === '*' ? mulR(value, right) : divR(value, right);
    }
    return value;
  }
  function expressionNode() {
    let value = term();
    while (peek() === '+' || peek() === '-') {
      const op = take(); const right = term();
      value = op === '+' ? addR(value, right) : subR(value, right);
    }
    return value;
  }
  try {
    const exactRational = expressionNode();
    if (index !== tokens.length) return null;
    return {
      value: rationalToValue(exactRational),
      exact: rationalToExactString(exactRational),
      numerator: exactRational.n.toString(),
      denominator: exactRational.d.toString(),
      expression: source,
    };
  } catch (_) {
    return null;
  }
}

function evalArithmetic(expr) {
  const result = evaluateArithmeticDetailed(expr);
  return result ? result.value : null;
}

function extractEquation(text) {
  const source = String(text || '').replace(/−/g, '-').replace(/²/g, '^2');
  const direct = source.match(/[0-9xX^.+\-*\s]+=[0-9xX^.+\-*\s]+/);
  if (direct && /x/i.test(direct[0])) return direct[0].replace(/\s+/g, ' ').trim();
  return null;
}

function parsePolynomial(expression, maxDegree) {
  const source = String(expression || '').replace(/\s+/g, '').replace(/[−–]/g, '-').replace(/²/g, '^2');
  if (!source || source.length > MAX_EXPR_LENGTH || /[()]/.test(source)) return null;
  const terms = source.match(/[+-]?[^+-]+/g);
  if (!terms || terms.join('') !== source) return null;
  const coefficients = Object.create(null);
  let degree = 0;
  for (const term of terms) {
    const variable = term.match(/^([+-]?)(?:(\d+(?:\.\d*)?|\.\d+)\*?)?x(?:\^(\d+))?$/i);
    if (variable) {
      const sign = variable[1] === '-' ? -1 : 1;
      const magnitude = variable[2] == null ? 1 : Number(variable[2]);
      const powerValue = variable[3] == null ? 1 : Number(variable[3]);
      if (!Number.isFinite(magnitude) || !Number.isSafeInteger(powerValue) || powerValue < 0 || powerValue > (maxDegree == null ? 1000 : maxDegree)) return null;
      const value = sign * magnitude;
      coefficients[powerValue] = (coefficients[powerValue] || 0) + value;
      degree = Math.max(degree, powerValue);
      continue;
    }
    const constant = term.match(/^([+-]?)(\d+(?:\.\d*)?|\.\d+)$/);
    if (!constant) return null;
    const value = (constant[1] === '-' ? -1 : 1) * Number(constant[2]);
    if (!Number.isFinite(value)) return null;
    coefficients[0] = (coefficients[0] || 0) + value;
  }
  for (const key of Object.keys(coefficients)) {
    if (Math.abs(coefficients[key]) < 1e-14) delete coefficients[key];
  }
  degree = Math.max(-1, ...Object.keys(coefficients).map(Number));
  return { coefficients, degree };
}

function subtractPolynomials(left, right) {
  const out = Object.assign(Object.create(null), left.coefficients);
  for (const [key, value] of Object.entries(right.coefficients)) out[key] = (out[key] || 0) - value;
  for (const key of Object.keys(out)) if (Math.abs(out[key]) < 1e-14) delete out[key];
  return { coefficients: out, degree: Math.max(-1, ...Object.keys(out).map(Number)) };
}

function equationPolynomial(text, maxDegree) {
  const equation = extractEquation(text);
  if (!equation) return null;
  const sides = equation.split('=');
  if (sides.length !== 2) return null;
  const left = parsePolynomial(sides[0], maxDegree);
  const right = parsePolynomial(sides[1], maxDegree);
  if (!left || !right) return null;
  return { equation, ...subtractPolynomials(left, right) };
}

function solveQuadratic(text) {
  let polynomial = equationPolynomial(text, 2);
  if (!polynomial) {
    const source = String(text || '').replace(/²/g, '^2');
    const expr = source.match(/[0-9xX^.+\-*\s]*x[0-9xX^.+\-*\s]*/i);
    if (!expr) return null;
    const parsed = parsePolynomial(expr[0].trim(), 2);
    if (!parsed) return null;
    polynomial = parsed;
  }
  const a = polynomial.coefficients[2] || 0;
  const b = polynomial.coefficients[1] || 0;
  const c = polynomial.coefficients[0] || 0;
  if (Math.abs(a) < 1e-14) return null;
  let D = b * b - 4 * a * c;
  const scale = Math.max(1, Math.abs(b * b), Math.abs(4 * a * c));
  if (Math.abs(D) <= 1e-13 * scale) D = 0;
  if (D < 0) return { a, b, c, D, roots: [], note: 'no real roots', equation: polynomial.equation || null };
  const sqrtD = Math.sqrt(D);
  if (D === 0) {
    return { a, b, c, D, roots: [-b / (2 * a)], equation: polynomial.equation || null };
  }
  const q = -0.5 * (b + (b >= 0 ? sqrtD : -sqrtD));
  const r1 = q / a;
  const r2 = Math.abs(q) < 1e-300 ? (-b - sqrtD) / (2 * a) : c / q;
  return { a, b, c, D, roots: [r1, r2].sort((x, y) => x - y), equation: polynomial.equation || null };
}

function solveLinear(text) {
  const polynomial = equationPolynomial(text, 1);
  if (!polynomial || polynomial.degree > 1) return null;
  const a = polynomial.coefficients[1] || 0;
  const b = polynomial.coefficients[0] || 0;
  if (Math.abs(a) < 1e-14) {
    return { kind: Math.abs(b) < 1e-14 ? 'identity' : 'contradiction', form: 'ax+b=0', a, b, equation: polynomial.equation };
  }
  return { x: -b / a, form: 'ax+b=0', a, b, equation: polynomial.equation };
}

function formatPolynomial(coefficients) {
  const powers = Object.keys(coefficients).map(Number).filter((p) => Math.abs(coefficients[p]) > 1e-14).sort((a, b) => b - a);
  if (!powers.length) return '0';
  const out = [];
  for (const p of powers) {
    const coefficient = coefficients[p];
    const sign = coefficient < 0 ? '-' : '+';
    const abs = Math.abs(coefficient);
    const body = p === 0 ? String(abs) : `${abs === 1 ? '' : String(abs)}x${p === 1 ? '' : '^' + p}`;
    out.push({ sign, body });
  }
  return out.map((item, i) => (i === 0 ? (item.sign === '-' ? '-' : '') : item.sign) + item.body).join('');
}

function differentiatePolynomial(expr) {
  const parsed = parsePolynomial(expr, 1000);
  if (!parsed) return null;
  const derivative = Object.create(null);
  for (const [powerString, coefficient] of Object.entries(parsed.coefficients)) {
    const powerValue = Number(powerString);
    if (powerValue > 0) derivative[powerValue - 1] = (derivative[powerValue - 1] || 0) + coefficient * powerValue;
  }
  return formatPolynomial(derivative);
}

function extractDerivativeExpression(text) {
  const source = String(text || '').trim();
  const patterns = [
    /(?:derivative|differentiate)\s+(?:of\s+)?(?:the\s+function\s+)?(?:f\s*\(\s*x\s*\)\s*=\s*)?(.+?)\s*$/i,
    /(?:производн[а-яё]*|продифференцир[а-яё]*)\s*(?:функц[а-яё]*\s*)?(?:от\s*)?(?:f\s*\(\s*x\s*\)\s*=\s*)?(.+?)\s*$/i,
    /d\s*\/\s*dx\s*(?:\(?\s*)(.+?)\s*\)?\s*$/i,
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match && match[1]) return match[1].replace(/[?.!]+$/, '').trim().replace(/^\((.*)\)$/, '$1');
  }
  return null;
}

function factorial(n) {
  const value = Number(n);
  if (!Number.isSafeInteger(value) || value < 0 || value > 1000) return null;
  let result = 1n;
  for (let i = 2n; i <= BigInt(value); i++) result *= i;
  return result <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(result) : result.toString();
}

function combination(n, k) {
  n = Number(n); k = Number(k);
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(k) || n < 0 || k < 0 || k > n || n > 10000) return null;
  k = Math.min(k, n - k);
  let result = 1n;
  for (let i = 1; i <= k; i++) result = (result * BigInt(n - k + i)) / BigInt(i);
  return result <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(result) : result.toString();
}

function safeSympyExpression(value) {
  const expression = String(value || '').trim();
  if (!expression || expression.length > 400) return null;
  if (!/^[0-9A-Za-z_\s+\-*/^().,]+$/.test(expression)) return null;
  if (/[\[\]{}'";:`\\]/.test(expression) || expression.includes('__')) return null;
  const identifiers = expression.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
  const allowed = new Set(['x', 'y', 'z', 't', 'n', 'a', 'b', 'c', 'pi', 'E', 'sqrt', 'sin', 'cos', 'tan', 'log', 'ln', 'exp', 'Abs']);
  if (identifiers.some((name) => !allowed.has(name))) return null;
  return expression;
}

function runPython(script, args, timeoutMs) {
  try {
    const result = spawnSync('python3', ['-c', script, ...args], {
      encoding: 'utf8',
      timeout: clamp(timeoutMs == null ? DEFAULT_SYMPY_TIMEOUT_MS : timeoutMs, 1000, 10000),
      maxBuffer: 64 * 1024,
      windowsHide: true,
    });
    if (result.error || result.status !== 0 || !result.stdout) return null;
    const payload = JSON.parse(String(result.stdout).trim().split('\n').pop());
    return payload && payload.ok ? payload : null;
  } catch (_) {
    return null;
  }
}

/** Optional SymPy. Input is restricted before the Python process receives it. */
function sympyEval(expression, timeoutMs) {
  const expr = safeSympyExpression(expression);
  if (!expr) return null;
  const py = [
    'import json,sys',
    'try:',
    ' import sympy as sp',
    ' x,y,z,t,n,a,b,c = sp.symbols("x y z t n a b c")',
    ' expr=sp.sympify(sys.argv[1], locals={"x":x,"y":y,"z":z,"t":t,"n":n,"a":a,"b":b,"c":c,"pi":sp.pi,"E":sp.E,"sqrt":sp.sqrt,"sin":sp.sin,"cos":sp.cos,"tan":sp.tan,"log":sp.log,"ln":sp.log,"exp":sp.exp,"Abs":sp.Abs})',
    ' result=sp.simplify(expr.doit() if hasattr(expr,"doit") else expr)',
    ' print(json.dumps({"ok":True,"result":str(result)}))',
    'except Exception as e:',
    ' print(json.dumps({"ok":False,"error":str(e)}))',
  ].join('\n');
  const data = runPython(py, [expr], timeoutMs);
  return data ? { engine: 'sympy', result: data.result } : null;
}

function sympySolve(equation, timeoutMs) {
  const source = String(equation || '');
  const sides = source.split('=');
  if (sides.length > 2) return null;
  const left = safeSympyExpression(sides[0]);
  const right = safeSympyExpression(sides.length === 2 ? sides[1] : '0');
  if (!left || !right) return null;
  const py = [
    'import json,sys',
    'try:',
    ' import sympy as sp',
    ' x,y,z = sp.symbols("x y z")',
    ' allowed={"x":x,"y":y,"z":z,"pi":sp.pi,"E":sp.E,"sqrt":sp.sqrt,"sin":sp.sin,"cos":sp.cos,"tan":sp.tan,"log":sp.log,"ln":sp.log,"exp":sp.exp,"Abs":sp.Abs}',
    ' lhs=sp.sympify(sys.argv[1], locals=allowed)',
    ' rhs=sp.sympify(sys.argv[2], locals=allowed)',
    ' sols=sp.solve(sp.Eq(lhs,rhs), x)',
    ' print(json.dumps({"ok":True,"result":[str(s) for s in sols]}))',
    'except Exception as e:',
    ' print(json.dumps({"ok":False,"error":str(e)}))',
  ].join('\n');
  const data = runPython(py, [left, right], timeoutMs);
  return data ? { engine: 'sympy', roots: data.result } : null;
}

function extractArithmeticExpression(text) {
  const source = String(text || '').replace(/[−–]/g, '-').replace(/×/g, '*').replace(/÷/g, '/');
  if (source.includes('=') || /[a-zа-яё]/i.test(source.replace(/(?:calculate|compute|сколько\s+будет|вычисли|вычислить|посчитай|what\s+is|how\s+much\s+is)\s*/ig, ''))) return null;
  const matches = source.match(/[0-9.(][0-9\s().,+\-*/^%]*/g) || [];
  const candidates = matches.map((m) => m.trim().replace(/[?.!,]+$/, '').trim()).filter((m) => /[+*/^%]|\d\s*-\s*\d/.test(m));
  for (const candidate of candidates.sort((a, b) => b.length - a.length)) {
    const evaluated = evaluateArithmeticDetailed(candidate);
    if (evaluated) return candidate;
  }
  const stripped = source.replace(/^(?:calculate|compute|вычисли|вычислить|посчитай|сколько\s+будет|what\s+is|how\s+much\s+is)\s*/i, '').replace(/[?.!]+$/, '').trim();
  return evaluateArithmeticDetailed(stripped) ? stripped : null;
}

function detectMathIntent(text) {
  const t = String(text || '').trim();
  if (!t) return { isMath: false, kind: null };
  if (/(?:derivative|differentiate|производн|продифференц|d\s*\/\s*dx)/i.test(t)) return { isMath: true, kind: 'derivative' };
  if (/(?:integral|интеграл|∫)/i.test(t)) return { isMath: true, kind: 'integral' };
  if (/x\s*\^\s*2|x²|квадратн/i.test(t)) return { isMath: true, kind: 'quadratic' };
  if (/det\s*\(|матриц|matrix|определител/i.test(t)) return { isMath: true, kind: 'matrix' };
  if (/variance|дисперс|sample variance|выборочн.*дисперс/i.test(t)) return { isMath: true, kind: 'stats-variance' };
  if (/median|медиан/i.test(t)) return { isMath: true, kind: 'stats-median' };
  if (/\b(?:mean|average)\b|средн(?:ее|юю|яя)?/i.test(t)) return { isMath: true, kind: 'stats-mean' };
  if (/C\s*\(|\bP\s*\(|combinat|перестанов|factorial|факториал|\d+\s*!/i.test(t)) return { isMath: true, kind: 'combinatorics' };
  if (/\b(?:prove|докаж|доказательств|индукц)/i.test(t)) return { isMath: true, kind: 'proof' };
  if (/\b(?:limit|предел|lim\s)/i.test(t)) return { isMath: true, kind: 'limit' };
  if (/\b(?:sin|cos|tan)|тригонометр/i.test(t)) return { isMath: true, kind: 'trig' };
  if (extractEquation(t)) return { isMath: true, kind: /x\s*\^\s*2|x²/i.test(t) ? 'quadratic' : 'equation' };
  if (/\d+\s*[+\-*/×÷^]\s*\d+/.test(t) || /сколько будет|compute|calculate|вычисл|посчитай/i.test(t)) {
    return { isMath: true, kind: 'arithmetic' };
  }
  return { isMath: false, kind: null };
}

function extractNumbers(text) {
  return (String(text || '').match(/(?<![A-Za-zА-Яа-я])[-+]?(?:\d+\.?\d*|\.\d+)/g) || []).map(Number).filter(Number.isFinite);
}

function solveMath(text, options) {
  const opts = options || {};
  const source = String(text || '');
  const intent = detectMathIntent(source);
  const steps = [];
  const result = { ok: false, intent, answer: null, steps, verified: false, engine: 'js', warnings: [] };
  if (!intent.isMath && !opts.force) { result.warnings.push('not classified as math'); return result; }
  steps.push({ stage: 'understand', detail: intent.kind || 'general' });

  if (intent.kind === 'arithmetic') {
    const expression = extractArithmeticExpression(source);
    const evaluated = expression ? evaluateArithmeticDetailed(expression) : null;
    steps.push({ stage: 'compute', detail: 'exact-arithmetic', expr: expression, value: evaluated && evaluated.value });
    if (evaluated) {
      result.ok = true; result.answer = evaluated.value; result.engine = 'js-arithmetic';
      const repeat = evaluateArithmeticDetailed(expression);
      result.verified = !!repeat && repeat.exact === evaluated.exact;
      result.detail = { expression, exact: evaluated.exact, numerator: evaluated.numerator, denominator: evaluated.denominator };
      return result;
    }
  }

  if (intent.kind === 'quadratic') {
    const q = solveQuadratic(source);
    steps.push({ stage: 'formalize', detail: 'quadratic', value: q });
    if (q) {
      result.ok = true; result.answer = q.roots.length ? q.roots : 'no real roots';
      result.detail = q; result.engine = 'js-quadratic';
      steps.push({ stage: 'candidate-roots', count: q.roots.length, discriminant: q.D });
      return result;
    }
  }

  if (intent.kind === 'equation') {
    const linear = solveLinear(source);
    if (linear) {
      result.detail = linear; result.engine = 'js-linear';
      if (linear.kind === 'identity') { result.ok = true; result.answer = 'all real numbers'; }
      else if (linear.kind === 'contradiction') { result.ok = true; result.answer = 'no solution'; }
      else { result.ok = true; result.answer = linear.x; }
      steps.push({ stage: 'solve-linear', value: result.answer });
      return result;
    }
  }

  if (intent.kind === 'derivative') {
    const expression = extractDerivativeExpression(source);
    const derivative = expression ? differentiatePolynomial(expression) : null;
    if (derivative != null) {
      result.ok = true; result.answer = derivative; result.engine = 'js-derivative';
      result.detail = { sourceExpression: expression, derivative };
      steps.push({ stage: 'differentiate-polynomial', source: expression, value: derivative });
      return result;
    }
  }

  if (intent.kind === 'combinatorics') {
    const factorialMatch = source.match(/(\d+)\s*!/);
    if (factorialMatch) {
      const value = factorial(factorialMatch[1]);
      if (value != null) { result.ok = true; result.answer = value; result.engine = 'js-factorial'; result.detail = { n: Number(factorialMatch[1]) }; return result; }
    }
    const choose = source.match(/C\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/i) || source.match(/(\d+)\s*choose\s*(\d+)/i);
    if (choose) {
      const value = combination(choose[1], choose[2]);
      if (value != null) { result.ok = true; result.answer = value; result.engine = 'js-combination'; result.detail = { n: Number(choose[1]), k: Number(choose[2]) }; return result; }
    }
  }

  if (intent.kind === 'matrix') {
    const cells = parseMatrix2x2(source);
    if (cells) {
      const value = det2(...cells);
      result.ok = true; result.answer = value; result.engine = 'js-matrix';
      result.detail = { cells, value }; steps.push({ stage: 'determinant-2x2', value }); return result;
    }
  }

  if (intent.kind === 'stats-variance' || intent.kind === 'stats-mean' || intent.kind === 'stats-median') {
    const values = extractNumbers(source);
    if (values.length >= (intent.kind === 'stats-variance' ? 2 : 1)) {
      const average = mean(values);
      const population = variance(values);
      const sample = sampleVariance(values);
      const useSample = /sample|выборочн/i.test(source);
      const sorted = values.slice().sort((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      const medianValue = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
      result.ok = true;
      result.engine = intent.kind === 'stats-variance' ? 'js-variance' : intent.kind === 'stats-median' ? 'js-median' : 'js-mean';
      result.answer = intent.kind === 'stats-mean' ? average : intent.kind === 'stats-median' ? medianValue : (useSample ? sample : population);
      result.detail = { values, count: values.length, mean: average, median: medianValue, populationVariance: population, sampleVariance: sample, varianceConvention: useSample ? 'sample (n-1)' : 'population (n)' };
      steps.push({ stage: 'statistics', detail: result.detail }); return result;
    }
  }

  // A symbolic fallback is allowed only for a validated, compact expression.
  if (opts.useSympy !== false && intent.kind === 'unknown') {
    const expression = safeSympyExpression(source);
    const symbolic = expression ? sympyEval(expression, opts.sympyTimeoutMs) : null;
    if (symbolic) { result.ok = true; result.answer = symbolic.result; result.engine = 'sympy'; result.detail = { expression }; steps.push({ stage: 'sympy', value: symbolic.result }); return result; }
  }
  result.warnings.push('no deterministic solver matched; no verified answer produced');
  return result;
}

function formatNumber(value, digits) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value);
  const rounded = Number(value.toFixed(digits == null ? 10 : digits));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}
function formatMathAnswer(solved, lang) {
  if (!solved || !solved.ok) return null;
  const answer = solved.answer;
  if (Array.isArray(answer)) {
    return (lang === 'ru' ? 'Корни: ' : 'Roots: ') + answer.map((v) => formatNumber(v, 10)).join(', ');
  }
  return typeof answer === 'number' ? formatNumber(answer, 10) : String(answer);
}

function det2(a, b, c, d) { return a * d - b * c; }
function multiplyMatrices(A, B) {
  if (!Array.isArray(A) || !Array.isArray(B) || !A.length || !B.length || !Array.isArray(A[0]) || !Array.isArray(B[0])) return null;
  const n = A.length; const inner = A[0].length; const m = B[0].length;
  if (!A.every((row) => Array.isArray(row) && row.length === inner) || B.length !== inner || !B.every((row) => Array.isArray(row) && row.length === m)) return null;
  if (![...A.flat(), ...B.flat()].every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
  const output = Array.from({ length: n }, () => Array(m).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) for (let k = 0; k < inner; k++) output[i][j] += A[i][k] * B[k][j];
  return output;
}
function sinDeg(x) { return Math.sin((Number(x) * Math.PI) / 180); }
function cosDeg(x) { return Math.cos((Number(x) * Math.PI) / 180); }
function mean(arr) {
  const values = (arr || []).map(Number);
  if (!values.length || !values.every(Number.isFinite)) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function median(arr) {
  const values = (arr || []).map(Number);
  if (!values.length || !values.every(Number.isFinite)) return null;
  values.sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}
function variance(arr) {
  const values = (arr || []).map(Number);
  if (values.length < 1 || !values.every(Number.isFinite)) return null;
  const average = mean(values);
  return values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / values.length;
}
function sampleVariance(arr) {
  const values = (arr || []).map(Number);
  if (values.length < 2 || !values.every(Number.isFinite)) return null;
  const average = mean(values);
  return values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / (values.length - 1);
}
function parseMatrix2x2(text) {
  const source = String(text || '');
  let match = source.match(/\[\[\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*\]\s*,\s*\[\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*\]\]/);
  if (match) return match.slice(1).map(Number);
  match = source.match(/det\s*\(\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*\)/i);
  if (match) return match.slice(1).map(Number);
  return null;
}

module.exports = {
  evalArithmetic,
  evaluateArithmeticDetailed,
  extractArithmeticExpression,
  solveQuadratic,
  solveLinear,
  parsePolynomial,
  differentiatePolynomial,
  extractDerivativeExpression,
  factorial,
  combination,
  sympyEval,
  sympySolve,
  safeSympyExpression,
  detectMathIntent,
  solveMath,
  formatMathAnswer,
  det2,
  multiplyMatrices,
  sinDeg,
  cosDeg,
  mean,
  median,
  variance,
  sampleVariance,
  parseMatrix2x2,
};
