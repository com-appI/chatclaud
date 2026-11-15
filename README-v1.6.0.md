# ChatClaud 1.6.0

A conservative upgrade of the supplied ChatClaud v1.5.2 project. The project remains a native Node.js single-file backend (`server.js`) with the existing frontend, Groq provider configuration and Nova Browser integration.

## Run

- Node.js 18 or newer is declared in `package.json` (tested here on Node.js 22.16.0).
- Configure the same environment variables used by the existing deployment, using `.env.example` as a template. Keep real keys in the host's secret manager; do not put them in this ZIP.
- Run `npm start`.
- Open the existing service URL. The app serves `index.html` and the existing API routes.

## Verify

- `npm run check` — JavaScript syntax checks.
- `npm test` — regression tests.
- `npm run eval` — 100-case deterministic Intent Router evaluation; writes `evals/results/latest.json`.

See `TEST-REPORT-v1.6.0.md`, `SECURITY-NOTES-v1.6.0.md`, `CHATCLAUD_AUDIT.md`, `REPOSITORY_RESEARCH.md` and `REPOSITORY_ADAPTATIONS.md` for scope, test limits and design decisions.

## Compatibility

`POST /api/chat` keeps its JSON response and existing `text` field. Additional intent/task metadata is additive. The internal Groq stream adapter is not a new frontend streaming transport; the UI still receives the normal response contract.
