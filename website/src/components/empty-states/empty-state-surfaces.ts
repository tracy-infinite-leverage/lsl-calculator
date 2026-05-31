/**
 * empty-state-surfaces.ts — pure data for the six `/app/<slug>` empty states.
 *
 * E6.3 Task 3.7 (spec §8.3 + Phase 2 design tokens).
 *
 * Six workspace surfaces — Employees, Pay Codes, Pay History, Valuations,
 * Liability, Reconciliation — each ships with an opinionated empty state:
 * an illustration slot (placeholder div for v1; designer agent supplies
 * illustrations in v1.1), a single-line headline, two-line subtext, and
 * exactly one primary call-to-action.
 *
 * Why split data from JSX:
 *
 *   1. Same rationale as `sidebar-routes.ts` — keep the spec-mandated
 *      copy + CTA shape in a pure-data module so a unit test in vitest's
 *      `node` env can assert the surface contract (six surfaces, exactly
 *      one CTA each, slug ↔ route alignment with the sidebar) without
 *      booting a DOM.
 *
 *   2. A future copy-review pass (operator, designer, marketing) edits
 *      one data file — never touches React markup. Brand-voice changes
 *      stay surgical.
 *
 *   3. The six route pages (`/app/employees/page.tsx` …) and the six
 *      Storybook stories both read from this single source. Renaming a
 *      CTA or fixing a typo is one diff, six call sites.
 *
 * Sync contract with the sidebar:
 *   Every slug here MUST match a `slug` in `SIDEBAR_ENTRIES`. The
 *   companion test (`empty-state-surfaces.test.ts`) asserts the
 *   intersection. The Settings surface deliberately has NO empty state
 *   — Settings is a navigation anchor, not a data surface (spec §8.3).
 *
 * Copy guidelines (spec §5.1 brand voice + AC bullet 4):
 *   - Headlines: sentence case, one line, no period.
 *   - Subtext: two lines max, end with a period.
 *   - CTA labels: imperative, sentence case, no terminal punctuation.
 *     Verb-first ("Add", "Create", "Import", "Run") — never "Click here".
 *
 * No JSX, no React. Safe to import from anywhere — server components,
 * client components, tests, future server actions.
 */

/**
 * The slug union — same six surfaces as the sidebar minus Settings.
 * Drives the keyed map below and the route-folder names under
 * `/app/<slug>/`.
 */
export type EmptyStateSlug =
  | 'employees'
  | 'pay-codes'
  | 'pay-history'
  | 'valuations'
  | 'liability'
  | 'reconciliation';

/**
 * Shape of a single empty-state surface. Kept as a literal record (not
 * an enum or class) so adding a future surface is a one-entry diff.
 *
 * `ctaHref` is a plain pathname — no query params. Future surfaces that
 * need parameterised CTAs can add an `ctaQuery` field; the surface
 * contract intentionally starts minimal.
 *
 * `headline` and `subtext` are the user-visible copy. Splitting them
 * lets the layout style each line independently (headline larger /
 * heavier, subtext quieter) without HTML fragments inside the data.
 */
export interface EmptyStateSurface {
  readonly slug: EmptyStateSlug;
  /** Sentence-case, no terminal period. Renders as `<h2>`. */
  readonly headline: string;
  /** Two lines max, ends with a period. Renders as `<p>`. */
  readonly subtext: string;
  /** Imperative verb-first label. Renders as the primary `<Button>` label. */
  readonly ctaLabel: string;
  /** Target route for the primary CTA. */
  readonly ctaHref: string;
}

