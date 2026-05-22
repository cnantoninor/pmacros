---
name: pmacro-update
description: Update an existing prompt macro's value or description. Use when the user wants /pmacro-update or to change the expansion text of an existing {{tagname}} macro. Requires the tag to already exist — use /pmacro-add for new macros.
disable-model-invocation: true
---

# /pmacro-update

## Repo path

Replace `<REPO>` with the absolute path to this pmacros git checkout (set once per session), or use the workspace root if this project is open in Claude Code.

Example: `REPO=/home/you/projects/pmacros`

## Flow

1. If the user already provided tag, value, and optional description as arguments to the slash command, run:

   `node <REPO>/scripts/pmacro.cjs update <tag> <value> [description...]`

   To update a project-level macro instead of the user-level one, add `--project`:

   `node <REPO>/scripts/pmacro.cjs update --project <tag> <value> [description...]`

   Quote `<value>` or the description if they contain spaces.

2. Otherwise use **AskUserQuestion** in order:

   - **Tag name** — must match `^[a-z0-9-]{1,32}$`. If invalid, explain and ask again.
   - **Scope** — user-level (default, `~/.claude/pmacros/macros.json`) or project-level (`.claude/pmacros/macros.json` under cwd). Ask if not clear from context.
   - **New macro value** (the text that will replace `{{tag}}` in prompts after the update).
   - **Optional description** (for `/pmacro-list`; leave blank to keep unchanged wording in value).

3. After collecting fields, run the `node … update` command with explicit arguments (add `--project` if project scope selected).

4. Show the command output (errors go to stderr). If the tag does not exist, the CLI exits non-zero with "not found" — inform the user and suggest `/pmacro-add` to create it.

## Validation

- Tag format is strict (lowercase alphanumeric + hyphens, 1–32 chars). Do not call the CLI until the tag is valid.
- The tag must already exist in the target scope. `update` will not create new macros.
