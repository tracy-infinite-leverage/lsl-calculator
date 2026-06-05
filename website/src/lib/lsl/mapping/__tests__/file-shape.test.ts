/**
 * Unit tests for E5.3 Phase 2 T2.2 — `detectFileShape`.
 *
 * Pure-function tests using in-memory `FileInput[]` data. The Virtus xlsx
 * end-to-end test that actually parses the fixture lives in T2.7's
 * integration test (`integration.test.ts`).
 */

import { describe, expect, it } from "vitest";
import type { PayCodeAliasRow } from "@/lib/db/types";
import {
  type FileInput,
  detectFileShape,
} from "@/lib/lsl/mapping/detect/file-shape";

// ─── Test fixtures ────────────────────────────────────────────────────

/** Minimal alias set covering the canonical `pay_code` header patterns. */
const ALIASES: PayCodeAliasRow[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    pattern_kind: "header_name",
    pattern: "pay_code",
    bucket: "ordinary_time",
    confidence: 0.9,
    source: "system_seed",
    created_at: "2026-06-02T00:00:00Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    pattern_kind: "header_name",
    pattern: "pay code",
    bucket: "ordinary_time",
    confidence: 0.9,
    source: "system_seed",
    created_at: "2026-06-02T00:00:00Z",
  },
];

// Approximation of Virtus Sheet3 (the payroll-export sheet) headers.
const VIRTUS_SHEET3_HEADERS = [
  "Employee ID",
  "Cohort",
  "System",
  "Pay Period Start",
  "Pay Period End",
  "Pay Date",
  "Pay Code",
  "Pay Code Description",
  "Units",
  "Amount",
  "Pay Run",
];

// Approximation of Virtus Sheet1 (reconciliation summary — pivot-style headers).
const VIRTUS_SHEET1_HEADERS = [
  "Employee ID",
  "Name",
  "Title",
  "State",
  "LSL Instrument",
  "Outstanding Service",
  "Balance at Start",
  "Earned",
  "Taken",
  "Balance at End",
];

// Approximation of Virtus Sheet2 (employee-master / position-history).
const VIRTUS_SHEET2_HEADERS = [
  "Employee ID",
  "Cohort",
  "Title",
  "Position Effective Date",
  "LSL Instrument",
  "State",
  "Employment Status",
  "Commencement Date",
];

// ─── Tests ────────────────────────────────────────────────────────────

describe("detectFileShape — single file", () => {
  it("classifies a single CSV as 'csv'", () => {
    const files: FileInput[] = [
      {
        name: "payhistory.csv",
        extension: "csv",
        sheets: [{ name: "", headers: VIRTUS_SHEET3_HEADERS }],
      },
    ];
    expect(detectFileShape(files, ALIASES)).toEqual({ shape: "csv" });
  });

  it("classifies a single-sheet xlsx as 'excel-single'", () => {
    const files: FileInput[] = [
      {
        name: "single.xlsx",
        extension: "xlsx",
        sheets: [{ name: "Sheet1", headers: VIRTUS_SHEET3_HEADERS }],
      },
    ];
    expect(detectFileShape(files, ALIASES)).toEqual({ shape: "excel-single" });
  });

  it("classifies a multi-sheet xlsx as 'excel-multi' with the payroll-export sheet proposed", () => {
    const files: FileInput[] = [
      {
        name: "virtus.xlsx",
        extension: "xlsx",
        sheets: [
          { name: "Sheet1", headers: VIRTUS_SHEET1_HEADERS },
          { name: "Sheet2", headers: VIRTUS_SHEET2_HEADERS },
          { name: "Sheet3", headers: VIRTUS_SHEET3_HEADERS },
        ],
      },
    ];
    const result = detectFileShape(files, ALIASES);
    expect(result.shape).toBe("excel-multi");
    expect(result.proposedSheet).toBe("Sheet3");
    expect(result.sheets).toBeDefined();
    expect(result.sheets!.length).toBe(3);
    // Sheet3 must outscore the others.
    expect(result.sheets![0].name).toBe("Sheet3");
    expect(result.sheets![0].score).toBeGreaterThan(result.sheets![1].score);
  });

  it("excel-multi: sheets are ranked highest score first", () => {
    const files: FileInput[] = [
      {
        name: "v.xlsx",
        extension: "xlsx",
        sheets: [
          { name: "Sheet1", headers: VIRTUS_SHEET1_HEADERS },
          { name: "Sheet3", headers: VIRTUS_SHEET3_HEADERS },
        ],
      },
    ];
    const result = detectFileShape(files, ALIASES);
    expect(result.sheets![0].score).toBeGreaterThanOrEqual(
      result.sheets![1].score,
    );
  });

  it("excel-multi: classifies xlsm the same as xlsx", () => {
    const files: FileInput[] = [
      {
        name: "v.xlsm",
        extension: "xlsm",
        sheets: [
          { name: "A", headers: VIRTUS_SHEET1_HEADERS },
          { name: "B", headers: VIRTUS_SHEET3_HEADERS },
        ],
      },
    ];
    expect(detectFileShape(files, ALIASES).shape).toBe("excel-multi");
  });
});

