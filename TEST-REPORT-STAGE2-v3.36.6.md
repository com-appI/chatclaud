# ChatClaud 3.36.6 — Stage 2 verification report

## Method

- Code-path audit of `server.js` (chat branch + API routes + bootstrap)
- Integration tests with **real disk** memory/learning state (`test/integration-agent-pipeline.test.js`)
- Adapter-boundary mocks only for Serper/Tavily/Groq (no live keys in CI)
- Full suite: `npm test` → **182/182 PASS**
- `npm run check` → PASS

## Scenario results

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Complex research uses Agent Core v2, not only old runtime | **PASS (wired)** | `wantAgentV2` + `CCAgentCoreV2.runAgentCoreV2` in chat path; triggers: `/agent`, `/research`, `/deep`, «исследуй», compare, audit, long analytical queries. Live Groq path not exercised without keys. |
| 2 | Agent reads memory-store prior facts | **PASS** | Integration test seeds Groq/ChatClaud fact; `memory_search` step + `memoryHits` contain it |
| 3 | Insufficient info → search adapters called | **PASS** | `searchCalls >= 1`, `web_search` step `done` |
| 4 | Pages opened via page-reader, not snippets only | **PASS** | `readPage` invoked; observations `type=page` with body text; HTML scripts stripped |
| 5 | Verify stage runs | **PASS** | `verify` step present; `verification[]` array produced |
| 6 | Real used URLs returned as sources | **PASS** | `sources[].url` https URLs from search/read path |
| 7 | New knowledge written and available next query | **PASS** | `memoryUpsert` on read; file `memory-v2.json` on disk; reload `MemoryStore` finds facts |
| 8 | Learning tick collects & stores | **PASS** | `start` → `tick` → `collected >= 1` |
| 9 | start / stop / status / restart | **PASS** | stop blocks ticks; restart works; state file updated |
| 10 | Memory + learning survive process restart | **PASS** | New `MemoryStore` / `LearningPipeline` load same files |
| 11 | Errors: empty search, failed pages, LLM down | **PASS** | Degraded answer still returned; unsafe URLs rejected |
| 12 | Old chat fallback still present | **PASS** | `runSearchPipeline` / `forceSearch` path remains in `server.js` |

## Explicit limits (not claimed PASS)

- Live Serper/Tavily/Groq HTTP calls were **not** made in this environment (no production keys).
- Browser-level E2E against GitHub Pages + Render was **not** run.
- Calling `/api/agent/v2` from a real browser session was verified by **source wiring + API route presence**, not live HTTP against Render.

## Fixes applied in stage 2

- Broadened `wantAgentV2` chat triggers for research language
- Explicit **UNTRUSTED** web evidence clause in agent system prompt
- Integration test suite for disk persistence and stage chain
- UI blocks re-merged: Sources book, SFG panel shell, orb emotion CSS

## Deploy note

Render must include the `lib/` directory alongside `server.js`.
