# Phase 2: Full Integration - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 completes Claude Code integration beyond the Phase 1 user-only loop:

- **STOR-02:** Project-level macros at `.claude/pmacros/macros.json` merge with user macros; **project wins** on same tag name (per `PROJECT.md` Key Decisions).
- **CRUD-03 / CRUD-04:** `/pmacro-update` and `/pmacro-remove` (skills + `scripts/pmacro.cjs`) with the same validation, atomic write, and error-safety patterns as add/list.
- **INST-01–INST-03:** `node install.js` — idempotent hook registration in `~/.claude/settings.json`, skill copy to `~/.claude/skills/`, cross-platform behavior (Linux, macOS, WSL2), backups per INST-02.
- **UX-01:** Status line command (stdlib-only Node) surfaces available macro **tag names** from the **merged** macro set, updating whenever the status line runs (no separate daemon).

**Out of scope for Phase 2:** v2 injection modes (auto/start/end), nested macros, per-macro slash commands, log rotation unless pulled in as a small follow-up to D-13 (not required by ROADMAP success criteria).

</domain>

<decisions>
## Implementation Decisions

### Scope merge (STOR-02)
- **D-01:** [auto] Maintain a single **merge helper** used by the hook, CLI preview/expansion paths, and the status line script: load user `~/.claude/pmacros/macros.json` and project `.claude/pmacros/macros.json` (if present and readable), shallow-merge `macros` objects with **project keys overwriting user keys** for collisions. Invalid or missing files behave like Phase 1 (empty object for that side); merge must not throw on one bad file if the other is valid (log hook errors per EXPN-02/03 pattern where appropriate).
- **D-02:** [auto] **Project root** for resolving `.claude/pmacros/macros.json`: prefer a field on the hook stdin event if Claude Code documents one for “workspace root”; otherwise use `process.cwd()` at hook invocation time and document that limitation in install/docs. Status line script uses the same resolution strategy so tags match what the hook expands.

### `/pmacro-update` and `/pmacro-remove` (CRUD-03, CRUD-04)
- **D-03:** [auto] Extend `scripts/pmacro.cjs` with `update` and `remove` subcommands; mirror Phase 1 hybrid UX (args when provided, else `AskUserQuestion` flow in skills). **Update** may change `value` and optional `description`; **remove** deletes the tag key. Tag names validated with existing `validateTagName` rules.
- **D-04:** [auto] All writes remain **atomic** (temp + `renameSync`) and target the **correct scope**: default user path; when a project file exists and the command is run **in project context**, update/remove affect **project** macros if the tag exists there, else user (planner may refine “project context” detection — e.g. presence of `.claude/pmacros` or cwd). [auto] Recommended default: **user-scope only** for v1 Phase 2 CLI unless cwd is under a repo with `.claude/pmacros/macros.json`, then allow explicit `--project` flag — **Claude discretion** to pick the smallest clear UX; document in PLAN.
- **D-05:** [auto] Re-read before write on CRUD paths continues STOR-04 discipline from Phase 1.

### `install.js` (INST-01, INST-02, INST-03)
- **D-06:** [auto] **Idempotent**: safe to re-run; merge hook entry into `hooks.UserPromptSubmit` (or documented Claude Code key) without removing unrelated hooks; use JSON parse/stringify with stable ordering acceptable for readability.
- **D-07:** [auto] Copy skill trees `pmacro-*` from repo to `~/.claude/skills/` (overwrite). If existing `SKILL.md` differs from source, write `.backup` beside or with suffix per INST-02 before overwrite.
- **D-08:** [auto] Write **lock marker** `.claude/.pmacros-installed` in the **project** (git-ignored) for skip-on-rerun behavior; support `--force` to redo install (conventional).
- **D-09:** [auto] **Stdlib only** in `install.js` — no npm deps (matches `CLAUDE.md`).

