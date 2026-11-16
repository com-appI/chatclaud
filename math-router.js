'use strict';
/**
 * Math Router 4.58.1 — classify specific mathematical operations before broad numeric patterns.
 */
function classifyMath(text) {
  const t = String(text || '').trim();
  const rules = [
    { type: 'derivative', re: /derivative|differentiate|производн|продифференц|d\s*\/\s*dx/i },
    { type: 'integral', re: /integral|интеграл|∫/i },
    { type: 'quadratic', re: /x\s*\^\s*2|x²|квадратн/i },
    { type: 'matrix', re: /matrix|матриц|det\s*\(|определител|eigen/i },
    { type: 'stats', re: /variance|дисперс|sample variance|выборочн.*дисперс|\bmean\b|средн|median|медиан/i },
    { type: 'combinatorics', re: /C\s*\(|\bP\s*\(|factorial|факториал|combinat|перестанов|\d+\s*!/i },
    { type: 'number_theory', re: /gcd|lcm|нод|нок|prime|простое число|modular|диофант/i },
    { type: 'probability', re: /probability|вероятн|bayes|байес|математическ.*ожидан/i },
    { type: 'limit', re: /limit|предел|lim\s/i },
    { type: 'system', re: /system|систем[аы]\s+уравнен/i },
    { type: 'proof', re: /prove|докаж|induction|индукц|от противного/i },
    { type: 'trig', re: /sin|cos|tan|тригонометр/i },
    { type: 'inequality', re: /[<>≤≥]|неравен/i },
  ];
  for (const rule of rules) if (rule.re.test(t)) return { type: rule.type, confidence: 0.9 };
  if (/x\s*=|\d\s*x|\bx\s*[+-]|\b[a-z]\s*=/.test(t) || /реш(?:и|ить)\s*уравнен/i.test(t)) {
    return { type: 'linear', confidence: 0.85 };
  }
  // Arithmetic is a last resort and is deliberately excluded when the prompt contains variables/equations.
  if (!/[=a-zа-яё]/i.test(t) && /\d+\s*[+\-*/×÷^]\s*\d+/.test(t)) return { type: 'arithmetic', confidence: 0.95 };
  if (/сколько будет|calculate|compute|вычисл|посчитай|what\s+is|how\s+much\s+is/i.test(t) && !/[=a-zа-яё]/i.test(t.replace(/сколько будет|calculate|compute|вычисл(?:и|ить)?|посчитай|what\s+is|how\s+much\s+is/ig, ''))) {
    return { type: 'arithmetic', confidence: 0.8 };
  }
  if (/\d/.test(t) && /[=+\-*/]/.test(t)) return { type: 'algebra', confidence: 0.55 };
  return { type: 'unknown', confidence: 0.2 };
}

function needsSymbolicEngine(type) {
  return ['derivative', 'integral', 'limit', 'matrix', 'system', 'algebra', 'trig', 'inequality', 'quadratic', 'linear'].includes(type);
}
function needsFormalProof(type) { return type === 'proof'; }
module.exports = { classifyMath, needsSymbolicEngine, needsFormalProof };
