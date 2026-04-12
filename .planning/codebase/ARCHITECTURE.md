# Architecture

**Analysis Date:** 2026-04-12

## Pattern Overview

**Overall:** Event-driven **hook adapter** plus **pure-ish domain libraries** and a thin **CLI façade**. The product integrates with Claude Code via the `UserPromptSubmit` hook protocol; macro persistence and expansion live in shared `lib/` modules consumed by both the hook and the CLI.

**Key Characteristics:**

- **Stdlib-only runtime** in `hooks/` and `lib/` — no npm dependencies in the execution path (see `package.json`: only `node:test` via npm script).
- **Fail-open hook semantics:** the hook always exits `0`; errors log and either emit no stdout (pass-through) or emit success JSON with the unchanged prompt, per `docs/MANUAL-SETUP-PHASE1.md` decisions D-04/D-05.
- **Single source of truth for macros:** `readMacrosSync()` / `writeMacrosAtomic()` in `lib/macros-store.cjs` targeting `getMacrosPath()` from `lib/paths.cjs` (user-level `~/.claude/pmacros/macros.json` in Phase 1).
- **Separation of I/O from rules:** `lib/expand.cjs` performs tag replacement given a string and an in-memory map; it does not read files.

## Layers

**Hook adapter (Claude Code integration):**

- Purpose: Read hook JSON from stdin, enforce size limits, load macros, expand prompt, write structured stdout for Claude Code.
- Location: `hooks/user-prompt-submit.cjs`
- Contains: stdin read, JSON parse, orchestration, `writeSuccess()` for `hookSpecificOutput`.
- Depends on: `lib/expand.cjs`, `lib/macros-store.cjs`, `lib/error-log.cjs` (via `path.join` from `__dirname`).
- Used by: Claude Code when `UserPromptSubmit` is registered in `~/.claude/settings.json` (manual setup documented in `docs/MANUAL-SETUP-PHASE1.md`).

**Domain / shared library:**

- Purpose: Macro schema validation, atomic persistence, tag validation, prompt expansion, path resolution, append-only error logging.
- Location: `lib/`
- Contains: `expand.cjs` (replacement), `macros-store.cjs` (read/write/upsert), `paths.cjs` (pmacros dir and file paths), `error-log.cjs` (JSONL append).
- Depends on: Node.js `fs`, `path`, `os` only.
- Used by: `hooks/user-prompt-submit.cjs`, `scripts/pmacro.cjs`, and tests under `test/`.

**CLI / operator tooling:**

- Purpose: User-facing commands for add, list, preview, and status (including log tail and settings heuristic).
- Location: `scripts/pmacro.cjs`
- Contains: Argument parsing via `process.argv`, command dispatch, Markdown-style table output for `list`, 24h log scanning for `status`.
- Depends on: same `lib/` modules as the hook.
- Used by: Humans and by slash-command flows documented in `.claude/skills/*/SKILL.md` (e.g. `pmacro-add` invokes `node <REPO>/scripts/pmacro.cjs add …`).

**Skills (workflow documentation):**

- Purpose: Instruct the agent to run the CLI with correct paths and validation; not executable code in-repo beyond Markdown.
- Location: `.claude/skills/pmacro-add/`, `pmacro-list/`, `pmacro-preview/`, `pmacro-status/` (each with `SKILL.md`).
- Contains: Frontmatter (`name`, `description`, `disable-model-invocation`) and step-by-step flows.
- Depends on: User copying skills to `~/.claude/skills/` per `docs/MANUAL-SETUP-PHASE1.md`.

## Data Flow

**UserPromptSubmit (happy path):**

