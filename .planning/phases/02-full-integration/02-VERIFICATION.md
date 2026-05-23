---
phase: 02-full-integration
verified: 2026-05-22T00:00:00Z
status: gaps_found
score: 3/4 must-haves verified
overrides_applied: 0
gaps:
  - truth: "CI runs tests on Linux and macOS (INST-03)"
    status: failed
    reason: ".github/workflows/ci.yml does not exist — Plan 04 was not executed (ROADMAP marks 02-04-PLAN.md unchecked)"
    artifacts:
      - path: ".github/workflows/ci.yml"
        issue: "File missing — .github directory does not exist"
    missing:
      - "Create .github/workflows/ci.yml with matrix: [ubuntu-latest, macos-latest], node-version: ['20.x'], running npm test"
  - truth: "New users can discover install + project macros from README (Plan 04 discoverability)"
    status: failed
    reason: "README.md says 'There is no install.js yet' and describes Phase 2 as '(planned)'. The manual setup section still refers to Phase 1 only. No 'Install (Phase 2)' section was added documenting 'node install.js', '--force', lock file, or '--project' flag."
    artifacts:
      - path: "README.md"
        issue: "Line 21: 'There is no install.js yet'; line 60: 'Phase 2 (planned)' — both are stale and contradicted by the actual codebase"
      - path: "docs/MANUAL-SETUP-PHASE1.md"
        issue: "Line 3: says 'Phase 1 does not ship install.js yet'; line 76: 'Phase 2 will automate... via install.js' — both contradict current codebase state"
    missing:
      - "Update README.md: replace 'There is no install.js yet' section with 'Install (Phase 2)' documenting 'node install.js', '--force', lock file, project macros, /pmacro-update, /pmacro-remove"
      - "Update docs/MANUAL-SETUP-PHASE1.md: note that 'node install.js' is now available; mention statusLine.command registration outcome"
---

# Phase 2: Full Integration — Verification Report

**Phase Goal:** pmacros is fully operational in Claude Code with project scopes, complete CRUD, cross-platform install, and status line visibility
**Verified:** 2026-05-22
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can update or remove any macro by tag name via `/pmacro-update` and `/pmacro-remove` | VERIFIED | `.claude/skills/pmacro-update/SKILL.md` and `.claude/skills/pmacro-remove/SKILL.md` exist with `disable-model-invocation: true` and invoke `node <REPO>/scripts/pmacro.cjs update/remove`. CLI has `case 'update'` and `case 'remove'` backed by `updateMacroAtPath`/`removeMacroAtPath` in `lib/macros-store.cjs`. 40/40 tests pass. |
| 2 | A project-level macro at `.claude/pmacros/macros.json` overrides the same-named user-level macro during expansion | VERIFIED | `lib/paths.cjs` exports `getProjectMacrosPath(cwd)`. `lib/macros-store.cjs` exports `tryReadMacrosFile`, `mergeMacroMaps`, `getMergedMacrosSync`. `hooks/user-prompt-submit.cjs` uses `getMergedMacrosSync(cwd)` with `event.cwd > event.workspaceRoot > process.cwd()` resolution. One corrupt side does not blank the other. Tests verified in `test/merge-macros.test.cjs`. |
| 3 | Running `node install.js` registers the hook and copies skill files idempotently — safe to re-run on all three platforms (Linux, macOS, WSL2) | VERIFIED (partial — see INST-03 gap) | `install.js` exists at repo root. Merges `hooks.UserPromptSubmit` without duplicates (dedup via `alreadyRegistered` check). Sets `statusLine.command`. Copies `pmacro-*` skill dirs with `.pmacros-backup.<ts>` if content differs. Atomic write via temp+rename. Lock file at `.claude/.pmacros-installed`; `--force` bypasses. `test/install.test.cjs` passes (6 tests). Platform coverage: Linux verified by test suite; macOS/WSL2 not validated by CI (INST-03 gap). |
| 4 | The Claude Code status line shows available macro tag names and updates immediately when macros change | VERIFIED | `scripts/pmacro-statusline.cjs` exists, calls `getMergedMacrosSync(cwd)`, sorts tag keys, joins with spaces, truncates at 120 chars with `…`, always exits 0. Registered via `install.js` as `statusLine.command`. `test/pmacro-statusline.test.cjs` passes (5 tests). Script produces output on invocation (confirmed by spot-check). |

