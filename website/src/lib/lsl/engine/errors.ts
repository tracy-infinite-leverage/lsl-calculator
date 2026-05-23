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
