/**
 * Wordmark — LSL Calculator sub-brand wordmark
 *
 * E6.2 Task 2.5. Renders the approved Candidate B wordmark (Task 1.4 sign-off
 * 2026-05-28) at three colour treatments:
 *
 *   - `default` — full colour: navy "LSL Calculator" + gold rule + dark-blue
 *     "by Australian Payroll Association". For light surfaces.
 *   - `mono`    — navy-only variant (gold rule removed). For coloured fields
 *     where the gold accent would clash with the surface colour.
 *   - `inverse` — white type on navy field with gold rule preserved. For dark
 *     surfaces (e.g. dark hero band, top-nav over a colour image).
 *
 * The SVG masters live under `docs/brand/final/wordmark/` and are copied into
 * `website/public/brand/` at build time by `scripts/sync-brand-assets.mjs`
 * (wired into the `prebuild` npm script per Task 1.4). The wordmark renders
 * as an `<img>` so it is cacheable, exempt from the React render path, and
 * trivial for downstream consumers to swap if the wordmark is updated — no
 * component change needed.
 *
 * Per spec §5.6, the public calc is mobile-responsive: the wordmark scales by
 * its `width` prop (defaults to a sensible header size). The intrinsic 1000×360
 * aspect ratio (25:9 = ~2.78:1) is preserved automatically via `aspect-ratio`.
 *
 * Accessibility (spec §5.5):
 *   - When the wordmark is a redundant label next to text saying the same
 *     thing (e.g. a Lockup), pass `alt=""` to mark it decorative for screen
 *     readers — set via the `decorative` prop.
 *   - Default `alt` is the brand name, suitable when the wordmark is the only
 *     label (e.g. the top-nav home link).
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Wordmark colour-treatment variants. Each maps to a different SVG file under
 * `/brand/`, all synced from `docs/brand/final/wordmark/`.
 */
export type WordmarkVariant = 'default' | 'mono' | 'inverse';

/**
 * Maps a variant to its public asset URL. The URL is stable — driven by the
 * sync script. If a new variant lands in `docs/brand/final/wordmark/`, add a
 * mapping entry there AND in `scripts/sync-brand-assets.mjs`.
 */
const VARIANT_TO_SRC: Readonly<Record<WordmarkVariant, string>> = {
  default: '/brand/wordmark.svg',
  mono: '/brand/wordmark-mono.svg',
  inverse: '/brand/wordmark-white-on-navy.svg',
};

export interface WordmarkProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  /**
   * Colour treatment to render. Defaults to `default` (full colour).
   */
  variant?: WordmarkVariant;
  /**
   * Render width in CSS pixels. Height is derived from the 1000×360 viewBox
   * to preserve the aspect ratio. Default is 200 — a balanced header size at
   * 1× density that scales cleanly to retina.
   */
  width?: number | string;
  /**
   * Accessible label. Defaults to `"LSL Calculator"`. Pass `decorative`
   * instead if the wordmark sits next to redundant text — that route sets
   * an empty alt and `aria-hidden`, which is more honest with assistive tech.
   */
  alt?: string;
  /**
   * Set when the wordmark is decorative (e.g. inside a Lockup that already
   * names the brand in text). Sets `alt=""` and `aria-hidden`.
   */
  decorative?: boolean;
}

/**
 * Renders the sub-brand wordmark. Forwards `ref` so consumers can measure or
 * focus-manage it if needed (rare).
 */
export const Wordmark = React.forwardRef<HTMLImageElement, WordmarkProps>(
  function Wordmark(
    {
      variant = 'default',
      width = 200,
      alt = 'LSL Calculator',
      decorative = false,
      className,
      ...rest
    },
    ref,
  ) {
    const src = VARIANT_TO_SRC[variant];

    return (
      // Deliberate `<img>` (not `next/image`):
      //   1. The wordmark is an SVG. next/image's optimisation pipeline targets
      //      rasters; for SVGs it requires `dangerouslyAllowSVG` + a custom
      //      `contentSecurityPolicy` — escalating CSP risk to render a vector
      //      that the browser already paints natively.
      //   2. The wordmark is small (~5 KB), brand-stable, and cached. There is
      //      no LCP win to be had.
      //   3. Keeping the component as a plain `<img>` means it works in
      //      server components, client components, MDX (Storybook docs), and
      //      future PDF preview surfaces — all without a Next-specific shim.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={ref}
        src={src}
        // 1000:360 = 25:9 aspect ratio from the SVG viewBox. Keeping this in
        // the inline `style` rather than a Tailwind class keeps the component
        // self-contained — no consumer-side height calc, no layout shift.
        style={{ aspectRatio: '1000 / 360' }}
        width={width}
        // Mark decorative wordmarks with empty alt + aria-hidden so axe-core
        // doesn't flag them as duplicate labels when paired with redundant
        // text (e.g. inside a Lockup). Pure accessibility hygiene.
        alt={decorative ? '' : alt}
        aria-hidden={decorative || undefined}
        className={cn('inline-block h-auto select-none', className)}
        {...rest}
      />
    );
  },
);
