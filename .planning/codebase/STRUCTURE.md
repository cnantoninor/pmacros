# Codebase Structure

**Analysis Date:** 2026-04-12

## Directory Layout

```
pmacros/
├── hooks/                 # Claude Code hook scripts (stdin/stdout protocol)
│   └── user-prompt-submit.cjs
├── lib/                   # Shared logic: expand, storage, paths, logging
│   ├── expand.cjs
│   ├── macros-store.cjs
│   ├── paths.cjs
│   └── error-log.cjs
├── scripts/               # CLI entry points for operators / skills
│   └── pmacro.cjs
├── test/                  # node:test suites
│   ├── expand.test.cjs
│   ├── hook-user-prompt-submit.test.cjs
│   ├── macros-store.test.cjs
│   └── pmacro-cli.test.cjs
├── docs/                  # Human setup and protocol notes
│   └── MANUAL-SETUP-PHASE1.md
├── .claude/skills/        # Skill markdown (copied to ~/.claude/skills/ by users)
│   ├── pmacro-add/SKILL.md
│   ├── pmacro-list/SKILL.md
│   ├── pmacro-preview/SKILL.md
│   └── pmacro-status/SKILL.md
├── .planning/             # GSD / project planning artifacts (separate from runtime)
├── package.json           # `"type": "commonjs"`, test script only
├── CLAUDE.md              # Project context for agents
└── .gitignore             # Minimal (e.g. `.planning/.next-call-count`)
```

## Directory Purposes

**`hooks/`:**

- Purpose: Executables invoked by external tools (Claude Code) with a fixed contract.
- Contains: Single hook implementation in Phase 1.
- Key files: `hooks/user-prompt-submit.cjs`

**`lib/`:**

- Purpose: Reusable modules without CLI or hook-specific framing.
- Contains: CommonJS modules with `module.exports`.
- Key files: `lib/macros-store.cjs`, `lib/expand.cjs`, `lib/paths.cjs`, `lib/error-log.cjs`

**`scripts/`:**

- Purpose: User-invoked Node CLIs that call into `lib/`.
- Contains: `scripts/pmacro.cjs` with subcommands `add`, `list`, `preview`, `status`.

**`test/`:**

- Purpose: Automated verification; uses `node:test` and `node:assert/strict`.
- Contains: `*.test.cjs` files; hook tests spawn the real script with tweaked `HOME`.

**`docs/`:**

- Purpose: Operational documentation not embedded in code comments.
- Key files: `docs/MANUAL-SETUP-PHASE1.md` (hook JSON shape, paths, skill copy, Phase 2 `install.js` note).

**`.claude/skills/`:**

- Purpose: Repo-bundled skill definitions for slash commands; runtime copy lives under user home.
- Contains: One directory per skill with `SKILL.md`.

## Key File Locations

**Entry Points:**

- `hooks/user-prompt-submit.cjs`: Claude Code `UserPromptSubmit` hook.
- `scripts/pmacro.cjs`: `pmacro` CLI (`node scripts/pmacro.cjs …`).

**Configuration:**

- No committed app config for macros — user data at `~/.claude/pmacros/macros.json` (path from `lib/paths.cjs`).
- Hook registration: user-edited `~/.claude/settings.json` (documented in `docs/MANUAL-SETUP-PHASE1.md`).

**Core Logic:**

- `lib/expand.cjs`: `expandPrompt()` — regex-based `{{tag}}` replacement.
- `lib/macros-store.cjs`: persistence, validation, `upsertMacro`, atomic write.

**Testing:**

- `test/hook-user-prompt-submit.test.cjs`: integration-style hook runs via `spawnSync`.
- `test/expand.test.cjs`, `test/macros-store.test.cjs`, `test/pmacro-cli.test.cjs`: unit/CLI coverage.

## Naming Conventions

**Files:**

- Library and hook scripts use **`.cjs`** extension to match `"type": "commonjs"` in `package.json` and avoid ambiguity.
- Tests: `*.test.cjs` colocated under `test/`.

**Directories:**

- Lowercase, hyphen-free top-level folders (`hooks`, `lib`, `scripts`, `test`, `docs`).
- Skills: `pmacro-<verb>` under `.claude/skills/`.

**Code:**

- Functions: `camelCase` (`expandPrompt`, `readMacrosSync`, `writeSuccess`).
- Constants: `SCREAMING_SNAKE` for limits (`MAX_STDIN_CHARS`, `MAX_VALUE_LEN`, `TAG_IN_PROMPT_RE`).

## Where to Add New Code

**New hook behavior or protocol handling:**

- Primary code: `hooks/user-prompt-submit.cjs` (keep thin; delegate to `lib/`).
- Tests: extend `test/hook-user-prompt-submit.test.cjs` or add `test/<feature>.test.cjs`.

**New macro features (schema, validation, expansion rules):**

- Implementation: `lib/macros-store.cjs` and/or `lib/expand.cjs`.
- Tests: `test/macros-store.test.cjs`, `test/expand.test.cjs`.

**New user-facing commands:**

- Implementation: `scripts/pmacro.cjs` (new `case` in `main` switch + handler).
- Tests: `test/pmacro-cli.test.cjs`.
- Optional: new `.claude/skills/pmacro-<name>/SKILL.md` and update `docs/MANUAL-SETUP-PHASE1.md` skill list.

**Utilities shared by hook and CLI:**

- Add modules under `lib/` and `require()` with `path.join(__dirname, …)` from callers (match existing pattern in `hooks/user-prompt-submit.cjs` and `scripts/pmacro.cjs`).

## Special Directories

**`.planning/`:**

- Purpose: Roadmaps, phase plans, verification — GSD workflow output.
- Generated: Mixed (some hand-edited, some tool-generated).
- Committed: Typically yes for project tracking; not read by hook/CLI at runtime.

**`~/.claude/pmacros/` (runtime, not in repo):**

- Purpose: `macros.json`, `hook-errors.log`.
- Generated: On first macro write or first log append.
- Committed: No — user-local state.

---

*Structure analysis: 2026-04-12*
