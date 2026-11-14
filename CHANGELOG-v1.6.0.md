# ChatClaud 1.6.0 — Change log

## Core Intelligence

- Added an Intent Router with task intent, complexity class, context-awareness and tool-need hints.
- Added task records with stable task/request IDs, goal, bounded plan steps, status, completion/failure lists and timestamps.
- Added explicit permission checks and output validation to Tool Registry; tool calls have bounded counts and timeouts and receive an `AbortSignal`.
- Kept the existing graph-style bounded agent runtime; added a single self-correction path and safer handling of malformed planner/reviewer output.
- Added a ModelProvider boundary for Groq `generate`, `stream`, model information and normalized errors without replacing the configured primary model.
- Added safe request/agent logging metadata without storing prompts, API keys or auth tokens.

## Frontend

- Reworked Agent Trace to render the backend's actual task, intent, plan, steps, tool receipts, review status, elapsed time and reported token usage.
- Added a bounded interface command set: theme, settings, sidebar, fast/think/code mode, new chat and scroll-to-bottom.
- Assistant-triggered interface actions require a matching explicit user request; no arbitrary JavaScript execution or secret access is provided.
- Unified reduced-motion handling for all CSS animations/transitions, including Agent Trace.
- Replaced contradictory internet/search instructions with evidence-grounded wording.

## Evaluation and tests

- Added 100 routed-intent cases in the requested 8 categories.
- Added a deterministic evaluation runner and baseline result at `evals/results/latest.json`.
- Added interface-control, task-record, tool-permission, timeout and Agent Trace regression tests.

## Compatibility and dependencies

- Kept Groq and `openai/gpt-oss-120b` as the primary model configuration.
- Kept Nova Browser integration and existing `/api/chat` JSON compatibility; response metadata is additive.
- No runtime npm dependency was added. No upstream framework was copied wholesale.
