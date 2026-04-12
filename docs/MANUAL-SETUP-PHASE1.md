# Manual setup (Phase 1)

Phase 1 does not ship `install.js` yet. Use this guide to register the `UserPromptSubmit` hook and copy skills from a **trusted** clone of the pmacros repository.

## Paths (runtime)

| Path | Purpose |
|------|---------|
| `~/.claude/pmacros/macros.json` | User-level macro storage (created on first `/pmacro-add`) |
| `~/.claude/pmacros/hook-errors.log` | JSONL log for hook warnings and errors (created on first write) |

## Hook: `UserPromptSubmit`

1. **Back up** `~/.claude/settings.json` before editing.
2. Add a hook entry whose command runs **Node** with the **absolute** path to this repo’s script:

   `hooks/user-prompt-submit.cjs`

   Example (replace `/absolute/path/to/pmacros` with your clone):

   ```json
   {
     "hooks": {
       "UserPromptSubmit": [
         {
           "matcher": "",
           "hooks": [
             {
               "type": "command",
               "command": "node /absolute/path/to/pmacros/hooks/user-prompt-submit.cjs"
             }
           ]
         }
       ]
     }
   }
   ```

3. **Stdin:** Claude Code sends the hook event as JSON on stdin. Do not wrap the command in a shell pipeline that consumes stdin (e.g. `echo | node …`).
4. **Security:** Only merge hook entries that point at a repo path you trust. Malformed JSON can break Claude Code configuration.

### Expected stdout (success)

Per project decision **D-04**, on success the hook prints JSON to stdout with:

- `hookSpecificOutput.hookEventName === "UserPromptSubmit"`
- `hookSpecificOutput.updatedPrompt` set to the expanded prompt text

### Expected behavior on failure

Per **D-05**, on any error the hook should log to `~/.claude/pmacros/hook-errors.log`, exit with code **0**, and print **no** stdout so the original prompt passes through unchanged.

Reference: [Claude Code Hooks](https://code.claude.com/docs/en/hooks) (`UserPromptSubmit`, `hookSpecificOutput`).

## Skills

Copy these directories from the repo into `~/.claude/skills/` (each directory must contain `SKILL.md`):

- `pmacro-add`
- `pmacro-list`
- `pmacro-preview`
- `pmacro-status`

Source in repo: `.claude/skills/<name>/SKILL.md`

Example:

```bash
REPO=/absolute/path/to/pmacros
for d in pmacro-add pmacro-list pmacro-preview pmacro-status; do
  mkdir -p "$HOME/.claude/skills/$d"
  cp "$REPO/.claude/skills/$d/SKILL.md" "$HOME/.claude/skills/$d/SKILL.md"
done
```

Phase 2 will automate hook registration and skill copy via `install.js`.