describe("detectFileShape — multi-file relational", () => {
  it("identifies 'Employee ID' as join key across the Virtus 3-CSV drop", () => {
    const files: FileInput[] = [
      {
        name: "PayHistory.csv",
        extension: "csv",
        sheets: [{ name: "", headers: VIRTUS_SHEET3_HEADERS }],
      },
      {
        name: "PayRateHistory.csv",
        extension: "csv",
        sheets: [
          {
            name: "",
            headers: [
              "Employee ID",
              "Company",
              "Effective Date",
              "Hourly",
              "Annual",
              "FTE Salary",
            ],
          },
        ],
      },
      {
        name: "PositionHistory.csv",
        extension: "csv",
        sheets: [
          {
            name: "",
            headers: [
              "Employee ID",
              "Cohort",
              "Title",
              "Position Effective Date",
              "LSL Instrument",
              "State",
              "Employment Status",
              "Commencement Date",
            ],
          },
        ],
      },
    ];

    const result = detectFileShape(files, ALIASES);
    expect(result.shape).toBe("multi-file-relational");
    expect(result.fileRelationship).toBeDefined();
    expect(result.fileRelationship!.joinKey).toBe("Employee ID");
    // PayHistory has the strongest payroll-export header signature →
    // proposed as primary.
    expect(result.fileRelationship!.primary).toBe("PayHistory.csv");
    expect(result.fileRelationship!.companions).toContain("PayRateHistory.csv");
    expect(result.fileRelationship!.companions).toContain(
      "PositionHistory.csv",
    );
    expect(result.fileRelationship!.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("returns multi-file-relational with no joinKey when files do not share a key", () => {
    const files: FileInput[] = [
      {
        name: "A.csv",
        extension: "csv",
        sheets: [{ name: "", headers: ["Col1", "Col2"] }],
      },
      {
        name: "B.csv",
        extension: "csv",
        sheets: [{ name: "", headers: ["X", "Y"] }],
      },
    ];
    const result = detectFileShape(files, ALIASES);
    expect(result.shape).toBe("multi-file-relational");
    expect(result.fileRelationship?.joinKey).toBe("");
    expect(result.fileRelationship?.confidence).toBe(0);
  });
});

describe("detectFileShape — edge cases", () => {
  it("throws when given zero files", () => {
    expect(() => detectFileShape([], ALIASES)).toThrow(/at least one file/);
  });

  it("handles sheets with empty header rows without crashing", () => {
    const files: FileInput[] = [
      {
        name: "empty.xlsx",
        extension: "xlsx",
        sheets: [
          { name: "Sheet1", headers: [] },
          { name: "Sheet2", headers: VIRTUS_SHEET3_HEADERS },
        ],
      },
    ];
    const result = detectFileShape(files, ALIASES);
    expect(result.shape).toBe("excel-multi");
    expect(result.proposedSheet).toBe("Sheet2");
  });
});
