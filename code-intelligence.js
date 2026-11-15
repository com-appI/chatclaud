'use strict';
/**
 * Code Intelligence 2.0 — import graph, symbol index, impact hints.
 * Complements project-analyzer (no untrusted code execution).
 */
const path = require('path');
const analyzer = require('./project-analyzer');

function extractJsImports(content, fileName) {
  const text = String(content || '');
  const imports = [];
  const reRequire = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  const reImport = /import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  const reExport = /export\s+.+\s+from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = reRequire.exec(text))) imports.push({ from: fileName, to: m[1], kind: 'require' });
  while ((m = reImport.exec(text))) imports.push({ from: fileName, to: m[1], kind: 'import' });
  while ((m = reExport.exec(text))) imports.push({ from: fileName, to: m[1], kind: 'export-from' });
  return imports;
}

function extractJsSymbols(content, fileName) {
  const text = String(content || '');
  const symbols = [];
  const patterns = [
    [/function\s+([A-Za-z_$][\w$]*)\s*\(/g, 'function'],
    [/const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\()/g, 'const-fn'],
    [/class\s+([A-Za-z_$][\w$]*)/g, 'class'],
    [/exports\.([A-Za-z_$][\w$]*)/g, 'export'],
    [/module\.exports\.([A-Za-z_$][\w$]*)/g, 'export'],
  ];
  for (const [re, kind] of patterns) {
    let m;
    const r = new RegExp(re.source, re.flags);
    while ((m = r.exec(text))) {
      symbols.push({ file: fileName, name: m[1], kind });
    }
  }
  return symbols;
}

function buildImportGraph(files) {
  const graph = { nodes: [], edges: [] };
  const names = Object.keys(files || {});
  graph.nodes = names.slice();
  for (const name of names) {
    if (!/\.(js|mjs|cjs|ts)$/i.test(name)) continue;
    const edges = extractJsImports(files[name], name);
    for (const e of edges) {
      graph.edges.push(e);
    }
  }
  return graph;
}

function indexSymbols(files) {
  const index = [];
  for (const [name, content] of Object.entries(files || {})) {
    if (!/\.(js|mjs|cjs|ts)$/i.test(name)) continue;
    index.push(...extractJsSymbols(content, name));
  }
  return index;
}

function findSymbol(index, name) {
  const n = String(name || '');
  return (index || []).filter((s) => s.name === n);
}

/**
 * Full code intelligence report.
 */
function analyzeCodebase(files) {
  const base = analyzer.analyzeProject(files || {});
  const graph = buildImportGraph(files || {});
  const symbols = indexSymbols(files || {});
  // unresolved relative requires
  const unresolved = [];
  for (const e of graph.edges) {
    if (e.to.startsWith('.') || e.to.startsWith('/')) {
      const resolved = path.normalize(path.join(path.dirname(e.from), e.to));
      const candidates = [
        resolved,
        resolved + '.js',
        resolved + '.ts',
        path.join(resolved, 'index.js'),
      ];
      const names = new Set(Object.keys(files || {}).map((n) => path.normalize(n)));
      if (![...candidates].some((c) => names.has(path.normalize(c)) || names.has(c.replace(/\\/g, '/')))) {
        unresolved.push({ ...e, resolved, severity: 'likely', message: 'Possible missing module: ' + e.to });
      }
    }
  }
  return {
    ...base,
    graph,
    symbols: symbols.slice(0, 500),
    unresolved,
    summary: {
      ...base.summary,
      imports: graph.edges.length,
      symbols: symbols.length,
      unresolved: unresolved.length,
    },
  };
}

module.exports = {
  extractJsImports,
  extractJsSymbols,
  buildImportGraph,
  indexSymbols,
  findSymbol,
  analyzeCodebase,
};
