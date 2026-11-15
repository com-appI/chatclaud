# ChatClaud 3.18.9 — Deployment

## Render backend
- Root directory: the folder containing `package.json` and `server.js`.
- Build command: `npm install` (no new runtime dependency required).
- Start command: `npm start`.
- Runtime: Node.js 18+.

Set these variables in Render → Environment:
- `GROQ_KEY` — existing Groq credential.
- `GROQ_MODEL` — keep `openai/gpt-oss-120b` unless deliberately changed.
- `SERPER_KEY` — Serper search credential.
- `TAVILY_KEY` — Tavily Search/Extract credential.

A deep search can expand to 20 query variants. With both providers configured, this can mean up to 40 search API requests plus up to three page-extraction requests. It stops earlier when enough evidence is found; concurrent search groups are capped at six (up to 12 provider calls at once). Check provider quotas and billing before enabling this for high-volume use.

Configure both Serper and Tavily to enable parallel provider retrieval. Either one can run independently. Do not set `NOVA_URL`, `NOVA_API_TOKEN` or `FIRECRAWL_API_KEY` for this release; they are no longer used.

## GitHub Pages frontend
Publish the contents of this directory as the site root, including `index.html`, `sw.js`, `manifest.json`, icons and the Google verification file. The PWA cache is `chatclaud-static-v21`.

## Validation
Run `npm run check`, `npm test`, and `npm run eval`. Then verify `/api/health` reports `hasWebSearch: true`, and `hasSerper` / `hasTavily` reflect the configured variables. Test `/api/search` with a neutral public query.

YouTube metadata and public captions are best-effort; visual frame analysis is not included. The automated tests use mocks and do not validate live account credentials.

This archive is a local build only. No GitHub commit or Render deploy was performed.
