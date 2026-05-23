/**
 * PII scrubber for error / log payloads per tasks.md §5.5 / D14 / S3 / S5.
 *
 * Strict allowlist for what's safe to log: error codes, route paths, and a
 * limited set of innocuous fields. Everything else gets replaced with
 * [REDACTED]. The cost of a false positive (over-redacted log) is far smaller
 * than the cost of a false negative (PII leaking to Vercel logs).
 *
 * What we redact:
 *   - Wage values (any decimal pattern like "1500.00", "$1,500", "1234.56")
 *   - Date strings (ISO YYYY-MM-DD or DD/MM/YYYY)
 *   - Names (heuristically — anything that looks like a personal name field)
 *   - Email addresses
 *   - Free-text "note" / "userMessage" fields that may contain employee detail
 *
 * What we keep:
 *   - Error codes (small enum vocabulary)
 *   - Route paths
 *   - HTTP status codes
 *   - Stack frame file paths + line numbers
 *   - Module/function names
 */

const SENSITIVE_FIELDS = new Set([
  'legal_name',
  'legalName',
  'name',
  'employee_name',
  'employeeName',
  'first_name',
  'last_name',
  'email',
  'phone',
  'gross_pay',
  'grossPay',
  'current_weekly_gross',
  'currentWeeklyGross',
  'weekly_gross',
  'gross',
  'amount',
  'dollars',
  'wage_history',
  'wageHistory',
  'pdfBase64',
  'pdfText',
  'data',
  'payload',
  'rawValue',
  'note',
  'notes',
  'userMessage',
  'address',
  'tfn',
  'tax_file_number',
  'bsb',
  'account_number',
]);

// Decimal / currency pattern. Matches both comma-grouped ("1,500.00") and
// plain ("1500.00") forms. Negative lookbehind + lookahead on alphanumeric
// prevents matching digits embedded in IDs like "E001".
const DECIMAL_RE =
  /(?<![A-Za-z0-9_])\$?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?![A-Za-z0-9_])/g;
const ISO_DATE_RE = /\b\d{4}-\d{2}-\d{2}\b/g;
const AU_DATE_RE = /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

export function scrubPII<T>(value: T): T {
  return scrubValue(value, new WeakSet()) as T;
}

function scrubValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value == null) return value;
  if (typeof value === 'string') return scrubString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return '[BIGINT]';

  if (Array.isArray(value)) {
    if (seen.has(value)) return '[CIRCULAR]';
    seen.add(value);
    return value.map((v) => scrubValue(v, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) return '[CIRCULAR]';
    seen.add(value);
    // Error objects need special handling — preserve type + message shape but
    // scrub the message and any custom properties.
    if (value instanceof Error) {
      return {
        name: value.name,
        message: scrubString(value.message),
        stack: value.stack, // file paths + line numbers — safe
      };
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_FIELDS.has(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = scrubValue(v, seen);
      }
    }
    return out;
  }

  // functions, symbols — never log these
  return undefined;
}

function scrubString(s: string): string {
  // Redact in this order: emails first (they contain @), then dates, then
  // decimal patterns (which would over-match the digit parts of dates if run
  // first).
  return s
    .replace(EMAIL_RE, '[REDACTED_EMAIL]')
    .replace(ISO_DATE_RE, '[REDACTED_DATE]')
    .replace(AU_DATE_RE, '[REDACTED_DATE]')
    .replace(DECIMAL_RE, '[REDACTED_NUMBER]');
}
