---
name: pmacro-remove
description: Remove (delete) an existing prompt macro by tag name. Use when the user wants /pmacro-remove or to delete a {{tagname}} macro from storage. This is permanent — use /pmacro-list first to confirm the tag exists.
disable-model-invocation: true
---

# /pmacro-remove

## Repo path

Replace `<REPO>` with the absolute path to this pmacros git checkout (set once per session), or use the workspace root if this project is open in Claude Code.

Example: `REPO=/home/you/projects/pmacros`

## Flow

1. If the user already provided a tag as an argument to the slash command, run:

   `node <REPO>/scripts/pmacro.cjs remove <tag>`

   To remove a project-level macro instead of the user-level one, add `--project`:

   `node <REPO>/scripts/pmacro.cjs remove --project <tag>`

2. Otherwise use **AskUserQuestion** in order:

   - **Tag name** — must match `^[a-z0-9-]{1,32}$`. If invalid, explain and ask again.
   - **Scope** — user-level (default, `~/.claude/pmacros/macros.json`) or project-level (`.claude/pmacros/macros.json` under cwd). Ask if the context is ambiguous.

3. After collecting fields, run the `node … remove` command (add `--project` if project scope selected).

4. Show the command output (errors go to stderr). If the tag does not exist in the target scope, the CLI exits non-zero with "not found" — inform the user and suggest `/pmacro-list` to see what macros exist.

## Validation

- Tag format is strict (lowercase alphanumeric + hyphens, 1–32 chars). Do not call the CLI until the tag is valid.
- Deletion is permanent and cannot be undone. If the user seems uncertain, ask for confirmation first.
- `remove --project` only deletes from the project scope; the user-level macro (if any) remains untouched.
