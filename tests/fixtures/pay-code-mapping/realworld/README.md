# Real-world payroll-export fixtures — E5.3 AC-MAP-1 calibration set

**Purpose.** Spec §7 AC-MAP-1 requires auto-detection ≥ 90% accuracy on a 10-fixture
set covering Xero / MYOB / KeyPay / ADP / Employment Hero shapes. This directory
holds that calibration set.

## Provenance

**Synthetic-but-representative.** Tracy does not have access to live payroll
exports from all five vendors in production. These fixtures are **constructed
from each vendor's published API documentation and sample CSV exports**:

| File | Vendor | Source pattern | Rows |
|---|---|---|---|
| `xero-paystubs.csv` | Xero | Payroll API "Pay Items" CSV — earnings rates / deduction types / leave categories | 12 |
| `xero-leave-balances.csv` | Xero | Payroll API "Leave Balances" — accrued / taken hours | 8 |
| `myob-payroll-categories.csv` | MYOB | AccountRight payroll categories export — `Name` / `Type` / `WagesCategory` | 14 |
| `myob-pay-history.csv` | MYOB | AccountRight pay-history export — per-employee per-period | 18 |
| `keypay-pay-run.csv` | KeyPay | Pay-run export — `Code` / `Description` / `Amount` / `Hours` | 16 |
| `keypay-employee-summary.csv` | KeyPay | Employee-summary export with classification + state | 10 |
| `adp-payroll-detail.csv` | ADP | Payroll Detail Report — `EarnCode` / `EarnDescription` / `Hours` / `Amount` | 15 |
| `employmenthero-payroll-export.csv` | Employment Hero | Payroll export — `EarningCategory` / `Hours` / `Amount` | 12 |
| `generic-csv-onepay.csv` | Generic | Single-CSV shape with `Pay Code` + `Amount` + `Hours` + `Period End` | 10 |
| `generic-csv-multistate.csv` | Generic | Multi-state employer with `State` / `Award` / `Classification` columns | 14 |

These cover the **column-naming variety** the auto-detection layer must handle
(`Pay Item`, `EarnCode`, `Code`, `Category`, `Earning Category`, etc.) and the
**value-form variety** (state names long/short, employment-type prefixes,
pay-frequency words).

## Caveat — finding flagged 2026-06-02

These fixtures are **synthetic** and may not surface edge cases that show up in
real customer exports. Per dispatch brief: "If you don't have access to these
payroll exports, surface as a finding and proceed with synthetic-but-representative
fixtures generated from public Xero/MYOB API docs."

Action item carried in HANDOFF.md: once we onboard a real customer using each
of these vendors, swap the synthetic fixture for the live one (with PII strip).
The AC-MAP-1 threshold gate may need recalibration against real shapes.

## Refresh procedure

These files are hand-curated. To add a new shape, drop a CSV under this directory
matching the vendor naming convention and update this README. The Phase 2 T2.6
calibration sweep will pick it up automatically once it lands.
