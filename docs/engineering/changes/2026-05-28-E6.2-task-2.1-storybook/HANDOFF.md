# HANDOFF — E6.2 Task 2.1: Install Storybook + axe-core add-on

**Date:** 2026-05-28
**Branch:** `feat/E6.2-task-2.1-storybook` (cut from `origin/main` at `5d0eead`)
**Spec:** `.specify/features/006-ui-design-system/spec.md` v0.4
**Plan:** `.specify/features/006-ui-design-system/impl-plan.md`
**Task:** `.specify/features/006-ui-design-system/tasks.md` — Task 2.1
**Phase 0 governing decision:** PD-3 (Storybook 8, no Chromatic, official Next.js framework preset)
**Author:** developer agent (Claude Opus 4.7)
**Hands off to:** QA agent

---

## Scope delivered

Task 2.1's four acceptance criteria, in plain English:

1. ✅ `website/.storybook/main.ts` + `preview.ts` committed
2. ✅ Tailwind imported into the Storybook preview
3. ✅ axe-core add-on (`@storybook/addon-a11y`) configured
4. ✅ `npm run storybook` boots without errors and serves on `http://localhost:6006`

Plus the housekeeping the prompt called for:

- `storybook` + `build-storybook` npm scripts added to `website/package.json`
- `website/storybook-static/` added to repo root `.gitignore`
- `storybook-static/**` added to `website/eslint.config.mjs` ignore list (defensive, in case a future contributor commits a stray build before realising)
- One `stories/Welcome.mdx` placeholder so Storybook serves something instead of an empty catalogue (no component stories yet — those start at Task 2.2 / 2.5 / 2.6)

Nothing else. No tokens, no shadcn variants, no icon barrel, no brand-asset sync, no engine changes, no `tests/` modifications.

---

## Decisions made inline (with rationale)

### D1 — Package manager: **npm**

Lockfile at `website/package-lock.json` is the source of truth. No `pnpm-lock.yaml` or `yarn.lock` anywhere in the tree. Stayed on npm; ran `npm install --save-dev …` for every package added.

### D2 — Storybook framework: **`@storybook/nextjs-vite`** (NOT `@storybook/nextjs`)

The Phase 0 PD-3 decision picked "the official Next.js framework preset". Storybook ships two such presets:

- `@storybook/nextjs` — webpack 5 + SWC (the historical default)
- `@storybook/nextjs-vite` — Vite-based, same Next-aware shims

I had to swap to the Vite path because the webpack/SWC path is incompatible with this project today. Specifically:

1. First attempt with `@storybook/nextjs@9.1.20` booted then crashed compiling `.storybook/preview.ts` with `TypeError: swc.isWasm is not a function` (full trace in §"Verification" below).
2. The crash originates in `@storybook/nextjs/dist/swc/next-swc-loader-patch.js`, which monkey-patches Next.js's SWC loader at runtime. Next 16 removed the `swc.isWasm` symbol from its SWC adapter, so the patch throws as soon as the first `.ts` story-or-config file hits Webpack.
3. Storybook 9.2.0-alpha.3 (the next release in flight) actually *removed* Next 16 from peer deps — confirms the maintainers know about the SWC-API drift and haven't shipped a webpack-path fix yet. The Storybook 10 alpha picks Next 16 back up but it's an alpha; not worth taking a v0 dependency on for a workbench.
4. `@storybook/nextjs-vite@9.1.20` (same minor, Vite builder) declares `next: ^14 || ^15 || ^16` in peer deps, builds without touching the SWC loader patch, and runs cleanly against this project. **Verified booting locally and producing a clean production build.**

The webpack-vs-vite distinction is invisible to story authors. Same MDX, same a11y addon, same controls UI, same `Meta` / `StoryObj` types — only the underlying compiler differs. The downside: `@storybook/nextjs-vite@9.1.20` requires `vite ^5||^6||^7` as a peer, but `vitest@4.1.7` pulls `vite@8`. npm logs that as `invalid: vite@8 ... from @vitest/mocker` — a soft peer-dep warning, not a hard error. Storybook boots and builds in spite of it; the Vite plugin API the framework consumes is the stable surface. Document this here so QA isn't startled by the warning.

### D3 — Storybook version: **9.1.20** (NOT 8.x — escalation from spec)

PD-3 / tasks.md says "Storybook 8". Storybook 8 cannot run on this stack:

- `@storybook/nextjs@8.6.18` (latest 8.x) peer-deps `next: ^13.5.0 || ^14.0.0 || ^15.0.0` — caps at Next 15. This project is on Next 16.2.6.
- React 19.2.4 also predates Storybook 8's `react: ^16 || ^17 || ^18 || ^19.0.0-beta` lower bound (the `-beta` qualifier excludes `19.2.4` in some semver resolvers — npm in this project's case proceeds, but the framework wasn't validated against React 19 stable).

