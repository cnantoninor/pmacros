# Feature Landscape: Prompt Macro Injection System (pmacros)

**Domain:** Claude Code snippet/macro management for prompt augmentation
**Researched:** 2026-04-12
**Research mode:** Ecosystem analysis of text expansion and prompt engineering tools

## Executive Summary

Text expansion tools (TextExpander, Espanso, Alfred, PhraseExpress) converge on a core set of table stakes features: create/edit/list/delete snippets, inline expansion with keyboard triggers, and basic organization (folders/tags). Differentiators emerge at the integration and context layer: templating systems (fill-in fields, nested macros, variables like dates/clipboard), team sharing, and platform-specific automation.

For Claude Code specifically, users already manage context through CLAUDE.md and skills files. A prompt macro system fills a workflow gap: injecting persistent, reusable prompt augmentations (system instructions, context chunks, persona frameworks) without editing the prompt input each time. The Claude Code ecosystem expects tight integration (hooks, status line discovery, slash commands) and declarative configuration (YAML/JSON), not GUI-based tools.

**Key insight:** Most text expanders serve rapid typing; pmacros serves prompt clarity. Table stakes for pmacros are simpler (no fill-in fields, team sharing, or scheduling), but differentiators center on Claude Code integration and prompt-specific semantics (context position control, preview-before-send, per-macro injection modes).

---

## Table Stakes

Features users expect. Missing = product feels incomplete or doesn't solve the core problem.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Create/list/update/remove macros via CLI** | Users need programmatic macro management without GUI; matches Claude Code's CLI-first model | Low | Slash commands (`/pmacro-add`, `/pmacro-list`, etc.) with interactive `AskUserQuestion` flow |
| **`<tagname>` expansion in prompts** | Core value: inject by tag reference, not manual paste | Low | Regex-based substitution of `<tagname>` literals in prompt text |
| **Inline (replace tag) vs auto (prepend/append)** | Different injection semantics; inline for contextual augmentation, auto for system-level context | Medium | Per-macro `position` field: `inline`, `start`, `end` |
| **Persistent storage (user + project scopes)** | Users expect macros to survive across sessions and be shareable at project level | Low | JSON files at `~/.claude/pmacros/macros.json` and `.claude/pmacros/macros.json` |
| **Scope collision handling** | Standard convention: project-level overrides user-level on name collision | Low | Resolution during load; documented behavior |
| **Preview before send** | Prompt macros change what Claude sees; users need confidence via `/pmacro-preview` | Low | Show before/after expansion without sending prompt |
| **Macro descriptions** | Users need to remember what `<ctx-arch>` expands to; short descriptions reduce friction | Low | Optional `description` field per macro |
| **Discoverability (status line)** | Users won't use macros they don't know exist; status line shows available tags | Medium | Status line command lists macro tags; requires integration with `settings.json` |
| **Token estimate field** | Users care about prompt cost; macro expansion adds tokens; should be visible | Low | `approximateTokens` computed at write time, informational only |
| **One-command installation** | Matching Claude Code's frictionless skill install; `node install.js` (idempotent) | Medium | Install copies files to `~/.claude/skills/` and `~/.claude/pmacros/` |
| **No external dependencies** | Claude Code runs everywhere; added tool must not require npm installs | High | Node.js stdlib only; critical constraint |
| **Atomic writes** | Prevent corrupt macros.json on concurrent access or crash | Low | Temp file + rename pattern; platform-safe on same filesystem |

---

## Differentiators

Features that set pmacros apart from generic text expanders and add value specific to Claude Code.

| Feature | Value Proposition | Complexity | Why Different from TextExpander/Espanso |
|---------|-------------------|------------|----------------------------------------|
| **Prompt-aware position control** | Fine-grained control over where macros inject in prompt (inline, start, end) — critical for prompt engineering | Medium | TextExpander/Espanso inject at cursor; pmacros injects at semantic boundaries (prompt structure aware) |
| **Auto-inject mode without tag reference** | Append/prepend to every prompt for system-level context (e.g., persona, guardrails) — transparent augmentation | Medium | Most text expanders require explicit trigger; pmacros makes augmentation invisible but configurable |
| **Claude Code hook integration** | Injects via `UserPromptSubmit` hook in `settings.json`, taps into Claude Code's native extension model | High | Tightly coupled to Claude Code; TextExpander/Espanso are generic OS-level tools |
| **Skill system integration** | Macros discoverable in status line, installable as skills; native Claude Code UX | High | Skill system is Claude Code specific; no equivalent in generic tools |
| **Per-prompt macro context** | Macros can reference project-level context (e.g., `.claude/pmacros/` for project-specific system instructions) | Medium | Matches Claude Code's project-level CLAUDE.md pattern; text expanders don't reason about project structure |
| **Stateless, server-less expansion** | No cloud sync, no accounts, no UI process; 100% local, 100% deterministic | High | TextExpander requires subscriptions/cloud; Espanso is local but more complex; pmacros is minimal |
| **Preview without sending** | `/pmacro-preview` shows what Claude will receive; critical for prompt engineering confidence | Medium | No equivalent in generic text expanders; prompt-specific value |
| **Escape mechanism for literal tags** | Users can write `<literal>` in prompts without accidental expansion; simple escape syntax | Low | Preserves flexibility; minor feature but important for robustness |

