'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('node:child_process');

const hookScript = path.join(__dirname, '..', 'hooks', 'user-prompt-submit.cjs');

function runHook(stdin, env) {
  return spawnSync(process.execPath, [hookScript], {
    input: stdin,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    maxBuffer: 10 * 1024 * 1024,
  });
}

test('UserPromptSubmit: empty macros leaves unknown tag, exit 0, valid JSON', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacros-hook-a-'));
  const payload = JSON.stringify({
    session_id: 's1',
    hook_event_name: 'UserPromptSubmit',
    prompt: 'hello {{x}} there',
  });
  const r = runHook(payload, { HOME: tmp });
  assert.equal(r.status, 0, r.stderr);
  const out = (r.stdout || '').trim();
  assert.ok(out.length > 0);
  const json = JSON.parse(out);
  assert.equal(json.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.equal(json.hookSpecificOutput.updatedPrompt, 'hello {{x}} there');
});

test('UserPromptSubmit: invalid stdin JSON → exit 0, empty stdout', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacros-hook-b-'));
  const r = runHook('not-json{{{', { HOME: tmp });
  assert.equal(r.status, 0, r.stderr);
  assert.equal((r.stdout || '').trim(), '');
});

test('UserPromptSubmit: stdin over limit → exit 0, empty stdout', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacros-hook-limit-'));
  const payload = JSON.stringify({
    hook_event_name: 'UserPromptSubmit',
    prompt: 'x'.repeat(80),
  });
  assert.ok(payload.length > 64, 'fixture should exceed test limit');
  const r = runHook(payload, { HOME: tmp, PMACROS_MAX_STDIN_CHARS: '64' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal((r.stdout || '').trim(), '');
});

test('UserPromptSubmit: invalid macros.json → pass through prompt, exit 0', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacros-hook-badjson-'));
  const pmacros = path.join(tmp, '.claude', 'pmacros');
  fs.mkdirSync(pmacros, { recursive: true });
  fs.writeFileSync(path.join(pmacros, 'macros.json'), '{ not valid json', 'utf8');
  const payload = JSON.stringify({
    hook_event_name: 'UserPromptSubmit',
    prompt: 'preserve {{x}} this',
  });
  const r = runHook(payload, { HOME: tmp });
  assert.equal(r.status, 0, r.stderr);
  const json = JSON.parse((r.stdout || '').trim());
  assert.equal(json.hookSpecificOutput.updatedPrompt, 'preserve {{x}} this');
});

test('UserPromptSubmit: log write failure still returns expansion, exit 0', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacros-hook-nowrite-'));
  const claudeDir = path.join(tmp, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  try {
    fs.chmodSync(claudeDir, 0o555);
    const payload = JSON.stringify({
      hook_event_name: 'UserPromptSubmit',
      prompt: 'a {{missing}} b',
    });
    const r = runHook(payload, { HOME: tmp });
    assert.equal(r.status, 0, r.stderr);
    const json = JSON.parse((r.stdout || '').trim());
    assert.equal(json.hookSpecificOutput.updatedPrompt, 'a {{missing}} b');
  } finally {
    try {
      fs.chmodSync(claudeDir, 0o755);
    } catch {
      /* tmp cleanup best-effort */
    }
  }
});

test('UserPromptSubmit: expands macro from seeded macros.json', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pmacros-hook-c-'));
  const pmacros = path.join(tmp, '.claude', 'pmacros');
  fs.mkdirSync(pmacros, { recursive: true });
  const macrosFile = path.join(pmacros, 'macros.json');
  fs.writeFileSync(
    macrosFile,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        macros: {
          t: { value: 'hi', approximateTokens: 1 },
        },
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  const payload = JSON.stringify({
    hook_event_name: 'UserPromptSubmit',
    prompt: 'say {{t}}',
  });
  const r = runHook(payload, { HOME: tmp });
  assert.equal(r.status, 0, r.stderr);
  const json = JSON.parse(r.stdout.trim());
  assert.equal(json.hookSpecificOutput.updatedPrompt, 'say hi');
});
