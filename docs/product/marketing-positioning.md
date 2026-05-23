# Marketing positioning — LSL Calculator

Living doc. Captures positioning hooks and differentiators that the writer,
designer, web-publisher, and email-marketer agents should pull from when
producing any external content about this product.

---

## Differentiator #1 — Category A/B/C is the load-bearing concept

**Status: load-bearing for marketing. Verified by owner 2026-05-23.**

The NSW Long Service Leave Act 1955 s.4(5) defines three categories of
remuneration:

| Category | Pay pattern | Value-of-week rule |
|---|---|---|
| **A** | Fixed / ordinary — salaried, steady weekly wage | Higher of current weekly wage  ·  5-year weekly average |
| **B** | Mixed — fixed base + variable (commission, allowances) | Higher of 12-month weekly average  ·  5-year weekly average |
| **C** | Largely variable — piecework, commission-only, irregular casuals | Higher of 12-month weekly average  ·  5-year weekly average |

### Why this is the marketing hook

1. **It's the difference between paying correctly and underpaying.** A salaried
   employee whose wage just rose from $1,500 → $2,000/week is owed LSL at the
   current $2,000 figure (Cat A), not the 12-month average. Most generic
   calculators do `weekly_wage × years × 0.86666 / 10` and miss this entirely.

2. **Most payroll software does it wrong or skips it.** Xero, MYOB, KeyPay, ADP
   surface a single LSL accrual number without distinguishing how the
   underlying weekly value was computed. The category logic is buried — or
   absent. Underpayment is a real legal exposure for employers.

3. **Our calculator surfaces the category explicitly.** Results table shows
   Cat. A/B/C per employee. The classifier picks based on coefficient of
   variation of gross pay; ambiguous cases (CV between 0.05 and 0.10) prompt
   the user to confirm. Citations refer the user to s.4(5)(a), (b), or (c).

### How to use this in content

- **Blog hooks** — "Why payroll teams underpay long service leave (and how to
  spot it)." Lead with the categorisation problem; show a Cat A example where
  a recent pay rise is correctly captured.
- **Email subject lines** — "Are you paying LSL at the right rate?" Reveal the
  category mechanic in the body.
- **Landing-page copy** — Make Category A/B/C a visible feature. Calculator
  surfaces it; competitors don't. "Defensible to the Wage Inspector."
- **APA member nurture** — APA members care about audit-defensible
  calculations. The Category mechanic + citations + diagnostics produce a
  full audit trail. That's the trust hook.

### What NOT to say

- Don't oversimplify to "we calculate LSL." Every payroll system claims that.
  The categorisation + citation + per-jurisdiction rule engine is the actual
  edge.
- Don't pitch this as a "compliance tool." It's a calculator with a defensible
  rule engine — owner's framing matters here.
