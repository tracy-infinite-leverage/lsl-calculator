/**
 * SA-specific extra-inputs.
 *
 * The SA engine accepts a handful of optional keys on `Employee.extraInputs`
 * for cases the core `Employee` shape can't carry. The engine is defensive —
 * none of these is required for a normal computation.
 *
 * Per TBD-SA-04 and TBD-SA-07 RESOLUTIONS (2026-05-25):
 *   - `sa_worker_notice_compliance` is SA-localised — no cross-state
 *     `TerminationReason` enum change (operator chose SA-localised
 *     `extraInputs` pattern over enum extension).
 *   - `sa_higher_duties_active` + `sa_higher_duties_weekly_rate` are
 *     SA-localised — operator rejected DEV-CROSS-3 per YAGNI; SA is the only
 *     state with a statutory higher-duties LSL rule today.
 *
 * See `docs/qa/test-cases-sa.md` for fixtures that exercise each key.
 */
export interface SAExtraInputs {
  /**
   * Whether the worker complied with the contractually-required notice when
   * resigning. Per SA LSL Act 1987 s.5(3), if the worker terminated their
   * employment without giving required notice ("unlawful termination by the
   * worker"), the 7-10-yr pro-rata is forfeited. SA-unique disqualifier
   * among the 5 encoded states (NSW/VIC/QLD/WA have no analogue).
   *
   * Default `true` — engine assumes the worker gave required notice unless
   * explicitly told otherwise.
   *
   * Only consulted when `trigger.reason === 'voluntary_resignation'` and
   * tenure is 7-10 yrs. Above 10 yrs the s.5(1) full-entitlement branch
   * applies regardless.
   *
   * NSW/VIC/QLD/WA: ignored.
   */
  sa_worker_notice_compliance?: boolean;

  /**
   * Whether the worker is currently acting in a higher-paid position when LSL
   * commences. Per SA LSL Act 1987 s.4 and SafeWork SA guidance — "If you are
   * acting in a higher paying position when you take leave your ordinary
   * weekly rate of pay is the new higher rate." When `true` AND
   * `sa_higher_duties_weekly_rate` is supplied, the engine uses the higher
   * rate as the ordinary weekly rate for LSL purposes.
   *
   * Default `false`/omitted — engine uses `currentWeeklyGross`.
   *
   * NSW/VIC/QLD/WA: ignored — no statutory higher-duties LSL rule.
   */
  sa_higher_duties_active?: boolean;

  /**
   * The weekly rate paid while acting in the higher-paid position. Consumed
   * only when `sa_higher_duties_active === true`. If omitted, the engine
   * falls back to `currentWeeklyGross` even if `sa_higher_duties_active`
   * is `true`.
   */
  sa_higher_duties_weekly_rate?: number | string;

  /**
   * Loaded casual hourly rate (including 25% casual loading) per SA LSL Act
   * 1987 s.4 + SafeWork SA casual-worker guidance. When set together with
   * `hoursLast156Weeks`, the casual value-of-week is computed as
   * `(hoursLast156Weeks / 156) × currentHourlyRate`. If absent, the engine
   * falls back to `currentWeeklyGross`.
   */
  currentHourlyRate?: number | string;

  /**
   * Total hours worked (including overtime) in the 156 weeks ending at the
   * prescribed date. Drives SA's 156-wk casual / part-time averaging window.
   * Per TBD-SA-05 RESOLUTION, weeks within the 156-wk window that overlap
   * approved-unpaid-leave or workers-comp absences are excluded and
   * substituted with prior worked weeks — the engine assumes the user has
   * already done this substitution before supplying this number (the form
   * carries a helper for this).
   *
   * NSW/VIC/QLD use 52 weeks. SA uses 156 weeks. The window is the SA-unique
   * arithmetic.
   */
  hoursLast156Weeks?: number;

  /**
   * Casual-seasonal-shutdown justification flag. Per TBD-SA-02 RESOLUTION:
   * the 3-month casual-continuity heuristic extends to up to 6 months when
   * the user supplies a seasonal-shutdown signal (e.g. "restaurant closes
   * Jan-Mar each year"). When `true`, the engine tolerates gaps up to
   * 6 months for casual employees. Default `false`/omitted → 3-month
   * standard heuristic.
   */
  sa_seasonal_shutdown_justified?: boolean;
}
