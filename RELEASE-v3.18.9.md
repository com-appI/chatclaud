# ChatClaud 3.18.9 — Release notes

## Search architecture
- Removed the Nova Browser dependency from the backend search, URL reading, video search, agent tools and frontend command paths.
- `/search` and `/find` use the backend hybrid search pipeline. Serper and Tavily are queried in parallel whenever their server-side keys are configured.
- Query retrieval expands adaptively in stages: 4 queries first, then up to 10, then up to 20 only while the evidence remains weak. At most six query groups run concurrently; Serper and Tavily run in parallel inside each group (up to 12 concurrent search requests).
- With both providers enabled, a fully expanded search can issue up to 40 search API requests, plus up to three Tavily Extract requests for source pages. Expansion stops early when the evidence threshold is met; provider usage and account charges depend on the configured plans.
- Results are normalized, ranked, canonicalized and deduplicated; source/provider labels are preserved.
- Tavily Extract is used to read public page content when configured. A bounded local reader is retained as a fallback, and redirects are not followed. YouTube public metadata/subtitles remain a separate best-effort path; visual analysis of video frames is not implemented in this release.
- The browser no longer calls search providers directly and contains no provider keys.

## Product identity and UI
- Added a separate supplemental ChatClaud persona layer after the existing base prompt; the configured Groq provider/model and request path are unchanged.
- The persona layer avoids false claims that the application developer trained the underlying model, and allows truthful disclosure of model/provider details when asked.
- Removed `/nova` and `/veo` from command routing and slash suggestions. `/search`, `/find`, `/img`, `/gif`, `/plus`, `/settings` remain.
- Updated app version and PWA cache. Agent Trace and the mascot tool icon now follow actual backend status events (rather than an independent fake progress timer).

## Repository/license decisions
- Tavily JS SDK source (MIT) was reviewed for the API contract; this release uses Node's native `fetch` rather than adding a runtime dependency.
- SearchSuite is MIT but requires Node.js 24+ and is ESM-only; the app targets Node.js 18+ and CommonJS, so it was not added as a runtime dependency. Provider normalization/fusion remains native to ChatClaud.
- Firecrawl and SearXNG source trees are AGPL-3.0 and were not copied, bundled or imported. Their archives are not included in this release ZIP.

## Required Render environment
- `GROQ_KEY`
- `GROQ_MODEL=openai/gpt-oss-120b`
- At least one of `SERPER_KEY` and `TAVILY_KEY` (both recommended)

Accepted aliases: `SERPER_API_KEY`, `TAVILY_API_KEY`.
Optional existing feature vars: `RUNWAYML_API_SECRET`, `ADMIN_SECRET`, `PLUS_BOT_SECRET`.

## Important
This archive has not been deployed to GitHub Pages or Render. Set provider keys only in Render Environment. Do not paste keys into `index.html`, commits, logs or chat. Automated tests use mocked provider responses; live Serper/Tavily/Groq requests were not run because production credentials were not supplied. See `TEST-REPORT-v3.18.9.md` for scope and limitations.
