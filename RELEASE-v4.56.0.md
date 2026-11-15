# ChatClaud 4.56.0 — Cognitive Intelligence Upgrade

## New modules
- `lib/math-engine.js` — arithmetic, linear/quadratic, derivatives, combinatorics, optional SymPy
- `lib/student-tutor.js` — check student answers, hints
- `lib/project-analyzer.js` — HTML/CSS/JS/JSON diagnostics
- `lib/cognitive-router.js` — routes to engines before LLM

## Chat integration
Deterministic math/tutor/analyzer run **before** CHAL/LLM when intent matches.

## APIs
- POST /api/math/solve
- POST /api/tutor/check
- POST /api/analyze/project

## Limits
- SymPy optional (`CC_MATH_SYMPY=0` to disable)
- Not full CAS coverage of all 20 math domains
- Project analyzer is static, not a full interpreter