Storybook 9.1.20 is the latest stable release that declares Next 16 + React 19 stable in peer deps. Same product family, same addon catalogue (a11y, docs, themes), same `Meta` / `StoryObj` API surface. Reading PD-3 charitably — the decision was *"use Storybook"* + *"don't use Chromatic"*, with the version number being a snapshot-in-time pick — and bumping to 9 honours both those decisions while making the install actually work. Operator can flag this as a plan deviation if they want it formalised; otherwise this handoff doc is the audit trail.

**Cost guardrail upheld:** Chromatic is NOT installed (PD-3). Storybook 9 ships with `addon-vitest` for component testing as a free in-bundle alternative; not installed in this task either (out of scope).

### D4 — Story discovery glob: `../stories/**/*.{mdx,stories.@(ts|tsx|mdx)}` + `../src/components/**/*.stories.@(ts|tsx|mdx)`

This project keeps source under `website/src/`. The prompt's suggestion was `components/**/*.stories.@(…)`; I adjusted to `src/components/**` because that's where the actual components live.

The `../stories/**` slot is reserved for cross-cutting workbench-level docs (the Welcome MDX lives there today). Component stories will co-locate with their components under `src/components/` from Task 2.5 onward — keeps the story next to the code it documents.

### D5 — Static dir: `../public` (NOT `docs/brand/final`)

Recommendation from the prompt was either `docs/brand/final` (so Storybook can preview brand assets before Task 2.2 wires them into `website/public/brand/`) OR `website/public/` (production parity).

I picked `../public`. Rationale:

- **Production parity.** Storybook resolves `/brand/wordmark.svg` exactly the same way Next.js does in production. No off-by-one drift between workbench and live app.
- **Task 2.2 ownership.** The brand-asset sync is `scripts/sync-brand-assets.{ts,sh}` invoked from `prebuild`. Pointing Storybook at `docs/brand/final/` would create a second consumer of brand assets that the sync script doesn't know about — exactly the kind of subtle drift the spec is trying to avoid.
- **Empty-public risk is small.** Today `website/public/` has the Next.js favicon stack only. The brand wordmark won't preview in Storybook until Task 2.2 lands, which is a known temporary state, not a defect.

If a future operator wants to preview brand assets in Storybook before Task 2.2 lands, they can drop a copy in `website/public/brand/` manually — it stays gitignored once Task 2.2 wires the sync script.

---

## Files created / modified

| Path | Status | Purpose |
|---|---|---|
| `website/.storybook/main.ts` | new | Storybook 9 framework config — `@storybook/nextjs-vite`, addons `[addon-docs, addon-a11y]`, story globs, `staticDirs: ['../public']` |
| `website/.storybook/preview.ts` | new | Global preview config — imports `../src/app/globals.css` (Tailwind v4 + LSL tokens), configures axe-core addon (mode `'todo'` until variants land) |
| `website/stories/Welcome.mdx` | new | One-page landing doc so Storybook serves content out-of-the-box; will be the workbench cover page through E6.2 |
| `website/package.json` | modified | Added `storybook` + `build-storybook` scripts; added 4 devDependencies: `storybook`, `@storybook/nextjs-vite`, `@storybook/addon-a11y`, `@storybook/addon-docs` (all pinned `^9.1.20`) |
| `website/package-lock.json` | modified | Lockfile regenerated — net +457 packages from npm |
| `website/eslint.config.mjs` | modified | Added `storybook-static/**` to ignore list so future Storybook builds don't flood lint output |
| `.gitignore` (repo root) | modified | Added `website/storybook-static/` so the prod Storybook bundle never gets accidentally committed |

Nothing under `docs/`, `.specify/`, `scripts/`, `tests/`, or `e2e/` was touched.

---

## Install outcome

```
npm install --save-dev storybook@9.1.20 @storybook/nextjs@9.1.20 \
  @storybook/addon-a11y@9.1.20 @storybook/addon-docs@9.1.20
# → added 457 packages, changed 15, audited 1002. 8 vulns (6 low, 2 moderate).
# All vulns are transitive dev-only — rimraf@3, inflight@1, glob@7 noise.

npm uninstall @storybook/nextjs    # after the SWC.isWasm crash
npm install --save-dev @storybook/nextjs-vite@9.1.20
# → final tree: 4 Storybook devDependencies at 9.1.20.
```

Lockfile diff: ~+10–15k lines (large — Storybook is a heavy install). All under `node_modules/` / new lockfile entries; no source-code drift outside the files listed above.

**Peer-dep warnings worth noting** (none blocking):

- `vite@8.0.14` is "invalid" for `@vitest/mocker` (wants `^5||^6||^7-0`). Pre-existing — vitest 4 already had this against itself.
- `next: ^14 || ^15 || ^16` constraint on `@storybook/nextjs-vite` matches our `next@16.2.6` cleanly.
- `react@19.2.4` satisfies the `^19.0.0-beta` lower bound in 9.1.20 (npm resolves prereleases as `>= 19.0.0-beta-0`).

No vulnerabilities introduced in production runtime dependencies.

---

## Verification performed

