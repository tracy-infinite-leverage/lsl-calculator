# Feature Specification — LSL Sub-Brand UI System + Report Pipeline

**Slug:** `ui-design-system`
**Feature number:** 006
**Status:** v0.4 — 2026-05-27 (operator sign-off pass complete; all open questions resolved; ready for developer handoff)
**Author:** Product Manager (drafted from operator-confirmed discovery brief 2026-05-27)
**Owner:** Tracy Angwin (tracy@austpayroll.com.au)
**Depends on:** E1 (NSW) shipped · E2 (8-of-8 states) shipped · E5.1 auth slice ships unstyled (this epic does NOT re-skin E5.1)
**Parallel with:** E5.1 auth (currently in flight on `feat/E5.1-auth-slice`)
**Gates:** E5.2 onward — design system token layer + core component library MUST be ready before E5.2 implementation starts. This is a hard sequencing dependency.

---

## 1. Executive summary

The LSL Calculator today is functional but visually generic — default shadcn styling, no brand identity, no consistent design language across the public calculator and the (in-flight) authenticated platform. Reports are basic in-browser HTML.

This spec defines a **sub-brand visual identity** ("LSL Calculator by APA") layered on the existing Next.js + Tailwind + shadcn stack, plus a **PDF report pipeline** suitable for board, CFO, and auditor distribution. It does NOT change calc engine logic, calc accuracy, or the existing test suites.

**Six sub-epics:**

- **E6.1** — Sub-brand identity (wordmark, lockup, sub-brand colour decisions, icon style direction)
- **E6.2** — Design system tokens + core component library (Tailwind theme, shadcn variant overrides, brand-styled buttons/inputs/tables/cards/nav/modals)
- **E6.3** — `/app` workspace shell (top nav, sidebar, tenant switcher, breadcrumbs, empty states, loading states)
- **E6.4** — Public calculator re-skin (state selector, single form, bulk upload, result screens)
- **E6.5** — Report pipeline foundation (PDF generation infra, A4 templates, branded letterhead, methodology footer, page numbering, print stylesheet)
- **E6.6** — Report templates per family (single-employee, bulk-summary, E5.5 liability, E5.6 reconciliation)

**Headline outcome:** the LSL Calculator feels like a credible APA family product. A CFO can download a PDF and send it to the board without Word/Excel touch-up. A payroll manager opens the public calc and recognises the APA family lineage. An APA consultant working across multiple tenants always knows which client they're acting on.

**Brand posture:** "Looks like Xero in structure, feels like Linear in polish." Sub-brand wordmark and custom iconography are themselves design deliverables of this epic — no Figma artifacts exist today.

---

## 2. Background — what already exists vs what is new

| Capability | Today | What this spec adds |
|---|---|---|
| Stack | Next.js + Tailwind + shadcn (`website/`) | Unchanged. This epic is purely a token + component + asset layer on top. |
| Visual identity (public calc) | Default shadcn defaults; no brand colour, no brand typography, no logo | Sub-brand visual identity end-to-end. |
| Visual identity (`/app/*`) | None — the platform is being built unstyled under E5.1 | APA-aligned sub-brand identity applies E5.2 onward. E5.1 explicitly ships unstyled and is NOT re-skinned. |
| Calc engine | 8 of 8 states LIVE. 2214/2214 LSL suite green. 92 Playwright tests across 4 browsers. | **Unchanged.** Zero engine, zero rules, zero test changes. |
| Reports | In-browser HTML result + citation block; no PDF export | A4 PDF export pipeline with branded letterhead, methodology footer, page X of Y, for four report families. |
| Brand source | None in repo | APA Brand Guidelines v2.0 (24pp). Source: `~/Library/CloudStorage/OneDrive-APA/.../Brand Guidelines v2.pdf`. |
| Sub-brand wordmark | Does not exist | New design deliverable under E6.1. |
| Custom icon set | Lucide defaults | Custom light-line-weight set commissioned under E6.1 (Lucide may serve as v1 placeholder pending designer engagement — flagged as a design decision). |
| Tenant switcher | N/A — no tenancy on public calc; no UI on E5.1 | New component under E6.3, with explicit "acting as <client>" indicator visible at all times for APA consultants. |

**Critical finding — there is no designer engaged.** This epic includes a **design phase** before implementation can start on E6.2+. Sub-brand wordmark, custom icon set, and component visual references must be produced by a designer (or designer-agent) before the developer agent can implement the token layer and component variants.

---

## 3. Epic structure

E6 is one umbrella epic with six sub-epics, sequenced.

| Sub-epic | Title | Depends on | Hard gate to | Notes |
|---|---|---|---|---|
| **E6.1** | Sub-brand identity (wordmark, lockup, icon direction) | — | All other sub-epics | Design deliverable. Operator approval required on wordmark before E6.2 begins. |
| **E6.2** | Design system tokens + core component library | E6.1 wordmark approved | E5.2 implementation; E6.3, E6.4, E6.5 | Tailwind theme tokens; shadcn variant overrides; brand-styled buttons, inputs, tables, cards, nav, modals, toasts. |
| **E6.3** | `/app` workspace shell | E6.2 | E5.2 implementation | Top bar, sidebar, tenant switcher with "acting as <client>" indicator, breadcrumbs, empty states, loading states. |
| **E6.4** | Public calculator re-skin | E6.2 | — (independent of E5) | Applies tokens to existing state selector, single form, bulk upload, result/breakdown screens. Engine + tests UNCHANGED. |
| **E6.5** | Report pipeline foundation | E6.2 | E6.6 | PDF generation infra, A4 templates, branded letterhead, methodology footer block, page numbering, print stylesheet. |
| **E6.6** | Report templates per family | E6.5; E5.5 + E5.6 for liability and reconciliation templates | — | Four templates: single-employee result, bulk-summary, E5.5 liability, E5.6 reconciliation. Last two ship as those sub-epics deliver. |

