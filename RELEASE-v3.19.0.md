# ChatClaud 3.19.0 — Release notes

## What changed

### Search
- Expanded automatic search triggers so common real-world queries (“Что нового произошло сегодня?”, “Найди информацию о Pinterest”, “Проверь, правда ли это”, “Search videos about AI”) start the hybrid Serper/Tavily pipeline without an explicit `/search`.
- Video intent detection improved for both Russian and English phrasings.
- Existing ranking, deduplication, Tavily Extract fallback and source normalisation are unchanged.

### UI / Themes
- Removed **Light** from the Theme selector and from the chat-background picker.
- Added **Aurora** theme + chat background with a cohesive dark palette (teal / violet / deep blue gradients).
- Natural-language commands such as “Поменяй аватарку на Waves”, “change theme to aurora”, “поставь тему Aurora” now map correctly.
- Light selections are redirected to the classic dark look so System preference cannot resurrect Light.

### Mascot & animations
- White orb receives clearer, more expressive eyes and a smooth ponder animation.
- Status text uses a white shimmer stripe; progress bar is a soft white stripe.
- Agent Trace title is intentionally quiet/transparent.

### Versioning
- `package.json` → 3.19.0
- UI and documentation strings updated to 3.19.0

## Environment (unchanged)

Required on Render:
- `GROQ_KEY`
- `GROQ_MODEL=openai/gpt-oss-120b`
- At least one of `SERPER_KEY` / `TAVILY_KEY` (both recommended)

Aliases still accepted: `SERPER_API_KEY`, `TAVILY_API_KEY`.

Optional: `RUNWAYML_API_SECRET`, `ADMIN_SECRET`, `PLUS_BOT_SECRET`.

Keys must never appear in `index.html`, client JS, logs or chat messages.

## Testing scope

Unit / smoke tests use mocks. They do not exercise live Serper, Tavily or Groq accounts. See `TEST-REPORT-v3.19.0.md`.
