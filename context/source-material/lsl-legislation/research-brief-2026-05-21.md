# LSL Calculator — Research Brief
*Compiled 2026-05-21 from APA LSL Masterclass training (January 2026, 158pp) + NSW Long Service Leave Act 1955 + NSW IR guidance (nsw.gov.au)*

> Source document for the epic skeleton in `docs/product/epics.md`. Refer back when writing speckit specs per epic.

## 1. NSW — Detailed

### 1.1 Entitlement (PDF p.13, NSW LSA s.4(2))
- **Qualifying period:** 10 years continuous service → **2 months (8.6667 weeks)**. Then **1 month (4.3333 weeks)** per additional 5 years.
- **Accrual formula:** `Years of Continuous Service × (8.6667 / 10)`. NSW is milestone-based, not progressive — leave only becomes *takeable* at the 10-year mark; pre-10 years it is contingent (PDF p.13 Pro Tip).
- **Pro-rata on termination (PDF p.25, NSW LSA s.4(2)(iii)):**
  - <5 years: no entitlement
  - **5 to <10 years:** pro-rata only if (a) employer-initiated termination other than serious misconduct (incl. redundancy), (b) illness/incapacity, (c) domestic or pressing necessity, (d) death
  - **10+ years:** pro-rata payable on termination for *any* reason
- "Pressing necessity" is undefined in the Act — relies on case law (PDF p.25 lists 6 NSW precedents incl. *Donnelly v South Maitland Railway* 1964, *Kershaw v Electricity Commission of NSW* 1991).

### 1.2 Calculation formula — "Value of a Week" (PDF pp.18-23, NSW LSA s.4(5), Clause 4A)
The formula **differs by pay-pattern category**, not by taking-vs-termination. The "prescribed date" is the day before leave starts, or day before termination (PDF p.18).

| Employee category | Formula |
|---|---|
| **Fixed rate, fixed hours** (full-time, stable part-time) | The **greater of**: (a) current weekly rate × normal weekly hours, or (b) average weekly ordinary remuneration over **last 5 years** |
| **Fixed rate, varied hours** (casuals, PT doing extra ordinary hours) | The **greater of**: (a) current hourly rate × (total hours last 12 months / total days × 7), or (b) total remuneration over 5 years at fixed rate / total days × 7 |
| **Varied rate** (piece work, commission, results-based, retainer + commission, bonus on prescribed date) | The **greater of**: (a) avg weekly wage over **12 months**, or (b) avg weekly wage over **5 years** |

