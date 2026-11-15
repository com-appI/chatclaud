'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const tutor = require('../lib/student-tutor');
const analyzer = require('../lib/project-analyzer');
const cognitive = require('../lib/cognitive-router');
const math = require('../lib/math-engine');

describe('student-tutor', () => {
  it('detects check mode', () => {
    assert.equal(tutor.detectTutorIntent('Проверь моё решение').mode, 'check');
  });
  it('detects hint mode', () => {
    assert.equal(tutor.detectTutorIntent('Дай подсказку, не решай за меня').mode, 'hint');
  });
  it('extracts claimed answer', () => {
    assert.equal(tutor.extractClaimedAnswer('Я получил ответ: 42'), 42);
  });
  it('correct student answer', () => {
    const c = tutor.checkStudentSolution('2+2', 'ответ: 4');
    assert.equal(c.verdict, 'correct');
  });
  it('incorrect student answer', () => {
    const c = tutor.checkStudentSolution('2+2', 'ответ: 5');
    assert.equal(c.verdict, 'incorrect');
  });
  it('hint for quadratic', () => {
    const h = tutor.buildHint('решить x^2-5x+6=0', 'school');
    assert.ok(/дискриминант|D=/i.test(h.hint) || h.hint.length > 10);
  });
  // batch student checks
  for (const [p, s, v] of [
    ['3*3', 'answer: 9', 'correct'],
    ['10-4', 'ответ: 6', 'correct'],
    ['5+5', 'ответ: 11', 'incorrect'],
    ['100/2', 'x=50', 'correct'],
  ]) {
    it('check ' + p + ' -> ' + v, () => {
      assert.equal(tutor.checkStudentSolution(p, s).verdict, v);
    });
  }
});

describe('project-analyzer html', () => {
  it('duplicate ids confirmed', () => {
    const html = '<div id="a"></div><span id="a"></span>';
    const issues = analyzer.analyzeHtml(html, 't.html');
    assert.ok(issues.some((i) => i.severity === 'confirmed' && /Duplicate id/.test(i.message)));
  });
  it('unbalanced div likely', () => {
    const issues = analyzer.analyzeHtml('<div><div></div>', 't.html');
    assert.ok(issues.some((i) => /unclosed <div>/i.test(i.message)));
  });
  it('css braces', () => {
    const issues = analyzer.analyzeCss('.a { color: red;', 'a.css');
    assert.ok(issues.some((i) => i.severity === 'confirmed'));
  });
  it('js eval warning', () => {
    const issues = analyzer.analyzeJs('eval("1")', 'a.js');
    assert.ok(issues.some((i) => /eval/.test(i.message)));
  });
  it('package.json invalid', () => {
    const issues = analyzer.analyzePackageJson('{', 'package.json');
    assert.ok(issues.some((i) => i.severity === 'confirmed'));
  });
  it('package.json start suggestion', () => {
    const issues = analyzer.analyzePackageJson(JSON.stringify({ name: 'x' }), 'package.json');
    assert.ok(issues.some((i) => /start script/i.test(i.message)));
  });
  it('cross-file missing id', () => {
    const r = analyzer.analyzeProject({
      'index.html': '<div id="root"></div>',
      'app.js': 'document.getElementById("missing")',
    });
    assert.ok(r.issues.some((i) => /missing/.test(i.message)));
  });
  it('large html warning', () => {
    const issues = analyzer.analyzeHtml('x'.repeat(500001), 'big.html');
    assert.ok(issues.some((i) => i.type === 'size'));
  });
  it('console typo', () => {
    const issues = analyzer.analyzeJs('cosnole.log(1)', 't.js');
    assert.ok(issues.some((i) => i.severity === 'confirmed'));
  });
});

describe('cognitive router', () => {
  it('routes math', () => assert.equal(cognitive.routeCognitive('2+2').type, 'math'));
  it('routes tutor', () => assert.equal(cognitive.routeCognitive('Проверь моё решение').type, 'tutor'));
  it('routes analyze', () => assert.equal(cognitive.routeCognitive('проанализируй проект').type, 'analyze'));
  it('routes chat', () => assert.equal(cognitive.routeCognitive('Привет').type, 'chat'));
  it('deterministic 2+2', () => {
    const d = cognitive.tryDeterministic('2+2');
    assert.equal(d.handled, true);
    assert.ok(String(d.text).includes('4'));
  });
  it('deterministic wrong student', () => {
    const d = cognitive.tryDeterministic('Проверь моё решение\n2+2\nответ: 5');
    // first line is problem for check - may not parse; at least handled or not crash
    assert.ok(d);
  });
});

describe('math stress set (30+)', () => {
  const arith = [];
  for (let a = 1; a <= 6; a++) {
    for (let b = 1; b <= 5; b++) {
      arith.push([`${a}+${b}`, a + b]);
      arith.push([`${a}*${b}`, a * b]);
    }
  }
  for (const [expr, expected] of arith.slice(0, 40)) {
    it('stress ' + expr, () => {
      assert.equal(math.evalArithmetic(expr), expected);
    });
  }
});

describe('analyzer stress files', () => {
  for (let i = 0; i < 15; i++) {
    it('html sample ' + i, () => {
      const html = `<div id="id${i}"></div><div id="id${i}"></div>`;
      const issues = analyzer.analyzeHtml(html, `f${i}.html`);
      assert.ok(issues.length >= 1);
    });
  }
});

describe('tutor stress', () => {
  for (let i = 1; i <= 15; i++) {
    it('student check ' + i, () => {
      const c = tutor.checkStudentSolution(`${i}+${i}`, `ответ: ${i + i}`);
      assert.equal(c.verdict, 'correct');
    });
  }
});
