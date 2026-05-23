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

/**
 * Returns the path to the project-level macros file.
 * @param {string} cwd - The project root directory.
 * @returns {string}
 */
function getProjectMacrosPath(cwd) {
  return path.join(path.resolve(cwd), '.claude', 'pmacros', 'macros.json');
}

module.exports = {
  getPmacrosDir,
  getMacrosPath,
  getHookErrorsLogPath,
  getProjectMacrosPath,
};
