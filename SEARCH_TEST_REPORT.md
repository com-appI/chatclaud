# Search Test Report 4.59.1

## Automated checks

- Full test suite: **811 passed, 0 failed, 0 skipped**.
- `npm run check`: **passed**.
- Inline JavaScript syntax check: **25 scripts checked**.
- New pipeline integration suite: **9 passed**.

## What pipeline tests prove

- The primary `runSearchPipeline()` invokes RRF through the ranking helper.
- Serper and Tavily response lists are fused and duplicate canonical URLs collapse to one source.
- Provider status and citation-validation events are recorded in the returned structured trace.
- Command prefixes are removed before provider queries.
- Unsafe URL forms, private IPv4/IPv6 ranges, and mapped IPv6 addresses are rejected; mixed public/private DNS answers fail closed and direct requests pin the checked IP at the socket.
- Domain trust does not match attacker-controlled domains that merely contain a trusted brand string.
- Evidence matching rejects mismatched numeric claims and labels positive matches as textual evidence rather than fact proof.

## Test boundary

Provider calls are mocked; no live Serper/Tavily requests or production credentials were used. No Render deployment, GitHub Pages deployment, real-world quota check, or browser visual test was performed. The direct page fetch path pins the validated DNS address and does not follow redirects. Remote extraction vendors may resolve submitted public URLs on their own infrastructure; their independent network isolation is outside this backend's control.
