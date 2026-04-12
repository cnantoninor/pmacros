# Roadmap: pmacros

## Overview

pmacros ships in two phases. Phase 1 builds the core engine: users can define macros and see them expand transparently in every Claude Code prompt via a UserPromptSubmit hook — the fundamental value proposition, validated on a single machine. Phase 2 completes integration: project-level scopes override user macros, full CRUD (update/remove) is available, the install script works cross-platform, and the status line surfaces available tags at a glance.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Core Engine** - Hook expansion, user-scope storage, add/list/preview, error safety
- [ ] **Phase 2: Full Integration** - Project scopes, update/remove, install script, status line

## Phase Details

### Phase 1: Core Engine
**Goal**: Users can define macros and see them expand transparently in Claude Code prompts
**Depends on**: Nothing (first phase)
**Requirements**: CRUD-01, CRUD-02, CRUD-05, CRUD-06, EXPN-01, EXPN-02, EXPN-03, EXPN-04, STOR-01, STOR-03, STOR-04, STOR-05, UX-02, UX-03
**Success Criteria** (what must be TRUE):
  1. User can add a macro with a tag name and value via `/pmacro-add` and see it stored in `~/.claude/pmacros/macros.json`
  2. Typing `<tagname>` in a Claude Code prompt causes the macro value to be substituted before Claude receives it
  3. User can run `/pmacro-preview` and see exactly what the prompt will look like after expansion, without sending it
  4. Hook errors are silently suppressed (prompt always passes through) and written to `hook-errors.log`, visible via `/pmacro-status`
  5. `macros.json` is never corrupted on crash — all writes use atomic temp-file rename
**Plans**: TBD

### Phase 2: Full Integration
**Goal**: pmacros is fully operational in Claude Code with project scopes, complete CRUD, cross-platform install, and status line visibility
**Depends on**: Phase 1
**Requirements**: CRUD-03, CRUD-04, STOR-02, INST-01, INST-02, INST-03, UX-01
**Success Criteria** (what must be TRUE):
  1. User can update or remove any macro by tag name via `/pmacro-update` and `/pmacro-remove`
  2. A project-level macro at `.claude/pmacros/macros.json` overrides the same-named user-level macro during expansion
  3. Running `node install.js` registers the hook and copies skill files idempotently — safe to re-run on all three platforms (Linux, macOS, WSL2)
  4. The Claude Code status line shows available macro tag names and updates immediately when macros change
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Engine | 0/? | Not started | - |
| 2. Full Integration | 0/? | Not started | - |
