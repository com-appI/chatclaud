# ChatClaud Unified Memory System 4.55.0

## Architecture (single Node service)

Inspired by Mem0, Graphiti, Letta, Awesome Agentic Memory — **ideas only**, no Python sidecars.

| Level | Purpose |
|-------|---------|
| Working | Recent turns (bounded) |
| Episodic | Events / decisions with temporal cues |
| Semantic | Stable facts & preferences |
| Procedural | How the user wants tasks done |

## Storage

- Path: `$ALE_DATA_DIR/memory/<userId>/memory.json` or `./data/memory/...`
- Per-user isolation via `userId` / `x-user-id` header
- Atomic write (tmp + rename)

## APIs

- `GET /api/memory/v2/stats`
- `POST /api/memory/v2/search` `{ query, limit?, levels? }`
- `POST /api/memory/v2/ingest` `{ text }`
- `POST /api/memory/v2/delete` `{ id }`
- `POST /api/memory/v2/correct` `{ id, text }`

## Chat integration

On each user message: `ingestUserMessage` + `buildContextBlock` → `body.__ccMemoryContext`.

## Limitations

- Fact extraction is **heuristic** (no LLM extract by default) to control Groq cost
- Not a vector DB — keyword/overlap retrieval
- Render ephemeral disk loses data without persistent disk (`ALE_DATA_DIR`)
