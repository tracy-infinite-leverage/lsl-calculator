#!/usr/bin/env node
/**
 * build-icon-sprite.mjs — generate `public/icons/sprite.svg` from the
 * production OQ-2 SVG set committed to `docs/brand/icons/`.
 *
 * E6.2+ barrel swap (the load-bearing PR that flips the production icon set
 * ON). Reads 126 source SVGs from `docs/brand/icons/{default,active,disabled}/`
 * and emits a single sprite at `website/public/icons/sprite.svg` containing
 * 126 `<symbol>` definitions — one per (state, icon) pair, keyed by
 * `<state>--<kebab-name>` (e.g. `default--users`, `active--bell`).
 *
 * The barrel (`src/components/brand/Icon.tsx`) renders icons as:
 *
 *   <svg className={...} aria-hidden="true">
 *     <use href="/icons/sprite.svg#default--users" />
 *   </svg>
 *
 * which gives us: (a) one HTTP request for all icons (cached aggressively),
 * (b) per-component file size of ~120 bytes (the wrapper), and (c) the v1→v1.1
 * swap is just "drop new SVGs into `docs/brand/icons/` and re-run this script."
 *
 * --------------------------------------------------------------------------
 * Why pre-generate + commit (and also run as `prebuild`)?
 * --------------------------------------------------------------------------
 * The sprite is a build artefact, but committing it has three benefits:
 *
 *   1. PR diffs surface the actual sprite change a reviewer can eyeball
 *      ("did we drop or add an icon?") — invisible if generated at CI time.
 *   2. Local `npm run dev` works without remembering to run the script first.
 *   3. Tests can read the committed file from disk (the brand.test.ts
 *      assertions don't need to spin up a build).
 *
 * The `prebuild` step re-runs the generator on every production build so
 * the committed file stays honest. If the prebuild output differs from the
 * committed file, `git status` shows it during local dev and CI's clean-tree
 * check (if one is added later) flags it. Belt-and-braces.
 *
 * --------------------------------------------------------------------------
 * Why a tiny regex-based parser and not `xml2js` / `svgo` / DOMParser?
 * --------------------------------------------------------------------------
 * The source SVGs are intentionally formatted to a strict quality bar (see
 * docs/brand/icons/README.md §"Per-icon quality bar"): always 24×24, always
 * `<svg xmlns…>…</svg>`, no `<defs>`, no `<g transform>`, no nested `<svg>`.
 * That makes a regex extractor reliable for this finite, audited input set.
 * If a future contributor introduces a malformed SVG, the regex misses it
 * and the script throws — the error makes the bad input visible at build
 * time rather than at render time.
 *
 * --------------------------------------------------------------------------
 * Failure modes
 * --------------------------------------------------------------------------
 *   - Missing source file → throws with the path that wasn't found.
 *   - Mismatched filename set across the 3 state folders → throws with the
 *     diff (the script enforces parity across `default/`, `active/`,
 *     `disabled/`).
 *   - SVG body extraction fails → throws with the offending path so the
 *     author can re-format the source.
 *
 * Run:
 *   node scripts/build-icon-sprite.mjs       # writes public/icons/sprite.svg
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WEBSITE_DIR = resolve(__dirname, '..');
const REPO_ROOT = resolve(WEBSITE_DIR, '..');
const SOURCE_DIR = resolve(REPO_ROOT, 'docs/brand/icons');
const OUTPUT_PATH = resolve(WEBSITE_DIR, 'public/icons/sprite.svg');

const STATES = /** @type {const} */ (['default', 'active', 'disabled']);

/**
 * Convert `users.svg` → `users`. The filename is already kebab-case (per the
 * quality bar in README); strip extension only.
 */
function nameFromFile(filename) {
  return filename.replace(/\.svg$/, '');
}

/**
 * Extract the children of the root `<svg>` element. Drop the wrapping tag —
 * the sprite's `<symbol>` carries the viewBox attribute, so children go in
 * raw.
 *
 * @param {string} raw - the full file contents
 * @param {string} path - source path (for error messages)
 * @returns {string} the inner XML (children of <svg>)
 */
