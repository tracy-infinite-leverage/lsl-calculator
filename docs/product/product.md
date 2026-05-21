LSL Calculator · Written by Tracy · Draft v0.1 · 2026-05-21

*"If you can read this whole document and not be able to tell a stranger why we'd be sad if this product didn't exist, I've failed at writing it."*

## 1. The problem

Australia has eight states and territories, each with its own long service leave (LSL) legislation. Every state defines the qualifying service period, the lookback window for "average earnings" (current week, last 12 months, last 5 years, or whole-of-employment — and which one applies depends on the state and on whether the leave is being taken or paid out on termination), and which components of pay are included. No mainstream payroll system calculates LSL automatically because the rules don't compress into a single formula. Payroll managers do it by hand from legislation PDFs, and they get it wrong — the cost of which lands on the employer as underpayment claims or on the employee as silent under-payment. There are ~56,000 payroll personnel in Australia, every one of whom has to make this call.

The broken assumption is that "payroll software handles payroll." It doesn't handle this part. The market has accepted manual calculation as the cost of doing business because no vendor wants to own eight pieces of constantly-shifting state legislation. If we're wrong about this, no amount of feature work saves us.

## 2. What we deliver

- **Computes correct LSL across all 8 Australian states/territories.** Handles the lookback-window comparisons and the per-state pay-component rules, with a separate code path for "taking the leave" vs. "paid out on termination."
- **Replays historical LSL payments for audit.** Bulk variance reports showing where an employer over- or under-paid LSL against what the legislation actually required.
- **Encodes legislation as deterministic rules.** Same inputs → same answer, every time, with a defensible audit trail back to the section of legislation that drove the result.
- **Distributes through the Australian Payroll Association.** Sits inside the APA member portal as a member tool; non-members buy a licence.
- **Ingests wage history without manual re-entry.** CSV import in v1; API integration with major Australian payroll systems as the data layer matures.

## 3. Who this is for

A payroll manager at an Australian mid-sized employer — a few hundred to a few thousand staff — who has been around long enough to know that LSL is the calculation that bites you. She has the relevant state's legislation bookmarked. When an employee hits ten years, or terminates mid-eleven, she clears half a morning, opens a spreadsheet, looks up the lookback rule, decides which average earnings figure to use, debates with herself whether the bonus paid 14 months ago counts, and writes a number on the payslip that she hopes is right. She does this once a fortnight, sometimes more.

She has already tried the obvious things and rejected them. Her payroll vendor's support line cannot tell her the answer — it's outside their scope. Her industry association publishes general guidance but not a calculator. State authority websites have explainers but not a tool. She has, on three separate occasions, paid an accountant to check her workings, and the accountant arrived at a different number to hers, and they had to negotiate which was right.

Anti-personas: (a) a micro-employer with two staff and no employee approaching ten years — LSL is rare, the willingness to pay is zero; (b) a global enterprise running a custom-built HRIS with an in-house actuarial team — already solved their problem; (c) a payroll software vendor — they are a future integration partner or competitor, not a customer.

## 4. The job they're hiring us for

They hire us to get the number right the first time, and to be able to defend it when asked. The behavioural test is whether, when an employee terminates on a Friday and finance needs the final payslip by close-of-business, the payroll manager opens our tool instead of her spreadsheet. The second job — closer to the auditor persona — is to take a year's worth of historical LSL payments and produce a variance report that says, "these 4 of 87 payments were wrong, by these amounts, for these reasons."

If the product vanishes, she goes back to the legislation PDF, the spreadsheet from 2018, the accountant's invoice, and the queasy feeling that the number she just wrote is probably wrong by some amount she'll never know about.

## 5. The wedge

**The state-specific deterministic rules engine.**

- **Specific**: each state's lookback window, pay components, and termination-vs-leave differential is encoded as discrete, named rules — not a single generic formula with branching `if`s. A rule maps to a section of legislation.
- **Deterministic**: the same inputs always produce the same answer, with a citation back to the rule and the legislation section that drove it. That makes the output defensible to an auditor, a tribunal, or an employee querying their payslip.
- **Compounds**: every downstream feature reuses the engine. The single-calc UI is one consumer. The audit replay is another consumer. The future API integration is a third. When legislation changes, we update one rule and every consumer stays correct.

## 6. 12 months out

In twelve months, the LSL Calculator is the default tool a payroll manager opens inside the APA portal whenever an LSL event lands on her desk. She picks the state, enters the employee's start date and the trigger (take leave vs. terminate), and the tool produces the daily and weekly rate with a citation block underneath showing which sections of legislation produced each number. Calculation takes thirty seconds. Confidence is high enough that she does not double-check it.

A separate workflow lets her upload a CSV of every LSL payment her company made in the last financial year, plus a CSV of wage history. The tool replays each payment, flags variances, and produces a clean PDF report she can hand to her CFO or external auditor: *"These were paid correctly. These four were under by $X. These two were over by $Y."* The report is the thing the auditor persona will pay for separately.

Underneath, the rules engine has full coverage of all eight states and territories, with a maintained test suite of historical real-world calculations against which every change is regression-checked. When NSW updates its legislation, we update one rule, ship one PR, and every customer downstream is correct from the moment the change deploys.

API integrations with the two or three largest Australian payroll platforms are in flight or shipped, removing the CSV step for those customers. The tool is referenced in APA training materials. Non-member licences are selling at a steady rate. We have a small backlog of feature requests from auditors who want richer variance reports, and from payroll managers who want LSL projections rather than point calculations.

## 7. What we are explicitly not building

