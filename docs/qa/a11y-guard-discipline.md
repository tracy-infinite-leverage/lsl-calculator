# A11y guard discipline — two-tier WCAG enforcement

**Owner:** developer agent
**Created:** 2026-05-28 (E6.2 Task 2.10)
**Spec reference:** `.specify/features/006-ui-design-system/spec.md` §5.5 (WCAG 2.2 AA) + tasks.md §2.10
**Resolves:** the PR #63 / #64 bug class — Storybook a11y pass + real-page a11y fail

---

## TL;DR

Every E6 component PR must pass **two** axe-core gates before merge:

1. **Storybook a11y** — per-component, isolated. Runs `scripts/a11y-storybook-once.mjs` against the built Storybook. Fast feedback during component development.
2. **Real-page a11y** — full Next.js pages with all components in context. Runs `e2e/a11y.spec.ts` in CI Playwright job. The production safety net.

Both run today. Both are non-bypassable. If only one is green, the component is not done.

---

## Why two tiers

Storybook a11y is a brilliant tool with a real limitation: stories render components in isolation, often without the props that surface a violation. The PR #63 / #64 bug class proved this:

- **PR #63 — Input variant override:** `placeholder:text-brand-grey` shipped. `brand-grey` is `#808897` against a white background. Contrast ratio: **3.56:1** — fails WCAG 1.4.3 AA (≥ 4.5:1 required for normal text).
- **Storybook a11y verdict:** PASS. Most Input stories rendered with a populated `defaultValue`, so the placeholder text was never visible to axe. The stories that did show a placeholder used a longer label that axe deprioritised, and the violation came back as `serious` rather than `critical` — silently filtered by the script's `serious || critical` gate? No — axe simply did not flag the rendered placeholder against the story's white background. Bug went green.
- **Real-page a11y verdict:** FAIL. `/calculator/single` rendered the same Input with an empty placeholder showing, and `axe` flagged it correctly on first scan.
- **Fix:** `placeholder:text-brand-charcoal/70` (effective `#707070` at 70% alpha against white ≈ 4.95:1). Same bug class hit Textarea and SelectTrigger — all three fixed in `3818b40` (post-CI amendment on the Task 2.6.c+d+e PR #64).

The lesson: **isolation hides context-dependent violations.** A button rendered alone has different visual surroundings than the same button inside the calc form. A placeholder rendered with a 14-char label has different axe semantics than the same placeholder on a 4-char label. The real-page gate is the only one that catches "the page as the user sees it".

---

## What each tier catches

| Tier | Catches | Misses |
|---|---|---|
| **Storybook a11y** | Component-intrinsic issues: missing `aria-*`, wrong role, ID collisions, focus-order regressions inside the component, button-name violations | Anything context-dependent: contrast against a parent background, placeholder visibility, label association across component boundaries, focus-order regressions across components |
| **Real-page a11y** | Everything above + every context-dependent class | One thing: pre-launch components that aren't yet wired into any page (Storybook catches those) |

They are **complementary**, not redundant. Both must pass.

---

## Discipline for downstream PRs

Every component PR (Task 2.6.* through 2.8) must:

1. **Add Storybook story coverage** that exercises the empty / placeholder / default state of every variant. Don't render only the happy path.
2. **Add the component to at least one real-page render** before the PR closes — even if that's just a `/calculator/single` form field swap. A component nobody uses has zero coverage from the real-page gate.
3. **Run both gates locally before requesting QA:**
   ```bash
   cd website
   npm run build-storybook
   node scripts/a11y-storybook-once.mjs    # Storybook gate
   npx playwright test e2e/a11y.spec.ts    # Real-page gate
   ```
4. **Spot-check contrast math** in the HANDOFF. The component HANDOFF.md should include a contrast table for every text/background pair the component renders. axe catches the violation; the spot-check catches the *near-miss* that's only 4.6:1 and one design tweak away from regressing. Pattern set by the Task 2.6.cde HANDOFF (`Placeholder contrast fix (WCAG 1.4.3 AA)` section).

---

## Coverage today

Real-page a11y scans these routes (every entry is the production HTML, axe scans the live DOM):

| Route | Why it's in the gate |
|---|---|
| `/` | Public landing — launch surface |
| `/calculator/single` | Single-mode calc — exercises every form primitive (Input, Select, Textarea, Checkbox, RadioGroup, Tabs) |
| `/calculator/bulk` | Bulk-mode calc — exercises file upload, sample-CSV preview, data table |
| `/calculator/bulk` (preview state) | Same route after `Load sample CSV` click — exercises the post-action DOM, which Storybook can never reach |
| `/privacy` | Privacy notice — long-form prose, link contrast, heading order |
| `/app/signup` | Public auth — added Task 2.10 |
| `/app/login` | Public auth — added Task 2.10 |

Routes deliberately NOT in the gate today:

- Anything inside `/app/*` requiring a session (`/app/account`, `/app/verify-email`, `/app/logout`) — would need a sign-in fixture; tracked under E5.x.
- API routes (`/api/export-pdf`) — no rendered HTML.

When the E6.3 `/app` workspace shell lands (Phase 3a), add the workspace shell pages here behind a session fixture.

---

## Why not "just trust Storybook"?

Three concrete reasons, each one a near-miss in the last 24h:

1. **PR #63 placeholder contrast** — passed Storybook, failed real page (described above).
2. **PR #62 wordmark `@import` leak** — Storybook didn't render the SVG with the external font import path that the bundled prod SVG hit; only the production build caught it (which is why Task 2.10 has the `audit-bundle.mjs` SVG `@import url(` scan as a sibling defence).
3. **Theoretical, but cheap to guard against** — a future component with a 4.5:1 contrast against a *light card background* but 3.2:1 against a *dark hero band* would pass Storybook (white default canvas) and fail on the homepage. The real-page gate is the only place this gets caught before customers see it.

---

## Failure mode triage

When a Storybook gate fails but real-page passes: fix the story (usually a missing prop). The component is probably fine.

When a real-page gate fails but Storybook passes: **this is the bug class above**. Fix the component, not the test. Add a Storybook story that reproduces the violation so the Storybook gate would catch the same class next time.

When both fail: usually a token regression. Check `src/styles/design-tokens.ts` (Task 2.4) and `tailwind.config.ts` (Task 2.3) for an accidental value change.

When both pass but a user reports an a11y issue: the test gates don't cover everything. Add the failing case to `e2e/a11y.spec.ts` before fixing.

---

## Links

- Spec: `.specify/features/006-ui-design-system/spec.md` §5.5
- Tasks: `.specify/features/006-ui-design-system/tasks.md` §2.10
- Bundle audit (sibling Task 2.10 artefact): `website/scripts/audit-bundle.mjs`
- The PR #64 amendment that motivated this doc: `docs/engineering/changes/2026-05-28-E6.2-task-2.6.cde-form-primitives/HANDOFF.md` §`Placeholder contrast fix (WCAG 1.4.3 AA) — POST-CI AMENDMENT`
