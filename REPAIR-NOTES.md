# ChatClaud — repair and provider notes (v1.2.0)

This is an edited working copy of the project archive. It has not been deployed to or changed on any production hosting account.

## Existing repairs

- Added the app's PWA icons, avatar, and Google verification page to the server's explicit public-static allowlist. Private files such as `server.js`, `package.json`, and `data/` remain blocked.
- Replaced the previous service-worker stub with scoped offline caching for the app shell and static assets. API requests are not cached.
- Changed service-worker registration and root-absolute brand image references to project-relative paths, making GitHub Pages project paths work more reliably.
- Added automated tests and an inline-script syntax checker.

## Provider changes

- Removed active Mistral and Hugging Face API integrations.
- Routed browser-side AI requests through the server so provider credentials stay out of public HTML.
- Set Groq's default chat model to `openai/gpt-oss-120b` and replaced retired Groq Compound model IDs.
- Added Groq vision via `qwen/qwen3.8-27b`.
- Added Groq speech transcription via `whisper-large-v3`.
- Moved image/video prompt enhancement to Groq. Actual image/video rendering still requires `RUNWAYML_API_SECRET`; Groq is a text/vision/speech API, not an image renderer.
- Kept Nova integration in the server using `NOVA_URL` and `NOVA_API_TOKEN`. The existing Nova hostname is a project default and must be verified against the user's deployed Nova service.
- Replaced the old two-provider fact-verification routine with a single-Groq quote-check, so the app no longer implies that two independent providers agreed.

## Verify locally

Requires Node.js 18 or newer:

```bash
npm run check
npm test
npm start
```

## Render backend

- Create a Node web service from the repository.
- Set the service root directory to the folder containing `package.json` and `server.js` (`chatclaud-main` if the repository contains that folder).
- Build command: `npm install`
- Start command: `npm start`
- Required: `GROQ_KEY`, `GROQ_MODEL=openai/gpt-oss-120b`.
- For Nova: `NOVA_URL` and `NOVA_API_TOKEN`.
- Optional search: `TAVILY_KEY`, `SERPER_KEY`.
- Optional image/video generation: `RUNWAYML_API_SECRET`.
- Optional admin controls: `ADMIN_SECRET`, `PLUS_BOT_SECRET`.

Never add real API keys to `.env.example`, `index.html`, `server.js`, Git, or the ZIP archive. Add real values only in Render Environment.

## GitHub Pages frontend

Publish the contents of `chatclaud-main` as the Pages site root, not the ZIP file itself. Keep all static assets together. The frontend defaults to `https://chatclaud.onrender.com` for its API; update `CC_API_BASE` if your actual Render hostname differs.

The archive is a deployment-ready code package, not a completed live deployment. You still need to configure the external service credentials and redeploy it.
