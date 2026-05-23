#!/usr/bin/env node
'use strict';

const path = require('path');

try {
  const { getMergedMacrosSync } = require(path.join(__dirname, '..', 'lib', 'macros-store.cjs'));
  const cwd = process.cwd();
  const { macros } = getMergedMacrosSync(cwd);
  const tags = Object.keys(macros).sort();
  if (tags.length === 0) {
    process.stdout.write('\n');
  } else {
    let line = tags.join(' ');
    if (line.length > 120) {
      line = line.slice(0, 117) + '…';
    }
    process.stdout.write(line + '\n');
  }
  process.exit(0);
} catch (_err) {
  process.stdout.write('pmacros\n');
  process.exit(0);
}
