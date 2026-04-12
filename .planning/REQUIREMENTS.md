# Requirements: pmacros

**Defined:** 2026-04-12
**Core Value:** Zero-friction prompt augmentation — define once, inject everywhere, without touching the prompt input

## v1 Requirements

### Macro Management (CRUD)

- [ ] **CRUD-01**: User can add a macro with tag name and value via `/pmacro-add` slash command
- [ ] **CRUD-02**: User can list all active macros with tag names and descriptions via `/pmacro-list`
- [ ] **CRUD-03**: User can update an existing macro's value or settings via `/pmacro-update`
- [ ] **CRUD-04**: User can remove a macro by tag name via `/pmacro-remove`
- [ ] **CRUD-05**: Each macro has an optional description field shown in list output
- [ ] **CRUD-06**: Each macro stores an `approximateTokens` count computed on write

### Expansion

- [ ] **EXPN-01**: `{{tagname}}` in a prompt is replaced with the macro's value (inline mode) via `UserPromptSubmit` hook
- [ ] **EXPN-02**: Hook always exits 0 and never blocks the user's prompt — fails silently
- [ ] **EXPN-03**: Hook logs errors to `~/.claude/pmacros/hook-errors.log` for diagnosis
- [ ] **EXPN-04**: `/pmacro-preview` shows before/after expansion of the current prompt without sending

### Storage & Scopes

- [ ] **STOR-01**: User-level macros stored at `~/.claude/pmacros/macros.json`
- [ ] **STOR-02**: Project-level macros stored at `.claude/pmacros/macros.json`; override user macros on name collision
- [ ] **STOR-03**: All writes to `macros.json` are atomic (temp file + `fs.renameSync()`) — never corrupts on crash
- [ ] **STOR-04**: Hook re-reads config immediately before write in all CRUD commands (prevents race condition)
- [ ] **STOR-05**: `macros.json` includes `schemaVersion` field for future migrations

### Install & Distribution

- [ ] **INST-01**: `node install.js` registers the hook in `~/.claude/settings.json` and copies skill files — idempotent
- [ ] **INST-02**: Install script creates `.backup` of existing SKILL.md if it differs before overwriting
- [ ] **INST-03**: Install script tested and working on Linux, macOS, and WSL2

### UX & Discoverability

- [ ] **UX-01**: Status line integration shows available macro tag names (registered via `settings.json` `statusLine.command`)
- [ ] **UX-02**: `/pmacro-status` command shows hook health (last error, if any, from error log)
- [ ] **UX-03**: Tag format is `{{tagname}}` — lowercase alphanumeric + hyphens, 1–32 chars

## v2 Requirements

### Advanced Injection Modes

- **ADV-01**: Auto-inject mode — macro appended/prepended to every prompt without requiring a tag
- **ADV-02**: Position control — `inline` (replace tag), `start` (prepend), `end` (append)

### Analytics

- **ANLY-01**: Usage tracking — per-macro invocation count and token savings estimate
- **ANLY-02**: Summary statistics in `/pmacro-list` (total token savings across session)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Nested macros (macro values referencing other macros) | Adds recursion complexity; no clear v1 demand |
| Per-macro slash commands (`/pmacro:tagname`) | Requires Claude Code restart for each new macro; breaks UX |
| GUI, web interface, cloud sync | CLI-native tool; out of scope indefinitely |
| Conditional macros (if/else logic in values) | Template language conflicts with simple text-substitution model |
| Macro sharing / marketplace | Single-user local tool; use git for sharing |
| OAuth / multi-user | Single-user local tool by design |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CRUD-01 | Phase 1 | Pending |
| CRUD-02 | Phase 1 | Pending |
| CRUD-03 | Phase 2 | Pending |
| CRUD-04 | Phase 2 | Pending |
| CRUD-05 | Phase 1 | Pending |
| CRUD-06 | Phase 1 | Pending |
| EXPN-01 | Phase 1 | Pending |
| EXPN-02 | Phase 1 | Pending |
| EXPN-03 | Phase 1 | Pending |
| EXPN-04 | Phase 1 | Pending |
| STOR-01 | Phase 1 | Pending |
| STOR-02 | Phase 2 | Pending |
| STOR-03 | Phase 1 | Pending |
| STOR-04 | Phase 1 | Pending |
| STOR-05 | Phase 1 | Pending |
| INST-01 | Phase 2 | Pending |
| INST-02 | Phase 2 | Pending |
| INST-03 | Phase 2 | Pending |
| UX-01 | Phase 2 | Pending |
| UX-02 | Phase 1 | Pending |
| UX-03 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-12*
*Last updated: 2026-04-12 after roadmap creation*
