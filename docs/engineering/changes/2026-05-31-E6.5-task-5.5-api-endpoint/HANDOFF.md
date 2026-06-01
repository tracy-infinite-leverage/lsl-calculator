# Task 5.5 — POST /api/reports/[family] endpoint (auth-posture split) — HANDOFF

**Date**: 2026-05-31
**Branch**: `feat/E6.5-5.5-api-endpoint`
**Spec**: `.specify/features/006-ui-design-system/spec.md` v0.5 — §5.3, §5.4, §5.7, §8.5, OQ-6
**Impl-plan**: `.specify/features/006-ui-design-system/impl-plan.md` §1.3 (load-bearing — resolves G-1)
**Task**: `.specify/features/006-ui-design-system/tasks.md` lines 631-660 (Task 5.5, size L)
**Predecessors**: Tasks 5.1–5.4 (PRs #129 / #130 / #132 / #133)

---

## What shipped

Three new files under `website/`:

1. **`src/lib/pdf/families.ts`** — report-family registry. Exports:
   - `type ReportFamily = 'single-employee' | 'bulk-summary' | 'liability' | 'reconciliation'`
   - `FAMILY_POSTURE: Record<ReportFamily, 'public' | 'authenticated'>` — the load-bearing OQ-6 contract
   - `KNOWN_FAMILIES: ReadonlyArray<ReportFamily>` — derived from posture-map keys (lockstep)
   - `isKnownFamily(value: string): value is ReportFamily` — `hasOwnProperty.call` guard so prototype keys (`toString`, `__proto__`, etc.) are rejected.

2. **`src/app/api/reports/[family]/route.ts`** — the POST handler. Single export `POST` + `export const runtime = 'nodejs'` (react-pdf is Node-only). Branches in this order:
   1. `await ctx.params` (Next.js 16 async params)
   2. `isKnownFamily()` — 400 `unsupported-family` if not (no Supabase touched)
   3. `FAMILY_POSTURE[family]` lookup
   4. **CRITICAL: if posture === 'authenticated', call `createSupabaseServerClient()` + `getUser()`** — 401 if no user, 500 with requestId if Supabase throws
   5. Parse + Zod-validate the JSON body — 400 `invalid-payload` on failure
   6. Template dispatch (TODO comment marks the Task 6.1/6.2/E5.5/E5.6 hook) — returns 501 `template-not-shipped` today

3. **Tests** — two co-located vitest files:
   - `src/lib/pdf/__tests__/families.test.ts` — 12 tests, posture map + `isKnownFamily` + prototype-pollution guard
   - `src/app/api/reports/[family]/route.test.ts` — 17 tests covering every status code + the load-bearing OQ-6 invariant (public families NEVER call `createSupabaseServerClient`)

**Total: 29 new tests, all passing.** Full suite: 3094 pass / 32 skipped (no regressions).

---

## The load-bearing OQ-6 / G-1 contract

The posture split is the entire reason this task is sized L. The handler MUST branch on `family` BEFORE touching Supabase or cookies — public-calc PDFs (Phase 5a) ship independently of E5.1's merge to `main`.

**Implementation site:** `website/src/app/api/reports/[family]/route.ts:155-158`

```ts
const family: ReportFamily = rawFamily;
const posture = FAMILY_POSTURE[family];

// 3. ── CRITICAL: branch on posture BEFORE touching Supabase ────────────
if (posture === 'authenticated') {
  // ... createSupabaseServerClient() + getUser() ...
}
// Public families fall straight through here without touching Supabase.
```

**Test invariant:** `src/app/api/reports/[family]/route.test.ts:114-118` asserts:

```ts
await POST(makeRequest('single-employee'), makeCtx('single-employee'));
expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
expect(getUserMock).not.toHaveBeenCalled();
```

The same invariant is asserted for `bulk-summary`. If a future refactor accidentally hoists the auth check above the family branch, this test fails LOUD.

---

## Status codes (the matrix)

| Status | Body                                            | Trigger                                    |
|--------|-------------------------------------------------|--------------------------------------------|
| 200    | `application/pdf` (streamed)                    | NOT EXERCISED YET — templates land 6.1/6.2 |
| 400    | `{ error: 'unsupported-family' }`               | unknown `family` URL segment               |
| 400    | `{ error: 'invalid-payload' }`                  | invalid JSON or Zod failure                |
| 401    | `{ error: 'unauthorized' }`                     | authed family + no Supabase session        |
| 500    | `{ error: 'render-failure', requestId: string }`| Supabase auth lookup throws                |
| 501    | `{ error: 'template-not-shipped' }`             | recognised family — every family today     |

**Why 501 for valid requests today:** templates have not been wired. The dispatch instructions explicitly noted "today: 501 template-not-shipped; will flip to 200 in Tasks 6.1/6.3 (public) and E5.5/E5.6 (authed)". Status 501 lets the Task 5.5-bis contract test verify posture without needing a real PDF to exist yet.

`requestId` is a `crypto.randomUUID()` v4 — asserted by regex in the test.

---

## Zod schema shape

```ts
const reportRequestSchema = z.object({
  context: z.object({
    reportTitle: z.string().min(1),
    generatedAtIso: z.string().min(1),
    organisationName: z.string().optional(),
    calcMethodologyVersion: z.string().min(1),
    stateEngineVersion: z.string().min(1),
    dataAsAtIso: z.string().min(1),
    apaContact: z.object({
      email: z.string().min(1),
      url: z.string().min(1),
    }),
  }),
  payload: z.unknown(),
});
```

`context` is validated structurally to match `ReportContext` from `@/lib/pdf/types`. `payload` is `unknown` at this layer — each family-specific template (Tasks 6.1 / 6.2 / E5.5 / E5.6) narrows it with its own schema before rendering. Doing per-family narrowing inside the template, not here, keeps the route handler decoupled from individual template shapes.

---

## Auth-first ordering for authenticated families

The handler validates `family` FIRST (unknown → 400), THEN auth-checks (no session → 401), THEN body-parses + Zod-validates. The order matters for two reasons:

1. **Public families never reach the auth step.** This is the OQ-6 contract.
2. **Authenticated families don't waste cycles on body parsing for unauth requests.** A 401 response should fire before we materialise the JSON body.

The test `does NOT process the body if auth fails (auth-first ordering)` (route.test.ts:251) sends a body that would fail Zod validation to `/api/reports/liability` with no session — it asserts the response is 401, NOT 400.

---

## Where Task 6.1 / 6.2 / E5.5 / E5.6 plug in

`website/src/app/api/reports/[family]/route.ts` lines 233-247 carry the TODO block:

```ts
// TODO Task 6.1 / 6.2 / E5.5 / E5.6: wire template lookup here.
//   const Template = FAMILY_TEMPLATE[family]; // (context, payload) => ReactElement
//   const element = Template(_context, _payload);
//   const buffer = await renderToBuffer(element);
//   logReportRequest({ event: 'report-rendered', family, requestId, posture, outcome: 'ok' });
//   return new NextResponse(new Uint8Array(buffer), {
//     status: 200,
//     headers: {
//       'Content-Type': 'application/pdf',
//       'Content-Disposition': `attachment; filename="${family}.pdf"`,
//       'Cache-Control': 'no-store',
//     },
//   });
```

The `_context` and `_payload` locals are already in scope and Zod-narrowed at this point — Task 6.1 / 6.2 / E5.5 / E5.6 just need to:

1. Add a `FAMILY_TEMPLATE: Record<ReportFamily, (ctx, payload) => ReactElement>` map in `families.ts`
2. Replace the TODO block with the dispatch + render
3. Per-family payload Zod schema lives inside the template module, not here

The Supabase MCP confirms the audit-log table (`pdf_render_audit` or similar) is E5.4 scope — not in scope for this PR. The `logReportRequest()` helper today is `console.info` only (Vercel function logs).

---

## PII / tenant-data discipline (spec §5.7)

The `logReportRequest()` helper logs:

```json
{"event":"report-failed","family":"liability","requestId":"abc-123","posture":"authenticated","outcome":"unauthorized"}
```

Note what is NOT logged: payload contents, employee names, employee IDs, payroll figures, organisation IDs. The only identifying field is `family` (one of four spec-locked strings) + `requestId` (random UUID per-request). The handler also never logs the JSON body verbatim, even on validation failure — Zod errors are converted to `{ error: 'invalid-payload' }` without the field list.

If Phase 5a/5b ever needs richer audit, the row goes into E5.4's table — not into the operational log line. **PII never leaves the Vercel function.**

---

## Local gates — all clean

| Gate                                      | Result                              |
|-------------------------------------------|-------------------------------------|
| `npx tsc --noEmit`                        | clean                               |
| `npm run test`                            | 3094 pass / 32 skipped (no regress) |
| `npm run build`                           | clean (route shown as `ƒ` dynamic)  |
| `audit-bundle` (postbuild)                | PASS — no external origins          |
| `eslint` (files touched)                  | clean                               |
| `npx playwright test --project=chromium`  | 24 pass / 1 skipped (preexisting)   |

The route appears in the build output at `ƒ /api/reports/[family]` — confirms the dynamic segment compiled correctly under Next.js 16 conventions.

---

## What's deferred to a separate PR

- **Task 5.5-bis** — the Playwright/integration contract test that locks the posture split at the wire level (`POST /api/reports/single-employee` with no Cookie → 200 + `application/pdf` once 6.1 ships; `POST /api/reports/liability` with no Cookie → 401 today). Per orchestrator: 1-PR-per-task, this PR ships 5.5 only.
- **Tasks 6.1 + 6.2** — template wiring for `single-employee` + `bulk-summary` (flips 501 → 200).
- **Tasks E5.5 + E5.6** — template wiring for `liability` + `reconciliation`.
- **E5.4 audit log** — currently the route emits a `console.info` line; the real audit row writes into the audit table once E5.4 lands.

---

## Files changed

NEW:
- `website/src/lib/pdf/families.ts` (87 lines)
- `website/src/lib/pdf/__tests__/families.test.ts` (92 lines)
- `website/src/app/api/reports/[family]/route.ts` (267 lines)
- `website/src/app/api/reports/[family]/route.test.ts` (293 lines)
- `docs/engineering/changes/2026-05-31-E6.5-task-5.5-api-endpoint/HANDOFF.md` (this file)

No files modified. Strict additive PR.

---

## QA notes for the next agent

1. **Posture invariant is the load-bearing assertion.** If you regress the order of checks (auth before family check) you will silently break OQ-6.
2. **The Supabase mock is structural.** `createSupabaseServerClientMock` is the factory itself — `not.toHaveBeenCalled()` is the OQ-6 guard.
3. **Don't add field-level validation to `payload`.** That belongs in the per-family template module, not here.
4. **`runtime = 'nodejs'` must stay.** react-pdf can't run on Edge — drop this and the Phase 5a render path will fail at request time.
