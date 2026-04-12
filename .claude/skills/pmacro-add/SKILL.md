---
name: pmacro-add
description: Add or update a prompt macro (tag and expansion text) stored in ~/.claude/pmacros/macros.json. Use when the user wants /pmacro-add or to define a {{tagname}} macro.
disable-model-invocation: true
---

# /pmacro-add

## Repo path

Replace `<REPO>` with the absolute path to this pmacros git checkout (set once per session), or use the workspace root if this project is open in Claude Code.

Example: `REPO=/home/you/projects/pmacros`

## Flow

1. If the user already provided tag, value, and optional description as arguments to the slash command, run:

   `node <REPO>/scripts/pmacro.cjs add <tag> <value> [description...]`

   Quote `<value>` or the description if they contain spaces.

2. Otherwise use **AskUserQuestion** in order:

   - **Tag name** — must match `^[a-z0-9-]{1,32}$`. If invalid, explain and ask again.
   - **Macro value** (the text that replaces `{{tag}}` in prompts).
   - **Optional description** (for `/pmacro-list`).

3. After collecting fields, run the same `node … add` command with explicit arguments.

4. Show the command output (errors go to stderr). On success you may confirm the macro was saved.

## Validation

- Tag format is strict (lowercase alphanumeric + hyphens, 1–32 chars). Do not call the CLI until the tag is valid.
