## v1.5.0 (see AGENT-UPGRADE-v1.5.0.md and RELEASE-v1.5.0.txt)

# ChatClaud Cognitive Upgrade — v1.4.0

This release extends the existing native Node.js cognitive agent. It keeps the existing Groq-only model path, Nova Browser search service, GitHub Pages frontend, and Render backend. No new npm dependency or environment variable is required.

## Cognitive agent changes

- **Adaptive bounded orchestration:** the model still controls the next step from real observations, with a maximum of 8 action steps and 5 agent tool calls per task.
- **Delegated research workers:** a new `delegate_research` tool lets the controller split a complex research request into 2–3 distinct roles/queries. Workers run independent, read-only Nova searches and return isolated evidence packages that are merged for the controller.
- **Multi-query tool use:** `search` accepts up to 3 focused queries in one action and merges their evidence.
- **Evidence-first workflow:** fetched page text, published dates, source URLs, and execution receipts are passed to synthesis and review. Retrieved page contents remain untrusted data.
- **Safer page fetching:** agent URL fetching does not follow redirects, reducing the risk of a public URL redirecting a server-side request into a private network.
- **Budget control:** all tools remain allowlisted; delegated work has explicit worker limits and a bounded timeout. No shell, arbitrary code execution, account actions, or deployment actions are exposed.

## Upstream patterns studied

- [LangGraph](https://github.com/langchain-ai/langgraph): explicit state transitions, bounded graph execution, and traceable steps.
- [smolagents](https://github.com/huggingface/smolagents): action/observation loops and compact execution trajectories.
- [DeerFlow](https://github.com/bytedance/deer-flow): task decomposition, research workflow, evidence aggregation, and reviewer pass.
- [Deep Agents JS](https://github.com/langchain-ai/deepagentsjs): planning, scoped subtask delegation, isolated worker context, and context management.

Only architecture patterns are adapted; upstream source files are not copied into ChatClaud. The full `deepagents` package is not installed because it pulls in the LangChain/LangGraph runtime stack and ChatClaud can use the relevant bounded orchestration patterns without introducing that dependency weight.

## Limits and honest claims

- Research workers currently perform role-scoped retrieval and evidence packaging; they are not separate model instances running autonomous reasoning loops.
- The Reviewer is a second pass using the same configured Groq model. It is a consistency check, not independent fact verification.
- Persistent cross-chat memory, filesystem workspaces, and full MCP client/server connectivity are not introduced in this release.
- More search calls and agent steps can increase response latency and Groq/Nova usage. Defaults are bounded; normal short chat continues to use the ordinary chat path.

## Validation

Run:

```bash
npm run check
npm test
```