/**
 * The six surfaces in display order — matches the sidebar order (minus
 * Settings) per spec §8.3. Order is the source of truth for tests and
 * Storybook story enumeration.
 *
 * Copy decisions (recorded inline so a future operator review can audit
 * them without spelunking through git history):
 *
 *   Employees      — "Add your first employee"
 *     Direct, friendly, names the next action concretely. "first" lowers
 *     the activation barrier — every customer starts here.
 *
 *   Pay Codes      — "Create a pay code"
 *     Active verb + concrete noun. "Create" not "Add" because pay codes
 *     are configuration objects with a definition step, not items in a
 *     list. Maps to operator's mental model of payroll setup.
 *
 *   Pay History    — "Import a pay file"
 *     Pay history is populated by importing pay-run exports, not by
 *     hand-entry. The CTA mirrors the actual workflow. The CSV/file
 *     dialog is the v1 destination; "Import" leaves the door open for
 *     other ingestion paths (Xero, MYOB) without changing the copy.
 *
 *   Valuations     — "Run your first valuation"
 *     Valuations are a verb-noun: you "run" a valuation against a date.
 *     "first" again — primes the user that this is the start of a series.
 *
 *   Liability      — "Run a valuation to see liability"
 *     Liability is a derived view, not a primary data entry. The CTA
 *     correctly points to its upstream dependency (valuations). This is
 *     intentional pedagogy — the empty state TEACHES the data flow.
 *
 *   Reconciliation — "Import a pay file to start reconciling"
 *     Same shape as Liability: reconciliation is a derived comparison
 *     between calculated and paid amounts. Without a pay file there is
 *     nothing to reconcile against. CTA points to the prerequisite.
 *
 * Subtext rationale (one paragraph each):
 *   Each subtext explains WHY the surface exists in one sentence, then
 *   reinforces the CTA in a second sentence. Two lines max so the empty
 *   state stays scannable on a single screen height without scrolling.
 */
export const EMPTY_STATE_SURFACES: readonly EmptyStateSurface[] = [
  {
    slug: 'employees',
    headline: 'No employees yet',
    subtext:
      'Employees are the foundation of every valuation and liability report. Add one to get started.',
    ctaLabel: 'Add your first employee',
    ctaHref: '/app/employees/new',
  },
  {
    slug: 'pay-codes',
    headline: 'No pay codes configured',
    subtext:
      'Pay codes tell the calculator which of your payroll line items count toward long service leave. Create your first code to map your payroll.',
    ctaLabel: 'Create a pay code',
    ctaHref: '/app/pay-codes/new',
  },
  {
    slug: 'pay-history',
    headline: 'No pay history loaded',
    subtext:
      'Pay history powers liability calculations and reconciliation. Import a pay file to populate this view.',
    ctaLabel: 'Import a pay file',
    ctaHref: '/app/pay-history/import',
  },
  {
    slug: 'valuations',
    headline: 'No valuations yet',
    subtext:
      'A valuation captures every employee’s long service leave entitlement at a point in time. Run your first one to see the numbers.',
    ctaLabel: 'Run your first valuation',
    ctaHref: '/app/valuations/new',
  },
  {
    slug: 'liability',
    headline: 'No liability to report',
    subtext:
      'Liability is calculated from your most recent valuation. Run a valuation and the liability summary will appear here.',
    ctaLabel: 'Run a valuation to see liability',
    ctaHref: '/app/valuations/new',
  },
  {
    slug: 'reconciliation',
    headline: 'Nothing to reconcile yet',
    subtext:
      'Reconciliation compares your calculated entitlements against paid amounts. Import a pay file to start reconciling.',
    ctaLabel: 'Import a pay file to start reconciling',
    ctaHref: '/app/pay-history/import',
  },
];

/**
 * O(1) lookup by slug. Built once at module load; immutable.
 * Returns `undefined` for unknown slugs so callers can branch on missing.
 */
const SURFACE_BY_SLUG: ReadonlyMap<EmptyStateSlug, EmptyStateSurface> = new Map(
  EMPTY_STATE_SURFACES.map((s) => [s.slug, s]),
);

/**
 * Fetch the surface metadata for a known slug.
 *
 * Returns `undefined` for unknown slugs — callers SHOULD treat that as a
 * developer error (e.g. mistyped slug in a route page) and throw, since
 * the union type prevents this at compile time for TypeScript consumers.
 */
export function getEmptyStateSurface(
  slug: EmptyStateSlug,
): EmptyStateSurface | undefined {
  return SURFACE_BY_SLUG.get(slug);
}
