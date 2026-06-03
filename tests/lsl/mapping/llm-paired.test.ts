/**
 * E5.3 Phase 0 / Task T0.4 — paired-fixture test harness skeleton (AC-MAP-16).
 *
 * Spec ref:  .specify/features/005-lsl-platform/sub-specs/pay-code-mapping.md §7 AC-MAP-16
 * Plan ref:  .specify/features/005-lsl-platform/sub-specs/pay-code-mapping-impl-plan.md §3.0.4
 * Tasks ref: .specify/features/005-lsl-platform/sub-specs/pay-code-mapping-tasks.md T0.4 + T3.6
 *
 * This file is a SKELETON committed in Phase 0. Real assertions land with Phase 3
 * (T3.6) once the deterministic Pass 1 + LLM Pass 2 detection modules are in place.
 *
 * Contract under test (AC-MAP-16):
 *   - Run the same fixture twice — once with `ANTHROPIC_API_KEY` set, once with
 *     it cleared.
 *   - The LLM-set run produces `> 0` proposals with `source = 'llm_suggested'`.
 *   - The LLM-unset run produces `0` such proposals (deterministic suggestions
 *     only).
 *   - Neither run throws an exception — both produce a valid wizard surface.
 *   - LLM calls in CI are replayed from a recorded fixture (VCR-style); no live
 *     Anthropic calls in CI.
 *
 * Until Phase 3 lands, the tests below are skipped via `it.skip()` and exist
 * only to:
 *   1. Reserve the test file path the spec references.
 *   2. Capture the fixture-pairing contract so the Phase 3 dispatch implements
 *      against a frozen test surface.
 *   3. Provide an importable type for the proposal shape.
 */

import { describe, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Fixture paths — pinned to the canonical Virtus 3-sheet Excel and 3-CSV
// relational drop. Resolved relative to the repo root so the harness runs
// the same from CI and from `npm test` locally.
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const VIRTUS_FIXTURE_DIR = resolve(REPO_ROOT, 'tests', 'fixtures', 'pay-code-mapping', 'virtus');

const FIXTURE_PATHS = {
  excelMultiSheet: resolve(VIRTUS_FIXTURE_DIR, 'virtus-3sheet.xlsx'),
  payHistoryCsv: resolve(VIRTUS_FIXTURE_DIR, 'virtus-payhistory.csv'),
  payRateHistoryCsv: resolve(VIRTUS_FIXTURE_DIR, 'virtus-payratehistory.csv'),
  positionHistoryCsv: resolve(VIRTUS_FIXTURE_DIR, 'virtus-positionhistory.csv'),
} as const;

// Proposal shape — placeholder until Phase 2 defines the real type.
// Phase 2 (T2.1) will export this from `website/src/lib/lsl/mapping/detect/`.
type ProposalSource =
  | 'auto_mapped'
  | 'historical'
  | 'llm_suggested'
  | 'needs_review';

interface Proposal {
  surface_id: string;
  surface_kind: 'sheet' | 'file_relationship' | 'column' | 'value' | 'pay_code';
  raw: string;
  suggestion: string | null;
  confidence: number;
  source: ProposalSource;
}

/**
 * Placeholder for the unified detection entry point. Phase 2 + 3 implement this.
 * Signature pinned here so Phase 3 has a frozen test surface to target.
 */
declare function runDetection(
  filePaths: string[],
  options: { anthropicApiKey: string | undefined }
): Promise<Proposal[]>;

// Verify fixtures exist at module-load time — surface a clear error if the
// anonymisation script wasn't run before the test invocation.
function assertFixturesExist(): void {
  for (const [name, path] of Object.entries(FIXTURE_PATHS)) {
    try {
      readFileSync(path);
    } catch {
      throw new Error(
        `Missing fixture '${name}' at ${path}. Run ` +
          `\`python3 tests/fixtures/pay-code-mapping/virtus/.anonymise.py\` to regenerate.`
      );
    }
  }
}

describe('AC-MAP-16 paired-fixture — LLM-set vs LLM-unset (Phase 3 unblock)', () => {
  // Skeleton-only. Phase 3 (T3.6) replaces .skip with .skipIf(noEnv) and adds
  // real assertions against the runDetection() output shape.

  it.skip('LLM-set run: produces > 0 llm_suggested proposals against Virtus 3-sheet', async () => {
    assertFixturesExist();
    const proposals = await runDetection([FIXTURE_PATHS.excelMultiSheet], {
      anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? 'fake-replay-key',
    });
    const llmCount = proposals.filter((p) => p.source === 'llm_suggested').length;
    // expect(llmCount).toBeGreaterThan(0);
    void llmCount;
  });

  it.skip('LLM-unset run: produces 0 llm_suggested proposals, valid surface', async () => {
    assertFixturesExist();
    const proposals = await runDetection([FIXTURE_PATHS.excelMultiSheet], {
      anthropicApiKey: undefined,
    });
    const llmCount = proposals.filter((p) => p.source === 'llm_suggested').length;
    // expect(llmCount).toBe(0);
    // expect(proposals.length).toBeGreaterThan(0); // deterministic still surfaces something
    void llmCount;
  });

  it.skip('Both runs surface the same underlying unresolved set (LLM only adds suggestions, not surfaces)', async () => {
    assertFixturesExist();
    const llmOn = await runDetection([FIXTURE_PATHS.excelMultiSheet], {
      anthropicApiKey: 'fake-replay-key',
    });
    const llmOff = await runDetection([FIXTURE_PATHS.excelMultiSheet], {
      anthropicApiKey: undefined,
    });
    const surfacesOn = new Set(llmOn.map((p) => p.surface_id));
    const surfacesOff = new Set(llmOff.map((p) => p.surface_id));
    // expect(surfacesOn).toEqual(surfacesOff);
    void surfacesOn;
    void surfacesOff;
  });

  it.skip('Multi-file relational drop: same paired contract holds for 3-CSV Virtus shape', async () => {
    assertFixturesExist();
    const proposals = await runDetection(
      [
        FIXTURE_PATHS.payHistoryCsv,
        FIXTURE_PATHS.payRateHistoryCsv,
        FIXTURE_PATHS.positionHistoryCsv,
      ],
      { anthropicApiKey: undefined }
    );
    // expect(proposals).toBeDefined();
    void proposals;
  });
});
