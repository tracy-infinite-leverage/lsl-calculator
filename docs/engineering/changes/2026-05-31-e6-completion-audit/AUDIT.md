# E6 Completion Audit — 2026-05-31

**Author:** product-manager (proxied via main session)
**Branch at audit time:** `docs/E5.2-plan-review-2026-05-31` (clean working tree)
**Method:** merged-PR audit (`gh pr list --state merged --search "E6"`) + filesystem cross-check against `.specify/features/006-ui-design-system/{spec.md v0.4, tasks.md, impl-plan.md, dev-findings.md}` + LAUNCH-GUARD. epic-status.md NOT read first per CLAUDE.md status-verification procedure.

---

## Ground-truth corrections vs the kickoff brief

The kickoff brief asserted "E6.1 — not started." **False.** Filesystem evidence shows E6.1 substantially complete (engineering side):

| Task 1.x AC | Evidence on disk |
|---|---|
| 1.1 Brand source in-repo | [`docs/brand/apa-brand-source.pdf`](docs/brand/apa-brand-source.pdf) present |
| 1.2 Wordmark candidates | [`docs/brand/wordmark-candidates/`](docs/brand/wordmark-candidates/) has candidate-{a,b,c}.{svg,png} |
| 1.4 Final wordmark + favicons | [`docs/brand/final/wordmark/`](docs/brand/final/) has master SVG + 1x/2x/3x PNG + mono + white-on-navy variants; `app-icon/` + `og/` siblings present |
| 1.4 Build-time sync (no symlinks) | [`website/scripts/sync-brand-assets.mjs`](website/scripts/sync-brand-assets.mjs) wired to `prebuild`, `prestorybook`, `prebuild-storybook` in [`website/package.json`](website/package.json) |
| 1.5 Iconography direction doc | [`docs/brand/icon-direction.md`](docs/brand/icon-direction.md) present (filename slightly drifts from spec's `iconography-direction.md` — cosmetic) |

**One open item for E6.1:** Task 1.3 AC explicitly requires "operator sign-off recorded on the selected wordmark before Phase 2 begins" — confirm a sign-off note exists in `docs/brand/final/wordmark/README.md` or equivalent (not opened in this audit). If absent, record retroactively; Phase 2 already shipped against the selected wordmark, so this is bookkeeping not a blocker.

---

## E6.2 — Verified complete (16 PR cluster, all merged to `main`)

PRs #54..#90 merged 2026-05-27..2026-05-31. Filesystem cross-check:

- **All 16 shadcn variants present** in [`website/src/components/ui/`](website/src/components/ui/): accordion, alert, badge, button, card, checkbox, dialog, input, radio-group, select, switch, table, tabs, textarea, toast (Sonner), tooltip — each with `.stories.tsx`; subset also have `.test.ts`.
- **Brand barrel** in [`website/src/components/brand/`](website/src/components/brand/): Wordmark + Lockup + Icon with stories + `brand.test.ts`.
- **Tokens** ship via Tailwind v4 CSS-first in `globals.css` (spec §8.2 implementation note, recorded in PR #90); typed mirror at [`website/src/lib/design-tokens.ts`](website/src/lib/design-tokens.ts) + drift test.
- **Format helpers** at [`website/src/lib/format.ts`](website/src/lib/format.ts) + `text-rules.ts` (Task 2.7, PR #76 + #77 followup).
- **Self-hosted fonts** in [`website/public/fonts/`](website/public/fonts/): montserrat-{light,regular,semibold}.woff2 + source-sans-3-{light,regular,semibold}.woff2. **Note:** spec §5.1/§8.2 names "Source Sans Pro" but shipped artefact is Source Sans 3 (the current upstream rebrand of Source Sans Pro). Equivalent family; verify with operator that this substitution is acceptable and amend spec wording if so.
- **Tooling scripts** in [`website/scripts/`](website/scripts/): `audit-bundle.mjs` (Task 2.10), `csp-smoke.mjs` (Task 2.10b, PR #83), `a11y-storybook-once.mjs` (Task 2.1), `baseline-measure.mjs` (Task 2.2 baseline), `sync-brand-assets.mjs`.
- **axe-core E2E** lives at [`website/e2e/a11y.spec.ts`](website/e2e/a11y.spec.ts) — Task 2.8 deliverable (originally landed in PR #65, "formally closes" with Task 2.6 ✅ which completed via PR #84).
- **Test-folder diff guard** Task 2.11 shipped via PR #78.
- **Baseline metrics + CSP audit + test sanctity** docs all present: [`docs/qa/e6-baseline-metrics.md`](docs/qa/e6-baseline-metrics.md), [`docs/qa/e6-csp-audit.md`](docs/qa/e6-csp-audit.md), [`docs/qa/e6-test-sanctity.md`](docs/qa/e6-test-sanctity.md).

**Task 2.9 (Phase 2 acceptance gate)** is a "run the full suite green" verification. PR #93 close-out claims green; not separately re-run in this audit. Recommend re-running locally once before Phase 3 kickoff (`npm run test` + `npm run test:e2e` + axe + bundle audit + csp-smoke + diff-guard) to confirm zero drift since #93.

---

## What's left — confirmed by merged-PR audit

| Phase | Sub-epic | Status | Blocker |
|---|---|---|---|
| 1 | E6.1 wordmark + icon direction | ⚠ Engineering done; **operator sign-off bookkeeping outstanding** (Task 1.3 AC) | None |
| 2 | E6.2 tokens + component library | ✅ 16/16 shipped (PR #93 close-out); re-confirm green suite before next phase | None |
| 3a | E6.3 `/app` workspace shell | ❌ Not started — 11 tasks (3.1–3.10 + 3.3-bis) | **E5.1 must be merged to `main` first** (PR #67 merged, but verify `app/(app)/layout.tsx` slot exists) |
| 3b | E6.4 public calc re-skin | ❌ Not started — 8 tasks (4.1–4.8). Independent of E5 — can ship in parallel with 3a | None |
| 4 | E6.5 report pipeline foundation | ❌ Not started — 8 tasks (5.1–5.7 + 5.5-bis). `@react-pdf/renderer` already in lockfile per dev-findings PD-1 | None |
| 5a | E6.6a single + bulk-summary templates | ❌ Not started — 4 tasks (6.1–6.4) | Phase 4 |
| 5b | E6.6b liability + reconciliation | 🚫 **Out of scope this session** — blocks on E5.5 + E5.6 existing | E5.5/E5.6 |

Spec §3 mandates 3a depends on E5.1 merged; brief asserts E5.1 merged but I have not opened `app/(app)/layout.tsx` to verify the shell-slot is present. Verify at Phase 3a kickoff before any worktree opens.

---

## Hygiene flags surfaced by this audit

1. **12 locked worktrees in `.claude/worktrees/`** (output of `git worktree list`) — all from shipped E5.1 / E6.2 task work. These are stale and should be pruned before opening new phase worktrees (collision-risk surface). Not in audit scope; flagging for operator.
2. **epic-status.md likely stale** — last bullet under "E6" predates PR #84/#86/#93 close-out. PM should refresh against the merged-PR ledger at start of Phase 3.
3. **Source Sans Pro → Source Sans 3 naming drift** (see E6.2 fonts bullet). Cosmetic but worth amending the spec.
4. **Task 1.5 filename drift** — `docs/brand/icon-direction.md` vs spec's `iconography-direction.md`. Cosmetic.
5. **The 5 defects PR #94 surfaced in E5.2 planning** are unrelated to E6 — out of scope for this audit but worth noting they exist before opening new branches off `main`.

---

## Recommended next-action shape (operator decides)

Per the kickoff brief's sequencing instruction:

1. **Close out E6.1 bookkeeping** (operator-only — 5 min): confirm/record the wordmark sign-off in `docs/brand/final/wordmark/README.md`. No PR needed unless the file is absent.
2. **Open Phase 3a + 3b in parallel worktrees** once operator approves this audit:
   - `git worktree add ../lsl-e63 -b feat/E6.3-app-shell main`
   - `git worktree add ../lsl-e64 -b feat/E6.4-public-reskin main`
   - 3a hard-precondition: open `app/(app)/layout.tsx` and confirm the shell slot exists post-E5.1.
3. **Then Phase 4 (E6.5) + Phase 5a (E6.6a)** sequentially per spec §3.
4. **Stop at E6.6a**. Hand back a closeout doc + a checklist of what E6.6b needs from E5.5/E5.6.

**Carve-outs honoured per brief:** no engine code, no `tests/` modifications, no E5.1 auth re-skin, no `--no-verify`, no force-push, no `git add . / -A`, commit/PR bodies via `-F /tmp/msg.md`, one worktree per phase.

---

## Pause point

**No code changes will be made until the operator approves this audit.** Specifically requesting confirmation on:

- (a) Source Sans 3 vs Source Sans Pro — accept the substitution and amend spec, or swap the woff2 files.
- (b) Whether Task 1.3 sign-off note must be recorded before Phase 3 opens, or can be back-filled in parallel.
- (c) Sequencing — open 3a + 3b in parallel (recommended; spec §3 marks them parallel-able), or run sequentially.
- (d) Whether to prune the 12 stale `.claude/worktrees/*` before opening new phase branches (recommended).

---

## Resolution (operator confirmed 2026-05-31)

Operator response: "I'll do what you recommend for the 4 questions."

| Q | Action taken |
|---|---|
| (a) | Spec bumped to **v0.5**; live MUST clauses in §5.1, §5.7, §7.6, §8.2 renamed "Source Sans Pro" → "Source Sans 3" (Adobe's 2021 rename — same family). impl-plan.md + tasks.md updated for live mentions. Historical OQ-3 resolution and v0.2/v0.3/v0.4 Clarification Summaries preserved verbatim. v0.5 Clarification Summary added. |
| (b) | Sign-off **was already recorded** in [`docs/brand/wordmark-candidates/README.md`](../../../brand/wordmark-candidates/README.md) (Candidate B, approved Tracy Angwin 2026-05-28). The audit's "outstanding" flag was wrong. Added a discovery pointer at [`docs/brand/final/wordmark/README.md`](../../../brand/final/wordmark/README.md) so future readers landing in `final/wordmark/` find the canonical record. |
| (c) | Opened Phase 3a + 3b in parallel from `origin/main@77c325a`: `../lsl-e6-3` on `feat/E6.3-app-shell`, `../lsl-e6-4` on `feat/E6.4-public-reskin`. Verified `website/src/app/app/layout.tsx` shell-slot exists post-E5.1. |
| (d) | Pruned 8 stale `.claude/worktrees/agent-*` (all locking PIDs confirmed dead via `ps -p`). Left 4 in place: 3 E5.2 in-flight worktrees + 1 unknown (`agent-a1d9372ddb62dc7a2` — has untracked `docs/engineering/reviews/2026-05-31-E5.2-plan-review.md`; flagged to operator for separate decision). No branches deleted. |

Next step (operator-confirmed): dispatch developer agent for Phase 3a + 3b in parallel.
