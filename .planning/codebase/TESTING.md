# Testing Patterns

**Analysis Date:** 2026-04-12

## Test Framework

**Runner:**
- Node.js built-in test runner (`node:test`), invoked via `package.json` script.

**Config:** No separate Jest/Vitest config; configuration is entirely in `package.json`:

```json
"scripts": {
  "test": "node --test --test-concurrency=1"
}
```

**Assertion library:** `node:assert/strict` — use `assert.equal`, `assert.deepEqual`, `assert.ok`, `assert.match` for expectations.

**Run commands:**

```bash
npm test
# equivalent:
node --test --test-concurrency=1
```

`--test-concurrency=1` avoids parallel tests mutating shared process state (see module cache / homedir patterns below).

## Test File Organization

**Location:** All tests are under `test/` at the repository root (not co-located with `lib/` or `hooks/`).

**Naming:** `*.test.cjs` — e.g. `test/expand.test.cjs`, `test/macros-store.test.cjs`, `test/hook-user-prompt-submit.test.cjs`, `test/pmacro-cli.test.cjs`.

**Structure:** One file per concern area (pure expansion, storage, hook subprocess, CLI integration).

## Test Structure

**Suite organization:** Each file calls `test('description', () => { … })` one or more times. No nested `describe` blocks in the current suite.

**Example (unit-style, direct require):**

```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { expandPrompt } = require('../lib/expand.cjs');

test('expandPrompt replaces known tag', () => {
  const r = expandPrompt('hi {{ok}}', { ok: { value: 'there' } });
  assert.equal(r.text, 'hi there');
  assert.deepEqual(r.missedTags, []);
});
```

**Patterns:**
- **Isolation:** Integration tests create a temp directory with `fs.mkdtempSync(path.join(os.tmpdir(), 'pmacros-…'))` and pass `HOME: tmp` in `spawnSync` `env` so `~/.claude/pmacros` resolves inside the temp home.
- **Module reload:** When patching `os.homedir`, delete `require.cache` entries for `../lib/paths.cjs` and `../lib/macros-store.cjs` before `require`, then restore `os.homedir` in `finally` — see `test/macros-store.test.cjs`.
- **Assertions on subprocess output:** Use `assert.equal(r.status, 0, r.stderr)` to surface stderr on failure; parse JSON from `r.stdout.trim()` when validating hook output.

## Mocking

**Framework:** None. No Sinon, Jest mocks, or nock.

**Patterns:**
- **Filesystem:** Real `fs` writes under disposable temp dirs under `os.tmpdir()`.
- **Environment:** Merge `{ ...process.env, HOME: tmp }` (or similar) into `spawnSync` options.
- **Process API:** `spawnSync(process.execPath, [scriptPath, …args], { input, encoding, cwd, env, maxBuffer })` for black-box testing of `hooks/user-prompt-submit.cjs` and `scripts/pmacro.cjs`.

**What to mock:** Prefer patching only `os.homedir` plus `require.cache` clearing for tests that must load `paths.cjs` with a fake home without spawning a child.

**What NOT to mock:** Hook and CLI tests run the real Node entrypoints with real stdio and env — no stubbed `child_process`.

## Fixtures and Factories

**Test data:**
- Inline JSON objects and `JSON.stringify` for stdin payloads and `macros.json` seeds — see `test/hook-user-prompt-submit.test.cjs` (seeded `macros.json`) and `test/pmacro-cli.test.cjs` (synthetic `hook-errors.log` lines).

**Location:** No shared `fixtures/` directory; each test builds what it needs locally.

## Coverage

**Requirements:** None enforced; no `c8`, `nyc`, or `node --experimental-test-coverage` script in `package.json`.

**View coverage:** Not configured. To add coverage later, introduce a dev dependency and a separate npm script without changing the production constraint (hook/install remain stdlib-only).

## Test Types

**Unit tests:**
- `test/expand.test.cjs` — pure `expandPrompt` with in-memory macro maps; no I/O.

**Integration tests:**
- `test/macros-store.test.cjs` — atomic write/read/upsert against real files under fake `HOME`.
- `test/hook-user-prompt-submit.test.cjs` — subprocess runs `hooks/user-prompt-submit.cjs`; validates exit code 0, stdout JSON shape, and expansion behavior.
- `test/pmacro-cli.test.cjs` — subprocess runs `scripts/pmacro.cjs` with `cwd: repoRoot` and isolated `HOME` for add/list/preview/status flows.

**E2E tests:** Not present (no browser or full Claude Code session automation).

## Common Patterns

**Async testing:** All current tests are synchronous; no `async` test callbacks or `t.test` subtests.

**Error testing:** Hook invalid-JSON case asserts empty stdout and exit 0 — matching production “fail open” behavior rather than thrown exceptions.

**Buffers:** `maxBuffer: 10 * 1024 * 1024` on `spawnSync` to accommodate larger stdout in integration scenarios.

---

*Testing analysis: 2026-04-12*
