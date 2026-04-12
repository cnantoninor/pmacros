# Codebase Concerns

**Analysis Date:** 2026-04-12

## Tech Debt

**Project-level macro scope (roadmap gap):**
- Issue: Product docs (`CLAUDE.md`, roadmap) describe user-level storage at `~/.claude/pmacros/macros.json` and project-level `.claude/pmacros/macros.json` with project overriding user. Phase 1 implements **user scope only** via `os.homedir()` in `lib/paths.cjs`.
- Files: `lib/paths.cjs`, `lib/macros-store.cjs`, `hooks/user-prompt-submit.cjs`, `scripts/pmacro.cjs`
- Impact: Teams cannot ship repo-local macro defaults or per-project overrides until Phase 2 merges paths and read order.
- Fix approach: Resolve `cwd`/session root from hook event (if exposed) or env, load and merge maps per roadmap; extend tests for override semantics.

**No automated installer:**
- Issue: `install.js` is not present; `docs/MANUAL-SETUP-PHASE1.md` requires hand-editing `~/.claude/settings.json` and copying skills.
- Files: `docs/MANUAL-SETUP-PHASE1.md`, `.planning/ROADMAP.md` (Phase 2)
- Impact: Higher misconfiguration risk, inconsistent hook paths, harder onboarding.
- Fix approach: Implement idempotent `install.js` as planned; validate JSON merge and absolute hook path.

**Incomplete CRUD surface:**
- Issue: CLI and skills support add/list/preview/status only. No update or remove commands.
- Files: `scripts/pmacro.cjs`, `.claude/skills/pmacro-add/SKILL.md` (no pmacro-update/remove yet)
- Impact: Users must hand-edit `macros.json` or re-add tags to change values.
- Fix approach: Phase 2 skills + `pmacro` subcommands mirroring store APIs.

**Unbounded error log:**
- Issue: `appendLog` appends indefinitely; comment references deferred rotation (D-13).
- Files: `lib/error-log.cjs`
- Impact: Long-running use can fill disk; `pmacro status` reads full log into memory when summarizing.
- Fix approach: Size- or time-based rotation, or tail-only reads for summary.

**Silent normalization drops in `macros.json`:**
- Issue: `readMacrosSync` skips macro keys that fail `validateTagName` and entries that fail `normalizeEntry` with no user-visible warning (only persistence in file).
- Files: `lib/macros-store.cjs`
- Impact: Hand-edited or merged files can appear “empty” for some tags without CLI feedback.
- Fix approach: Optional strict mode, lint command, or log warnings for dropped keys.

## Known Bugs

**None verified as runtime defects:** Observed behaviors align with documented decisions (e.g. invalid stdin JSON → exit 0, empty stdout, original prompt preserved per `docs/MANUAL-SETUP-PHASE1.md`).

**Fragile / edge behaviors (worth tests):**
- Oversized stdin (`MAX_STDIN_CHARS` in `hooks/user-prompt-submit.cjs`): exits 0 with empty stdout; **no automated test** covers this path.
- Files: `hooks/user-prompt-submit.cjs`, `test/hook-user-prompt-submit.test.cjs`

## Security Considerations

**Trusted hook path and repo:**
- Risk: Hook runs arbitrary Node from the cloned repo; compromised or malicious `user-prompt-submit.cjs` runs on every prompt submit.
- Files: `hooks/user-prompt-submit.cjs`, `docs/MANUAL-SETUP-PHASE1.md`
- Current mitigation: Documentation warns to use a trusted clone and careful `settings.json` merge.
- Recommendations: Document checksum/pinning for releases; keep hook stdlib-only to reduce supply-chain surface.

**Macro content as prompt injection:**
- Risk: Macro `value` strings are injected verbatim into the user prompt; a malicious or pasted `macros.json` could steer the model.
- Files: `lib/expand.cjs`, `~/.claude/pmacros/macros.json` (user-controlled)
- Current mitigation: Local file trust model; no network fetch.
- Recommendations: Team policy for shared `macros.json`; future optional signing or allowlists if scope expands.

**`settings.json` detection heuristic:**
- Risk: `pmacro status` treats hook as installed if `settings.json` contains substring `user-prompt-submit` — false positives possible (comments, unrelated paths).
- Files: `scripts/pmacro.cjs`
- Current mitigation: Labeled as “settings scan” in output.
- Recommendations: Parse JSON and validate hook command structure when stricter reporting is needed.

