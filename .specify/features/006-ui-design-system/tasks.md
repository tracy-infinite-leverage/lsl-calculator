# Task Checklist — LSL Sub-Brand UI System + Report Pipeline (E6)

**Slug:** `006-ui-design-system`
**Spec:** `.specify/features/006-ui-design-system/spec.md` v0.4
**Plan:** `.specify/features/006-ui-design-system/impl-plan.md`
**Generated:** 2026-05-27
**Branch:** `006-ui-design-system`

**Legend:**
- `[P]` = parallelizable with sibling tasks at the same level
- Effort: S (≤ 1 day) · M (1–3 days) · L (3–5 days) · XL (> 5 days)
- AC = Acceptance Criterion from spec §8

---

## Phase 1 — E6.1 Sub-brand identity (DESIGN PHASE)

**Owner:** in-team designer agent + operator approval.
**This is NOT an engineering phase.** Developer agent does not write code in Phase 1.

### Task 1.1: Copy APA Brand Guidelines v2 source into the repo

**Description**: Resolve R-3 — copy relevant pages of the APA Brand Guidelines v2.0 PDF from OneDrive into `docs/brand/apa-brand-source.pdf` so the source survives a OneDrive link break or owner unavailability. Requires APA permission confirmation.

**Acceptance Criteria** (spec §11 R-3):
- [ ] `docs/brand/apa-brand-source.pdf` committed (or excerpt of palette + typography pages if full PDF licence unclear)
- [ ] APA permission recorded inline in a `docs/brand/README.md` note

**Effort**: S
**Dependencies**: None
**Assignee**: operator (APA permission) + designer agent

### Task 1.2: Produce sub-brand wordmark candidates

**Description**: Designer agent interprets §7.6 sibling-product posture (Xero Practice Manager precedent) and produces 1–3 wordmark candidates: "LSL Calculator" in Montserrat Semibold with "by Australian Payroll Association" lockup beneath in Source Sans Pro Regular. Inherits APA palette + typography but earns its own visual personality. Wordmark approval cycles with a non-technical operator typically run 5–10 business days (multiple candidates → revisions → operator approval → favicon export); budget accordingly.

**Source: Spec §8.1 · Resolves G-4**

**Acceptance Criteria** (AC §8.1 + OQ-1):
- [ ] At least 1 wordmark candidate produced as SVG
- [ ] Sibling-product posture honoured — distinct lockup, not a tint of the APA primary wordmark
- [ ] Operator selects the winning candidate
- [ ] If 14 days elapse without operator sign-off, spec §3 fallback activates (Phase 2 proceeds with APA primary placeholder)