- **A payroll system.** We calculate one thing. Running payroll, generating payslips, paying the ATO — out of scope.
- **Other leave types.** Annual leave, personal/carer's leave, parental leave — out of scope. Different legislation, different reasoning, would dilute the wedge.
- **Non-Australian jurisdictions.** UK, NZ, Singapore, anywhere else — out of scope. Different legal framework, no overlap.
- **Legal advice.** When an edge case requires interpreting whether a particular allowance counts as "ordinary pay" in a way the legislation is ambiguous on, we flag it for human judgement. We do not resolve it.
- **Write-back into payroll systems.** API integrations are read-only for data ingest. We don't push values back into client payroll.
- **General workforce analytics.** We don't do headcount, turnover, demographics. Single-purpose tool.

## 8. Differentiation table

| Competitor | What they do well | Where they fall short | Our angle |
|------------|-------------------|------------------------|-----------|
| Major payroll vendors (Xero, MYOB, ADP, KeyPay, etc.) | Run payroll end-to-end. Already in every payroll team's stack. | Do not auto-calculate LSL — the eight-state complexity is outside their scope. | Single-purpose, deterministic, defensible. Integrates with them rather than competing. |
| Manual spreadsheets + accountant review | Fully customisable; the payroll team knows their own workings. | Error-prone, slow, not reproducible, expensive when an accountant is involved, no audit trail. | Faster, deterministic, with a citation block under every number. |
| State authority calculators (where they exist) | Authoritative for the one state they cover. Free. | Single-state only. No audit replay. No CSV. No bulk. No multi-state employer support. | Cross-state coverage + audit replay. |
| In-house bespoke tools (large enterprise) | Tailored to one employer's payroll structure. | Costly to maintain; legislation drift breaks them silently. | We absorb the legislation drift cost across the whole market. |

## 9. Market and timing

- **TAM**: ~56,000 payroll personnel in Australia (every Australian employer that engages staff long enough to qualify them for LSL — effectively all of them).
- **SAM**: APA member organisations + the population of non-member payroll teams reachable via APA's distribution.
- **SOM**: APA members already in the portal, plus the first cohort of non-member licence buyers.
- **Why now**: distribution. APA owns a direct channel to payroll teams in Australia, and inserting a tool inside the portal is a near-zero-CAC route to a defined market. Separately, regulatory scrutiny and underpayment cases have been rising for several years — the cost of getting LSL wrong is now visible enough to justify paying for the tool.

## 10. Business model

- **Inside the APA portal**: bundled as a member tool. The cost is absorbed into APA membership; the value to APA is increased member retention and a defensible product moat against other associations.
- **Non-members**: per-licence purchase. Pricing not yet set — see Open Decisions.
- **Unit economics intuition**: zero marginal cost per calculation. Cost base is engineering + legislation maintenance. Maintenance cost is a function of legislative change rate, which is slow but not zero.
- **Future**: per-seat or per-employer pricing for the audit replay capability, which is the more differentiated (and more value-bearing) feature.

## 11. What I believe but can't yet prove

- **Audit teams will pay separately from payroll teams.** *Falsification (90 days)*: parallel buyer-intent conversations with 15 payroll managers and 15 internal/external auditors. If both groups express independent purchase intent for distinct use cases, confirmed.
- **Users will tolerate manual CSV imports until API integrations exist.** *Falsification (90 days)*: ship v1 to a pilot cohort of APA members with CSV-only ingest, measure completion rate of first audit replay within 30 days of activation. ≥60% completion = confirmed.
- **State legislation compresses into deterministic rules for the majority of cases.** *Falsification (90 days)*: pick one state, encode rules, run against a curated test suite of 100 historical LSL calculations supplied by APA member firms, measure match rate against manual gold-standard. ≥95% match = confirmed.

## 12. How we know it's working

- **Leading metric**: % of test-suite calculations matching the gold-standard manual calculation, segmented by state. *Target: ≥99%.* This is "the calculator works accurately" in measurable form.
- **Trailing metric**: # of APA-portal accounts running ≥1 calculation per fortnight (the fortnightly LSL pay cycle is the natural cadence). *Target: a defined adoption rate inside the APA member base; baseline TBD after launch.* This is "clients actually use it" in measurable form.

## 13. Next 90 days

- **One state, end to end, live in the APA portal.** A payroll manager picks the chosen first state, enters employee details, sees a defensible LSL number with citations, within thirty seconds. Accuracy ≥99% against a 100-case test suite.
- **All eight states encoded as rules.** Calculation logic and per-state test cases written for every Australian state and territory, even if the UI exposes only the first state. State coverage is a code/data milestone, not a UI milestone.
- **Audit replay prototype on the first state.** CSV upload of historical LSL payments, replay against the encoded rules, return a variance report. End-to-end against one state proves the second buyer (the auditor) is reachable.

## 14. Open decisions

- **Which state ships first?** Victoria, NSW, and Queensland are the obvious candidates by population. Owner: Tracy. Deadline: before Bet 1 starts.
- **Pricing for the non-member licence?** Per-seat, per-employer, per-calculation, or annual? Owner: Tracy + APA board. Deadline: before public launch (post-Bet-1).
- **Hosting / auth inside APA portal.** Single sign-on with APA member auth, or standalone with a deep-link from the portal? Owner: Tracy + APA technical lead. Deadline: before Bet 1 starts.
- **Sequence of API integration vs. CSV audit upload.** Round 2 of the client interview listed API integrations *before* CSV import; the audit-upload use case was strongly emphasised in Round 1. Confirm the intended sequence given the audit feature is the more differentiated wedge against payroll vendors. Owner: Tracy. Deadline: end of Phase 1.
- **Legislation source-of-truth and update cadence.** Who watches state legislation for change, and how does a change reach the rules engine? Owner: TBD. Deadline: before Bet 2 ships.

---

*What this doc deliberately does not do: feature backlog, integration list, P&L.*
