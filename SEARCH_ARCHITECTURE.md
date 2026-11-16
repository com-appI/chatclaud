# Search Architecture 4.59.1

## Runtime wiring

`server.js` requires `./lib/search` as `CCSearch`. The main chat search trigger calls `CCSearch.detectSearchIntent()` with prior user turns. `runSearchPipeline()` creates a structured trace and calls `planSearchQueries()`, which in turn invokes `CCSearch.planQueries()`.

The pipeline's result flow is:

1. RU/EN intent routing and legacy topic classification.
2. Query planning with intent-specific deterministic variants and optional bounded Groq expansion using the configured Groq model only.
3. Bounded query batches; Serper and Tavily execute in parallel for each query.
4. One ranked list per provider/query pair is passed to `CCSearch.reciprocalRankFusion()`.
5. The RRF order is blended with the existing lexical relevance, authority, freshness, and domain-diversity ranking.
6. Optional page extraction; direct page reads require safe HTTP(S) URLs and public DNS answers, and redirects are not followed.
7. `CCSearch.filterCitations()` rejects final source URLs that were not returned by the search providers. Optional `opts.claims` are checked with `verifyClaimsAgainstSources()`.
8. `CCSearch.finalizeTrace()` emits provider status, query and extraction events, result counts, and corrective-loop counts. The old array-valued `trace` remains for existing callers. The structured trace and evidence summary are included in `/api/search` responses and in normal chat responses whenever the main live-search pipeline ran.

## Modules

- `intent-router.js` — RU/EN explicit, freshness, fact-check, official-source, comparison, research, informational, arithmetic, greeting, and follow-up intent.
- `query-planner.js` — removes search-command prefixes and builds bounded intent-specific query variations.
- `fusion.js` — strict HTTP(S) canonicalization, private-address rejection, boundary-safe domain hints, and reciprocal-rank fusion.
- `evidence.js` — provider URL allow-listing and transparent lexical/phrase matching with numeric consistency checks. This is not a proof engine.
- `search-trace.js` — request-local trace IDs, provider status events, extraction events, and completion metadata.

## Safety and trust boundaries

Provider snippets, extracted pages, and provider-generated summaries are untrusted data, never instructions. Context labels distinguish extracted page text from search snippets. Only URLs present in actual provider results are allowed into the returned source list.

URL checks reject non-HTTP(S), embedded credentials, localhost/internal names, private/link-local/metadata ranges, and mapped/private IPv6 addresses. DNS A/AAAA answers are checked before page extraction; if any answer is non-public, the hostname is rejected. Direct HTTP(S) page reads use a custom Node socket lookup pinned to the selected validated public IP, while preserving the original Host header and TLS SNI. Redirects are disabled, so a response cannot redirect the server into a private address range.

## Cost and deployment

No additional paid API, key, model provider, or third-party runtime dependency was introduced. Serper and Tavily adapters and environment variable names are unchanged. Search stages remain bounded and progressive.
