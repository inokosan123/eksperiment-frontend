import type { EventRow } from '../focusWatchDb';

export type FocusAnalyticsDayOutcomeState =
  | 'kept'
  | 'broken'
  | 'pending'
  | 'off'
  | 'noTarget'
  | 'unresolved';

export type FocusAnalyticsDayOutcome = {
  date: string;
  planId: string | null;
  planName: string | null;
  targetMinutes: number | null;
  hasExactPlanContext: boolean;
  state: FocusAnalyticsDayOutcomeState;
};

export type FocusLocalPeriodSummary = {
  resolvedTargetDays: number;
  keptTargetDays: number;
  brokenTargetDays: number;
  returnedMoments: number;
  doorOpened: number;
  checkinsContinued: number;
  limitExceeded: number;
  zoneBreaches: number;
  quietHoursStarted: number;
  malformedEventRows: number;
  ignoredEventRows: number;
  legacyCalendarApproximation: boolean;
};

const COUNTED_EVENT_KINDS = new Set([
  'returned',
  'door_opened',
  'checkin_continued',
  'limit_exceeded',
  'zone_breach',
  'quiet_started',
]);

export function focusEventBelongsToLocalPeriod(
  row: EventRow,
  input: {
    startDayInclusive: string;
    endDayExclusive: string;
    legacyStartMsInclusive: number;
    legacyEndMsExclusive: number;
  }
) {
  if (row.local_day != null) {
    return row.local_day >= input.startDayInclusive
      && row.local_day < input.endDayExclusive;
  }
  return row.ts >= input.legacyStartMsInclusive
    && row.ts < input.legacyEndMsExclusive;
}

export function emptyFocusLocalPeriodSummary(): FocusLocalPeriodSummary {
  return {
    resolvedTargetDays: 0,
    keptTargetDays: 0,
    brokenTargetDays: 0,
    returnedMoments: 0,
    doorOpened: 0,
    checkinsContinued: 0,
    limitExceeded: 0,
    zoneBreaches: 0,
    quietHoursStarted: 0,
    malformedEventRows: 0,
    ignoredEventRows: 0,
    legacyCalendarApproximation: false,
  };
}

function hasValidMetadata(row: EventRow) {
  if (row.meta_json == null || row.meta_json === '') return true;
  try {
    const parsed: unknown = JSON.parse(row.meta_json);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

export function aggregateFocusLocalPeriod(
  events: readonly EventRow[],
  dayOutcomes: readonly FocusAnalyticsDayOutcome[],
  options: {
    excludeLegacyDayRows?: boolean;
  } = {}
): FocusLocalPeriodSummary {
  const summary = emptyFocusLocalPeriodSummary();
  const seenEventIds = new Set<string>();

  for (const outcome of dayOutcomes) {
    if (outcome.state === 'kept') summary.keptTargetDays += 1;
    if (outcome.state === 'broken') summary.brokenTargetDays += 1;
  }
  summary.resolvedTargetDays = summary.keptTargetDays + summary.brokenTargetDays;

  for (const row of events) {
    if (seenEventIds.has(row.id)) {
      summary.ignoredEventRows += 1;
      continue;
    }
    seenEventIds.add(row.id);
    if (row.local_day == null) {
      summary.legacyCalendarApproximation = true;
      if (options.excludeLegacyDayRows) {
        summary.ignoredEventRows += 1;
        continue;
      }
    }
    if (!hasValidMetadata(row)) {
      summary.malformedEventRows += 1;
      continue;
    }
    if (!COUNTED_EVENT_KINDS.has(row.kind)) {
      summary.ignoredEventRows += 1;
      continue;
    }
    if (row.kind === 'returned') summary.returnedMoments += 1;
    else if (row.kind === 'door_opened') summary.doorOpened += 1;
    else if (row.kind === 'checkin_continued') summary.checkinsContinued += 1;
    else if (row.kind === 'limit_exceeded') summary.limitExceeded += 1;
    else if (row.kind === 'zone_breach') summary.zoneBreaches += 1;
    else if (row.kind === 'quiet_started') summary.quietHoursStarted += 1;
  }

  return summary;
}
