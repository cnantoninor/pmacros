# External Integrations

**Analysis Date:** 2026-04-12

## APIs & External Services

**Claude Code hook protocol (UserPromptSubmit):**
- **Inbound contract** — Claude Code invokes `hooks/user-prompt-submit.cjs` as a subprocess and passes a JSON event on stdin (see `docs/MANUAL-SETUP-PHASE1.md`). The hook reads `event.prompt` when present (`hooks/user-prompt-submit.cjs`).
- **Outbound contract** — On success, stdout is a single JSON object with `hookSpecificOutput.hookEventName === "UserPromptSubmit"` and `hookSpecificOutput.updatedPrompt` set to the expanded prompt (`hooks/user-prompt-submit.cjs`, decision D-04 referenced in `docs/MANUAL-SETUP-PHASE1.md`).
- **No HTTP client** — No `fetch`, `http`, or third-party SDKs; integration is process stdin/stdout only.

**Slash-command UX (skills):**
- Skills under `.claude/skills/` (e.g. `.claude/skills/pmacro-add/SKILL.md`) instruct the model to run `node <REPO>/scripts/pmacro.cjs` for macro CRUD-style operations. This is orchestration documentation for Claude Code, not a separate API integration.

**Third-party SaaS / cloud APIs:**
- Not detected — no Stripe, Supabase, OpenAI SDK, or similar imports anywhere in `hooks/`, `lib/`, `scripts/`, or `test/`.

## Data Storage

**Databases:**
- None — no SQL, ORM, or remote datastore.

**File Storage:**
- **Local filesystem only** — User macro database: `~/.claude/pmacros/macros.json` (path helpers in `lib/paths.cjs`, read/write in `lib/macros-store.cjs`).
- **Append-only diagnostic log:** `~/.claude/pmacros/hook-errors.log` — JSONL lines via `lib/error-log.cjs` (`appendLog`). Comment in `lib/error-log.cjs` notes rotation is deferred (unbounded growth in Phase 1).

**Caching:**
- None — no in-memory cache layer beyond process-local variables.

## Authentication & Identity

**Auth Provider:**
- None in-repo. Trust boundary is the user’s machine and whichever path is registered in `~/.claude/settings.json` for the hook (`docs/MANUAL-SETUP-PHASE1.md` warns to only merge trusted command paths).

**Claude session identity:**
- Hook payload may include fields such as `session_id` in tests (`test/hook-user-prompt-submit.test.cjs`); the implementation does not call external auth services.

## Monitoring & Observability

**Error Tracking:**
- None — no Sentry or similar. Failures are appended to `hook-errors.log` and the hook still exits `0` (`hooks/user-prompt-submit.cjs`).

**Logs:**
- JSONL file at path from `getHookErrorsLogPath()` in `lib/paths.cjs`. The CLI `scripts/pmacro.cjs` command `status` reads this file and scans `~/.claude/settings.json` as a string for substring `user-prompt-submit` to infer hook registration (heuristic, not a structured API).

## CI/CD & Deployment

**Hosting:**
- Not applicable — distributed as a repository; users symlink or reference absolute paths to scripts.

**CI Pipeline:**
- Not detected in-repo — no `.github/workflows` or other CI config found during mapping. Tests are run locally via `npm test` (`package.json`).

## Environment Configuration

**Required env vars:**
- None for core behavior. Tests set `HOME` to temporary directories to redirect `~/.claude` resolution.

**Secrets location:**
- Not applicable — no API keys consumed by this codebase.

## Webhooks & Callbacks

**Incoming:**
- None over HTTP. The only “incoming” event stream is stdin JSON from Claude Code to the hook script.

**Outgoing:**
- None — no callbacks to remote URLs; stdout JSON is consumed by the host (Claude Code).

---

*Integration audit: 2026-04-12*
