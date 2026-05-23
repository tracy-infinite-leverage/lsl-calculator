import type { Citation } from './types';

export class CitationList {
  private readonly items: Citation[] = [];

  add(c: Citation): this {
    this.items.push(c);
    return this;
  }

  addAll(cs: readonly Citation[]): this {
    for (const c of cs) this.items.push(c);
    return this;
  }

  /** Return citations preserving insertion order; dedup is render-layer concern. */
  toArray(): Citation[] {
    return [...this.items];
  }

  /** Dedup by section+rule+pdfPage+note. Useful for fixture comparison. */
  toDedupedArray(): Citation[] {
    const seen = new Set<string>();
    const out: Citation[] = [];
    for (const c of this.items) {
      const key = `${c.section}|${c.rule}|${c.pdfPage ?? ''}|${c.note ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
    return out;
  }
}

export function citation(
  section: string,
  rule: string,
  pdfPage?: number,
  note?: string
): Citation {
  const c: Citation = { section, rule };
  if (pdfPage !== undefined) c.pdfPage = pdfPage;
  if (note !== undefined) c.note = note;
  return c;
}

/**
 * Assert that `expected` is a subset of `actual` (membership, not equality).
 * Used by gold-standard fixtures; engine MAY emit additional citations.
 * Matches on section + rule (pdfPage/note are informational).
 */
export function hasAllCitations(
  actual: readonly Citation[],
  expected: readonly Citation[]
): { ok: boolean; missing: Citation[] } {
  const missing: Citation[] = [];
  for (const exp of expected) {
    const found = actual.some(
      (a) => a.section === exp.section && a.rule === exp.rule
    );
    if (!found) missing.push(exp);
  }
  return { ok: missing.length === 0, missing };
}
