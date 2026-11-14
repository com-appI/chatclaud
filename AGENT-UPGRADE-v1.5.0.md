# ChatClaud Agent Upgrade v1.5.0

## Why

v1.4.0 had a solid bounded agent loop. v1.5.0 makes research-style tasks more structured and less hallucination-prone by borrowing production patterns from open-source agent systems **without** pulling Python runtimes into Node.

## Sources of patterns

| Project | What we took |
|--------|----------------|
| open_deep_research | brief → supervisor/workers → compress notes → final report |
| smolagents | MultiStep action/observation loop, explicit final, step budget |
| GPT Researcher | subquestion decomposition, citation discipline |
| LangGraph | explicit phase transitions / state fields |
| CrewAI | role labels for workers (not the full framework) |

## New state fields

- `brief` — short research brief
- `subtasks[]` — `{ id, role, query, status }`
- `notes[]` — `{ claim, evidence, urls, confidence }`
- `gaps[]` — open questions after compress/review
- `phase` — brief | plan | gather | compress | verify | synthesize | review | done

## Controller JSON (extended)

1. Brief + first tool  
2. Tool call  
3. `set_notes` compress  
4. `final` answer  

Review may return `need_more_evidence` and list `missing_angles`.

## Safety unchanged

- Allowlisted tools only  
- No shell / arbitrary code execution  
- Page text is untrusted evidence  
- Hard max steps / tool calls / deadline  

## Files touched

- `server.js` — `modules/intelligence/agent-runtime.js` bundle + `runCognitiveAgent` controllers
- `RELEASE-v1.5.0.txt`, this doc, `package.json` version
