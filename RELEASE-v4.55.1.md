# ChatClaud 4.55.1 — Memory repair

## Critical fixes
1. Memory context injected into Groq `providerMessages` (`_memBlock` / `__ccMemoryContext`)
2. `groqChat` accepts `memoryContext` option for Agent/CHAL paths
3. `ingestAssistantMessage` after successful chat result
4. Memory user id from HttpOnly `cc_mem_sid` cookie / IP+UA hash — **client body.userId ignored**
5. Hybrid retrieval: synonym expansion + BM25-lite (RU/EN paraphrase)
6. Per-user write queue (AsyncLock)

## Still limited
- No full OAuth — session is cookie/IP-bound, not account login
- No vector embeddings
- Live Groq end-to-end not tested in CI without keys
