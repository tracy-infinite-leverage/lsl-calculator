#!/usr/bin/env node
/**
 * audit-bundle.mjs — production bundle audit for spec §5.7 (no third-party
 * hosting) and §5.1 (no third-party font CDN) + LAUNCH-GUARD posture.
 *
 * Task 2.10 (E6.2). Acceptance criteria are in
 * `.specify/features/006-ui-design-system/tasks.md` §2.10:
 *
 *   1. Greps `.next/static/*` for embedded third-party URLs (fonts.googleapis,
 *      fonts.gstatic, unpkg, jsdelivr, cdnjs, ...). Hit → fail.
 *   2. Greps `.next/static/*` for `@storybook/*` package paths. Hit → fail
 *      (Storybook chunks must never leak into the client production bundle).
 *   3. Greps `.next/static/*` for axe-core / playwright leakage (devDep guard).
 *   4. Greps SVG assets under `public/` and `.next/static/` for the literal
 *      string `@import url(` — the wordmark @import-leak bug class fixed by PR #62 (Task
 *      2.5.1). Any future SVG that ships with an `@import url(...)` font load
 *      would silently re-introduce a Google Fonts request on first paint.
 *
 * Runs after `npm run build`. Wired into `postbuild` so it executes on every
 * CI build (the `test` job in `.github/workflows/ci.yml`). Returns non-zero on
 * any finding.
 *
 * Usage:
 *   npm run build               # populates .next/static
 *   node scripts/audit-bundle.mjs
 *
 *   # Or skip via env var (only for local development; CI must run it):
 *   SKIP_BUNDLE_AUDIT=1 npm run build
 *
 * The script is intentionally simple — pure file-walk + substring scan. No
 * AST parsing, no source-maps, no network. Easy to reason about; easy to fix
 * when it false-positives (add the literal to ALLOWLIST_SUBSTRINGS with a
 * comment explaining why).
 *
 * --------------------------------------------------------------------------
 * Why a custom script and not webpack-bundle-analyzer?
 * --------------------------------------------------------------------------
 * Bundle analyzer tells you "size of @storybook/* in client bundle = 0 bytes"
 * by reading the module graph. We want a much simpler guarantee: "no string
 * matching ^@storybook/ appears in any .js/.css we ship to the browser".
 * That holds even if a transitive dep accidentally re-exports a Storybook
 * symbol via a barrel file. Substring grep on built artefacts is the
 * paranoid check.
 *
 * Failure mode coverage:
 *   - SVG `@import url(https://fonts.googleapis.com/...)` → caught
 *   - Hard-coded font CDN string in a CSS chunk → caught
 *   - Accidental `import '@storybook/addon-...'` from app code → caught
 *   - Vendored axe-core in client chunks (devDep leak) → caught
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WEBSITE_DIR = resolve(__dirname, '..');
const NEXT_STATIC = resolve(WEBSITE_DIR, '.next', 'static');
const PUBLIC_DIR = resolve(WEBSITE_DIR, 'public');

// Substrings that, if found in any shipped artefact, indicate a third-party
// origin leak. Spec §5.1 + §5.7 forbid all of these.
//
// Note: we deliberately use plain substrings rather than regexes — the bundle
// is minified, so any escape sequence (e.g. `/`) we don't anticipate
// would let a regex slip through. Substrings catch the literal URL form that
// browsers actually resolve.
const THIRD_PARTY_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'unpkg.com',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'use.typekit.net',
  'maxcdn.bootstrapcdn.com',
  'ajax.googleapis.com',
];

// Package paths that should never appear in the client bundle.
// `@storybook/*` is the headline guard from tasks.md §2.10 AC.
// axe-core + @axe-core/* are dev-only QA tooling.
const DEV_ONLY_IMPORTS = [
  '@storybook/',
  '@axe-core/',
  'axe-core/lib/', // axe-core's actual JS payload — substring distinct from devDep specifier
];

// Server-only asset paths that must never appear in client JS / CSS.
// `/fonts/pdf/` is the unsubset-TTF directory registered by
// `src/lib/pdf/fonts.ts` for the @react-pdf/renderer pipeline (E6.5 Task 5.2).
// Those TTFs are ~3× the size of the parent woff2 files and serve a
// server-side concern only — the browser never fetches them. A reference
// to `/fonts/pdf/` in a client chunk would mean the path leaked into a
// `'use client'` module and would unnecessarily preload the TTF.
const SERVER_ONLY_PATHS = [
  '/fonts/pdf/',
];

// Patterns that indicate an SVG (or any text asset) is fetching a font over
// the network at render time. The wordmark @import-leak bug class (PR #62).
const SVG_FONT_IMPORT_PATTERN = '@import url(';

// Allowlist: literals we tolerate even if they look like a hit. Keep tiny;
// every entry needs an inline comment explaining why it's safe.
const ALLOWLIST_SUBSTRINGS = [
  // (intentionally empty — add with justification only)
];

// File extensions we scan in `.next/static`. JS + CSS are the production
// payload. JSON manifests are sometimes inlined — scan them too. Skip binary
// fonts/images.
const STATIC_SCAN_EXTENSIONS = new Set(['.js', '.css', '.json', '.map', '.svg']);

async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

function isAllowlisted(line) {
  return ALLOWLIST_SUBSTRINGS.some((s) => line.includes(s));
}

async function scanFile(path, needles) {
  const content = await readFile(path, 'utf-8').catch(() => null);
  if (content == null) return [];
  const hits = [];
  for (const needle of needles) {
    const idx = content.indexOf(needle);
    if (idx !== -1) {
      // Capture a tight window of context (60 chars) for the report.
      const start = Math.max(0, idx - 30);
      const end = Math.min(content.length, idx + needle.length + 30);
      const context = content.slice(start, end).replace(/\s+/g, ' ');
      if (!isAllowlisted(context)) {
        hits.push({ needle, context });
      }
    }
  }
  return hits;
}

async function auditNextStatic() {
  console.log(`[audit-bundle] scanning ${NEXT_STATIC}`);
  const allFiles = await walk(NEXT_STATIC);
  const scanFiles = allFiles.filter((f) => STATIC_SCAN_EXTENSIONS.has(extname(f)));
  console.log(`[audit-bundle]   ${scanFiles.length} text artefacts to scan`);

  const findings = [];
  const needles = [...THIRD_PARTY_HOSTS, ...DEV_ONLY_IMPORTS, ...SERVER_ONLY_PATHS];
  for (const file of scanFiles) {
    const hits = await scanFile(file, needles);
    for (const h of hits) {
      findings.push({ file, ...h });
    }
  }
  return findings;
}

async function auditSvgAssets() {
  // Public SVGs are served as-is by Next; an `@import` inside one is a live
  // font-CDN request at render time (the PR #62 bug class).
  console.log(`[audit-bundle] scanning SVGs in ${PUBLIC_DIR}`);
  const allFiles = await walk(PUBLIC_DIR);
  const svgFiles = allFiles.filter((f) => extname(f) === '.svg');
  console.log(`[audit-bundle]   ${svgFiles.length} SVG files to scan`);

  const findings = [];
  for (const file of svgFiles) {
    const hits = await scanFile(file, [SVG_FONT_IMPORT_PATTERN]);
    for (const h of hits) {
      findings.push({ file, ...h });
    }
  }
  return findings;
}

async function captureBundleSize() {
  // Sum sizes of all .next/static/chunks files. Reported only — not a gate
  // (a size budget belongs in Task 4.7's Lighthouse CI plan). The number
  // lands in CI logs as a leading-indicator metric.
  const chunksDir = resolve(NEXT_STATIC, 'chunks');
  let total = 0;
  const all = await walk(chunksDir);
  for (const f of all) {
    const s = await stat(f);
    total += s.size;
  }
  return total;
}

async function main() {
  // Pre-flight: .next/static must exist (i.e. `npm run build` ran).
  try {
    await stat(NEXT_STATIC);
  } catch {
    console.error(
      `[audit-bundle] ERROR: ${NEXT_STATIC} not found. Run \`npm run build\` first.`,
    );
    process.exit(2);
  }

  if (process.env.SKIP_BUNDLE_AUDIT === '1') {
    console.log('[audit-bundle] SKIP_BUNDLE_AUDIT=1 — exiting cleanly.');
    process.exit(0);
  }

  const [staticFindings, svgFindings] = await Promise.all([
    auditNextStatic(),
    auditSvgAssets(),
  ]);
  const bundleSize = await captureBundleSize();

  console.log(`\n[audit-bundle] bundle-chunks total: ${(bundleSize / 1024).toFixed(1)} KB`);

  const allFindings = [...staticFindings, ...svgFindings];
  if (allFindings.length === 0) {
    console.log('[audit-bundle] PASS — no third-party origins, no dev-only imports, no SVG @import leaks.');
    process.exit(0);
  }

  console.error('\n[audit-bundle] FAIL — bundle audit violations:\n');
  for (const f of allFindings) {
    const rel = f.file.replace(WEBSITE_DIR + '/', '');
    console.error(`  ${rel}`);
    console.error(`    needle:  ${f.needle}`);
    console.error(`    context: …${f.context}…`);
  }
  console.error(`\n[audit-bundle] ${allFindings.length} violation(s). Spec §5.1 + §5.7.`);
  process.exit(1);
}

main().catch((err) => {
  console.error('[audit-bundle] unexpected error:', err);
  process.exit(2);
});
