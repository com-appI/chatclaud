# SEARCH BASELINE (pre-4.59)

Observed in 4.58.x server.js:
- Hybrid Serper+Tavily via searchProvidersQuery + Promise.allSettled
- runSearchPipeline with multi-hop, fetch, scoring already present
- Intent heuristics in agent planner (найди/search terms)
- Gaps addressed in 4.59: dedicated intent router, query planner, RRF fusion module, citation filter, search trace structure, follow-up intent