**Effort**: L (re-sized from M per G-4 — typical wordmark approval cycle exceeds M's 1–3 day range)
**Dependencies**: Task 1.1
**Assignee**: in-team designer agent

### Task 1.3: Operator approval gate on selected wordmark

**Description**: Record operator sign-off on the selected wordmark in `docs/brand/wordmark/README.md` (date + initials). This is the hard gate to Phase 2.

**Acceptance Criteria** (AC §8.1):
- [ ] Operator sign-off recorded on the selected wordmark before Phase 2 begins
- [ ] If 14 days elapse without sign-off, fallback clause from spec §3 activates (Phase 2 proceeds with APA primary wordmark placeholder)

**Effort**: S
**Dependencies**: Task 1.2
**Assignee**: operator

### Task 1.4: Export wordmark + favicon assets

**Description**: Export the approved wordmark as SVG + PNG (1x, 2x, 3x) + a full favicon set (16, 32, 48, 192, 512, Apple touch icon, safari-pinned-tab.svg) and commit under `docs/brand/wordmark/`. Assets live in `docs/brand/wordmark/` and are copied to `website/public/brand/` at build time via `scripts/sync-brand-assets.{ts,sh}` invoked from the `prebuild` npm script. **No symlinks** — Vercel build container + OS-level differences make symlinks fragile.

**Source: Spec §8.1 · Resolves G-12**

**Acceptance Criteria** (AC §8.1):
- [ ] `docs/brand/wordmark/wordmark.svg` committed
- [ ] `docs/brand/wordmark/wordmark-{1x,2x,3x}.png` committed
- [ ] Favicon set committed under `docs/brand/wordmark/favicons/`
- [ ] `scripts/sync-brand-assets.{ts,sh}` committed and wired to `prebuild` in `website/package.json`
- [ ] `website/public/brand/` populated at build time; not committed to git (gitignored)
- [ ] Symlink option explicitly rejected; rationale recorded in `docs/brand/wordmark/README.md`

**Effort**: S
**Dependencies**: Task 1.3
**Assignee**: designer agent

### Task 1.5: Iconography direction document

**Description**: Designer agent commits `docs/brand/iconography-direction.md` describing the v1.1 custom icon direction (light line-weight, optionally with subtle broken-line details, standalone or encircled with circle filled in primary/secondary brand colour). v1 uses Lucide (OQ-2) — this doc captures the v1.1 direction so the future designer engagement starts from a brief, not a blank page.

**Future-tense flag (G-9):** The hard deadline ("custom icon set replaces Lucide by the time E5.6 ships") must be surfaced into E5.6's planning when E5.6 is eventually written. This task additionally records a line in `docs/product/epic-status.md` E6 section flagging the dependency, so the PM agent picks it up when E5.6 is scoped.

**Source: Spec §8.1 · OQ-2 · Flags G-9**

**Acceptance Criteria** (AC §8.1 + OQ-2):
- [ ] `docs/brand/iconography-direction.md` committed
- [ ] Hard deadline noted: custom icon set replaces Lucide **by the time E5.6 ships**
- [ ] `docs/product/epic-status.md` E6 section carries a "E5.6 dependency: blocked until custom icon set replaces Lucide (OQ-2 deadline)" line for the PM to honour when E5.6 is written

**Effort**: S
**Dependencies**: Task 1.1
**Assignee**: designer agent

---

## Phase 2 — E6.2 Tokens + core component library (HARD GATE TO E5.2)

**Critical path to E5.2 unblock.** Every task here lands before any other phase can start (except where independent of approved wordmark).

### Task 2.1: Install Storybook 8 + axe-core add-on

**Description**: Add Storybook 8 under `website/.storybook/` with the official a11y add-on. Use the Next.js + Tailwind framework preset. Cost guardrail: Chromatic NOT installed.

**Acceptance Criteria** (PD-3):
- [ ] `website/.storybook/main.ts` + `preview.ts` committed
- [ ] Tailwind imported into Storybook preview
- [ ] axe-core add-on (`@storybook/addon-a11y`) configured
- [ ] `npm run storybook` boots without errors

**Effort**: S
**Dependencies**: Phase 1 complete (or 14-day fallback active)
**Assignee**: developer

### Task 2.2: Self-host Montserrat + Source Sans Pro woff2 [P]

**Description**: Download Montserrat (Light / Regular / Semibold) and Source Sans Pro (Light / Regular / Semibold) as woff2 subsets (Latin only for v1). Place under `website/public/fonts/`. Register via `next/font/local` with `font-display: swap`. No third-party CDN.

**Precursor (resolves G-10):** Before touching fonts, record current Lighthouse FCP / CLS numbers on `/` and pin them in `docs/qa/e6-baseline-metrics.md`. Post-change numbers must be **within ±5% or strictly better** — otherwise the task is not done.

**Source: Spec §8.2 · OQ-3 · Resolves G-10**

**Acceptance Criteria** (AC §8.2 + OQ-3):
- [ ] `docs/qa/e6-baseline-metrics.md` committed with pre-change FCP / CLS numbers + measurement methodology
- [ ] `website/public/fonts/montserrat-{light,regular,semibold}.woff2` committed
- [ ] `website/public/fonts/source-sans-pro-{light,regular,semibold}.woff2` committed
- [ ] `app/layout.tsx` uses `next/font/local` for both families
- [ ] No external font CDN request appears in network panel
- [ ] Post-change Lighthouse FCP / CLS within ±5% of baseline or strictly better; numbers appended to `docs/qa/e6-baseline-metrics.md`

**Effort**: S
**Dependencies**: Task 2.1
**Assignee**: developer

### Task 2.3: Define Tailwind theme tokens [P]

**Description**: Extend `website/tailwind.config.ts` with the full APA palette (primary navy `#48608a`, gold `#d9a428`, white; extended: light blue `#a0aec1`, yellow accent `#eebd3c`, dark blue `#324d61`, charcoal `#333232`, grey `#808897`; advisory teal `#6ec8c0`), gradient utilities (navy↔gold, navy↔light blue — backgrounds only), type scale (Title 32–72, H1 22–28, H2 18–20, H3 14–16, Body 10–12, Caption 8 — pt→rem via 0.083 at 16px base), shadow tokens (Linear-style soft), radius tokens (generous), spacing tokens.

**Acceptance Criteria** (AC §8.2):
- [ ] `tailwind.config.ts` extends `theme.colors.brand.*` with full palette
- [ ] Gradient utilities exposed as `bg-gradient-brand-{navy-gold,navy-lightblue}`
- [ ] Type-scale tokens defined in `theme.fontSize`
- [ ] Shadow + radius tokens defined
- [ ] No hard-coded brand colour values anywhere in component CSS

**Effort**: M
**Dependencies**: Task 2.1
**Assignee**: developer

### Task 2.4: Generate `lib/tokens.ts` typed mirror for PDF context

**Description**: Generate (or hand-author + lint) a typed TS re-export of Tailwind tokens for non-CSS contexts (specifically: react-pdf templates in Phase 4). Single source of truth = Tailwind config; `lib/tokens.ts` reads from it.

**Acceptance Criteria** (impl-plan §1.1):
- [ ] `lib/tokens.ts` exports `colors`, `fontSizes`, `spacing`, `radii`, `shadows` as typed constants
- [ ] Unit test confirms `lib/tokens.ts` values match `tailwind.config.ts` source

**Effort**: S
**Dependencies**: Task 2.3
**Assignee**: developer

### Task 2.5: Build Wordmark + Lockup + Icon barrel components

**Description**: `components/brand/Wordmark.tsx` (renders the SVG from Task 1.4 — or APA primary placeholder if fallback active), `components/brand/Lockup.tsx` (Wordmark + "by Australian Payroll Association"), `components/brand/Icon.tsx` (single barrel re-exporting all Lucide icons used in the app — so v1.1 custom-icon swap is a one-file change per OQ-2).

**Acceptance Criteria** (AC §8.1 + OQ-2):
- [ ] `Wordmark` renders SVG with `width`/`height`/`className` props
- [ ] `Lockup` composes Wordmark + APA tagline
- [ ] `Icon` is the single import point — no other file imports from `lucide-react` directly
- [ ] All three have Storybook stories

**Effort**: S
**Dependencies**: Task 1.4 (or fallback wordmark from Task 2.3)
**Assignee**: developer

### Task 2.6: shadcn variant overrides — 16 components [P]

**Description**: Build brand-styled variants for Button (primary / secondary / ghost / destructive / advisory), Input, Textarea, Select, Checkbox, Radio, Switch, Table, Card, Tabs, Accordion, Modal/Dialog, Toast, Tooltip, Badge, Alert. Implement via `cva` (class-variance-authority) — extend shadcn defaults, do not fork. Each component is a separate sub-task — parallel-able across multiple developer sessions.

**Acceptance Criteria** (AC §8.2):
- [ ] All 16 components have at least one brand-styled variant referencing tokens (no hard-coded colours)
- [ ] Each component has at least one Storybook story per variant
- [ ] Each variant passes Storybook axe-core add-on with zero serious/critical violations

**Effort**: L
**Dependencies**: Task 2.3, Task 2.5
**Assignee**: developer

### Task 2.7: Brand voice + currency formatter utilities

**Description**: `lib/format.ts` — `formatAUD(n)` returns `$X,XXX.XX` per spec §5.7. `lib/text-rules.ts` — sentence-case helpers for headings (brand voice rule from APA guide). Both exported and used everywhere currency / heading copy is rendered.

**Acceptance Criteria** (spec §5.7):
- [ ] `formatAUD(9880.04)` returns `"$9,880.04"`
- [ ] Unit tests cover edge cases (0, negative, > 1M, fractional pence)
- [ ] Heading helper enforces sentence case

**Effort**: S
**Dependencies**: None
**Assignee**: developer

### Task 2.8: Wire axe-core into existing Playwright suite

**Description**: Add `@axe-core/playwright` to `website/e2e/`. Add a new spec file `website/e2e/a11y.spec.ts` that visits `/` and asserts zero serious/critical violations. This is the **hard CI merge gate** from E6.2 onward (PD-2). Lighthouse stays as a separate observability check (Task 4.7).

**Acceptance Criteria** (AC §8.2 + PD-2):
- [ ] `@axe-core/playwright` installed
- [ ] `website/e2e/a11y.spec.ts` committed; runs in CI
- [ ] CI fails if any serious/critical violation appears on `/`
- [ ] Existing 92 Playwright tests + 2214/2214 LSL suite remain green

**Effort**: S
**Dependencies**: Task 2.6
**Assignee**: developer

### Task 2.9: Phase 2 acceptance gate — full suite green

**Description**: Final gate before Phase 2 closes. Run the full test suite (LSL 2214/2214 + 92 Playwright × 4 browsers + axe-core E2E + Storybook a11y) and confirm all green.

**Acceptance Criteria** (AC §8.2):
- [ ] 2214/2214 LSL suite green
- [ ] 92 Playwright tests across 4 browsers green
- [ ] axe-core E2E: zero serious/critical violations
- [ ] Storybook builds cleanly; all stories render
- [ ] Task 2.10 (CSP + bundle audit) passes
- [ ] Task 2.11 (test-folder diff guard) passes

**Effort**: S
**Dependencies**: Tasks 2.1–2.8, 2.10, 2.11
**Assignee**: developer

### Task 2.10: CSP + bundle audit guard

**Description**: Spec §5.7 mandates no dependency that breaks the existing CSP or violates LAUNCH-GUARD. Phase 0/2 introduces three new dependencies (`@react-pdf/renderer`, `@storybook/*`, `@axe-core/playwright`) plus self-hosted fonts. This task adds a guard that (a) runs `npm run build` and greps the resulting `.next/static/*` chunks for any embedded third-party URL or `@storybook/*` import, (b) loads `/` and `/app/*` in a fresh browser with DevTools network panel open and asserts **zero third-party network requests** appear, (c) confirms the production CSP header (currently default Next.js) still passes a build smoke test. Run on every PR touching `website/tailwind.config.ts`, `website/app/layout.tsx`, `website/public/fonts/*`, or `website/.storybook/*`.

**Source: Spec §5.7 + §5.1 (no-third-party-font-CDN guard) + LAUNCH-GUARD posture · Resolves G-3 + G-6**

**Acceptance Criteria** (Spec §5.7 + §5.1):
- [ ] `scripts/audit-bundle.{ts,sh}` committed — greps `.next/static/*` for third-party URLs and `@storybook/*` imports, fails on hit
- [ ] Network-panel audit documented in `docs/qa/e6-csp-audit.md` — methodology + pass result for `/` and one `/app/*` route
- [ ] CI job (or `package.json` script) wires the bundle audit into Phase 2 acceptance gate
- [ ] Bundle-size delta vs pre-Phase-2 baseline is documented; any `@storybook/*` chunk leaking into client-side bundle fails the gate
- [ ] Production CSP header passes a smoke test (no inline-script / unsafe-eval introduced)

**Effort**: S
**Dependencies**: Tasks 2.1, 2.2, 2.3, 2.6, 2.8 (i.e. all dependency-introducing tasks complete)
**Assignee**: developer

### Task 2.10b: Production CSP-header smoke test

**Description**: AC #5 of Task 2.10 (production CSP header smoke test) was explicitly deferred in PR #65 because shipping a first-time strict enforcing CSP touches `proxy.ts`, Vercel headers config, every server layout (for nonces), and the analytics origins — far beyond S effort. This sibling task closes the loop with a smaller, safer scope: emit a strict `Content-Security-Policy-Report-Only` header via `next.config.ts headers()` and add a smoke test that boots `next start` against the production build, fetches `/` and `/privacy`, and asserts the header is present, has no `unsafe-inline` / `unsafe-eval` in `script-src` / `style-src`, and contains no wildcard third-party origins. Report-only mode keeps the app functional today; the day a future security-hardening epic adds nonces and flips the header to enforcing, this smoke test guards the policy unchanged.

**Source: Spec §5.7 + PR #65 [SCOPE-NOTE] · Closes AC #5 of canonical Task 2.10**

**Acceptance Criteria** (Spec §5.7):
- [x] Smoke test asserts production CSP header is present and lacks `unsafe-inline`, `unsafe-eval`, and any wildcard third-party origin in `script-src` / `style-src`
- [x] Smoke test runs in CI on every E6 PR
- [x] Documented in `docs/qa/e6-csp-audit.md` (append section "CSP header smoke test")

**Effort**: S
**Dependencies**: Task 2.10 (CSP + bundle audit guard) — landed via PR #65
**Assignee**: developer

### Task 2.11: Test-folder diff guard (engine + Playwright sanctity)

**Description**: Spec SC-7 and spec §5.3 mandate that the 2214/2214 LSL suite and 92 Playwright tests are **off-limits for modification** in any E6 PR. This task adds a CI rule that fails any E6 PR if `git diff main -- tests/` is non-empty. Makes the test-sanctity contract enforceable rather than honour-based. Tiny rule, lands with Phase 2.

**Source: Spec §5.3 + SC-7 · Resolves G-7**

**Acceptance Criteria** (Spec §5.3 + SC-7):
- [ ] CI workflow (or pre-commit hook) executes `git diff origin/main -- tests/` and fails the build if the diff is non-empty
- [ ] Documented in `docs/qa/e6-test-sanctity.md` so future contributors understand the rule
- [ ] Guard runs on every E6 PR; bypass requires explicit operator override (no `--no-verify` shortcut)
- [ ] Confirmed green on the current branch (no `tests/` changes present)

**Effort**: S
**Dependencies**: Task 2.1 (Storybook setup) — needed only to ensure the guard doesn't false-positive on test-config edits
**Assignee**: developer

---

## Phase 3a — E6.3 `/app` workspace shell

**Parallel-able with Phase 3b.** Both consume Phase 2 tokens + components.

### Task 3.1: TopNav component [P]

**Description**: Build `components/app-shell/TopNav.tsx` with sub-brand Lockup (left), user menu (avatar + dropdown — Sign out, Profile), notifications affordance (bell icon, badge for unread). Renders inside `app/(app)/layout.tsx`.

**Acceptance Criteria** (AC §8.3):
- [ ] TopNav renders on every `/app/*` route
- [ ] Wordmark / Lockup visible top-left
- [ ] User menu opens / closes on click; signs out via existing E5.1 auth action
- [ ] Notifications icon visible (functional bell logic out of scope here — placeholder badge OK)

**Effort**: S
**Dependencies**: Phase 2 complete
**Assignee**: developer

### Task 3.2: Sidebar component with placeholder entries [P]

**Description**: Build `components/app-shell/Sidebar.tsx` with entries: Employees, Pay Codes, Pay History, Valuations, Liability, Reconciliation, Settings. Each entry routes to its `/app/<slug>` route. Hide entries whose underlying E5 feature has not landed yet (feature flag via env var or simple constant).

**Acceptance Criteria** (AC §8.3):
- [ ] Sidebar renders on every `/app/*` route
- [ ] All seven entries listed; active route highlighted
- [ ] Hidden entries gated by a documented feature-flag mechanism

**Effort**: S
**Dependencies**: Phase 2 complete
**Assignee**: developer

### Task 3.3-bis: Define `SessionCookieClaims` cross-epic contract type

**Description**: Spec OQ-9 mandates home-org revert on hard refresh, which requires E6.3 to read a server-rendered session cookie. The cookie's claim shape is owned by E5.1 (auth slice) — which has not merged to `main`. This task defines the TypeScript interface contract that both E5.1 (writer) and E6.3 (reader) honour, so E6.3 (Task 3.3) can build against the type even if E5.1's implementation is still in flight. Stub the type now; E5.1 fills the writer side independently.

**Source: Spec §5.2 (OQ-9) · impl-plan §1.1 decision 4 · Resolves G-2**

**Acceptance Criteria** (Spec §5.2 + impl-plan §1.1):
- [ ] `website/lib/auth/session-claims.ts` committed with the `SessionCookieClaims` interface: `{ activeTenantId: string; homeTenantId: string; membershipCount: number; claimIssuer: 'supabase-e5.1' }`
- [ ] File header documents the claim-issuer expectation (Supabase JWT signed by service role) and the consumer expectations (E6.3 reads as source of truth on hard refresh)
- [ ] Type is exported and consumable from both `lib/tenant-context.tsx` (E6.3) and the E5.1 auth module (cross-reference noted in inline comment)
- [ ] No runtime code — type-only contract; if E5.1 amends the cookie shape, this file is the single place both epics edit

**Effort**: S
**Dependencies**: Phase 2 complete
**Assignee**: developer

### Task 3.3: TenantContext provider — home-org revert + idle reset

**Description**: Build `lib/tenant-context.tsx`. Initial state hydrated from server-rendered session cookie (shape defined by `SessionCookieClaims` from Task 3.3-bis) — on hard refresh, cookie reads home org (OQ-9). Add `setTimeout`-based 30-minute idle reset; reset timer on user activity (`mousemove`, `keydown`, `visibilitychange`).

**Source: Spec §8.3 · OQ-9**

**Acceptance Criteria** (AC §8.3 + OQ-9):
- [ ] Hard refresh always reverts active tenant to home org
- [ ] 30-min idle reverts active tenant to home org
- [ ] User activity within the window keeps the active tenant
- [ ] Unit tests cover both revert paths
- [ ] Reads against `SessionCookieClaims` type from Task 3.3-bis (no inline duplicate of the cookie shape)

**Effort**: M
**Dependencies**: Task 3.1, Task 3.2, Task 3.3-bis
**Assignee**: developer

### Task 3.4: TenantSwitcher + ActingAsBanner components

**Description**: `components/app-shell/TenantSwitcher.tsx` — dropdown of user's memberships; hidden when `membershipCount < 2` (OQ-4). `components/app-shell/ActingAsBanner.tsx` — full-width strip below TopNav, gold background, "Acting as: <client name>", visible whenever `activeTenantId !== homeTenantId`.

**Acceptance Criteria** (AC §8.3 + OQ-4):
- [ ] Switcher hidden for single-org users
- [ ] Switcher renders for users with ≥ 2 memberships
- [ ] ActingAsBanner visible whenever active ≠ home
- [ ] Banner uses `colors.brand.gold` token, contrast verified WCAG 2.2 AA

**Effort**: M
**Dependencies**: Task 3.3
**Assignee**: developer

### Task 3.5: ConfirmDestructiveDialog wrapper

**Description**: Build `components/app-shell/ConfirmDestructiveDialog.tsx` — wraps any destructive write action (delete employee, hard-reset mapping, delete saved valuation). When `isActingNonHome === true`, shows a confirm dialog naming the active tenant in the title and body. When acting on home org, skips the dialog OR shows a lighter standard confirm — operator's call (default: skip dialog, since the same confirm friction on every action is hostile UX).

**Operator awareness (G-8):** Spec §5.2 only mandates the dialog for non-home-tenant context. The home-org skip is inside the SC-4 safety envelope (mis-tenant only happens off home org). Default to skip; if any pilot user reports a near-miss in home-org context, flip the default. Operator confirms the decision at task kickoff and records it inline.

**Source: Spec §8.3 · R-5 · OQ-flag G-8**

**Acceptance Criteria** (AC §8.3 + R-5):
- [ ] Dialog appears on destructive actions under non-home tenant
- [ ] Dialog title + body name the active client tenant
- [ ] Tests cover both home-org and non-home-org branches
- [ ] Operator decision on home-org dialog default recorded inline at task kickoff

**Effort**: S
**Dependencies**: Task 3.3
**Assignee**: developer

### Task 3.6: Breadcrumbs component [P]

**Description**: Build `components/app-shell/Breadcrumbs.tsx` — reads route segments + maps to human labels via a route-config map. Renders on every `/app/*` page below TopNav (or alongside ActingAsBanner).

**Acceptance Criteria** (AC §8.3):
- [ ] Breadcrumbs render on every `/app/*` page
- [ ] Route labels are human-friendly (sentence case)
- [ ] Keyboard-navigable (each crumb is a real anchor)

**Effort**: S
**Dependencies**: Task 3.1
**Assignee**: developer

### Task 3.7: Six opinionated empty states [P]

**Description**: Build empty-state components for Employees, Pay Codes, Pay History, Valuations, Liability, Reconciliation. Each has an illustration slot (placeholder div for v1 — designer agent supplies illustrations later), one-line headline, two-line subtext, single primary CTA. Six surfaces × Storybook stories × integration into six `/app/*` routes is more than M's 1–3 day range.

**Source: Spec §8.3 · Resolves G-grill resizing recommendation**

**Acceptance Criteria** (AC §8.3):
- [ ] All six empty states have Storybook stories
- [ ] Each surface (under `/app/<slug>`) renders its empty state when data is empty
- [ ] Each empty state has exactly one primary CTA
- [ ] Copy reviewed inline with operator (sentence case, brand voice)

**Effort**: L (re-sized from M — six components + six route integrations + six stories exceeds M ceiling)
**Dependencies**: Phase 2 complete
**Assignee**: developer

### Task 3.8: Skeleton + Spinner loading components [P]

**Description**: Build `components/ui/Skeleton.tsx` (block-shaped grey placeholder, subtle pulse) and `components/ui/Spinner.tsx`. Wire skeleton into every data-fetching surface (Employees list, Pay History table, Valuations list, Liability summary, Reconciliation summary).

**Acceptance Criteria** (AC §8.3):
- [ ] Both components have Storybook stories
- [ ] Every data-fetching `/app/*` surface renders a skeleton or spinner while loading
- [ ] `prefers-reduced-motion` honoured — skeleton pulse stops (spec §5.5)

**Effort**: S
**Dependencies**: Phase 2 complete
**Assignee**: developer

### Task 3.9: Keyboard shortcut handler + `?` overlay

**Description**: Build `lib/keyboard-shortcuts.tsx` — `g e` (Employees), `g v` (Valuations), `g p` (Pay Codes), `g h` (Pay History), `g l` (Liability), `g r` (Reconciliation), `g s` (Settings). Always-on (OQ-8). `?` opens a modal listing all shortcuts. Shortcut handler ignores keystrokes when focus is in `input` / `textarea` / `[contenteditable]`.

**Acceptance Criteria** (AC §8.3 + OQ-8):
- [ ] Shortcuts navigate to the correct route
- [ ] `?` opens the shortcuts overlay
- [ ] Shortcuts do not fire while typing in form fields
- [ ] No Settings toggle in v1 (deferred per OQ-8)

**Effort**: M
**Dependencies**: Task 3.1, Task 3.2
**Assignee**: developer

### Task 3.10: Phase 3a acceptance gate

**Description**: Run full test suite + axe-core on every `/app/*` route. Confirm no regressions.

**Acceptance Criteria** (AC §8.3):
- [ ] 2214/2214 LSL suite green
- [ ] 92 Playwright tests green
- [ ] axe-core: zero serious/critical violations on `/app/*`

**Effort**: S
**Dependencies**: Tasks 3.1–3.9
**Assignee**: developer

---

## Phase 3b — E6.4 Public calculator re-skin

**Parallel-able with Phase 3a.**

### Task 4.1: Re-skin state selector [P]

**Description**: Apply Phase 2 tokens + Button variants to the state selector at `/`. No behavioural change.

**Acceptance Criteria** (AC §8.4):
- [ ] State selector uses brand tokens
- [ ] All 8 states selectable; navigation behaviour unchanged
- [ ] Playwright tests for state selector green

**Effort**: S
**Dependencies**: Phase 2 complete
**Assignee**: developer

### Task 4.2: Re-skin single-employee form [P]

**Description**: Apply Input / Select / Button / Card variants to the single-employee calc form.

**Acceptance Criteria** (AC §8.4):
- [ ] Form renders with brand tokens
- [ ] Form submission behaviour unchanged
- [ ] Playwright tests green

**Effort**: M
**Dependencies**: Phase 2 complete
**Assignee**: developer

### Task 4.3: Re-skin bulk-upload entry [P]

**Description**: Apply brand tokens to bulk-upload (CSV) entry surface — upload affordance, validation messages, file picker.

**Acceptance Criteria** (AC §8.4):
- [ ] Upload surface uses brand tokens
- [ ] CSV validation messaging uses Alert variant
- [ ] Playwright tests green

**Effort**: M
**Dependencies**: Phase 2 complete
**Assignee**: developer

### Task 4.4: Re-skin result + breakdown screens

**Description**: Apply brand tokens to single-employee result + bulk-summary result + per-row breakdown. **Critical:** Cat A/B/C result semantics + citation block content must remain byte-for-byte unchanged. Add a snapshot test of the citation block markup to enforce.

**Acceptance Criteria** (AC §8.4):
- [ ] Result screens use brand tokens (Card, Table, Badge variants)
- [ ] Cat A/B/C semantics + presentation hierarchy unchanged (number first, citation second)
- [ ] Citation block snapshot test added and green — byte-for-byte unchanged
- [ ] 2214/2214 LSL suite green
- [ ] 92 Playwright tests green

**Effort**: M
**Dependencies**: Tasks 4.1, 4.2, 4.3
**Assignee**: developer

### Task 4.5: Page header + footer with sub-brand wordmark + APA lockup

**Description**: Update `app/(public)/layout.tsx` — Wordmark in header, Lockup in footer. Footer also carries the methodology version + "calculated, not advice" + APA URL (mirrors short footer block from Phase 4 — consistent voice between web + PDF).

**Acceptance Criteria** (AC §8.4 + spec §5.3):
- [ ] Wordmark visible in page header on `/`
- [ ] APA lockup visible in page footer on `/`
- [ ] Footer disclosure line includes "calculated, not advice"

**Effort**: S
**Dependencies**: Task 2.5
**Assignee**: developer

### Task 4.6: PDF download CTA on result + bulk-summary screens

**Description**: Add a Button (primary variant) "Download PDF" on the single-employee result screen + the bulk-summary result screen. Wires to the Phase 4 / Phase 5a API endpoint. Unconditional — no email-capture gate (OQ-6).

**Sequencing guard (resolves G-5):** Spec §8.4 mandates the CTA is **unconditional** — visible-but-disabled is not unconditional in the user-outcome sense. To prevent a "dead CTA" state from shipping to `main`, the operator picks ONE of two paths at task kickoff and records the choice inline:
1. **Sequencing path:** Phase 3b does NOT merge to `main` until Phase 5a is merge-ready. CTA is wired to the real endpoint from day one.
2. **Feature-flag path:** CTA gated by `NEXT_PUBLIC_PDF_DOWNLOAD_ENABLED=false` until Phase 5a lands; flag is flipped in the Phase 5a merge PR.

**Source: Spec §8.4 · OQ-6 · Resolves G-5**

**Acceptance Criteria** (AC §8.4 + OQ-6):
- [ ] PDF CTA visible on both result screens
- [ ] No email-capture gate
- [ ] One of the two sequencing-guard paths chosen and recorded inline at task kickoff
- [ ] No "visible-but-disabled" or "coming soon" CTA state ships to `main` — either fully functional or fully hidden

**Effort**: S
**Dependencies**: Task 4.4 (CTA placement); Phase 5a (functional download)
**Assignee**: developer

### Task 4.7: Lighthouse CI script for `/`

**Description**: Add a Lighthouse CI script that runs on PR — accessibility score on `/` target ≥ 95. Non-blocking observability metric per PD-2.

**Acceptance Criteria** (AC §8.4 + PD-2):
- [ ] Lighthouse CI runs on every PR
- [ ] Score reported in PR comment
- [ ] Does NOT block merge (axe-core E2E from Task 2.8 is the hard gate)

**Effort**: S
**Dependencies**: Task 2.8
**Assignee**: developer

### Task 4.8: Phase 3b acceptance gate

**Description**: Run full test suite. Confirm no regressions.

**Acceptance Criteria** (AC §8.4):
- [ ] 2214/2214 LSL suite green
- [ ] 92 Playwright tests across 4 browsers green
- [ ] axe-core: zero serious/critical violations on `/`
- [ ] Lighthouse accessibility ≥ 95 on `/`
- [ ] Citation block snapshot green

**Effort**: S
**Dependencies**: Tasks 4.1–4.7
**Assignee**: developer

---

## Phase 4 — E6.5 Report pipeline foundation

### Task 5.1: react-pdf spike — A4 + Letterhead + MethodologyFooter + PageNumber

**Description**: Throwaway spike per Phase 0 PD-1 validation. Install `@react-pdf/renderer`. Build a 5-page test report rendering: page 1 with letterhead + full methodology footer; pages 2–5 with short methodology footer; Page X of Y on every page. Validate A4 dimensions (210 × 297 mm), font embedding for Montserrat Semibold + Source Sans Pro Regular, footer pagination behaviour.

**Acceptance Criteria** (impl-plan §PD-1):
- [ ] 5-page test PDF renders correctly on A4
- [ ] Letterhead visible on page 1 only
- [ ] Full methodology footer on page 1; short version on pages 2–5
- [ ] Page X of Y on every page
- [ ] Both font faces embed cleanly
- [ ] If citation block rich text fails under react-pdf, document failure mode and decide on Puppeteer fallback BEFORE Task 5.2

**Effort**: M
**Dependencies**: Phase 2 complete (tokens)
**Assignee**: developer

### Task 5.2: Build production Letterhead component

**Description**: Promote spike output into `lib/pdf/Letterhead.tsx` — accepts `ReportContext` (reportTitle, generatedAtIso, organisationName?). Renders Wordmark + APA lockup + report title + generated-at timestamp + optional "for: <organisation name>" line.

**Acceptance Criteria** (AC §8.5):
- [ ] Letterhead renders sub-brand wordmark + APA lockup
- [ ] Report title + timestamp + optional org name visible
- [ ] Snapshot test pins the layout

**Effort**: S
**Dependencies**: Task 5.1
**Assignee**: developer

### Task 5.3: Build MethodologyFooter component (full + short variants)

**Description**: `lib/pdf/MethodologyFooter.tsx` — accepts `ReportContext`. `variant="full"` renders calc methodology version + state-engine version + data-as-at date + "calculated, not advice" + APA contact (email + URL). `variant="short"` renders state-engine version + "calculated, not advice" + APA URL only (OQ-10).

**Acceptance Criteria** (AC §8.5 + OQ-10):
- [ ] Full variant renders all 5 fields
- [ ] Short variant renders only 3 fields
- [ ] Snapshot tests pin both variants
- [ ] No watermarks anywhere (spec §5.4)

**Effort**: S
**Dependencies**: Task 5.1
**Assignee**: developer

### Task 5.4: Build PageNumber + A4Page primitives

**Description**: `lib/pdf/PageNumber.tsx` — Page X of Y on every page. `lib/pdf/A4Page.tsx` — A4 page wrapper that composes Letterhead (page 1 only), MethodologyFooter (full on page 1, short on pages 2+), PageNumber.

**Acceptance Criteria** (AC §8.5):
- [ ] PageNumber renders correctly across multi-page renders
- [ ] A4Page wrapper handles first-page vs subsequent-page slot composition
- [ ] Snapshot test on a 3-page sample report

**Effort**: M
**Dependencies**: Tasks 5.2, 5.3
**Assignee**: developer

### Task 5.5: Build POST /api/reports/:family endpoint — posture-split

**Description**: `app/api/reports/[family]/route.ts` — POST handler receives `{ context, payload }`, validates `family` against the four known templates, **branches on posture BEFORE any auth check**, dispatches to the appropriate template, returns streamed `application/pdf`. Posture split per impl-plan §1.3:

| Family | Posture | Notes |
|---|---|---|
| `single-employee` | **Unauthenticated** | OQ-6 — public-calc CTA, served to anonymous users |
| `bulk-summary` | **Unauthenticated** | OQ-6 — same public CTA |
| `liability` | **Authenticated** (Supabase session) | E5.1 session middleware enforced |
| `reconciliation` | **Authenticated** (Supabase session) | E5.1 session middleware enforced |

Public families never read a session cookie. Authenticated families gate on the Supabase session middleware once E5.1 is available; until then, they 401 (and Phase 5b tasks pick them up). For Phase 4 only the foundation exists — templates wire in at Phase 5a (public) and Phase 5b (authed).

**Source: Spec §5.3 + §5.4 + §5.7 · OQ-6 · Resolves G-1 (HIGH)**

**Acceptance Criteria** (impl-plan §1.3 + Spec §5.3 + OQ-6):
- [ ] POST `/api/reports/single-employee` returns 200 with `application/pdf` for valid input — **without an auth header** (guard test required, see Task 5.5-bis)
- [ ] POST `/api/reports/bulk-summary` returns 200 with `application/pdf` for valid input — **without an auth header**
- [ ] POST `/api/reports/liability` returns 401 without a valid Supabase session
- [ ] POST `/api/reports/reconciliation` returns 401 without a valid Supabase session
- [ ] Returns 400 for unknown / invalid family
- [ ] Returns 500 with `requestId` on render failure
- [ ] No PII / tenant data leaves the Vercel function for any family (no external service)
- [ ] Phase 5a (public-calc PDF) is verifiable independently of E5.1's merge to `main`

**Effort**: L (re-sized from M per grill — API endpoint + posture split + 4-family dispatch + audit-log integration crosses M ceiling)
**Dependencies**: Task 5.4
**Assignee**: developer

### Task 5.5-bis: Public-vs-authenticated endpoint posture contract test

**Description**: Add a Playwright (or Jest with mocked fetch) guard test that asserts the posture split from Task 5.5 holds, so it cannot silently regress. Specifically: a request to `/api/reports/single-employee` with NO `Cookie` / `Authorization` header MUST return 200; a request to `/api/reports/liability` with no auth MUST return 401. This locks OQ-6 (public PDF is unauthenticated) and prevents a future refactor from coupling the endpoint to E5.1 session middleware globally.

**Source: Spec §5.3 + §5.4 · OQ-6 · Resolves G-1 (HIGH) — the contract test that prevents regression**

**Acceptance Criteria** (Spec §5.3 + OQ-6):
- [ ] Test file `website/e2e/api-reports-posture.spec.ts` (or `website/tests/api/reports-posture.test.ts`) committed
- [ ] Test asserts: `POST /api/reports/single-employee` with no auth header → 200 + `Content-Type: application/pdf`
- [ ] Test asserts: `POST /api/reports/bulk-summary` with no auth header → 200 + `Content-Type: application/pdf`
- [ ] Test asserts: `POST /api/reports/liability` with no auth header → 401
- [ ] Test asserts: `POST /api/reports/reconciliation` with no auth header → 401
- [ ] Test runs in CI on every E6 PR; failure is a hard block
- [ ] Test file lives OUTSIDE `tests/` (the existing 2214 + 92 corpus is off-limits per spec §5.3) — lives in `website/e2e/` or `website/__tests__/`

**Effort**: S
**Dependencies**: Task 5.5
**Assignee**: developer

### Task 5.6: Print stylesheet for browser-print parity [P]

**Description**: Add `@media print` rules to the public-calc result + bulk-summary screens so they print cleanly from the browser (same letterhead + methodology + page numbering, A4 page break logic). Mirrors PDF output structurally.

**Acceptance Criteria** (AC §8.5):
- [ ] Browser print preview of `/` result screen shows letterhead + methodology + page numbering
- [ ] Browser print preview of bulk-summary screen shows the same
- [ ] No screen-only chrome leaks into print

**Effort**: M
**Dependencies**: Task 5.4
**Assignee**: developer

### Task 5.7: Phase 4 acceptance gate

**Description**: Run full test suite + smoke-test PDF output across the 5-page test sample. Includes the Task 5.5-bis posture contract test as a hard gate.

**Acceptance Criteria** (AC §8.5):
- [ ] 2214/2214 LSL suite green
- [ ] 92 Playwright tests green
- [ ] Task 5.5-bis posture contract test green (public PDF unauthenticated; authed families gated)
- [ ] A4 single-page test report renders cleanly
- [ ] Multi-page test report renders Page X of Y correctly
- [ ] Print stylesheet matches PDF output structurally
- [ ] No watermarks anywhere

**Effort**: S
**Dependencies**: Tasks 5.1–5.6, 5.5-bis
**Assignee**: developer

---

## Phase 5a — E6.6 single-employee + bulk-summary templates

### Task 6.1: SingleEmployee template

**Description**: `lib/pdf/templates/SingleEmployee.tsx` — wraps existing public-calc Cat A/B/C result + citation block inside an A4Page. Citation block content **must be byte-for-byte unchanged** vs the web rendering (snapshot test).

**Acceptance Criteria** (AC §8.6):
- [ ] Template renders single-employee result with Cat A/B/C semantics intact
- [ ] Citation block byte-for-byte matches web snapshot
- [ ] Letterhead + methodology footer + page numbering inherited from Phase 4 primitives
- [ ] No separate exec summary (OQ-5)

**Effort**: M
**Dependencies**: Phase 4 complete
**Assignee**: developer

### Task 6.2: BulkSummary template [P]

**Description**: `lib/pdf/templates/BulkSummary.tsx` — wraps existing multi-employee summary table inside an A4Page. Handles multi-page pagination cleanly (table rows break across pages with repeated table headers).

**Acceptance Criteria** (AC §8.6):
- [ ] Template renders bulk-summary table
- [ ] Multi-page table breaks across pages with repeated headers
- [ ] Letterhead + methodology footer + page numbering inherited
- [ ] No separate exec summary (OQ-5)

**Effort**: M
**Dependencies**: Phase 4 complete
**Assignee**: developer

### Task 6.3: Wire templates to API endpoint + public-calc PDF CTA

**Description**: Register SingleEmployee + BulkSummary in the family dispatch table of `/api/reports/[family]/route.ts`. Wire the PDF download CTAs from Task 4.6 — clicking the CTA now triggers a real download.

**Acceptance Criteria** (AC §8.4 + §8.6):
- [ ] Single-employee CTA download produces a valid PDF
- [ ] Bulk-summary CTA download produces a valid PDF
- [ ] Both PDFs render cleanly across the standard 4-browser print preview (Chrome, Firefox, Safari, Edge)

**Effort**: S
**Dependencies**: Tasks 6.1, 6.2, 4.6, 5.5
**Assignee**: developer

### Task 6.4: Phase 5a acceptance gate

**Description**: Final gate before Phase 5b waits on E5.5 / E5.6.

**Acceptance Criteria** (AC §8.6):
- [ ] 2214/2214 LSL suite green
- [ ] 92 Playwright tests green
- [ ] Two report families download as PDFs from `/` end-to-end
- [ ] Both templates also print cleanly from browser print preview

**Effort**: S
**Dependencies**: Tasks 6.1–6.3
**Assignee**: developer

---

## Phase 5b — E6.6 liability + reconciliation templates (TRAILING)

**These tasks are TRACKED in this plan but cannot be completed in this development cycle.** They land as E5.5 / E5.6 deliver. Skeletal scaffolds + design decisions are documented here so the future cycles drop into a prepared slot.

### Task 6.5: Liability template — exec summary + body (lands with E5.5)

**Description**: `lib/pdf/templates/Liability.tsx`. One-page exec summary at top: **3-column at-a-glance** (employees / total accrued weeks / total accrued $) per OQ-11. Full per-employee detail follows.

**Acceptance Criteria** (AC §8.6 + OQ-11):
- [ ] Exec summary renders 3-column at-a-glance with three headline numbers
- [ ] Full per-employee detail follows on subsequent pages
- [ ] Letterhead + methodology footer + page numbering inherited
- [ ] Wires into `/app/liability` once E5.5 ships

**Effort**: M
**Dependencies**: Phase 4 complete + E5.5 liability feature shipped
**Assignee**: developer (future cycle)

### Task 6.6: Reconciliation template — exec summary + body (lands with E5.6)

**Description**: `lib/pdf/templates/Reconciliation.tsx`. One-page exec summary at top: **single headline number** (total variance $) per OQ-11. Per-row variance verdict table follows.

**Acceptance Criteria** (AC §8.6 + OQ-11):
- [ ] Exec summary renders single headline variance number
- [ ] Per-row variance verdict table follows
- [ ] Letterhead + methodology footer + page numbering inherited
- [ ] Custom icon set has replaced Lucide by the time this task ships (OQ-2 hard deadline)
- [ ] Wires into `/app/reconciliation` once E5.6 ships

**Effort**: M
**Dependencies**: Phase 4 complete + E5.6 reconciliation feature shipped + custom icon set shipped (OQ-2 deadline)
**Assignee**: developer (future cycle)

---

## Task count summary

Post-grill amendment: 4 new tasks added (Task 2.10, Task 2.11, Task 3.3-bis, Task 5.5-bis), 3 tasks re-sized (Task 1.2 M→L, Task 3.7 M→L, Task 5.5 M→L).

| Sub-epic | Phase | Tasks | Critical-path? |
|---|---|---|---|
| E6.1 | 1 | 5 | YES (Tasks 1.1–1.5; Task 1.3 is the gate) |
| E6.2 | 2 | 11 | YES (Tasks 2.1–2.11 all blocking E5.2) — +Task 2.10 CSP audit, +Task 2.11 test-diff guard |
| E6.3 | 3a | 11 | No — +Task 3.3-bis SessionCookieClaims contract |
| E6.4 | 3b | 8 | No |
| E6.5 | 4 | 8 | No — +Task 5.5-bis posture contract test |
| E6.6 (s/e + bulk) | 5a | 4 | No |
| E6.6 (liab + recon) | 5b | 2 | No (trail E5.5 / E5.6) |
| **Total** | | **49** | **16 on E5.2 critical path** |

---

## Critical path to E5.2 unblock

```
Phase 1 (E6.1)
  └─ Task 1.1 (S) ──→ Task 1.2 (L) ──→ Task 1.3 (S) ──→ Task 1.4 (S) ──→ Task 1.5 (S)
                                            │
                                            └── HARD GATE ──┐
                                                            ▼
Phase 2 (E6.2)
  └─ Task 2.1 (S) ──┬─ Task 2.2 (S) [P] ──┐
                    ├─ Task 2.3 (M) [P] ──┼──→ Task 2.4 (S) ──→ Task 2.5 (S) ──→ Task 2.6 (L) ──→ Task 2.8 (S) ──┐
                    └─ Task 2.7 (S) [P] ──┘                                                                     │
                                                                                                                ▼
                                                                                          Task 2.10 (S) + Task 2.11 (S) ──→ Task 2.9 (S)
                                                                                                                                │
                                                                                                                                └── E5.2 IMPLEMENTATION UNBLOCKED
```

**Total E5.2-blocking effort:** 5 design-side tasks (Phase 1: 1×S + 1×L + 3×S — see G-4 resize) + 11 engineering tasks (Phase 2: 6×S + 1×M + 1×L = ~L total) = approximately **3 days (happy path) to 14 days (fallback) of design + 1.5–2 weeks of engineering** to unblock E5.2. Wordmark approval cycles (Task 1.2 ↔ Task 1.3 round-tripping) typically run 5–10 business days with a non-technical operator.

If Phase 1 blocks > 14 days, spec §3 fallback activates: Phase 2 proceeds with APA primary wordmark placeholder, removing the wordmark approval gate from the critical path.

---

*End of tasks.md. Each task is independent enough that an LLM or developer can execute it without re-reading the spec; each task cites the spec AC it satisfies; dependency order is enforced via the `Dependencies:` field.*
