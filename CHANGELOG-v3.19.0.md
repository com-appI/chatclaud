# ChatClaud 3.19.0 — Changelog

## Highlights

- **Automatic web search** — the assistant now decides when live internet data is needed (news, current events, fact-checks, product lookups, “what’s new today”, etc.) without requiring the user to type `/search` every time.
- **Serper + Tavily** hybrid pipeline remains the backbone; both providers are used in parallel when configured, with graceful fallback.
- **Sources book** — search results continue to surface real sources; empty or fabricated source lists are avoided.
- **Video search** — improved detection for both Russian and English (“найди видео…”, “search videos about…”) and clearer result formatting.
- **Natural-language theme / background commands** — “Поменяй аватарку на Waves”, “change theme to aurora”, etc. now work reliably.
- **Light theme removed** from the selector; **Aurora** theme and chat background added with a coherent dark aurora palette.
- **Mascot (white orb)** — more expressive eyes, smooth ponder animation, no extra decorative frames, status-dependent behaviour retained.
- **Status labels** — English shimmer labels (Thinking, Reasoning, Searching, Reading source code, Working with files, Using connected apps, Preparing results, …) with a soft white progress stripe.
- **Agent Trace** title made quieter so it does not dominate the UI.
- Tests and scripts paths verified; version bumped everywhere.

## Breaking / intentional removals

- Theme option **Light** removed from the Theme dropdown and from the Chat-theme picker.
- Previous “Light” background selection is mapped to the default Dark/classic look so the UI never auto-switches to a light palette via System settings.

## Provider / architecture notes

- Primary model remains **Groq** `openai/gpt-oss-120b`.
- Search keys stay server-side only (`SERPER_KEY` / `SERPER_API_KEY`, `TAVILY_KEY` / `TAVILY_API_KEY`).
- Nova Browser is not required.
- No production deployment is performed by this release archive.

## Files touched

- `server.js` — broader auto-search intent, improved video-query detection.
- `index.html` — theme selector, Aurora palette, applyBg/applyTheme, natural-language UI commands, mascot & status animations.
- `package.json`, `README.md`, release notes, this changelog.
