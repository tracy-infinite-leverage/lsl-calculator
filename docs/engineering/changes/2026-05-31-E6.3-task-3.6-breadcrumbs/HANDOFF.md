# HANDOFF — E6.3 Task 3.6 Breadcrumbs

**Date:** 2026-05-31
**Branch:** `feat/E6.3-3.6-breadcrumbs`
**Spec:** `.specify/features/006-ui-design-system/spec.md` v0.5 §5.2 + §8.3
**Tasks:** `.specify/features/006-ui-design-system/tasks.md` Task 3.6 (lines 407–418)

## What shipped

A `/app/*` breadcrumb trail component, mounted in the workspace shell layout so it renders on every page below TopNav + ActingAsBanner.

### Files

- `website/src/components/app-shell/breadcrumbs-routes.ts` — pure data + helpers (route → label map, trail builder, dynamic-segment label derivation). No JSX, no React, vitest-friendly.
- `website/src/components/app-shell/breadcrumbs-routes.test.ts` — 14 unit tests covering the route map, `deriveLabel`, and `buildTrail`. Includes regression guards for the "current crumb has no href, all others do" contract (load-bearing for AC §8.3 bullet 3).
- `website/src/components/app-shell/Breadcrumbs.tsx` — Client Component. Splits into `BreadcrumbsPresentation` (pure props, for Storybook + tests) and `Breadcrumbs` (live, reads `usePathname()`). Mirrors the pattern from TopNav / TenantSwitcher / ActingAsBanner / ConfirmDestructiveDialog.
- `website/src/components/app-shell/Breadcrumbs.stories.tsx` — 5 stories (Home, Employees, PayCodes, DeepLinkWithDynamicSegment, LongTrailWrapping). `a11y: { test: 'error' }`.
- `website/src/app/app/layout.tsx` — Breadcrumbs mounted inside a new right-column wrapper to the right of the Sidebar, above `<main>`. Scrolls with the page content (not sticky like ActingAsBanner) since breadcrumbs are page-scoped, not global tenant context.

## Mount point

Inside `app/app/layout.tsx`, between the Sidebar and `<main>`. The change:

```tsx
<div className="flex flex-1">
  <Sidebar />
  <div className="flex flex-1 flex-col overflow-y-auto">
    <Breadcrumbs />
    <main className="flex-1 ..." data-testid="app-main">
      {children}
    </main>
  </div>
</div>
```

Why inside a new right-column wrapper (not a sibling above the flex row):

- Breadcrumbs are page-scoped — they describe the current page, not the global tenant context. Placing them to the right of the Sidebar keeps the left rail visually clean and makes the breadcrumbs feel like a header strip for the content column.
- `overflow-y-auto` moved from `<main>` up to the wrapper so the whole content column (including the breadcrumbs strip at top) scrolls together.

## Route label map shape

```ts
{
  '/app':                'Home',
  '/app/employees':      'Employees',
  '/app/pay-codes':      'Pay codes',
  '/app/pay-history':    'Pay history',
  '/app/valuations':     'Valuations',
  '/app/liability':      'Liability',
  '/app/reconciliation': 'Reconciliation',
  '/app/settings':       'Settings',
}
```

Sentence case throughout (brand voice §5.1). Future deep routes (e.g. `/app/employees/[id]`) fall through to `deriveLabel(segment)` which:

- Returns "Details" for UUID-shaped and all-numeric segments (avoids leaking identity into the trail).
- Replaces dashes with spaces and sentence-cases everything else.

When E5.2 ships `/app/employees/[id]`, that page can either add a new entry to `BREADCRUMB_LABELS` or thread a resolved employee name into a future `overrideLabel` mechanism — both paths are documented in the file header.

## Accessibility notes

Follows the W3C ARIA APG breadcrumb pattern verbatim:

