---
phase: "02"
plan: "03"
subsystem: installer
tags: [install, statusline, skills, idempotent, hook-registration]
dependency_graph:
  requires: [02-02]
  provides: [install.js, pmacro-statusline.cjs]
  affects: [~/.claude/settings.json, ~/.claude/skills/]
tech_stack:
  added: []
  patterns: [atomic-write-temp-rename, lock-file-idempotency, path-traversal-validation]
key_files:
  created:
    - install.js
    - scripts/pmacro-statusline.cjs
    - test/install.test.cjs
    - test/pmacro-statusline.test.cjs
  modified:
    - .gitignore
decisions:
  - Lock file at .claude/.pmacros-installed; --force bypasses; idempotent skip on second run without force
  - statusLine.command set as absolute path to pmacro-statusline.cjs
  - Path traversal rejected via path.resolve() prefix check before any skill copy
metrics:
  duration_minutes: 25
  completed_date: "2026-05-23"
  tasks_completed: 3
  files_created: 4
  files_modified: 1
---

# Phase 2 Plan 3: install.js, skill backup copy, status line script, lock file — Summary

**One-liner:** Idempotent `install.js` that merges hook + statusLine into `~/.claude/settings.json`, copies skills with backup-on-diff, plus stdlib status line script printing sorted merged tag names.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| T1 | pmacro-statusline.cjs status line script | 0711e64 | scripts/pmacro-statusline.cjs |
| T1-fix | restore planning files deleted by worktree reset | 5171ca0 | .planning/phases/02-full-integration/ |
| T2 | install.js idempotent installer | dfc7379 | install.js, .gitignore |
| T3 | install.test.cjs and pmacro-statusline.test.cjs | 451d1b9 | test/install.test.cjs, test/pmacro-statusline.test.cjs |

## Verification

- `npm test`: 40/40 tests pass (28 existing + 6 install tests + 5 statusline tests + 1 placeholder) — all green
- `node install.js --force`: merges hook and statusLine into `~/.claude/settings.json`, copies skills
- Second run without `--force`: prints "already installed" and exits 0 (idempotent)
- `node scripts/pmacro-statusline.cjs`: prints sorted merged tag names (or empty), always exits 0

## Must-Haves Verification

1. **INST-01 (Idempotency):** `node install.js` merges without duplicating hook entries; second run without `--force` skips entirely via lock file. Test: `install does not duplicate hook on second run`.
2. **INST-02 (Backup before overwrite):** If `~/.claude/skills/<name>/SKILL.md` exists with different content, it is copied to `SKILL.md.pmacros-backup.<ISO-timestamp>` before the new file is written. Test: `install backs up differing SKILL.md before overwrite`.
3. **UX-01 (Status line):** `pmacro-statusline.cjs` calls `getMergedMacrosSync(cwd)`, sorts tag keys, joins with spaces, truncates at 120 chars with `…`. Always exits 0. Test: multiple statusline tests verify sorted output, merge, truncation, error resilience.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree working tree out of sync with HEAD commit**
- **Found during:** Initial setup before T1
- **Issue:** After `git reset --soft eab0136`, working tree files (e.g. `lib/macros-store.cjs`) reflected the old pre-phase-2 state (155 lines) instead of the HEAD commit state (387 lines with `getMergedMacrosSync`). T1 would have failed to reference the correct function.
- **Fix:** Ran `git checkout eab0136 -- lib/ hooks/ scripts/ test/ .claude/skills/` to synchronize working tree.
- **Files modified:** All lib/, hooks/, scripts/, test/, .claude/skills/ files
- **Commit:** 0711e64 (side-effect of first task commit)

**2. [Rule 3 - Blocking] Planning files deleted by worktree reset**
- **Found during:** After T1 commit
- **Issue:** The `git reset --soft` left `.planning/phases/02-full-integration/02-03-PLAN.md` and other plan files as staged deletions; they were included in the T1 commit and removed from the worktree.
- **Fix:** Restored files from the base commit via `git checkout eab0136 -- .planning/phases/02-full-integration/`; committed as separate chore commit.
- **Files modified:** All 02-full-integration plan files
- **Commit:** 5171ca0

## Security Notes

- Path traversal protection: `install.js` validates that all skill source paths stay under `repoRoot/.claude/skills/` using `path.resolve()` prefix check before any `copyFileSync`.
- Settings merge: only `hooks` and `statusLine` keys are modified; all other existing keys in `settings.json` are preserved.
- Atomic write: settings.json written via temp file + `fs.renameSync` (same pattern as macros-store).

## Threat Flag Mitigations Applied

| T-ID | Mitigation |
|------|------------|
| T-03-01 | JSON parse → deep-merge only `hooks`/`statusLine`; atomic write via temp+rename |
| T-03-02 | `validateUnderRoot()` rejects paths with `..` or outside `skillsSrcDir` |

## Self-Check: PASSED

- `install.js`: exists, contains UserPromptSubmit, statusLine, pmacros-backup
- `scripts/pmacro-statusline.cjs`: exists, contains getMergedMacrosSync
- `test/install.test.cjs`: exists
- `test/pmacro-statusline.test.cjs`: exists
- `.gitignore`: contains `.claude/.pmacros-installed`
- Commits verified: 0711e64, 5171ca0, dfc7379, 451d1b9 all present in git log
- `npm test`: 40 pass, 0 fail
