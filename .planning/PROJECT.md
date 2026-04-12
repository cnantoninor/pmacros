# pmacros

## What This Is

pmacros is a prompt macro injection system for Claude Code. Users define short `<tagname>` tags that transparently expand to longer text before Claude receives the prompt — via a `UserPromptSubmit` hook. Macros can be injected manually (only when the tag appears) or automatically on every prompt, and are stored locally per-user or per-project.

## Core Value

Zero-friction prompt augmentation: define once, inject everywhere — without touching the prompt input.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Macro CRUD via slash commands (`/pmacro-add`, `/pmacro-list`, `/pmacro-update`, `/pmacro-remove`) using `AskUserQuestion` for interactive flows
- [ ] `<tagname>` expansion via `UserPromptSubmit` hook (Node.js, no external dependencies)
- [ ] Manual injection mode: tag expands only when `<tagname>` appears literally in the prompt
- [ ] Auto injection mode: macro is always appended/prepended to every prompt
- [ ] Per-macro position control: `inline` (replace tag), `start` (prepend), `end` (append)
- [ ] Optional `description` field per macro (shown in list and status line)
- [ ] User-level scope (`~/.claude/pmacros/macros.json`) and project-level scope (`.claude/pmacros/macros.json`); project overrides user on name collision
- [ ] Status line integration showing available macro tag names
- [ ] `/pmacro-preview` command: shows before/after expansion without sending
- [ ] One-command install script (`node install.js`) — idempotent

### Out of Scope

- Nested macros (macro values referencing other macros) — deferred to v2; adds recursion complexity without clear v1 demand
- Usage tracking and token usage stats module — deferred to v2; requires persistent counters and doesn't affect core functionality
- Per-macro slash commands (e.g. `/pmacro:assint`) for autocomplete — deferred to v2; requires Claude Code restart to pick up new skills, coupling macro management to skill files
- GUI, web interface, cloud sync, macro sharing/marketplace — out of scope indefinitely for this CLI-native tool
- Conditional macros (if/else logic in macro values) — out of scope; adds a template language that conflicts with the simple text-substitution model

## Context

- Target environment: Claude Code CLI (and IDE extensions), Linux/macOS/WSL
- Hook system: `UserPromptSubmit` hook in `~/.claude/settings.json` — reads prompt from stdin JSON, returns modified prompt in stdout JSON
- Skill system: Claude Code auto-discovers skills from `~/.claude/skills/{name}/SKILL.md`
- The status line runs a command registered in `settings.json` under `statusLine.command`
- User already uses the GSD workflow system — pmacros should feel native alongside it

## Constraints

- **Dependencies**: No external npm packages in the hook script or install script — Node.js stdlib only. Minimizes install friction for all users.
- **Compatibility**: Must work on Linux, macOS, and WSL2 (Windows). Atomic writes use `fs.renameSync` which is safe on same-filesystem temp files.
- **Error handling**: Hook must always exit 0 and never block the user's prompt, even on errors. Fail silently, pass through original prompt.
- **Tag format**: `<tagname>` only (angle-bracket style). Names: lowercase alphanumeric + hyphens, 1–32 chars.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Node.js for hook script (no deps) | Available everywhere Claude Code runs; no install step for end users | — Pending |
| Atomic writes via temp file + rename | Prevents corrupt macros.json on crash or concurrent access | — Pending |
| Copy skills to `~/.claude/skills/` on install (not symlinks) | Avoids broken references if project is moved; install.js upgrades by overwriting | — Pending |
| Project-level macros override user-level on name collision | Standard convention; project-specific context should win over global defaults | — Pending |
| `approximateTokens` computed on write, not at runtime | Avoids per-prompt computation cost; field is informational, not used for decisions | — Pending |
| Status line for discoverability (not per-macro slash commands) | Simpler, no restart required, works for all macros immediately | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-12 after initialization*
