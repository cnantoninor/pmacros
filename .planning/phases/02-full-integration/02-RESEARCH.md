# Phase 2: Full Integration — Technical Research

**Phase:** 02-full-integration  
**Date:** 2026-04-12  
**Question answered:** What do we need to know to plan project–user macro merge, CRUD scope routing, idempotent `install.js`, and status line integration?

---

## 1. Current implementation baseline

- **`lib/paths.cjs`** — Only `~/.claude/pmacros/*`; no project resolver.
- **`lib/macros-store.cjs`** — `readMacrosSync` / `writeMacrosAtomic` / `upsertMacro` target user file only; `readMacrosSync` throws on invalid JSON (hook catches and pass-throughs).
- **`hooks/user-prompt-submit.cjs`** — Single `readMacrosSync()`; expansion via `expandPrompt`.
- **`scripts/pmacro.cjs`** — `list` / `preview` use user `readMacrosSync` only; no merge.
- **Tests** — `node --test`, isolated `HOME` for CLI tests; hook tests inject JSON with `prompt` field.

---

## 2. Merge semantics (STOR-02, CONTEXT D-01)

- **Inputs:** User file `~/.claude/pmacros/macros.json` and project file `.claude/pmacros/macros.json` (relative to chosen project root).
- **Algorithm:** Parse each side independently. For each side, invalid or missing file ⇒ treat as empty `macros: {}` (no throw from merge entrypoint). Shallow-merge macro **maps**: start with user entries, then overlay project entries (project keys win on collision).
- **Schema:** Reuse same shape as Phase 1 (`schemaVersion` + `macros`). Merged map is a plain `Record<tag, normalizedEntry>` for expansion only; writers still persist full documents to **one** file at a time (user or project scope).
- **Shared API:** One module function e.g. `getMergedMacrosForCwd(cwd)` returning `{ macros, errors? }` or throw-free `{ macros }` + optional log callbacks for hook/CLI/statusline.

---

## 3. Project root resolution (CONTEXT D-02)

- **Hook:** Parse stdin JSON; check for documented workspace fields (Claude Code evolves — common patterns include `cwd`, `workspaceRoot`, or nested `session` metadata). **Implementation approach:** defensively read known optional string fields; if none set, use `process.cwd()`.
- **Status line:** Same rule with `process.cwd()` when the status command runs (Claude spawns the command with workspace cwd in normal use).
- **Documentation:** `README` / install docs must state the `cwd` assumption when no workspace field exists.

---

## 4. CLI update/remove scope (CONTEXT D-03–D-05)

- **Subcommands:** `pmacro update <tag> <value> [description...]` and `pmacro remove <tag>` mirroring `add` validation (`validateTagName`, `MAX_VALUE_LEN`).
- **Target file:** Default **user** `macros.json`. Optional **`--project`** flag: read-modify-write `.claude/pmacros/macros.json` under `process.cwd()` (create parent dirs on write). If tag exists in project file, `update`/`remove` affect project when `--project` is set; otherwise user file only (simplest deterministic rule).
- **STOR-04:** Always `readMacrosSync` (or scope-specific read) immediately before atomic write on every mutation path.

---

## 5. `install.js` (INST-01 — INST-03)

- **Entry:** Repo-root `install.js`, stdlib only, `node install.js` / `node install.js --force`.
- **`~/.claude/settings.json`:** Read if exists; parse JSON; ensure `hooks.UserPromptSubmit` array exists; append hook command if no entry matching this repo’s `user-prompt-submit.cjs` path (absolute path built from `__dirname` + relative path to `hooks/user-prompt-submit.cjs`). Same pattern for `statusLine.command` string (single Node invocation of `scripts/pmacro-statusline.cjs`).
- **Idempotency:** Re-running does not duplicate hook entries (string match or normalized path compare); does not remove unrelated hooks.
- **Backup (INST-02):** Before overwriting `~/.claude/skills/pmacro-*/SKILL.md`, if content differs from repo source, copy to `SKILL.md.pmacros-backup.<timestamp>` or adjacent `.backup` per REQUIREMENTS.
- **Lock file:** Write `.claude/.pmacros-installed` in **project** when install succeeds; if present and not `--force`, skip mutating user settings/skills (document).
- **Cross-platform:** Use `path.join`, `os.homedir`, no shell. CI matrix (Linux + macOS) validates `node install.js` in test with temp `HOME` and temp “project” dir.

---

## 6. Status line script (UX-01)

- **Script:** e.g. `scripts/pmacro-statusline.cjs` — computes merged macro map for `process.cwd()`, prints **one line**: space-separated sorted tag names only (no values). Max width: truncate with `…` if over e.g. 120 chars (discretion).
- **Exit:** Always `0`; on failure print empty line or `pmacros` fallback — never non-zero (avoid breaking Claude Code CLI).
- **Registration:** `install.js` sets `statusLine.command` to absolute path + `node`.

---

## 7. Skills

- Add `.claude/skills/pmacro-update/SKILL.md` and `pmacro-remove/SKILL.md` (copy to user skills dir on install).
- Mirror Phase 1 pattern: `disable-model-invocation: true`, `<REPO>` placeholder for `node scripts/pmacro.cjs …`.

---

## 8. Test strategy

- **Unit:** Merge tests — user-only, project-only, collision (project wins), one side invalid JSON.
- **Hook:** Extend subprocess tests: temp HOME + temp “project” tree; set `cwd` in spawn; stdin JSON with `prompt` and optional workspace field if implemented.
- **CLI:** `update`/`remove` with isolated HOME and `--project` in temp project dir.
- **Install:** Temp `HOME`, copy minimal repo layout, run `install.js`, assert `settings.json` structure and idempotent second run.
- **Status line:** Subprocess with env/cwd, assert stdout line contains expected tags order.

---

## Validation Architecture

- **Dimension 8 (Nyquist):** Every implementation plan task must include `<verify>` with `node --test` or a scoped test file; merge and install behaviors must have automated tests. INST-03 manual sign-off remains for a real macOS/WSL2 smoke run outside CI.
- **Security testing:** Install tests must not write to real `~/.claude` — always `HOME` override in tests.
- **Regression:** Full suite `npm test` after each wave.

---

## RESEARCH COMPLETE
