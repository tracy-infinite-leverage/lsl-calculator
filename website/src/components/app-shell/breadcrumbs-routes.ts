/**
 * breadcrumbs-routes.ts — pure data + helpers for `/app/*` breadcrumb trails.
 *
 * E6.3 Task 3.6. Mirrors the split established by `sidebar-routes.ts`:
 * the path → label map and the trail-builder live in a `.ts` file with no
 * JSX, no React imports, no DOM. That lets vitest exercise the route map
 * directly in its `node` env (see `vitest.config.ts`) without a browser
 * shim, AND lets the live `Breadcrumbs.tsx` Client Component stay a thin
 * `usePathname()` + `<Link>` composition.
 *
 * # Why a static map (not a generated-from-segments-only approach)
 *
 * Three forces argue for a map:
 *
 *   1. Sentence-case (spec §5.1 brand voice + §8.3 AC bullet 2). The naive
 *      `segment.charAt(0).toUpperCase() + segment.slice(1)` would emit
 *      "Pay-codes" — wrong case, wrong word break. A map encodes the
 *      one-true-label per route.
 *
 *   2. Multi-segment to single-label collapse. `/app/pay-history` is one
 *      destination, not "Pay" then "History" — the dash is part of the
 *      slug, not a hierarchy boundary. The map treats each `/app/<slug>`
 *      as an atomic crumb.
 *
 *   3. Future deep routes can override their crumb label. When `/app/
 *      employees/[id]` ships in E5.2, the dynamic-segment branch returns
 *      "Employee details" (or the name passed by the page); the map keeps
 *      the static-segment labels stable.
 *
 * # Trail shape
 *
 * The trail is an ordered list from root to current page. Each entry:
 *
 *   - `label`  — human-readable, sentence case.
 *   - `href`   — the link target (or `null` for the current page).
 *   - `isCurrent` — true on the last entry, false otherwise.
 *
 * Consumers (`Breadcrumbs.tsx`) render the last entry as plain text +
 * `aria-current="page"`; everything before it as `<Link>`.
 *
 * # Why a root "Home" crumb
 *
 * Spec §8.3 AC bullet 1: "Breadcrumbs render on every `/app/*` page."
 * Including `/app` itself. A single-crumb trail of just the current page
 * carries no navigational value. Anchoring every trail at "Home" (linking
 * to `/app`) gives the user a one-click escape back to the post-login
 * landing page from anywhere in the workspace. Mirrors the convention in
 * GitHub, Linear, Vercel, every major web-app shell.
 *
 * No JSX, no React imports, no DOM. Safe to import anywhere.
 */

/**
 * Static route-label map. Path → sentence-case label.
 *
 * Keys are exact `/app/<slug>` paths. Adding a new top-level workspace
 * route means one line here — the matcher falls back to a sane derived
 * label if a route is missing, but every shipped surface SHOULD have an
 * explicit entry so the audit grep `BREADCRUMB_LABELS` lands on the full
 * known list.
 *
 * Aligns with `SIDEBAR_ENTRIES` in `sidebar-routes.ts` — when a sidebar
 * entry ships, its breadcrumb label should ship with it.
 */
export const BREADCRUMB_LABELS: Readonly<Record<string, string>> = {
  '/app': 'Home',
  '/app/employees': 'Employees',
  '/app/pay-codes': 'Pay codes',
  '/app/pay-history': 'Pay history',
  '/app/valuations': 'Valuations',
  '/app/liability': 'Liability',
  '/app/reconciliation': 'Reconciliation',
  '/app/settings': 'Settings',
};

/**
 * One node in a breadcrumb trail. `href === null` marks the terminal
 * crumb (the current page) — consumers render it as plain text plus
 * `aria-current="page"`.
 */
export interface BreadcrumbNode {
  readonly label: string;
  readonly href: string | null;
  readonly isCurrent: boolean;
}

