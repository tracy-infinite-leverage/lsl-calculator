# Launch checklist & artifacts

> ## ✅ LAUNCH GUARD — `ANTHROPIC_API_KEY` gate CLOSED 2026-05-27
>
> The PDF Removal sub-spec shipped on `feat/E5.0-pdf-removal`. The hard
> gate that required `ANTHROPIC_API_KEY` in Vercel Production is now moot
> — the consuming code (`/api/extract-pdf`, `/api/normalize-csv`, and
> related PDF parser modules) has been deleted. See
> [`LAUNCH-GUARD.md`](./LAUNCH-GUARD.md) for closure details.
>
> Operator follow-up after merge: remove the leftover `ANTHROPIC_API_KEY`
> env var from Vercel Production / Preview / Development scopes via the
> dashboard.

Everything Tracy needs to action before flipping the NSW LSL Calculator to
production. The code is done; what's left is human coordination.

## Pre-cutover checklist

In rough order of dependency:

- [x] PM signs off on the user-facing privacy notice (`/privacy`) — standard-tier copy approved 2026-05-23
- [x] PM signs off on the data-handling policy (`docs/engineering/data-handling-policy.md`) — standard-tier rewrite approved 2026-05-23
- [x] Branch protection enforced on `main` (CI must pass before merge)
- [x] Vercel production project `lsl-calculator` created on team `infiniteleverage-2` (Sydney region, root dir `website/`)
- [x] GitHub integration connected; preview build on `001-nsw-calculator` green (41s build)
- [x] Production domain `www.lslcalculator.com.au` live (DNS configured, Vercel domain configured — 2026-05-25). Standalone domain replaced the originally-planned `lsl.austpayroll.com.au` subdomain.
- [x] `ANTHROPIC_API_KEY` gate CLOSED 2026-05-27 (by deletion — PDF Removal slice `feat/E5.0-pdf-removal`). Operator follow-up: drop the leftover env var in Vercel.
- [x] PR #1 moved from draft → ready for review (28+ commits, 262/262 vitest, 20/20 Playwright, CI green)
- [ ] Final manual smoke on Vercel-issued URL after env var is set
- [ ] Tracy merges PR #1 → `main` (Vercel auto-deploys to production)
- [ ] First-hour telemetry watch on Vercel Analytics
- [ ] (Nice-to-have, post-launch) Switch to ZDR-enabled key when Anthropic approves; update privacy notice + policy to strengthen disclosure

### Deferred (not blocking launch)

_None._

## Order of operations once everything's confirmed

1. Tracy sends "ready to cutover" signal to dev agent.
2. Dev agent moves PR #1 from draft → ready for review.
3. Dev agent runs full local gate (typecheck + vitest + playwright + build).
4. Tracy merges PR #1 to `main` via GitHub UI.
5. Vercel auto-deploys; URL goes live.
6. Watch Vercel Analytics for first events (page views, custom funnel
   events).
7. Soft launch ✅.

## What can wait until post-launch

These are nice-to-haves that should NOT block the production cutover:

- Phase 4 Wave 3: bulk-mode PDF input, bulk CSV/PDF exports, bulk
  Playwright tests
- Phase 5 Wave 2: manual keyboard walkthrough (`docs/qa/wcag-walkthrough.md`),
  spec-gap copy decisions from `impl-plan.md` §11
- Phase 7: opt-in logins (email + password)
- Marketing content: the writer agent has everything it needs to start
  drafting once you give the green light. Source material is
  `docs/product/marketing-positioning.md` (Category A/B/C hook).
