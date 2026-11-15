ChatClaud 3.18.9 — quick deployment reference

BACKEND (Render)
- Root directory: the folder containing package.json and server.js.
- Build command: npm install
- Start command: npm start
- Runtime: Node.js 18+

Required environment:
- GROQ_KEY
- GROQ_MODEL=openai/gpt-oss-120b
- SERPER_KEY and/or TAVILY_KEY (both recommended)

Accepted aliases:
- SERPER_API_KEY
- TAVILY_API_KEY

Optional existing feature variables:
- RUNWAYML_API_SECRET
- ADMIN_SECRET
- PLUS_BOT_SECRET

Do not add Nova or Firecrawl variables. This release does not use Nova, Firecrawl, or SearXNG. Do not expose API keys in frontend files or GitHub Pages.

FRONTEND (GitHub Pages)
- Publish the contents of this directory as the site root.
- Keep index.html, sw.js, manifest.json, icons and the Google verification file together.
- PWA cache name: chatclaud-static-v21.

CHECKS
- npm run check
- npm test
- npm run eval
- Verify GET /api/health reports hasWebSearch=true after at least one search provider key is set.
- Test POST /api/search with a neutral public query.

This is a local build only. No GitHub commit or Render deploy was performed.
