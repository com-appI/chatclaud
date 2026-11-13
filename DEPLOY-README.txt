ChatClaud v1.2.0 — Groq-only deployment notes

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
- TAVILY_KEY and/or SERPER_KEY = search provider credentials
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
- Frontend API default: https://chatclaud.onrender.com
- Override the backend URL using the CC_API_BASE local-storage setting if the Render service has another hostname.

Validation
- npm run check
- npm test
- Backend health endpoint: /api/health

See REPAIR-NOTES.md for details. This archive has not been deployed to any production account.
