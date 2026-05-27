# Implementation Plan — LSL Sub-Brand UI System + Report Pipeline (E6)

**Slug:** `006-ui-design-system`
**Spec:** `.specify/features/006-ui-design-system/spec.md` v0.4 (operator sign-off 2026-05-27, all 12 OQs resolved)
**Dev findings consumed:** `.specify/features/006-ui-design-system/dev-findings.md` (D-A07, D-A15, D-A16 — all MEDIUM/LOW)
**Plan author:** developer agent
**Plan date:** 2026-05-27
**Branch:** `006-ui-design-system` (PR #54 open against `main`)

---

## Phase 0 — Pre-Planning Decisions (dev-findings resolved)

No HIGH dev-layer findings exist. Three MEDIUM/LOW findings are resolved here so Phase 1+ work proceeds without re-litigation.

### PD-1 (resolves D-A07) — PDF generation library: `@react-pdf/renderer`

**Decision:** Adopt `@react-pdf/renderer` for all v1 PDF report templates (E6.5 + E6.6).

**Why:**
- Deterministic, pixel-stable output across runs and across Vercel cold/warm invocations.
- No headless Chromium dependency → no 200MB+ serverless function payload, no cold-start tax that scales with concurrency.
- React tree → PDF: report templates compose like any other React component, share design tokens with web surfaces, and unit-test via the existing Jest harness.
- No external service: PII / tenant data never leaves the Vercel function. Honours §5.7 + LAUNCH-GUARD.

**Trade-off accepted:** CSS subset is restricted (flexbox + react-pdf primitives only — no grid, no arbitrary HTML). Templates must be authored against react-pdf primitives, not HTML/CSS.

**Validation:** Phase 1 of E6.5 includes a throwaway spike (Task 5.1) that renders a single A4 page with letterhead + methodology footer + page-X-of-Y to verify A4 dimensions, footer pagination, and font embedding work as expected. If the citation block (multi-paragraph rich text with inline citations) does not render cleanly under react-pdf, fall back to server-side Puppeteer on the Vercel **Node runtime** (not edge — Puppeteer requires a Node runtime + `chromium-aws-lambda` bundle, accepting the ~200MB payload and 1–2s cold-start tax). Revisit at Task 5.1 review gate before committing to the rest of E6.5. [Resolves G-11]

### PD-2 (resolves D-A15) — Accessibility tooling: axe-core (CI gate) + Lighthouse (observability)

**Decision:**
- **axe-core** integrated into the existing Playwright E2E suite under `website/e2e/` as a **hard CI gate**: zero "serious" or "critical" violations on `/`, `/app/*`, and each report HTML preview.
- **Lighthouse** retained as a **non-blocking observability metric** (target ≥ 95 on `/`) — run on PR via the existing CI workflow but does not block merge.

**Why:** axe-core is the stronger a11y engine (catches more WCAG 2.2 issues, fewer false positives, deterministic) and already implied by §8.2. Lighthouse stays for the brand-credibility score reporting required in §8.4 AC but does not gate merges (it is noisy on flaky CPU runs).

**Where it lands:** E6.2 Task 2.8 (axe-core wired into Playwright) and E6.4 Task 4.7 (Lighthouse CI script for `/`).

### PD-3 (resolves D-A16) — Component library workbench: Storybook 8

**Decision:** Adopt **Storybook 8** under `website/` as the canonical component workbench for E6.2.

**Why:**
- Industry-standard for shadcn-based libraries; integrates cleanly with Next.js + Tailwind.
- Built-in a11y add-on runs axe-core per story → catches violations at component level before they reach E2E.
- Operator + future designer-agent can review every variant in isolation without needing a route in the app.

**Trade-off accepted:** ~80MB of devDependencies; build adds ~30s to local CI. Acceptable cost.

**Cost guardrail:** Chromatic visual-regression service is **NOT adopted** in v1 (paid). Local Storybook only.

**Fallback if operator vetoes the dependency:** ship a `/dev/components` Next.js route gated by `NEXT_PUBLIC_DEV_COMPONENTS_ENABLED`, no new deps but no a11y add-on. Decision: default Storybook; operator may downgrade at Task 2.1 kickoff with no plan change.

---

## Phase 0 — Outline & Research

### What gets built in v1 (this plan)

All six sub-epics from spec §3:
- **E6.1** sub-brand identity (wordmark + lockup + icon direction) — design phase, not engineering
- **E6.2** Tailwind tokens + shadcn-variant component library (hard gate to E5.2)
- **E6.3** `/app` workspace shell (top nav + sidebar + tenant switcher + breadcrumbs + empty/loading states + keyboard shortcuts)
- **E6.4** public calculator re-skin (`/` end-to-end, engine untouched)
- **E6.5** report pipeline foundation (react-pdf + A4 + letterhead + methodology footer + Page X of Y + print stylesheet)
- **E6.6** four report templates: single-employee, bulk-summary (both v1), E5.5 liability + E5.6 reconciliation (ship as those epics deliver — tracked in this plan but not all task-able today)

### What's deferred (v1.1+ — explicitly OUT of v1)

Per spec §5.8:
- Dark mode
- PDF/UA full compliance (v1 ships tagged PDFs + alt text + reading order — short of PDF/UA)
- APA member SSO
- Mobile-first design (mobile responsive on `/` only; `/app/*` is best-effort)
- US letter PDF format
- Re-skinning E5.1 auth screens
- Marketing site (`austpayroll.com.au`) updates
- Custom icon set (v1 uses Lucide; OQ-2 hard deadline: replace by E5.6)
- Email-capture gate on PDF download (OQ-6 deferred to a separate growth epic)
- Chromatic visual-regression (cost guardrail per PD-3)
- Settings toggle for keyboard shortcuts (OQ-8 deferred to a follow-up if a pilot user reports screen-reader interference)
- Tablet as a first-class form factor

### Research / spikes before Phase 1

| Spike | Phase | Owner | Resolved by |
|---|---|---|---|
| react-pdf A4 + letterhead + multi-page footer feasibility | E6.5 Task 5.1 | developer | Single-page test PDF + 5-page test PDF rendering correctly with full / short footer split (OQ-10) |
| Self-hosted font pipeline (Montserrat + Source Sans Pro woff2 subsets + `font-display: swap`) | E6.2 Task 2.2 | developer | Lighthouse FCP / CLS metrics unchanged or improved vs **recorded baseline pinned in `docs/qa/e6-baseline-metrics.md`** (post-change within ±5% or strictly better) [Resolves G-10] |
| Lucide → custom icon swap mechanism | E6.2 Task 2.3 | developer | All `Icon` references go through a single barrel so the v1.1 replacement is a one-file swap |

### Risks & assumptions

Spec §11 (R-1..R-5) carried in unchanged. One additional dev-layer risk:

- **R-6 (dev-layer):** `@react-pdf/renderer` font embedding may not handle Source Sans Pro Light at large weights without manual font registration. Mitigation: Task 5.1 spike validates font registration with both faces (Montserrat Semibold, Source Sans Pro Regular) before committing to E6.5 design.

---

## Phase 1 — Design & Contracts

### 1.1 System architecture

```
                                website/
                                  ├── tailwind.config.ts         ← E6.2: brand tokens (single source of truth)
                                  ├── app/
                                  │   ├── layout.tsx              ← E6.2: font loader + theme provider
                                  │   ├── (public)/               ← E6.4: re-skinned public calc
                                  │   ├── (app)/                  ← E6.3: workspace shell
                                  │   │   ├── layout.tsx          ← top nav + sidebar + breadcrumbs + acting-as banner
                                  │   │   └── [route]/page.tsx
                                  │   └── api/
                                  │       └── reports/
                                  │           └── [family]/route.ts  ← E6.5/E6.6: PDF generation endpoint
                                  ├── components/
                                  │   ├── ui/                     ← E6.2: shadcn variant overrides (Button, Input, etc.)
                                  │   ├── brand/                  ← E6.1/E6.2: Wordmark, Lockup, Icon barrel
                                  │   └── app-shell/              ← E6.3: TopNav, Sidebar, TenantSwitcher, ActingAsBanner
                                  ├── lib/
                                  │   ├── tokens.ts               ← E6.2: typed re-export of Tailwind tokens for non-CSS contexts (PDF)
                                  │   ├── tenant-context.tsx      ← E6.3: home-org revert, 30-min idle reset
                                  │   └── pdf/                    ← E6.5: react-pdf primitives + Letterhead + MethodologyFooter + PageNumber
                                  │       └── templates/          ← E6.6: SingleEmployee, BulkSummary, Liability, Reconciliation
                                  ├── public/
                                  │   └── fonts/                  ← E6.2: self-hosted Montserrat + Source Sans Pro woff2
                                  └── .storybook/                 ← PD-3: Storybook 8 workbench
                                docs/
                                  └── brand/
                                      ├── wordmark/               ← E6.1: SVG + PNG 1x/2x/3x + favicon set
                                      └── iconography-direction.md ← E6.1: design direction document
```

**Key architectural decisions:**

1. **Tokens are the contract.** Every component (web + PDF) reads from `tailwind.config.ts` (web) or `lib/tokens.ts` (PDF — a typed mirror generated from the Tailwind config). Renaming a colour or radius token cascades through both surfaces. No hard-coded values in component CSS, ever.
2. **shadcn variants, not forks.** Button / Input / etc. extend shadcn defaults via `cva` (class-variance-authority). Upgrade paths preserved.
3. **PDF pipeline is server-rendered.** API route invokes react-pdf `renderToBuffer`, returns `application/pdf`. No client-side PDF rendering. No external service.
4. **Tenant context is client + server.** `TenantProvider` (client) hydrates from a server-rendered session cookie; hard refresh = fresh cookie read = home-org default (OQ-9). 30-min idle reset is client-side `setTimeout` with `visibilitychange` reset trigger. **Cross-epic contract:** the cookie's claim shape is defined as a TypeScript interface `SessionCookieClaims` in `lib/auth/session-claims.ts` (Task 3.3-bis). Both E5.1 (writer) and E6.3 (reader) honour this contract — E6.3 can build against the type even if E5.1's implementation is still in flight. [Resolves G-2]
5. **Brand assets live in `docs/brand/`.** Wordmark SVGs ship in-repo (under `docs/brand/wordmark/`). Build-time copy via `scripts/sync-brand-assets.{ts,sh}` invoked from the `prebuild` script in `package.json` — **no symlinks** (Vercel build container + OS-level differences make symlinks fragile). [Resolves G-12]

### 1.2 Data model

No new database tables. E6 is presentation-layer-only.

Two new TypeScript types live in `lib/`:

```ts
// lib/tenant-context.ts
type TenantContext = {
  activeTenantId: string;        // org id user is currently acting on
  homeTenantId: string;          // user's home org (revert target)
  isActingNonHome: boolean;      // derived: activeTenantId !== homeTenantId
  membershipCount: number;       // gates switcher visibility (OQ-4): >= 2 to render
};

// lib/pdf/types.ts
type ReportContext = {
  reportFamily: 'single-employee' | 'bulk-summary' | 'liability' | 'reconciliation';
  reportTitle: string;
  generatedAtIso: string;
  organisationName?: string;     // optional — present for authed reports
  methodologyVersion: string;    // e.g. "calc-v2.4.0"
  stateEngineVersion: string;    // e.g. "rules-engine-v1.2"
  dataAsAtDate: string;          // ISO date
};
```

### 1.3 API contracts

One new API surface (E6.5), **split by auth posture per spec §5.3 (OQ-6)**:

```
POST  /api/reports/:family
      body: { context: ReportContext, payload: <family-specific> }
      200:  application/pdf (streamed)
      400:  { error: 'invalid-payload' | 'unsupported-family' }
      500:  { error: 'render-failure', requestId: string }
```

**Auth posture (load-bearing — resolves G-1):**

| Family | Posture | Rationale |
|---|---|---|
| `single-employee` | **Unauthenticated** | Spec §5.3 / OQ-6 — public-calc PDF CTA is unconditional, served to anonymous users on `/` |
| `bulk-summary` | **Unauthenticated** | Spec §5.3 / OQ-6 — same public CTA |
| `liability` | **Authenticated** (Supabase session) | Tenant-scoped report under `/app/liability` — E5.1 session middleware enforced |
| `reconciliation` | **Authenticated** (Supabase session) | Tenant-scoped report under `/app/reconciliation` — E5.1 session middleware enforced |

The route handler branches on `family` BEFORE invoking any auth check. Public families never touch Supabase or read a session cookie. This ensures Phase 5a (public-calc PDF) is independent of E5.1's merge to `main`. PII / tenant data never leaves the Vercel function for any family (spec §5.7). See Task 5.5-bis for the contract test that asserts public posture is preserved.

### 1.4 UI/UX design

Implemented as design system not Figma artifacts (per spec §5.8 — no Figma deliverable).

- Storybook (`website/.storybook/`) is the canonical visual reference. Every component variant has a story; every story runs through the Storybook a11y add-on (axe-core).
- Empty states (E6.3 §5.2): six surfaces — Employees, Pay Codes, Pay History, Valuations, Liability, Reconciliation — each with single primary CTA. Stories in Storybook + integration via app routes.
- Loading states: skeleton component (E6.2) reused across data-fetching surfaces (E6.3).
- Acting-as banner: full-width strip below top nav, gold background (token: `colors.brand.gold`), visible whenever `isActingNonHome === true`.

### 1.5 Testing strategy

Spec success criterion 7 is load-bearing: **2214/2214 LSL suite + 92 Playwright tests across 4 browsers stay green on every PR.** Tests are off-limits for modification.

| Test layer | Tool | What it validates | When it runs |
|---|---|---|---|
| LSL engine | existing Jest suite | 2214/2214 rules-engine outputs unchanged | every PR (hard merge gate) |
| Playwright E2E | existing 92 tests × 4 browsers | end-to-end flows unchanged | every PR (hard merge gate) |
| **axe-core** (new) | added to Playwright suite (PD-2) | WCAG 2.2 AA — zero serious/critical violations on `/`, `/app/*`, report HTML previews | every PR (hard merge gate from E6.2 onward) |
| Storybook a11y | Storybook a11y add-on (PD-3) | per-component axe scan | local dev + PR optional |
| Lighthouse | Lighthouse CI script (E6.4 Task 4.7) | `/` accessibility ≥ 95 | every PR (non-blocking, observability) |
| Snapshot (citation block) | existing | citation block byte-for-byte unchanged (§8.4) | every PR |
| PDF visual smoke | manual + react-pdf snapshot (Task 5.4) | letterhead + footer + page numbering render correctly on A4 | every PR touching `lib/pdf/` |

---

## Phase 2 — Phased Delivery Sequence

Phases below map to the sub-epics, ordered by spec §3 sequencing constraints. **Phase numbering aligns with sub-epic numbering** for clarity: Phase 1 = E6.1, Phase 2 = E6.2, etc.

### Phase 1 — E6.1 Sub-brand identity (DESIGN PHASE)

**Owner:** in-team designer agent (OQ-13) + operator approval.
**This is NOT an engineering phase.** Developer agent does not write code in Phase 1.
**Effort:** M (designer agent runs 1–3 wordmark candidates; operator picks; assets committed to `docs/brand/`)
**Hard gate:** wordmark operator-approved before Phase 2 begins.
**Fallback:** if Phase 1 blocks > 14 days, Phase 2 proceeds with APA primary wordmark placeholder per spec §3 — sub-brand wordmark dropped into the single layout slot retrospectively.

### Phase 2 — E6.2 Tokens + core component library (HARD GATE TO E5.2)

**Effort:** L
**Why critical-path:** spec §3 — E6.2 must be available before E5.2 implementation kickoff.
**Deliverables:**
- Tailwind theme extension (`tailwind.config.ts`) with full APA palette, gradient utilities, type scale, shadow + radius tokens
- Self-hosted Montserrat + Source Sans Pro woff2 subsets under `public/fonts/` with `font-display: swap`
- shadcn variant overrides for 16 components (Button, Input, Textarea, Select, Checkbox, Radio, Switch, Table, Card, Tabs, Accordion, Modal/Dialog, Toast, Tooltip, Badge, Alert)
- Lucide icon barrel (`components/brand/Icon.tsx`) — single import point so v1.1 custom-icon swap is a one-file change
- Storybook 8 workbench with one story per variant + axe-core add-on
- axe-core wired into Playwright suite (PD-2)
- **CSP + bundle audit guard** (Task 2.10) — no third-party network requests, no Storybook leakage into client bundle [Resolves G-3 + G-6]
- **Test-folder diff guard** (Task 2.11) — `git diff main -- tests/` must be empty on every E6 PR [Resolves G-7]
- Test gate: 2214/2214 + 92 Playwright tests green

### Phase 3a — E6.3 `/app` workspace shell

**Effort:** L
**Dependency:** Phase 2.
**Parallel with:** Phase 3b (E6.4).
**Deliverables:**
- Top nav with sub-brand wordmark + user menu + notifications affordance
- Sidebar with placeholder entries (Employees, Pay Codes, Pay History, Valuations, Liability, Reconciliation, Settings)
- TenantSwitcher component — hidden when membership count < 2 (OQ-4); rendered when ≥ 2
- ActingAsBanner — visible whenever `activeTenantId !== homeTenantId`
- Tenant context provider — revert to home on hard refresh + 30-min idle (OQ-9)
- Confirm-dialog wrapper for destructive write actions under non-home tenant
- Breadcrumbs component on every `/app/*` page
- Six opinionated empty states (Employees, Pay Codes, Pay History, Valuations, Liability, Reconciliation)
- Skeleton + spinner loading components
- Keyboard shortcut handler — `g e`, `g v`, etc., always-on (OQ-8) + `?` overlay for discoverability

### Phase 3b — E6.4 Public calculator re-skin

**Effort:** M
**Dependency:** Phase 2.
**Parallel with:** Phase 3a (E6.3).
**Deliverables:**
- State selector re-skinned
- Single-employee form re-skinned
- Bulk-upload entry (CSV) re-skinned
- Result + breakdown screens re-skinned (Cat A/B/C semantics + citation block byte-for-byte unchanged — snapshot test enforces)
- Sub-brand wordmark in page header; APA lockup in footer
- PDF download CTA on result + bulk-summary screens, unconditional (OQ-6) — wired to Phase 5 endpoint
- Lighthouse CI script for `/` accessibility ≥ 95
- Test gate: 2214/2214 + 92 Playwright tests green; citation block snapshot unchanged

### Phase 4 — E6.5 Report pipeline foundation

**Effort:** L
**Dependency:** Phase 2 (tokens needed for PDF styling).
**Deliverables:**
- `@react-pdf/renderer` installed + configured
- Font registration for Montserrat Semibold + Source Sans Pro Regular
- `lib/pdf/Letterhead.tsx` — sub-brand wordmark + APA lockup + report title + generated-at timestamp + "for: <organisation name>" line
- `lib/pdf/MethodologyFooter.tsx` — full block (page 1) + short version (pages 2+) per OQ-10
- `lib/pdf/PageNumber.tsx` — Page X of Y on every page
- A4 page primitive (`lib/pdf/A4Page.tsx`)
- API endpoint `POST /api/reports/:family/route.ts`
- Print stylesheet (`@media print`) for browser-print parity per spec §5.4
- No watermarks anywhere

### Phase 5a — E6.6 single-employee + bulk-summary templates

**Effort:** M
**Dependency:** Phase 4.
**Deliverables:**
- `lib/pdf/templates/SingleEmployee.tsx` — wraps existing Cat A/B/C result + citation block (citation block unchanged)
- `lib/pdf/templates/BulkSummary.tsx` — wraps existing multi-employee summary table
- Wired to PDF download CTA on public calc result + bulk-summary screens (Phase 3b)
- Each template inherits Letterhead + MethodologyFooter + PageNumber from Phase 4

### Phase 5b — E6.6 liability + reconciliation templates (TRAILING)

**Effort:** M (per template)
**Dependency:** Phase 4 + E5.5 liability feature lands (liability template); Phase 4 + E5.6 reconciliation feature lands (reconciliation template).
**Note:** These templates are designed and stubbed in Phase 5a but **not implemented in this plan** beyond skeletal scaffolds. They land as E5.5 / E5.6 deliver — separate developer cycles will fill in the data wiring once those features ship.
**Deliverables (when E5.5 / E5.6 land):**
- `lib/pdf/templates/Liability.tsx` — one-page exec summary with **3-column at-a-glance** (employees / total accrued weeks / total accrued $) per OQ-11; full detail follows
- `lib/pdf/templates/Reconciliation.tsx` — one-page exec summary with **single headline number** (total variance $) per OQ-11; per-row variance verdict table follows
- Wired to corresponding `/app/*` routes once E5.5 / E5.6 surfaces exist

---

## Phase 3 — Effort & Dependencies

| Phase | Sub-epic | Effort | Depends on | Gates | Parallel-able |
|---|---|---|---|---|---|
| 1 | E6.1 | L (design — re-sized per G-4; Task 1.2 alone is L) | — | All other phases | — |
| 2 | E6.2 | L (includes new Tasks 2.10 + 2.11 audit guards) | Phase 1 | E5.2 + Phases 3a/3b/4 | — |
| 3a | E6.3 | L (includes Task 3.3-bis contract type) | Phase 2 | — | with 3b |
| 3b | E6.4 | M | Phase 2 | — | with 3a (subject to G-5 sequencing guard on Task 4.6) |
| 4 | E6.5 | L (Task 5.5 alone re-sized to L; +Task 5.5-bis posture test) | Phase 2 | Phase 5a/5b | with 3a + 3b |
| 5a | E6.6 (s/e + bulk) | M | Phase 4 | — | — |
| 5b | E6.6 (liab + recon) | M (per) | Phase 4 + E5.5/E5.6 | — | — |

### Critical path to E5.2 unblock

```
Phase 1 (M, design) ── Phase 2 (L) ──→ E5.2 implementation kickoff
                                           (no other phases needed for E5.2 gate)
```

Phases 3a/3b/4/5a/5b are **NOT on the E5.2 critical path** — they ship after Phase 2 but do not block E5.2.

**Total E5.2-blocking effort:** Phase 1 (re-sized — see Task 1.2 at L) + Phase 2 (L) = approximately **3 days (happy path) to 14 days (fallback active)** of design + 1.5–2 engineering weeks. The wordmark approval cycle (Task 1.2 ↔ Task 1.3 round-tripping) with a non-technical operator typically runs longer than M's bottom range; budget accordingly. [Resolves G-4]

**Phase 3b ↔ Phase 5a sequencing guard (resolves G-5):** Spec §8.4 mandates the PDF download CTA is **unconditional** on the public calc. To honour that, Phase 3b (which ships the CTA) does NOT merge to `main` until Phase 5a (which ships the functional download endpoint + templates) is merge-ready. Alternatively, gate the CTA behind `NEXT_PUBLIC_PDF_DOWNLOAD_ENABLED=false` until Phase 5a lands. Operator picks the preferred path at Task 4.6 kickoff and records the decision inline. Either way, no "dead CTA" state ships to `main`.

### Risks (rolled forward from spec §11 + Phase 0)

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | Designer-resource bottleneck on E6.1 wordmark | Spec §3 fallback — APA primary placeholder after 14 days |
| R-2 | Visual-identity split during E5.1 invite-only window | Accepted per OQ-12; E5.1 is invite-only at launch |
| R-3 | Brand-source PDF lives outside repo (OneDrive only) | E6.1 task: copy relevant pages to `docs/brand/apa-brand-source.pdf` with APA permission |
| R-4 | Engine regression via styling-only PRs | Mandatory full LSL suite + Playwright on every E6 PR — hard merge gate |
| R-5 | Cross-tenant data leakage via tenant switcher UX bug | Destructive-action confirm dialog requirement (Phase 3a Task 3.4) + QA verify |
| R-6 (dev) | react-pdf font embedding edge cases | Phase 4 Task 5.1 spike validates font registration before E6.5 commits |

---

## Phase 4 — Out of Scope (explicit — restated from spec §5.8)

The following are NOT delivered in this plan:
- Dark mode
- PDF/UA full compliance (v1: tagged PDFs + alt text + reading order only)
- APA member SSO
- Mobile-first design (`/app/*` is best-effort mobile)
- US letter PDF format
- E5.1 auth re-skin
- Marketing site (`austpayroll.com.au`)
- Custom icon set (Lucide v1 → custom by E5.6)
- Email-capture gate on PDF (separate growth epic)
- Chromatic visual regression (cost)
- Settings toggle for keyboard shortcuts
- Tablet as first-class form factor
- Figma artifacts
- Watermarks on PDFs

---

*End of impl-plan.md. Hand to speckit-tasks for task generation.*