**Sequencing constraints:**
1. E6.1 wordmark must be approved before E6.2 starts (the wordmark drives logo treatment in the component library).
2. E6.2 token layer + core components must be available before E5.2 implementation can begin. **This is the hard cross-epic gate.**
3. E6.4 (public re-skin) can ship anytime after E6.2 — independent of E5 progress.
4. E6.5 + E6.6 single-employee and bulk-summary templates can ship anytime after E6.2 — they wrap existing public-calc engines.
5. E6.6 liability and reconciliation templates ship as E5.5 and E5.6 deliver.

**Bottleneck fallback (resolves A09 HIGH risk):** If sub-brand wordmark approval (E6.1) is not secured within 14 days of E6.1 kickoff, **E6.2 MAY proceed using the APA primary wordmark as a temporary placeholder** (no sub-brand differentiator). The sub-brand wordmark is applied retrospectively without component-library churn — the wordmark sits in a single layout slot, so swapping it later does not require touching component code. This removes the designer-resource bottleneck from the E5.2 critical path.

---

## 4. Personas (primary)

Three personas are in scope. External auditors are NOT a primary persona but methodology-disclosure footers on PDFs are still required.

### 4.1 Payroll manager (power user)
- Internal company staff. Weekly+ usage. Knows LSL deeply.
- Wants speed, keyboard navigation, bulk actions, "everything exports".
- Tolerates UI complexity for click-savings.
- Primary surface: `/app/*` (E5.2 onward); occasional public calc for one-off `as_at` checks.

### 4.2 CFO / finance director (occasional, report-focused)
- Monthly or quarterly usage at most. Comes for reports.
- Needs clarity, exec-ready PDFs, one-page summaries.
- Will not tolerate steep learning curve. Will not open a tutorial.
- Primary surface: PDF reports downloaded from `/app/*` by the payroll manager and sent on, or run directly by the CFO themselves.

### 4.3 APA consulting team (cross-tenant, white-glove)
- Internal APA staff servicing multiple client tenants.
- Switches between client workspaces frequently within a single session.
- Authors reports on behalf of clients.
- **Critical UX requirement:** persistent "acting as <client>" indicator visible at all times — anywhere a user can take a write action — to prevent mis-tenant operations.
- Primary surface: `/app/*` with tenant switcher prominent.

---

## 5. Requirements

### 5.1 Functional — Design system (E6.1, E6.2)

- **MUST** apply APA Brand Guidelines v2.0 colour palette as Tailwind theme tokens. Primary: navy `#48608a` (Pantone 2154 U), gold `#d9a428` (Pantone 110 U), white. Extended: light blue `#a0aec1`, yellow accent `#eebd3c`, dark blue `#324d61`, charcoal `#333232`, grey `#808897`. Advisory variant introduces teal `#6ec8c0` for advisory-context surfaces.
- **MUST** apply approved gradients (navy↔gold, navy↔light blue) as backgrounds only, never under text where legibility would degrade below WCAG 2.2 AA contrast.
- **MUST** apply APA typography pairing: Montserrat (Light / Regular / Semibold) for titles and H1; Source Sans Pro (Light / Regular / Semibold) for body, H2, H3, captions. Source Sans Pro Light is permitted only above 30pt. System fallback stack: `system-ui, -apple-system, sans-serif` (web context — Calibri / Century Gothic per brand guide are MS-document-only).
- **MUST** self-host Montserrat + Source Sans Pro (no third-party font CDN). Keeps LAUNCH-GUARD privacy posture clean — no third-party request for typography. (Resolves OQ-3.)
- **MUST** define type hierarchy mapping per brand guide p18: Title (Montserrat Semibold 32–72pt), H1 (Source Sans Pro Semibold 22–28pt), H2 (Regular 18–20pt), H3 (Semibold 14–16pt), Body (Regular 10–12pt), Caption (Regular 8pt). Web sizing converts pt→rem at the standard 1pt ≈ 0.083rem at 16px base.
- **MUST** apply brand voice rules from APA guide: sentence case default for headings and body, left-aligned body, em dashes for breaks, commas in 1000+ numerals (e.g. `9,880.04`).
- **MUST** ship a sub-brand wordmark ("LSL Calculator by APA") with explicit "by Australian Payroll Association" lockup. Inherits APA palette + typography but has its own visual personality. Positioned as a sibling product, comparable to how Xero brands Practice Manager / Tax / Workpapers as siblings.
- **MUST** define an iconography direction: light line-weight, optionally with subtle broken-line details, standalone or encircled (circle filled in primary or secondary brand colour).
- **SHOULD** commission a custom icon set in the chosen direction. **v1 ships with Lucide as a placeholder icon set** to unblock E6.2 (no designer engagement secured for v1); the custom set replaces Lucide **by the time E5.6 ships**. (Resolves OQ-2.)
- **MUST** ship core component variants overriding shadcn defaults for: Button (primary/secondary/ghost/destructive/advisory), Input, Textarea, Select, Checkbox, Radio, Switch, Table, Card, Tabs, Accordion, Modal/Dialog, Toast, Tooltip, Badge, Alert.
- **MUST** define shadow / radius / spacing tokens consistent with the "Linear polish" reference (generous whitespace, soft shadows, opinionated empty states).

