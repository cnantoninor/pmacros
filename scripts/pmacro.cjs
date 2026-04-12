#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const libDir = path.join(__dirname, '..', 'lib');
const { upsertMacro, readMacrosSync, validateTagName } = require(path.join(libDir, 'macros-store.cjs'));
const { expandPrompt } = require(path.join(libDir, 'expand.cjs'));
const { getMacrosPath, getHookErrorsLogPath } = require(path.join(libDir, 'paths.cjs'));

/** T-04-03: avoid OOM from huge macro values */
const MAX_VALUE_LEN = 1024 * 1024;

const MS_24H = 24 * 60 * 60 * 1000;

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function previewCell(s) {
  const t = String(s ?? '');
  if (t.length <= 40) {
    return t;
  }
  return `${t.slice(0, 40)}…`;
}

function cmdAdd(argv) {
  const tag = argv[3];
  const value = argv[4];
  const descParts = argv.slice(5);
  if (!tag || value === undefined) {
    die('usage: pmacro add <tag> <value> [description...]');
  }
  if (!validateTagName(tag)) {
    die('invalid tag name (lowercase letters, digits, hyphens; length 1–32)');
  }
  if (value.length > MAX_VALUE_LEN) {
    die('value exceeds maximum length');
  }
  const description = descParts.length ? descParts.join(' ') : undefined;
  try {
    upsertMacro({ tag, value, description });
  } catch (e) {
    die(e.message || String(e), 1);
  }
}

function cmdList() {
  let data;
  try {
    data = readMacrosSync();
  } catch (e) {
    die(`cannot read macros: ${e.message}`, 1);
  }
  const macros = data.macros || {};
  const keys = Object.keys(macros);
  if (keys.length === 0) {
    console.log('No macros yet — run /pmacro-add');
    return;
  }
  console.log('| tag | description | tokens | value preview |');
  console.log('| --- | --- | --- | --- |');
  for (const tag of keys.sort()) {
    const m = macros[tag];
    const desc = String(m.description ?? '').replace(/\|/g, '\\|');
    const tokens = m.approximateTokens ?? '';
    const prev = previewCell(m.value).replace(/\|/g, '\\|');
    console.log(`| ${tag} | ${desc} | ${tokens} | ${prev} |`);
  }
}

function cmdPreview(argv) {
  const parts = argv.slice(3);
  if (parts.length === 0) {
    die('usage: pmacro preview <prompt words...>');
  }
  const prompt = parts.join(' ');
  let data;
  try {
    data = readMacrosSync();
  } catch (e) {
    die(`cannot read macros: ${e.message}`, 1);
  }
  const { text } = expandPrompt(prompt, data.macros || {});
  console.log('BEFORE:');
  console.log(prompt);
  console.log('AFTER:');
  console.log(text);
}

function parseLogRecord(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function withinLast24h(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) {
    return false;
  }
  return Date.now() - t < MS_24H;
}

function cmdStatusSummary() {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  let hookInstalled = false;
  try {
    const raw = fs.readFileSync(settingsPath, 'utf8');
    hookInstalled =
      raw.includes('user-prompt-submit.cjs') || raw.includes('user-prompt-submit');
  } catch {
    hookInstalled = false;
  }
  console.log(`Hook installed (settings scan): ${hookInstalled ? 'yes' : 'no'}`);

  const macrosPath = getMacrosPath();
  let count = 0;
  try {
    const d = readMacrosSync();
    count = Object.keys(d.macros || {}).length;
  } catch {
    count = 0;
  }
  console.log(`macros.json: ${macrosPath}`);
  console.log(`Macro count: ${count}`);

  const logPath = getHookErrorsLogPath();
  let lastErr = null;
  let lastErrMs = 0;
  let missedTagWarns = 0;
  if (fs.existsSync(logPath)) {
    const body = fs.readFileSync(logPath, 'utf8');
    for (const line of body.split('\n')) {
      if (!line.trim()) {
        continue;
      }
      const rec = parseLogRecord(line);
      if (!rec || !rec.ts) {
        continue;
      }
      if (!withinLast24h(rec.ts)) {
        continue;
      }
      if (rec.level === 'error') {
        const ms = new Date(rec.ts).getTime();
        if (ms >= lastErrMs) {
          lastErrMs = ms;
          lastErr = rec;
        }
      }
      if (rec.level === 'warn' && rec.event === 'missed-tag') {
        missedTagWarns += 1;
      }
    }
  }
  if (lastErr) {
    console.log(`Last error (24h): ${lastErr.ts} — ${lastErr.message}`);
  } else {
    console.log('Last error (24h): none');
  }
  console.log(`Missed-tag warnings (24h): ${missedTagWarns}`);
}

function cmdStatusTail(arg) {
  if (arg === undefined || arg === '') {
    die('usage: pmacro status tail <n|all>');
  }
  const logPath = getHookErrorsLogPath();
  if (!fs.existsSync(logPath)) {
    console.log('(no hook-errors.log)');
    return;
  }
  const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter((l) => l.trim());
  let picked;
  if (arg === 'all') {
    picked = lines;
  } else {
    const n = parseInt(arg, 10);
    if (!Number.isFinite(n) || n < 1) {
      die('usage: pmacro status tail <n|all>');
    }
    picked = lines.slice(-n);
  }
  for (const line of picked) {
    console.log(line);
  }
}

function cmdStatus(argv) {
  if (argv[3] === 'tail') {
    cmdStatusTail(argv[4]);
    return;
  }
  if (argv[3] !== undefined) {
    die('usage: pmacro status [tail <n|all>]');
  }
  cmdStatusSummary();
}

function main(argv) {
  const cmd = argv[2];
  switch (cmd) {
    case 'add':
      cmdAdd(argv);
      break;
    case 'list':
      cmdList();
      break;
    case 'preview':
      cmdPreview(argv);
      break;
    case 'status':
      cmdStatus(argv);
      break;
    default:
      die(
        'usage: pmacro <add|list|preview|status> …\n' +
          '  add <tag> <value> [description...]\n' +
          '  list\n' +
          '  preview <prompt words...>\n' +
          '  status\n' +
          '  status tail <n|all>'
      );
  }
}

main(process.argv);
