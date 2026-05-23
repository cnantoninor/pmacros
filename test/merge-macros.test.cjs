'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('node:child_process');

const {
  tryReadMacrosFile,
  mergeMacroMaps,
  getMergedMacrosSync,
} = require('../lib/macros-store.cjs');

const hookScript = path.join(__dirname, '..', 'hooks', 'user-prompt-submit.cjs');

// --- Helpers ---

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pmacros-merge-'));
}

function writeMacrosJson(dir, macros) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'macros.json'),
    `${JSON.stringify({ schemaVersion: 1, macros }, null, 2)}\n`,
    'utf8'
  );
}

function runHook(stdinPayload, env) {
  return spawnSync(process.execPath, [hookScript], {
    input: stdinPayload,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    maxBuffer: 10 * 1024 * 1024,
  });
}

// --- mergeMacroMaps unit tests ---

test('mergeMacroMaps: user tag and project tag both present in result', () => {
  const user = { a: { value: 'user-a', approximateTokens: 1 } };
  const project = { b: { value: 'project-b', approximateTokens: 1 } };
  const merged = mergeMacroMaps(user, project);
  assert.ok('a' in merged, 'user key a should be present');
  assert.ok('b' in merged, 'project key b should be present');
  assert.equal(merged.a.value, 'user-a');
  assert.equal(merged.b.value, 'project-b');
});

test('mergeMacroMaps: project value wins on same tag', () => {
  const user = { tag: { value: 'user-value', approximateTokens: 2 } };
  const project = { tag: { value: 'project-value', approximateTokens: 2 } };
  const merged = mergeMacroMaps(user, project);
  assert.equal(merged.tag.value, 'project-value');
});

// --- tryReadMacrosFile unit tests ---

test('tryReadMacrosFile: missing file returns ok with defaultData', () => {
  const result = tryReadMacrosFile('/tmp/does-not-exist-pmacros-' + Date.now() + '.json');
  assert.equal(result.ok, true);
  assert.deepEqual(result.data.macros, {});
});

test('tryReadMacrosFile: invalid JSON returns ok: false with code', () => {
  const tmp = makeTmpDir();
  const filePath = path.join(tmp, 'macros.json');
  fs.writeFileSync(filePath, '{ not valid json', 'utf8');
  const result = tryReadMacrosFile(filePath);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_MACROS_JSON');
});

test('tryReadMacrosFile: valid macros file returns ok with normalized macros', () => {
  const tmp = makeTmpDir();
  const filePath = path.join(tmp, 'macros.json');
  fs.writeFileSync(
    filePath,
    JSON.stringify({ schemaVersion: 1, macros: { hello: { value: 'world' } } }),
    'utf8'
  );
  const result = tryReadMacrosFile(filePath);
  assert.equal(result.ok, true);
  assert.equal(result.data.macros.hello.value, 'world');
});

// --- getMergedMacrosSync integration tests ---

test('getMergedMacrosSync: user file invalid JSON, project valid → only project macros', () => {
  const tmp = makeTmpDir();

  // Set up fake HOME with invalid user macros
  const userPmacrosDir = path.join(tmp, 'home', '.claude', 'pmacros');
  fs.mkdirSync(userPmacrosDir, { recursive: true });
  fs.writeFileSync(path.join(userPmacrosDir, 'macros.json'), '{ bad json', 'utf8');

  // Set up project macros
  const projectDir = path.join(tmp, 'project');
  const projectPmacrosDir = path.join(projectDir, '.claude', 'pmacros');
  writeMacrosJson(projectPmacrosDir, { proj: { value: 'from-project' } });

  // Temporarily override HOME for getMacrosPath (uses os.homedir())
  const origHome = process.env.HOME;
  process.env.HOME = path.join(tmp, 'home');
  try {
    const result = getMergedMacrosSync(projectDir);
    assert.ok(!('proj' in result.macros === false), 'proj should be in merged');
    assert.equal(result.macros.proj.value, 'from-project');
    assert.equal(result.userResult.ok, false);
    assert.equal(result.projectResult.ok, true);
  } finally {
    process.env.HOME = origHome;
  }
});

test('getMergedMacrosSync: project missing → user macros only', () => {
  const tmp = makeTmpDir();

  // Set up user macros
  const userPmacrosDir = path.join(tmp, 'home', '.claude', 'pmacros');
  writeMacrosJson(userPmacrosDir, { usr: { value: 'user-only' } });

  // Project has no macros file
  const projectDir = path.join(tmp, 'project-no-macros');
  fs.mkdirSync(projectDir, { recursive: true });

  const origHome = process.env.HOME;
  process.env.HOME = path.join(tmp, 'home');
  try {
    const result = getMergedMacrosSync(projectDir);
    assert.equal(result.macros.usr.value, 'user-only');
    assert.equal(result.userResult.ok, true);
    assert.equal(result.projectResult.ok, true); // missing file → ok with defaultData
  } finally {
    process.env.HOME = origHome;
  }
});

// --- Hook integration test: project macro overrides user macro ---

test('UserPromptSubmit: project macro overrides user macro via cwd field', () => {
  const tmp = makeTmpDir();

  // User macro: tag "shared" → "user-value"
  const userPmacrosDir = path.join(tmp, 'home', '.claude', 'pmacros');
  writeMacrosJson(userPmacrosDir, { shared: { value: 'user-value' } });

  // Project macro: tag "shared" → "project-value" (should win)
  const projectDir = path.join(tmp, 'myproject');
  const projectPmacrosDir = path.join(projectDir, '.claude', 'pmacros');
  writeMacrosJson(projectPmacrosDir, { shared: { value: 'project-value' } });

  const payload = JSON.stringify({
    hook_event_name: 'UserPromptSubmit',
    cwd: projectDir,
    prompt: 'use {{shared}} here',
  });

  const r = runHook(payload, { HOME: path.join(tmp, 'home') });
  assert.equal(r.status, 0, r.stderr);
  const json = JSON.parse(r.stdout.trim());
  assert.equal(json.hookSpecificOutput.updatedPrompt, 'use project-value here');
});

test('UserPromptSubmit: workspaceRoot also resolves project macros', () => {
  const tmp = makeTmpDir();

  // No user macros
  const userPmacrosDir = path.join(tmp, 'home', '.claude', 'pmacros');
  fs.mkdirSync(userPmacrosDir, { recursive: true });

  // Project macro via workspaceRoot
  const projectDir = path.join(tmp, 'wsproject');
  const projectPmacrosDir = path.join(projectDir, '.claude', 'pmacros');
  writeMacrosJson(projectPmacrosDir, { wstag: { value: 'ws-expanded' } });

  const payload = JSON.stringify({
    hook_event_name: 'UserPromptSubmit',
    workspaceRoot: projectDir,
    prompt: 'check {{wstag}} done',
  });

  const r = runHook(payload, { HOME: path.join(tmp, 'home') });
  assert.equal(r.status, 0, r.stderr);
  const json = JSON.parse(r.stdout.trim());
  assert.equal(json.hookSpecificOutput.updatedPrompt, 'check ws-expanded done');
});