---

## Anti-Features

Features to explicitly NOT build (v1 scope).

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Nested macros** (macro values ref other macros) | Adds recursion complexity, cycles management, and minimal v1 demand. Users ask "I need to reuse a chunk" but workaround is copy-paste or external templating | Defer to v2. Recommend users split large macros or use CLAUDE.md for shared context |
| **Conditional logic** (if/else, templating language) | Conflicts with simple text-substitution model; adds language design and testing burden | Keep macros as pure text. Complex logic belongs in CLAUDE.md (system-level) or skills (on-demand) |
| **Fill-in-the-blank forms** (TextExpander style) | Friction for CLI; interrupts flow. Prompts need context up-front, not interactive fields | Out of scope. Users can edit macros manually if they need variation; `<tag>` is meant for stable text |
| **Team sharing / cloud sync** | pmacros is single-user local tool; team sharing requires auth, sync logic, and conflict resolution | Out of scope indefinitely. Recommend: project-level `.claude/pmacros/` + git version control |
| **Macro scheduling / time-based expansion** | Not relevant for on-demand prompt augmentation | Out of scope. Macros are data, not scheduled actions |
| **Usage analytics / token tracking** | Tempting but adds state management and doesn't affect core value | Defer to v2; `approximateTokens` field provides visibility without tracking |
| **Per-macro slash commands** (`/pmacro:assint`) | Requires Claude Code skill reload on new macro; couples macro management to skill system | Use status line discovery instead; simpler, no restart |
| **GUI, web interface, marketplace** | Contradicts CLI-native model; adds server/deploy infrastructure | Out of scope indefinitely. pmacros is a local tool; distribution via GitHub/docs |

---

## Feature Dependencies

Dependency graph showing which features enable others.

```
Persistent storage (user + project)
├─ CRUD operations (depend on reading/writing JSON)
├─ Scope collision handling (depends on loading both scopes)
└─ Status line discoverability (depends on reading macro metadata)

<tagname> expansion
├─ Preview command (depends on expansion logic)
└─ Escape mechanism (depends on tag-matching logic)

Installation
├─ One-command idempotency (copies files, sets up hooks)
└─ Hook integration (depends on installation defining hook paths)

All features above
└─ No external dependencies (HARD CONSTRAINT — all must use stdlib only)
```

---

## Feature Prioritization for MVP

### Must-Have (v1 release)

1. **CRUD operations via slash commands** — Core interaction model; without this, no way to manage macros
2. **`<tagname>` expansion (inline mode)** — Core value proposition; tag-based injection
3. **Persistent storage (user-level)** — Macros must survive sessions; user-level scope is minimum viable
4. **Preview command** — Users need confidence; shows before/after without sending
5. **One-command install** — Frictionless setup; critical for adoption
6. **No external dependencies** — Hard constraint; affects all decisions

### Should-Have (v1 or shortly after)

7. **Auto-inject mode (start/end)** — High-value differentiation for system-level context
8. **Project-level scope + collision handling** — Matches Claude Code's project-level patterns
9. **Status line discoverability** — Users won't use macros they don't know exist
10. **Macro descriptions** — Minimal friction to remember what each tag does
11. **Token estimate field** — Users care about cost; visibility matters

### Nice-to-Have (v2+)

12. **Escape mechanism for literal tags** — Robustness; can be added later
13. **Atomic writes** — Defensive; good practice but not blocking v1
14. **Skill system integration** — Polish; status line + CLI is sufficient for v1

---

## Implementation Complexity Estimates

| Feature | Complexity | Effort | Risk | Notes |
|---------|-----------|--------|------|-------|
| CRUD (create, list, update, delete) | Low | 1-2 days | Low | Straightforward JSON CRUD; CLI interaction via `AskUserQuestion` |
| `<tagname>` expansion | Low | 0.5-1 day | Low | Regex substitution; deterministic behavior |
| Inline vs auto positioning | Medium | 1-2 days | Low | Per-macro field; expansion logic splits on position |
| User + project scopes | Medium | 1-2 days | Medium | Load both, resolve collisions; test cross-project behavior |
| Preview command | Low | 0.5-1 day | Low | Runs expansion, shows diff; no new logic |
| Status line integration | Medium | 1-2 days | Medium | Reads macro metadata; integration with `settings.json` command |
| One-command install | Medium | 1-2 days | Low | Copy files, update hook paths; must be idempotent |
| Token estimation | Low | 0.5-1 day | Low | Rough count on write; informational only |
| Escape mechanism | Low | 0.5-1 day | Low | Special `\<tag>` syntax; preprocessing step |
| Atomic writes | Low | 0.5-1 day | Medium | Temp file + rename; test on Linux/macOS/WSL |

