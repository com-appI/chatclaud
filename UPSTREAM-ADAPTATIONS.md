# Upstream project review — ChatClaud 1.6.0

This record describes which upstream architectural ideas were adapted in ChatClaud 1.6.0 and which packages remain deliberately out of the production dependency tree.

| Project | License / runtime note from reviewed source snapshot | ChatClaud 1.6.0 decision |
|---|---|---|
| LangGraph | MIT | Adapted explicit state transitions and bounded orchestration patterns in native JavaScript; no second graph runtime installed. |
| smolagents | Apache-2.0 | Adapted the action/observation loop and tool allowlist principles; no upstream code vendored. |
| DeerFlow | MIT | Used as a reference for decomposition, evidence aggregation, and reviewer workflow; no package installed. |
| Deep Agents JS | MIT | Adapted bounded planning/task records and context discipline; did not install its LangChain/LangGraph runtime stack. |
| MCP TypeScript SDK | Apache-2.0; the reviewed v2 packages require Node.js >=20 | Deferred until a concrete external MCP connector and its permission model are specified. ChatClaud retains its Node.js >=18 baseline. |
| Promptfoo | MIT | Evaluation/red-team methodology informed deterministic regression fixtures. Promptfoo itself is not installed; the local eval runner is native Node.js. |
| Firecrawl | See upstream repository license | Optional server-side search adapter remains gated by `FIRECRAWL_API_KEY`; no key is bundled or exposed to the browser. Usage may be billable. |
| SearXNG | AGPL-3.0 | Reviewed as a self-hosted metasearch option; not enabled because no maintained SearXNG instance is configured. |
| Mem0 | Apache-2.0 root npm package in reviewed snapshot; OSS package manifest had a separate license declaration | Deferred until user identity, consent, isolation, retention, deletion, embedding, and vector-storage decisions are explicit. |
| Vercel AI SDK | Apache-2.0; reviewed package requires Node.js >=22 | Provider/streaming API patterns reviewed only. No adapter added because compatibility with this project's current streaming, multimodal, and fallback behavior has not been proven by a dedicated POC. |
| Langfuse JS | MIT; reviewed tracing package requires Node.js >=22 | Deferred until redaction and retention policy is approved; do not transmit user prompts or outputs to an external tracing service by default. |
| Mastra | Apache-2.0 outside `ee/`; `ee/` has a separate license; reviewed packages require Node.js >=22.13 | Used as a reference for memory boundaries, processors, and eval hooks; not installed because it would substantially replace the current runtime and increase dependency/runtime requirements. |

## Patterns implemented in 1.6.0

- Explicit intent routing and bounded task lifecycle remain in the existing single-file runtime.
- Task records expose concise, user-safe goal/step/status information rather than hidden reasoning.
- Tool execution remains permission-gated and bounded by existing call/time budgets.
- The interface controller exposes only a small allowlist of visible UI actions. Assistant-originated actions require a matching explicit user request; it does not execute arbitrary JavaScript or access cookies, credentials, account controls, or device hardware.
- Agent Trace shows request lifecycle, intent, reported plan/steps, tool receipts, review state, and elapsed time where the backend supplies them. It does not claim to reveal private chain-of-thought.
- A native deterministic evaluation harness runs curated routing/tool-decision cases. Its metrics are not end-to-end answer-quality or hallucination measurements.

## Why no additional framework was installed

The reviewed repository set contains several broad orchestrators and tracing/memory systems. Combining Deep Agents, LangGraph, and Mastra would duplicate the current agent lifecycle and create competing state owners. Mem0 and Langfuse need explicit data governance choices. MCP needs a concrete connector use case and threat model. Promptfoo's current documented Node requirement in the audit was above the local Node 22.16 runtime, so it is not a production dependency and is left for a separate compatible CI runner decision.

No upstream source files are vendored in this archive. The companion `REPOSITORY-RESEARCH.md` documents the review scope, package/runtime observations, and limitations. The audited upstream archives were inspected selectively; their full test suites were not installed or executed.