- Lookback denominator is in **days** (365/366/1825/1826/1827) less "days not counted" (unpaid leave that didn't count as service, JobKeeper days, COVID stand-down without pay, casual days outside pattern) — see PDF p.19.
- **Taking leave vs. termination:** formula is *identical*; only timing differs. On termination NSW LSA s.4(5)(a) requires payment "forthwith" (PDF p.26 — day of termination).

### 1.3 Pay components (NSW LSA s.3(2), PDF p.18)

| Component | Status |
|---|---|
| Base salary/wages | INCLUDED |
| Casual loading | INCLUDED |
| Skill/qualification allowances (first aid, leading hand, all-purpose) | INCLUDED |
| Board & lodging allowances | INCLUDED |
| Commissions | INCLUDED |
| Piece work rates | INCLUDED |
| Bonus / performance pay / incentive | **DEPENDS** — included only if employee is under the high-income threshold (currently **$183,100 p.a.**, reviewed 1 July annually) |
| Overtime | EXCLUDED |
| Penalty rates (shift, weekend, public holiday loadings) | EXCLUDED |
| Expense allowances (meal, phone) | EXCLUDED |

Bonuses are added via a 5-step process (PDF p.21): determine HIT eligibility, then add (12-month bonus / 365 × 7) for current-rate calcs, or (5-year bonus / 1826 × 7) for 5-year-average calcs.

### 1.4 Continuous service (NSW LSA s.4(11), PDF p.14)
**Counts as service (accrual continues):**
- Paid annual leave, paid LSL, paid sick/personal, workers' compensation absence (Workers Comp Act 1987 s.49)
- Paid parental leave, Christmas closedown paid leave
- Transmission/transfer of business (s.4(6)) — new owner inherits service
- Intra-group transfers
- Apprenticeship + re-employment as tradesperson within 12 months
- Employer-initiated stand-down (slackness): does NOT break service but does NOT count toward it; no time limit on slackness stand-down

**Does NOT count:**
- Unpaid parental leave / LWOP / GPPL (unless EA or contract says otherwise)
- Industrial action / strike
- Absence by employer to avoid LSL or sick-leave obligations
- Gap of >2 months after employer-initiated termination (resignation → service resets entirely)

### 1.5 Cashing out (NSW LSA s.4(8), PDF p.31)
**Not permitted.** "The long service leave entitlement must be taken as leave (other than upon termination of employment)." No PILON provision exists in the Act.

### 1.6 Taking leave vs. termination — key differences
- **Value-of-week formula:** identical.
- **Timing:** when taking, paid in full at commencement OR in pay period when leave falls (s.4(7)). On termination, paid **immediately** ("forthwith", s.4(5)(a)); estate paid on request if death (s.4(5)(b)).
- **Public holidays during LSL are exclusive** — extend the leave by one day each (s.4(4A)).
- **Increments:** when taking, leave can be split (2 months → 2 periods; 2–19.5 weeks → 2-3 periods; >19.5 → 2-4 periods; min 1 day per period). On termination, paid as lump sum.

## 2. Cross-state divergence summary

| State | Qualifying period (full entitlement) | Lookback for "ordinary pay" | Pro-rata threshold | Key divergence from NSW |
| --- | --- | --- | --- | --- |
| **NSW** | 10 yrs → 8.6667 wks | 12 mo or 5 yr (greater) | 5 yrs (limited grounds); 10 yrs any reason | Baseline. Cashing out prohibited. |
| **VIC** | 7 yrs → 6.067 wks (LSL Act 2018) | Greater of 52 / 260 wks / whole employment | 7 yrs any reason | Lower qualifying period; **12-week** break tolerance (vs NSW 2 mo); cashing out is a criminal offence (s.67) |
| **QLD** | 10 yrs → 8.6667 wks (IR Act 2016) | Full Time: current rate; commission 12mo | 7 yrs (limited); 10 yrs any reason | Cashing out **restricted** — only with award/EA permission or QIRC approval; 3-month break tolerance |
| **WA** | 10 yrs → 8.6667 wks (LSL Act 1958) | Avg hrs full period × current rate (PT/casual) | 7 yrs (limited; serious misconduct exclusion) | **Cashing out permitted** by written agreement once qualified; two continuous-service regimes pre/post 20 Jun 2022 |
| **SA** | 10 yrs → **13 wks** (LSA 1987) | Avg 12 mo for commission; 3 yrs for PT/casual | 7 yrs (limited) — completed years only | Most generous accrual (1.3 wks/yr after 10); **cashing out permitted** in writing; PH falling in LSL is **inclusive** |
| **TAS** | 10 yrs → 8.6667 wks (LSL Act 1976) | 12 mo avg hrs × current rate (casual) | 7 yrs (limited; incl. retirement age 60F/65M) | Cashing out permitted after entitlement; no advance leave; 3-month break tolerance |
| **ACT** | **7 yrs → 6.0667 wks** (LSL Act 1976) | 12 mo (PT/casual avg hrs, incl. overtime) | 5 yrs (limited); 7 yrs any reason | Lowest qualifying period; **ordinary pay includes overtime hours** for PT/casual; termination paid within **90 days** (vs NSW immediate) |
| **NT** | 10 yrs → **13 wks** (LSL Act 1981) | 12 mo total income / total ordinary hours | 7 yrs (limited; retirement = age pension age) | Cashing out **prohibited** (s.12); strongest restriction on working elsewhere during LSL (s.16) |

## 3. Highest-risk states for E2 encoding

1. **VIC** — lowest qualifying period (7 yrs), 12-week break tolerance (vs NSW 2 mo), criminal offence for cashing out (s.67), distinct pre/post-Nov-2018 continuous service regimes, and "reasonable business grounds" decline of leave requests. Most behaviourally different from NSW.
2. **WA** — bifurcated continuous-service rules either side of 20 June 2022 (PDF p.66) means dual logic for the same employee depending on entitlement date. Workers Comp only counts from 1 July 2024.
3. **ACT** — only state where **overtime hours** feed into the ordinary-rate calc for part-time/casual employees (PDF p.122), inverting NSW's exclusion rule. High risk of mis-coding.

## 4. Audit considerations (E3)

### 4.1 Common error patterns (PDF pp.139-141 "System vs Manual")
- Payroll systems calculate on **hours worked × hourly rate**, ignoring the legislated "greater of current rate / 5-year average / 12-month average" test. APA's worked example shows the same NSW casual is **overpaid $179.99** on a 10-year payout when the system formula is used; the same employee transitioning to FT in years 11-12 is **underpaid $3,316.64** vs the correct $9,880.04 (a 33% error).
- Failure to flag leave types correctly (LSL accrue vs not-accrue) (Health Check p.137).
- Displaying LSL on payslips in hours instead of weeks — Fair Work and APA explicitly advise against (PDF p.137 Pro Tip).
- Mis-applying bonus inclusion at/above the $183,100 high-income threshold (NSW).
- Treating resignation gap <2 months as continuous (it isn't — only employer-initiated breaks qualify in NSW; PDF p.16 Examples 1-3).

### 4.2 Evidence needed to verify
NSW LSA s.8 record-keeping requirements (PDF p.26):
- Employer name + ABN, employee name, classification, employment type, start/end dates
- Dated record of LSL taken + gross payments
- Entitlement record at 10 years and every 5 years thereafter
- Bonuses included in pay calculations
- Termination payments
- Applications and agreements re leave
- **Records retained 6 years** post-employment, transferable on sale of business

### 4.3 Audit trail expectations
- Records must be "legible, English, paper or electronic convertible to legible English" and "accessible to authorised inspectors" (s.8).
- The Act does not prescribe a single audit-trail schema; in practice the NSW IR inspectorate and Fair Work Ombudsman work from the s.8 minimum record set plus payslips and wage history granular enough to reconstruct 5-year averages with day-precision (denominators of 1825/1826/1827).
- Source material does not specify a standardised FWO LSL audit checklist — *not specified in source material*.

## 5. Edge cases the calculator must handle

1. **Casual with varying hours over 5+ years** — must run dual 12-mo and 5-yr lookbacks on both hours (Part A) and days-worked-per-week (Part B); APA's "Liam" example yields different "greater" values for each part (PDF p.24).
2. **Unpaid parental leave (>52 wks NSW)** — does not count as service AND days must be excluded from the lookback denominator (PDF p.19 "days not counted").
3. **Part-time with stable hours who took unpaid parental leave 6 yrs ago** — value-of-week uses current pay but accrual base excludes the parental year (Practice 1B p.28).
4. **Transfer of business** — service preserved if same/similar role with new owner; old employer must transfer records (NSW LSA s.4(6), PDF p.16).
5. **Employee on Workers Comp** — accrues LSL throughout (Workers Comp Act 1987 s.49); illness days excluded from average-hours denominator but count for service (PDF p.15 Yamala example).
6. **Bonus crossing the high-income threshold** — bonus excluded above $183,100 base, included below; recalculated each prescribed date (PDF p.18).
7. **Employer-initiated termination + re-hire within 2 months** — prior service preserved but gap doesn't count (NSW); contrast VIC's 12-week tolerance and QLD/TAS's 3-month tolerance.
8. **Employees who change states mid-employment** — PDF p.138 explicitly defers to legal advice ("sufficiently connected" test); calculator must let user nominate governing jurisdiction and flag ambiguity.
9. **Salary sacrifice / packaged remuneration** — *not specified in source material*; calculator should expose a pre-sacrifice gross input and warn.
10. **Apprentice → tradesperson re-employed within 12 months** — prior apprentice service counts (PDF p.14, "Walid" example).
11. **JobKeeper / COVID stand-down days** — count as service for NSW casuals but **excluded from the average-hours denominator** (PDF p.19).
12. **Retrospective pay rises affecting 5-year lookback** — *not explicitly addressed in PDF*; in principle the 5-year ordinary remuneration would need to be recomputed on the adjusted amounts paid in each year.
13. **Pre-modern award employees (started before 1 Jan 2010)** — entitlement may flow from the pre-modern federal award (e.g. Graphics Arts Award 2000 = 15-year qualification) rather than state law (PDF pp.5-6).

## 6. Industry context

- The PDF presents **quantified system-vs-manual error sizes** as the headline business case: in one 10-year NSW casual example, system-driven calculation produces a **$179.99 overpayment** (3.4% over); in a 12-year casual-to-FT transition example, the same system logic produces a **$3,316.64 underpayment** (33.6% under correct $9,880.04). PDF pp.139-141.
- The training material does **not** quote sector-wide underpayment statistics, audit volumes, or aggregate liability figures — *not specified in source material*. (PM may wish to supplement with separate Fair Work enforcement data for the epic.)
- APA's Health Check (p.137) frames LSL as a recurring failure mode requiring quarterly review across leave-code config, payslip presentation, HR/Finance education, and payroll system capability — suggesting this is a chronic, structural payroll-data-quality problem rather than a one-off compliance task.

## 7. Source citations

**Primary**
- APA Long Service Leave Masterclass, January 2026: `docs/features/LSL-training.pdf`
  - Overview & accrual formulas: pp.5-11
  - NSW detail: pp.13-31 (Matrix p.30-31)
  - VIC: pp.32-48; QLD: pp.49-64; WA: pp.65-79; SA: pp.80-94; TAS: pp.95-108; ACT: pp.109-123; NT: pp.124-136
  - Health Check: p.137; Interstate/Overseas: p.138; System vs Manual: pp.139-141

**Legislation (cited in PDF and verified)**
- Long Service Leave Act 1955 (NSW) — `https://legislation.nsw.gov.au/view/whole/html/inforce/current/act-1955-038`
  - s.3(2) ordinary pay definition; s.4(2) entitlement & pro-rata; s.4(3) period rules; s.4(4A) public holidays; s.4(5) termination payment; s.4(7) when paid; s.4(8) no cashing out; s.4(10) employer notice; s.4(11) continuous service; s.8 records
- LSL Act 2018 (Vic); IR Act 2016 (Qld) Ch 2 Pt 3 Div 9; LSL Act 1958 (WA); LSL Act 1987 (SA); LSL Act 1976 (Tas); LSL Act 1976 (ACT); LSL Act 1981 (NT); Workers Compensation Act 1987 (NSW) s.49; LSL (Commonwealth Employees) Act 1976
- NSW Government plain-English guidance — confirms 10-year qualifying period, 8.67 wks @ 10 yrs, 5/10-year pro-rata split, measurement in weeks.

**Cross-check flags**
- PDF p.18 high-income threshold of **$183,100** is referenced without a section anchor; treat as policy-current (per Jan 2026 disclaimer p.2) and reverify against NSW IR before encoding into E1.
- PDF p.31 ACT cashing out is listed as "Silent" but PDF p.123 narrative says "may be cashed out if agreed in writing and entitlement reached" — internal inconsistency; defer to written agreement permissibility for E2.
- NSW LSA s.4(2)(a3) "5 years but less than 10" wording in the legislation should be cross-read with the PDF p.25 four-bullet list of qualifying grounds — they align.
