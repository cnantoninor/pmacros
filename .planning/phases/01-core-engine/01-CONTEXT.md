# Phase 1: Core Engine - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers a working end-to-end macro expansion loop on a single machine, user-scope only:

- Users can add and list macros via slash commands (`/pmacro-add`, `/pmacro-list`).
- Macros are stored atomically in `~/.claude/pmacros/macros.json`.
- A `UserPromptSubmit` hook transparently substitutes `{{tagname}}` occurrences in prompts with the macro value before Claude receives them.
- Users can preview expansion without sending (`/pmacro-preview`) and check hook health (`/pmacro-status`).
- Hook never blocks; errors and missed-tag warnings are written to a JSONL error log.

**Out of scope for Phase 1 (Phase 2):** project-scope overrides, `/pmacro-update`, `/pmacro-remove`, install script, status-line integration, log rotation.

</domain>

<decisions>
## Implementation Decisions

### Tag Format (overrides CLAUDE.md + UX-03)
- **D-01:** Tag delimiter is `{{tagname}}`, NOT `<tagname>`. Chosen to avoid collisions with HTML/JSX/XML/generics that appear frequently in real prompts. Enables meaningful miss-warnings because `{{foo}}` that doesn't resolve is almost always a typo, not legitimate content.
- **D-02:** Tag name rules unchanged from UX-03: lowercase alphanumeric + hyphens, 1–32 chars. Only the delimiter changed.
- **D-03:** CLAUDE.md "Tag format" line and REQUIREMENTS.md UX-03 MUST be updated during Phase 1 (first planned task) to reflect `{{tagname}}`.

### Hook Output Mechanism
- **D-04:** Hook emits JSON on stdout with `hookSpecificOutput.hookEventName = "UserPromptSubmit"` and `updatedPrompt` set to the expanded text. This is the only Claude Code hook protocol that substitutes the prompt in-place, which is what EXPN-01 requires.
- **D-05:** On any error (JSON parse, file read, expansion crash), hook logs to `~/.claude/pmacros/hook-errors.log` and exits 0 with no stdout output — original prompt passes through unchanged. Matches EXPN-02.
- **D-06:** Unknown `{{tag}}` (not found in macros.json) is left in place, a warning entry is appended to `hook-errors.log`, and the entry is surfaced in `/pmacro-status`. The hook does NOT strip or error on unknown tags.

### Slash Command UX
- **D-07:** `/pmacro-add` is hybrid: accepts args if provided (`/pmacro-add tagname value [description]`), otherwise falls back to a multi-step `AskUserQuestion` flow collecting tag name → value → optional description. Tag name is validated against the format rules (D-02) before write; invalid input re-prompts.
- **D-08:** `/pmacro-preview` takes the prompt text as an argument and prints a before/after diff inline. No filesystem juggling, no temp files. Multi-line text is supported via normal slash-command arg passing.
- **D-09:** `/pmacro-list` renders a Markdown table with columns: `tag | description | tokens | value preview`. Value preview is truncated to ~40 chars with an ellipsis. Empty macros.json shows a friendly "no macros yet — run /pmacro-add" message.

### Token Counting (CRUD-06)
- **D-10:** `approximateTokens = Math.ceil(value.length / 4)`. Classic char-count heuristic, stdlib-only, ±15% accurate for English prose. The field name already signals "approximate" — precision is not the goal.
- **D-11:** Token count is computed on every write to macros.json (inside `/pmacro-add` before the atomic temp-file rename). Never computed lazily at read time — that would mutate storage during reads and violate the atomic-write discipline.

### Error Log & Status
- **D-12:** `hook-errors.log` format is JSONL: one JSON object per line with fields `{ts, level, event, tag?, message, stack?}`. Levels: `error`, `warn` (missed tag), `info` (optional, planner decides). Written via `fs.appendFileSync` — stdlib-only, crash-safe enough for append-only logs.
- **D-13:** Log rotation is DEFERRED to Phase 2. Phase 1 writes unbounded. If it becomes a problem, Phase 2 adds a soft cap (truncate to last ~1000 lines when > 1MB).
- **D-14:** `/pmacro-status` shows: (a) hook installed yes/no, (b) macros.json path + macro count, (c) last error within the last 24h (timestamp + message), (d) count of missed-tag warnings within the last 24h. After this summary, it offers the user an interactive follow-up: "Show more errors? [n / all]". If the user provides a number N, print the last N error entries from the log; if "all", print everything. Default if the user dismisses: show nothing further.

