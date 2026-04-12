'use strict';

const path = require('path');
const os = require('os');

function getPmacrosDir() {
  return path.join(os.homedir(), '.claude', 'pmacros');
}

function getMacrosPath() {
  return path.join(getPmacrosDir(), 'macros.json');
}

function getHookErrorsLogPath() {
  return path.join(getPmacrosDir(), 'hook-errors.log');
}

module.exports = {
  getPmacrosDir,
  getMacrosPath,
  getHookErrorsLogPath,
};
