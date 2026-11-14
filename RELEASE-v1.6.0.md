# ChatClaud 1.6.0 — Agent Runtime & Interface Control

## Included

- Intent Router is registered in the single-file module loader and exported through `modules/intelligence`.
- Agent task records expose bounded, user-safe steps, outcomes, review status, elapsed time, and token usage when the provider reports it.
- Provider boundary keeps Groq as the only LLM provider; Nova remains the existing search path. Streaming is available internally, while `/api/chat` keeps its JSON-compatible response contract.
- Agent Trace starts and ends with the actual chat send cycle and renders intent, bounded plan/step summaries, tool receipts, review status, elapsed time, and reported token usage. It does not expose chain-of-thought or secrets.
- UI Control supports an allowlist: theme, settings, sidebar, fast/think/code mode, new chat, and scroll-to-bottom. Assistant-triggered actions require an explicit matching user request. Arbitrary JavaScript, secret access, account/billing changes, form submission, deletion, external publishing, and hardware activation are not allowed.
- `prefers-reduced-motion` remains respected.

## Compatibility

- Existing `POST /api/chat` request and response text fields remain compatible. Additional metadata fields are additive.
- Existing Groq model configuration and Nova search integration are retained.
- No production secrets, live API keys, or user data are included in this archive.

## Verification

See `TEST-REPORT-v1.6.0.md` for the results from this build: 157/157 tests passed, 20 inline scripts parsed, and the 100-case intent/tool-routing evaluation passed. Live Groq/Nova requests were not tested because no production credentials were supplied.
