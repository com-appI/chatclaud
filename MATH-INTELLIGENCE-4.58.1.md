# Math Intelligence 4.58.1 — Mathematical Reliability & Precision

## Scope
This corrective release retains the 4.58.0 project structure and changes only the existing mathematical engine/router/solver/verifier integration, cognitive deterministic routing, release metadata, and regression tests. No production deployment was performed.

## Corrected issues
- Numeric-leading quadratic equations are routed to the quadratic solver before arithmetic parsing.
- The arithmetic evaluator is a bounded recursive-descent parser; it does not execute JavaScript with `eval` or `Function`.
- Integer arithmetic uses `BigInt` internally. Large integer answers remain exact strings; repeating rational answers remain exact fractions.
- Quadratic verification checks discriminant and expected root count, substitutes every root, and checks Vieta's sum/product identities. A single valid root is not accepted as a complete two-root solution.
- Polynomial derivative extraction works for English and Russian prompts. A second coefficient-rule check is performed before marking the answer verified.
- Population variance (division by n) and sample variance (division by n-1) are distinguished and both are reported; median is computed as a separate statistic rather than aliased to mean.
- The verifier no longer trusts a solver's `verified` property for unknown solver types.
- Optional SymPy input passes a strict identifier/operator allowlist before Python is invoked. The default process timeout is 4.5 seconds (bounded 1–10 seconds).
- The cognitive route no longer falls back to the legacy math engine after an unverified result.
- `/api/math/intelligence` and `/api/math/solve` use the existing JSON body reader with route-specific byte limits; HTTP regression tests exercise the live intelligence endpoint.

## Main changed files
- `lib/math-engine.js`
- `lib/math/math-router.js`
- `lib/math/math-solver.js`
- `lib/math/math-verifier.js`
- `lib/cognitive-router.js`
- `server.js` (math endpoint body parsing only)
- `test/math-reliability-4581.test.js`
- version/release metadata and the release assertion in `test/v160-upgrade.test.js`

## Verification
The release was verified locally with these actual results:
- `npm test`: **776 PASS, 0 FAIL** across 58 suites.
- `npm run check`: **PASS**; server/service-worker syntax and 25 inline scripts checked.
- Live HTTP POST `/api/math/intelligence`: quadratic equation and 23-digit multiplication both returned HTTP 200 with `verified: true`.
- Optional SymPy smoke test on the local environment: SymPy 1.14.0 successfully simplified a radical expression, solved `x^2 = 4`, and confirmed an equivalent-expression check.

The tests include the previously failing examples:
- `3x^2 - 14x + 8 = 0` → roots 2/3 and 4
- `x^2 - 5x + 6 = 0` → roots 2 and 3
- `x^2 + 1 = 0` → no real roots
- `d/dx (x^3 + 2x^2 + x + 7)` → `3x^2+4x+1`
- `30939392939929292983838 × 102` → exact integer `3155818079872787884351476`
- population variance of 1,2,3 → 2/3; sample variance → 1
- adversarial expressions and tampered solutions are rejected or left unverified.

## Limitations
- The deterministic polynomial parser handles explicit polynomial forms; it is not a full general-purpose computer algebra system.
- Lean 4/Mathlib and SageMath remain optional and are not installed or claimed as active proof engines.
- SymPy remains optional; when unavailable or timing out, the system must not claim that SymPy verified a result.
- Floating-point roots and statistical outputs are numerical approximations with tolerance-based checking; exact symbolic algebra is not claimed for all university mathematics.
