#!/usr/bin/env node
/**
 * sync-brand-assets.mjs — copy `docs/brand/final/` → `website/public/`
 *
 * E6.1 Task 1.4 deliverable; landed inside E6.2 Task 2.5 PR because the
 * Wordmark component literally requires the SVG to exist at a stable runtime
 * URL. The Task 1.4 PR (#54) shipped the asset set but deferred this script.
 * See HANDOFF.md §2 ([SCOPE-NOTE]).
 *
 * Why a script, not a symlink:
 *   The Vercel build container's filesystem differs from macOS dev shells; SVG
 *   symlinks from a sibling dir into `public/` are fragile across builds.
 *   Copying is dumb and reliable.
 *
 * What gets copied (mapping authoritative in `docs/brand/final/README.md`):
 *   - wordmark family   → /brand/wordmark*.{svg,png}
 *   - app icon family   → /favicon.ico + /favicon-{16,32}x{16,32}.png +
 *                         /apple-touch-icon.png + /android-chrome-{192,512}x*.png
 *                         + /icon-512x512.png + /safari-pinned-tab.svg
 *   - og card family    → /og/og-card{,-square}.png
 *
 * Idempotent: skips files where the destination mtime ≥ source mtime AND the
 * sizes match. Forces a copy if the file is missing or stale.
 *
 * Failure modes:
 *   - Missing source       → fail loud with the path; do not silently skip.
 *   - Same-size newer dest → leave it (someone re-rendered in place; preserve).
 *   - I/O error            → propagate.
 *
 * Wired into `package.json` "prebuild" so production + Vercel builds always
 * carry the latest brand assets. Developers can also run `node
 * scripts/sync-brand-assets.mjs` ad hoc from `website/`.
 */

import { copyFile, mkdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Project layout: this script lives at `website/scripts/`, brand source at
// `docs/brand/final/` (one directory up + sibling), brand destination at
// `website/public/`.
const WEBSITE_ROOT = resolve(__dirname, '..');
const PROJECT_ROOT = resolve(WEBSITE_ROOT, '..');
const SRC_ROOT = resolve(PROJECT_ROOT, 'docs', 'brand', 'final');
const DEST_ROOT = resolve(WEBSITE_ROOT, 'public');

/**
 * Source → destination mapping. Source paths are relative to `docs/brand/final/`;
 * destination paths are relative to `website/public/`. Mapping matches the
 * authoritative table in `docs/brand/final/README.md`.
 */
const MAPPING = [
  // Wordmark family — served from /brand/* so the Wordmark component has a
  // stable URL across light / mono / inverse variants.
  ['wordmark/wordmark-master.svg', 'brand/wordmark.svg'],
  ['wordmark/wordmark-1x.png', 'brand/wordmark-1x.png'],
  ['wordmark/wordmark-2x.png', 'brand/wordmark-2x.png'],
  ['wordmark/wordmark-3x.png', 'brand/wordmark-3x.png'],
  ['wordmark/wordmark-mono.svg', 'brand/wordmark-mono.svg'],
  ['wordmark/wordmark-mono.png', 'brand/wordmark-mono.png'],
  ['wordmark/wordmark-white-on-navy.svg', 'brand/wordmark-white-on-navy.svg'],
  ['wordmark/wordmark-white-on-navy.png', 'brand/wordmark-white-on-navy.png'],

  // App icon family — served from /* (root) per Next.js favicon conventions.
  ['app-icon/icon-16.png', 'favicon-16x16.png'],
  ['app-icon/icon-32.png', 'favicon-32x32.png'],
  ['app-icon/apple-touch-icon-180.png', 'apple-touch-icon.png'],
  ['app-icon/android-chrome-192.png', 'android-chrome-192x192.png'],
  ['app-icon/android-chrome-512.png', 'android-chrome-512x512.png'],
  ['app-icon/icon-512.png', 'icon-512x512.png'],
  ['app-icon/favicon.ico', 'favicon.ico'],
  ['app-icon/safari-pinned-tab.svg', 'safari-pinned-tab.svg'],

  // OG card family — served from /og/* so meta tags can point at
  // /og/og-card.png and /og/og-card-square.png.
  ['og/og-card.png', 'og/og-card.png'],
  ['og/og-card-square.png', 'og/og-card-square.png'],
];

/**
 * Returns the file's mtime + size, or null if it doesn't exist.
 */
async function statSafe(path) {
  try {
    const s = await stat(path);
    return { mtimeMs: s.mtimeMs, size: s.size };
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function syncOne(srcRel, destRel) {
  const src = join(SRC_ROOT, srcRel);
  const dest = join(DEST_ROOT, destRel);

  const srcStat = await statSafe(src);
  if (!srcStat) {
    throw new Error(
      `sync-brand-assets: missing source file: ${src}. ` +
        `Check docs/brand/final/README.md mapping table.`
    );
  }

  const destStat = await statSafe(dest);
  // Idempotency: if the destination exists, is at least as new as source, and
  // has identical bytes (size proxy), skip the copy. Avoids rebuilding the
  // entire public/ tree on every prebuild.
  if (
    destStat &&
    destStat.size === srcStat.size &&
    destStat.mtimeMs >= srcStat.mtimeMs
  ) {
    return { src, dest, status: 'skip' };
  }

  await mkdir(dirname(dest), { recursive: true });
  await copyFile(src, dest);
  return { src, dest, status: destStat ? 'update' : 'copy' };
}

async function main() {
  const results = [];
  for (const [srcRel, destRel] of MAPPING) {
    // Sequential, not parallel — the asset set is small (19 files) and any
    // single failure should surface a clear "which file?" line immediately.
    // eslint-disable-next-line no-await-in-loop
    results.push(await syncOne(srcRel, destRel));
  }

  const copied = results.filter((r) => r.status === 'copy').length;
  const updated = results.filter((r) => r.status === 'update').length;
  const skipped = results.filter((r) => r.status === 'skip').length;
  // eslint-disable-next-line no-console
  console.log(
    `[sync-brand-assets] ${copied} copied, ${updated} updated, ${skipped} unchanged ` +
      `(${results.length} total).`
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err.message || err);
  process.exit(1);
});
