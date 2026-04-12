---
status: clean
phase: 01-core-engine
reviewed: 2026-04-12
depth: quick
---

# Phase 01 code review (orchestrator quick pass)

## Scope

Source delivered in Phase 1: `lib/*.cjs`, `hooks/user-prompt-submit.cjs`, `scripts/pmacro.cjs`, tests under `test/`.

## Findings

| Severity | Finding |
|----------|---------|
| — | No blocking issues identified |

## Advisory

1. **`updatedPrompt` vs docs** — Official hook reference highlights `additionalContext` for `UserPromptSubmit`; implementation follows project **D-04** (`updatedPrompt`). Reconcile with the Claude Code version you run if substitution does not apply.
2. **Substring hook detection** — `pmacro status` uses a loose string scan of `settings.json`; sufficient for Phase 1, may false-positive on comments in JSON (invalid JSON would fail parse → “no”).

## Security spot-check

- No `eval` on settings or macros; JSON.parse only.
- CLI rejects invalid tags; macro values capped (1MB) to limit memory abuse.
- Hook stdin size capped (32MiB chars).
