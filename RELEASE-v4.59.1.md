# ChatClaud 4.59.1 — Search Integration & Reliability

This release repairs the incomplete 4.59.0 search integration using only the source tree and bundled repository adaptations inside `ChatClaud-v4.59.0.zip`.

## Main changes
- Main chat search triggering and `runSearchPipeline()` use the shared search intent router.
- `planSearchQueries()` invokes the dedicated query planner.
- `rankWithReciprocalFusion()` invokes RRF over every provider/query result list and blends it with the existing relevance scorer.
- Citation URL filtering, optional claim-text checks, and `SearchTrace` run in the pipeline rather than remaining standalone helpers.
- Search results include explicit evidence status (page text extracted vs. snippet only).
- SSRF checks reject non-public IP address ranges and resolve DNS before reading pages; redirects remain disabled.

## Validation
- `npm test`: 811 passed, 0 failed, 0 skipped.
- `npm run check`: passed; 25 inline JavaScript scripts checked.
- Live Serper/Tavily network access was not used for the test suite; provider integration was verified with deterministic mocked HTTP responses.
- No production deployment performed.

## Important limitations
- Text-overlap verification is not a formal fact verifier and cannot prove a claim true. The API labels it as a textual match only.
- The direct backend page-fetch path pins a validated public DNS address to the socket and refuses redirects. Remote extraction vendors may perform their own URL resolution outside this backend's network controls.
- Production credentials, Render networking, real provider quotas, and browser rendering were not tested in this local archive validation.

## Deploy
Upload the full ZIP to the existing backend deployment workflow. Keep the current Serper and Tavily environment variables; no new secrets or paid services are introduced. Review the report and run the staging deployment before production.