| Check | Method | Result |
|---|---|---|
| Storybook dev server boots | `npm run storybook -- --no-open --quiet`, then `curl http://localhost:6006/` | **HTTP 200**. Process running. Iframe endpoint also returns the standard Storybook shell. |
| a11y addon registered in the manager bundle | `curl http://localhost:6006/index.html` | Manager loads `./sb-addons/a11y-2/manager-bundle.js` (alongside `docs-1/manager-bundle.js`) — confirms the A11y panel will appear in the UI. |
| Stories index populated | `curl http://localhost:6006/index.json` | `{ "welcome--docs": { … "type": "docs" … } }` — Welcome MDX picked up by the glob. |
| Production Storybook build | `npm run build-storybook` | **Built in 2.09s**. Output in `storybook-static/`. `assets/axe-Drh8xT8g.js` (583kB) proves axe-core is bundled. `storybook-static/` deleted afterwards. |
| LSL test suite (SC-7) | `npm test` | **2304/2304 tests passed in 43 files** (note: spec referenced 2214; the suite has grown since spec date — baseline is whatever was green on `main`, which is 2304/2304). |
| ESLint clean on new files | `npm run lint \| grep -E "(\.storybook\|stories/Welcome)"` | **Zero matches.** None of my new files generate lint errors or warnings. Pre-existing 1,615 baseline issues unchanged. |
| Initial webpack/SWC failure (documented) | `@storybook/nextjs@9.1.20` boot | `TypeError: swc.isWasm is not a function` in `./.storybook/preview.ts`. Root cause: Next 16 SWC API drift. Resolution: swap to `@storybook/nextjs-vite`. Documented in D2. |

I did **not** run Playwright. The 92-test E2E suite needs a Next.js dev server, and the prompt is explicit: don't run servers — let the QA agent handle E2E verification on Vercel. Task 2.1 acceptance criteria don't require an E2E run.

---

## Acceptance criteria for QA

Per Task 2.1 (PD-3):

- [ ] **AC1:** `website/.storybook/main.ts` + `preview.ts` are committed and parse without errors.
- [ ] **AC2:** Tailwind is imported into the Storybook preview (`preview.ts` imports `../src/app/globals.css`).
- [ ] **AC3:** axe-core add-on (`@storybook/addon-a11y`) is configured and the A11y panel appears in the Storybook manager UI.
- [ ] **AC4:** `npm run storybook` boots without errors and serves a page at `http://localhost:6006`.

Plus regression guards QA should run:

- [ ] **R1:** `npm test` returns **2304/2304 passed in 43 files** (the same number that was green on `main` at branch-cut). Engine is untouched.
- [ ] **R2:** `npm run build-storybook` exits 0 and produces a `storybook-static/` directory containing `iframe.html`, an `assets/axe-*.js` chunk, and a `welcome--docs` story.
- [ ] **R3:** `git diff origin/main -- 'website/src/**' 'tests/**' 'website/e2e/**'` is **empty** (Task 2.1 must not touch app source, the engine test corpus, or the E2E suite).
- [ ] **R4:** ESLint emits no NEW errors or warnings against `.storybook/**` or `stories/**` (baseline numbers may match, but the new files contribute zero).

How to run them in order:

```bash
cd /Users/tracyangwin/code-projects/lsl-calculator/website
npm test                              # R1
npm run build-storybook && rm -rf storybook-static    # R2 (clean up after)
npm run storybook -- --no-open        # AC4 — Ctrl-C to stop
git -C .. diff origin/main -- 'website/src/**' 'tests/**' 'website/e2e/**'   # R3
npm run lint 2>&1 | grep -E "(\.storybook|stories/Welcome)"                   # R4 (expect empty)
```

For AC3 specifically: with the dev server running, open `http://localhost:6006`, click into the Welcome doc, and confirm the **A11y** tab is visible in the addons panel at the bottom of the screen. Mode is currently `'todo'` (informational), so violations won't fail anything yet — that flips per-component from Task 2.6 onward.

---

## Known risks / follow-ups (NOT for this task)

1. **Storybook + Tailwind v4 + dark mode.** The project's `globals.css` includes a `@media (prefers-color-scheme: dark)` block. If the operator's OS is in dark mode, Storybook's Welcome doc may render against dark tokens. Spec §5.8 deferred dark mode to v1.1+; if this is jarring for the operator review, add a Storybook background-color toolbar in a follow-up.
2. **Vite version peer warning.** `vite@8` vs Storybook's `^5||^6||^7` peer is benign today but could break on a Storybook minor bump. Pin Storybook explicitly in `package.json` (`"storybook": "9.1.20"` instead of `"^9.1.20"`) if QA wants belt-and-braces — out of scope for this task, flagging for future hardening.
3. **Vulnerabilities in transitive deps.** `rimraf@3`, `glob@7`, `inflight@1` — all from Storybook's tree, all dev-only, none reachable from production code. Acceptable until the next Storybook minor.
4. **`@storybook/nextjs-vite` is the right framework today; revisit at every Storybook upgrade.** If Storybook 10 ships with `@storybook/nextjs` fixed for Next 16, we can swap back to the webpack path with a one-line change in `main.ts`. Not urgent.

---

*End of HANDOFF. QA agent: write `QA-REPORT.md` in this folder. Developer agent: do not commit until QA signs off.*
