# Technology Stack

**Analysis Date:** 2026-04-12

## Languages

**Primary:**
- JavaScript (CommonJS) — all runtime and test code uses `'use strict'`, `require()`, and `.cjs` modules under `hooks/`, `lib/`, `scripts/`, and `test/`.

**Secondary:**
- Markdown — Claude Code skill definitions in `.claude/skills/pmacro-*/SKILL.md` and project docs such as `docs/MANUAL-SETUP-PHASE1.md`.

**JSON:**
- `package.json` — package metadata and npm scripts only (no dependency entries).
- `~/.claude/pmacros/macros.json` — macro store schema (`schemaVersion`, `macros` object); read/written by `lib/macros-store.cjs`.

## Runtime

**Environment:**
- Node.js — required to execute `hooks/user-prompt-submit.cjs`, `scripts/pmacro.cjs`, and `npm test`. The test runner uses `node --test`, which implies a recent Node LTS (18+ is the project’s documented target in `CLAUDE.md`; `package.json` does not declare an `engines` field).

**Package Manager:**
- npm-compatible `package.json` present; **no lockfile** (`package-lock.json` not present in repo).

## Frameworks

**Core:**
- None — no web framework, no bundler. The product is a small CLI and a stdin/stdout hook script.

**Testing:**
- Node.js built-in test runner — `node:test` and `node:assert/strict` in `test/*.test.cjs`. Invoked via `package.json` script `node --test --test-concurrency=1`.

**Build/Dev:**
- Not applicable — no compile step; run files directly with `node`.

## Key Dependencies

**Critical:**
- **None (npm)** — `package.json` has no `dependencies` or `devDependencies`. Hook and install friction constraints (see `CLAUDE.md`) mandate Node.js stdlib only for the core path.

**Standard library modules in use:**
- `fs` — sync read/write, `mkdirSync`, `appendFileSync`, `existsSync`, `unlinkSync` (`hooks/user-prompt-submit.cjs`, `lib/macros-store.cjs`, `lib/error-log.cjs`, `scripts/pmacro.cjs`, tests).
- `path` — resolution and joining across modules.
- `os` — `os.homedir()` for user config roots (`lib/paths.cjs`, `scripts/pmacro.cjs`, tests).
- `node:child_process` — `spawnSync` to integration-test the hook (`test/hook-user-prompt-submit.test.cjs`, `test/pmacro-cli.test.cjs`).

## Configuration

**Environment:**
- No application `.env` contract. Tests override `HOME` to isolate `~/.claude`-relative paths (`test/hook-user-prompt-submit.test.cjs`).
- GSD planner settings live in `.planning/config.json` (workflow toggles); this is unrelated to pmacros runtime behavior.

**Build:**
- Not applicable.

**User / Claude Code configuration:**
- Hook registration is documented in `docs/MANUAL-SETUP-PHASE1.md`: merge into `~/.claude/settings.json` a `UserPromptSubmit` command pointing at an absolute path to `hooks/user-prompt-submit.cjs`.
- Phase 1 explicitly does **not** ship `install.js` yet (per `docs/MANUAL-SETUP-PHASE1.md`).

## Platform Requirements

**Development:**
- Node.js with `node --test` support; Linux, macOS, or WSL2 (atomic `fs.renameSync` for `macros.json` writes in `lib/macros-store.cjs`).

**Production:**
- Not a deployed service — artifacts run on the user’s machine inside Claude Code’s hook pipeline.

---

*Stack analysis: 2026-04-12*
