#!/usr/bin/env node
'use strict';

/**
 * install.js — Idempotent installer for pmacros.
 *
 * Usage:
 *   node install.js          # Skip if already installed (lock file present)
 *   node install.js --force  # Reinstall even if lock file present
 *
 * What it does:
 *   1. Checks for lock file at <repoRoot>/.claude/.pmacros-installed
 *   2. Merges UserPromptSubmit hook entry into ~/.claude/settings.json (no duplicates)
 *   3. Sets statusLine.command in ~/.claude/settings.json
 *   4. Copies .claude/skills/pmacro-* SKILL.md files to ~/.claude/skills/ (with backup)
 *   5. Writes lock file with timestamp
 *   6. Ensures .gitignore contains .claude/.pmacros-installed
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const repoRoot = path.resolve(__dirname);
const force = process.argv.includes('--force');

// Security: validate that a path stays under its expected root
function validateUnderRoot(targetPath, allowedRoot) {
  const resolved = path.resolve(targetPath);
  const allowedResolved = path.resolve(allowedRoot);
  if (!resolved.startsWith(allowedResolved + path.sep) && resolved !== allowedResolved) {
    throw new Error(`Path traversal rejected: ${resolved} is not under ${allowedResolved}`);
  }
  return resolved;
}

// Paths
const lockFile = path.join(repoRoot, '.claude', '.pmacros-installed');
const hookScript = path.join(repoRoot, 'hooks', 'user-prompt-submit.cjs');
const statuslineScript = path.join(repoRoot, 'scripts', 'pmacro-statusline.cjs');
const claudeDir = path.join(os.homedir(), '.claude');
const settingsPath = path.join(claudeDir, 'settings.json');
const skillsSrcDir = path.join(repoRoot, '.claude', 'skills');
const skillsDestDir = path.join(claudeDir, 'skills');

// Check lock file
if (fs.existsSync(lockFile) && !force) {
  console.log('pmacros already installed. Use --force to reinstall.');
  process.exit(0);
}

// Read existing settings.json or start fresh
let settings = {};
if (fs.existsSync(settingsPath)) {
  try {
    const raw = fs.readFileSync(settingsPath, 'utf8');
    settings = JSON.parse(raw);
  } catch (e) {
    console.error(`Warning: Could not parse ~/.claude/settings.json: ${e.message}`);
    console.error('Starting with empty settings — existing content will be preserved via backup.');
    // Backup the corrupted file
    const backup = settingsPath + `.pmacros-backup.${new Date().toISOString().replace(/[:.]/g, '-')}`;
    try {
      fs.copyFileSync(settingsPath, backup);
      console.log(`Backed up corrupted settings to: ${backup}`);
    } catch (_) { /* ignore backup failure */ }
    settings = {};
  }
}

// Ensure settings is an object (defensive)
if (settings == null || typeof settings !== 'object' || Array.isArray(settings)) {
  settings = {};
}

// Merge UserPromptSubmit hook
// Structure: hooks.UserPromptSubmit = [ { matcher: "", hooks: [ { type: "command", command: "..." } ] } ]
if (!settings.hooks || typeof settings.hooks !== 'object' || Array.isArray(settings.hooks)) {
  settings.hooks = {};
}
if (!Array.isArray(settings.hooks.UserPromptSubmit)) {
  settings.hooks.UserPromptSubmit = [];
}

// Normalize hook command path for comparison (handle trailing slashes, different separators)
const hookCmdNormalized = hookScript.replace(/\\/g, '/');

// Check if our hook is already registered (avoid duplicates)
const hookCommand = `node ${hookScript}`;
const alreadyRegistered = settings.hooks.UserPromptSubmit.some((group) => {
  if (!group || !Array.isArray(group.hooks)) return false;
  return group.hooks.some((h) => {
    if (!h || typeof h.command !== 'string') return false;
    return h.command.replace(/\\/g, '/').includes(hookCmdNormalized);
  });
});

