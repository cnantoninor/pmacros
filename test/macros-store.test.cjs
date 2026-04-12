'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

test('validateTagName, writeMacrosAtomic, readMacrosSync, upsertMacro', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacros-macros-'));
  const origHome = os.homedir;
  os.homedir = () => tmp;
  try {
    delete require.cache[require.resolve('../lib/paths.cjs')];
    delete require.cache[require.resolve('../lib/macros-store.cjs')];
    const {
      validateTagName,
      readMacrosSync,
      writeMacrosAtomic,
      upsertMacro,
    } = require('../lib/macros-store.cjs');

    assert.equal(validateTagName('ok-tag'), true);
    assert.equal(validateTagName('Bad'), false);
    assert.equal(validateTagName(''), false);

    writeMacrosAtomic({ schemaVersion: 1, macros: { a: { value: 'hello' } } });
    const data = readMacrosSync();
    assert.equal(data.schemaVersion, 1);
    assert.equal(data.macros.a.value, 'hello');
    assert.equal(data.macros.a.approximateTokens, Math.ceil('hello'.length / 4));

    upsertMacro({ tag: 'b', value: 'world', description: 'note' });
    const data2 = readMacrosSync();
    assert.equal(data2.macros.b.value, 'world');
    assert.equal(data2.macros.b.description, 'note');
    assert.equal(data2.macros.b.approximateTokens, Math.ceil('world'.length / 4));
  } finally {
    os.homedir = origHome;
  }
});
