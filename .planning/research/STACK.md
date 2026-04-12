# Technology Stack

**Project:** pmacros (Prompt Macro Injection System for Claude Code)  
**Researched:** 2026-04-12  
**Confidence:** HIGH (Official Claude Code documentation + verified Node.js stdlib patterns)

## Recommended Stack

### Core Hook Framework

| Technology | Version | Purpose | Why |
|-----------|---------|---------|-----|
| **Node.js** | 18+ (LTS) | Hook script runtime | Native on all Claude Code platforms; no install friction for end users; available everywhere |
| **Node.js stdlib: fs** | native | File I/O and atomic writes | `fs.writeFileSync`, `fs.renameSync`, `fs.readFileSync` provide atomic operations without external deps |
| **Node.js stdlib: path** | native | Path manipulation | Cross-platform path handling for ~/.claude/pmacros and .claude/pmacros |
| **Node.js stdlib: readline** | native | Stdin line-based parsing | Parse JSON from Claude Code hook events via stdin |
| **JSON stdlib (native)** | native | JSON parsing/serialization | `JSON.parse()` and `JSON.stringify()` — built-in, no external deps |

### Hook Protocol (UserPromptSubmit)

**Hook Type:** `command` (shell-invoked script)  
**Exit Codes:** 
- `0` = Success; stdout parsed for JSON or added as context
- `2` = Blocking error; stderr becomes user feedback, prompt rejected
- Other = Non-blocking error; stderr logged, execution continues

**Stdin Schema (UserPromptSubmit event):**
```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/session.jsonl",
  "cwd": "/current/working/directory",
  "permission_mode": "default|plan|acceptEdits|auto|dontAsk|bypassPermissions",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "user's actual prompt text"
}
```

**Stdout Schema (plain text approach, recommended for v1):**
```
Inject this text as additional context before Claude processes the prompt.
Macro expansions go here.
```

**Stdout Schema (JSON structured output, optional):**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "Text injected as context"
  }
}
```

**Exit with 0 for success** (allow prompt through with injected context). No exit 2 — macros always fail silently to never block user's workflow.

### Skill System (Slash Commands)

| Component | Format | Purpose |
|-----------|--------|---------|
| **Skill Directory** | `~/.claude/skills/pmacro-{cmd}/SKILL.md` | Define `/pmacro-add`, `/pmacro-list`, `/pmacro-update`, `/pmacro-remove` |
| **SKILL.md Frontmatter** | YAML between `---` markers | Metadata for skill discovery and invocation |
| **Frontmatter Fields** | `name`, `description`, `disable-model-invocation` | name: command slug; description: when to use; disable-model-invocation: true for manual-only |
| **Skill Content** | Markdown + inline shell commands | Instructions for `/AskUserQuestion` flow |

**SKILL.md Structure for /pmacro-add:**
```yaml
---
name: pmacro-add
description: Add or update a prompt macro. Use when you want to define a reusable text template with a tag name.
disable-model-invocation: true
---

