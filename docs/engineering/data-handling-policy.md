# Data-handling policy — LSL Calculator

**Status: DRAFT, awaiting PM sign-off.**
**Version 1.0 · 2026-05-23**
**Lifted from `.specify/features/001-nsw-calculator/impl-plan.md` §8 and updated to reflect what we actually built in Phases 1–5.**

This policy applies to the v1 NSW LSL Calculator launching from `australianpayroll.com.au` (or the chosen production domain). It tells anyone — APA members, employers, auditors, the OAIC — exactly what we do with the wage data and PDFs they upload.

---

## 1. What the calculator does with employee data

### 1.1 Data the user provides directly

The user provides one of the following input shapes:

| Input | Contents |
|---|---|
| Single-mode manual form | One employee's identity, employment dates, states of service, current weekly gross, wage history, continuous-service events |
| Single-mode CSV upload | Wage-history rows (period_start, period_end, gross_pay, frequency) |
| Single-mode PDF upload | Vendor payroll-report PDF (Xero / MYOB / KeyPay / ADP / custom) — server-side text extraction; binary never reaches the LLM |
| Bulk-mode CSV upload | Multi-employee payroll export — one row per pay period, grouped by `employee_id` |
| Bulk-mode PDF upload (deferred) | Multi-employee PDF (not in v1 launch — Wave 3 of Phase 4 deferred) |

### 1.2 What is sent to Anthropic Claude (PDF mode only)

When the user uploads a PDF, the server-side route `/api/extract-pdf` does the following:

1. Extracts text from the PDF using `pdfjs-dist` running in our Node runtime — the binary PDF never leaves our server.
2. Sends **only the extracted text** to the Anthropic Claude API along with a fixed extraction prompt that names the expected JSON schema.

What is **not** sent to Anthropic:

- The user's name, email, IP, browser fingerprint (the SDK call is server-side; user identity is not propagated).
- Any data from prior calculations.
- Form fields the user typed directly (these never reach the LLM — only PDF text does).
- Any session token.
- The PDF binary itself.

### 1.3 What is sent to other third parties

| Third party | Purpose | Data sent |
|---|---|---|
| **Vercel** | Hosting, edge function execution, runtime logs | HTTP request paths + status codes + sanitised stack traces. PII fields are stripped by `src/lib/observability/scrub-pii.ts` before any `console.error` call. |
| **Vercel Analytics** (built-in) | Page-view counts, aggregated custom events | URLs + buckets/counts/enums only. Wage values, names, dates, emails — all explicitly excluded by the typed event-name union in `src/lib/observability/track.ts`. |
| **Vercel Speed Insights** (built-in) | Core Web Vitals (LCP, INP, CLS) | Synthetic performance metrics — no user content. |

No Plausible, no Sentry, no Google Analytics, no LogRocket, no Hotjar.

---

## 2. The Anthropic no-retention contract

Per Anthropic's enterprise no-retention terms (as understood at 2026-05-23):

- Request and response data are **not retained** after the response is returned. Not used for training, not stored beyond the request lifecycle, not available for support replay.
- Standard infrastructure logs (request id, timestamp, latency) are retained per Anthropic's standard retention policy.
- Inference occurs on **US infrastructure**; data crosses the Pacific in transit (HTTPS, TLS 1.2+).
- No Australian inference region exists today.

### 2.1 Pre-production checklist (Tracy to confirm before cutover)

- [ ] Anthropic enterprise no-retention contract confirmed with Anthropic account team in writing.
- [ ] Production API key issued under the no-retention tier (not the standard tier).
- [ ] Anthropic's published retention policy at the time of cutover is captured here for the record.

---

## 3. What persists where

| Data | Where | How long | Owner |
|---|---|---|---|
| Single-mode form state | Browser `localStorage` key `lsl-calculator:single-mode:v1` | Until user clicks "Start over" or browser clears storage | The user |
| Bulk-mode results + parsed employees | Browser `localStorage` key `lsl-calculator:bulk-mode:v2` | Same as above; capped at 4 MB | The user |
| Extracted PDF text | Server memory during the request only | Garbage-collected after the response returns | Nobody |
| Anthropic request/response | Anthropic's lifecycle (~ duration of the API call) | Per no-retention contract | Anthropic |
| Vercel runtime logs | Vercel | Per Vercel retention (currently 30 days for Hobby, longer for Pro) | Vercel |
| Vercel Analytics events | Vercel | Per Vercel Analytics retention | Vercel |

No server-side database. No employee records held by us.

---

## 4. Mapping to the Australian Privacy Principles

The calculator handles workplace data that may include personal information. We apply the APPs as if we were an APP entity, regardless of revenue threshold.

| APP | How we apply it |
|---|---|
| **APP 1** Open and transparent management | This policy + a plain-English privacy notice rendered on `/privacy`, linked from the footer of every page and from the upload controls. |
| **APP 5** Notification of collection | The privacy notice tells the user what happens to uploaded data **before** they upload. The upload control on single-mode and bulk-mode pages also surfaces the Anthropic flow inline. |
| **APP 6** Use or disclosure | Extracted data is used only to populate the calculator's preview. Not used for any other purpose. Not disclosed to anyone other than Anthropic for the extraction round-trip. |
| **APP 8** Cross-border disclosure | Anthropic is the cross-border recipient (US). The user-facing notice discloses this clearly. The no-retention contract is the basis for treating Anthropic's retention surface as bounded. |
| **APP 11** Security | HTTPS-only transport. No third-party analytics that capture inputs. Browser-only persistence. Minimal LLM payload (text only, no metadata). PII-scrubbed error logs. |
| **APP 12 / APP 13** Access and correction | Not directly applicable in v1 since we hold no employee records server-side. Users can clear their own browser state via the "Start over" control. |

---

## 5. What we explicitly DO NOT do

- We do not train models on user data.
- We do not retain PDFs server-side beyond the request lifecycle.
- We do not retain extracted text server-side beyond the request lifecycle.
- We do not log wage values, names, dates, or emails to Vercel or any third party — even on error paths (see §1.3 and `scrub-pii.ts`).
- We do not use cookies for tracking. Vercel Analytics is cookie-free by design.
- We do not sell, share, or disclose any user data to any party other than Anthropic for the extraction round-trip described in §1.2.
- We do not store any employee record server-side in v1.

---

## 6. What to do if something goes wrong

If a user believes their data has been mishandled, the contact path is:

1. **Owner / Privacy Officer**: Tracy Angwin · `tracy@austpayroll.com.au`
2. **Australian regulator escalation**: Office of the Australian Information Commissioner (oaic.gov.au)

Incidents that require a notifiable data breach assessment will be assessed against the Notifiable Data Breaches Scheme within 30 days of awareness.

---

## 7. Revision log

| Version | Date | Change | Author |
|---|---|---|---|
| 1.0 | 2026-05-23 | Initial draft lifted from impl-plan §8; updated to reflect Vercel-native telemetry (replacing Plausible+Sentry) and the server-side text-extraction approach. | Developer agent |
| | | **Awaiting PM sign-off** | |
