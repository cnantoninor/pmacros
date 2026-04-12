#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const { expandPrompt } = require(path.join(__dirname, '..', 'lib', 'expand.cjs'));
const { readMacrosSync } = require(path.join(__dirname, '..', 'lib', 'macros-store.cjs'));
const { appendLog } = require(path.join(__dirname, '..', 'lib', 'error-log.cjs'));

/** Guard against pathological stdin size (T-03-01). */
const MAX_STDIN_CHARS = 32 * 1024 * 1024;

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
    if (raw.length > MAX_STDIN_CHARS) {
      appendLog({
        level: 'error',
        event: 'UserPromptSubmit',
        message: 'stdin exceeded maximum length',
      });
      process.exit(0);
      return;
    }

    let event;
    try {
      event = JSON.parse(raw);
    } catch (e) {
      appendLog({
        level: 'error',
        event: 'UserPromptSubmit',
        message: `invalid JSON on stdin: ${e.message}`,
        stack: e.stack,
      });
      process.exit(0);
      return;
    }

    const promptText = typeof event.prompt === 'string' ? event.prompt : '';

    let macros = {};
    try {
      const data = readMacrosSync();
      macros = data.macros || {};
    } catch (e) {
      appendLog({
        level: 'error',
        event: 'UserPromptSubmit',
        message: `macros read failed: ${e.message}`,
        stack: e.stack,
      });
      writeSuccess(promptText);
      process.exit(0);
      return;
    }

    const { text, missedTags } = expandPrompt(promptText, macros);
    for (const tag of missedTags) {
      appendLog({
        level: 'warn',
        event: 'missed-tag',
        tag,
        message: 'unknown or missing macro',
      });
    }

    writeSuccess(text);
    process.exit(0);
  } catch (e) {
    appendLog({
      level: 'error',
      event: 'UserPromptSubmit',
      message: e.message,
      stack: e.stack,
    });
    process.exit(0);
  }
}

main();
