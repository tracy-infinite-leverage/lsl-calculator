# LAUNCH GUARD — read before any production cutover action

This file gates the production cutover. Any agent (or human) acting on a
"merge time", "cut over", "go live", or "ship it" signal MUST work through
this guard first. No exceptions.

---

## Hard gate — `ANTHROPIC_API_KEY` in Vercel Production env

The Vercel production project (`lsl-calculator` on team
`infiniteleverage-2`) exists but does NOT yet have an
`ANTHROPIC_API_KEY` set in the Production environment. Without it,
`/api/extract-pdf` and `/api/normalize-csv` will return 503 in
production and customers can't use the PDF / auto-normalised-CSV paths.

Before any merge to `main` that would deploy:

1. Get a production API key from https://console.anthropic.com (this
   key may be on Anthropic's standard tier — ZDR is a nice-to-have, not
   a blocker; the privacy notice has been updated to match the standard
   tier's published terms).
2. Set it in Vercel via either:
   - **Recommended**: ask the dev agent to run
     `vercel env add ANTHROPIC_API_KEY production` and paste the key
     into the interactive prompt. The key disappears from the terminal
     after submission. It briefly appears in chat scrollback — rotate
     the Anthropic key after launch as standard hygiene if you'd like.
   - Or: paste it via the Vercel dashboard → Settings → Environment
     Variables → Production only.
3. Trigger a preview redeploy (push any commit) and curl
   `/api/normalize-csv` on the resulting preview URL to confirm the
   key works (expect 200 with a spec, not 503).

**Do NOT use the local-dev key** (the one in `website/.env.local`)
for Production unless you have specifically decided they should be
the same. Best practice: separate keys per environment so revoking
either doesn't affect the other.

---

## Soft gate — DNS for `lsl.austpayroll.com.au`

The domain is mapped to the Vercel project but DNS isn't pointing
there yet. Without DNS:

- The merge still works.
- The Vercel-issued URL (`lsl-calculator.vercel.app`) is live and
  serves the site.
- `lsl.austpayroll.com.au` will not resolve until you add the A
  record at Cloudflare: `A lsl 76.76.21.21` (TTL: 5 min recommended).

You can launch without this and add the DNS record any time. The
cutover isn't "complete" until the intended production URL resolves,
but it's not a hard gate.

---

## What changed (history note)

Earlier versions of this guard had a second hard gate requiring
Anthropic Zero Data Retention to be active before launch. That gate
was removed 2026-05-23 after the privacy notice and data-handling
policy were updated to accurately reflect Anthropic's standard
commercial terms (no training on customer data, up to 30 days
retention for service operation and abuse monitoring). When ZDR does
land, update both docs and you may strengthen the disclosure.

---

## Why this guard exists

Persistent reminder because chat sessions get compacted and prior
agreements can be lost. Treat this file as load-bearing — any agent
seeing a cutover signal reads this first.
