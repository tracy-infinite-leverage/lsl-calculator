export class EngineError extends Error {
  constructor(
    public readonly code: string,
    public readonly userMessage: string
  ) {
    super(userMessage);
    this.name = 'EngineError';
  }
}

export class InvalidInputError extends EngineError {
  constructor(userMessage: string) {
    super('invalid_input', userMessage);
    this.name = 'InvalidInputError';
  }
}

export class JurisdictionBlockedError extends EngineError {
  constructor(userMessage: string) {
    super('blocked_cross_jurisdiction', userMessage);
    this.name = 'JurisdictionBlockedError';
  }
}

export class UnclassifiableError extends EngineError {
  constructor(userMessage: string) {
    super('unclassifiable', userMessage);
    this.name = 'UnclassifiableError';
  }
}

export class SplitLeaveNotSupportedError extends EngineError {
  constructor() {
    super(
      'split_leave_not_supported_v1',
      'Splitting a single LSL request across multiple periods is not supported in v1. Take the leave as one continuous period, or run separate calculations for each period.'
    );
    this.name = 'SplitLeaveNotSupportedError';
  }
}

/**
 * Thrown when a state's rule set does not yet support the `cash_out` trigger variant.
 *
 * Default behaviour for every state except VIC (Phase 3) and NT (Phase 9).
 * Bulk-mode callers see this as a row-level `failed` Result; the form layer
 * never sends a `cash_out` trigger for an unsupported state because the
 * trigger UI is gated to states that implement it.
 */
export class CashOutNotSupportedError extends EngineError {
  constructor(state: string) {
    super(
      'cash_out_not_supported',
      `Cashing-out is not supported for ${state} in this version. VIC and NT will implement cashing-out hard-error handling in a later release; other states either disallow cashing-out outright or do not yet have it encoded.`
    );
    this.name = 'CashOutNotSupportedError';
  }
}

/**
 * Thrown when VIC receives a `cash_out` trigger.
 *
 * Cashing-out LSL during ongoing employment is a CRIMINAL OFFENCE under VIC
 * LSL Act 2018 s.34 (12 penalty units / 60 penalty units body corporate).
 * Both s.34(1) (employer) and s.34(2) (employee) create offences. The
 * calculator MUST refuse to produce a numeric result and MUST NOT log input
 * PII per spec S2.
 *
 * Citation s.34 (corrected from APA training PDF's s.67 — TBD-VIC-12).
 * Lawful alternatives: s.9 termination payout, s.22 half-pay.
 */
export class VICCashOutProhibitedError extends EngineError {
  constructor() {
    super(
      'vic_cashout_prohibited',
      'Cashing out long service leave during employment is a criminal offence in Victoria under section 34 of the Long Service Leave Act 2018. The calculator cannot produce a value for a cash-out scenario. To pay out unused LSL at the end of employment, use the termination trigger instead. To allow an employee to take leave and continue working at a reduced pay, see the half-pay option under section 22.'
    );
    this.name = 'VICCashOutProhibitedError';
  }
}
