'use strict';

const fs = require('fs');
const path = require('path');
const { getMacrosPath, getPmacrosDir, getProjectMacrosPath } = require('./paths.cjs');

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

/**
 * Non-throwing version of readMacrosSync for a given path.
 * Returns { ok: true, data } on success or { ok: false, code, message } on failure.
 * Missing file or empty file → ok: true with defaultData().
 * @param {string} macrosPath
 * @returns {{ ok: true, data: { schemaVersion: number, macros: Record<string, object> } } | { ok: false, code: string, message: string }}
 */
function tryReadMacrosFile(macrosPath) {
  if (!fs.existsSync(macrosPath)) {
    return { ok: true, data: defaultData() };
  }
  let raw;
  try {
    raw = fs.readFileSync(macrosPath, 'utf8');
  } catch (e) {
    return { ok: false, code: 'MACROS_READ_ERROR', message: `Failed to read macros from ${macrosPath}: ${e.message}` };
  }
  if (!raw || raw.trim() === '') {
    return { ok: true, data: defaultData() };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { ok: false, code: 'INVALID_MACROS_JSON', message: `Invalid JSON in macros file at ${macrosPath}: ${e.message}` };
  }
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, code: 'INVALID_MACROS_SHAPE', message: `macros.json at ${macrosPath} must be a JSON object` };
  }
  if (typeof parsed.schemaVersion !== 'number') {
    return { ok: false, code: 'INVALID_MACROS_SHAPE', message: `macros.json at ${macrosPath} missing numeric schemaVersion` };
  }
  if (parsed.macros == null || typeof parsed.macros !== 'object' || Array.isArray(parsed.macros)) {
    return { ok: false, code: 'INVALID_MACROS_SHAPE', message: `macros.json at ${macrosPath} macros must be an object` };
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
  return { ok: true, data: { schemaVersion: parsed.schemaVersion, macros } };
}

/**
 * Merges user and project macro maps. Project keys override user keys on collision.
 * @param {Record<string, object>} userMacros
 * @param {Record<string, object>} projectMacros
 * @returns {Record<string, object>}
 */
function mergeMacroMaps(userMacros, projectMacros) {
  return { ...userMacros, ...projectMacros };
}

/**
 * Loads and merges user and project macros. Project overrides user on collision.
 * Uses tryReadMacrosFile for each side — one bad file does not prevent the other from loading.
 * @param {string} cwd - The project root directory.
 * @returns {{ macros: Record<string, object>, userPath: string, projectPath: string }}
 */
function getMergedMacrosSync(cwd) {
  const userPath = getMacrosPath();
  const projectPath = getProjectMacrosPath(cwd);

  const userResult = tryReadMacrosFile(userPath);
  const projectResult = tryReadMacrosFile(projectPath);

  const userMacros = userResult.ok ? (userResult.data.macros || {}) : {};
  const projectMacros = projectResult.ok ? (projectResult.data.macros || {}) : {};

  const macros = mergeMacroMaps(userMacros, projectMacros);

  return { macros, userPath, projectPath, userResult, projectResult };
}

/**
 * Reads macros from a given path, throwing on invalid JSON or missing schemaVersion.
 * Missing file returns defaultData().
 * @param {string} macrosPath
 * @returns {{ schemaVersion: number, macros: Record<string, object> }}
 */
function readMacrosAtPath(macrosPath) {
  if (!fs.existsSync(macrosPath)) {
    return defaultData();
  }
  let raw;
  try {
    raw = fs.readFileSync(macrosPath, 'utf8');
  } catch (e) {
    const err = new Error(`Failed to read macros from ${macrosPath}: ${e.message}`);
    err.code = 'MACROS_READ_ERROR';
    err.cause = e;
    throw err;
  }
  if (!raw || raw.trim() === '') {
    return defaultData();
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    const err = new Error(`Invalid JSON in macros file at ${macrosPath}: ${e.message}`);
    err.code = 'INVALID_MACROS_JSON';
    err.cause = e;
    throw err;
  }
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    const err = new Error(`macros.json at ${macrosPath} must be a JSON object`);
    err.code = 'INVALID_MACROS_SHAPE';
    throw err;
  }
  if (typeof parsed.schemaVersion !== 'number') {
    const err = new Error(`macros.json at ${macrosPath} missing numeric schemaVersion`);
    err.code = 'INVALID_MACROS_SHAPE';
    throw err;
  }
  if (parsed.macros == null || typeof parsed.macros !== 'object' || Array.isArray(parsed.macros)) {
    const err = new Error(`macros.json at ${macrosPath} macros must be an object`);
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
 * Atomically writes macros data to a given path (same temp+rename as writeMacrosAtomic).
 * @param {string} macrosPath
 * @param {{ schemaVersion: number, macros: Record<string, unknown> }} data
 */
function writeMacrosAtomicAtPath(macrosPath, data) {
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
 * Updates an existing macro at the given path. Throws with code 'NOT_FOUND' if tag absent.
 * Re-reads file before writing (STOR-04).
 * @param {{ macrosPath: string, tag: string, value: string, description?: string }} spec
 */
function updateMacroAtPath({ macrosPath, tag, value, description }) {
  if (!validateTagName(tag)) {
    throw Object.assign(new Error('Invalid macro tag name'), { code: 'INVALID_TAG' });
  }
  if (typeof value !== 'string') {
    throw Object.assign(new Error('Macro value must be a string'), { code: 'INVALID_VALUE' });
  }
  // STOR-04: re-read immediately before write
  const data = readMacrosAtPath(macrosPath);
  if (!Object.prototype.hasOwnProperty.call(data.macros, tag)) {
    throw Object.assign(new Error(`Macro '${tag}' not found`), { code: 'NOT_FOUND' });
  }
  const entry = { value };
  if (description != null && description !== '') {
    entry.description = String(description);
  }
  const next = {
    schemaVersion: data.schemaVersion,
    macros: { ...data.macros, [tag]: entry },
  };
  writeMacrosAtomicAtPath(macrosPath, next);
}

/**
 * Removes a macro at the given path. Throws with code 'NOT_FOUND' if tag absent.
 * Re-reads file before writing (STOR-04).
 * @param {{ macrosPath: string, tag: string }} spec
 */
function removeMacroAtPath({ macrosPath, tag }) {
  if (!validateTagName(tag)) {
    throw Object.assign(new Error('Invalid macro tag name'), { code: 'INVALID_TAG' });
  }
  // STOR-04: re-read immediately before write
  const data = readMacrosAtPath(macrosPath);
  if (!Object.prototype.hasOwnProperty.call(data.macros, tag)) {
    throw Object.assign(new Error(`Macro '${tag}' not found`), { code: 'NOT_FOUND' });
  }
  const macros = { ...data.macros };
  delete macros[tag];
  const next = { schemaVersion: data.schemaVersion, macros };
  writeMacrosAtomicAtPath(macrosPath, next);
}

module.exports = {
  validateTagName,
  readMacrosSync,
  writeMacrosAtomic,
  upsertMacro,
  tryReadMacrosFile,
  mergeMacroMaps,
  getMergedMacrosSync,
  readMacrosAtPath,
  writeMacrosAtomicAtPath,
  updateMacroAtPath,
  removeMacroAtPath,
};
