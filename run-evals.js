'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { intel } = require('../server.js');

const fixturePath = path.join(__dirname, '..', 'evals', 'core-cases.json');
const resultDir = path.join(__dirname, '..', 'evals', 'results');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const results = [];
let totalLatencyMs = 0;
let routePass = 0;
let toolPass = 0;

for (const testCase of fixture.cases) {
  const started = performance.now();
  const actual = intel.classifyIntent(testCase.input, { hasContext: !!testCase.contextAvailable });
  const latencyMs = performance.now() - started;
  totalLatencyMs += latencyMs;
  const routeOk = actual.intent === testCase.expected.intent && actual.complexity === testCase.expected.complexity;
  const toolsOk = actual.requiresTools === testCase.expected.requiresTools;
  if (routeOk) routePass += 1;
  if (toolsOk) toolPass += 1;
  results.push({
    id: testCase.id,
    category: testCase.category,
    passed: routeOk && toolsOk,
    routeOk,
    toolsOk,
    actual: { intent: actual.intent, complexity: actual.complexity, requiresTools: actual.requiresTools, confidence: actual.confidence },
    expected: testCase.expected,
    latencyMs: Number(latencyMs.toFixed(4)),
  });
}

const metrics = {
  version: '1.6.0',
  evaluatedAt: new Date().toISOString(),
  dataset: 'evals/core-cases.json',
  total: results.length,
  passed: results.filter((x) => x.passed).length,
  failed: results.filter((x) => !x.passed).length,
  routingAccuracy: results.length ? routePass / results.length : 0,
  toolDecisionAccuracy: results.length ? toolPass / results.length : 0,
  averageRouterLatencyMs: results.length ? totalLatencyMs / results.length : 0,
  categoryMetrics: {},
  notMeasured: ['end_to_end_correctness', 'task_completion_quality', 'citation_accuracy', 'hallucination_rate', 'Groq_token_cost', 'provider_latency'],
  results,
};
for (const category of Object.keys(fixture.categoryCounts || {})) {
  const rows = results.filter((x) => x.category === category);
  metrics.categoryMetrics[category] = {
    total: rows.length,
    passed: rows.filter((x) => x.passed).length,
    accuracy: rows.length ? rows.filter((x) => x.passed).length / rows.length : 0,
  };
}
fs.mkdirSync(resultDir, { recursive: true });
fs.writeFileSync(path.join(resultDir, 'latest.json'), JSON.stringify(metrics, null, 2) + '\n');
console.log(JSON.stringify({
  version: metrics.version,
  total: metrics.total,
  passed: metrics.passed,
  failed: metrics.failed,
  routingAccuracy: Number(metrics.routingAccuracy.toFixed(4)),
  toolDecisionAccuracy: Number(metrics.toolDecisionAccuracy.toFixed(4)),
  averageRouterLatencyMs: Number(metrics.averageRouterLatencyMs.toFixed(4)),
  categoryMetrics: metrics.categoryMetrics,
  notMeasured: metrics.notMeasured,
}, null, 2));
if (metrics.failed) process.exitCode = 1;
