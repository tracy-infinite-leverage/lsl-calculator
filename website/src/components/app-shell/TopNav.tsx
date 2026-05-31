/**
 * TopNav — fixed top bar across every `/app/*` route.
 *
 * E6.3 Task 3.1 (spec §5.2 + §8.3 AC bullet 1).
 *
 * Layout (left → right):
 *
 *   [ Wordmark · LSL Calculator ]   ─────────────  [ 🔔 ] [ avatar ▾ ]
 *                                   (flex-1 spacer)
 *
 * Split shape:
 *   - `TopNav` (default export) is a **Server Component** that reads the
 *     signed-in user from the Supabase SSR session and forwards
 *     `email` + `displayName` into `TopNavPresentation`.
 *   - `TopNavPresentation` is the pure markup — usable from Storybook
 *     (which can't render Server Components) and from server contexts
 *     (passed plain props). All the markup lives there.
 *
 * Sticky positioning: `sticky top-0` so the bar stays visible while the
 * main column scrolls. `z-30` keeps it above page content but below the
 * Radix portal layer (`z-50` in dialog / dropdown panels) so menus open
 * cleanly above the bar without focus-trap clashes.
 *
 * Wordmark variant: `mono` — the default full-colour wordmark carries a
 * gold rule which clashes with the brand-white bar surface at small sizes.
 * Mono (navy-only) reads cleaner at the 32px nav height per the brand
 * wordmark documentation (`docs/brand/wordmark-treatments.md`). When the
 * shell ships a dark-mode token set, swap to `inverse` per surface.
 *
 * Notifications bell: presentational only in v1 per Task 3.1 spec
 * ("functional bell logic out of scope here — placeholder badge OK").
 */

import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Wordmark } from '@/components/brand/Wordmark';
import { Bell } from '@/components/brand/Icon';
import { UserMenu } from './UserMenu';

export interface TopNavPresentationProps {
  /**
   * Email of the signed-in user. Always present in production (the proxy
   * gates `/app/*` for unauth users); the `?? ''` fallback in the server
   * wrapper keeps the rendered surface deterministic if the cookie races.
   */
  email: string;
  /**
   * Display name (e.g. from `user_metadata.display_name`). Empty string is
   * the safe default — `UserMenu` falls back to the email local-part.
   */
  displayName?: string;
}

/**
 * Pure-presentation TopNav. Renders identically whether called from the
 * server layout or a Storybook story. No data-fetching, no Supabase, no
 * cookies.
 */
export function TopNavPresentation({ email, displayName = '' }: TopNavPresentationProps) {
  return (
    <header
      // `border-b` separates the bar from the page surface without a
      // shadow — keeps the visual weight on the wordmark, not the chrome.
      // `bg-brand-white` overrides whatever surface the page sits on so
      // the bar reads consistently across all `/app/*` routes.
      className="sticky top-0 z-30 flex h-14 w-full items-center gap-3 border-b border-brand-light-blue/40 bg-brand-white px-4 sm:px-6"
      data-testid="app-topnav"
    >
      {/* Wordmark — home link. `mono` variant per file-header rationale. */}
      <Link
        href="/app"
        className="inline-flex shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
        aria-label="LSL Calculator — go to home"
      >
        <Wordmark variant="mono" width={140} />
      </Link>

      {/* Spacer — pushes the right-rail to the far edge. */}
      <div className="flex-1" aria-hidden="true" />

      {/* Notifications bell — placeholder per Task 3.1 spec.
        *
        * Renders as a button so future Task X can attach an `onClick`
        * without changing markup. The badge is wired to a hard-coded `0`
        * count for now; the unread mechanism is a later epic concern.
        */}
      <button
        type="button"
        aria-label="Notifications"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-brand-charcoal transition-colors hover:bg-brand-light-blue/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
        data-testid="app-topnav-bell"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        <span className="sr-only">0 unread notifications</span>
      </button>

      {/* User menu — client island. */}
      <UserMenu email={email} displayName={displayName} />
    </header>
  );
}

/**
 * Server wrapper. Reads the user from the Supabase SSR client and forwards
 * to `TopNavPresentation`. The presentation component owns ALL markup; this
 * wrapper exists only to bind the data.
 */
export async function TopNav() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  const email = user?.email ?? '';
  const displayName =
    typeof user?.user_metadata?.['display_name'] === 'string'
      ? (user.user_metadata['display_name'] as string)
      : '';

  return <TopNavPresentation email={email} displayName={displayName} />;
}
