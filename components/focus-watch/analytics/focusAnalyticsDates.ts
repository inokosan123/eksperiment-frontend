export type FocusAnalyticsPeriod = 'day' | 'week' | 'month' | 'year';

export type FocusAnalyticsSelection = {
  period: FocusAnalyticsPeriod;
  anchorDate: string;
};

export type FocusAnalyticsDateRange = {
  period: FocusAnalyticsPeriod;
  anchorDate: string;
  selectedStartDate: string;
  selectedEndDateExclusive: string;
  comparisonStartDate: string | null;
  comparisonEndDateExclusive: string | null;
  selectedStartMsInclusive: number;
  selectedEndMsExclusive: number;
  comparisonStartMsInclusive: number | null;
  comparisonEndMsExclusive: number | null;
  expectedDayKeys: string[];
  completeDayKeys: string[];
  includesToday: boolean;
  isCurrentPeriod: boolean;
  canMoveForward: boolean;
  displayLabel: string;
  accessibilityLabel: string;
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function analyticsDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function analyticsDateFromKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  if (!year || !month || !day) return new Date(NaN);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function retainNewestLocalDayKeys(
  keys: readonly string[],
  limit = 800
) {
  if (!Number.isInteger(limit) || limit < 1) return [];
  return [...new Set(keys)].sort().slice(-limit);
}

function validDateFromKey(key: string, fallback: Date) {
  const parsed = analyticsDateFromKey(key);
  return Number.isNaN(parsed.getTime())
    ? new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate(), 12)
    : parsed;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addLocalDays(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount, 12);
}

function mondayStart(date: Date) {
  const mondayOffset = (date.getDay() + 6) % 7;
  return addLocalDays(date, -mondayOffset);
}

function periodStart(period: FocusAnalyticsPeriod, anchor: Date) {
  if (period === 'day') return addLocalDays(anchor, 0);
  if (period === 'week') return mondayStart(anchor);
  if (period === 'month') return new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12);
  return new Date(anchor.getFullYear(), 0, 1, 12);
}

function nextPeriodStart(period: FocusAnalyticsPeriod, start: Date) {
  if (period === 'day') return addLocalDays(start, 1);
  if (period === 'week') return addLocalDays(start, 7);
  if (period === 'month') return new Date(start.getFullYear(), start.getMonth() + 1, 1, 12);
  return new Date(start.getFullYear() + 1, 0, 1, 12);
}

function previousPeriodStart(period: FocusAnalyticsPeriod, start: Date) {
  if (period === 'day') return null;
  if (period === 'week') return addLocalDays(start, -7);
  if (period === 'month') return new Date(start.getFullYear(), start.getMonth() - 1, 1, 12);
  return new Date(start.getFullYear() - 1, 0, 1, 12);
}

function enumerateDayKeys(start: Date, endExclusive: Date) {
  const result: string[] = [];
  for (let cursor = start; cursor < endExclusive; cursor = addLocalDays(cursor, 1)) {
    result.push(analyticsDateKey(cursor));
  }
  return result;
}

function formatRange(
  period: FocusAnalyticsPeriod,
  start: Date,
  endExclusive: Date,
  isCurrent: boolean,
  locale?: string
) {
  const end = addLocalDays(endExclusive, -1);
  if (period === 'day') {
    const weekday = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
    }).format(start);
    const date = new Intl.DateTimeFormat(locale, {
      month: 'long',
      day: 'numeric',
    }).format(start);
    const todayLabel = new Intl.DateTimeFormat(locale, {
      month: 'long',
      day: 'numeric',
    }).format(start);
    return {
      display: isCurrent ? `Today · ${todayLabel}` : `${weekday} · ${date}`,
      accessibility: isCurrent ? `Today, ${todayLabel}` : `${weekday}, ${date}`,
    };
  }
  if (period === 'week') {
    if (isCurrent) return { display: 'This week', accessibility: 'This week' };
    const sameMonth = start.getMonth() === end.getMonth();
    const startText = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
    }).format(start);
    const endText = new Intl.DateTimeFormat(locale, sameMonth
      ? { day: 'numeric' }
      : { month: 'short', day: 'numeric' }).format(end);
    return {
      display: `${startText}–${endText}`,
      accessibility: `${startText} through ${endText}`,
    };
  }
  if (period === 'month') {
    const value = new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
    }).format(start);
    return { display: value, accessibility: value };
  }
  const value = String(start.getFullYear());
  return { display: value, accessibility: `Year ${value}` };
}

