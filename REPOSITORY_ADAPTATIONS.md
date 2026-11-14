# Upstream repository adaptations in ChatClaud 1.6.0

This release adopts selected architectural patterns from the attached upstream snapshots. It does not bundle or vendor their code.

| Upstream | Pattern reused | ChatClaud implementation | Why no package was added |
|---|---|---|---|
| Deep Agents JS | Explicit todo planning, bounded steps, context and tool budgets | Task record, capped plan, max step/tool/deadline limits | Existing agent loop can support these ideas with less runtime complexity |
| LangGraph.js | Per-run state, explicit transitions, checkpoint-like execution history | Request-scoped task record, phase transitions, tool receipts and bounded graph loop | No durable workflow checkpoint requirement has been approved |
| Mastra | Separation of agents, tools, workflows and evaluation concerns | Intent Router, Tool Registry, ModelProvider and task orchestration boundaries | A second orchestration framework would duplicate existing modules |
| Promptfoo | Dataset-driven regression tests and measurable evaluator outputs | 100-case JSON fixture, deterministic runner and baseline JSON report | Promptfoo is kept out of the production request path; its package runtime requirements are not needed for this first release |
| Vercel AI SDK | Provider abstraction and a stream-compatible interface | Internal ModelProvider `generate()` / `stream()` interface over Groq | `/api/chat` remains JSON-compatible; swapping the frontend transport needs a separate migration |
| MCP TypeScript SDK | Tool protocol boundary and schema-first tools | Registry schemas, permission checks, timeout/cancellation handling | No current external MCP server is configured; do not expose a network tool protocol without a concrete use case |
| Mem0 | Explicit memory records and user-scope isolation as design requirements | No new long-term memory engine in 1.6.0 | Storage, consent, deletion, retention and tenant isolation need a dedicated design first |
| Langfuse JS | Trace metadata and redaction-first observability | Local structured logs with request/task IDs, phase, durations and safe status | External trace retention and PII policy are not yet approved |

## Final choice

**Adopt now:** the existing internal runtime plus bounded task state, tool registry hardening, model provider boundary, deterministic evaluation and evidence-grounded trace.

**Use ideas only:** Deep Agents, LangGraph.js, Mastra, Vercel AI SDK, Promptfoo, MCP, Mem0 and Langfuse as described above.

**Defer:** persistent user memory, external tracing, MCP connectivity, framework replacement, live streaming transport, and any new database.

The detailed repository review and source references are in `REPOSITORY_RESEARCH.md`. Local archive inspection did not include running each upstream project's full test suite.
