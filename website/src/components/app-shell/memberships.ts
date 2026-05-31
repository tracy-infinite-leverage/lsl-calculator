/**
 * memberships.ts — typed `Membership` shape + server-side data fetch for the
 * `/app/*` TenantSwitcher (E6.3 Task 3.4).
 *
 * # Why this lives here (and not in `lib/`)
 *
 * The single consumer today is `TenantSwitcher` in this folder. Co-locating
 * the type + fetch helper keeps the data-source decision discoverable for the
 * next contributor who edits the switcher. When E5.x adds a `memberships`
 * query that lands elsewhere (an org-management Server Action, say), the
 * helper can be lifted out — no consumer-API churn because the switcher
 * accepts `Membership[]` as a plain prop.
 *
 * # Data-source decision (Task 3.4 dispatch, 2026-05-31)
 *
 * The dispatch offered three options for plumbing tenant *names* through to
 * the switcher (the cookie payload only carries IDs):
 *
 *   1. Augment `SessionCookieClaims` with `memberships: Array<{id; name}>`.
 *   2. Have the switcher fetch memberships client-side via a Supabase query.
 *   3. Server-render the memberships list in `app/app/layout.tsx` and pass
 *      it down as a prop bag alongside the cookie-claims read.
 *
 * **Picked: Option 3 (server-rendered prop bag).** Two reasons:
 *
 *   a. The `org_members` migration today carries `UNIQUE(user_id)` (see
 *      `website/supabase/migrations/20260527042620_create_org_members.sql`)
 *      — i.e. a user belongs to exactly one org. Multi-membership is a
 *      future E5.x schema change. Building the query against the
 *      single-membership shape is correct today AND honours the spec OQ-4
 *      rule (switcher hidden when `< 2` memberships — so single-membership
 *      users see nothing).
 *
 *   b. Option 1 would couple the cookie shape (an E5.1 / E6.3 cross-epic
 *      contract) to tenant names, which are display-only data. Names belong
 *      in a server-rendered prop, not a cookie.
 *
 *   c. Option 2 would create a flash of "no switcher / wrong label" while
 *      the client-side query resolves, and would force the switcher into a
 *      `useEffect`-driven data flow — exactly the kind of UX the existing
 *      cookie-on-render pattern was designed to avoid.
 *
 * # Where the data-source plugs in when E5.x ships multi-membership
 *
 * The only file that needs to change is `fetchMembershipsForActiveUser`
 * below — adjust the query to drop the implicit single-membership assumption
 * (e.g. `select(...).eq('user_id', ...)` returns N rows instead of 0 or 1).
 * The consumer surface (`Membership[]`) is already shaped for N memberships.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Tenant membership shape consumed by `TenantSwitcher`. Mirrors `organisations`
 * row columns the switcher renders today: `id` for the switch action, `name`
 * for the visible label.
 *
 * Kept as a plain type (not a Zod schema) — the helper below validates shape
 * at the query layer; the consumer trusts the prop.
 */
export interface Membership {
  /** Tenant (organisation) ID. Matches `SessionCookieClaims.activeTenantId`. */
  id: string;
  /** Human-readable tenant name (`organisations.name`). */
  name: string;
}

/**
 * Server-side fetch of the signed-in user's tenant memberships.
 *
 * Returns an empty array on any failure (no user, RLS denies, query errors).
 * The switcher then falls back to "no memberships" — combined with the
 * cookie's `membershipCount`, the switcher hides itself per OQ-4. The
 * conservative behaviour is intentional: a tenant-name lookup failure must
 * NEVER force-render a switcher that could land the user on the wrong org.
 *
 * # Why RLS does the heavy lifting
 *
 * The `org_members` RLS policy (`members read own membership`) restricts the
 * SELECT to `user_id = auth.uid()` — so even though the join below reads
 * `organisations`, the inner-join on the membership row ensures the query
 * returns only the rows the user can read. The `organisations` RLS policy
 * (`members read own org`) is a belt-and-braces backstop.
 *
 * # Single-membership today, N-membership tomorrow
 *
 * Today this returns 0 or 1 rows because of `UNIQUE(user_id)` on
 * `org_members`. When E5.x relaxes that constraint (multi-membership schema),
 * this returns N rows with no consumer change.
 */
export async function fetchMembershipsForActiveUser(): Promise<Membership[]> {
  const supabase = await createSupabaseServerClient();

  // Resolve the active user first. If unauth (e.g. cookie raced), bail with
  // an empty membership set — the layout still renders the shell chrome but
  // the switcher hides itself.
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return [];
  }

  // Inner-join through `org_members` to read the tenant name from
  // `organisations`. The PostgREST embedding syntax (`organisations(id,
  // name)`) is the canonical Supabase pattern for joining an FK in a single
  // round-trip — RLS still applies to both sides.
  //
  // We DO NOT filter `organisations.deleted_at IS NULL` here because the
  // org-soft-delete + purge flow (E5.1 Phase 4) treats deleted orgs as
  // invisible at the RLS layer — the policy that lets the user read the org
  // checks active membership, not the deletion flag, but a soft-deleted org
  // is supposed to revoke memberships before the purge window closes. If
  // that invariant breaks, the worst case is the switcher shows a soft-
  // deleted org name; the active-tenant cookie write side (E5.1) is the
  // authoritative gate for whether the user can actually act on it.
  const { data, error } = await supabase
    .from('org_members')
    .select('organisations(id, name)')
    .eq('user_id', userData.user.id);

  if (error || !data) {
    return [];
  }

  // PostgREST returns embedded relations either as `T | null` (one-to-one) or
  // `T[]` (one-to-many) depending on FK direction. `org_members.org_id` is a
  // FK to `organisations.id`, so each row's `organisations` is the single
  // joined row — but Supabase's generated types occasionally narrow this to
  // `null` if the FK is nullable. We defensively handle both shapes and skip
  // any row whose join evaluated to null.
  type Row = {
    organisations: { id: string; name: string } | { id: string; name: string }[] | null;
  };

  const memberships: Membership[] = [];
  for (const row of data as Row[]) {
    const org = row.organisations;
    if (org === null) {
      continue;
    }
    if (Array.isArray(org)) {
      for (const o of org) {
        memberships.push({ id: o.id, name: o.name });
      }
    } else {
      memberships.push({ id: org.id, name: org.name });
    }
  }
  return memberships;
}
