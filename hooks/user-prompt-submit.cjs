#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const { expandPrompt } = require(path.join(__dirname, '..', 'lib', 'expand.cjs'));
const { getMergedMacrosSync } = require(path.join(__dirname, '..', 'lib', 'macros-store.cjs'));
const { appendLog } = require(path.join(__dirname, '..', 'lib', 'error-log.cjs'));

const DEFAULT_MAX_STDIN_CHARS = 32 * 1024 * 1024;

/** Guard against pathological stdin size (T-03-01). Override with PMACROS_MAX_STDIN_CHARS for tests. */
function getMaxStdinChars() {
  const v = process.env.PMACROS_MAX_STDIN_CHARS;
  if (v === undefined || v === '') {
    return DEFAULT_MAX_STDIN_CHARS;
  }
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) {
    return Math.min(Math.floor(n), DEFAULT_MAX_STDIN_CHARS);
  }
  return DEFAULT_MAX_STDIN_CHARS;
}

function safeAppendLog(entry) {
  try {
    appendLog(entry);
  } catch {
    /* never block prompt */
  }
}

function writeSuccess(updatedPrompt) {
  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        updatedPrompt,
      },
    })}\n`
  );
}

function main() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    const maxStdin = getMaxStdinChars();
    if (raw.length > maxStdin) {
      safeAppendLog({
        level: 'error',
        event: 'UserPromptSubmit',
        message: 'stdin exceeded maximum length',
      });
      process.exit(0);
    }

    let event;
    try {
      event = JSON.parse(raw);
    } catch (e) {
      safeAppendLog({
        level: 'error',
        event: 'UserPromptSubmit',
        message: `invalid JSON on stdin: ${e.message}`,
        stack: e.stack,
      });
      process.exit(0);
    }

    const promptText = typeof event.prompt === 'string' ? event.prompt : '';

    const cwd =
      typeof event.cwd === 'string'
        ? event.cwd
        : typeof event.workspaceRoot === 'string'
        ? event.workspaceRoot
        : process.cwd();

    let macros = {};
    try {
      const merged = getMergedMacrosSync(cwd);
      macros = merged.macros || {};
      if (!merged.userResult.ok) {
        safeAppendLog({
          level: 'warn',
          event: 'UserPromptSubmit',
          message: merged.userResult.message,
        });
      }
      if (!merged.projectResult.ok) {
        safeAppendLog({
          level: 'warn',
          event: 'UserPromptSubmit',
          message: merged.projectResult.message,
        });
      }
    } catch (e) {
      safeAppendLog({
        level: 'error',
        event: 'UserPromptSubmit',
        message: `macros read failed: ${e.message}`,
        stack: e.stack,
      });
      writeSuccess(promptText);
      process.exit(0);
    }

    const { text, missedTags } = expandPrompt(promptText, macros);
    for (const tag of missedTags) {
      safeAppendLog({
        level: 'warn',
        event: 'missed-tag',
        tag,
        message: 'unknown or missing macro',
      });
    }

    writeSuccess(text);
    process.exit(0);
  } catch (e) {
    safeAppendLog({
      level: 'error',
      event: 'UserPromptSubmit',
      message: e.message,
      stack: e.stack,
    });
    process.exit(0);
  }
}

main();
