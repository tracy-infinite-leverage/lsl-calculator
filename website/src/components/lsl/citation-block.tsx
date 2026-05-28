import { BookOpen } from '@/components/brand/Icon';
import type { Citation } from '@/lib/lsl/engine/types';
import { cn } from '@/lib/utils';

export interface CitationBlockProps {
  citations: Citation[];
  className?: string;
}

/**
 * Stacked citation list under a numeric output. Section first; rule + PDF page second; note third.
 * Source order = visual order for screen-reader compatibility (AC11, A3).
 * Dedups by section + rule + pdfPage + note.
 */
export function CitationBlock({ citations, className }: CitationBlockProps) {
  const seen = new Set<string>();
  const deduped: Citation[] = [];
  for (const c of citations) {
    const key = `${c.section}|${c.rule}|${c.pdfPage ?? ''}|${c.note ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(c);
  }

  if (deduped.length === 0) return null;

  return (
    <ol className={cn('space-y-2 mt-2', className)} aria-label="Legislative citations">
      {deduped.map((c, i) => (
        <li
          key={i}
          className="border-l-2 border-primary/40 pl-3 text-xs leading-relaxed"
        >
          <div className="flex items-start gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold text-foreground">{c.section}</p>
              <p className="text-muted-foreground font-mono text-[11px]">
                {c.rule}
                {c.pdfPage && <> · LSL-training PDF p.{c.pdfPage}</>}
              </p>
              {c.note && <p className="text-muted-foreground italic mt-0.5">{c.note}</p>}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
