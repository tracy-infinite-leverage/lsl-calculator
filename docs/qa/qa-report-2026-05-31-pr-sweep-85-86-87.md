# QA Sweep — PRs #85, #86, #87 — 2026-05-31

**Sweep run by:** product-manager agent (operating in QA-sweep mode per operator instruction "execute" on 2026-05-31 standup decisions)
**Reason for combined sweep:** Operator decision 4 — route the three open E6.2 follow-up PRs to a single QA pass before merge cascade, instead of merging as-is. Worktree-isolated. **Do NOT auto-merge; bring results back.**

---

## Verdict at a glance

| PR | Title | Verdict | Notes |
|---|---|---|---|
| **#85** | docs(E6.2): align alert.tsx doc-comment with shipped cva variants | ✅ **PASS** | Pure doc-comment drift fix. Comment now matches `alert.tsx` cva variant set. No code or behaviour change. Ship as-is. |
| **#86** | fix(E6.2): mount Sonner Toaster in app shell | ✅ **PASS** | `<Toaster />` correctly mounted inside `<body>` in `app/layout.tsx`; import path `@/components/ui/toast` resolves to the brand wrapper. New invariant test `app/layout.test.ts` runs **2/2 green locally** (78ms). Test is a source-text invariant (documented rationale: `next/font/local()` resolves only under the Next build pipeline, so a real render test would crash in bare vitest). |
| **#87** | docs(E6.2): land Sonner + Task 2.8 sequencing notes in tasks.md | ✅ **PASS w/ cosmetic nit** | Two doc-only edits to `.specify/features/006-ui-design-system/tasks.md`. Both are accurate against shipped reality. **Nit:** new AC bullet refers to `components/ui/Toast.tsx` (capital T) but the file is lowercase `toast.tsx`. The "(or equivalent)" hedge in the same bullet makes it semantically satisfied. Fixable in a tiny follow-up if strict casing is wanted. **Not a merge blocker.** |

**Sweep recommendation: merge #85 → #87 (after rebase) → #86 (after rebase).** No code regression observed; no blockers found.

---

## Per-PR detail

### PR #85 — `fix/E6.2-alert-comment-drift` → `main`

**Scope:** 1 file changed, 6 additions / 7 deletions on `website/src/components/ui/alert.tsx`. Comment block only — no code or cva config changes.

**What was claimed (PR body):** The block comment listed `brand-success` and `brand-destructive` as brand variants, but the file's actual `cva` config only ships `brand-info`, `brand-warning`, `brand-advisory`. PR aligns the comment with the code.

**Verification:**
- Diff inspection: comment now lists exactly the three brand variants present in cva (lines 79–95) plus a fall-back note explaining success/destructive intentionally inherit the legacy semantic variants.
- All references to `brand-success` and `brand-destructive` are removed; no orphan token-consumption notes left behind.
- Existing CI on the PR (TypeScript · Vitest · Build, state-matrix × 8, Playwright × 4 browsers, Cross-state, Test-sanctity): **all green**.

**Risk:** zero. Comment-only change; cannot break consumers.

**Verdict: ✅ PASS — ship as-is.**

### PR #86 — `fix/E6.2-mount-toaster-app-shell` → `main`

**Scope:** 2 files. New `website/src/app/layout.test.ts` (54 lines added). Modified `website/src/app/layout.tsx` (9 lines added).

**What was claimed (PR body):** Mounts the Sonner brand `<Toaster />` in the root layout's `<body>`. Adds a vitest invariant test that the mount cannot be silently deleted by a future refactor.