## Performance Bottlenecks

**Synchronous I/O on hot path:**
- Problem: Hook uses `fs.readFileSync` for stdin and macros, and `expandPrompt` builds full string replacements in memory.
- Files: `hooks/user-prompt-submit.cjs`, `lib/expand.cjs`, `lib/macros-store.cjs`
- Cause: Intentional for hook simplicity and predictability.
- Improvement path: Acceptable for typical prompt sizes; revisit if macro count or value sizes grow large.

**Full log read for status summary:**
- Problem: `cmdStatusSummary` reads entire `hook-errors.log` and splits lines.
- Files: `scripts/pmacro.cjs`, `lib/error-log.cjs`
- Cause: Simple implementation.
- Improvement path: Stream tail or maintain a small rotating summary file.

**Expansion output size:**
- Problem: `expandPrompt` does not cap output length; CLI caps single `add` values (`MAX_VALUE_LEN` in `scripts/pmacro.cjs`) but many substitutions could still yield very large prompts.
- Files: `lib/expand.cjs`, `scripts/pmacro.cjs`, `hooks/user-prompt-submit.cjs` (stdin cap only)
- Cause: Phase 1 scope.
- Improvement path: Optional max expanded length with pass-through or truncation policy.

## Fragile Areas

**Test isolation via `os.homedir` mutation:**
- Files: `test/macros-store.test.cjs`
- Why fragile: Patches `os.homedir` globally; unsafe if tests run concurrently without isolation.
- Safe modification: Keep `node --test --test-concurrency=1` in `package.json` or inject a path resolver dependency for tests.
- Test coverage: Core store paths covered; concurrent write/race tests not present (see `.planning/research/PITFALLS.md`).

**Atomic write temp file pattern:**
- Files: `lib/macros-store.cjs` (`writeMacrosAtomic`)
- Why fragile: `renameSync` must stay same-filesystem; temp name uses `pid` and `Date.now()` (collision extremely unlikely).
- Safe modification: Preserve temp+rename; avoid cross-device `macrosPath`.

**Hook stdout contract:**
- Files: `hooks/user-prompt-submit.cjs`
- Why fragile: Any stray `console.log` or thrown error after partial stdout write could break Claude Code’s JSON parsing.
- Safe modification: Only `writeSuccess` writes structured stdout; errors log and exit 0 with empty stdout.

## Scaling Limits

**`macros.json` in single file:**
- Current capacity: Practical limit is file size and parse time; no pagination or lazy load.
- Limit: Very large macro sets slow every hook invocation (full read + parse).
- Scaling path: Cache with mtime check, or split storage in later phases if needed.

**Stdin guard:**
- Current capacity: 32 MiB (`MAX_STDIN_CHARS` in `hooks/user-prompt-submit.cjs`).
- Limit: Events above cap skip expansion entirely (pass-through via empty stdout behavior).

## Dependencies at Risk

**Node.js stdlib only (intentional):**
- Risk: None from npm semver drift; behavior tied to Node LTS API stability.
- Impact: Low for declared stack.
- Migration plan: Pin documented Node major in README when added.

## Missing Critical Features

**Phase 2 backlog (not bugs):** Project macro override, `install.js`, status line integration, update/remove — tracked in `.planning/ROADMAP.md`.

## Test Coverage Gaps

**Hook:**
- What's not tested: stdin over `MAX_STDIN_CHARS`, macro read failure branch (stderr/logging only), concurrent hook invocations.
- Files: `hooks/user-prompt-submit.cjs`, `test/hook-user-prompt-submit.test.cjs`
- Risk: Regressions in guardrails or error paths go unnoticed.
- Priority: Medium

**Expansion:**
- What's not tested: Invalid tag characters inside `{{}}` matching regex edge cases, extremely large replacement strings.
- Files: `lib/expand.cjs`, `test/expand.test.cjs`
- Risk: Low for current regex (`TAG_IN_PROMPT_RE` in `lib/expand.cjs`).
- Priority: Low

**CLI:**
- What's not tested: `add` rejection paths (invalid tag, oversized value) beyond happy paths.
- Files: `scripts/pmacro.cjs`, `test/pmacro-cli.test.cjs`
- Risk: Medium for user-facing error messages and exit codes.
- Priority: Medium

---

*Concerns audit: 2026-04-12*
