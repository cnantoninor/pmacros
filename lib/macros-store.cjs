'use strict';

const fs = require('fs');
const path = require('path');
const { getMacrosPath, getPmacrosDir } = require('./paths.cjs');

const TAG_RE = /^[a-z0-9-]{1,32}$/;

function validateTagName(tag) {
  return typeof tag === 'string' && TAG_RE.test(tag);
}

function defaultData() {
  return { schemaVersion: 1, macros: {} };
}

function normalizeEntry(entry) {
  if (entry == null || typeof entry !== 'object') {
    return null;
  }
  if (typeof entry.value !== 'string') {
    return null;
  }
  const out = {
    value: entry.value,
    approximateTokens: Math.ceil(entry.value.length / 4),
  };
  if (entry.description != null && entry.description !== '') {
    out.description = String(entry.description);
  }
  return out;
}

/**
 * @returns {{ schemaVersion: number, macros: Record<string, { value: string, description?: string, approximateTokens: number }> }}
 */
function readMacrosSync() {
  const macrosPath = getMacrosPath();
  if (!fs.existsSync(macrosPath)) {
    return defaultData();
  }
  let raw;
  try {
    raw = fs.readFileSync(macrosPath, 'utf8');
  } catch (e) {
    const err = new Error(`Failed to read macros: ${e.message}`);
    err.code = 'MACROS_READ_ERROR';
    err.cause = e;
    throw err;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    const err = new Error(`Invalid JSON in macros file: ${e.message}`);
    err.code = 'INVALID_MACROS_JSON';
    err.cause = e;
    throw err;
  }
  if (parsed == null || typeof parsed !== 'object') {
    const err = new Error('macros.json must be a JSON object');
    err.code = 'INVALID_MACROS_SHAPE';
    throw err;
  }
  if (typeof parsed.schemaVersion !== 'number') {
    const err = new Error('macros.json missing numeric schemaVersion');
    err.code = 'INVALID_MACROS_SHAPE';
    throw err;
  }
  if (parsed.macros == null || typeof parsed.macros !== 'object' || Array.isArray(parsed.macros)) {
    const err = new Error('macros.json macros must be an object');
    err.code = 'INVALID_MACROS_SHAPE';
    throw err;
  }
  const macros = {};
  for (const [tag, entry] of Object.entries(parsed.macros)) {
    if (!validateTagName(tag)) {
      continue;
    }
    const normalized = normalizeEntry(entry);
    if (normalized) {
      macros[tag] = normalized;
    }
  }
  return { schemaVersion: parsed.schemaVersion, macros };
}

/**
 * @param {{ schemaVersion: number, macros: Record<string, unknown> }} data
 */
function writeMacrosAtomic(data) {
  if (data == null || typeof data !== 'object') {
    throw Object.assign(new Error('Invalid macros data'), { code: 'INVALID_MACROS_SHAPE' });
  }
  const schemaVersion = typeof data.schemaVersion === 'number' ? data.schemaVersion : 1;
  const macros = {};
  if (data.macros != null && typeof data.macros === 'object' && !Array.isArray(data.macros)) {
    for (const [tag, entry] of Object.entries(data.macros)) {
      if (!validateTagName(tag)) {
        continue;
      }
      const normalized = normalizeEntry(entry);
      if (normalized) {
        macros[tag] = normalized;
      }
    }
  }
  const out = { schemaVersion, macros };
  const macrosPath = getMacrosPath();
  const dir = path.dirname(macrosPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `macros.json.tmp.${process.pid}.${Date.now()}`);
  try {
    fs.writeFileSync(tmp, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
    fs.renameSync(tmp, macrosPath);
  } catch (e) {
    try {
      fs.unlinkSync(tmp);
    } catch (_) {
      /* ignore */
    }
    throw e;
  }
}

/**
 * @param {{ tag: string, value: string, description?: string }} spec
 */
function upsertMacro(spec) {
  const { tag, value, description } = spec;
  if (!validateTagName(tag)) {
    throw Object.assign(new Error('Invalid macro tag name'), { code: 'INVALID_TAG' });
  }
  if (typeof value !== 'string') {
    throw Object.assign(new Error('Macro value must be a string'), { code: 'INVALID_VALUE' });
  }
  const data = readMacrosSync();
  const next = {
    schemaVersion: data.schemaVersion,
    macros: { ...data.macros },
  };
  const entry = { value };
  if (description != null && description !== '') {
    entry.description = String(description);
  }
  next.macros[tag] = entry;
  writeMacrosAtomic(next);
}

module.exports = {
  validateTagName,
  readMacrosSync,
  writeMacrosAtomic,
  upsertMacro,
};
