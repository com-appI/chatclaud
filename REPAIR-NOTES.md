# ChatClaud — repair notes (v1.1.1)

This is a repaired working copy of the uploaded project archive. It has not been deployed to or changed on any production hosting account.

## Repairs

- Added the app's PWA icons, avatar, and Google verification page to the server's explicit public-static allowlist. Private files such as `server.js`, `package.json`, and `data/` remain blocked.
- Replaced the previous service-worker stub with scoped offline caching for the app shell and static assets. API requests are not cached.
- Changed service-worker registration and the remaining root-absolute brand image references to project-relative paths, making GitHub Pages project paths work more reliably.
- Added real Node.js tests and an inline-script syntax checker. The test suite now verifies static asset access, private-file blocking, app HTML structure, selected intelligence helpers, and a live HTTP smoke test.

## Verify locally

Requires Node.js 18 or newer:

```bash
npm run check
npm test
npm start
```

The smoke test starts a temporary local server and removes its temporary data directory when it finishes.

## Deployment outline

### Render backend

- Create a Node web service from the repository.
- Set the service root directory to the folder containing `package.json` and `server.js` (for this archive, `chatclaud-main` if the repository contains that folder).
- Build command: `npm install`
- Start command: `npm start`
- Add provider credentials only in the Render service's Environment settings. Do not put keys into `index.html`, `server.js`, Git, or this archive.

The server reads `PORT` from the hosting platform. The project uses Node.js 18+.

### GitHub Pages frontend

- Publish the contents of `chatclaud-main` as the Pages site root (rather than publishing the zip file itself).
- Keep `index.html`, `manifest.json`, `sw.js`, the PNG assets, and the Google verification file together at the published root.
- The frontend defaults to `https://chatclaud.onrender.com` for its API. The browser's `CC_API_BASE` local-storage setting can override that backend URL when necessary.

After deployment, verify `/api/health` on the backend and open the Pages site in a fresh browser tab. A service worker can keep older static files cached until it activates; reload once after the first deployment.
