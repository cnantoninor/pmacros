# Phase 1: Core Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 1-core-engine
**Areas discussed:** Hook output mechanism, Slash command UX, Token counting strategy, Error log & status behavior

---

## Hook Output Mechanism

### Q: How should the hook deliver the expanded prompt to Claude Code?

| Option | Description | Selected |
|--------|-------------|----------|
| JSON hookSpecificOutput.updatedPrompt | JSON with updatedPrompt — only mechanism that substitutes in place | ✓ |
| additionalContext injection | Appends expansion as context; doesn't substitute | |
| Plain stdout passthrough | Context injection via plain stdout | |

**User's choice:** JSON hookSpecificOutput.updatedPrompt
**Notes:** Required by EXPN-01 (inline replacement).

### Q: When a macro isn't found for a tag in the prompt, what should happen?

| Option | Description | Selected |
|--------|-------------|----------|
| Leave unchanged, silent | Pass through silently | |
| Leave unchanged, log + warn | Log to hook-errors.log, warn in status | |
| Strict — require macros.json match | Only expand known tags | |

**User's choice:** Free-text — proposed switching to `{{tagname}}` delimiter to avoid HTML collision, then log misses + surface warnings in status.
**Notes:** User raised tag format as a concern. Discussion pivoted to delimiter trade-off (see next Q).

### Q: Lock the tag format decision for Phase 1

| Option | Description | Selected |
|--------|-------------|----------|
| Switch to {{tagname}} + log misses + status warn | New delimiter, HTML-safe, meaningful miss warnings | ✓ |
| Keep <tagname> as specified | Honor original v1 spec, silent-on-miss only | |
| Support both delimiters | Maximum flexibility, doubles regex surface | |

**User's choice:** Switch to `{{tagname}}` + log misses + status warn
**Notes:** Overrides CLAUDE.md tag-format line and REQUIREMENTS.md UX-03. Planner must update both during Phase 1 execution.

---

## Slash Command UX

### Q: How should /pmacro-add collect the tag name, value, and description?

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-step AskUserQuestion flow | Sequential prompts | |
| Single-shot with arguments | `/pmacro-add tag "value" "desc"` | |
| Hybrid: args if provided, else prompt | Accepts both modes | ✓ |

**User's choice:** Hybrid
**Notes:** Most ergonomic — power users can one-shot, new users get guided flow.

### Q: How should /pmacro-preview work?

| Option | Description | Selected |
|--------|-------------|----------|
| Takes prompt text as argument | Inline before/after | ✓ |
| Prompts user to paste the text | AskUserQuestion driven | |
| Reads from a temp file | File-based | |

**User's choice:** Takes prompt text as argument
**Notes:** Simple and explicit.

### Q: What should /pmacro-list display per macro?

| Option | Description | Selected |
|--------|-------------|----------|
| Table: tag \| desc \| tokens \| preview | Dense Markdown table with truncated preview | ✓ |
| One block per macro with full value | Section per macro | |
| Compact: tag + description only | Minimal | |

**User's choice:** Table format
**Notes:** Information-dense and scannable.

---

## Token Counting Strategy

### Q: How should approximateTokens be computed, stdlib-only?

| Option | Description | Selected |
|--------|-------------|----------|
| Math.ceil(value.length / 4) | OpenAI rule of thumb | ✓ |
| Word count × 1.3 | Word-based heuristic | |
| Hybrid max(chars/4, words×1.3) | Defensive max | |

**User's choice:** chars/4
**Notes:** Field is "approximate" — precision is not the goal.

### Q: When is approximateTokens computed and stored?

| Option | Description | Selected |
|--------|-------------|----------|
| On every write to macros.json | Stable, read-side free | ✓ |
| Lazily on first read | Mutates storage on read — rejected | |

**User's choice:** On every write

---

## Error Log & Status Behavior

### Q: What format should hook-errors.log use?

| Option | Description | Selected |
|--------|-------------|----------|
| JSONL — one JSON object per line | Machine-parseable, greppable | ✓ |
| Plain text lines | Human-friendly, harder to parse | |

**User's choice:** JSONL
**Notes:** Enables /pmacro-status to extract structured fields.

### Q: Should hook-errors.log be size-capped or rotated?

| Option | Description | Selected |
|--------|-------------|----------|
| Soft cap: truncate at ~1MB | Bounded growth | |
| Unbounded (simplest) | No truncation | |
| Defer rotation entirely to Phase 2 | Tight Phase 1 scope | ✓ |

**User's choice:** Defer to Phase 2
**Notes:** Keeps Phase 1 minimal.

### Q: What should /pmacro-status surface?

| Option | Description | Selected |
|--------|-------------|----------|
| Health summary + last error + missed-tag warnings | Comprehensive | |
| Minimal: hook installed + macro count only | Bare minimum | |
| Verbose: full recent log tail | Raw dump | |

**User's choice:** Free-text — option #1 + macro count + interactive "show more errors? [n / all]" follow-up
**Notes:** User wants an interactive drill-down after the summary. `/pmacro-status` must support user-specified count or "all" to print additional log entries on demand.

---

## Claude's Discretion

Areas where the planner/researcher has flexibility (listed in CONTEXT.md §Decisions → Claude's Discretion):
- File layout inside the repo
- Atomic write temp-file naming
- `schemaVersion` initial value
- JSON indentation of macros.json
- Exact `{{tagname}}` matching regex
- Shared lib module vs inlined helpers
- Phase 1 test strategy

## Deferred Ideas

- Log rotation / size cap → Phase 2
- Supporting legacy `<tagname>` → rejected
- Real tokenizer (tiktoken) → rejected per stdlib-only constraint
- `schemaVersion` migration logic → no migration needed in Phase 1
