# Launch checklist & artifacts

> ## 🛑 LAUNCH GUARD — ZDR must be ACTIVE before any production traffic
>
> Zero Data Retention was **requested** with Anthropic on 2026-05-23, but
> requesting ≠ active. Before merging PR #1 to `main`:
>
> 1. Log into https://console.anthropic.com
> 2. Confirm ZDR is **switched on for the production API key** (not just the
>    sandbox key, not just "requested" — actually active).
> 3. Only then proceed with cutover.
>
> Without ZDR active, the privacy notice claim ("Anthropic operates under a
> no-retention contract") is inaccurate and we'd be misleading users.
>
> If ZDR takes longer than expected: we can soft-launch with PDF extraction
> behind a feature flag (CSV-only path; no Anthropic round-trip). Ask the
> dev agent.

Everything Tracy needs to action before flipping the NSW LSL Calculator to
production. The code is done; what's left is human coordination.

## Drafted emails

Copy-paste the bodies (or open in Mail.app on macOS — the `.eml` files
import directly):

| File | Purpose | Recipient |
|---|---|---|
| [`anthropic-no-retention-confirmation.eml`](./anthropic-no-retention-confirmation.eml) | Confirm enterprise no-retention contract is in place for production traffic | Anthropic account team |
| [`apa-deeplink-coordination.eml`](./apa-deeplink-coordination.eml) | Lock in the portal deep-link URL + any UTM params | APA technical lead |

Both have placeholder `[fill in]` lines for recipient name/email.

## Pre-cutover checklist

In rough order of dependency:

- [x] PM signs off on the user-facing privacy notice (`/privacy`)
- [ ] PM signs off on the data-handling policy (`docs/engineering/data-handling-policy.md`)
- [x] Branch protection enforced on `main` (CI must pass before merge)
- [x] Zero Data Retention requested with Anthropic (2026-05-23)
- [ ] **ZDR approval landed from Anthropic** — confirm on the production key in the console before cutover. Without this, privacy-notice claim is inaccurate.
- [x] Vercel production project `lsl-calculator` created on team `infiniteleverage-2` (Sydney region, root dir `website/`)
- [x] GitHub integration connected; preview build on `001-nsw-calculator` green (41s build)
- [x] Production domain `lsl.austpayroll.com.au` mapped — **awaiting your DNS step at Cloudflare**: add `A lsl 76.76.21.21` to austpayroll.com.au DNS, or change the subdomain to use Vercel nameservers
- [ ] `ANTHROPIC_API_KEY` set in Vercel Production environment (ZDR-enabled key — see LAUNCH-GUARD hard gate #1)
- [x] PR #1 moved from draft → ready for review (28 commits, 262/262 vitest, 20/20 Playwright, CI green)
- [ ] Final manual smoke on production URL once domain DNS resolves
- [ ] Tracy merges PR #1 → `main` (Vercel auto-deploys to production)
- [ ] First-hour telemetry watch on Vercel Analytics

### Deferred (not blocking launch)

- ~~APA portal deep-link coordination~~ — Tracy will handle this informally
  after launch. APA can link to the production URL at any time without code
  changes on our side. The drafted email at
  `apa-deeplink-coordination.eml` stays on file for reference; ignore unless
  Tracy escalates.

## Order of operations once everything's confirmed

1. Tracy sends "ready to cutover" signal to dev agent.
2. Dev agent moves PR #1 from draft → ready for review.
3. Dev agent runs full local gate (typecheck + vitest + playwright + build).
4. Tracy merges PR #1 to `main` via GitHub UI.
5. Vercel auto-deploys; URL goes live.
6. Watch Vercel Analytics for first events (page views, custom funnel
   events).
7. Notify APA — link can go live on the portal.
8. Soft launch ✅.

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
