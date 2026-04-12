'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { expandPrompt } = require('../lib/expand.cjs');

test('expandPrompt replaces known tag', () => {
  const r = expandPrompt('hi {{ok}}', { ok: { value: 'there' } });
  assert.equal(r.text, 'hi there');
  assert.deepEqual(r.missedTags, []);
});

test('expandPrompt leaves unknown tag and collects unique missedTags', () => {
  const r = expandPrompt('{{nope}} and {{nope}}', {});
  assert.equal(r.text, '{{nope}} and {{nope}}');
  assert.deepEqual(r.missedTags, ['nope']);
});

test('expandPrompt handles empty macros map', () => {
  const r = expandPrompt('{{x}}', null);
  assert.equal(r.text, '{{x}}');
  assert.deepEqual(r.missedTags, ['x']);
});