### 5.2 Functional — `/app` workspace shell (E6.3)

- **MUST** ship a top navigation bar with sub-brand wordmark, user menu, and notifications affordance.
- **MUST** ship a sidebar with primary navigation (Employees, Pay Codes, Pay History, Valuations, Liability, Reconciliation, Settings) — scoped to E5.2+ surfaces as those land.
- **MUST** ship a tenant switcher (for APA consulting persona) with a persistent "Acting as: <client name>" indicator visible across the entire `/app/*` surface whenever the active tenant is not the user's home org.
- **MUST** hide the tenant switcher entirely for users with exactly one org membership; render it only for users with ≥ 2 org memberships (i.e. APA consultants and any user invited into multiple tenants). (Resolves OQ-4.)
- **MUST** revert the active tenant to the user's home org on hard refresh AND after 30 minutes of idle. This forces a deliberate re-entry into a non-home client tenant — directly tied to success criterion 4 (zero mis-tenant incidents). (Resolves OQ-9.)
- **MUST** require an explicit confirm dialog showing the active tenant name on destructive write actions performed under non-home-tenant context (e.g. delete employee, hard-reset mapping, delete saved valuation). Tightens success criterion 4 (zero mis-tenant incidents).
- **MUST** ship breadcrumb navigation on all `/app/*` pages.
- **MUST** ship opinionated empty states for every primary surface (Employees-empty, Pay Codes-empty, Pay History-empty, Valuations-empty, Liability-empty, Reconciliation-empty) with a single primary CTA each.
- **MUST** ship loading states (skeleton screens or spinner) for all data-fetching surfaces.
- **SHOULD** support keyboard-first navigation: `g` then primary-section key (e.g. `g e` = Employees, `g v` = Valuations) for the payroll-manager power-user. Shortcuts ship **always-on in v1**; a Settings toggle to disable them is deferred to a follow-up if any pilot user reports screen-reader interference. (Resolves OQ-8.)

### 5.3 Functional — Public calculator re-skin (E6.4)

- **MUST** apply the design system to `www.lslcalculator.com.au` end-to-end: state selector, single-employee form, bulk-upload entry (CSV), result/breakdown screens.
- **MUST NOT** change any calculation engine logic, citation block content, or rules engine outputs.
- **MUST NOT** break the existing 2214/2214 LSL test suite or the 92 Playwright tests across 4 browsers.
- **MUST** preserve current Cat A/B/C result semantics and presentation hierarchy (number first, citation second).
- **MUST** include the sub-brand wordmark in the page header and "by Australian Payroll Association" lockup in the footer.
- **SHOULD** improve empty-state and error-state surfaces using the new component library (no behavioural changes, just visual).
- **MUST** expose the PDF download CTA on the public-calc result + bulk-summary screens **unconditionally** (no email capture gate in v1). Email-capture experiment is deferred to a separate growth epic. (Resolves OQ-6.)

### 5.4 Functional — Report pipeline (E6.5, E6.6)

- **MUST** support **A4 page size only**. US letter is explicitly out of scope.
- **MUST** ship a branded letterhead applied to page 1 of every report: sub-brand wordmark + APA lockup, report title, generated-at timestamp, "for: <organisation name>" line where applicable.
- **MUST** ship a methodology + legal disclosure footer applied to every page of every report. Page 1 carries the **full block**: calculation methodology version, state-engine version, data-as-at date, "calculated, not advice", and APA contact details (email + URL). Pages 2+ carry a **short version**: state-engine version, "calculated, not advice", and APA URL only — keeps long reports readable while preserving the "calculated, not advice" disclaimer on every page. (Resolves OQ-10.)
- **MUST** ship page-numbering footer in the form "Page X of Y" on every page.
- **MUST NOT** ship draft / preview watermarks. Watermarks are explicitly out of scope.
- **MUST** ship four report templates:
  1. **Single-employee result** (wraps existing public-calc Cat A/B/C result + citation block — no E5 dependency)
  2. **Bulk-upload summary** (wraps existing public-calc multi-employee summary table — no E5 dependency)
  3. **E5.5 liability report** (org-wide accrued LSL — ships as E5.5 delivers)
  4. **E5.6 reconciliation report** (variance vs org-recorded liability — ships as E5.6 delivers)
- **MUST** support print stylesheet so each report family also prints cleanly from the browser (in addition to the PDF download path).
- **MUST** ship a CFO-readable one-page executive summary at the top of E5.5 (liability) and E5.6 (reconciliation) reports — key numbers; full detail follows. Single-employee and bulk-summary reports do NOT carry a separate exec summary (they are already short enough that a separate exec summary is noise). (Resolves OQ-5.)

### 5.5 Accessibility