### Status line (UX-01)
- **D-10:** [auto] Dedicated script (e.g. `scripts/pmacro-statusline.cjs` or under `hooks/`) registered as `statusLine.command` by install: prints **one line** of tag names (e.g. space- or comma-separated), derived from **merged** macros; **no** macro values on the line (privacy + width). Always exit 0; stderr silent on failure with empty or fallback line if needed so the CLI never breaks.
- **D-11:** [auto] Install merges `statusLine.command` the same way as the hook — idempotent, non-destructive to unrelated settings.

### Claude's Discretion
- Exact `settings.json` merge algorithm and backup path for skills
- Whether `pmacro update/remove` use a `--project` flag vs. auto-detect repo root
- Field name used from hook stdin for workspace root (after checking current Claude Code hook payload)
- Exact status line format (separator, max width truncation)
- File layout for new scripts (`install.js` at repo root per INST-01)

### Folded Todos
None — `todo match-phase` returned no matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` — § Phase 2: Full Integration (goal, requirements CRUD-03/04, STOR-02, INST-01–03, UX-01, success criteria)
- `.planning/REQUIREMENTS.md` — CRUD-03, CRUD-04, STOR-02, INST-01–03, UX-01
- `.planning/PROJECT.md` — Constraints (stdlib-only), project-over-user collision policy

### Prior phase decisions & setup
- `.planning/phases/01-core-engine/01-CONTEXT.md` — D-04 hook JSON shape, D-05 silent fail, tag rules, atomic writes, status/log behavior
- `CLAUDE.md` — Project constraints and stack expectations
- `docs/MANUAL-SETUP-PHASE1.md` — Current manual hook/skill registration (baseline before install.js automation)

### Implementation (current tree)
- `hooks/user-prompt-submit.cjs` — Today: user-only `readMacrosSync()`; Phase 2: swap to merged read
- `lib/macros-store.cjs`, `lib/paths.cjs`, `lib/expand.cjs` — Storage and expansion; extend paths for project file
- `scripts/pmacro.cjs` — CLI entry; add update/remove

### External protocol docs
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) — UserPromptSubmit, stdin/stdout JSON
- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills) — SKILL.md, slash commands
- [Claude Code Status line](https://code.claude.com/docs/en/statusline) — `statusLine.command` registration and behavior

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`lib/macros-store.cjs`** — `readMacrosSync`, `writeMacrosAtomic`, `validateTagName`, `normalizeEntry`; extend for project path and merged read/write targets.
- **`lib/paths.cjs`** — User paths only; add project `macros.json` resolver helper.
- **`lib/expand.cjs`** — `expandPrompt` unchanged; consume merged map.
- **`lib/error-log.cjs`** — `appendLog` for hook and CLI errors.
- **`hooks/user-prompt-submit.cjs`** — Success JSON shape already matches D-04; replace single-file read with merged macros.
- **`scripts/pmacro.cjs`** — Pattern for subcommands and tests (`test/pmacro-cli.test.cjs`).

### Established Patterns
- Atomic writes everywhere; hook always `exit 0`; JSONL hook error log; `{{tagname}}` regex and validation aligned with Phase 1.

### Integration Points
- **`~/.claude/settings.json`** — Hook + status line registration via `install.js`
- **`~/.claude/pmacros/macros.json`** and **`.claude/pmacros/macros.json`** — Dual storage for merge
- **`~/.claude/skills/pmacro-*/SKILL.md`** — New skills: `pmacro-update`, `pmacro-remove`; install copies all

</code_context>

<specifics>
## Specific Ideas

No interactive specifics — [auto] selections follow `PROJECT.md`, `01-CONTEXT.md`, and ROADMAP Phase 2 success criteria.

</specifics>

<deferred>
## Deferred Ideas

- **Log rotation / soft cap (D-13 follow-up)** — Still optional; not in Phase 2 ROADMAP success criteria; implement only if planner budgets time.
- **Full injection mode schema** (manual/auto/start/end) — v2 / PROJECT “Active” longer list; not part of Phase 2 boundary above.

### Reviewed Todos (not folded)
None.

</deferred>

---

*Phase: 02-full-integration*
*Context gathered: 2026-04-12*
