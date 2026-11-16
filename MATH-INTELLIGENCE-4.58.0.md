# Math Intelligence 4.58.0

## Architecture
- `lib/math/math-router.js` — task classification
- `lib/math/math-verifier.js` — substitution + domain + optional SymPy equality
- `lib/math/math-solver.js` — orchestrate solve → verify → limited correct
- `lib/math-engine.js` — retained JS solvers + optional SymPy subprocess

## Repository decisions

| Repo | Role | Integration |
|------|------|-------------|
| SymPy | Symbolic CAS | Optional `python3` subprocess (already used) |
| Nerdamer | JS CAS | **Not** required — SymPy preferred when present |
| SageMath | Heavy CAS | **Rejected** as required Render dep (size) |
| Lean4 / Mathlib4 | Formal proofs | **Optional future** — not bundled; formalProof.available=false |
| Math-Verify | Equivalence ideas | Concepts in verifier; Python package not vendored |
| miniF2F / MATH / OlymMATH | Benchmarks | Source of test ideas; datasets not shipped in ZIP |
| MathDebugger | Error detection ideas | Tutor/verifier patterns |

## API
- POST `/api/math/intelligence` `{ problem, sympy? }`
- Chat cognitive path uses `math-solver` for math intents

## Honesty
- Verified only when substitution/deterministic/sympy check ran
- Lean formal proof not claimed without Lean runtime
