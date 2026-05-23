'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.join(__dirname, '..');
const statuslineScript = path.join(repoRoot, 'scripts', 'pmacro-statusline.cjs');

function runStatusline(cwd, env) {
  return spawnSync(process.execPath, [statuslineScript], {
    cwd: cwd || repoRoot,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    maxBuffer: 10 * 1024 * 1024,
  });
}

test('pmacro-statusline exits 0 with no macros (empty HOME)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacro-sl-empty-'));
  const r = runStatusline(repoRoot, { HOME: tmp });
  assert.equal(r.status, 0, `statusline failed: ${r.stderr}`);
  // Empty line or empty string — no tags
  assert.equal(r.stdout.trim(), '', `Expected empty output for no macros, got: ${r.stdout}`);
});

test('pmacro-statusline prints sorted user macro tags', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacro-sl-user-'));
  // Write user macros
  const macrosDir = path.join(tmp, '.claude', 'pmacros');
  fs.mkdirSync(macrosDir, { recursive: true });
  fs.writeFileSync(
    path.join(macrosDir, 'macros.json'),
    JSON.stringify({
      schemaVersion: 1,
      macros: {
        'zebra': { value: 'z val', approximateTokens: 1 },
        'alpha': { value: 'a val', approximateTokens: 1 },
        'middle': { value: 'm val', approximateTokens: 1 },
      },
    }, null, 2) + '\n',
    'utf8'
  );

  const r = runStatusline(repoRoot, { HOME: tmp });
  assert.equal(r.status, 0, `statusline failed: ${r.stderr}`);
  assert.equal(r.stdout.trim(), 'alpha middle zebra', `Expected sorted tags, got: ${r.stdout.trim()}`);
});

test('pmacro-statusline merges project macros (project overrides user)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacro-sl-merge-'));
  const projDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacro-sl-proj-'));

  // User macro
  const userMacrosDir = path.join(tmp, '.claude', 'pmacros');
  fs.mkdirSync(userMacrosDir, { recursive: true });
  fs.writeFileSync(
    path.join(userMacrosDir, 'macros.json'),
    JSON.stringify({ schemaVersion: 1, macros: { 'user-tag': { value: 'u', approximateTokens: 1 } } }, null, 2) + '\n',
    'utf8'
  );

  // Project macro (different tag)
  const projMacrosDir = path.join(projDir, '.claude', 'pmacros');
  fs.mkdirSync(projMacrosDir, { recursive: true });
  fs.writeFileSync(
    path.join(projMacrosDir, 'macros.json'),
    JSON.stringify({ schemaVersion: 1, macros: { 'proj-tag': { value: 'p', approximateTokens: 1 } } }, null, 2) + '\n',
    'utf8'
  );

  // Run statusline with cwd = projDir so it picks up project macros
  const r = runStatusline(projDir, { HOME: tmp });
  assert.equal(r.status, 0, `statusline failed: ${r.stderr}`);
  const tags = r.stdout.trim().split(' ');
  assert.ok(tags.includes('user-tag'), `Expected user-tag in: ${tags.join(' ')}`);
  assert.ok(tags.includes('proj-tag'), `Expected proj-tag in: ${tags.join(' ')}`);
  // Tags should be sorted
  assert.deepEqual(tags, [...tags].sort(), 'Tags should be sorted alphabetically');
});

test('pmacro-statusline truncates output longer than 120 chars', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacro-sl-trunc-'));
  // Create many tags to exceed 120 chars
  const macros = {};
  for (let i = 0; i < 20; i++) {
    macros[`tag-number-${String(i).padStart(2, '0')}`] = { value: 'v', approximateTokens: 1 };
  }
  const macrosDir = path.join(tmp, '.claude', 'pmacros');
  fs.mkdirSync(macrosDir, { recursive: true });
  fs.writeFileSync(
    path.join(macrosDir, 'macros.json'),
    JSON.stringify({ schemaVersion: 1, macros }, null, 2) + '\n',
    'utf8'
  );

  const r = runStatusline(repoRoot, { HOME: tmp });
  assert.equal(r.status, 0, `statusline failed: ${r.stderr}`);
  const output = r.stdout.trim();
  // Including the ellipsis character, length should be <= 120
  assert.ok(output.length <= 120, `Output length ${output.length} exceeds 120 chars: ${output}`);
  assert.ok(output.endsWith('…'), `Truncated output should end with ellipsis: ${output}`);
});

test('pmacro-statusline exits 0 even on macros file error', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacro-sl-err-'));
  // Write invalid JSON to macros.json
  const macrosDir = path.join(tmp, '.claude', 'pmacros');
  fs.mkdirSync(macrosDir, { recursive: true });
  fs.writeFileSync(path.join(macrosDir, 'macros.json'), 'NOT VALID JSON', 'utf8');

  const r = runStatusline(repoRoot, { HOME: tmp });
  assert.equal(r.status, 0, `statusline should exit 0 even on error, got: ${r.status}`);
});