**Score:** 3/4 truths fully verified (INST-03 automated cross-platform coverage and Plan 04 docs are gaps)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/paths.cjs` — `getProjectMacrosPath` | Project path helper | VERIFIED | Exports `getProjectMacrosPath(cwd)` returning `path.join(path.resolve(cwd), '.claude', 'pmacros', 'macros.json')` |
| `lib/macros-store.cjs` — merge helpers | `tryReadMacrosFile`, `mergeMacroMaps`, `getMergedMacrosSync` | VERIFIED | All three functions exported and substantive; `getMergedMacrosSync` returns `{ macros, userPath, projectPath, userResult, projectResult }` |
| `lib/macros-store.cjs` — CRUD helpers | `readMacrosAtPath`, `writeMacrosAtomicAtPath`, `updateMacroAtPath`, `removeMacroAtPath` | VERIFIED | All four exported; `updateMacroAtPath`/`removeMacroAtPath` both do STOR-04 re-read before write |
| `hooks/user-prompt-submit.cjs` | Uses merged macros, cwd resolution | VERIFIED | Calls `getMergedMacrosSync(cwd)`; cwd from `event.cwd > event.workspaceRoot > process.cwd()` |
| `scripts/pmacro.cjs` — update/remove | CLI subcommands | VERIFIED | `case 'update'` and `case 'remove'` with `--project` flag support via `extractProjectFlag` |
| `scripts/pmacro.cjs` — list/preview | Uses merged macros | VERIFIED | Both `cmdList` and `cmdPreview` call `getMergedMacrosSync(process.cwd())` |
| `.claude/skills/pmacro-update/SKILL.md` | Slash command skill | VERIFIED | Exists; `disable-model-invocation: true`; invokes `pmacro.cjs update`; AskUserQuestion flow |
| `.claude/skills/pmacro-remove/SKILL.md` | Slash command skill | VERIFIED | Exists; `disable-model-invocation: true`; invokes `pmacro.cjs remove`; AskUserQuestion flow |
| `install.js` | Idempotent installer | VERIFIED | Exists; lock file, dedup hook registration, statusLine.command, skill backup-on-diff, atomic write |
| `scripts/pmacro-statusline.cjs` | Status line script | VERIFIED | Exists; calls `getMergedMacrosSync`; sorted tags; 120-char truncation; always exits 0 |
| `test/merge-macros.test.cjs` | Merge function tests | VERIFIED | Exists; covers project override, corrupt-side resilience, hook integration |
| `test/install.test.cjs` | Installer tests | VERIFIED | Exists; covers no-duplicate hook, backup, idempotency |
| `test/pmacro-statusline.test.cjs` | Status line tests | VERIFIED | Exists; covers sorted output, merge, truncation, error resilience |
| `.github/workflows/ci.yml` | CI matrix Linux/macOS | MISSING | File does not exist; `.github/` directory absent |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `hooks/user-prompt-submit.cjs` | `lib/macros-store.cjs` | `getMergedMacrosSync(cwd)` | WIRED | Line 8: `require('../lib/macros-store.cjs')`; line 83: `getMergedMacrosSync(cwd)` called inside try/catch |
| `scripts/pmacro.cjs` | `lib/macros-store.cjs` | `updateMacroAtPath`, `removeMacroAtPath`, `getMergedMacrosSync` | WIRED | All three imported and used in `cmdUpdate`, `cmdRemove`, `cmdList`, `cmdPreview` |
| `scripts/pmacro.cjs` → `cmdUpdate` | `lib/paths.cjs` | `getProjectMacrosPath` | WIRED | `--project` flag routes to `getProjectMacrosPath(process.cwd())` |
| `install.js` | `hooks/user-prompt-submit.cjs` | `settings.hooks.UserPromptSubmit` | WIRED | Builds absolute path to hook script; appends to `UserPromptSubmit` array with dedup |
| `install.js` | `scripts/pmacro-statusline.cjs` | `settings.statusLine.command` | WIRED | Sets `statusLine.command = "node ${statuslineScript}"` |
| `install.js` | `.claude/skills/pmacro-*/SKILL.md` | `copyFileSync` with backup | WIRED | Reads `skillsSrcDir`, copies to `~/.claude/skills/` with backup-on-diff |
| `scripts/pmacro-statusline.cjs` | `lib/macros-store.cjs` | `getMergedMacrosSync(cwd)` | WIRED | Line 7–9: require and call `getMergedMacrosSync(process.cwd())` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `hooks/user-prompt-submit.cjs` | `macros` | `getMergedMacrosSync(cwd)` → `tryReadMacrosFile` → `fs.readFileSync` both paths | Yes — reads actual files from disk | FLOWING |
| `scripts/pmacro-statusline.cjs` | `macros` | `getMergedMacrosSync(cwd)` → same path | Yes — reads actual files | FLOWING |
| `install.js` — hook dedup | `settings.hooks.UserPromptSubmit` | `fs.readFileSync(settingsPath)` then `JSON.parse` | Yes — reads actual settings.json | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Status line exits 0 and produces output | `node scripts/pmacro-statusline.cjs` (no macros) | `test\nExit: 0` | PASS |
| CLI help shows update/remove | `node scripts/pmacro.cjs` | Shows `update [--project] <tag> <value>` and `remove [--project] <tag>` | PASS |
| Test suite passes | `npm test` | 40 pass, 0 fail | PASS |
| CI workflow exists | `ls .github/workflows/ci.yml` | File does not exist | FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CRUD-03 | Plan 02-02 | User can update an existing macro | SATISFIED | `pmacro update` in CLI; `updateMacroAtPath` in store; skill exists |
| CRUD-04 | Plan 02-02 | User can remove a macro by tag name | SATISFIED | `pmacro remove` in CLI; `removeMacroAtPath` in store; skill exists |
| STOR-02 | Plan 02-01 | Project macros override user macros | SATISFIED | `getMergedMacrosSync` implements merge with project-wins semantics; hook wired |
| INST-01 | Plan 02-03 | `node install.js` is idempotent | SATISFIED | Lock file + dedup check; 40/40 tests pass |
| INST-02 | Plan 02-03 | Install creates `.backup` before overwriting differing SKILL.md | SATISFIED | `pmacros-backup.<ts>` pattern confirmed in `install.js` lines 164–169 |
| INST-03 | Plan 02-04 | Install script tested on Linux, macOS, WSL2 | BLOCKED | No `.github/workflows/ci.yml` — Plan 04 not executed; only local test run (Linux/WSL2 only) |
| UX-01 | Plan 02-03 | Status line shows available macro tag names | SATISFIED | `pmacro-statusline.cjs` wired via `install.js`; sorts and prints merged tags |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `README.md` | 21 | "There is no `install.js` yet" | Warning | Misleads users; `install.js` exists and works |
| `README.md` | 60 | "Phase 2 (planned)" | Warning | Phase 2 Plans 01-03 are complete; only Plan 04 is pending |
| `docs/MANUAL-SETUP-PHASE1.md` | 3 | "Phase 1 does not ship install.js yet" | Warning | Stale — `install.js` was delivered in Plan 02-03 |
| `docs/MANUAL-SETUP-PHASE1.md` | 76 | "Phase 2 will automate... via install.js" | Warning | Still future-tense; should say automation is now available |
| `.planning/ROADMAP.md` | Phase 2 table | Phase 2 shows "0/4 plans, Planned, -" | Info | Plans 01-03 are complete; only Plan 04 remains; table not updated after execution |

No anti-patterns found in the core implementation files (`lib/`, `hooks/`, `scripts/`). The stale documentation does not block macro expansion or installation — it only misleads discoverability.

### Human Verification Required

#### 1. Status line updates immediately when macros change

**Test:** Add a macro (`node scripts/pmacro.cjs add foo bar`), then observe whether the Claude Code status bar refreshes without restarting the editor.
**Expected:** Tag `foo` appears in the status bar within seconds of the add command.
**Why human:** Status line refresh timing depends on Claude Code polling interval — cannot verify programmatically without a running Claude Code instance.

#### 2. Hook expansion with real project override in Claude Code

**Test:** Create `.claude/pmacros/macros.json` with a tag that overrides a same-named user macro, then type `{{tagname}}` in a Claude Code prompt and submit.
**Expected:** The project value (not the user value) appears in what Claude receives.
**Why human:** Requires a running Claude Code session with the hook registered.

### Gaps Summary

Two gaps block full goal achievement:

**Gap 1 — INST-03: No CI workflow (critical for cross-platform claim)**
Plan 04 was not executed. The `.github/` directory does not exist. The INST-03 requirement ("tested and working on Linux, macOS, and WSL2") relies entirely on automated CI to validate macOS coverage. The current test suite runs only locally (Linux/WSL2). Without the CI matrix, the "cross-platform install" claim in the phase goal cannot be verified. This is the primary blocking gap.

**Gap 2 — Documentation not updated for Phase 2 delivery**
README.md and docs/MANUAL-SETUP-PHASE1.md were not updated by Plan 04. They still describe Phase 2 features as future/planned and say `install.js` does not exist yet. This contradicts the codebase, blocks discoverability for new users, and was an explicit Plan 04 acceptance criterion. While this does not block the technical behaviors, it is a deliverable that the plan claimed and did not complete.

Both gaps stem from the same root cause: Plan 04 (02-04-PLAN.md) was not executed. The ROADMAP.md itself marks `02-04-PLAN.md` as `[ ]` (unchecked), confirming this.

---

_Verified: 2026-05-22_
_Verifier: Claude (gsd-verifier)_
