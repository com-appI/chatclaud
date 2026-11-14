# ChatClaud Intelligence Upgrade — v1.3.0

This upgrade adds an opt-in/intent-routed cognitive agent runtime to the existing Node.js backend. It does not replace the current Groq, Nova, ALE, GitHub Pages, or Render architecture.

## Capabilities added

- **Stateful graph-style orchestration:** explicit `plan → act → observe → decide → synthesize/review → done` transitions with a bounded step budget and a run trace.
- **Dynamic action/observation loop:** the model chooses the next allowed tool based on the task and actual results, rather than always following a fixed deterministic template.
- **Specialist second-pass reviewer:** a separate reviewer prompt checks task coverage, unsupported claims, and inconsistencies. It may revise the draft once. This is a same-model consistency review, not independent fact verification.
- **Execution receipts:** each tool call gets a receipt ID, tool name, status, and bounded result summary. The final workflow can distinguish performed work from claims about work.
- **Safe arithmetic tool:** basic arithmetic is evaluated by a small parser. JavaScript `eval`, `Function`, shell commands, and arbitrary code execution are not available.
- **Tool allowlist and budgets:** only `search`, `fetch_url`, `kb_search`, `verify_claims`, and `calculator` are allowed in agent mode. Tool calls, step count, input size, and run duration are capped.
- **Context and evidence handling:** existing Nova results can enter the agent's working state; retrieved page contents are explicitly treated as untrusted data.

## Patterns studied in the supplied repositories

- LangGraph: explicit state transitions, bounded graph execution, and traceable node progression.
- smolagents: action → observation cycles and retaining a compact execution trajectory.
- DeerFlow: task decomposition, bounded working context, specialist review, evidence/receipt-oriented reporting, and honest reporting of incomplete work.

Upstream projects reviewed: [LangGraph](https://github.com/langchain-ai/langgraph) (MIT), [smolagents](https://github.com/huggingface/smolagents) (Apache-2.0), and [DeerFlow](https://github.com/bytedance/deer-flow) (MIT). Only architectural patterns are adapted here; their source files are not copied into ChatClaud.

This implementation is a native JavaScript adaptation of those architectural patterns. The Python repositories and their full frameworks are not vendored or installed because the current ChatClaud service is a single Node.js backend and does not need their unrelated runtime dependencies.

## When it runs

The agent is activated for explicit `agent`, `research`, or `deep-research` modes, `body.agent=true`, `body.deepResearch=true`, `body.reason=true`, and selected clearly complex natural-language requests (for example, compare, analyze, investigate, or make a detailed plan). Ordinary short chat continues to use the existing one-call path to avoid unnecessary model requests.

## Safety and limitations

- Agent tools are read-only except for local arithmetic; no shell, code execution, filesystem writes, account actions, or deployment tools are exposed.
- Search and claim verification quality still depends on Nova results and the current source-verification path. A keyword-overlap check is heuristic, not proof.
- The reviewer uses the configured Groq model as a second pass; it must not be described as an independent external verifier.
- Persistent long-term user memory and parallel worker agents are not added in this stage. The run keeps its working state and receipts during a single task.
- More agent steps may require additional Groq requests and add latency. The default maximum is three tool calls.

## Validation

Run:

```bash
npm run check
npm test
```

No new npm dependency or environment variable is required. The feature runs on the existing Render backend and uses the existing `GROQ_KEY` and Nova configuration.