1. `<nav aria-label="Breadcrumb">` wraps the whole structure.
2. `<ol>` carries ordered-list semantics.
3. Non-terminal crumbs are real `<Link>` elements — keyboard-navigable, in tab order, `focus-visible:ring-brand-navy` matches the rest of the shell chrome.
4. The terminal crumb is a `<span>` with `aria-current="page"` — NOT a link by design (the ARIA pattern: the current page is not navigable from itself; spec §8.3 AC bullet 3 reads "each crumb is a real anchor" which by convention means each *non-current* crumb).
5. `ChevronRight` separators are `aria-hidden="true"` — decorative, the ordered list carries the semantic relationship.

axe-core / Storybook a11y addon both expected to pass on every story (a11y: `'error'` threshold).

## Acceptance criteria mapping

| AC | Status | Where |
|---|---|---|
| Breadcrumbs render on every `/app/*` page | Mounted in `app/app/layout.tsx`; `AUTH_SHELL_BYPASS` routes (login/signup/etc.) correctly skip the shell so they don't render breadcrumbs (matches the spec — those are auth surfaces) | `app/app/layout.tsx` |
| Route labels are human-friendly (sentence case) | `BREADCRUMB_LABELS` map; `deriveLabel` for dynamic segments | `breadcrumbs-routes.ts` |
| Keyboard-navigable (each non-current crumb is a real anchor) | `<Link>` for every `href !== null` crumb; structural unit test enforces the "non-terminal nodes carry href" contract | `Breadcrumbs.tsx` + `breadcrumbs-routes.test.ts` |

## Local gates

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | PASS (no errors) |
| `npm run test` | PASS — 2864 passed / 32 skipped (auth tests skip without `SUPABASE_SERVICE_ROLE_KEY`). Breadcrumbs-routes contributes 14 new tests. |
| `npm run build` | PASS — 1839ms compile, all 10 static pages generated, all `/app/*` routes ƒ-marked (dynamic) as expected |
| `audit-bundle` (postbuild) | PASS — 1800.8 KB, no third-party origins, no dev-only imports |
| `eslint` on touched files | PASS (clean) |
| `playwright test --project=chromium` | PASS — 24 passed, 1 skipped (auth golden path requires service role key) |

## What's NOT in scope

Per dispatch: do NOT continue to Task 3.9 / 3.10. Task 3.6 only.

- No new sidebar entries — `sidebar-routes.ts` untouched.
- No changes to TopNav, Sidebar, ActingAsBanner, TenantSwitcher, ConfirmDestructiveDialog, or the auth surfaces.
- No data-layer touches.
- No E5.2 work.

## QA hooks

`data-testid` surface:

- `app-breadcrumbs` — root `<nav>`
- `app-breadcrumbs-link-{index}` — each non-terminal `<Link>`
- `app-breadcrumbs-current` — the terminal `<span>` with `aria-current="page"`

QA agent can drive against these directly without re-reading the implementation.

## Decisions recorded

- **Static label map vs. derived-from-segments only.** Static map. Three forces (file header lines 25–46 of `breadcrumbs-routes.ts`): sentence-case requires per-route encoding; multi-word slugs like `pay-history` are atomic crumbs not segment boundaries; future deep routes can override their crumb label cleanly.
- **Root "Home" crumb on every trail.** The spec mandates breadcrumbs on every `/app/*` page including `/app` itself. A single-crumb trail of just the current page carries no nav value. Anchoring every trail at "Home" gives a one-click escape to the post-login landing page — convention from GitHub / Linear / Vercel.
- **Client Component (not server-rendered prop bag from layout).** Mirrors the Sidebar's `usePathname()` trade-off. ~250 bytes after tree-shake per route; saves the layout from threading a `pathname` prop and saves every page from a fresh `headers()` read.
- **Scroll with page (not sticky).** Breadcrumbs are page metadata, not global tenant context. Differs from ActingAsBanner which is sticky for R-5 (mis-tenant safety) reasons.
- **`<nav>` + `<ol>` + `aria-current="page"`.** W3C ARIA APG pattern verbatim. axe-core "breadcrumb-without-aria-label" rule passes by construction.

## Next steps for orchestrator

1. Open PR with `--base main`.
2. Dispatch QA against the data-testid surface above.
3. Stop after PR opened + local CI clean — do not auto-merge (this is a structural shell change, not a trivial copy fix).
