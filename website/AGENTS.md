<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

**Auth-slice-specific (E5.1):** Next.js 16 renamed `middleware.ts` → `proxy.ts` (Node.js runtime; exported function name `proxy`). The auth plan ([.specify/features/005-lsl-platform/sub-specs/auth-impl-plan.md](../.specify/features/005-lsl-platform/sub-specs/auth-impl-plan.md)) and tasks ([auth-tasks.md](../.specify/features/005-lsl-platform/sub-specs/auth-tasks.md)) reflect this. Before starting Task 5.1/5.2, also skim `node_modules/next/dist/docs/` for any other proxy/cookie API drift vs. the standard Supabase `@supabase/ssr` examples.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:supabase-config -->
# Supabase configuration

The LSL Platform (auth + tenancy + future data tables) runs on Supabase.

| Field | Value |
|---|---|
| Project name | `lsl-platform` |
| Project ref | `woxtujkxatosbirikxtq` |
| API URL | `https://woxtujkxatosbirikxtq.supabase.co` |
| Region | `ap-southeast-2` (Sydney) |
| Plan tier | Pro ($10/month) — required for HIBP breach-list protection |
| Postgres | 17.x (GA release channel) |
| Org | `tracy-infinite-leverage's Org` (`lmprzbyhxbazwrrpdxrt`) |
| Dashboard | https://supabase.com/dashboard/project/woxtujkxatosbirikxtq |
| Provisioned | 2026-05-26, status `ACTIVE_HEALTHY` confirmed Task 3.1 |

## Env vars

Three vars are needed by the auth slice (E5.1). Placeholders live in `website/.env.example`; real values go in `.env.local` (gitignored) and in Vercel Production + Preview + Development — **wired on 2026-05-27 (Task 3.3)**. See `docs/engineering/vercel-config.md` for the full env-vars table.

- `NEXT_PUBLIC_SUPABASE_URL` — public, the project API URL above.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public, RLS is the security boundary.
- `SUPABASE_SERVICE_ROLE_KEY` — **server-side only**. Bypasses RLS. Never log, commit, or expose to the browser. Used by the `purge-expired-orgs` Edge Function and (in-database, via `SECURITY DEFINER`) by the `handle_new_user` trigger.

## MCP

Two Supabase MCPs are configured:
- **Account-scoped**: `mcp__2ac7599f-...` — bound to Tracy's account, can list/manage all projects. **Use this** for migrations, SQL execution, edge function deploys, advisor checks on the `lsl-platform` project. Pass `project_id=woxtujkxatosbirikxtq` (or `id=`) explicitly.
- **Project-scoped**: `mcp__supabase__*` — still bound to a stale ref (`jmicqilfcphneioemwjo`). Reconfigure to `woxtujkxatosbirikxtq` before relying on it for client wiring.

## Hard rules

- `.env*` is in `website/.gitignore`. Never override.
- The service-role key only ever lives in (a) Vercel env (Production / Preview), (b) the developer's local `.env.local`, (c) the Supabase Edge Function runtime env. Nowhere else.
- All DDL changes go through `website/supabase/migrations/` (forward-only). No ad-hoc dashboard edits to schema.
- Run `mcp__supabase__get_advisors` (security + performance) after every DDL change.
<!-- END:supabase-config -->
