'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.join(__dirname, '..');
const installScript = path.join(repoRoot, 'install.js');

/**
 * Run install.js with a fake HOME and fake repo root (by using a temp REPO dir
 * that has the required structure). We can't easily override __dirname, so we
 * run the real install.js but with HOME overridden via env, and use the real
 * repo structure. The real lock file is written to repoRoot/.claude/ — we need
 * to clean that up.
 *
 * Strategy: run with HOME=<tmp> so settings.json and skills land in <tmp>/.claude,
 * and use --force to ensure a clean run each time, then delete the lock file.
 */

function runInstall(args, env) {
  const result = spawnSync(process.execPath, [installScript, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    maxBuffer: 10 * 1024 * 1024,
  });
  return result;
}

function cleanLock() {
  // Remove the lock file written to the real repo .claude dir
  const lockPath = path.join(repoRoot, '.claude', '.pmacros-installed');
  try { fs.unlinkSync(lockPath); } catch (_) { /* ok */ }
}

test.afterEach(() => {
  cleanLock();
});

test('install.js creates settings.json with UserPromptSubmit hook', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacros-install-'));
  cleanLock(); // ensure no existing lock

  const r = runInstall(['--force'], { HOME: tmp });
  assert.equal(r.status, 0, `install failed: ${r.stderr}`);

  const settingsPath = path.join(tmp, '.claude', 'settings.json');
  assert.ok(fs.existsSync(settingsPath), 'settings.json should be created');

  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.ok(settings.hooks, 'settings should have hooks');
  assert.ok(Array.isArray(settings.hooks.UserPromptSubmit), 'UserPromptSubmit should be array');

  const allHookCommands = settings.hooks.UserPromptSubmit
    .flatMap((g) => (Array.isArray(g.hooks) ? g.hooks : []))
    .map((h) => h.command || '');
  const hasHook = allHookCommands.some((cmd) => cmd.includes('user-prompt-submit.cjs'));
  assert.ok(hasHook, 'Hook entry for user-prompt-submit.cjs should be present');
});

test('install.js sets statusLine.command', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacros-install-sl-'));
  cleanLock();

  const r = runInstall(['--force'], { HOME: tmp });
  assert.equal(r.status, 0, `install failed: ${r.stderr}`);

  const settingsPath = path.join(tmp, '.claude', 'settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.ok(settings.statusLine, 'settings should have statusLine');
  assert.ok(
    typeof settings.statusLine.command === 'string' &&
      settings.statusLine.command.includes('pmacro-statusline.cjs'),
    `statusLine.command should reference pmacro-statusline.cjs, got: ${settings.statusLine.command}`
  );
});

test('install.js does not duplicate hook on second run (--force)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacros-install-dedup-'));
  cleanLock();

  // First install
  const r1 = runInstall(['--force'], { HOME: tmp });
  assert.equal(r1.status, 0, `first install failed: ${r1.stderr}`);
  cleanLock();

  // Second install with --force
  const r2 = runInstall(['--force'], { HOME: tmp });
  assert.equal(r2.status, 0, `second install failed: ${r2.stderr}`);

  const settingsPath = path.join(tmp, '.claude', 'settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  const allHookCommands = settings.hooks.UserPromptSubmit
    .flatMap((g) => (Array.isArray(g.hooks) ? g.hooks : []))
    .map((h) => h.command || '');
  const hookMatches = allHookCommands.filter((cmd) => cmd.includes('user-prompt-submit.cjs'));
  assert.equal(hookMatches.length, 1, `Hook should appear exactly once, got: ${hookMatches.length}`);
});

test('install.js skips when lock file present (no --force)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacros-install-lock-'));
  cleanLock();

  // First install to create lock
  const r1 = runInstall(['--force'], { HOME: tmp });
  assert.equal(r1.status, 0, `first install failed: ${r1.stderr}`);
  // Do NOT cleanLock() — lock should persist

  // Second install without --force: should skip
  const r2 = runInstall([], { HOME: tmp });
  assert.equal(r2.status, 0, `second install (skip) failed: ${r2.stderr}`);
  assert.match(r2.stdout, /already installed/i, 'Should print "already installed" message');

  cleanLock();
});

test('install.js with --force reinstalls when lock present', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacros-install-force-'));
  cleanLock();

  // First install
  const r1 = runInstall(['--force'], { HOME: tmp });
  assert.equal(r1.status, 0, `first install failed: ${r1.stderr}`);
  // Lock is present — don't clean it

  // Force reinstall
  const r2 = runInstall(['--force'], { HOME: tmp });
  assert.equal(r2.status, 0, `force reinstall failed: ${r2.stderr}`);
  assert.match(r2.stdout, /installation complete/i);

  cleanLock();
});

test('install.js copies skills to HOME/.claude/skills/', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacros-install-skills-'));
  cleanLock();

  const r = runInstall(['--force'], { HOME: tmp });
  assert.equal(r.status, 0, `install failed: ${r.stderr}`);

  const skillsDir = path.join(tmp, '.claude', 'skills');
  assert.ok(fs.existsSync(skillsDir), 'skills dir should be created');

  // At least pmacro-add should be copied
  const addSkill = path.join(skillsDir, 'pmacro-add', 'SKILL.md');
  assert.ok(fs.existsSync(addSkill), 'pmacro-add/SKILL.md should be copied');
});

test('install.js backs up differing SKILL.md before overwrite', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacros-install-backup-'));
  cleanLock();

  // Pre-create pmacro-add/SKILL.md with different content
  const destSkillDir = path.join(tmp, '.claude', 'skills', 'pmacro-add');
  fs.mkdirSync(destSkillDir, { recursive: true });
  const destSkillFile = path.join(destSkillDir, 'SKILL.md');
  fs.writeFileSync(destSkillFile, '# Old SKILL.md content — should be backed up\n', 'utf8');

  const r = runInstall(['--force'], { HOME: tmp });
  assert.equal(r.status, 0, `install failed: ${r.stderr}`);

  // A backup file should exist
  const backups = fs.readdirSync(destSkillDir).filter((f) => f.includes('pmacros-backup'));
  assert.ok(backups.length >= 1, `Expected at least one backup file, got: ${backups.join(', ')}`);

  // The destination should now have the repo's content
  const newContent = fs.readFileSync(destSkillFile, 'utf8');
  assert.ok(!newContent.includes('Old SKILL.md'), 'Destination should be the new file, not the old one');
});
