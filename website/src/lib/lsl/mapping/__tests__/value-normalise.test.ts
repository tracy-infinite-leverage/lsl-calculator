/**
 * Unit tests for E5.3 Phase 2 T2.4 — `detectValueNormalisations`.
 *
 * Coverage:
 *   - Long-form state names → 8-code enum (AC-MAP-15 state set).
 *   - Prefixed employment-type codes (Virtus shape).
 *   - Pay-frequency words.
 *   - Org-scoped row shadows system row (spec §4.4).
 *   - OQ-ING-9 / OQ-MAP-9 cohort handling — `VIC-TAS` returns
 *     `{ crossJurisdictionFlag: true, hintedJurisdictions: ['VIC', 'TAS'] }`
 *     and NOT a stored `states[]` array.
 *   - Unresolved surface form → `needs_review`.
 */

import { describe, expect, it } from "vitest";
import type { ValueNormaliseAliasRow } from "@/lib/db/types";
import { detectValueNormalisations } from "@/lib/lsl/mapping/detect/value-normalise";

// ─── System seed mirrors (subset of production seed) ──────────────────

let aliasIdCounter = 0;
function makeAlias(
  targetField: ValueNormaliseAliasRow["target_field"],
  surfaceForm: string,
  canonicalValue: string,
  opts: { orgId?: string; confidence?: number } = {},
): ValueNormaliseAliasRow {
  aliasIdCounter += 1;
  return {
    id: `00000000-0000-0000-0000-${String(aliasIdCounter).padStart(12, "0")}`,
    org_id: opts.orgId ?? null,
    target_field: targetField,
    surface_form: surfaceForm,
    canonical_value: canonicalValue,
    confidence: opts.confidence ?? 0.95,
    source: opts.orgId ? "wizard_confirmed" : "system_seed",
    current_version_id: null,
    created_at: "2026-06-02T00:00:00Z",
    created_by: null,
  };
}

const STATE_SEED: ValueNormaliseAliasRow[] = [
  makeAlias("work_jurisdiction", "NSW", "NSW"),
  makeAlias("work_jurisdiction", "New South Wales", "NSW"),
  makeAlias("work_jurisdiction", "VIC", "VIC"),
  makeAlias("work_jurisdiction", "Victoria", "VIC"),
  makeAlias("work_jurisdiction", "QLD", "QLD"),
  makeAlias("work_jurisdiction", "Queensland", "QLD"),
  makeAlias("work_jurisdiction", "WA", "WA"),
  makeAlias("work_jurisdiction", "Western Australia", "WA"),
  makeAlias("work_jurisdiction", "SA", "SA"),
  makeAlias("work_jurisdiction", "South Australia", "SA"),
  makeAlias("work_jurisdiction", "TAS", "TAS"),
  makeAlias("work_jurisdiction", "Tasmania", "TAS"),
  makeAlias("work_jurisdiction", "ACT", "ACT"),
  makeAlias("work_jurisdiction", "Australian Capital Territory", "ACT"),
  makeAlias("work_jurisdiction", "NT", "NT"),
  makeAlias("work_jurisdiction", "Northern Territory", "NT"),
];

const EMPLOYMENT_SEED: ValueNormaliseAliasRow[] = [
  makeAlias("employment_type", "Full Time", "full_time"),
  makeAlias("employment_type", "FT - Full Time", "full_time"),
  makeAlias("employment_type", "FP - Full Time Salaried", "full_time"),
  makeAlias("employment_type", "Part Time", "part_time"),
  makeAlias("employment_type", "PT - Part Time", "part_time"),
  makeAlias("employment_type", "PT - Part-time Salary", "part_time"),
  makeAlias("employment_type", "Casual", "casual"),
  makeAlias("employment_type", "CA - Casual", "casual"),
];

const FREQUENCY_SEED: ValueNormaliseAliasRow[] = [
  makeAlias("pay_frequency", "weekly", "weekly"),
  makeAlias("pay_frequency", "Weekly", "weekly"),
  makeAlias("pay_frequency", "fortnightly", "fortnightly"),
  makeAlias("pay_frequency", "bi-weekly", "fortnightly"),
  makeAlias("pay_frequency", "monthly", "monthly"),
  makeAlias("pay_frequency", "4-weekly", "4-weekly"),
];

const FULL_SEED = [...STATE_SEED, ...EMPLOYMENT_SEED, ...FREQUENCY_SEED];

// ─── State normalisation ─────────────────────────────────────────────

