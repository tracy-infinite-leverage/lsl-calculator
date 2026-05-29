/**
 * Build a Supabase Auth redirect URL (used for `emailRedirectTo` on signup +
 * resend, and `redirectTo` on password reset).
 *
 * Why this exists:
 *
 *   Supabase Auth bakes the redirect URL into the email at send-time. If we
 *   send `http://localhost:3000/...`, every recipient gets a localhost link
 *   they can never reach — and we only find out by deploying and watching
 *   real customers fail to verify. This helper exists to make a localhost
 *   link in a production email structurally impossible.
 *
 * Fallback order (first non-empty wins):
 *
 *   1. Request `Origin` header — the URL the request actually came from.
 *      For a customer signing up at `https://www.lslcalculator.com.au`,
 *      this is the production URL. For a developer running `npm run dev`,
 *      it's `http://localhost:3000`. For a Vercel preview deploy, it's
 *      `https://lsl-calculator-<sha>-infiniteleverage-2.vercel.app`.
 *
 *   2. `NEXT_PUBLIC_SITE_URL` env var — a hardcoded production-domain
 *      fallback set in Vercel's Production env to
 *      `https://www.lslcalculator.com.au`. This catches the rare case where
 *      `Origin` is missing in production (e.g. a proxy strips it, or a
 *      non-browser client posts the form). Without this fallback, a missing
 *      `Origin` in production silently degrades to a localhost link.
 *
 *   3. Literal `http://localhost:3000` — local-dev only. Never reached in a
 *      Vercel Production deployment if `NEXT_PUBLIC_SITE_URL` is set, which
 *      is enforced by `docs/engineering/vercel-config.md` and recorded in
 *      `website/.env.example`.
 *
 * The Supabase dashboard's "Redirect URLs" allow-list must include every
 * origin this helper can emit — production, Vercel preview wildcard, and
 * localhost. See `docs/engineering/vercel-config.md` §"Environment variables"
 * for the canonical record.
 *
 * @param originHeader  Result of `headers().get('origin')` in a Server
 *                       Component or Server Action.
 * @param path          App-relative path, MUST start with `/`. The helper
 *                       does NOT validate `path` to keep it dependency-free;
 *                       callers should hardcode their target.
 * @returns Absolute URL safe to pass as `emailRedirectTo` / `redirectTo`.
 */
export function buildAuthRedirectUrl(
  originHeader: string | null | undefined,
  path: `/${string}`
): string {
  const base =
    (originHeader && originHeader.length > 0 ? originHeader : null) ??
    (process.env.NEXT_PUBLIC_SITE_URL &&
    process.env.NEXT_PUBLIC_SITE_URL.length > 0
      ? process.env.NEXT_PUBLIC_SITE_URL
      : null) ??
    'http://localhost:3000';

  return `${base}${path}`;
}
