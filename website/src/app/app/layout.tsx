/**
 * Layout for the authenticated app surface (`/app/*`).
 *
 * Single purpose: opt the entire `/app/*` route subtree out of static
 * prerender by exporting `dynamic = 'force-dynamic'` once at the layout
 * level instead of per-page.
 *
 * Why force-dynamic for this whole subtree:
 *
 *   1. Every `/app/*` page is gated by the proxy (`src/proxy.ts`), which
 *      reads/writes session cookies on each request. Pages here are
 *      effectively dynamic in practice — there is no scenario where a
 *      static prerender would be served.
 *
 *   2. Several pages (`verify-email`, `reset-password`, and any future
 *      page that calls `createSupabaseServerClient` at render time) read
 *      `NEXT_PUBLIC_SUPABASE_*` env vars during module evaluation. Those
 *      vars are absent in the GitHub Actions CI environment that runs
 *      `next build` (Vercel injects them at runtime, not at build time on
 *      CI), so a static prerender throws "Supabase environment variables
 *      are missing". Forcing dynamic here defers the Supabase client
 *      construction to request time and removes the entire class of bug
 *      from any future page added under `/app/*`.
 *
 *   3. This does NOT affect the public marketing/calculator routes —
 *      they live outside `/app/*` and continue to be statically rendered.
 *
 * The layout is otherwise a transparent pass-through. The root layout
 * (`src/app/layout.tsx`) owns `<html>`, `<body>`, fonts, Analytics, etc.
 */

export const dynamic = 'force-dynamic';

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