describe("detectValueNormalisations — states (AC-MAP-15)", () => {
  it("resolves all 8 long-form jurisdiction names to canonical 2/3-letter codes", () => {
    const surfaces = [
      "New South Wales",
      "Victoria",
      "Queensland",
      "Western Australia",
      "South Australia",
      "Tasmania",
      "Australian Capital Territory",
      "Northern Territory",
    ];
    const out = detectValueNormalisations("work_jurisdiction", surfaces, STATE_SEED);
    const map = new Map(out.map((p) => [p.surfaceForm, p]));
    expect(map.get("New South Wales")?.canonicalValue).toBe("NSW");
    expect(map.get("Victoria")?.canonicalValue).toBe("VIC");
    expect(map.get("Queensland")?.canonicalValue).toBe("QLD");
    expect(map.get("Western Australia")?.canonicalValue).toBe("WA");
    expect(map.get("South Australia")?.canonicalValue).toBe("SA");
    expect(map.get("Tasmania")?.canonicalValue).toBe("TAS");
    expect(map.get("Australian Capital Territory")?.canonicalValue).toBe("ACT");
    expect(map.get("Northern Territory")?.canonicalValue).toBe("NT");
    expect(out.every((p) => p.source === "system_seed")).toBe(true);
  });

  it("resolves short-form codes too (`TAS`, `NSW`)", () => {
    const out = detectValueNormalisations(
      "work_jurisdiction",
      ["TAS", "NSW", "QLD"],
      STATE_SEED,
    );
    expect(out.find((p) => p.surfaceForm === "TAS")?.canonicalValue).toBe("TAS");
    expect(out.find((p) => p.surfaceForm === "NSW")?.canonicalValue).toBe("NSW");
    expect(out.find((p) => p.surfaceForm === "QLD")?.canonicalValue).toBe("QLD");
  });

  it("is case-insensitive on the surface form", () => {
    const out = detectValueNormalisations(
      "work_jurisdiction",
      ["tasmania", "victoria"],
      STATE_SEED,
    );
    expect(out.find((p) => p.surfaceForm === "tasmania")?.canonicalValue).toBe("TAS");
    expect(out.find((p) => p.surfaceForm === "victoria")?.canonicalValue).toBe("VIC");
  });

  it("returns needs_review for unknown surface forms", () => {
    const out = detectValueNormalisations(
      "work_jurisdiction",
      ["Atlantis"],
      STATE_SEED,
    );
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("needs_review");
    expect(out[0].canonicalValue).toBeNull();
  });
});

// ─── Employment-type normalisation ──────────────────────────────────

describe("detectValueNormalisations — employment types (Virtus prefixes)", () => {
  it("resolves prefixed employment types from the Virtus fixture", () => {
    const surfaces = [
      "CA - Casual",
      "FP - Full Time Salaried",
      "PT - Part-time Salary",
      "Casual",
      "Full Time",
    ];
    const out = detectValueNormalisations("employment_type", surfaces, EMPLOYMENT_SEED);
    const map = new Map(out.map((p) => [p.surfaceForm, p]));
    expect(map.get("CA - Casual")?.canonicalValue).toBe("casual");
    expect(map.get("FP - Full Time Salaried")?.canonicalValue).toBe("full_time");
    expect(map.get("PT - Part-time Salary")?.canonicalValue).toBe("part_time");
    expect(map.get("Casual")?.canonicalValue).toBe("casual");
    expect(map.get("Full Time")?.canonicalValue).toBe("full_time");
  });
});

// ─── Pay-frequency normalisation ────────────────────────────────────

describe("detectValueNormalisations — pay frequencies", () => {
  it("resolves common pay-frequency words", () => {
    const out = detectValueNormalisations(
      "pay_frequency",
      ["Weekly", "fortnightly", "Bi-weekly", "monthly"],
      FREQUENCY_SEED,
    );
    const map = new Map(out.map((p) => [p.surfaceForm, p]));
    expect(map.get("Weekly")?.canonicalValue).toBe("weekly");
    expect(map.get("fortnightly")?.canonicalValue).toBe("fortnightly");
    expect(map.get("Bi-weekly")?.canonicalValue).toBe("fortnightly");
    expect(map.get("monthly")?.canonicalValue).toBe("monthly");
  });
});

// ─── Org-scoped shadowing ───────────────────────────────────────────

