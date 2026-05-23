# pmacros

**pmacros** is a prompt macro system for [Claude Code](https://code.claude.com/docs/en/hooks). You define short `{{tagname}}` placeholders; a `UserPromptSubmit` hook expands them to longer text before Claude sees your prompt. Macros live in local JSON—no change to how you type day to day beyond using tags where you want expansion.

**Core idea:** define once, inject everywhere, without editing the underlying prompt machinery each time.

## What works today (Phase 2)

Phase 2 is complete. You get:

- **Inline expansion:** `{{tagname}}` in a prompt is replaced with the macro value via the hook.
- **User-level storage:** `~/.claude/pmacros/macros.json` with atomic writes (`schemaVersion`, `approximateTokens` on write).
- **Project-level macros:** `.claude/pmacros/macros.json` overrides same-named user macros during expansion. Use `pmacro update --project` and `pmacro remove --project` for repo-local CRUD.
- **Safe hook behavior:** the hook always exits `0`, never blocks your prompt; failures are logged and the original prompt passes through.
- **Error log:** JSONL at `~/.claude/pmacros/hook-errors.log`; surfaced through `/pmacro-status`.
- **Status line:** macro tag names shown in the Claude Code status bar via `scripts/pmacro-statusline.cjs`.
- **Slash-driven workflow:** `/pmacro-add`, `/pmacro-list`, `/pmacro-preview`, `/pmacro-status`, `/pmacro-update`, and `/pmacro-remove` via `scripts/pmacro.cjs` and skills under `.claude/skills/pmacro-*` (installed by `node install.js` or copied manually—see [Manual setup](#manual-setup-phase-1)).

For the full phase story and success criteria, see [.planning/ROADMAP.md](.planning/ROADMAP.md) and [.planning/PROJECT.md](.planning/PROJECT.md).

## Install (Phase 2)

From a **trusted** clone of this repo, run:

```bash
node install.js
```

This registers the `UserPromptSubmit` hook in `~/.claude/settings.json`, copies all skill files into `~/.claude/skills/`, and registers the status line command. The script is idempotent — safe to re-run. To force re-registration even when the lock file exists:

```bash
node install.js --force
```

For advanced or Phase 1 manual steps, see [docs/MANUAL-SETUP-PHASE1.md](docs/MANUAL-SETUP-PHASE1.md).

**WSL2 note:** WSL2 is treated as Linux. The `ubuntu-latest` CI run covers the same runtime path; for extra assurance run `npm test` once in your WSL2 shell.

## Manual setup (Phase 1)

Phase 1 used manual hook registration. If you need the fallback steps or are on Phase 1, see [docs/MANUAL-SETUP-PHASE1.md](docs/MANUAL-SETUP-PHASE1.md).

Step-by-step instructions, JSON examples, stdout expectations, and security notes are in [docs/MANUAL-SETUP-PHASE1.md](docs/MANUAL-SETUP-PHASE1.md).

## Tag format

- Placeholders: `{{tagname}}` only (double braces).
- Names: lowercase letters, digits, and hyphens; length 1–32 characters.

## Constraints

- **Runtime:** Node.js 18+; hook and shared `lib/` use the **stdlib only** (no extra npm packages on the execution path).
- **Platforms:** Linux, macOS, and WSL2; atomic writes use a temp file plus `fs.renameSync` on the same filesystem as the target file.

## Repo layout (high level)

| Area | Role |
|------|------|
| `hooks/user-prompt-submit.cjs` | Claude Code hook: stdin JSON → expanded prompt on stdout |
| `lib/` | Paths, atomic store, expansion, JSONL error log, macro merge |
| `scripts/pmacro.cjs` | CLI for add / list / preview / status / update / remove |
| `scripts/pmacro-statusline.cjs` | Status line command: outputs active macro tag names |
| `install.js` | Idempotent installer: hook registration, skill copy, status line |
| `.claude/skills/pmacro-*` | Skill markdown consumed by Claude Code after `node install.js` |
| `test/` | `node:test` suites for hook, expansion, merge, install, and status line |

A deeper walkthrough lives in [.planning/codebase/ARCHITECTURE.md](.planning/codebase/ARCHITECTURE.md).

## Development

```bash
npm test
```

Runs `node --test --test-concurrency=1` per `package.json`.

## Roadmap

- **Phase 1 (complete 2026-04-12):** hook expansion, user-scope storage, add/list/preview/status, error safety.
- **Phase 2 (complete):** project-level macros at `.claude/pmacros/macros.json` overriding user macros, `/pmacro-update` and `/pmacro-remove`, idempotent `node install.js`, and status-line visibility for tags. Details: [.planning/ROADMAP.md](.planning/ROADMAP.md).

v2-oriented ideas (auto-inject modes, analytics) and explicit out-of-scope items are summarized in [.planning/REQUIREMENTS.md](.planning/REQUIREMENTS.md) and [.planning/PROJECT.md](.planning/PROJECT.md).

## Documentation index

| Document | Contents |
|----------|----------|
| [docs/MANUAL-SETUP-PHASE1.md](docs/MANUAL-SETUP-PHASE1.md) | Hook registration, skill copy, behavior on success/failure |
| [.planning/PROJECT.md](.planning/PROJECT.md) | Product definition, validated vs active requirements, decisions |
| [.planning/STATE.md](.planning/STATE.md) | Current milestone position and session notes |
| [.planning/ROADMAP.md](.planning/ROADMAP.md) | Phases, success criteria, plan references |
| [.planning/REQUIREMENTS.md](.planning/REQUIREMENTS.md) | Traceable requirement IDs (CRUD, EXPN, STOR, INST, UX) |

Hook protocol reference: [Claude Code Hooks](https://code.claude.com/docs/en/hooks).