- **MUST** meet WCAG 2.2 AA across all **web surfaces** (`/` and `/app/*`). PDFs are scoped separately: tagged PDFs with logical reading order and alt text on the wordmark image (PDF/UA compliance is OUT of v1 scope but no anti-pattern is shipped).
- **MUST** preserve keyboard navigability of the existing public calc and extend it across `/app/*`.
- **MUST** ensure colour-contrast ratio ≥ 4.5:1 for body text and ≥ 3:1 for large text against all brand-palette backgrounds, including under approved gradients.
- **SHOULD** include `prefers-reduced-motion` honour for any animated transitions.

### 5.6 Responsive design

- **MUST** be desktop-first (1280px+ primary; 1024px minimum supported).
- **MUST** be mobile responsive on the public calc (preserve current posture).
- **MAY** be mobile responsive on `/app/*` (best-effort; not a first-class form factor).
- Tablet is NOT a first-class form factor.

### 5.7 Security + non-functional

- **MUST NOT** introduce any dependency that breaks the existing CSP or violates the LAUNCH-GUARD posture.
- **MUST NOT** ship any new third-party font hosting. Montserrat + Source Sans Pro served **self-hosted** with `font-display: swap` per OQ-3 resolution.
- **MUST** keep PDF generation server-side or fully client-side without leaking any tenant or PII data to an external service. (Specific PDF lib choice deferred to dev-finding for E6.5.)
- **MUST** render currency as AUD with comma thousands separator and 2-decimal precision (e.g. `$9,880.04`) — matches existing public-calc presentation.

### 5.8 Out of scope (explicit)

- APA member SSO (no "Sign in with APA" affordance; deferred indefinitely).
- Mobile-first design.
- US letter PDF format.
- Re-skinning E5.1 auth screens (E5.1 ships with default shadcn styling).
- Marketing-site (`austpayroll.com.au`) updates — APA's own team owns that property.
- Modifying the LSL calc engine or test suites.
- Draft / preview watermarks on PDFs.
- Animations beyond subtle micro-interactions.
- A figma or design-tool deliverable as part of dev handoff (the design system lives in code).
- Dark mode. Brand palette is light-mode-only in v1. May be revisited in v1.1.
- PDF/UA accessibility compliance. Tagged PDFs with reading order in v1; full PDF/UA deferred.

---

## 6. Success criteria

Measurable, user-outcome-focused, no implementation references.

1. **First-time public-calc user completes a calculation without reading help.**
   *Metric:* median time-to-first-result for new (no-cookie) sessions, measured at re-skin launch + 30 days. *Target:* ≤ 60 seconds median.

2. **Payroll manager runs a full reconciliation without leaving the workspace.**
   *Metric:* number of full-page navigations per completed reconciliation flow, measured once E5.6 is live. *Target:* single-digit (≤ 9 full-page navigations end-to-end).

3. **CFO PDFs are board-ready without Word/Excel touch-up.**
   *Metric:* PDF download → send-without-edit rate. *Measurement:* qualitative interview signal with at least 3 pilot CFOs / finance directors at launch + 60 days; quantitative metric deferred to v1.1.

4. **Consultant tenant switching is instant and obvious.**
   *Metric:* mis-tenant action incidents (reported by users or detected via audit log review). *Target:* zero in the first 90 days of consulting-team usage.

5. **WCAG 2.2 AA across all surfaces.**
   *Metric:* automated axe-core audit on `/`, `/app/*`, and each report HTML preview at launch. *Target:* zero "serious" or "critical" violations on initial scan.

6. **Brand-credibility recall.**
   *Metric:* qualitative — when shown the LSL Calculator and three other APA products side-by-side, ≥ 80% of payroll-manager interviewees recognise the LSL Calculator as part of the APA family without being told.

7. **Zero engine regression.**
   *Metric:* 2214/2214 LSL test suite and 92 Playwright tests across 4 browsers remain green on every PR that ships E6 work.

---

## 7. Design / approach outline

### 7.1 Token-first
Tokens precede components. Tailwind theme extension defines colour, type, spacing, shadow, radius — every component variant references tokens. Renaming or re-tinting a token cascades; nothing is hard-coded in component CSS.

### 7.2 shadcn variant overrides, not replacements
Existing shadcn components are extended with brand variants — not forked. This preserves shadcn upgrade paths and minimises maintenance.

### 7.3 Reference bar
- **Xero / MYOB / Employment Hero** for table density, report fluency, IA patterns familiar to AU payroll buyers.
- **Stripe / Linear / Notion** for generous whitespace, soft shadows, opinionated empty states, keyboard-first feel.
- Synthesis: structure of Xero, polish of Linear.

### 7.4 Two-surface, one-domain
Public calc at `/` and platform at `/app/*` share the sub-brand identity (both are "LSL Calculator by APA"). The platform is the same product behind a login — not a sibling product. Tenant switcher and "acting as" indicator are platform-only.

### 7.5 PDF pipeline
Server-side PDF generation preferred (deterministic, no client variance). A4 templates use the design system's print tokens. Letterhead and methodology footer are page-level templates applied via a layout wrapper, not per-report-family.

### 7.6 Sub-brand wordmark
Distinct visual lockup: "LSL Calculator" as the primary mark in Montserrat Semibold, with "by Australian Payroll Association" as a secondary line in Source Sans Pro Regular. Sibling-product posture (Xero Practice Manager precedent).