[Instructions for collecting macro name, value, position, description]
Use /AskUserQuestion for interactive prompts.
```

**Skills to Create:**
1. `/pmacro-add` — Add/update a macro (manual only, set `disable-model-invocation: true`)
2. `/pmacro-list` — List available macros by scope and tag
3. `/pmacro-update` — Modify an existing macro
4. `/pmacro-remove` — Delete a macro
5. `/pmacro-preview` — Show prompt before/after expansion without sending

**Skill Registration:** Copy skills to both `~/.claude/skills/` (user-level, persistent) and `.claude/skills/` (project-level, committed).

### Status Line Integration

**Configuration Location:** `~/.claude/settings.json` or `.claude/settings.json`

**JSON Schema:**
```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/pmacros/status-line.js"
  }
}
```

**Stdin Data (Status event):**
```json
{
  "hook_event_name": "Status",
  "session_id": "abc123",
  "cwd": "/current/working/directory",
  "model": {
    "id": "claude-3-5-sonnet-...",
    "display_name": "Sonnet"
  },
  "tokens": {
    "input": 2048,
    "output": 512,
    "context_window": 200000,
    "input_tokens_remaining": 197440
  },
  "costs": {
    "input": 0.003,
    "output": 0.015,
    "total": 0.018
  }
}
```

**Stdout Output:**
```
📌 pmacros: 12 macros available (5 auto, 7 manual) | Model: Sonnet | Tokens: 2.5K/200K (1.2%)
```

**Status Line Refresh Rate:** Every 300ms (controlled by Claude Code, not pmacros)

### Install Script

| Component | Pattern | Purpose |
|-----------|---------|---------|
| **Entry Point** | `node install.js` | Idempotent setup from project root |
| **Skill Copy** | fs.copyFileSync hooks → `~/.claude/skills/` | User-level skills persist across projects |
| **Hook Registration** | Merge into `~/.claude/settings.json` | Add UserPromptSubmit hook entry |
| **Lock File** | `.claude/.pmacros-installed` | Idempotency marker; if exists, skip unless force flag |

## File Organization

```
pmacros/
├── install.js              # Idempotent install (no deps)
├── lib/
│   ├── hooks/
│   │   └── user-prompt-submit.js    # Hook script (stdin→stdout JSON)
│   ├── status-line.js               # Status line command
│   ├── macros.js                    # Load/save macros from ~/.claude/pmacros/
│   └── expansion.js                 # <tag> expansion logic
├── skills/
│   ├── pmacro-add/SKILL.md
│   ├── pmacro-list/SKILL.md
│   ├── pmacro-update/SKILL.md
│   ├── pmacro-remove/SKILL.md
│   └── pmacro-preview/SKILL.md
└── docs/
    └── PROTOCOL.md          # Hook stdin/stdout spec reference
```

## Atomic File Writes (Critical Pattern)

**Pattern: Temp File + Atomic Rename**

```javascript
const fs = require('fs');
const path = require('path');

function writeAtomically(filepath, data) {
  // 1. Generate unique temp filename
  const dir = path.dirname(filepath);
  const tempFile = path.join(dir, `.${path.basename(filepath)}.tmp.${Date.now()}`);
  
  // 2. Write to temp file (synchronous, safer for hook context)
  try {
    fs.writeFileSync(tempFile, data, 'utf-8');
  } catch (err) {
    fs.unlinkSync(tempFile); // Clean up on write failure
    throw err;
  }
  
  // 3. Atomic rename (atomic on POSIX and Windows same-filesystem)
  try {
    fs.renameSync(tempFile, filepath);
  } catch (err) {
    fs.unlinkSync(tempFile); // Clean up on rename failure
    throw err;
  }
}
```

**Why This Pattern:**
- Prevents partial/corrupt macros.json if hook crashes mid-write
- `fs.renameSync()` is atomic on Linux, macOS, WSL2 (all supported platforms)
- No external dependencies (stdlib only)
- Synchronous operations safe in hook context (timeout: 10 minutes default)

**Applied To:**
- `~/.claude/pmacros/macros.json` (user-level storage)
- `.claude/pmacros/macros.json` (project-level storage, git-ignored)
- Status line temp files (if needed)

## Hook Input/Output Implementation

**Reading stdin in Node.js (hook script pattern):**

```javascript
const readline = require('readline');

async function readInput() {
  let input = '';
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  // Collect all lines until EOF
  for await (const line of rl) {
    input += line;
  }
  
  return JSON.parse(input);
}
```

**Better pattern (single-line JSON expected from Claude Code):**

```javascript
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  const event = JSON.parse(input);
  // Process and output
  process.stdout.write('Injected context here');
  process.exit(0);
});
```

**Output context via stdout:**

```javascript
// Plain text approach (recommended for v1)
console.log('Expanded macro text here');
process.exit(0);

// JSON structured output (optional for v2)
console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'UserPromptSubmit',
    additionalContext: 'Expanded macros'
  }
}));
process.exit(0);

