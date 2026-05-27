/**
 * `<AuthLayout>` — the APA-branded shell shared across every `/app/*` auth
 * surface (signup, login, verify-email, forgot-password, reset-password,
 * account) and the post-login placeholder home page.
 *
 * Layout contract (auth-impl-plan §2.4):
 *
 *   <AuthLayout>          ← APA-branded shell (header wordmark, footer link)
 *     <AuthCard>          ← centred, max-width 420px, shadow
 *       <AuthHeader/>     ← page title + sub-text
 *       <form>            ← React 19 server-action form
 *       <AuthFooter/>     ← contextual nav ("Already have an account?")
 *     </AuthCard>
 *   </AuthLayout>
 *
 * APA brand v1 (per Task 3.4 audit, 2026-05-26):
 *   - No logo asset in `website/public/` yet — header uses the text wordmark
 *     "APA · LSL Platform". The real logo asset lands before AC-AUTH-15
 *     designer sign-off (Task 8.1).
 *   - Tokens come from `src/app/globals.css` (`bg-background`,
 *     `text-foreground`, APA-blue `primary`, etc.). No magic hex values here.
 *
 * Card width of 420px matches the typical auth-form viewport tested in the
 * shadcn pattern library — narrow enough to feel intentional, wide enough
 * for "Forgot password?" link without wrapping.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';

interface AuthLayoutProps {
  /**
   * Page title rendered at the top of the card. Short noun phrase
   * ("Create your account", "Welcome back").
   */
  title: string;
  /**
   * Optional sub-text under the title — one sentence at most, sets context
   * for the form.
   */
  description?: string;
  /**
   * The form / page body. Owned by the caller; the layout just provides
   * the shell.
   */
  children: ReactNode;
  /**
   * Optional row of links rendered under the body — "Already have an
   * account? Log in" style nav.
   */
  footer?: ReactNode;
}

export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      {/* Top wordmark — APA · LSL Platform.
        * Links back to the public marketing root (`/`) so users who land here
        * by mistake can escape without hunting for a Back button. */}
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
          <Link
            href="/"
            className="font-semibold tracking-tight text-foreground"
            aria-label="APA · LSL Platform — home"
          >
            <span className="text-primary">APA</span>
            <span className="mx-2 text-muted-foreground">·</span>
            <span>LSL Platform</span>
          </Link>
        </div>
      </header>

      {/* Centred card.
        * `flex-1` pushes the footer to the bottom of the viewport on tall
        * screens; `py-12` gives breathing room on mobile. */}
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[420px]">
          <div className="rounded-lg border bg-card p-8 shadow-sm">
            <div className="mb-6 space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {description ? (
                <p className="text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            {children}
          </div>
          {footer ? (
            <div className="mt-6 text-center text-sm text-muted-foreground">
              {footer}
            </div>
          ) : null}
        </div>
      </main>

      <footer className="border-t bg-background py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 text-xs text-muted-foreground">
          <span>APA · LSL Platform</span>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
        </div>
      </footer>
    </div>
  );
}
