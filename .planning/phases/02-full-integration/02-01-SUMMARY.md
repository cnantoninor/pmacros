---
phase: "02"
plan: "01"
subsystem: "macros-store, paths, hook"
tags: [project-macros, merge, paths, hook, stor-02]
dependency_graph:
  requires: []
  provides: [getMergedMacrosSync, getProjectMacrosPath, tryReadMacrosFile, mergeMacroMaps]
  affects: [hooks/user-prompt-submit.cjs, lib/macros-store.cjs, lib/paths.cjs]
tech_stack:
  added: []
  patterns: [non-throwing-reader, project-overrides-user-merge, cwd-resolution-from-event]
key_files:
  created: [test/merge-macros.test.cjs]
  modified: [lib/paths.cjs, lib/macros-store.cjs, hooks/user-prompt-submit.cjs]
decisions:
  - "tryReadMacrosFile returns ok:true with defaultData for missing files (not an error)"
  - "getMergedMacrosSync returns userResult/projectResult so hook can log warnings per side"
  - "cwd resolution order: event.cwd > event.workspaceRoot > process.cwd()"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-22T23:37:17Z"
  tasks_completed: 3
  files_changed: 4
---

# Phase 2 Plan 01: Project/user merge — paths, safe reads, hook expansion — Summary

## One-liner

Project-level `.claude/pmacros/macros.json` now merges with user macros (project wins on collision) via `getMergedMacrosSync`, using `tryReadMacrosFile` so one corrupt side never silences the other.

## What Was Built

### lib/paths.cjs

Added `getProjectMacrosPath(cwd)` — returns `path.join(path.resolve(cwd), '.claude', 'pmacros', 'macros.json')`. Resolves the project-level macros file path from any given working directory.

### lib/macros-store.cjs

Three new exports:

- **`tryReadMacrosFile(macrosPath)`** — non-throwing reader. Returns `{ ok: true, data }` on success (missing file treated as empty, not error) or `{ ok: false, code, message }` on parse/shape errors. Never throws.
- **`mergeMacroMaps(userMacros, projectMacros)`** — spreads user map then project map so project keys override user keys on collision. Pure function.
- **`getMergedMacrosSync(cwd)`** — orchestrates both reads via `tryReadMacrosFile`, merges, and returns `{ macros, userPath, projectPath, userResult, projectResult }`. The caller (hook) can inspect per-side results for warning logging.

All existing exports (`readMacrosSync`, `writeMacrosAtomic`, `upsertMacro`) unchanged for Phase 1 CLI backward compatibility.

### hooks/user-prompt-submit.cjs

- Replaced `readMacrosSync()` with `getMergedMacrosSync(cwd)`.
- Added `cwd` resolution: `event.cwd` first, then `event.workspaceRoot`, then `process.cwd()` (D-02 from CONTEXT.md).
- Logs `warn` for any failed macro side (path only, never macro values) via `safeAppendLog`.
- Hook still always exits 0 on all paths.

### test/merge-macros.test.cjs (new)

19 → 23 tests total (4 new test files worth). Covers:
- `mergeMacroMaps`: both keys present; project wins on same tag
- `tryReadMacrosFile`: missing file, invalid JSON, valid file
- `getMergedMacrosSync`: corrupt user + valid project; missing project
- Hook integration: project override via `cwd` field; override via `workspaceRoot` field

## Verification

```
npm test → 23 pass, 0 fail
```

All three plan-level must_haves confirmed:
1. Project `.claude/pmacros/macros.json` overrides user macros for same tag — STOR-02 delivered.
2. One corrupt JSON side does not blank the other — D-01 satisfied via `tryReadMacrosFile`.
3. Hook exits `0` on all paths — maintained throughout.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| T1 | 8602c1a | feat(02-01): add project path helper and macro merge functions |
| T2 | cfddae5 | feat(02-01): update hook to use merged macros with cwd resolution |
| T3 | 281830e | test(02-01): add merge-macros tests and hook project override tests |

## Deviations from Plan

**1. [Rule 2 - Missing critical functionality] Expose userResult/projectResult on getMergedMacrosSync return value**

- **Found during:** T2 implementation
- **Issue:** The plan said to optionally log warnings for failed sides inside the hook, but `getMergedMacrosSync` only returned `{ macros, userPath, projectPath }`. To avoid re-reading files, the per-side result needs to be passed back.
- **Fix:** Added `userResult` and `projectResult` to the return value of `getMergedMacrosSync`. This allows the hook to check each side without re-reading — cleaner separation.
- **Files modified:** lib/macros-store.cjs, hooks/user-prompt-submit.cjs

None of the deviations changed architecture or required a Rule 4 pause.

## Known Stubs

None. All merged macro data flows from real files on disk to hook expansion to `updatedPrompt` in hook stdout.

## Threat Flags

No new network endpoints, auth paths, or trust boundary expansions. The project macros path is derived exclusively from `path.resolve(cwd)` + a fixed suffix — no user-controlled path segments after the root (T-02-03 mitigated).

## Self-Check: PASSED

All files confirmed present on disk. All three task commits (8602c1a, cfddae5, 281830e) confirmed in git log. npm test: 23 pass, 0 fail.
