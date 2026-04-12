# Coding Conventions

**Analysis Date:** 2026-04-12

## Naming Patterns

**Files:**
- Library and hook code uses the `.cjs` extension with `"type": "commonjs"` in `package.json` — e.g. `lib/expand.cjs`, `hooks/user-prompt-submit.cjs`, `scripts/pmacro.cjs`.
- Tests live under `test/` with the suffix `.test.cjs` — e.g. `test/expand.test.cjs`, `test/pmacro-cli.test.cjs`.

**Functions:**
- Use `camelCase` for functions and methods: `expandPrompt`, `readMacrosSync`, `writeMacrosAtomic`, `cmdAdd`, `runHook`.
- CLI-facing command handlers follow `cmd<Name>` — `cmdList`, `cmdPreview`, `cmdStatus`.

**Variables:**
- Module-level regex and limits use `UPPER_SNAKE_CASE`: `TAG_RE`, `TAG_IN_PROMPT_RE`, `MAX_STDIN_CHARS`, `MAX_VALUE_LEN`, `MS_24H`.

**Error codes:**
- Attach a string `code` on `Error` objects for programmatic classification: `INVALID_MACROS_JSON`, `INVALID_TAG`, `MACROS_READ_ERROR`, etc. Prefer `Object.assign(new Error('…'), { code: '…' })` or `err.code = '…'` after construction.

## Code Style

**Formatting:**
- No ESLint, Prettier, or Biome configuration is present in the repository. Style is implicit from existing files.
- Two-space indentation; single quotes for strings in application code.

**Strict mode:**
- Every executable module begins with `'use strict';` immediately after the shebang (if any).

## Import Organization

**Order (typical in `lib/` and tests):**
1. Node built-in modules (`fs`, `path`, `os`, `node:test`, `node:assert/strict`, `node:child_process`).
2. Relative `require` of project modules (`./paths.cjs`, `../lib/expand.cjs`).

**Path resolution:**
- Files under `lib/` use short relative requires: `require('./macros-store.cjs')`.
- Entry scripts (`hooks/user-prompt-submit.cjs`, `scripts/pmacro.cjs`) resolve the repo root with `path.join(__dirname, '..', 'lib', '…')` so the hook/CLI works regardless of cwd.

**Path aliases:** Not used.

## Error Handling

**Hook (`hooks/user-prompt-submit.cjs`):**
- Must never block the user: always `process.exit(0)` even on failure.
- Invalid stdin, JSON parse errors, oversized stdin, and macro read failures log via `appendLog` from `lib/error-log.cjs` then exit 0; some paths leave stdout empty (invalid JSON), others echo the original prompt unchanged via `writeSuccess`.

**CLI (`scripts/pmacro.cjs`):**
- User-facing failures call `die(message, code)` which writes to `stderr` and exits with non-zero code (default 1).
- `upsertMacro` and `readMacrosSync` errors are caught and surfaced as `die` messages.

**Library (`lib/macros-store.cjs`):**
- `readMacrosSync` throws rich errors with `code` and optional `cause` for I/O and JSON/shape problems.
- `writeMacrosAtomic` cleans up temp files in a `catch` block (ignore secondary unlink errors).

## Logging

**Implementation:** `lib/error-log.cjs` — `appendLog` appends one JSONL line per call.

**Patterns:**
- Records include `ts` (ISO), `level` (`info` default), `event`, `message`, optional `tag`, optional `stack`.
- Hook uses `level: 'error'` for failures, `level: 'warn'` with `event: 'missed-tag'` for unknown or missing macro tags after expansion.

## Comments

**When to comment:**
- Brief rationale for non-obvious limits and deferred work — e.g. `MAX_STDIN_CHARS` guard, unbounded log growth note in `error-log.cjs`.
- Requirement/trace IDs appear as inline tags (`T-04-03`, `D-13`) where the team tracks specs.

**JSDoc:**
- Use `@param` and `@returns` with closure/TypeScript-style types in braces for exported functions that cross module boundaries — see `lib/expand.cjs`, `lib/macros-store.cjs`, `lib/error-log.cjs`.

## Function Design

**Size:** Handlers in `scripts/pmacro.cjs` are small and focused per subcommand; `main` is a thin `switch` on `argv[2]`.

**Parameters:** Prefer explicit objects for structured input — e.g. `upsertMacro({ tag, value, description })`.

**Return values:** Pure logic modules return data objects (e.g. `expandPrompt` → `{ text, missedTags }`). Sync I/O helpers return parsed structures or void after atomic write.

## Module Design

**Exports:** CommonJS `module.exports = { … }` with named exports only; no default exports observed.

**Barrel files:** Not used; consumers require specific `.cjs` files directly.

**Shared configuration:** Paths are centralized in `lib/paths.cjs` (`getPmacrosDir`, `getMacrosPath`, `getHookErrorsLogPath`) so tests can influence resolution by patching `os.homedir` and clearing `require.cache` for path-dependent modules.

---

*Convention analysis: 2026-04-12*
