---
phase: 02-full-integration
plan: "02"
subsystem: cli
tags: [node, cjs, macros, crud, skills, project-scope]

# Dependency graph
requires:
  - phase: 02-01
    provides: getMergedMacrosSync, getProjectMacrosPath, project-macro merge logic

provides:
  - pmacro update subcommand (user and project scope via --project)
  - pmacro remove subcommand (user and project scope via --project)
  - merged list/preview commands — CLI now reflects effective (merged) macro set
  - readMacrosAtPath / writeMacrosAtomicAtPath — parameterized atomic I/O helpers
  - updateMacroAtPath / removeMacroAtPath — scope-targeted CRUD with STOR-04 re-read
  - pmacro-update and pmacro-remove slash command skills

affects:
  - 02-03 (install script)
  - 02-04 (status line / end-to-end verification)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "STOR-04 pattern: re-read file immediately before every write on mutation paths"
    - "--project flag extraction before positional arg parsing (extractProjectFlag helper)"
    - "Parameterized atomic write (writeMacrosAtomicAtPath) reuses temp+rename idiom with caller-supplied path"

key-files:
  created:
    - .claude/skills/pmacro-update/SKILL.md
    - .claude/skills/pmacro-remove/SKILL.md
  modified:
    - lib/macros-store.cjs
    - scripts/pmacro.cjs
    - test/pmacro-cli.test.cjs

key-decisions:
  - "update requires existing tag (CRUD-03 = update, not upsert); add handles creation"
  - "STOR-04 enforced in readMacrosAtPath call inside updateMacroAtPath and removeMacroAtPath before every write"
  - "list and preview now use getMergedMacrosSync(cwd) so CLI output matches hook expansion"
  - "--project flag resolved to getProjectMacrosPath(process.cwd()) for scoped mutations"

patterns-established:
  - "extractProjectFlag: strip --project from argv before positional parsing"
  - "runIn test helper: run CLI with explicit cwd for project-scope integration tests"

requirements-completed:
  - CRUD-03
  - CRUD-04
  - STOR-04

# Metrics
duration: ~15min
completed: 2026-05-22
---

# Phase 2 Plan 02: `pmacro update` / `pmacro remove`, merged list/preview, skills Summary

**`pmacro update` and `pmacro remove` CLI subcommands with `--project` scope flag, STOR-04 re-read-before-write, merged `list`/`preview` output, and `/pmacro-update` + `/pmacro-remove` slash command skills**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-22T23:30:00Z
- **Completed:** 2026-05-22T23:43:58Z
- **Tasks:** 4
- **Files modified:** 5

## Accomplishments

- Added `readMacrosAtPath`, `writeMacrosAtomicAtPath`, `updateMacroAtPath`, `removeMacroAtPath` to `lib/macros-store.cjs` — parameterized scope-targeted CRUD with STOR-04 compliance
- Implemented `pmacro update [--project] <tag> <value> [description...]` and `pmacro remove [--project] <tag>` in `scripts/pmacro.cjs`; `list` and `preview` now use merged macros
- Extended test suite with 5 new integration tests (28 total, all passing): update success, update-missing-tag non-zero exit, remove success, remove-project scope isolation, preview project override
- Added `/pmacro-update` and `/pmacro-remove` slash command skills with AskUserQuestion flow and `--project` guidance

## Task Commits

1. **T1: macros-store scope helpers** - `e0bfe69` (feat)
2. **T2: CLI update/remove/merged list/preview** - `732c067` (feat)
3. **T3: CLI integration tests** - `9a7d8f7` (test)
4. **T4: pmacro-update and pmacro-remove skills** - `890dd31` (feat)

## Files Created/Modified

- `lib/macros-store.cjs` - Added readMacrosAtPath, writeMacrosAtomicAtPath, updateMacroAtPath, removeMacroAtPath; exported all new helpers
- `scripts/pmacro.cjs` - Added cmdUpdate, cmdRemove, extractProjectFlag; updated cmdList/cmdPreview to use getMergedMacrosSync; updated imports and usage string
- `test/pmacro-cli.test.cjs` - Added runIn helper and 5 new integration tests for update/remove/merged preview
- `.claude/skills/pmacro-update/SKILL.md` - Slash command skill for updating macros (new file)
- `.claude/skills/pmacro-remove/SKILL.md` - Slash command skill for removing macros (new file)

## Decisions Made

- `update` requires the tag to exist (CRUD-03 = update existing, not upsert) — `add` handles creation; error message says "not found" with non-zero exit
- STOR-04 enforced by always calling `readMacrosAtPath` inside `updateMacroAtPath` and `removeMacroAtPath` immediately before writing, not at call-site
- `list` and `preview` now use `getMergedMacrosSync(process.cwd())` so the CLI reflects exactly what the hook will expand — consistent UX
- `--project` flag extracted before positional argv parsing via `extractProjectFlag` helper to keep cmdUpdate/cmdRemove argument indexing clean

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all new commands are fully wired to storage.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Skills must be copied to `~/.claude/skills/` per `docs/MANUAL-SETUP-PHASE1.md` (existing manual process).

## Next Phase Readiness

- CRUD-03 and CRUD-04 fully implemented and tested
- `list`/`preview` reflect merged macro set — CLI now consistent with hook behavior
- Phase 02-03 (install script) can reference the complete CLI surface: add, list, preview, update, remove, status
- Phase 02-04 (end-to-end verification) can exercise all subcommands including project-scoped mutations

---
*Phase: 02-full-integration*
*Completed: 2026-05-22*
