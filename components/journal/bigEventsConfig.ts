export type BigEventRecurrence = 'none' | 'yearly';

export const BIG_EVENT_MIN_LEAD_DAYS = 1;
export const BIG_EVENT_MAX_LEAD_DAYS = 365;
export const BIG_EVENT_DEFAULT_LEAD_DAYS = 20;

export function normalizeBigEventLeadDays(value: number, recurrence: BigEventRecurrence) {
  if (recurrence !== 'yearly') return 0;
  if (!Number.isFinite(value)) return BIG_EVENT_DEFAULT_LEAD_DAYS;
  return Math.min(
    BIG_EVENT_MAX_LEAD_DAYS,
    Math.max(BIG_EVENT_MIN_LEAD_DAYS, Math.round(value)),
  );
}
