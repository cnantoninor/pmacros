---
phase: 02
slug: full-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node --test`) |
| **Config file** | `package.json` → `"test": "node --test --test-concurrency=1"` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15–45 seconds (grows with new test files) |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-T* | 01 | 1 | STOR-02 | T-install / — | Merge never throws on one bad JSON side | unit + hook | `npm test` | ✅ | ⬜ pending |
| 02-02-T* | 02 | 2 | CRUD-03, CRUD-04 | — | Atomic writes; valid tags only | unit + CLI | `npm test` | ✅ | ⬜ pending |
| 02-03-T* | 03 | 3 | INST-01–03, UX-01 | T-settings | Tests use fake `HOME`, not real `~/.claude` | unit + subprocess | `npm test` | ✅ | ⬜ pending |
| 02-04-T* | 04 | 4 | INST-03 (docs/CI) | — | Public workflow read-only on repo | CI config | `npm test` + GH Actions | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- **Existing infrastructure covers all phase requirements** — Phase 1 already established `node --test` and subprocess patterns; Phase 2 adds files under `test/*.test.cjs` only.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Claude Code shows status line tags after install | UX-01 | Requires local Claude Code | Run `node install.js` with real checkout; open Claude Code; confirm footer lists macro tags; add macro via `/pmacro-add`; confirm line updates on next status render |
| WSL2 + macOS install smoke | INST-03 | Not all OSes in free CI | On each OS: fresh `HOME` copy, run `node install.js` twice (second is no-op); verify `settings.json` contains hook + status line once |

---

## Validation Sign-Off

- [ ] All tasks have `<verify>` with `npm test` or equivalent
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
