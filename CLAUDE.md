<!-- GSD:project-start source:PROJECT.md -->
## Project

**pmacros**

pmacros is a prompt macro injection system for Claude Code. Users define short `{{tagname}}` tags that transparently expand to longer text before Claude receives the prompt — via a `UserPromptSubmit` hook. Macros can be injected manually (only when the tag appears) or automatically on every prompt, and are stored locally per-user or per-project.

**Core Value:** Zero-friction prompt augmentation: define once, inject everywhere — without touching the prompt input.

### Constraints

- **Dependencies**: No external npm packages in the hook script or install script — Node.js stdlib only. Minimizes install friction for all users.
- **Compatibility**: Must work on Linux, macOS, and WSL2 (Windows). Atomic writes use `fs.renameSync` which is safe on same-filesystem temp files.
- **Error handling**: Hook must always exit 0 and never block the user's prompt, even on errors. Fail silently, pass through original prompt.
- **Tag format**: `{{tagname}}` only (double-brace delimiter). Names: lowercase alphanumeric + hyphens, 1–32 chars.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

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
- `0` = Success; stdout parsed for JSON or added as context
- `2` = Blocking error; stderr becomes user feedback, prompt rejected
- Other = Non-blocking error; stderr logged, execution continues
### Skill System (Slash Commands)
| Component | Format | Purpose |
|-----------|--------|---------|
| **Skill Directory** | `~/.claude/skills/pmacro-{cmd}/SKILL.md` | Define `/pmacro-add`, `/pmacro-list`, `/pmacro-update`, `/pmacro-remove` |
| **SKILL.md Frontmatter** | YAML between `---` markers | Metadata for skill discovery and invocation |
| **Frontmatter Fields** | `name`, `description`, `disable-model-invocation` | name: command slug; description: when to use; disable-model-invocation: true for manual-only |
| **Skill Content** | Markdown + inline shell commands | Instructions for `/AskUserQuestion` flow |
### Status Line Integration
### Install Script
| Component | Pattern | Purpose |
|-----------|---------|---------|
| **Entry Point** | `node install.js` | Idempotent setup from project root |
| **Skill Copy** | fs.copyFileSync hooks → `~/.claude/skills/` | User-level skills persist across projects |
| **Hook Registration** | Merge into `~/.claude/settings.json` | Add UserPromptSubmit hook entry |
| **Lock File** | `.claude/.pmacros-installed` | Idempotency marker; if exists, skip unless force flag |
## File Organization
## Atomic File Writes (Critical Pattern)
- Prevents partial/corrupt macros.json if hook crashes mid-write
- `fs.renameSync()` is atomic on Linux, macOS, WSL2 (all supported platforms)
- No external dependencies (stdlib only)
- Synchronous operations safe in hook context (timeout: 10 minutes default)
- `~/.claude/pmacros/macros.json` (user-level storage)
- `.claude/pmacros/macros.json` (project-level storage, git-ignored)
- Status line temp files (if needed)
## Hook Input/Output Implementation
## Macro Storage Schema
- `inline` — Replace `{{tagname}}` in-place where it appears
- `start` — Prepend to beginning of prompt
- `end` — Append to end of prompt
- `manual` — Expand only when `{{tagname}}` appears in prompt
- `auto` — Always inject (start/end) regardless of tags in prompt
## Supporting Libraries (None — Stdlib Only)
- Minimizes install friction for end users
- Claude Code users may not have npm globally; install.js must work standalone
- Node.js stdlib is sufficient for: file I/O, path handling, JSON, stdin/stdout
- Avoids dependency versioning issues
- Simpler security audit surface (fewer moving parts)
- `fs` — File I/O, atomic operations
- `path` — Cross-platform path handling
- `readline` — Line-based stdin parsing
- `crypto` (optional) — Temp filename uniqueness (use Date.now() instead)
- `JSON` — Native object serialization
- ❌ `write-file-atomic` — Manual temp+rename is sufficient
- ❌ `yargs` or `commander` — Slash commands use AskUserQuestion prompts
- ❌ `lodash` — No array/object manipulations beyond native methods
## Configuration Files (Not Committed)
- `~/.claude/settings.json` — Hook registration (auto-merged by install.js)
- `~/.claude/pmacros/macros.json` — User's macros (git-ignored, persistent)
- `~/.claude/skills/pmacro-{cmd}/SKILL.md` — Skill files (auto-copied)
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
- Parse errors on stdin → Log and pass through original prompt
- Macro expansion errors → Log and skip that macro
- File I/O errors → Log and pass through original prompt
- Exit code: Always 0 (never block user)
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
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