**Verification:**
- `layout.tsx` diff inspected: new import `import { Toaster } from '@/components/ui/toast';`; `<Toaster />` rendered inside `<body>` after `<Analytics />` and `<SpeedInsights />`. Comment block above the mount explains why (PR #84 follow-up — without the mount every `toast()` call no-ops).
- Brand wrapper file exists at `website/src/components/ui/toast.tsx` (line 195 exports `{ Toaster, toast }`). Import path resolves.
- `layout.test.ts` inspected. Two assertions: (1) import statement present; (2) `<Toaster />` JSX element present inside `<body>`. Source-text invariant rather than render — rationale documented in the file's leading block comment (`next/font/local()` and `next/font/local` calls during module load only resolve inside the Next.js build pipeline; bare vitest would throw). Storybook a11y stories provide the actual render-behaviour coverage per spec §5.5.
- **Ran locally**: `npx vitest run src/app/layout.test.ts` → **2 passed in 78ms**.
- Existing CI on the PR (`TypeScript · Vitest · Build`, state-matrix × 8, Playwright × 4 browsers, Cross-state, Test-sanctity): **all green** (this test ran as part of CI Vitest job and passed there too).

**Risk:** very low. The mount sits at the root of the layout tree (every `/app/*` route inherits it). The Sonner library is feature-detected — if the wrapper or Sonner itself ever fails to load, the import would throw at module load and the test would catch it. The mount is also covered by an explicit assertion in the new test.

**Verdict: ✅ PASS — ship as-is. (Note: branch is BEHIND main; will need a `git rebase origin/main` before merge button is available.)**

### PR #87 — `docs/E6.2-tasks-md-reconcile` → `main`

**Scope:** 1 file changed, 3 additions / 2 deletions on `.specify/features/006-ui-design-system/tasks.md`.

**What was claimed (PR body):** Two narrative reconciliations:
1. Task 2.6 description gains a Sonner-substitution note ("Toast (Sonner — adopted 2026-05-30 per operator decision; shadcn deprecated original Toast in favour of `sonner` library)") and a new AC bullet: "Toast variant wraps `sonner` library; brand wrapper at `components/ui/Toast.tsx` (or equivalent) with at least one Storybook story".
2. Task 2.8 gains a sequencing note: "this task formally closes when Task 2.6 closes (so all 16 components are covered by the axe E2E sweep). Infra ships with PR #65 (2026-05-28); status stays ⚠️ partial / 🔄 in flight until 2.6 ✅."

**Verification:**
- Sonner adoption is real: `npm ls sonner` → `sonner@2.0.10` is in `website/package.json`'s dependency tree (verified via brand wrapper presence at `src/components/ui/toast.tsx` which imports from `sonner`).
- Wrapper file exists at `website/src/components/ui/toast.tsx` (**lowercase t**). The PR's new AC bullet text says `components/ui/Toast.tsx` (**capital T**) with an "(or equivalent)" hedge. macOS filesystem is case-insensitive so both paths resolve locally; Linux CI is case-sensitive so the actual import paths must (and do) use lowercase. **Nit only** — semantically satisfied by "(or equivalent)"; tighten to lowercase in a tiny follow-up if strict casing is wanted in spec text.
- Task 2.8 sequencing claim is accurate against current state: Task 2.8 infra shipped in PR #65 (CSP + bundle audit + extended a11y route coverage), and Task 2.6 closed across PRs #61/#63/#64/#66/#79/#80/#81/#82/#84 — so the rule "2.8 closes when 2.6 closes" describes the now-historical sequencing correctly.
- Existing CI on the PR: **all green**.

**Risk:** zero. Doc-only change to `.specify/`; not on the test-sanctity guard's protected-paths list.

**Verdict: ✅ PASS with cosmetic nit (Toast.tsx vs toast.tsx). Not a merge blocker. (Note: branch is BEHIND main; will need a `git rebase origin/main` before merge button is available.)**

---

## Sweep methodology

- Each PR's diff was inspected against `f45e8ce` (current `main` tip).
- Where executable code changed (PR #86), I ran the new test locally via `npx vitest run` in `website/`.
- Where doc claims could be cross-referenced against shipped code (PR #87), I verified file paths and the Sonner dependency presence on disk.
- Worktree isolation: temp worktrees at `/tmp/lsl-qa-85` and `/tmp/lsl-qa-87` were used and removed; PR #86 was inspected on the active `fix/E6.2-mount-toaster-app-shell` checkout (the branch is itself this PR). No locked agent worktrees were touched. No stray commits made in any worktree.
- `git diff` and `git branch --show-current` were re-checked between each PR. The main checkout's uncommitted `ci.yml` (a stale local timeout-bump now redundant on main via PR #89) and the untracked plan/standup files were untouched throughout.

## Operator action

Bring this to the operator. Recommended cascade once approved:

1. **Merge PR #85** — green, ship as-is. No rebase needed (it's based on a recent main).
2. **Rebase + merge PR #87** — green, doc-only, optional cosmetic nit. Cosmetic nit can be addressed in a tiny follow-up commit before merge if strict casing is wanted (`components/ui/Toast.tsx` → `components/ui/toast.tsx`).
3. **Rebase + merge PR #86** — green, ships the actual operator-visible behaviour (toast notifications working in the live app).

PR #83 (CSP smoke split) is **independent** of this cascade and is running its own CI now (the `test` job already went **SUCCESS** post-split — first time since the smoke step was added).

---

*Generated by product-manager agent during 2026-05-31 standup execution phase.*
