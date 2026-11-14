ChatClaud v1.4.0 — Groq + adaptive search deployment notes

Backend (Render)
- Root directory: folder containing package.json and server.js (chatclaud-main in this archive when kept inside a parent repository).
- Build command: npm install
- Start command: npm start
- Runtime: Node.js 18+
- Keep provider secrets in Render → Environment only. Never commit real values.

Required Render Environment
- GROQ_KEY = your Groq API key (server-side only)
- GROQ_MODEL = openai/gpt-oss-120b

Nova Browser integration
- NOVA_URL = https://nova-brawser.onrender.com (the project's pre-existing default; change if your Nova service has a different URL)
- NOVA_API_TOKEN = the token configured on your Nova service

Optional Environment
- SERPER_KEY = optional fallback for video search on the ChatClaud backend.
- FIRECRAWL_API_KEY = optional second web-search index; only enable after reviewing its pricing/usage. Without it, ChatClaud uses Nova as before.
- TAVILY_KEY = only needed if your configured Nova integration or another enabled backend feature explicitly uses it.
- RUNWAYML_API_SECRET = image/video generation (Groq enhances prompts but does not render images/video)
- ADMIN_SECRET = long random admin secret
- PLUS_BOT_SECRET = optional separate Plus-control secret
- NODE_ENV = production

Provider architecture
- Chat/reasoning: Groq, default openai/gpt-oss-120b.
- Image understanding: Groq qwen/qwen3.8-27b.
- Speech transcription: Groq whisper-large-v3.
- Hugging Face and Mistral API calls have been removed from active code paths.
- GPT-6/Astra is not a model ID exposed by Groq. Do not put GPT-6 or Astra in GROQ_MODEL.

Frontend (GitHub Pages)
- Publish the contents of chatclaud-main as the site root.
- Keep index.html, manifest.json, sw.js, icon PNGs, and the Google verification file together.
- Frontend API default: https://servierte.onrender.com
- Override the backend URL using the CC_API_BASE local-storage setting if the Render service has another hostname.

Validation
- npm run check
- npm test
- Backend health endpoint: /api/health

See REPAIR-NOTES.md for details. This archive has not been deployed to any production account.


Cognitive agent and search upgrade (v1.4.0)
- The backend now routes explicit agent/research/deep-research/reasoning requests and selected complex tasks through a bounded cognitive agent loop.
- It uses the existing Groq and Nova configuration; no new Render environment variables or npm packages are required.
- Read-only agent tools: search, fetch_url, kb_search, verify_claims, calculator. No shell or arbitrary code execution is exposed.
- Agent execution uses additional Groq calls on complex tasks and may take longer than a normal chat response. Simple chat remains on the previous single-call path.
- Backend changes require a Render deploy. index.html and GitHub Pages do not need to be changed for this upgrade.

Search upgrade (v1.4.0)
- Nova search now supports Groq-assisted query expansion, parallel search queries, URL normalization, de-duplication, relevance ranking, domain diversity, and fetching the best safe result pages.
- Optional Firecrawl search runs alongside Nova only when FIRECRAWL_API_KEY is present in the ChatClaud Render environment. The key must stay server-side. Provider usage may be billable.
- No new required environment variables or npm packages.
- Only backend changes require a Render deploy; the GitHub Pages frontend does not need to change.