### 7.7 Phased delivery
1. E6.1 wordmark + icon direction
2. E6.2 tokens + core components
3. E6.3 app shell (parallel-able with E6.4)
4. E6.4 public re-skin (parallel-able with E6.3)
5. E6.5 report foundation
6. E6.6 templates (single + bulk first; liability + reconciliation as E5.5 + E5.6 deliver)

---

## 8. Acceptance criteria

### 8.1 E6.1 — Sub-brand identity
- [ ] Sub-brand wordmark produced as SVG + PNG (1x, 2x, 3x) + favicon set.
- [ ] "by Australian Payroll Association" lockup approved by operator.
- [ ] Iconography direction document committed under `docs/brand/` (or equivalent).
- [ ] Operator sign-off recorded on wordmark before E6.2 begins.
- [ ] **Lucide ships as the v1 placeholder icon set** (operator-approved 2026-05-27); custom icon set replaces Lucide **by the time E5.6 ships**. Decision logged in this spec under OQ-2. (OQ-2)

### 8.2 E6.2 — Tokens + core component library
- [ ] Tailwind theme extension committed under `website/tailwind.config.{js,ts}` with all brand colour tokens, gradient utilities, type-scale tokens, shadow tokens, radius tokens.
- [ ] Sub-brand fonts (Montserrat + Source Sans Pro) **self-hosted** with `font-display: swap` — no third-party font CDN. (OQ-3)
- [ ] Each core component variant (Button, Input, Textarea, Select, Checkbox, Radio, Switch, Table, Card, Tabs, Accordion, Modal/Dialog, Toast, Tooltip, Badge, Alert) has at least one brand-styled variant and renders correctly in Storybook or equivalent.
- [ ] Component library audited against WCAG 2.2 AA via axe-core: zero "serious" or "critical" violations.
- [ ] 2214/2214 LSL test suite and 92 Playwright tests remain green.

