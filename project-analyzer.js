'use strict';
/**
 * Project Analyzer — static diagnostics for HTML/CSS/JS/JSON/Node manifests.
 * Severity: confirmed | likely | warning | suggestion
 */
const path = require('path');

function issue(file, severity, type, message, fix, line) {
  return {
    file: file || null,
    line: line != null ? line : null,
    severity, // confirmed | likely | warning | suggestion
    type,
    message,
    fix: fix || null,
  };
}

function analyzeHtml(content, fileName) {
  const issues = [];
  const text = String(content || '');
  const lines = text.split(/\r?\n/);

  if (!/<html[\s>]/i.test(text) && text.length > 200) {
    issues.push(issue(fileName, 'warning', 'structure', 'No <html> root found in large HTML document'));
  }
  if (/<script[^>]*src=["']https?:\/\//i.test(text) && !/integrity=/i.test(text)) {
    issues.push(issue(fileName, 'suggestion', 'security', 'External scripts without SRI integrity attribute'));
  }

  // unclosed tags heuristic for common pairs
  const pairs = [['div', /<div\b/gi, /<\/div>/gi], ['span', /<span\b/gi, /<\/span>/gi], ['script', /<script\b/gi, /<\/script>/gi]];
  for (const [name, openRe, closeRe] of pairs) {
    const opens = (text.match(openRe) || []).length;
    const closes = (text.match(closeRe) || []).length;
    if (opens !== closes) {
      issues.push(issue(fileName, 'likely', 'syntax', `Possible unclosed <${name}>: open=${opens} close=${closes}`, `Balance <${name}> tags`));
    }
  }

  // duplicate ids
  const ids = [...text.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
  const seen = new Map();
  ids.forEach((id, idx) => {
    if (seen.has(id)) {
      issues.push(issue(fileName, 'confirmed', 'html', `Duplicate id="${id}"`, 'Make id unique', null));
    }
    seen.set(id, idx);
  });

  // inline handlers without functions defined — soft
  if (/onerror\s*=\s*["'][^"']*["']/i.test(text)) {
    issues.push(issue(fileName, 'warning', 'security', 'Inline onerror handler present'));
  }

  // very large file
  if (text.length > 500000) {
    issues.push(issue(fileName, 'warning', 'size', `Large HTML (${text.length} chars) — analyze in sections`, 'Split or stream analysis'));
  }

  return issues;
}

function analyzeCss(content, fileName) {
  const issues = [];
  const text = String(content || '');
  const opens = (text.match(/\{/g) || []).length;
  const closes = (text.match(/\}/g) || []).length;
  if (opens !== closes) {
    issues.push(issue(fileName, 'confirmed', 'syntax', `Unbalanced braces {=${opens} }=${closes}`, 'Fix CSS braces'));
  }
  if (/expression\s*\(/i.test(text)) {
    issues.push(issue(fileName, 'confirmed', 'security', 'Deprecated CSS expression() detected'));
  }
  return issues;
}

function analyzeJs(content, fileName) {
  const issues = [];
  const text = String(content || '');
  try {
    // syntax check via Function for module-ish scripts is imperfect; try parentheses balance
    const opens = (text.match(/\(/g) || []).length;
    const closes = (text.match(/\)/g) || []).length;
    if (opens !== closes) {
      issues.push(issue(fileName, 'likely', 'syntax', `Unbalanced parentheses (=${opens} )=${closes}`));
    }
    const bopens = (text.match(/\{/g) || []).length;
    const bcloses = (text.match(/\}/g) || []).length;
    if (bopens !== bcloses) {
      issues.push(issue(fileName, 'likely', 'syntax', `Unbalanced braces {=${bopens} }=${bcloses}`));
    }
  } catch (e) {
    issues.push(issue(fileName, 'likely', 'syntax', e.message));
  }
  if (/\beval\s*\(/i.test(text)) {
    issues.push(issue(fileName, 'warning', 'security', 'Use of eval()'));
  }
  if (/document\.write\s*\(/i.test(text)) {
    issues.push(issue(fileName, 'suggestion', 'api', 'document.write is discouraged'));
  }
  // undefined-looking common typos
  if (/\bcosnole\.|\bconsoel\./i.test(text)) {
    issues.push(issue(fileName, 'confirmed', 'typo', 'Possible console typo (cosnole/consoel)'));
  }
  return issues;
}

function analyzePackageJson(content, fileName) {
  const issues = [];
  let pkg;
  try {
    pkg = JSON.parse(String(content || ''));
  } catch (e) {
    return [issue(fileName, 'confirmed', 'json', 'Invalid package.json: ' + e.message)];
  }
  if (!pkg.name) issues.push(issue(fileName, 'warning', 'manifest', 'Missing name field'));
  if (!pkg.scripts || !pkg.scripts.start) {
    issues.push(issue(fileName, 'suggestion', 'manifest', 'No start script — Render may need npm start'));
  }
  if (pkg.dependencies && pkg.dependencies.openai && !pkg.dependencies.groq) {
    issues.push(issue(fileName, 'suggestion', 'deps', 'openai listed — ChatClaud primary path uses Groq'));
  }
  return issues;
}

function analyzeFile(fileName, content) {
  const ext = path.extname(fileName || '').toLowerCase();
  const base = path.basename(fileName || 'file');
  if (base === 'package.json' || ext === '.json') {
    if (base === 'package.json') return analyzePackageJson(content, fileName);
    try {
      JSON.parse(String(content || ''));
      return [];
    } catch (e) {
      return [issue(fileName, 'confirmed', 'json', e.message)];
    }
  }
  if (ext === '.html' || ext === '.htm') return analyzeHtml(content, fileName);
  if (ext === '.css') return analyzeCss(content, fileName);
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs' || ext === '.ts') return analyzeJs(content, fileName);
  return [issue(fileName, 'suggestion', 'type', 'No specialized analyzer for this extension')];
}

/**
 * Analyze multiple files (project).
 * contentMap: { "path": "content", ... }
 */
function analyzeProject(contentMap) {
  const files = contentMap && typeof contentMap === 'object' ? contentMap : {};
  const all = [];
  const names = Object.keys(files);
  for (const name of names) {
    const content = files[name];
    // long files: still analyze full string (no silent truncate)
    all.push(...analyzeFile(name, content));
  }
  // cross-file: HTML ids vs JS getElementById
  const htmlFiles = names.filter((n) => /\.html?$/i.test(n));
  const jsFiles = names.filter((n) => /\.jsx?$/i.test(n));
  const htmlText = htmlFiles.map((n) => String(files[n] || '')).join('\n');
  const jsText = jsFiles.map((n) => String(files[n] || '')).join('\n');
  const idRefs = [...jsText.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
  for (const id of idRefs) {
    if (htmlText && !new RegExp('id=["\']' + id + '["\']').test(htmlText)) {
      all.push(issue('(cross)', 'likely', 'integration', `JS getElementById("${id}") but id not found in HTML`));
    }
  }
  const summary = {
    files: names.length,
    confirmed: all.filter((i) => i.severity === 'confirmed').length,
    likely: all.filter((i) => i.severity === 'likely').length,
    warning: all.filter((i) => i.severity === 'warning').length,
    suggestion: all.filter((i) => i.severity === 'suggestion').length,
  };
  return { issues: all, summary };
}

module.exports = {
  analyzeHtml,
  analyzeCss,
  analyzeJs,
  analyzePackageJson,
  analyzeFile,
  analyzeProject,
};
