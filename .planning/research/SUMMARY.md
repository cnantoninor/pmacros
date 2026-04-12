# Research Summary — pmacros

**Project:** pmacros (Claude Code Prompt Macro Injection System)
**Research date:** 2026-04-12
**Sources synthesized:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

---

## Recommended Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| **Hook runtime** | Node.js 18+ stdlib | Native on all Claude Code platforms; no install friction |
| **File I/O** | `fs` + `path` stdlib | Atomic operations; no deps needed |
| **JSON** | Native `JSON` | Built-in; no external libs |
| **CRUD interface** | Claude Code SKILL.md + `AskUserQuestion` | Interactive slash commands; native to Claude Code |
| **Status line** | Node.js script (separate from hook) | Fast read-only macro listing; cached for performance |

**Non-negotiable:** Zero external npm dependencies.

---

## Table Stakes Features (v1)

| Feature | Phase |
|---------|-------|
| CRUD via slash commands (`/pmacro-add`, `/pmacro-list`, `/pmacro-update`, `/pmacro-remove`) | 1 |
| `<tagname>` inline expansion via UserPromptSubmit hook | 1 |
| User-level persistent storage (`~/.claude/pmacros/macros.json`) | 1 |
| Atomic writes (temp file + `fs.renameSync()`) — non-negotiable | 1 |
| One-command install script (`node install.js`), idempotent | 1 |
| Error logging + `/pmacro-status` health command | 1 |
| `/pmacro-preview` command (security-critical — validates macro expansion) | 1 |
| Optional description field per macro | 1 |

**Defer to Phase 2:** Project-level scopes, status line integration, scope-aware list output.
**Defer to Phase 3:** Auto-inject mode, position control (start/end), token estimates.

---

## Architecture Overview

### Components

1. **`hook.js`** — Reads JSON from stdin, expands `<tag>` occurrences, writes modified prompt to stdout. Always exits 0. Silent on errors; logs to `hook-errors.log`.

2. **`install.js`** — Copies hook + SKILL.md to `~/.claude/`, registers hook in `settings.json`, initializes `macros.json`. Idempotent.

3. **`SKILL.md`** — Single skill file with all pmacro slash commands. Uses `AskUserQuestion` for interactive CRUD.

4. **`macros.json`** — Array of macro objects. User scope at `~/.claude/pmacros/macros.json`; project scope at `.claude/pmacros/macros.json`. Project overrides user on name collision.

5. **`status-line.js`** — Lightweight status line command. Reads macro list; outputs tag names. Cached (5s TTL) to stay under 50ms.

### macros.json schema
```json
{
  "schemaVersion": 1,
  "macros": [
    {
      "name": "tagname",
      "value": "expanded text",
      "mode": "manual",
      "position": "inline",
      "description": "optional",
      "approximateTokens": 42,
      "createdAt": "2026-04-12T00:00:00Z",
      "updatedAt": "2026-04-12T00:00:00Z"
    }
  ]
}
```

### Build Order
- **Phase 1:** hook.js + install.js + user-scope storage + CRUD (add/list) + preview + error logging
- **Phase 2:** Project-level scopes + collision handling + update/remove + status line
- **Phase 3:** Auto-inject mode + position control + token estimates

---

## Critical Pitfalls

### 1. Config Corruption (CRITICAL — Phase 1)
Concurrent writes to `macros.json` truncate file. **Prevention:** Always use temp file + `fs.renameSync()`. Validate JSON on load; fallback to empty macros on parse error.

### 2. Shell Profile Stdout Pollution (Phase 1)
`~/.bashrc` printing to stdout pollutes hook JSON. **Prevention:** Document `[[ -t 0 ]]` guard; implement `--debug` mode to print raw stdin.

### 3. Prompt Injection via Macros (Phase 1)
Macro values are injected verbatim. Malicious project-level macros can override instructions. **Prevention:** `/pmacro-preview` must be in Phase 1. Warn on auto-inject mode adoption.

### 4. Silent Hook Failures (Phase 1)
Hook always exits 0 so errors are invisible. **Prevention:** Log errors to `~/.claude/pmacros/hook-errors.log`. `/pmacro-status` surfaces errors.

### 5. CRUD Race Condition (Phase 1)
`AskUserQuestion` is async; hook may write config while CRUD is mid-question. **Prevention:** Re-read config immediately before write; merge instead of overwrite.

### 6. Install Overwrites Customized Skills (Phase 1)
Re-running `install.js` stomps user-modified SKILL.md. **Prevention:** Create `.backup` before overwriting if file differs.

### 7. Status Line Hangs (Phase 2)
Slow I/O blocks every prompt. **Prevention:** Timeout all I/O (<50ms); cache with 5s TTL; fallback to empty on timeout.

---

## Phase Recommendations

### Phase 1: MVP Core
Hook expansion, CRUD (add + list), user-scope storage, atomic writes, install script, preview command, error logging.
**Validation gate:** Can users define macros and see them expand? Does install work on Linux/macOS/WSL?

### Phase 2: Claude Code Integration
Project-level scopes, collision handling, status line, update + remove commands, scope indicators in list.
**Validation gate:** Do project macros override user macros correctly? Status line visible and fast?

### Phase 3: Advanced Features
Auto-inject mode, position control (start/end/inline), token estimates, `/pmacro-compare`.
**Validation gate:** Auto-inject useful in practice? Does position control behave as expected?

---

## Open Questions for Phase 1

1. Does plain-text stdout from hooks get injected as context? (One 2025 bug report suggests JSON structure may be needed)
2. Does `fs.renameSync()` behave atomically on WSL2 across filesystems?
3. What is actual hook execution latency on typical machines?
4. Can `AskUserQuestion` prompts race with concurrent hook invocations?
5. Does `install.js` handle existing complex `settings.json` files correctly?
