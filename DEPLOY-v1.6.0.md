# Deploy ChatClaud 1.6.0

## Backend

1. Deploy the contents of this archive to the existing Node.js service.
2. Keep the existing environment variables and secrets in the host's secret manager. Do not add real keys to `.env` or the ZIP.
3. Keep the existing start command: `npm start` (or `node server.js`).
4. Keep the current Groq model setting and Nova endpoint/token.
5. Verify `GET /api/health`, then send a normal message and a research-style message through the app.

## Frontend

The browser UI is served from `index.html`. If the deployment uses a separate static host, publish the updated `index.html` and existing static assets together. Preserve the current API base URL and CORS configuration.

## Rollback

Keep the previous 1.5.2 archive. Roll back both the backend and frontend files together if a staged smoke test fails. No database migration is introduced by this release.
