# Changelog 4.59.1 — Search Integration & Reliability

## Search pipeline integration
- Wired the shared RU/EN intent router into main chat search triggering and pipeline tracing.
- Routed query planning through `CCSearch.planQueries`; removed generic filler-heavy fallback angles in favor of intent-specific query variations.
- Normalized search commands before sending them to providers.
- Added reciprocal-rank fusion across each provider/query result list, blended with the existing lexical, authority, freshness, and domain-diversity ranking.
- Preserved the legacy `trace` array and added a structured `searchTrace` with provider statuses, counts, extraction events, corrective loops, and citation validation; normal chat responses now expose the trace and evidence summary when live search ran.

## Evidence and security
- Search results are filtered against URLs actually returned by providers; malformed, unsafe, and unprovenanced URLs are excluded.
- Evidence matching checks numeric consistency and uses token/phrase coverage; results are explicitly labelled as textual matches, not proof of truth.
- Domain authority boosts now require exact domain/subdomain boundaries and have small tie-breaker weight.
- URL canonicalization fails closed for non-HTTP(S), credential-bearing, private, link-local, metadata, and mapped IPv6 destinations.
- Page fetching checks all DNS A/AAAA answers, pins the selected public IP to the HTTP(S) socket, and keeps redirects disabled.

## Tests
- Added pipeline-level integration tests for real RRF invocation, Serper/Tavily fusion, trace events, citation filtering, command cleanup, evidence checks, and URL safety.
- No new paid APIs, providers, or secrets required.
- No production deployment performed.
