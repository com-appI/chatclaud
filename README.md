# ChatClaud 3.19.0

ChatClaud is a Node.js web application with a Groq-backed chat model, a bounded tool-using agent, a source-aware web-search pipeline, and a static browser interface.

## What's changed in 3.19.0

- Removed the Nova Browser integration and the obsolete `/nova` and `/veo` commands.
- Added direct, server-side Serper + Tavily search. Configured providers run in parallel for each query; query expansion is staged (4 → 10 → 20) only when earlier results remain weak.
- Bounded search query concurrency to six query groups at a time. Each group can call Serper and Tavily concurrently.
- Normalized, ranked and de-duplicated results, and added Tavily Extract for public page reading.
- Kept the existing Groq chat provider and default model ID (`openai/gpt-oss-120b`). Added a separate app persona layer without replacing the base model prompt.
- Retained the existing frontend and Agent Trace rather than replacing the interface wholesale. The mascot tool indicator and Agent Trace now respond to backend status events.

## Requirements

- Node.js 18 or newer
- A Groq API key for chat
- At least one of Serper or Tavily for web search; both are recommended

## Local setup

1. Copy `.env.example` to `.env` and set your own server-side values.
2. Install dependencies if any are added in your own branch. This release has no new runtime dependencies.
3. Run `npm run check`, `npm test`, and `npm run eval`.
4. Start with `npm start`.

## Environment variables

Required for chat:

- `GROQ_KEY`
- `GROQ_MODEL=openai/gpt-oss-120b` (keep the existing value unless intentionally changing models)

Web search, at least one:

- `SERPER_KEY` (alias: `SERPER_API_KEY`)
- `TAVILY_KEY` (alias: `TAVILY_API_KEY`)

Optional existing features:

- `RUNWAYML_API_SECRET`
- `ADMIN_SECRET`
- `PLUS_BOT_SECRET`

Set secrets only in the backend environment (for example, Render Environment). Never place them in `index.html`, browser JavaScript, public configuration, source control, or chat messages.

## Endpoints

- `GET /api/health` — reports whether Groq, Serper, and Tavily are configured (booleans only; no key values)
- `POST /api/search` — executes the hybrid search pipeline
- `POST /api/fetch-url` — reads an eligible public URL with bounded content and no automatic redirects
- `POST /api/chat` — ChatClaud conversation endpoint

Website reading is best-effort. It does not provide login credentials, solve CAPTCHAs, bypass paywalls, or follow redirects. The current reader does not actively evaluate `robots.txt`; operators must respect each site's terms and permissions. A page may be unavailable even when its URL is valid. YouTube metadata and public captions are also best-effort; visual analysis of video frames is not implemented.

A full search can expand to 20 query variants. With both providers enabled, this can mean up to 40 search API requests plus up to three page-extraction requests. The pipeline stops early when evidence is sufficient and caps simultaneous query groups at six. Check provider quotas and billing.

## Validation

See `RELEASE-v3.19.0.md`, `DEPLOY-v3.19.0.md`, `SEARCH-UPGRADE-v3.19.0.md`, and `UPSTREAM-AUDIT-v3.19.0.md` for change details, setup, and the upstream repository/license review.

The test/evaluation suites use controlled fixtures. They do not prove live Serper, Tavily, or Groq account credentials, live provider latency, citation quality, or end-to-end answer correctness. No production deployment is included in this ZIP.
