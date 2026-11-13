ChatClaud v1.1.1 — deployment notes

Backend (Render)
- Root directory: folder containing package.json and server.js (chatclaud-main in this archive when kept inside a parent repository).
- Build command: npm install
- Start command: npm start
- Runtime: Node.js 18+
- Set provider/API secrets in Render → Environment. Do not commit secrets.

Frontend (GitHub Pages)
- Publish the contents of chatclaud-main as the site root.
- Keep index.html, manifest.json, sw.js, icon PNGs, and the Google verification file together.
- Frontend API default: https://chatclaud.onrender.com
- Override from the browser using the CC_API_BASE local-storage setting if a different backend is used.

Validation
- npm run check
- npm test
- Backend health endpoint: /api/health

See REPAIR-NOTES.md for details of the local fixes. This archive has not been deployed to any production account.
