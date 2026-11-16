# Changelog 4.58.1

## Mathematical reliability and precision
- Replaced unsafe JavaScript `Function` arithmetic evaluation with a bounded recursive-descent parser.
- Added exact BigInt/rational arithmetic for large integers, fractions, percentages, and integer powers.
- Repaired routing so equations, quadratics, and derivatives cannot be captured by the generic arithmetic branch.
- Reworked quadratic parsing for signed/implicit coefficients and equations with both sides; added complete-root verification using discriminant, substitution, and Vieta checks.
- Repaired English and Russian polynomial derivative extraction and coefficient-rule verification.
- Added explicit population/sample variance handling, plus a separate median implementation; mean, median, and variance are no longer conflated.
- Removed verifier trust in engine-provided `verified` flags; unknown solver types remain unverified.
- Restricted optional SymPy expressions to an allowlisted grammar and raised the default subprocess timeout.
- Removed the cognitive router's legacy fallback that could bypass independent verification.
- Repaired the two math HTTP endpoints to use the server's actual bounded JSON body reader; added live HTTP regression checks.
- Added regression tests for all identified 4.58.0 math failures and adversarial inputs.

## Compatibility
- Existing application structure, UI, API routes, Groq provider/model, search integrations, and other non-math modules are retained.
- No production deployment was performed.
