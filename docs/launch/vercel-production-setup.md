# Vercel production project — 10-minute setup runbook

Do this BEFORE the "merge to main" step so production is ready to
receive traffic the moment PR #1 lands. ZDR doesn't need to be active
for this step — but it MUST be active before the merge that follows.

---

## Step 1 — Plan

Vercel **Pro plan** is required for:
- Sydney region (`syd1`)
- 5-minute function maxDuration (Hobby caps at 60s; PDF + normalize routes need more)
- Production-grade analytics

Sign up at https://vercel.com/pricing — Pro is US$20/user/month. Or skip
Pro and accept the 60s ceiling on PDF extraction (everything else works
on Hobby).

---

## Step 2 — Create the production project

1. Go to https://vercel.com/new
2. **Import Git Repository** → select `tracy-infinite-leverage/lsl-calculator`
3. **Configure Project**:
   - Framework Preset: **Next.js** (auto-detected)
   - Root Directory: **`website`** ← important; the repo root is the docs layer
   - Build Command: leave as default (`next build`)
   - Output Directory: leave as default
   - Install Command: leave as default
4. **Don't deploy yet** — click Deploy with no env vars first, OR if Vercel insists on env vars, see Step 4 below.

---

## Step 3 — Set the region

Project Settings → Functions → Region → **Sydney (syd1)**

Confirm `vercel.json` is being picked up (it already specifies `syd1`
and the function memory/duration). The project settings should reflect
those values.

---

## Step 4 — Environment variables

Project Settings → Environment Variables

| Name | Value | Environment |
|---|---|---|
| `ANTHROPIC_API_KEY` | (your ZDR-enabled production key, NOT the local one) | Production only |

Do NOT set this for Preview environments — Preview deploys go through
the Anthropic standard tier or get the same key, your call. Safer to
have a separate Preview-only key under standard tier so any preview
testing never accidentally uses production budget.

---

## Step 5 — Domain mapping

Project Settings → Domains → Add Domain

Suggested production hostname options:

- `lsl.austpayroll.com.au` (subdomain on your existing brand) — recommended
- `nsw-lsl-calculator.com.au` (standalone)
- `lsl-calculator.com.au` (standalone, shorter)

Vercel will give you a DNS record (CNAME for subdomain; A record for apex).
Add it at your domain registrar. Propagation ~5 min for subdomain;
~30 min for apex.

---

## Step 6 — Don't merge yet

Vercel will deploy on every push to `main`. Until ZDR is confirmed
active, leave PR #1 unmerged. The LAUNCH-GUARD in `docs/launch/LAUNCH-GUARD.md`
spells out the verification step before the merge.

If you accidentally merge before ZDR is active:
1. Immediately set `NEXT_PUBLIC_PDF_EXTRACTION_ENABLED=false` in
   Vercel env vars (after we wire the feature flag).
2. OR temporarily edit `/privacy` to remove the no-retention claim.
3. Revert in `main` and force-redeploy.

(None of this is needed if you follow the guard.)

---

## Step 7 — Confirm Vercel is ready

Once Steps 1–5 are done, ping the dev agent: "Vercel ready."

That tells me:
- Project exists
- Sydney region
- ZDR-enabled key in Production env
- Domain mapped
- DNS resolves

Then we just need ZDR active. When you get the Anthropic ZDR confirmation,
say "merge time" and the cutover sequence runs (LAUNCH-GUARD verify → PR
to ready-for-review → final gate → merge by you → Vercel auto-deploys →
first-hour watch).