describe("detectValueNormalisations — org-scoped shadowing (spec §4.4)", () => {
  it("org-scoped row overrides system row at the same (target_field, surface_form)", () => {
    const orgId = "11111111-1111-1111-1111-111111111111";
    const aliases: ValueNormaliseAliasRow[] = [
      makeAlias("work_jurisdiction", "Tasmania", "TAS"),
      makeAlias("work_jurisdiction", "Tasmania", "TAS_ORG_OVERRIDE", {
        orgId,
        confidence: 1.0,
      }),
    ];
    const out = detectValueNormalisations(
      "work_jurisdiction",
      ["Tasmania"],
      aliases,
    );
    expect(out[0].canonicalValue).toBe("TAS_ORG_OVERRIDE");
    expect(out[0].source).toBe("historical");
    expect(out[0].confidence).toBe(1.0);
  });
});

// ─── OQ-ING-9 / OQ-MAP-9 — cohort cross-jurisdiction handling ───────

describe("detectValueNormalisations — OQ-ING-9 cohort cross-jurisdiction", () => {
  it("returns crossJurisdictionFlag + hintedJurisdictions for `VIC-TAS`", () => {
    const out = detectValueNormalisations(
      "work_jurisdiction",
      ["VIC-TAS"],
      STATE_SEED,
    );
    expect(out).toHaveLength(1);
    const p = out[0];
    expect(p.surfaceForm).toBe("VIC-TAS");
    expect(p.crossJurisdictionFlag).toBe(true);
    expect(p.hintedJurisdictions).toEqual(["VIC", "TAS"]);
    // OQ-ING-9 lock: canonicalValue is null — there's no single
    // canonical state. Wizard renders as multi-select pill set.
    expect(p.canonicalValue).toBeNull();
    expect(p.source).toBe("system_seed");
    expect(p.confidence).toBeGreaterThan(0.5);
  });

  it("handles 3-state cohorts like `NSW-QLD-WA`", () => {
    const out = detectValueNormalisations(
      "work_jurisdiction",
      ["NSW-QLD-WA"],
      STATE_SEED,
    );
    expect(out[0].crossJurisdictionFlag).toBe(true);
    expect(out[0].hintedJurisdictions).toEqual(["NSW", "QLD", "WA"]);
  });

  it("does NOT return a stored `states[]` array as the canonical value", () => {
    // OQ-ING-9 hard invariant. The detector must NEVER emit a
    // `canonicalValue` that is a stringified array.
    const out = detectValueNormalisations(
      "work_jurisdiction",
      ["VIC-TAS", "Victoria"],
      STATE_SEED,
    );
    for (const p of out) {
      // The proposal type forbids it at compile time, but verify at runtime too.
      if (typeof p.canonicalValue === "string") {
        expect(p.canonicalValue).not.toMatch(/^\[/); // no JSON-array string
      }
      expect(
        typeof p.canonicalValue === "string" || p.canonicalValue === null,
      ).toBe(true);
    }
  });

  it("falls back to needs_review for hyphenated values where one segment is unknown (e.g. `Sale-Tasmania`)", () => {
    const out = detectValueNormalisations(
      "work_jurisdiction",
      ["Sale-Tasmania"],
      STATE_SEED,
    );
    expect(out[0].crossJurisdictionFlag).toBeUndefined();
    expect(out[0].source).toBe("needs_review");
    expect(out[0].canonicalValue).toBeNull();
  });

  it("returns long-form `Victoria` as a single-state resolution (NOT a cohort even if hyphens exist elsewhere)", () => {
    const out = detectValueNormalisations(
      "work_jurisdiction",
      ["Victoria"],
      STATE_SEED,
    );
    expect(out[0].crossJurisdictionFlag).toBeUndefined();
    expect(out[0].canonicalValue).toBe("VIC");
  });
});

// ─── Misc ────────────────────────────────────────────────────────────

describe("detectValueNormalisations — misc", () => {
  it("deduplicates surface forms that differ only by case", () => {
    const out = detectValueNormalisations(
      "work_jurisdiction",
      ["NSW", "nsw", "Nsw"],
      STATE_SEED,
    );
    expect(out).toHaveLength(1);
  });

  it("ignores empty + whitespace-only surface forms", () => {
    const out = detectValueNormalisations(
      "work_jurisdiction",
      ["", "   ", "NSW"],
      STATE_SEED,
    );
    expect(out).toHaveLength(1);
    expect(out[0].surfaceForm).toBe("NSW");
  });

  it("returns an empty array on empty input", () => {
    expect(detectValueNormalisations("work_jurisdiction", [], FULL_SEED)).toEqual([]);
  });
});
