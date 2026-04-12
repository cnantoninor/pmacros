---
name: pmacro-status
description: Show pmacros hook detection, macro count, and recent hook-errors.log summary; optional tail of log lines. Use for /pmacro-status.
disable-model-invocation: true
---

# /pmacro-status

## Repo path

Replace `<REPO>` with the absolute path to the pmacros checkout (or workspace root).

## Flow

1. Run:

   `node <REPO>/scripts/pmacro.cjs status`

2. Show the summary (hook installed yes/no, macros path, macro count, last error in 24h, missed-tag warning count in 24h).

3. Use **AskUserQuestion** with choices for follow-up:

   - **none** — stop after the summary.
   - **number** — ask which positive integer `N`, then run `node <REPO>/scripts/pmacro.cjs status tail N` and print stdout.
   - **all** — run `node <REPO>/scripts/pmacro.cjs status tail all` and print stdout.

## Hook detection note

The CLI treats the hook as installed if `~/.claude/settings.json` contains `user-prompt-submit.cjs` or `user-prompt-submit` (substring match).
