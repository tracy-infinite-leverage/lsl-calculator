import { describe, it, expect } from 'vitest';
import { stateEventName } from './track';

describe('stateEventName — E2 per-state telemetry taxonomy', () => {
  it('lowercases the state and joins with the event name', () => {
    expect(stateEventName('NSW', 'calculated')).toBe('nsw_calculated');
    expect(stateEventName('VIC', 'cashout_hard_error')).toBe('vic_cashout_hard_error');
    expect(stateEventName('NT', 'cashout_hard_error')).toBe('nt_cashout_hard_error');
    expect(stateEventName('WA', 'regime_split_applied')).toBe('wa_regime_split_applied');
    expect(stateEventName('ACT', 'overtime_included_in_ordinary_pay')).toBe(
      'act_overtime_included_in_ordinary_pay'
    );
  });

  it('keeps the event-name segment verbatim (no transformation)', () => {
    // We intentionally do not collapse case or punctuation on the eventName
    // half — callers are responsible for using `lowercase_with_underscores`.
    expect(stateEventName('NSW', 'pdf_extracted')).toBe('nsw_pdf_extracted');
  });
});
