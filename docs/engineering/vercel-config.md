# Vercel configuration

Per tasks.md §6.6 / D-OQ7. Lives at `website/vercel.json`.

## What's configured

### Region: `syd1` (Sydney)

Target audience is Australian payroll teams. Sydney region:

- Cuts latency for the dominant traffic source
- Keeps data resident in Australia for the non-Anthropic codepath (CSV-only / form-only). PDF extraction still transits to Anthropic in the US — that's disclosed in the privacy notice.

Vercel charges the same for Sydney as US regions on Pro plans. Hobby/Free plans may not offer `syd1` — owner to confirm the deploy plan before cutover (likely Pro for production).

### Function memory + timeout

```jsonc
"functions": {
  "src/app/api/extract-pdf/route.ts": { "memory": 1024, "maxDuration": 300 },
  "src/app/api/export-pdf/route.ts":  { "memory": 1024, "maxDuration": 300 }
}
```

#### Memory: 1024 MB

- PDF extraction (`/api/extract-pdf`) loads `pdfjs-dist` server-side and parses up to 200-page documents. The legacy build allocates per-page bitmaps + text-item arrays. 1024 MB is well above the working set we've seen (typical 119-month payroll PDF runs at ~150 MB).
- PDF export (`/api/export-pdf`) uses `@react-pdf/renderer` which streams pages but still holds the layout tree in memory. Bulk-mode 500-employee exports (deferred to Wave 3 of Phase 4 — not in v1) would also be served by this route.
- Default Vercel memory is 1024 MB on Pro plans anyway; this just makes the choice explicit so it survives any future default change.

#### maxDuration: 300 seconds (5 min)

- `vercel.json` sets the function-level ceiling.
- `route.ts` exports its own narrower in-request budget (extract-pdf currently sets `maxDuration = 150`).
- Anthropic Claude on Opus 4.7 with adaptive thinking and structured outputs sometimes takes 60-90s on real payroll PDFs. The 150s in-request timeout absorbs that; the 5-min function-level budget protects against the catastrophic case (Anthropic hung, network blip) without infinite tail latency.

**Plan requirements**: `maxDuration: 300` requires Vercel Pro or higher. Hobby caps at 60s. Owner action before cutover: confirm production deploy is on Pro (it must be, for `syd1` too).

## What's NOT in this config

- **Environment variables.** Set those in the Vercel dashboard, not in vercel.json (per `~/.claude/rules/global-engineering.md` — env var changes get recorded in repo docs, not committed to the file).
- **Domain mapping.** Owner-configured in the Vercel UI.
- **GitHub integration / preview deploys.** Vercel's GitHub app handles that automatically once the project is connected.
- **Build command override.** The default `npm run build` is correct.

## Validation

Vercel validates `vercel.json` on every deploy. The `$schema` directive in the file enables IDE autocompletion + warnings. A malformed config blocks the deploy with a clear error message; no separate test step is needed.

## Pre-cutover checklist

- [ ] Vercel production project on Pro plan (or Enterprise)
- [ ] Production region confirmed as `syd1`
- [ ] `ANTHROPIC_API_KEY` set in Production environment (no-retention tier key)
- [ ] Domain mapped (e.g. `lsl.austpayroll.com.au` or chosen production URL)
- [ ] Branch protection on `main` requires `test` + `playwright` CI checks (see `ci.md`)
