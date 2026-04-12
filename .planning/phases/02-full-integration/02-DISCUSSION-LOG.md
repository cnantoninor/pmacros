# Phase 2: Full Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `02-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 2-Full Integration
**Mode:** `--auto` (invoked via `/gsd-next` routing — non-interactive recommended defaults)
**Areas discussed:** Scope merge, CRUD update/remove, install.js, status line

---

## Scope merge (STOR-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Single merged map, project overrides user | One helper; consistent hook + CLI + status line | ✓ |
| Hook-only merge | CLI reads user only | |
| Separate files never merged | Violates ROADMAP | |

**User's choice:** [auto] Single merged map with project overwriting user on collision.
**Notes:** Aligns with `PROJECT.md` Key Decisions table.

---

## `/pmacro-update` and `/pmacro-remove`

| Option | Description | Selected |
|--------|-------------|----------|
| Extend `pmacro.cjs` + new skills | Matches Phase 1 delivery pattern | ✓ |
| Standalone scripts per command | More duplication | |

**User's choice:** [auto] Extend CLI and add `pmacro-update`, `pmacro-remove` skills.
**Notes:** Atomic writes and tag validation carry forward from Phase 1.

---

## `install.js`

| Option | Description | Selected |
|--------|-------------|----------|
| Stdlib-only idempotent merge + skill copy | Meets INST-01–03 and `CLAUDE.md` | ✓ |
| Shell script installer | Cross-platform friction | |

**User's choice:** [auto] Node `install.js` with settings merge, skill backup (INST-02), lock file.
**Notes:** Hook + status line both registered when applicable.

---

## Status line (UX-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Thin Node script, merged tags, one line | Meets UX-01; stdlib-only | ✓ |
| Embed in existing `pmacro status` | Status line needs separate command | |

**User's choice:** [auto] Dedicated status line script printing tag names from merged macros; exit 0 always.

---

## Claude's Discretion

- Project root detection details; optional `--project` flag vs. auto-detect for CRUD scope
- Exact `settings.json` merge behavior and formatting
- Status line separator and truncation

## Deferred Ideas

- Log rotation soft cap (D-13)
- v2 injection modes (auto/start/end)
