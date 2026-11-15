# ChatClaud 3.18.9 — test report

Run locally from the application root on 2026-11-15.

## Results

| Command | Result |
|---|---:|
| `npm run check` | Passed; Node syntax checks and 21 inline JavaScript scripts checked |
| `npm test` | 164 passed, 0 failed, 5 suites |
| `npm run eval` | 100/100 routing/tool-decision cases passed |

The evaluation reported routing accuracy **1.0** and tool-decision accuracy **1.0**. Average router evaluation latency in this run was approximately **0.012 ms**; this is local router evaluation time, not model response latency or search provider latency.

## Coverage highlights

- Serper and Tavily endpoint/authentication contracts, backend-only credentials, and parallel provider requests.
- Provider partial failure: valid results from one provider are retained when the other fails.
- Adaptive search expansion (4 → 10 → 20), bounded concurrency, source normalization, URL canonicalization, ranking and deduplication.
- Tavily Extract of eligible public pages, using server-side bearer authentication.
- Removal of Nova and the obsolete `/veo` command from active UI/backend code.
- Model/provider identity handling and preservation of factual references to Groq and `openai/gpt-oss-120b`.
- Agent Trace and mascot updates driven by backend status events.
- Frontend syntax, PWA assets, API-key isolation and existing user-interface authorization controls.

## What these results do not prove

- The tests mock Serper and Tavily responses. No live provider API calls were made because no production credentials were supplied in this environment.
- No live Groq inference, production Render health check, GitHub Pages deployment, or browser end-to-end session was performed.
- The routing evaluation measures route/tool selection against the included 100-case fixture. It does **not** measure end-to-end answer correctness, task completion quality, citation accuracy, hallucination rate, token cost, or real provider latency.
- Website extraction is best-effort; it does not supply login credentials, solve CAPTCHAs, bypass paywalls, or follow redirects. The current reader does not actively evaluate `robots.txt`, so operators must confirm site terms and permissions. YouTube metadata/public captions are best-effort; video-frame extraction and visual frame analysis are not implemented in this release.
- URL validation blocks common private literal hosts/IPs, but this release does not implement DNS resolution pinning; do not treat it as a hardened SSRF boundary for arbitrary untrusted URLs.

## Release state

Local automated validation passed. Configure `GROQ_KEY` and at least one search provider key in the backend environment, then perform a live smoke test before relying on this build. No deployment was performed as part of this release preparation.
