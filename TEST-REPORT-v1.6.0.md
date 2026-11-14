# ChatClaud 1.6.0 — Test report

**Date:** 2026-11-14  
**Environment:** Node.js v22.16.0, Linux container; no production API credentials were supplied.

## Results

| Check | Result |
|---|---:|
| `npm test` | PASS — 157 tests, 0 failed |
| `npm run check` | PASS — server.js, sw.js and all 20 inline frontend scripts parsed |
| `npm run eval` | PASS — 100/100 intent-routing and tool-decision fixtures |
| Local server startup | PASS — server bound to localhost |
| `GET /api/health` | PASS — HTTP 200 |
| `GET /` | PASS — HTTP 200, HTML served |

## 100-case router evaluation

| Category | Cases | Passed |
|---|---:|---:|
| Logic and reasoning | 20 | 20 |
| Programming | 15 | 15 |
| Research | 15 | 15 |
| Mathematics | 10 | 10 |
| Documents | 10 | 10 |
| Memory and context | 10 | 10 |
| Multi-step tasks | 10 | 10 |
| Error and false-claim detection | 10 | 10 |
| **Total** | **100** | **100** |

Measured: deterministic intent/complexity routing and the tool-needed flag. The final local run reported 100% for both checks; average router classification latency was **0.0117 ms** in this test process. This is not LLM generation latency.

## Not measured / limitations

- End-to-end answer correctness on live Groq responses.
- Real task-completion quality, hallucination rate, and citation precision.
- Production token usage/cost, provider latency, and rate-limit behaviour.
- Live Nova search or page fetching. `/api/health` reported `hasGroq:false` and `hasNova:false` because the test environment contains no corresponding credentials/configuration.
- Production deployment, external service availability, and browser/device-specific visual QA.
- Independent penetration testing or a formal security certification.

The 100 cases are **Intent Router evaluation fixtures**, not 100 independent answer-quality tests. Do not interpret the result as a model-intelligence score. The local smoke test confirms that the app boots and serves the UI; it does not prove live Groq/Nova integrations work with production credentials.
