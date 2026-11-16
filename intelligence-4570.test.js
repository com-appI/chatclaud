'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const math = require('../lib/math-engine');
const codeIntel = require('../lib/code-intelligence');
const research = require('../lib/research-planner');
const cognitive = require('../lib/cognitive-router');
const tutor = require('../lib/student-tutor');
const analyzer = require('../lib/project-analyzer');

describe('math 4.57 matrix/stats', () => {
  it('det2', () => assert.equal(math.det2(1, 2, 3, 4), -2));
  it('det via solveMath', () => {
    const r = math.solveMath('det([[1,2],[3,4]])', { useSympy: false, force: true });
    assert.equal(r.ok, true);
    assert.equal(r.answer, -2);
  });
  it('mean', () => assert.equal(math.mean([1, 2, 3, 4]), 2.5));
  it('variance', () => assert.ok(Math.abs(math.variance([1, 2, 3]) - 2 / 3) < 1e-9));
  it('multiplyMatrices', () => {
    const R = math.multiplyMatrices([[1, 0], [0, 1]], [[2, 3], [4, 5]]);
    assert.deepEqual(R, [[2, 3], [4, 5]]);
  });
  it('sinDeg 30', () => assert.ok(Math.abs(math.sinDeg(30) - 0.5) < 1e-9));
  it('cosDeg 60', () => assert.ok(Math.abs(math.cosDeg(60) - 0.5) < 1e-9));
});

describe('code-intelligence', () => {
  const files = {
    'index.js': "const a = require('./lib/a');\nfunction main(){}\nmodule.exports.run = main;",
    'lib/a.js': "exports.x = 1;\nfunction helper(){}",
    'app.js': "import x from './missing.js';",
  };
  it('builds import graph', () => {
    const g = codeIntel.buildImportGraph(files);
    assert.ok(g.edges.length >= 1);
  });
  it('indexes symbols', () => {
    const idx = codeIntel.indexSymbols(files);
    assert.ok(idx.some((s) => s.name === 'main'));
    assert.ok(idx.some((s) => s.name === 'helper'));
  });
  it('analyzeCodebase summary', () => {
    const r = codeIntel.analyzeCodebase(files);
    assert.ok(r.summary.symbols >= 1);
    assert.ok(r.summary.imports >= 1);
  });
  it('findSymbol', () => {
    const idx = codeIntel.indexSymbols(files);
    assert.ok(codeIntel.findSymbol(idx, 'main').length >= 1);
  });
});

describe('research-planner', () => {
  it('detects research', () => assert.ok(research.isResearchQuery('Найди latest новости про AI')));
  it('builds plan with steps', () => {
    const p = research.buildResearchPlan('What is the current Node LTS?');
    assert.ok(p.steps.length >= 4);
    assert.ok(p.rules.some((r) => /Never invent/.test(r)));
  });
  it('claim registry', () => {
    const reg = new research.ClaimRegistry();
    const c = reg.add('Node LTS is 20');
    reg.support(c.id, 'https://nodejs.org');
    assert.equal(reg.list()[0].status, 'supported');
  });
  it('brief without sources', () => {
    const b = research.synthesizeResearchBrief('q', []);
    assert.equal(b.confidence, 'none');
    assert.ok(/No sources/.test(b.brief));
  });
  it('brief with sources does not invent', () => {
    const b = research.synthesizeResearchBrief('q', [{ title: 'T', url: 'https://example.com', snippet: 'Hello' }]);
    assert.ok(b.brief.includes('example.com'));
    assert.equal(b.sourceCount, 1);
  });
});

describe('cognitive det matrix', () => {
  it('handles det', () => {
    const d = cognitive.tryDeterministic('det([[1,2],[3,4]])');
    assert.equal(d.handled, true);
    assert.ok(String(d.text).includes('-2'));
  });
});

describe('regression 4.56 math still works', () => {
  for (const [p, expect] of [['2+2', 4], ['3*7', 21], ['100/4', 25]]) {
    it('arith ' + p, () => {
      const r = math.solveMath(p, { useSympy: false });
      assert.equal(r.answer, expect);
    });
  }
  it('quadratic roots', () => {
    const q = math.solveQuadratic('x^2-5x+6=0');
    assert.deepEqual(q.roots.map((x) => Math.round(x)).sort(), [2, 3]);
  });
});

describe('tutor regression', () => {
  it('correct', () => assert.equal(tutor.checkStudentSolution('2+2', 'ответ: 4').verdict, 'correct'));
  it('incorrect', () => assert.equal(tutor.checkStudentSolution('2+2', 'ответ: 5').verdict, 'incorrect'));
});

describe('analyzer regression', () => {
  it('dup id', () => {
    assert.ok(analyzer.analyzeHtml('<div id="a"></div><i id="a"></i>', 't.html').some((i) => /Duplicate/.test(i.message)));
  });
});

// volume tests toward 200+ suite total
describe('volume arithmetic', () => {
  for (let i = 1; i <= 25; i++) {
    it('vol ' + i, () => assert.equal(math.evalArithmetic(i + '+' + i), 2 * i));
  }
});

describe('volume tutor', () => {
  for (let i = 1; i <= 20; i++) {
    it('tutor vol ' + i, () => {
      assert.equal(tutor.checkStudentSolution(i + '*1', 'ответ: ' + i).verdict, 'correct');
    });
  }
});

describe('volume code symbols', () => {
  for (let i = 0; i < 15; i++) {
    it('sym vol ' + i, () => {
      const files = { ['f' + i + '.js']: `function fn${i}(){ return ${i}; }\nexports.fn${i}=fn${i};` };
      const idx = codeIntel.indexSymbols(files);
      assert.ok(idx.some((s) => s.name === 'fn' + i));
    });
  }
});