### Claude's Discretion
The following are not user-facing preferences — the planner/researcher should choose whatever is cleanest:
- File layout inside the repo (hook script path, skills dir layout, shared lib vs. inlined utils)
- Atomic write temp-file naming scheme (e.g., `macros.json.tmp.{pid}` vs. `macros.json.{Date.now()}.tmp`)
- `schemaVersion` initial value (suggest `1`, but planner can justify otherwise)
- JSON indentation / pretty-printing of macros.json
- Exact regex used to match `{{tagname}}` (must respect D-02 name rules)
- Whether to ship a tiny shared `lib/` module or inline helpers per script — whichever keeps Node stdlib-only constraint clean
- Test strategy for Phase 1 (how to test a stdin-fed Node hook script without mocks)

### Folded Todos
None — no pending todos cross-referenced for this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project specs
- `CLAUDE.md` — Project constraints: Node stdlib only, atomic writes, hook exits 0, tag format (NOTE: tag format line will be updated per D-03 during Phase 1 execution)
- `.planning/PROJECT.md` — Vision, core value, key decisions table
- `.planning/REQUIREMENTS.md` — v1 requirement IDs CRUD-01/02/05/06, EXPN-01/02/03/04, STOR-01/03/04/05, UX-02/03 (UX-03 will be updated per D-03)
- `.planning/ROADMAP.md` §"Phase 1: Core Engine" — phase success criteria

### External protocol docs
- Claude Code Hooks Reference — https://code.claude.com/docs/en/hooks (UserPromptSubmit event, hookSpecificOutput JSON schema, exit code semantics)
- Claude Code Skills Documentation — https://code.claude.com/docs/en/skills (SKILL.md frontmatter, AskUserQuestion flow, invocation model)

### Phase research inputs
- `.planning/research/` — prior project research on stack/features/architecture/pitfalls (read whichever subfiles exist)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **None yet.** Repo contains only planning documents and CLAUDE.md. Phase 1 writes the first production code in the project (hook script, skill files, shared utils).

### Established Patterns
- **None yet.** Phase 1 establishes the foundational patterns. Planner should define:
  - How hook/skill scripts share common code (if at all) while staying stdlib-only
  - Where the atomic-write helper lives
  - Error-log writer location and interface
  - Tag-parsing regex location

### Integration Points
- **Claude Code `~/.claude/settings.json`** — Hook registration; Phase 2's install script will automate this. Phase 1 can document the manual registration for dogfooding.
- **`~/.claude/pmacros/macros.json`** — User-scope storage (created by first `/pmacro-add`).
- **`~/.claude/pmacros/hook-errors.log`** — Error/warn sink, created lazily on first write.
- **`~/.claude/skills/pmacro-*/SKILL.md`** — Skill files for Phase 1 commands: `pmacro-add`, `pmacro-list`, `pmacro-preview`, `pmacro-status`.

</code_context>

<specifics>
## Specific Ideas

- User explicitly requested `{{tagname}}` over `<tagname>` for HTML-safety. This is not a suggestion — it's a locked decision that overrides the original v1 spec.
- User wants `/pmacro-status` to be interactive: after the summary, offer to show more error entries on request, with user-chosen count or "all". Must use `AskUserQuestion` or equivalent follow-up pattern.
- Miss-warnings are first-class: when a `{{tag}}` doesn't resolve, it's a signal worth surfacing, not noise worth suppressing. Reflect this in the log format, status output, and test coverage.

</specifics>

<deferred>
## Deferred Ideas

- **Log rotation / size cap** — moved to Phase 2 (D-13). If Phase 1 dogfooding reveals disk growth issues, the soft-cap-and-truncate approach described in D-13 is the intended solution.
- **Supporting `<tagname>` as a legacy delimiter** — rejected, not deferred. Would reintroduce HTML collision risk.
- **Token counting with a real tokenizer (e.g., tiktoken)** — rejected per stdlib-only constraint. Not revisiting unless the stdlib-only constraint is lifted.
- **`schemaVersion` migration logic** — field is written in Phase 1 (STOR-05) but no migration code exists yet. First actual migration happens whenever the schema changes, not in Phase 1.

### Reviewed Todos (not folded)
None — no todos were reviewed in cross_reference_todos.

</deferred>

---

*Phase: 01-core-engine*
*Context gathered: 2026-04-12*