---

## Success Metrics

| Metric | How to Measure | Target for v1 |
|--------|----------------|---|
| **Adoption** | Users running `node install.js` | N/A (launch + gather feedback) |
| **Core feature usage** | Slash command invocations (logged in hook; deferred to v2) | N/A (v1 observability minimal) |
| **Expansion accuracy** | 100% of `<tagname>` matches expand; no false positives | Test suite: 30+ regex test cases |
| **Reliability** | Hook never blocks user prompt; graceful failure on errors | Exit code 0 always; no prompt delays |
| **Friction to onboarding** | Time from first macro CRUD to sending prompt with expansion | < 5 minutes per user (qualitative) |
| **Token prediction accuracy** | `approximateTokens` within ±10% of actual | Spot-check samples; rough estimates okay |

---

## Feature Interactions and Risks

### Risk 1: Token estimate becomes stale
**Scenario:** User edits macro.json manually; `approximateTokens` field becomes inaccurate.
**Mitigation:** Field is informational only; document as "approximate." Recompute on each `/pmacro-update`.

### Risk 2: Auto-inject mode too aggressive
**Scenario:** User enables auto-inject for 3 macros; each prompt becomes bloated; feedback loop breaks ("macros add too much").
**Mitigation:** Keep auto-inject optional and per-macro. UI discourages overuse (show total auto-injected tokens in status line). v2 can add "auto-inject groups" to batch them.

### Risk 3: Scope collision confusion
**Scenario:** User has `<ctx>` at user level and project level; doesn't understand which one was used.
**Mitigation:** `/pmacro-list` shows scope; `preview` command shows which macro was expanded. Documentation clear.

### Risk 4: Escape syntax friction
**Scenario:** User types `\<tag>` intending literal; escape mechanism adds cognitive load.
**Mitigation:** Defer to v1.1; basic escape via `\\<tag>` is simple and documented. Low friction once learned.

---

## Roadmap Implications

Based on research, suggested phase structure for pmacros development:

**Phase 1 (MVP core):** CRUD operations, inline expansion, user-level storage, preview command, minimal install
- Validates core value: "Can users define and inject macros?"
- No cloud, no team features, no nested macros — keeps scope tight

**Phase 2 (Claude Code integration):** Project-level scopes, auto-inject mode, status line, skill system integration
- Differentiates from generic tools; taps Claude Code's strength (local, extensible)
- Higher confidence in market fit; users want system-level context augmentation

**Phase 3 (Polish):** Escape mechanism, token tracking, usage analytics, performance optimization
- v2 features: nested macros, conditional logic (if demand emerges)
- Market validation complete; roadmap clearer

**Avoid (indefinitely):** Team sharing, cloud sync, GUI, marketplace, macro scheduling, fill-in forms
- Keep tool focused: single-user, local, deterministic, CLI-native

---

## Sources

- [Espanso vs TextExpander Compared (2026)](https://textexpander.com/blog/espanso-vs-textexpander)
- [Alfred vs TextExpander: Do You Need Both? (2026)](https://textexpander.com/blog/alfred-vs-textexpander)
- [Best Alfred Alternatives for Mac in 2026](https://textexpander.com/blog/alfred-alternatives)
- [TextExpander Advanced Snippet Elements](https://textexpander.com/learn/using/snippets/advanced-snippet-elements)
- [TextExpander Advanced Fill-In Syntax](https://textexpander.com/learn/using/snippets/snippet-fill-ins/advanced-fill-in-syntax)
- [PhraseExpander 5 New Features](https://www.phraseexpander.com/phraseexpander-5-new-features/)
- [The Ultimate Guide to Text Expanders](https://www.typedesk.com/blog/the-ultimate-guide-to-text-expanders-boost-your-productivity-today)
- [Extend Claude Code - Claude Code Docs](https://code.claude.com/docs/en/features-overview)
- [Claude Code Workflows](https://github.com/shinpr/claude-code-workflows)
- [Awesome Claude Code](https://github.com/hesreallyhim/awesome-claude-code)
- [Claude Code Extensions Explained](https://muneebsa.medium.com/claude-code-extensions-explained-skills-mcp-hooks-subagents-agent-teams-plugins-9294907e84ff)
- [Claude Prompt Engineering Best Practices](https://claude.com/blog/best-practices-for-prompt-engineering)
- [The 2026 Guide to Prompt Engineering - IBM](https://www.ibm.com/think/prompt-engineering)
- [Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Prompt Engineering Best Practices 2026 - UC Strategies](https://ucstrategies.com/news/prompt-engineering-best-practices-in-2026-the-ultimate-guide-to-better-ai-prompts/)