function extractSvgBody(raw, path) {
  // Match the opening <svg …> tag (any attributes, any whitespace) up to its
  // closing `>`, then capture everything up to `</svg>`. Single-line `/s`
  // flag because SVGs are pretty-printed across many lines.
  const match = raw.match(/<svg\b[^>]*>([\s\S]*?)<\/svg>\s*$/);
  if (!match) {
    throw new Error(
      `build-icon-sprite: could not extract <svg> body from ${path}. ` +
        `Is the file well-formed?`,
    );
  }
  return match[1].trim();
}

/**
 * Enforce filename parity across the three state folders. If `default/` has
 * `bell.svg` then `active/` and `disabled/` must too. This catches the
 * "designer added a new icon to one folder but forgot the others" bug class
 * at build time instead of at render time.
 *
 * @returns {string[]} sorted list of icon names (without `.svg`)
 */
async function discoverIcons() {
  const perState = {};
  for (const state of STATES) {
    const dir = join(SOURCE_DIR, state);
    const entries = await readdir(dir);
    perState[state] = entries
      .filter((e) => e.endsWith('.svg'))
      .map(nameFromFile)
      .sort();
  }

  const reference = perState.default;
  for (const state of STATES) {
    const diffMissing = reference.filter((n) => !perState[state].includes(n));
    const diffExtra = perState[state].filter((n) => !reference.includes(n));
    if (diffMissing.length || diffExtra.length) {
      throw new Error(
        `build-icon-sprite: state '${state}' is out of sync with 'default'.\n` +
          (diffMissing.length
            ? `  missing in ${state}: ${diffMissing.join(', ')}\n`
            : '') +
          (diffExtra.length
            ? `  extra in ${state}: ${diffExtra.join(', ')}\n`
            : ''),
      );
    }
  }

  return reference;
}

async function buildSymbol(state, name) {
  const path = join(SOURCE_DIR, state, `${name}.svg`);
  const raw = await readFile(path, 'utf-8');
  const body = extractSvgBody(raw, path);
  // The `<symbol>` viewBox matches the source SVG's 24×24 canvas. We do NOT
  // copy width/height/fill attributes — those belong on the consumer's
  // wrapping `<svg>`, not on the symbol definition (the wrapper sets
  // `className` for size; the symbol carries only artwork + viewBox).
  return `  <symbol id="${state}--${name}" viewBox="0 0 24 24">\n    ${body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n    ')}\n  </symbol>`;
}

async function main() {
  const icons = await discoverIcons();
  console.log(
    `[build-icon-sprite] discovered ${icons.length} icons × ${STATES.length} states = ${icons.length * STATES.length} symbols`,
  );

  const symbols = [];
  for (const state of STATES) {
    for (const name of icons) {
      symbols.push(await buildSymbol(state, name));
    }
  }

  // Header note: every symbol carries its full styling (disc fill, stroke
  // colour, opacity) baked in — the brand barrel does NOT recolour at the
  // wrapper level (per direction §3 "no CSS variables — static assets"). The
  // wrapper passes `className` for sizing only.
  //
  // `xmlns:xlink` is intentionally omitted — modern `<use href>` does NOT
  // need the xlink namespace (Chrome 49+, Firefox 51+, Safari 13+). Per
  // spec §5.6 we target evergreen browsers, so the legacy `xlink:href`
  // fallback would be dead weight.
  const sprite =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!-- Auto-generated by website/scripts/build-icon-sprite.mjs. -->\n` +
    `<!-- Source: docs/brand/icons/{default,active,disabled}/*.svg -->\n` +
    `<!-- Edit the source SVGs, then run \`node scripts/build-icon-sprite.mjs\`. -->\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">\n` +
    symbols.join('\n') +
    `\n</svg>\n`;

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, sprite, 'utf-8');

  const sizeKb = (sprite.length / 1024).toFixed(1);
  console.log(
    `[build-icon-sprite] wrote ${OUTPUT_PATH} (${sizeKb} KB, ${symbols.length} symbols)`,
  );
}

main().catch((err) => {
  console.error('[build-icon-sprite] FAIL:', err.message);
  process.exit(1);
});
