'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.join(__dirname, '..');
const cli = path.join(repoRoot, 'scripts', 'pmacro.cjs');

function run(args, env) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    maxBuffer: 10 * 1024 * 1024,
  });
}

function runIn(args, env, cwd) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: cwd || repoRoot,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    maxBuffer: 10 * 1024 * 1024,
  });
}

test('pmacro add → list shows tag and approximateTokens', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacro-cli-'));
  const value = 'hello value';
  const r1 = run(['add', 'my-tag', value, 'my desc'], { HOME: tmp });
  assert.equal(r1.status, 0, r1.stderr);

  const r2 = run(['list'], { HOME: tmp });
  assert.equal(r2.status, 0, r2.stderr);
  assert.match(r2.stdout, /\| my-tag \|/);
  assert.match(r2.stdout, new RegExp(`\\| ${Math.ceil(value.length / 4)} \\|`));

  const macrosPath = path.join(tmp, '.claude', 'pmacros', 'macros.json');
  const raw = JSON.parse(fs.readFileSync(macrosPath, 'utf8'));
  assert.equal(raw.macros['my-tag'].approximateTokens, Math.ceil(value.length / 4));
});

test('pmacro preview expands stored macro', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacro-cli-prev-'));
  const r0 = run(['add', 't', 'X'], { HOME: tmp });
  assert.equal(r0.status, 0, r0.stderr);
  const r = run(['preview', 'a', '{{t}}', 'b'], { HOME: tmp });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /BEFORE:/);
  assert.match(r.stdout, /AFTER:[\s\S]*a X b/);
});

test('pmacro status counts recent errors and missed-tag warns', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacro-cli-st-'));
  const pmacros = path.join(tmp, '.claude', 'pmacros');
  fs.mkdirSync(pmacros, { recursive: true });
  const now = new Date().toISOString();
  const logPath = path.join(pmacros, 'hook-errors.log');
  const lines = [
    JSON.stringify({ ts: now, level: 'error', event: 'UserPromptSubmit', message: 'e1' }),
    JSON.stringify({ ts: now, level: 'warn', event: 'missed-tag', tag: 'x', message: 'm' }),
    JSON.stringify({ ts: now, level: 'warn', event: 'missed-tag', tag: 'y', message: 'm' }),
  ];
  fs.writeFileSync(logPath, `${lines.join('\n')}\n`, 'utf8');

  const r = run(['status'], { HOME: tmp });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Hook installed/);
  assert.match(r.stdout, /Last error \(24h\):/);
  assert.match(r.stdout, /e1/);
  assert.match(r.stdout, /Missed-tag warnings \(24h\): 2/);
});

test('pmacro status tail returns last lines', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacro-cli-tail-'));
  const pmacros = path.join(tmp, '.claude', 'pmacros');
  fs.mkdirSync(pmacros, { recursive: true });
  const logPath = path.join(pmacros, 'hook-errors.log');
  fs.writeFileSync(
    logPath,
    `${JSON.stringify({ ts: new Date().toISOString(), level: 'info', event: 'x', message: 'a' })}\n${JSON.stringify({ ts: new Date().toISOString(), level: 'info', event: 'x', message: 'b' })}\n`,
    'utf8'
  );
  const r = run(['status', 'tail', '1'], { HOME: tmp });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /"message":"b"/);
  assert.ok(!r.stdout.includes('"message":"a"'));
});

test('pmacro update changes existing user macro value', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacro-cli-upd-'));
  // Add a user macro
  const r0 = run(['add', 'greet', 'hello world', 'greeting'], { HOME: tmp });
  assert.equal(r0.status, 0, r0.stderr);

  // Update it
  const r1 = run(['update', 'greet', 'hi there', 'updated greeting'], { HOME: tmp });
  assert.equal(r1.status, 0, r1.stderr);

  // Verify the updated value is stored
  const macrosPath = path.join(tmp, '.claude', 'pmacros', 'macros.json');
  const raw = JSON.parse(fs.readFileSync(macrosPath, 'utf8'));
  assert.equal(raw.macros['greet'].value, 'hi there');
});

test('pmacro update fails with non-zero exit when tag missing', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacro-cli-upd-missing-'));
  // Do not add the tag — update should fail
  const r = run(['update', 'nonexistent', 'some value'], { HOME: tmp });
  assert.notEqual(r.status, 0, 'expected non-zero exit for missing tag');
  assert.match(r.stderr, /not found/i);
});

test('pmacro remove deletes user macro', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacro-cli-rm-'));
  // Add a macro then remove it
  const r0 = run(['add', 'to-remove', 'some value'], { HOME: tmp });
  assert.equal(r0.status, 0, r0.stderr);

  const r1 = run(['remove', 'to-remove'], { HOME: tmp });
  assert.equal(r1.status, 0, r1.stderr);

  const macrosPath = path.join(tmp, '.claude', 'pmacros', 'macros.json');
  const raw = JSON.parse(fs.readFileSync(macrosPath, 'utf8'));
  assert.ok(!Object.prototype.hasOwnProperty.call(raw.macros, 'to-remove'), 'tag should be gone');
});

test('pmacro remove --project removes project macro only, user macro intact', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacro-cli-rm-proj-'));
  const projDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacro-proj-'));

  // Add user-level macro
  const r0 = run(['add', 'shared', 'user-value'], { HOME: tmp });
  assert.equal(r0.status, 0, r0.stderr);

  // Write project-level macro directly to simulate project override
  const projMacrosDir = path.join(projDir, '.claude', 'pmacros');
  fs.mkdirSync(projMacrosDir, { recursive: true });
  fs.writeFileSync(
    path.join(projMacrosDir, 'macros.json'),
    JSON.stringify({ schemaVersion: 1, macros: { shared: { value: 'project-value', approximateTokens: 1 } } }, null, 2) + '\n',
    'utf8'
  );

  // Remove --project removes only the project-level entry
  const r1 = runIn(['remove', '--project', 'shared'], { HOME: tmp }, projDir);
  assert.equal(r1.status, 0, r1.stderr);

  // Project macros.json should no longer have 'shared'
  const projRaw = JSON.parse(fs.readFileSync(path.join(projMacrosDir, 'macros.json'), 'utf8'));
  assert.ok(!Object.prototype.hasOwnProperty.call(projRaw.macros, 'shared'), 'project macro should be removed');

  // User macros.json should still have 'shared'
  const userRaw = JSON.parse(fs.readFileSync(path.join(tmp, '.claude', 'pmacros', 'macros.json'), 'utf8'));
  assert.equal(userRaw.macros['shared'].value, 'user-value', 'user macro should be intact');
});

test('pmacro preview shows project override via merged macros', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacro-cli-prev-merged-'));
  const projDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacro-proj-prev-'));

  // Add user-level macro
  const r0 = run(['add', 'ctx', 'user-context'], { HOME: tmp });
  assert.equal(r0.status, 0, r0.stderr);

  // Write project-level override
  const projMacrosDir = path.join(projDir, '.claude', 'pmacros');
  fs.mkdirSync(projMacrosDir, { recursive: true });
  fs.writeFileSync(
    path.join(projMacrosDir, 'macros.json'),
    JSON.stringify({ schemaVersion: 1, macros: { ctx: { value: 'project-context', approximateTokens: 2 } } }, null, 2) + '\n',
    'utf8'
  );

  // Preview in the project dir — should see project-context (project overrides user)
  const r = runIn(['preview', '{{ctx}}'], { HOME: tmp }, projDir);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /project-context/);
  assert.ok(!r.stdout.includes('user-context'), 'user value should be overridden by project');
});