// Error handling (never blocks user)
console.error('Macro error (logged, prompt continues)');
process.exit(0); // Always exit 0 to allow prompt through
```

## Macro Storage Schema

**File:** `~/.claude/pmacros/macros.json` (user-level) or `.claude/pmacros/macros.json` (project-level)

```json
{
  "macros": [
    {
      "tag": "assint",
      "value": "You are an assistant specializing in...",
      "position": "start",
      "mode": "auto",
      "description": "Auto-prepend assistant context",
      "approximateTokens": 48,
      "createdAt": "2026-04-12T10:30:00Z",
      "updatedAt": "2026-04-12T10:30:00Z"
    },
    {
      "tag": "rtk-explain",
      "value": "The RTK (Rust Token Killer) is a token optimization...",
      "position": "inline",
      "mode": "manual",
      "description": "Explain RTK when <rtk-explain> appears",
      "approximateTokens": 156,
      "createdAt": "2026-04-11T15:20:00Z",
      "updatedAt": "2026-04-11T15:20:00Z"
    }
  ]
}
```

**Position Field:**
- `inline` — Replace `<tagname>` in-place where it appears
- `start` — Prepend to beginning of prompt
- `end` — Append to end of prompt

**Mode Field:**
- `manual` — Expand only when `<tagname>` appears in prompt
- `auto` — Always inject (start/end) regardless of tags in prompt

**Scope Resolution:**
1. Load project-level macros from `.claude/pmacros/macros.json`
2. Load user-level macros from `~/.claude/pmacros/macros.json`
3. Project macros override user-level on tag name collision
4. Apply expansions in order: start, inline, end

## Supporting Libraries (None — Stdlib Only)

**Why no external packages:**
- Minimizes install friction for end users
- Claude Code users may not have npm globally; install.js must work standalone
- Node.js stdlib is sufficient for: file I/O, path handling, JSON, stdin/stdout
- Avoids dependency versioning issues
- Simpler security audit surface (fewer moving parts)

**Available in stdlib:**
- `fs` — File I/O, atomic operations
- `path` — Cross-platform path handling
- `readline` — Line-based stdin parsing
- `crypto` (optional) — Temp filename uniqueness (use Date.now() instead)
- `JSON` — Native object serialization

**Not needed:**
- ❌ `write-file-atomic` — Manual temp+rename is sufficient
- ❌ `yargs` or `commander` — Slash commands use AskUserQuestion prompts
- ❌ `lodash` — No array/object manipulations beyond native methods

## Configuration Files (Not Committed)

**User-Level (~/.claude/):**
- `~/.claude/settings.json` — Hook registration (auto-merged by install.js)
- `~/.claude/pmacros/macros.json` — User's macros (git-ignored, persistent)
- `~/.claude/skills/pmacro-{cmd}/SKILL.md` — Skill files (auto-copied)

**Project-Level (.claude/):**
- `.claude/settings.json` — Project-specific hooks (committed)
- `.claude/pmacros/macros.json` — Project-specific macros (git-ignored)
- `.claude/skills/pmacro-{cmd}/SKILL.md` — Project-specific skills (committed)
- `.claude/.pmacros-installed` — Idempotency lock (git-ignored)

## Key Technical Decisions

| Decision | Rationale | Tradeoffs |
|----------|-----------|-----------|
| **Node.js stdlib only** | Zero install friction for users | Slightly more manual code for atomic writes |
| **Temp file + rename for atomicity** | Safe on POSIX and Windows same-filesystem | Cannot rename across filesystems (OK for ~/.claude/) |
| **Plain text stdout (v1)** | Simple; always fails silently | Cannot set session title or other structured outputs |
| **Copy skills (not symlink)** | Works if project moves; install.js upgrades by overwriting | Slightly more disk space; no auto-sync on skill updates |
| **Project macros override user** | Standard convention; project-specific context wins | Requires explicit merge/conflict resolution |
| **Status line as separate command** | Lighter weight than hook; can be disabled without restart | Requires separate registration in settings.json |
| **Slash commands via skills** | Auto-discoverable; AskUserQuestion for prompts; no restart needed | Cannot per-macro commands per v1 scope |

## Validation and Error Handling

**Hook Error Policy:** Always fail silently
- Parse errors on stdin → Log and pass through original prompt
- Macro expansion errors → Log and skip that macro
- File I/O errors → Log and pass through original prompt
- Exit code: Always 0 (never block user)

**Skill Error Policy:** Show feedback, allow recovery
- Missing macro → Show "Not found" in AskUserQuestion
- File permission errors → Suggest chmod or location
- Invalid JSON in macros.json → Show parse error, offer to fix

## Sources

- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks)
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide)
- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills)
- [Claude Code Statusline Documentation](https://code.claude.com/docs/en/statusline)
- [Node.js Readline Documentation](https://nodejs.org/api/readline.html)
- [npm/write-file-atomic (reference pattern)](https://github.com/npm/write-file-atomic)
