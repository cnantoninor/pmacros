---
name: pmacro-list
description: List all stored prompt macros in a markdown table. Use when the user runs /pmacro-list or wants to see tags and previews.
disable-model-invocation: true
---

# /pmacro-list

## Repo path

Replace `<REPO>` with the absolute path to the pmacros checkout (or workspace root).

## Flow

1. Run:

   `node <REPO>/scripts/pmacro.cjs list`

2. Display the full CLI output to the user (Markdown table or the empty-state message).