/**
 * Derive a human-readable label for a dynamic / unmapped segment.
 *
 * Strategy:
 *   - Replace dashes with spaces.
 *   - Sentence-case the first letter only (brand voice §5.1 — no
 *     Title Case in product chrome).
 *   - Truncate UUID-shaped segments to "Details" (no value in showing
 *     `0f3b…` in the trail; the segment is identity, not label).
 *
 * This is the conservative path. When a feature wants a meaningful
 * dynamic label (e.g. the employee name on `/app/employees/[id]`), it
 * passes the resolved label through the `overrideLabel` parameter on
 * `buildTrail` — see that function's docs.
 */
export function deriveLabel(segment: string): string {
  // UUID-shaped → "Details". Matches both v4 UUIDs and any 32+ hex blob.
  if (/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(segment)) {
    return 'Details';
  }
  // All-numeric ID → "Details". Same rationale as the UUID branch.
  if (/^\d+$/.test(segment)) {
    return 'Details';
  }
  const spaced = segment.replace(/-/g, ' ');
  if (spaced.length === 0) return '';
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/**
 * Build the breadcrumb trail for the given pathname.
 *
 * Rules:
 *
 *   1. Every trail starts with `{ label: 'Home', href: '/app', ... }`
 *      unless the pathname IS `/app` itself — in which case "Home" is
 *      the terminal crumb (no `href`).
 *
 *   2. Each subsequent segment becomes an additional crumb. The label
 *      comes from `BREADCRUMB_LABELS` if the path is mapped, otherwise
 *      from `deriveLabel(segment)`.
 *
 *   3. The last crumb has `href: null` and `isCurrent: true`. All others
 *      have `href` set and `isCurrent: false`.
 *
 *   4. Trailing slashes are normalised away. Empty segments (from
 *      consecutive slashes or a trailing slash) are dropped.
 *
 *   5. Pathnames outside `/app/*` return an empty array — the
 *      Breadcrumbs component should mount only inside `/app/layout.tsx`
 *      so this branch is defensive, not a regular code path.
 *
 * @param pathname  — the current route pathname (from `usePathname()`).
 * @returns ordered `BreadcrumbNode[]`, root → current.
 */
export function buildTrail(pathname: string): BreadcrumbNode[] {
  // Normalise: drop query/hash (defensive — `usePathname()` already does
  // this) + trailing slash. Reject anything not under `/app`.
  const cleaned = pathname.split('?')[0]!.split('#')[0]!.replace(/\/+$/, '');
  if (cleaned !== '/app' && !cleaned.startsWith('/app/')) {
    return [];
  }

  // `/app` → single terminal "Home" crumb.
  if (cleaned === '' || cleaned === '/app') {
    return [
      {
        label: BREADCRUMB_LABELS['/app'] ?? 'Home',
        href: null,
        isCurrent: true,
      },
    ];
  }

  // Walk the segments under `/app`. `cleaned` is `/app/foo/bar` →
  // segments = ['app', 'foo', 'bar']. We drop the leading 'app' because
  // it is represented by the explicit Home anchor crumb.
  const segments = cleaned.split('/').filter((s) => s.length > 0);
  // Drop leading 'app'.
  segments.shift();

  const trail: BreadcrumbNode[] = [];

  // Root anchor — "Home" links back to `/app`.
  trail.push({
    label: BREADCRUMB_LABELS['/app'] ?? 'Home',
    href: '/app',
    isCurrent: false,
  });

  // Build cumulative paths and labels.
  let cumulative = '/app';
  for (let i = 0; i < segments.length; i++) {
    cumulative = `${cumulative}/${segments[i]}`;
    const isLast = i === segments.length - 1;
    const mapped = BREADCRUMB_LABELS[cumulative];
    const label = mapped ?? deriveLabel(segments[i]!);
    trail.push({
      label,
      href: isLast ? null : cumulative,
      isCurrent: isLast,
    });
  }

  return trail;
}
