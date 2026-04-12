---
name: pmacro-preview
description: Show BEFORE and AFTER expansion of a prompt using stored macros, without sending the prompt. Use for /pmacro-preview.
disable-model-invocation: true
---

# /pmacro-preview

## Repo path

Replace `<REPO>` with the absolute path to the pmacros checkout (or workspace root).

## Flow

1. If the user did not pass prompt text, use **AskUserQuestion** to collect the full prompt (multi-line allowed as a single string answer).

2. Run (quote the prompt if it contains shell metacharacters):

   `node <REPO>/scripts/pmacro.cjs preview <paste prompt words...>`

   For multi-word prompts, pass all words after `preview` so the CLI joins them with spaces.

3. Show the `BEFORE:` and `AFTER:` blocks from stdout.
