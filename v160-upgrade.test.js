'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const server = require('../server.js');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function classList(initial) {
  const values = new Set(initial || []);
  return {
    add(name) { values.add(name); },
    remove(name) { values.delete(name); },
    contains(name) { return values.has(name); },
    toggle(name, force) {
      const next = force === undefined ? !values.has(name) : !!force;
      if (next) values.add(name); else values.delete(name);
      return next;
    },
  };
}

function bootUi(request) {
  const calls = { theme: [], newChat: 0, mode: [], scroll: 0 };
  const elements = Object.create(null);
  const settings = elements.settingsScreen = { classList: classList(['hidden']) };
  const sidebar = elements.flashSidebar = { classList: classList([]) };
  const overlay = elements.flashSidebarOverlay = { classList: classList([]) };
  elements.flashNewChat = { click() { calls.newChat += 1; } };
  elements.flashMessages = { scrollHeight: 500, scrollTo() { calls.scroll += 1; } };
  const modeOpt = { click() { calls.mode.push('code'); } };
  elements.flashModePop = { querySelector(selector) { return selector.includes('code') ? modeOpt : null; } };
  const body = { classList: classList(['cc-bg-wave']) };
  const document = {
    body,
    getElementById(id) { return elements[id] || null; },
    querySelector() { return null; },
  };
  const window = {
    CC: { UI: { applyTheme(name) { calls.theme.push(name); body.classList.remove('cc-bg-wave'); body.classList.toggle('cc-bg-light', name === 'light'); body.classList.toggle('cc-bg-blue', name === 'blue'); } } },
    __ccLastUserRequest: request || '',
    chatMode: 'fast',
  };
  const context = { window, document, localStorage: { setItem() {} }, console };
  const match = html.match(/<script id="cc-v160-interface-control">([\s\S]*?)<\/script>/);
  assert.ok(match, 'interface controller script exists');
  vm.runInNewContext(match[1], context, { filename: 'cc-v160-interface-control.js' });
  return { UI: window.CC.UI, calls, elements, window };
}

test('single-file intelligence loader exports the v1.6.0 intent router', () => {
  assert.equal(typeof server.intel.classifyIntent, 'function');
  assert.equal(server.intel.classifyIntent('найди свежие источники').intent, 'research');
});

test('assistant can apply a theme only when the user requested that target', () => {
  const ui = bootUi('Смени тему на светлую');
  const clean = ui.UI.parseAndRun('Готово.\n[[CC_UI:theme=light]]');
  assert.equal(clean, 'Готово.');
  assert.deepEqual(ui.calls.theme, ['light']);
});

test('assistant UI actions are rejected when they were not explicitly requested', () => {
  const ui = bootUi('Расскажи о возможностях ChatClaud');
  assert.equal(ui.UI.execute('openSettings', {}, 'assistant').error, 'user_authorization_required');
  assert.equal(ui.UI.execute('newChat', {}, 'assistant').error, 'user_authorization_required');
  ui.UI.parseAndRun('[[CC_UI:newchat]]');
  assert.equal(ui.calls.newChat, 0);
});

test('assistant can open settings and sidebar only after a matching explicit request', () => {
  const settings = bootUi('Открой настройки');
  assert.equal(settings.UI.execute('openSettings', {}, 'assistant').ok, true);
  assert.equal(settings.elements.settingsScreen.classList.contains('hidden'), false);
  const side = bootUi('Покажи боковую панель');
  assert.equal(side.UI.execute('openSidebar', {}, 'assistant').ok, true);
  assert.equal(side.elements.flashSidebar.classList.contains('open'), true);
  assert.equal(side.elements.flashSidebarOverlay.classList.contains('show'), true);
});

test('assistant authorization uses the current send text, not a stale previous request', () => {
  const ui = bootUi('Расскажи о возможностях ChatClaud');
  ui.window.__ccLastSendText = 'Открой настройки';
  ui.UI.parseAndRun('[[CC_UI:settings=open]]');
  assert.equal(ui.elements.settingsScreen.classList.contains('hidden'), false);
});

test('assistant cannot activate voice or arbitrary interface actions', () => {
  const ui = bootUi('Включи голосовой режим');
  assert.equal(ui.UI.execute('setMode', { mode: 'voice' }, 'assistant').error, 'user_authorization_required');
  assert.equal(ui.UI.execute('runJavaScript', { code: 'alert(1)' }, 'assistant').error, 'user_authorization_required');
  assert.equal(ui.UI.security.arbitraryCode, false);
  assert.equal(ui.UI.security.secretAccess, false);
});

test('Agent Trace is wired to send, response, failure and reduced-motion paths', () => {
  assert.match(html, /window\.ccTraceStart\(text \|\| '\[Вложение\]'\)/);
  assert.match(html, /ccTraceFromAgent\(window\.__ccLastAgent, data\.intent \|\| null/);
  assert.match(html, /window\.ccTraceFail\(\)/);
  assert.match(html, /window\.ccTraceEnd\(\)/);
  assert.match(html, /prefers-reduced-motion:\s*reduce/);
});

test('package, release metadata and PWA cache are consistently versioned', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.equal(pkg.version, '2.14.3');
  assert.match(sw, /chatclaud-static-v20/);
  assert.ok(fs.existsSync(path.join(root, 'RELEASE-v2.14.3.md')));
  assert.ok(fs.existsSync(path.join(root, 'DEPLOY-v2.14.3.md')));
});
