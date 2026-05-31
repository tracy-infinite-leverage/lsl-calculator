# QA Report — E6.3 Task 3.3-bis (`SessionCookieClaims`)

**PR**: [#98](https://github.com/tracy-infinite-leverage/lsl-calculator/pull/98) — `feat/E6.3-3.3-bis-session-claims` → `main`
**Reviewer**: QA agent (read-only; no code mutations)
**Date**: 2026-05-31
**Spec**: `.specify/features/006-ui-design-system/spec.md` §5.2 (OQ-9) · impl-plan §1.1 decision 4 · tasks.md lines 315–329 (resolves G-2)
**Verdict**: **PASS — mergeable as-is**

---

## 1. Scope of review

A single new file, `website/src/lib/auth/session-claims.ts` (+137 / -0), establishing a TypeScript type-only contract for the session-cookie claim payload shared between E5.1 (cookie writer) and E6.3 (cookie reader). No runtime code, no test file, no other paths touched.

## 2. Acceptance criteria — verification matrix

| # | Criterion (tasks.md 315–329) | Result | Evidence |
|---|---|---|---|
| AC-1 | Interface shape: `{ activeTenantId: string; homeTenantId: string; membershipCount: number; claimIssuer: 'supabase-e5.1' }` | **PASS** | File lines 84–137 declare exactly these four fields with the spec-mandated types, in the spec-mandated order. The discriminator is a string-literal union (`'supabase-e5.1'`), not bare `string` — typo at writer site fails compile, as recommended in impl-plan §1.1 decision 4. |
| AC-2 | File header documents claim-issuer expectation (Supabase JWT signed by service role) and consumer expectation (E6.3 reads as source of truth on hard refresh) | **PASS** | Lines 1–55 header covers: Purpose (cites §5.2 OQ-9), Claim issuer (Supabase service-role JWT, never client-signed), reader semantics ("E6.3 consumes it as the source of truth on initial render"), and an explicit "writer / reader mutual agreement" section. Above expectation depth. |
| AC-3 | Type is exported and consumable from `lib/tenant-context.tsx` (E6.3, not yet written) and the E5.1 auth module (cross-reference noted in inline comment) | **PASS** | `export interface SessionCookieClaims` (line 84). Cross-references explicitly named in the header (lines 46–55): E5.1 writer sites `src/proxy.ts` + `src/lib/supabase/middleware.ts` (both confirmed present in repo), and E6.3 reader `src/lib/tenant-context.tsx` (not yet present — expected, as it is Task 3.3 itself). |
| AC-4 | No runtime code; type-only contract; single coordinated edit site if shape evolves | **PASS** | Diff-grep of non-comment added lines yields only the `export interface` block — no `function`, `const`, `import`, `class`, or executable statement. Zero bundle impact. Header lines 33–45 explicitly state "no parallel auth-side type or ui-side type — this file is the single source of truth" and codify the mutual-edit rule. |

## 3. Path consistency note (advisory, not blocking)

Spec line 322 names the file `website/lib/auth/session-claims.ts` (no `src/`). The PR correctly ships at `website/src/lib/auth/session-claims.ts`, matching the repo's actual layout (every existing `lib/*` module — `lib/lsl/`, `lib/supabase/`, `lib/observability/`, etc. — lives under `website/src/lib/`, with `@/lib/*` resolving via `tsconfig` paths). The PR adheres to the *repo convention*; the spec text has a minor missing-`src/` typo on line 322 of tasks.md. **Suggested follow-up** (out of scope for this PR): PM agent amends tasks.md line 322 to `website/src/lib/auth/session-claims.ts`. No blocker for merge.

## 4. CI / build state

All checks green at review time (PR `mergeable: MERGEABLE`):

- TypeScript · Vitest · Build — SUCCESS
- CSP header smoke test (Task 2.10b) — SUCCESS
- State suites — nsw, vic, qld, wa, sa, act, engine — all SUCCESS
- Cross-state regression — SUCCESS
- Playwright (chromium · webkit · firefox · mobile-chrome) — SUCCESS
- Test-sanctity guard (spec §5.3 + SC-7) — SUCCESS
- Vercel preview — SUCCESS

No flake, no skipped checks, no protected-path warnings.

## 5. Risk assessment

**Minimal.** Type-only module; no runtime, no UI surface, no API contract change in this PR. The only future risk is shape drift (E5.1 adding a claim without updating this file), and the header explicitly codifies the mutual-edit rule ("any change here is a coordinated cross-epic edit, not a local refactor") plus a fallback strategy (`claimIssuer` discriminator + nullable-guard on reader side).

## 6. Anti-pattern check (qa-best-practices)

- No tests required for a type-only declaration — TypeScript compilation is the verification gate. CI's `npx tsc --noEmit` job covers this. Adding a runtime test here would violate the test-pyramid (no behaviour to test).
- No mock-fest, no implementation-coupling tests, no premature abstraction. The interface stays minimal — four fields, no optional bloat, no transitional aliases.
- Discriminator pattern (`claimIssuer: 'supabase-e5.1'`) is the idiomatic TypeScript approach for tagged-union contracts and supports future issuer migration as a typed string-search refactor rather than a silent semantic change. **Endorsed.**

## 7. Bugs found

None at P0/P1/P2/P3. The advisory note in §3 is a documentation-only nit on tasks.md, not on the shipped code.

## 8. Final recommendation

**PASS — mergeable as-is.** Operator may merge once PR review approval lands. Suggest the PM agent (separately) amends tasks.md line 322 to reflect the `src/` path the repo actually uses; that change is independent and does not gate this PR.

---

**Files touched by this QA pass (docs only):**

- `docs/engineering/changes/2026-05-31-E6.3-task-3.3-bis-session-claims/QA-REPORT.md` (this file)

No code, test, or config files were modified.
