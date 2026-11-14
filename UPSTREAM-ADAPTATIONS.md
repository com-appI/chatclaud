# Upstream project review — ChatClaud v1.4.0

This file records the upstream projects that informed the current architecture and why full dependencies were or were not installed.

| Project | License / runtime note | Used in ChatClaud |
|---|---|---|
| LangGraph | MIT | State transitions and bounded graph orchestration patterns; native JS implementation retained |
| smolagents | Apache-2.0 | Action/observation loop, tool allowlist, compact tool trajectory |
| DeerFlow | MIT | Task decomposition, evidence aggregation, reviewer workflow |
| Deep Agents JS | MIT | Planning, role-scoped delegation, isolated worker evidence, context discipline; patterns adapted without installing its LangChain/LangGraph runtime |
| MCP TypeScript SDK | Apache-2.0; current v2 packages require Node.js >=20 | Reviewed as the future standard tool-connector layer; not installed in this release because the current package supports Node.js >=18 and no external MCP servers have been configured |
| Promptfoo | MIT | Evaluation and red-team principles inform deterministic regression tests; Promptfoo itself is not needed as a production dependency |
| Firecrawl | See upstream repository license | Optional second search index; adapter activates only when `FIRECRAWL_API_KEY` exists in the backend environment. No key is bundled or sent to the browser; provider usage may be billable |
| SearXNG | AGPL-3.0 | Reviewed as an optional self-hosted metasearch fallback; not activated because it needs a dependable configured instance |

No upstream repository source files are vendored in the ChatClaud archive. Links point to the projects for audit and follow-up review.
