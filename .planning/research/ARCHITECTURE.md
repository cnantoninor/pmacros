# Architecture: Claude Code Macro Injection System

**Project:** pmacros  
**Researched:** 2026-04-12  
**Confidence:** MEDIUM (patterns from Claude Code docs are authoritative; macro-specific validation pending implementation)

---

## System Overview

pmacros is a **hook-based prompt injection system** that intercepts prompts at the `UserPromptSubmit` hook point, expands macro tags (`<tagname>`), and returns the modified prompt to Claude Code. The system consists of five architectural layers:

```
┌─────────────────────────────────────────────────────────┐
│  User Types `/pmacro-add`, `/pmacro-list`, etc.         │
│  (Slash commands via Claude Code skill invocation)      │
└──────────┬──────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────┐
│  CRUD Commands Layer (Skill Directory)                  │
│  └─ ~/.claude/skills/pmacros/SKILL.md                  │
│     (Orchestrates /pmacro-* slash commands)             │
└──────────┬──────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────┐
│  Configuration Layer                                     │
│  ├─ ~/.claude/pmacros/macros.json (user-level)          │
│  └─ .claude/pmacros/macros.json (project-level)         │
│     (Scope-resolved union at hook time)                 │
└──────────┬──────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────┐
│  Hook Execution Layer                                   │
│  └─ ~/.claude/pmacros/hook.js                           │
│     (Node.js, reads stdin, expands tags, writes stdout) │
└──────────┬──────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────┐
│  Claude Code Session                                    │
│  (Prompt with expanded macros sent to Claude)           │
└─────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

### 1. Hook Script (`~/.claude/pmacros/hook.js`)

**Responsibility:**  
Handles the actual macro expansion pipeline. Fires on every prompt submission via the `UserPromptSubmit` hook event.

**Input:**  
JSON on stdin from Claude Code with fields:
```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/current/working/directory",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "The user's prompt text"
}
```

**Processing:**
1. Parse JSON from stdin
2. Resolve macro scopes:
   - Load user-level macros from `~/.claude/pmacros/macros.json`
   - Load project-level macros from `<cwd>/.claude/pmacros/macros.json` (if exists)
   - Merge with project-level overriding user-level on name collision
3. Expand macros based on mode:
   - **Manual mode**: Replace `<tagname>` literals in prompt with macro values
   - **Auto mode**: Append/prepend macro values regardless of tag presence
4. Return modified prompt via stdout as JSON (exit code 0)

**Error Handling:**
- **CRITICAL:** Must never block the user's prompt (exit code 0 always, even on errors)
- Silent fallback on parsing errors → pass through original prompt
- Silent fallback on file read errors → use only available scopes
- Log errors to `~/.claude/pmacros/hook.log` (optional, non-blocking)

**Performance:**
- Must complete in <100ms (status line faster, hook acceptable latency)
- No external dependencies (Node.js stdlib only)
- File reads are synchronous (single read per scope, fast on typical 1–100 macro files)

**Communicates With:**
- macros.json files (read-only)
- Claude Code session (via stdout/exit code)

---

### 2. CRUD Commands Skill (`~/.claude/skills/pmacros/SKILL.md`)

**Responsibility:**  
User-facing interface for macro management. Provides four slash commands: `/pmacro-add`, `/pmacro-list`, `/pmacro-update`, `/pmacro-remove`. Uses Claude Code's `AskUserQuestion` tool for interactive flows.

**Commands:**
- `/pmacro-add` — Interactively add a new macro (name, value, mode, position, description)
- `/pmacro-list` — Show all available macros (union of user and project scopes)
- `/pmacro-update` — Modify an existing macro (by name)
- `/pmacro-remove` — Delete a macro (by name)
- `/pmacro-preview` — Show prompt before/after macro expansion (without sending)

**Frontmatter Configuration:**
```yaml
---
name: pmacros
description: Manage prompt macros. Use /pmacro-add, /pmacro-list, /pmacro-update, /pmacro-remove to add or manage macros.
disable-model-invocation: true
allowed-tools: Read Write Bash(mkdir *) Bash(rm *)
---
```

**Implementation Pattern:**
- SKILL.md is a prompt-based orchestrator; Claude invokes CRUD logic
- Calls to Read/Write tools to inspect/modify macros.json
- Calls to AskUserQuestion for interactive input (macro name, value, etc.)
- Atomic writes via temp file + rename (ensures no corruption on crash)

**Error Handling:**
- Validates macro names (lowercase alphanumeric + hyphens, 1–32 chars)
- Prevents duplicate names at same scope
- Fails gracefully if JSON is malformed (user is shown error, can retry)

**Communicates With:**
- User (via slash command invocation and AskUserQuestion)
- Hook script (indirectly via macros.json updates)
- macros.json files (read/write)

**Scope Resolution in CRUD:**
When listing or updating, the skill shows the merged view:
- User-level macros listed with origin indicator
- Project-level macros listed with origin indicator
- On update/remove, disambiguate which scope the user intends (UX: default to project if exists, offer choice)

---

### 3. Configuration Files (`macros.json` at User and Project Scope)

**Schema:**
```json
{
  "schemaVersion": 1,
  "macros": [
    {
      "name": "assint",
      "value": "You are an expert software architect...",
      "mode": "auto",
      "position": "start",
      "description": "Add expert architect context to all prompts",
      "approximateTokens": 287,
      "createdAt": "2026-04-12T10:30:00Z",
      "updatedAt": "2026-04-12T10:30:00Z"
    },
    {
      "name": "docgen",
      "value": "Generate comprehensive documentation for the code below.",
      "mode": "manual",
      "position": "inline",
      "description": "Inject documentation generation task",
      "approximateTokens": 12,
      "createdAt": "2026-04-12T11:00:00Z",
      "updatedAt": "2026-04-12T11:00:00Z"
    }
  ]
}
```

**Field Definitions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schemaVersion` | number | Yes | Migration identifier (currently 1; increment on breaking changes) |
| `macros` | array | Yes | List of macro definitions |
| `name` | string | Yes | Macro identifier (lowercase alphanumeric + hyphens, 1–32 chars) |
| `value` | string | Yes | Text to inject (can be multi-line) |
| `mode` | enum | Yes | `manual` (expand on `<tagname>` only) or `auto` (always expand) |
| `position` | enum | Yes | `inline` (replace tag), `start` (prepend), `end` (append). Used only if mode is manual; ignored for auto mode. |
| `description` | string | No | Human-readable label for status line and listing |
| `approximateTokens` | number | No | Computed at write time for informational purposes (not used in decisions) |
| `createdAt` | string (ISO 8601) | No | Timestamp for audit trail |
| `updatedAt` | string (ISO 8601) | No | Timestamp for audit trail |

