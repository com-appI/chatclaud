# Deploy ChatClaud v1.5.2

## Backend (Render)

1. Upload / replace service files from this release (at least `server.js`, `package.json`).
2. Env vars (minimum):
   - `GROQ_API_KEY` (or your existing multi-key setup)
   - `NOVA_URL` + `NOVA_API_TOKEN`
   - optional: `FIRECRAWL_API_KEY`, `INTEL_ORCHESTRATOR=1`
3. Start command: `node server.js` (or `npm start`)
4. Health: `GET /api/health`
5. Smoke:
   - normal chat POST `/api/chat` with a short message
   - research: mode `research` or long analytical prompt
   - `/api/search` if exposed for debugging

## Frontend (GitHub Pages)

- No required frontend change for 1.5.2.
- Keep API base URL pointing at the Render backend.
- If you use a custom domain, CORS/origin settings stay as before.

## Rollback

- Keep previous `server.js` (1.5.1) artifact.
- Redeploy previous zip if needed; no DB migration in this release.

## What not to do

- Do not commit real API keys.
- Do not enable unlisted tools / code execution.
- Do not replace Nova with an untested metasearch stack in production without staging.