1. Claude Code invokes `node …/hooks/user-prompt-submit.cjs` with JSON on stdin (includes `prompt` string).
2. `user-prompt-submit.cjs` reads stdin (capped by `MAX_STDIN_CHARS`), parses JSON, extracts `prompt`.
3. `readMacrosSync()` loads `macros.json` (or default empty shape if missing); invalid JSON throws and is caught by the hook.
4. `expandPrompt(promptText, macros)` returns `{ text, missedTags }`; unknown tags stay as `{{tag}}` and are listed in `missedTags`.
5. For each missed tag, `appendLog()` writes a warn-level JSONL line to `getHookErrorsLogPath()`.
6. `writeSuccess(text)` prints one line of JSON with `hookSpecificOutput.updatedPrompt` and `hookEventName: 'UserPromptSubmit'`, then `process.exit(0)`.

**CLI `add`:**

1. `scripts/pmacro.cjs` validates tag and value length (`MAX_VALUE_LEN`), then `upsertMacro()` which reads current file, merges tag, `writeMacrosAtomic()` (temp file + `renameSync`).

**State management:**

- Persistent state is **file-based** only: `macros.json` and `hook-errors.log`. No in-process cache across hook invocations; each hook run reads macros from disk.

## Key Abstractions

**Macro document:**

- Purpose: Versioned JSON object with a `macros` map from tag name to `{ value, approximateTokens, description? }`.
- Examples: shape enforced in `lib/macros-store.cjs` (`readMacrosSync`, `normalizeEntry`).
- Pattern: Explicit `schemaVersion` (numeric); invalid keys/tags skipped during read.

**Tag grammar:**

- Purpose: Safe, predictable `{{tagname}}` placeholders in prompts.
- Examples: `TAG_IN_PROMPT_RE` in `lib/expand.cjs`; `validateTagName` / `TAG_RE` in `lib/macros-store.cjs`.
- Pattern: Lowercase alphanumeric and hyphens, length 1–32; mismatch leaves literal braces in output and may log `missed-tag`.

**Atomic write:**

- Purpose: Avoid corrupt `macros.json` on crash mid-write.
- Examples: `writeMacrosAtomic()` in `lib/macros-store.cjs`.
- Pattern: Write to `macros.json.tmp.<pid>.<time>`, then `fs.renameSync` to final path.

## Entry Points

**Hook script:**

- Location: `hooks/user-prompt-submit.cjs`
- Triggers: Claude Code `UserPromptSubmit` hook registration.
- Responsibilities: Protocol I/O, guardrails, delegate expansion, never block user (exit 0).

**CLI:**

- Location: `scripts/pmacro.cjs`
- Triggers: Direct `node scripts/pmacro.cjs <command>` or skills-driven invocation.
- Responsibilities: CRUD-ish macro ops, preview, operational status.

**Tests:**

- Location: `test/*.test.cjs`
- Triggers: `npm test` → `node --test --test-concurrency=1` (see `package.json`).
- Responsibilities: Spawn hook with isolated `HOME`, assert stdout/exit codes.

## Error Handling

**Strategy:** Layered — library throws descriptive errors (`code` properties on `Error` in `macros-store.cjs`); hook catches everything and logs via `appendLog`, then either returns original prompt with success JSON (read failure path) or empty stdout (invalid JSON / oversized stdin) per test expectations in `test/hook-user-prompt-submit.test.cjs`.

**Patterns:**

- Try/catch in `main()` of `hooks/user-prompt-submit.cjs` with final catch-all logging and `process.exit(0)`.
- CLI uses `die()` for user-visible stderr and non-zero exit on operator errors.

## Cross-Cutting Concerns

**Logging:** `lib/error-log.cjs` — JSONL append to `~/.claude/pmacros/hook-errors.log`; rotation noted as deferred in file comment (D-13).

**Validation:** Tag names at boundary (`validateTagName`); macro entries normalized in `macros-store.cjs`; prompt tags validated again during replace in `expand.cjs`.

**Authentication:** Not applicable — local files and local Claude Code hook; security guidance in `docs/MANUAL-SETUP-PHASE1.md` (trust repo path for hook command).

---

*Architecture analysis: 2026-04-12*