**Scope Locations:**

| Scope | Path | Availability |
|-------|------|--------------|
| User-level | `~/.claude/pmacros/macros.json` | All projects |
| Project-level | `./.claude/pmacros/macros.json` (relative to project root) | This project only |

**Scope Resolution:**
1. Load user-level macros
2. Load project-level macros (if file exists)
3. Merge: project-level macros override user-level by name (same name = project wins)
4. Result: Union of both scopes with conflict resolution applied

**Atomicity & Durability:**
- All writes use temp file + atomic rename pattern
- Prevents corruption on simultaneous writes (rare in single-user CLI)
- Uses `fs.renameSync()` which is atomic on same filesystem

**Migration Strategy:**
- schemaVersion field allows future v2 migrations
- v1 reader must reject unknown versions with clear error
- If schemaVersion missing, assume v1 (backward compatible)

---

### 4. Install Script (`install.js`)

**Responsibility:**  
One-time setup. Runs via `node install.js` in the project root (or cloned repo). Idempotent — safe to run multiple times.

**Operations:**
1. Create directory structure:
   - `~/.claude/pmacros/` (hook storage)
   - `~/.claude/skills/pmacros/` (skill storage)
2. Copy hook script to `~/.claude/pmacros/hook.js`
3. Copy SKILL.md to `~/.claude/skills/pmacros/SKILL.md`
4. Register hook in `~/.claude/settings.json` under `hooks.UserPromptSubmit`
5. Optionally register status line command in `~/.claude/settings.json`
6. Verify or create initial `~/.claude/pmacros/macros.json` (empty template)