export function buildAnalyticsDateRange(
  selection: FocusAnalyticsSelection,
  now = new Date(),
  locale?: string
): FocusAnalyticsDateRange {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const requestedAnchor = validDateFromKey(selection.anchorDate, today);
  const anchor = requestedAnchor > today ? today : requestedAnchor;
  const selectedStart = periodStart(selection.period, anchor);
  const selectedEnd = nextPeriodStart(selection.period, selectedStart);
  const currentStart = periodStart(selection.period, today);
  const isCurrentPeriod = analyticsDateKey(selectedStart) === analyticsDateKey(currentStart);
  const includesToday = today >= selectedStart && today < selectedEnd;
  const comparisonStart = previousPeriodStart(selection.period, selectedStart);
  const comparisonEnd = comparisonStart
    ? nextPeriodStart(selection.period, comparisonStart)
    : null;
  const selectedEndMsExclusive = includesToday
    ? now.getTime() + 1
    : startOfLocalDay(selectedEnd).getTime();
  const expectedDayKeys = enumerateDayKeys(selectedStart, selectedEnd);
  const completeEnd = includesToday ? today : selectedEnd;
  const completeDayKeys = enumerateDayKeys(selectedStart, completeEnd);
  const labels = formatRange(
    selection.period,
    selectedStart,
    selectedEnd,
    isCurrentPeriod,
    locale
  );

  return {
    period: selection.period,
    anchorDate: analyticsDateKey(anchor),
    selectedStartDate: analyticsDateKey(selectedStart),
    selectedEndDateExclusive: analyticsDateKey(selectedEnd),
    comparisonStartDate: comparisonStart ? analyticsDateKey(comparisonStart) : null,
    comparisonEndDateExclusive: comparisonEnd ? analyticsDateKey(comparisonEnd) : null,
    selectedStartMsInclusive: startOfLocalDay(selectedStart).getTime(),
    selectedEndMsExclusive,
    comparisonStartMsInclusive: comparisonStart
      ? startOfLocalDay(comparisonStart).getTime()
      : null,
    comparisonEndMsExclusive: comparisonEnd
      ? startOfLocalDay(comparisonEnd).getTime()
      : null,
    expectedDayKeys,
    completeDayKeys,
    includesToday,
    isCurrentPeriod,
    canMoveForward: !isCurrentPeriod,
    displayLabel: labels.display,
    accessibilityLabel: labels.accessibility,
  };
}

export function shiftAnalyticsSelection(
  selection: FocusAnalyticsSelection,
  amount: number,
  now = new Date()
): FocusAnalyticsSelection {
  const range = buildAnalyticsDateRange(selection, now);
  const start = analyticsDateFromKey(range.selectedStartDate);
  let shifted: Date;
  if (selection.period === 'day') shifted = addLocalDays(start, amount);
  else if (selection.period === 'week') shifted = addLocalDays(start, amount * 7);
  else if (selection.period === 'month') {
    shifted = new Date(start.getFullYear(), start.getMonth() + amount, 1, 12);
  } else {
    shifted = new Date(start.getFullYear() + amount, 0, 1, 12);
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  return {
    period: selection.period,
    anchorDate: analyticsDateKey(shifted > today ? today : shifted),
  };
}

export function selectionForPeriod(
  period: FocusAnalyticsPeriod,
  now = new Date()
): FocusAnalyticsSelection {
  return { period, anchorDate: analyticsDateKey(now) };
}
