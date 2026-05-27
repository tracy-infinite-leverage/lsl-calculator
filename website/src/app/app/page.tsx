/**
 * `/app/` — post-login placeholder home page.
 *
 * Task 5.6 / OQ-AUTH-7 — this page exists purely to satisfy the post-login
 * redirect target so the auth slice can ship as a self-contained vertical.
 * The real platform home page lands in a later E5.1 slice; until then, a
 * verified user logging in lands here.
 *
 * Routing contract:
 *   - Unauthenticated visit → proxy redirects to `/app/login` (see proxy.ts).
 *   - Unverified session     → proxy redirects to `/app/verify-email`.
 *   - Verified session       → this page renders.
 *
 * The page is intentionally static (no data fetch). No client-side state,
 * no Supabase call, no `auth.getUser()` here — the proxy is the single
 * chokepoint that has already vetted the request by the time it reaches us.
 */

import type { Metadata } from 'next';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Welcome | APA LSL Platform',
  description: 'APA LSL Platform — under construction.',
  // No SEO indexing — this is a private workspace, not a marketing page.
  robots: { index: false, follow: false },
};

export default function AppHomePage() {
  return (
    <AuthLayout
      title="Welcome"
      description="Platform under construction."
      footer={
        <form action="/app/logout" method="post" className="inline">
          <button
            type="submit"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
          >
            Log out
          </button>
        </form>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          The full APA LSL Platform is rolling out in stages. You'll find the
          tools and dashboards here as each module ships.
        </p>
        <p className="text-muted-foreground">
          In the meantime, the public Long Service Leave calculator remains
          available.
        </p>
        <Button asChild variant="outline" className="w-full">
          <a href="/calculator/single">Open the LSL calculator</a>
        </Button>
      </div>
    </AuthLayout>
  );
}