**Idempotency:**
- Check if hook already registered; skip if present (compare handler path or ID)
- Copy/overwrite files (ok on upgrades)
- Merge settings JSON carefully (don't clobber other hooks or config)

**Error Handling:**
- Validate `~/.claude/` directory exists; create if needed
- Fail gracefully on permission errors (suggest manual setup)
- Show clear instructions on success

**No External Dependencies:**
- Uses Node.js stdlib (fs, path, json)
- No npm install required

---

### 5. Status Line Command (`pmacro-status` or similar)

**Responsibility:**  
Shows available macro tags (for discoverability). Runs frequently, so must be fast.

**Output Format:**
```
Macros: <assint> <docgen> <custom-prompt>
```

**Implementation Strategy:**
- Shell script wrapper that calls a lightweight Node.js script
- Reads merged macros.json from both scopes
- Filters to show only tags with descriptions (optional filter)
- **Critical optimization:** Cache result in a temp file if unchanged (check file mtime)

**Performance Targets:**
- <50ms on cold run (read file + filter)
- <5ms on cached run (check mtime, return cached output)

**Error Handling:**
- On error, output empty or minimal status (don't block CLI)
- Never fail the command (status line failures are silent)

**Communicates With:**
- macros.json files (read-only, infrequent)
- Claude Code status line (via stdout)

---

## Data Flow

### Macro Expansion Flow (Happy Path)

```
1. User submits prompt in Claude Code
   │
2. Claude Code fires UserPromptSubmit hook
   │ (event JSON: { prompt, cwd, ... })
   │
3. ~/.claude/pmacros/hook.js receives event on stdin
   │
4. Hook resolves scopes:
   │  ├─ Read ~/.claude/pmacros/macros.json (user-level)
   │  └─ Read ./.claude/pmacros/macros.json (project-level, if exists)
   │
5. Merge macros (project overrides user on name collision)
   │
6. Expand macros based on mode:
   │  ├─ Manual: Find <tagname> in prompt, replace with value (position: inline/start/end)
   │  └─ Auto: Append/prepend all auto-mode macros to prompt
   │
7. Return JSON with modified prompt via stdout
   │ { "decision": "allow", "additionalContext": "...", ... }
   │
8. Claude Code appends additionalContext to conversation
   │
9. Claude processes expanded prompt
```

### CRUD Write Flow (Adding a Macro)

```
1. User runs /pmacro-add
   │
2. SKILL.md orchestrates via AskUserQuestion:
   │  ├─ What is the macro name? <user input>
   │  ├─ What is the value? <user input>
   │  ├─ Manual or auto mode? <user selects>
   │  ├─ Position? (inline/start/end, if manual) <user selects>
   │  └─ Description? <optional user input>
   │
3. SKILL.md reads current macros.json (user or project scope, user chooses)
   │
4. Validate new macro (name format, no duplicates in target scope)
   │
5. Append new macro to macros array
   │
6. Compute approximateTokens (estimate word count * 1.3)
   │
7. Write via atomic temp + rename:
   │  ├─ Write to ~/.claude/pmacros/macros.json.tmp (new scope)
   │  ├─ Rename .tmp to macros.json
   │  └─ On next prompt, hook picks up new macro
   │
8. Show confirmation to user
```

### Status Line Flow

```
1. Claude Code status line triggers periodically
   │
2. pmacro-status script runs
   │
3. Load merged macros (fast path if cached)
   │
4. Extract names from macros array
   │
5. Format as "Macros: <tag1> <tag2> ..."
   │
6. Output to stdout
   │
7. Claude Code displays in status bar
```

---

## Suggested Build Order

This order reflects dependencies and risk:

### Phase 1: Foundation (Hook + Config Schema)
1. Define `macros.json` schema
2. Implement hook script (`hook.js`)
   - Stdin/stdout JSON parsing
   - Single-scope macro expansion (user-level only)
   - Basic error handling (silent fallback)
3. Manual integration test: register hook in settings, verify tag expansion works

**Why first:** Hook is the core value. Prove tag expansion works before building CRUD.

### Phase 2: Install & Multi-Scope
1. Implement install script (`install.js`)
   - Copies hook to `~/.claude/pmacros/`
   - Registers hook in settings.json
2. Enhance hook to resolve multi-scope (user + project)
   - Load from both paths, merge with override logic

**Why here:** Distribute-able product. Multi-scope adds complexity but is needed for project-level overrides.

### Phase 3: CRUD Commands
1. Create SKILL.md with `/pmacro-add`, `/pmacro-list`, `/pmacro-update`, `/pmacro-remove`
2. Implement atomic file writes (temp + rename)
3. Validation (name format, duplicate checking)

**Why here:** CRUD builds on stable hook + schema. Safe to defer until core works.

### Phase 4: UX Enhancements
1. Status line command (`pmacro-status`)
2. `/pmacro-preview` command
3. Description field display in listing
4. Caching in status line for performance

**Why here:** Polish. Core functionality complete; these are discoverability + DX improvements.

---

## File Organization

```
pmacros/ (project root)
├── install.js                    (entry point for setup)
├── hook.js                       (core expansion logic, copied to ~/.claude)
├── SKILL.md                      (CRUD orchestrator, copied to ~/.claude/skills)
├── .planning/
│   └── research/
│       └── ARCHITECTURE.md       (this document)
└── README.md                     (user-facing docs)

~/.claude/ (user home, created by install.js)
├── pmacros/
│   ├── hook.js                   (copied from project)
│   ├── macros.json               (user-level macros, created on first macro add)
│   └── hook.log                  (optional, error logging)
├── skills/
│   └── pmacros/
│       ├── SKILL.md              (copied from project)
│       └── references/           (optional, detailed guides)
└── settings.json                 (updated to register hook)

project_root/.claude/ (project-specific, optional, user-managed)
└── pmacros/
    └── macros.json               (project-level macros, overrides user-level)
```

---

## Hook Script Execution Model

The hook runs **synchronously, blocking until exit**. This is acceptable because:

1. **Performance:** Typical file I/O (<50ms) + regex substitution (<1ms) = <100ms total
2. **Simplicity:** Sync I/O avoids complex async state (no promises/callbacks)
3. **Reliability:** Exit code controls flow; no race conditions
4. **Constraints:** Claude Code hook protocol expects synchronous execution

**Exit Code Semantics:**
- **0:** Success. Stdout is parsed as JSON; macro expansion result is used.
- **Non-0:** Error (treated as 2 for blocking, other codes ignored). Original prompt passed through.

**Stdout/Stderr:**
- Stdout: JSON with `{ "decision": "allow", "additionalContext": "..." }`
- Stderr: Unused (no error messaging to user; fail silently)

---

## macros.json Schema Rationale

### Why This Structure?

| Design Choice | Rationale |
|---|---|
| `schemaVersion` at root | Enables future migrations (v1 → v2); forward compatibility |
| `macros` array (not object) | Preserves insertion order; easier to sort/filter in UI |
| `mode` + `position` separate | `mode` controls when, `position` controls where; orthogonal concerns |
| `approximateTokens` computed | Informational only; updated at write time, not read time; avoids per-prompt cost |
| `createdAt` + `updatedAt` | Audit trail; enables "recent macros" features in v2 |
| No nested structures | Simpler parsing, fewer edge cases, easier to validate |

### Why NOT Alternatives?

| Alternative | Why Not |
|---|---|
| Config object (not array) | Can't preserve order; harder to list with original order |
| `tokenCount` exact (using API) | Adds runtime cost, external dependency, unreliable |
| Support nested macros (value references other tags) | Deferred to v2; adds recursion complexity, parsing ambiguity |
| Separate files per macro | Overhead on startup; harder to bulk migrate |

---

## Scope Resolution Algorithm

```javascript
function resolveScopes(cwd) {
  let user = {};
  let project = {};

  // Load user-level
  try {
    const userPath = path.join(os.homedir(), '.claude', 'pmacros', 'macros.json');
    user = JSON.parse(fs.readFileSync(userPath, 'utf8')).macros || [];
  } catch (e) {
    // File doesn't exist or is invalid; skip silently
  }

  // Load project-level
  try {
    const projectPath = path.join(cwd, '.claude', 'pmacros', 'macros.json');
    project = JSON.parse(fs.readFileSync(projectPath, 'utf8')).macros || [];
  } catch (e) {
    // File doesn't exist or is invalid; skip silently
  }

  // Merge: build a map, project overwrites user by name
  const merged = {};
  user.forEach(m => (merged[m.name] = m));
  project.forEach(m => (merged[m.name] = m)); // Project wins

  return Object.values(merged);
}
```

**Properties:**
- **Non-destructive:** Missing scopes don't break expansion; result is union
- **Project-wins:** Same name at both scopes → use project version
- **Deterministic:** Same inputs always produce same output

---

## SKILL.md Command Boundaries

### /pmacro-add
- Interactively prompt for: name, value, mode, position (if manual), description
- Validate name format
- Ask which scope (user or project)
- Check for duplicates in target scope
- Write to macros.json via atomic temp + rename

### /pmacro-list
- Show all merged macros (union of user + project)
- Display columns: name, mode, description, scope (user/project)
- Highlight project-level overrides of user-level

### /pmacro-update
- Ask which macro to update (by name)
- Show current value
- Interactively prompt for new values (fields to change)
- Validate
- Update in-place in macros.json

### /pmacro-remove
- Ask which macro to delete (by name)
- Confirm deletion
- Remove from macros.json

### /pmacro-preview (Optional Phase 4)
- Ask user to paste or describe a prompt
- Show expanded version
- Do NOT send to Claude

---

## Error Recovery & Resilience

| Failure Mode | Hook Behavior | User Impact |
|---|---|---|
| User-level macros.json malformed | Skip user scope, use project only | Prompts expand correctly if project macros valid; user-level ignored |
| Project macros.json malformed | Skip project scope, use user only | Prompts expand correctly if user macros valid; project-level ignored |
| Both scopes broken | Pass through original prompt | User loses macro expansion temporarily; can fix files or reinstall |
| Regex error in tag expansion | Catch, log, fall back to original prompt | Prompt sent as-is; user doesn't lose work |
| File read timeout (unlikely) | Synchronous fs reads don't timeout | N/A |
| Concurrent writes to macros.json | Last write wins (atomic rename) | Rare in single-user CLI; acceptable |
| Hook process crashes | Claude Code uses original prompt | User doesn't lose work |

**Design principle:** Fail soft, never block the user's workflow.

---

## Performance Targets & Assumptions

| Operation | Target | Notes |
|---|---|---|
| Hook execution (file I/O + expansion) | <100ms | Typical: 20–50ms for <100 macros |
| Status line command | <50ms cold, <5ms cached | Caching essential for frequent calls |
| CRUD write (add/update/remove) | <500ms | User-facing, can be slower; shows feedback |
| Macro lookup | O(n) where n = macro count | <1000 macros realistic; linear scan acceptable |

**Scaling assumptions:**
- Typical user has 10–30 macros per scope
- Typical project has 5–10 macros
- File size: <50KB even with 100 macros + metadata

---

## Confidence Assessment

| Area | Level | Notes |
|---|---|---|
| Hook design (event model, I/O) | **HIGH** | Claude Code docs are authoritative; standard practice for hooks |
| Multi-scope resolution logic | **HIGH** | Git config pattern is proven; straightforward merge algorithm |
| macros.json schema | **MEDIUM** | Design is sound; validation needed on real usage patterns |
| CRUD implementation (SKILL.md orchestration) | **MEDIUM** | SKILL.md format is documented; AskUserQuestion pattern is standard but untested with pmacros UX |
| Status line efficiency | **MEDIUM** | Caching strategy is sound; performance numbers are estimates pending profiling |
| Install script portability | **MEDIUM** | Node.js stdlib is portable; settings.json merge logic needs testing across existing configs |

---

## Critical Assumptions

1. **Hook is idempotent:** Same prompt input → same expansion output (no side effects)
2. **Scopes don't conflict on file level:** User and project macros.json don't interfere (different directories)
3. **Project root detection:** `cwd` from hook context is project root or subdirectory; script can find `.claude/` upwards
4. **Schema compatibility:** schemaVersion=1 reader never sees v2+ files (or tool handles upgrade)
5. **Tag format is unambiguous:** `<tagname>` inside macro values doesn't accidentally re-expand

---

## Next Steps (Phase-Specific Research)

- **Phase 2 (Install):** Test settings.json merge on complex existing configs; verify hook registration timing
- **Phase 3 (CRUD):** Validate AskUserQuestion UX with macros; test atomic writes on WSL2
- **Phase 4 (Polish):** Profile status line caching; measure real-world hook latency
- **Post-v1:** Consider nested macro expansion (v2 feature) and token budgeting strategies

---

## Sources

- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks)
- [Claude Code Skills Reference](https://code.claude.com/docs/en/skills)
- [Claude Code Settings & Scopes](https://code.claude.com/docs/en/settings)
- [Node.js stdin/stdout Patterns](https://blog.logrocket.com/using-stdout-stdin-stderr-node-js/)
- [JSON Schema Design Best Practices](https://json-schema.org/)
- [Configuration Scope Resolution (Git Model)](https://gist.github.com/lifuzu/9490352)
- [CLI Status Line Performance Optimization](https://www.mintlify.com/chongdashu/cc-statusline/guides/performance)
- [Hook Exit Code Semantics](https://stevekinney.com/courses/ai-development/claude-code-hook-control-flow)