if (!alreadyRegistered) {
  settings.hooks.UserPromptSubmit.push({
    matcher: '',
    hooks: [
      {
        type: 'command',
        command: hookCommand,
      },
    ],
  });
  console.log(`Registered hook: ${hookCommand}`);
} else {
  console.log('Hook already registered (skipping duplicate).');
}

// Set statusLine.command
if (!settings.statusLine || typeof settings.statusLine !== 'object' || Array.isArray(settings.statusLine)) {
  settings.statusLine = {};
}
settings.statusLine.command = `node ${statuslineScript}`;
console.log(`Set statusLine.command: node ${statuslineScript}`);

// Atomic write settings.json (temp + rename)
fs.mkdirSync(claudeDir, { recursive: true });
const settingsTmp = settingsPath + `.tmp.${process.pid}.${Date.now()}`;
try {
  fs.writeFileSync(settingsTmp, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  fs.renameSync(settingsTmp, settingsPath);
  console.log(`Updated: ${settingsPath}`);
} catch (e) {
  try { fs.unlinkSync(settingsTmp); } catch (_) { /* ignore */ }
  console.error(`Failed to write settings.json: ${e.message}`);
  process.exit(1);
}

// Copy skills with backup
if (fs.existsSync(skillsSrcDir)) {
  const skillDirs = fs.readdirSync(skillsSrcDir).filter((name) => {
    // Security: reject names containing '..'
    if (name.includes('..')) return false;
    // Only copy pmacro-* skill directories
    return name.startsWith('pmacro-');
  });

  for (const skillName of skillDirs) {
    const srcSkillDir = path.join(skillsSrcDir, skillName);
    // Security: validate the resolved path stays under skillsSrcDir
    try {
      validateUnderRoot(srcSkillDir, skillsSrcDir);
    } catch (e) {
      console.error(`Skipping ${skillName}: ${e.message}`);
      continue;
    }

    const srcSkillFile = path.join(srcSkillDir, 'SKILL.md');
    if (!fs.existsSync(srcSkillFile)) continue;

    const destSkillDir = path.join(skillsDestDir, skillName);
    const destSkillFile = path.join(destSkillDir, 'SKILL.md');

    fs.mkdirSync(destSkillDir, { recursive: true });

    // Backup existing SKILL.md if content differs
    if (fs.existsSync(destSkillFile)) {
      const srcContent = fs.readFileSync(srcSkillFile, 'utf8');
      const destContent = fs.readFileSync(destSkillFile, 'utf8');
      if (srcContent !== destContent) {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = destSkillFile + `.pmacros-backup.${ts}`;
        fs.copyFileSync(destSkillFile, backupPath);
        console.log(`Backed up differing SKILL.md to: ${backupPath}`);
      }
    }

    fs.copyFileSync(srcSkillFile, destSkillFile);
    console.log(`Copied skill: ${skillName}/SKILL.md → ${destSkillDir}/`);
  }
} else {
  console.log('No .claude/skills/ directory found in repo — skipping skill copy.');
}

// Write lock file
const lockDir = path.dirname(lockFile);
fs.mkdirSync(lockDir, { recursive: true });
fs.writeFileSync(lockFile, JSON.stringify({ version: 1, installedAt: new Date().toISOString() }, null, 2) + '\n', 'utf8');
console.log(`Lock file written: ${lockFile}`);

// Ensure .gitignore contains .claude/.pmacros-installed
const gitignorePath = path.join(repoRoot, '.gitignore');
const lockEntry = '.claude/.pmacros-installed';
let gitignoreContent = '';
if (fs.existsSync(gitignorePath)) {
  gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
}
if (!gitignoreContent.split('\n').some((line) => line.trim() === lockEntry)) {
  const newContent = gitignoreContent.endsWith('\n') || gitignoreContent === ''
    ? gitignoreContent + lockEntry + '\n'
    : gitignoreContent + '\n' + lockEntry + '\n';
  fs.writeFileSync(gitignorePath, newContent, 'utf8');
  console.log(`Added ${lockEntry} to .gitignore`);
}

console.log('\npmacros installation complete!');
