# Launch checklist & artifacts

> ## 🛑 LAUNCH GUARD — `ANTHROPIC_API_KEY` must be set in Production env
>
> Before merging PR #1 to `main`:
>
> 1. Get a production API key from https://console.anthropic.com (ZDR is
>    nice-to-have, not required — the privacy notice has been written to
>    match Anthropic's standard commercial terms).
> 2. Set it via `vercel env add ANTHROPIC_API_KEY production` (interactive
>    paste) or the Vercel dashboard.
> 3. Trigger a preview build + curl `/api/normalize-csv` on the preview URL
>    to confirm 200, not 503.
>
> Full guard at [`LAUNCH-GUARD.md`](./LAUNCH-GUARD.md).

Everything Tracy needs to action before flipping the NSW LSL Calculator to
production. The code is done; what's left is human coordination.

## Drafted emails

Copy-paste the body (or open in Mail.app on macOS — the `.eml` file
imports directly):

| File | Purpose | Recipient |
|---|---|---|
| [`anthropic-no-retention-confirmation.eml`](./anthropic-no-retention-confirmation.eml) | Confirm enterprise no-retention contract is in place for production traffic | Anthropic account team |

Placeholder `[fill in]` lines for recipient name/email.

## Pre-cutover checklist

In rough order of dependency:

- [x] PM signs off on the user-facing privacy notice (`/privacy`) — standard-tier copy approved 2026-05-23
- [x] PM signs off on the data-handling policy (`docs/engineering/data-handling-policy.md`) — standard-tier rewrite approved 2026-05-23
- [x] Branch protection enforced on `main` (CI must pass before merge)
- [x] Vercel production project `lsl-calculator` created on team `infiniteleverage-2` (Sydney region, root dir `website/`)
- [x] GitHub integration connected; preview build on `001-nsw-calculator` green (41s build)
- [x] Production domain `lsl.austpayroll.com.au` mapped — **DNS step at Cloudflare still pending**: add `A lsl 76.76.21.21` to austpayroll.com.au DNS, or change the subdomain to use Vercel nameservers. Soft gate (Vercel-issued URL works without this).
- [ ] `ANTHROPIC_API_KEY` set in Vercel Production environment — see LAUNCH-GUARD hard gate
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