**Implementation note — Tailwind v4 CSS-first substitution (recorded 2026-05-30):** the AC above references `website/tailwind.config.{js,ts}` because the spec was authored against Tailwind v3 conventions. The project shipped Task 2.3 on **Tailwind v4 CSS-first** instead — tokens live in `website/src/app/globals.css` inside an `@theme inline { … }` block (see PR #58, merged 2026-05-28; HANDOFF at `docs/engineering/changes/2026-05-28-E6.2-task-2.3-tokens/HANDOFF.md`). This is the v4-canonical home for design tokens; a parallel `tailwind.config.ts` is no longer required. Treat any AC bullet that names `tailwind.config.{js,ts}` as satisfied when the equivalent tokens are present in `globals.css`. This is a config-surface substitution only; no token semantics, palette values, or contract surfaces change.

### 8.3 E6.3 — `/app` workspace shell
- [ ] Top nav with sub-brand wordmark + user menu + notifications affordance live on every `/app/*` route.
- [ ] Sidebar with placeholder entries for E5.2+ surfaces; sections show / hide as features land.
- [ ] Tenant switcher component built; "Acting as: <client name>" indicator visible whenever active tenant ≠ home org.
- [ ] Tenant switcher is **hidden** for users with exactly one org membership; rendered only for users with ≥ 2 memberships. (OQ-4)
- [ ] Active tenant **reverts to home org on hard refresh** and **after 30 minutes of idle**. (OQ-9)
- [ ] Destructive write actions under non-home-tenant context show a confirm dialog naming the active tenant.
- [ ] Breadcrumbs render on every `/app/*` page.
- [ ] Opinionated empty state ships for at least Employees, Pay Codes, Pay History, Valuations, Liability, Reconciliation.
- [ ] Skeleton or spinner loading state ships on every data-fetching surface.
- [ ] Keyboard shortcuts (`g e`, `g v`, etc.) implemented always-on and discoverable via `?` overlay; no settings-toggle in v1. (OQ-8)

### 8.4 E6.4 — Public calculator re-skin
- [ ] State selector, single-employee form, bulk-upload entry, result/breakdown screens all render with brand tokens.
- [ ] Sub-brand wordmark in page header; APA lockup in footer.
- [ ] PDF download CTA visible on single-employee result + bulk-summary screens, unconditional (no email capture). (OQ-6)
- [ ] Cat A/B/C result semantics + citation block content unchanged byte-for-byte (snapshot test).
- [ ] 2214/2214 LSL test suite green.
- [ ] 92 Playwright tests across 4 browsers green.
- [ ] Lighthouse (or equivalent) accessibility score ≥ 95 on `/`.

### 8.5 E6.5 — Report pipeline foundation
- [ ] PDF generation produces an A4 single-page test report with letterhead, body, and footer.
- [ ] Letterhead block: sub-brand wordmark + APA lockup + report title + generated-at timestamp.
- [ ] Methodology footer block: **full** version on page 1 (calc methodology version + state-engine version + data-as-at date + "calculated, not advice" + APA contact); **short** version on pages 2+ (state-engine version + "calculated, not advice" + APA URL). (OQ-10)
- [ ] Page X of Y footer renders on every page of multi-page test report.
- [ ] Print stylesheet renders the same report cleanly from browser print.
- [ ] No draft / preview watermarks anywhere.

### 8.6 E6.6 — Report templates per family
- [ ] **Single-employee** template wraps existing public-calc result + citation; PDF download CTA visible on result screen.
- [ ] **Bulk-summary** template wraps existing public-calc multi-employee summary; PDF download CTA visible on result screen.
- [ ] **E5.5 liability** template ships once E5.5 valuations + liability features land; one-page executive summary at top leading with a **3-column at-a-glance** (employees / total accrued weeks / total accrued $). (OQ-5 + OQ-11)
- [ ] **E5.6 reconciliation** template ships once E5.6 reconciliation feature lands; one-page executive summary at top leading with a **single headline number** (total variance $); per-row variance verdict table follows. (OQ-5 + OQ-11)
- [ ] Single-employee + bulk-summary templates do NOT carry a separate exec summary (OQ-5).
- [ ] All four templates inherit letterhead + methodology footer + page numbering from E6.5 foundation.
- [ ] Each template renders cleanly in print preview as well as PDF download.

---

## 9. Open questions

All open questions are RESOLVED as of v0.4 (operator sign-off 2026-05-27). Original questions retained for traceability; resolution under each.

OQ-1 (E6.1, business): **Wordmark visual direction** — does "LSL Calculator by APA" lean closer to the APA wordmark's typographic treatment, or earn its own distinct mark while keeping APA palette + typography? — **RESOLVED 2026-05-27 (v0.4 operator sign-off).** Sibling-product posture confirmed: "LSL Calculator by APA" earns its own distinct visual lockup while inheriting APA palette + typography (Xero Practice Manager precedent). Designer agent interprets and produces wordmark candidates under E6.1; operator approves before E6.2 starts. Owner: Tracy + designer agent.

OQ-2 (E6.1, business): **Icon set v1** — commission custom now, or accept Lucide / Heroicons as a v1 placeholder and commission custom for v1.1? — **RESOLVED 2026-05-27 (v0.4 operator sign-off).** Lucide ships as the v1 placeholder icon set to unblock E6.2; hard deadline to replace with a custom set **by the time E5.6 ships**. Landed in §5.1 and §8.1. Owner: Tracy.

OQ-3 (E6.2, business): **Font hosting** — self-hosted (no third-party request) or Google Fonts (faster initial setup, third-party request)? — **RESOLVED 2026-05-27 (v0.4 operator sign-off).** Self-host Montserrat + Source Sans Pro with `font-display: swap`. No third-party font CDN. Keeps LAUNCH-GUARD privacy posture clean. Landed in §5.1, §5.7, and §8.2. Owner: Tracy.

OQ-4 (E6.3, business): **Sidebar visibility on home org** — should the tenant switcher render at all for users with exactly one org membership, or only appear when a user has ≥ 2 org memberships (APA consultants)? — **RESOLVED 2026-05-27 (v0.4 operator sign-off).** Tenant switcher is **hidden** for single-org users; rendered only for users with ≥ 2 memberships. Landed in §5.2 and §8.3. Owner: Tracy.

OQ-5 (E6.5, business): **One-page exec summary on every report or only E5.5 / E5.6?** — **RESOLVED 2026-05-27 (v0.4 operator sign-off).** Exec summary on **E5.5 (liability) and E5.6 (reconciliation) only**. Single-employee and bulk-summary reports do not carry a separate exec summary — they are already short enough that a separate exec summary is noise. Landed in §5.4 and §8.6. Owner: Tracy.

OQ-6 (E6.6, business): **PDF download CTA placement on the public calc** — gated behind email capture (lightweight lead-gen) or unconditional? — **RESOLVED 2026-05-27 (v0.4 operator sign-off).** Unconditional PDF download in v1; email-capture experiment deferred to a separate growth epic. Landed in §5.3 and §8.4. Owner: Tracy.

OQ-7 (E6.4, business): **Bulk-upload result PDF** — *RESOLVED 2026-05-27 (v0.3 analyze pass).* Acceptance criteria §8.6 already commit to bulk PDF in v1. PM lean confirmed: both single-employee and bulk-summary PDFs ship in v1 — the audit trail bulk produces is the value. No remaining question.

OQ-8 (E6.3, business): **Keyboard shortcut accessibility opt-out** — power-user shortcuts (`g e`, `g v`, etc.) can interfere with screen-reader navigation. Should there be a Settings toggle to disable them, or should they always be active for everyone? — **RESOLVED 2026-05-27 (v0.4 operator sign-off).** Shortcuts ship **always-on in v1**; a Settings toggle to disable is deferred to a follow-up if any pilot user reports screen-reader interference. Landed in §5.2 and §8.3. Owner: Tracy.

OQ-9 (E6.3, business): **Acting-as banner persistence across hard refresh** — when an APA consultant switches into a client tenant and then hard-refreshes the page, does the platform stay in that tenant, or revert to the consultant's home org? — **RESOLVED 2026-05-27 (v0.4 operator sign-off).** Revert to home org on hard refresh **and after 30 minutes of idle**. Forces a deliberate re-entry into a non-home client tenant. Directly tied to success criterion 4 (zero mis-tenant incidents). Landed as MUST in §5.2 and as an AC in §8.3. Owner: Tracy.

OQ-10 (E6.5, business): **Methodology footer length on multi-page reports** — should the full methodology block (calc methodology version, state-engine version, data-as-at date, "calculated, not advice", APA contact) render on every single page, or only on page 1 with a short "see page 1" reference on pages 2+? — **RESOLVED 2026-05-27 (v0.4 operator sign-off).** Full block on page 1; **short version (state-engine version + "calculated, not advice" + APA URL) on pages 2+**. Keeps long reports readable while preserving the "calculated, not advice" disclaimer on every page. Landed in §5.4 and §8.5. Owner: Tracy.

OQ-11 (E6.6, business): **CFO exec summary numeric format** — should the one-page exec summary on E5.5 (liability) and E5.6 (reconciliation) reports lead with a single headline number, or a 3-column at-a-glance? — **RESOLVED 2026-05-27 (v0.4 operator sign-off).** Liability: **3-column at-a-glance** (employees / total accrued weeks / total accrued $) — CFOs want the breakdown. Reconciliation: **single headline number** (total variance $) — the variance total is the news. Landed in §8.6. Owner: Tracy.

OQ-12 (E6.4, business): **Sequencing — visual-identity split risk** — E6.4 (public re-skin) is independent of E5 progress. But if E5.1 ships unstyled before E6.2 + E6.4 land, customers will see `/` styled and `/app/*` default-shadcn for some window. Is that acceptable, or should E6.4 wait for `/app/*` parity? — **RESOLVED 2026-05-27 (v0.4 operator sign-off).** Ship E6.4 as soon as E6.2 is ready. Visual mismatch for an in-flight invite-only auth slice (E5.1) is lower risk than holding the public-calc upgrade. Already reflected in §3 sequencing constraint 3. Tracked as R-2 in §11. Owner: Tracy.

OQ-13 (E6.1, business / resourcing): **Designer engagement** — the spec acknowledges no designer is engaged. Who produces the sub-brand wordmark + custom icon set: (a) a hired human designer, (b) the in-team designer agent, (c) operator-driven via AI tools with iterative refinement? — **RESOLVED 2026-05-27 (v0.4 operator sign-off).** Start with the **in-team designer agent for v1** wordmark (fast, in-team, reversible). Commission a human designer for **v1.1 polish + custom icon set** once the platform is generating revenue. Combined with the §3 fallback clause (APA primary wordmark placeholder if E6.1 blocks > 14 days), this removes the designer-resource bottleneck from the E5.2 critical path. Owner: Tracy.

**Status:** all open questions closed. No unresolved OQs remain. Spec is ready for developer handoff.

---

## 10. Glossary

- **APA** — Australian Payroll Association (parent brand)
- **Sub-brand** — a product brand that inherits parent visual identity but has its own wordmark and posture (Xero Practice Manager precedent)
- **Lockup** — wordmark + descriptor combination presented as a single visual unit (e.g. "LSL Calculator" with "by Australian Payroll Association" beneath)
- **Token** — a named design value (colour, type size, shadow, radius) referenced from components — never hard-coded
- **shadcn variant** — a styled version of a shadcn component (e.g. `variant="brand-primary"`) defined via `cva` / class-variance-authority
- **A4** — 210 × 297 mm, the standard Australian / European page size
- **WCAG 2.2 AA** — Web Content Accessibility Guidelines version 2.2, level AA
- **Methodology footer** — the legal / methodology disclosure block on every page of every PDF report
- **Acting as <client>** — the persistent indicator on `/app/*` showing which tenant an APA consultant is currently operating against

---

---

## 11. Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | **Designer-resource bottleneck on E6.1 wordmark** — no designer engaged today; E6.2 (and therefore E5.2) blocked on wordmark approval. | MEDIUM | HIGH (blocks E5.2 critical path) | §3 fallback clause: E6.2 MAY proceed with APA primary wordmark placeholder after 14 days; sub-brand wordmark applied retrospectively. Tied to OQ-13 (designer engagement model). |
| R-2 | **Visual-identity split during E5.1 invite-only window** — `/` styled while `/app/*` shows default shadcn until E6.3 lands. | LOW | LOW (E5.1 is invite-only at launch; pilots tolerate v1 polish) | Acceptable per OQ-12 PM recommendation. Tracked, not mitigated further in v1. |
| R-3 | **Brand-source PDF lives outside the repo** (OneDrive only) — single-point-of-failure if link breaks or Tracy unavailable. | LOW | MEDIUM | E6.1 task: copy relevant pages of Brand Guidelines v2 to `docs/brand/apa-brand-source.pdf` in-repo with APA permission. |
| R-4 | **Engine regression via styling-only PRs** — unlikely but non-zero given the volume of UI changes. | LOW | HIGH (gold-standard suite is product-survival) | Mandatory: every E6 PR runs the full 2214/2214 LSL suite + 92 Playwright tests in CI. Hard merge gate. |
| R-5 | **Cross-tenant data leakage via tenant switcher UX bug** — visual indicator misses an action surface, leading to mis-tenant write. | LOW | HIGH (would invalidate success criterion 4) | §5.2 destructive-action confirm dialog requirement; QA must verify confirm dialog on every destructive action under non-home-tenant context. |

---

## Clarification Summary

### v0.4 — 2026-05-27 (operator sign-off pass)

**Source:** operator approval — all 12 remaining open questions (OQ-1..OQ-6, OQ-8..OQ-13) confirmed with the PM recommendation as-written under each.

**Spec amendments:**
- All OQs in §9 marked RESOLVED. Zero unresolved open questions remain.
- §5.1: Lucide locked as v1 placeholder icon set with "replace by E5.6 ships" deadline (OQ-2). Self-hosted Montserrat + Source Sans Pro added as a MUST (OQ-3).
- §5.2: Tenant switcher hidden for single-org users (OQ-4). Active tenant reverts to home org on hard refresh and after 30-min idle (OQ-9). Keyboard shortcuts ship always-on in v1 (OQ-8).
- §5.3: PDF download CTA on public calc is unconditional in v1 (OQ-6).
- §5.4: Methodology footer split — full block on page 1, short version on pages 2+ (OQ-10). Exec summary scope tightened to MUST on E5.5 + E5.6 only (OQ-5).
- §5.7: "operator preference TBD" font-hosting note removed — self-hosted is locked.
- §8.1: Lucide v1 + replace-by-E5.6 ACs landed (OQ-2).
- §8.2: Font hosting AC changed from "self-hosted OR CDN (decision recorded)" to "self-hosted" (OQ-3).
- §8.3: Added ACs for switcher-hide on single-org, tenant-revert on hard refresh + idle, destructive-action confirm dialog naming the active tenant, keyboard shortcuts always-on (OQ-4, OQ-8, OQ-9).
- §8.4: Added AC for unconditional PDF download CTA on public-calc result + bulk-summary screens (OQ-6).
- §8.5: Methodology footer AC split into full (page 1) + short (pages 2+) versions (OQ-10).
- §8.6: E5.5 liability exec summary leads with 3-column at-a-glance; E5.6 reconciliation exec summary leads with single headline number; single-employee + bulk-summary do not carry separate exec summaries (OQ-5, OQ-11).

**Deferred / noted, not amended:**
- OQ-1 (wordmark visual direction) — landed as process direction in §9 + tied to existing §7.6; designer agent interprets under E6.1.
- OQ-12 (sequencing — ship E6.4 ASAP) — already reflected in §3 sequencing constraint 3 and tracked as R-2 in §11; no further amendment required.
- OQ-13 (designer engagement model) — already covered by §3 fallback clause and §8.1 AC; no further amendment required.

**Status:** all open questions closed. Ready for developer handoff.

### v0.3 — 2026-05-27 (analyze pass)

**Source:** speckit-analyze + pm-analyze-split. 1 HIGH (resolved), 7 MEDIUM, 7 LOW PM-layer findings.

**Spec amendments:**
- **A09 HIGH resolved**: §3 sequencing fallback — E6.2 MAY proceed with APA primary wordmark placeholder if sub-brand approval blocks > 14 days.
- **A05 resolved**: OQ-7 (bulk PDF) confirmed as in-scope; struck from open questions.
- **A06 resolved**: §5.5 WCAG scope tightened — web surfaces WCAG 2.2 AA; PDFs get tagged reading order + alt text (PDF/UA full compliance deferred to v1.1).
- **A08 resolved**: §5.2 — destructive write actions under non-home-tenant context MUST require confirm dialog showing active tenant name.
- **A17 resolved**: §5.7 — currency MUST render as AUD with `$X,XXX.XX` format.
- **A18 resolved**: §5.8 — dark mode + PDF/UA explicitly OUT of v1 scope.
- **A12 resolved**: §11 Risks section added (R-1..R-5).

**Deferred / noted, not amended:**
- A01 (SC-1 baseline): pending operator decision on measurement-instrumentation timing.
- A02 (SC-3 qualitative-only): acceptable for v1; quant metric in v1.1.
- A03 (SC-6 sample size): low-priority polish.
- A10 (E5.1 first-impression): acceptable trade-off per OQ-12.
- A11 (brand source in repo): R-3 mitigation pending APA permission.
- A13 (E5 spec cross-reference cleanup): follow-up after E6 ships.
- A14 (epics.md Sequence argument): handled by Step 6 of pm-epic-writing.

### v0.2 — 2026-05-27 (clarify pass)

**Source:** speckit-clarify filtered through pm-clarify-guard. 6 new OQs added.

- OQ-8: keyboard-shortcut accessibility opt-out posture (PM recommends always-on + follow-up toggle if needed).
- OQ-9: acting-as banner persistence across hard refresh (PM recommends revert to home org on hard refresh + 30-min idle — safety-first).
- OQ-10: methodology footer length on multi-page reports (PM recommends short on every page + full on page 1).
- OQ-11: CFO exec summary numeric format (PM recommends 3-column for liability, single headline for reconciliation).
- OQ-12: sequencing risk if E5.1 ships unstyled before E6.4 lands (PM recommends ship E6.4 as soon as E6.2 ready; E5.1 is invite-only).
- OQ-13: designer engagement model (PM recommends in-team designer agent for v1, human designer for v1.1).

**Open questions remaining (as of v0.2):** OQ-1..OQ-6 + OQ-8..OQ-13 pending operator sign-off (OQ-7 RESOLVED in v0.3). *Subsequently all resolved in v0.4 — see v0.4 entry above.*

*End of v0.4. All open questions resolved. Spec ready for developer handoff — invoke `/dev-feature-plan` against `.specify/features/006-ui-design-system/spec.md` when operator gives the go-ahead.*
