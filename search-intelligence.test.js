'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const serverSrc = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

describe('search intelligence helpers present', () => {
  it('defines intent and ranking helpers', () => {
    for (const name of [
      'detectSearchIntent',
      'searchAuthorityScore',
      'searchFreshnessScore',
      'searchContentFingerprint',
      'rankAndDedupeSearchResults',
      'estimateAgentBudget',
      'notesAreSufficient',
    ]) {
      assert.match(serverSrc, new RegExp('function ' + name + '\\('));
    }
  });

  it('includes weak rewrite and conflict handling', () => {
    assert.match(serverSrc, /weak-rewrite/);
    assert.match(serverSrc, /Conflict note/);
  });
});

describe('agent runtime v1.5.2 markers', () => {
  it('has early stop and set_notes support', () => {
    assert.match(serverSrc, /notes_sufficient/);
    assert.match(serverSrc, /set_notes/);
    assert.match(serverSrc, /agent-runtime v1\.5\.2/);
  });
});
