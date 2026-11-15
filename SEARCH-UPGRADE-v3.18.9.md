# Search design — ChatClaud 3.18.9

1. The server accepts the search intent and builds at most 20 focused query variants.
2. It runs Serper and Tavily concurrently per query, but only for providers whose backend credentials are configured. A maximum of six query groups run simultaneously.
3. Query batches are adaptive: 4 first, 6 more if results remain weak (10 total), then 10 more (20 total). When both providers are active, the ceiling is 40 search API requests plus up to three Tavily Extract requests for leading pages; the pipeline stops early when evidence is strong enough.
4. Provider result schemas are normalized into a common source format. Canonical URLs remove tracking parameters; near-duplicate content fingerprints collapse repeated pages; ranking combines lexical relevance, authority, freshness and Tavily relevance score.
5. Up to three leading pages are extracted using Tavily Extract. When Tavily is not configured or extraction fails, a bounded HTTP reader may try the public page without following redirects. The reader does not supply login credentials, solve CAPTCHAs, bypass paywalls, or follow redirects. It does not actively evaluate `robots.txt`; the operator must confirm site terms and permissions.
6. Returned sources and read text are evidence only, not executable instructions. The model must not invent links or claim an inaccessible page was read.
7. YouTube metadata and publicly accessible captions are best-effort only. Video-frame extraction and visual frame analysis are not part of this release.

The `request` injection seam in `runSearchPipeline` remains available for deterministic unit tests; production requests use direct provider adapters and never call Nova.
