'use strict';

const fs = require('fs');
const path = require('path');
const { getHookErrorsLogPath } = require('./paths.cjs');

/**
 * Append one JSONL record to hook-errors.log. D-13: rotation deferred; growth unbounded in Phase 1.
 * @param {{ level?: string, event: string, tag?: string, message: string, stack?: string }} entry
 */
function appendLog(entry) {
  const { level = 'info', event, tag, message, stack } = entry;
  const ts = new Date().toISOString();
  const record = { ts, level, event, message };
  if (tag !== undefined && tag !== null && tag !== '') {
    record.tag = tag;
  }
  if (stack) {
    record.stack = stack;
  }
  const line = JSON.stringify(record);
  const logPath = getHookErrorsLogPath();
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${line}\n`, 'utf8');
}

module.exports = { appendLog };
