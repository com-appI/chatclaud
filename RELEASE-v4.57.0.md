# ChatClaud 4.57.0

## New
- lib/code-intelligence.js — import graph, symbol index, unresolved modules
- lib/research-planner.js — research plan, claim registry, source brief (no invented URLs)
- math-engine: det2, matrices, mean/variance, sinDeg/cosDeg

## Integration
- Cognitive router uses code-intelligence for project analysis
- APIs: POST /api/code/analyze, POST /api/research/plan

## Preserved
- Math/Tutor/Analyzer 4.56, Memory 4.55, CHAL, Agent, Groq, Serper/Tavily

## Limits
- No Lean prover in default path
- No heavy OCR models on Render
- Research plan does not call web by itself — uses existing search when chat/agent does
