import {
  getPlanSnapshotForDate,
  type DayPlanState,
  type ScreenTimePermissionStatus,
} from '../dayPlanStore';
import { getFocusEventRowsForLocalDays } from '../focusWatchDb';
import {
  analyticsDateFromKey,
  analyticsDateKey,
  buildAnalyticsDateRange,
  type FocusAnalyticsDateRange,
  type FocusAnalyticsSelection,
} from './focusAnalyticsDates';
import {
  aggregateFocusLocalPeriod,
  type FocusAnalyticsDayOutcome,
  type FocusLocalPeriodSummary,
} from './focusAnalyticsModel';

export type FocusAnalyticsContextSummary = Pick<
  FocusLocalPeriodSummary,
  | 'resolvedTargetDays'
  | 'keptTargetDays'
  | 'brokenTargetDays'
  | 'returnedMoments'
  | 'doorOpened'
  | 'checkinsContinued'
  | 'limitExceeded'
  | 'zoneBreaches'
  | 'quietHoursStarted'
>;

export type FocusAnalyticsContextPayload = {
  schemaVersion: 1;
  requestId: string;
  generatedAt: number;
  timezone: string;
  locale: string;
  period: FocusAnalyticsSelection['period'];
  selectedStartDate: string;
  selectedEndDateExclusive: string;
  comparisonStartDate: string | null;
  comparisonEndDateExclusive: string | null;
  selected: FocusAnalyticsContextSummary;
  comparison: FocusAnalyticsContextSummary | null;
  dayOutcomes: FocusAnalyticsDayOutcome[];
  quality: {
    legacyCalendarApproximation: boolean;
    malformedEventRows: number;
    ignoredEventRows: number;
  };
};

export type PreparedFocusAnalyticsContext = {
  range: FocusAnalyticsDateRange;
  payload: FocusAnalyticsContextPayload;
  selectedSummary: FocusLocalPeriodSummary;
  comparisonSummary: FocusLocalPeriodSummary | null;
  nativeRequestJson: string;
};

export type FocusAnalyticsNativeRequest = Pick<
  FocusAnalyticsContextPayload,
  | 'schemaVersion'
  | 'requestId'
  | 'timezone'
  | 'period'
  | 'selectedStartDate'
  | 'selectedEndDateExclusive'
  | 'comparisonStartDate'
  | 'comparisonEndDateExclusive'
>;

export function buildFocusAnalyticsNativeRequest(
  payload: FocusAnalyticsContextPayload
): FocusAnalyticsNativeRequest {
  return {
    schemaVersion: payload.schemaVersion,
    requestId: payload.requestId,
    timezone: payload.timezone,
    period: payload.period,
    selectedStartDate: payload.selectedStartDate,
    selectedEndDateExclusive: payload.selectedEndDateExclusive,
    comparisonStartDate: payload.comparisonStartDate,
    comparisonEndDateExclusive: payload.comparisonEndDateExclusive,
  };
}

export function nativeAnalyticsRequestMatchesPayload(
  request: FocusAnalyticsNativeRequest,
  payload: FocusAnalyticsContextPayload
) {
  const expected = buildFocusAnalyticsNativeRequest(payload);
  return (
    request.schemaVersion === expected.schemaVersion
    && request.requestId === expected.requestId
    && request.timezone === expected.timezone
    && request.period === expected.period
    && request.selectedStartDate === expected.selectedStartDate
    && request.selectedEndDateExclusive === expected.selectedEndDateExclusive
    && request.comparisonStartDate === expected.comparisonStartDate
    && request.comparisonEndDateExclusive === expected.comparisonEndDateExclusive
  );
}

function summaryForPayload(summary: FocusLocalPeriodSummary): FocusAnalyticsContextSummary {
  return {
    resolvedTargetDays: summary.resolvedTargetDays,
    keptTargetDays: summary.keptTargetDays,
    brokenTargetDays: summary.brokenTargetDays,
    returnedMoments: summary.returnedMoments,
    doorOpened: summary.doorOpened,
    checkinsContinued: summary.checkinsContinued,
    limitExceeded: summary.limitExceeded,
    zoneBreaches: summary.zoneBreaches,
    quietHoursStarted: summary.quietHoursStarted,
  };
}

function dayOutcome(
  state: DayPlanState,
  key: string,
  permission: ScreenTimePermissionStatus,
  todayKey: string
): FocusAnalyticsDayOutcome {
  const date = analyticsDateFromKey(key);
  const record = state.days[key];
  const hasExactSnapshot = Object.prototype.hasOwnProperty.call(
    state.planSnapshotsByDate,
    key
  );
  const historicalContextUnknown = key < todayKey && !hasExactSnapshot;
  const plan = historicalContextUnknown
    ? null
    : getPlanSnapshotForDate(state, date);
  const targetMinutes = plan?.budgetMinutes ?? null;
  let outcomeState: FocusAnalyticsDayOutcome['state'];

  if (permission === 'denied') outcomeState = 'unresolved';
  else if (historicalContextUnknown) {
    if (record?.targetLost || record?.status === 'broken') outcomeState = 'broken';
    else if (record?.status === 'kept') outcomeState = 'kept';
    else if (record?.status === 'off') outcomeState = 'off';
    else outcomeState = 'unresolved';
  } else if (!plan || targetMinutes == null) outcomeState = 'noTarget';
  else if (record?.targetLost || record?.status === 'broken') outcomeState = 'broken';
  else if (record?.status === 'kept') outcomeState = 'kept';
  else if (key === todayKey || key > todayKey) outcomeState = 'pending';
  else if (record?.status === 'off') outcomeState = 'off';
  else outcomeState = 'unresolved';

  return {
    date: key,
    planId: historicalContextUnknown
      ? record?.planId ?? null
      : plan?.id ?? record?.planId ?? null,
    planName: historicalContextUnknown ? null : plan?.name ?? null,
    targetMinutes,
    hasExactPlanContext: !historicalContextUnknown,
    state: outcomeState,
  };
}

async function queryPeriodEvents(input: {
  startDay: string;
  endDayExclusive: string;
  startMs: number;
  endMs: number;
}) {
  return getFocusEventRowsForLocalDays({
    startDayInclusive: input.startDay,
    endDayExclusive: input.endDayExclusive,
    legacyStartMsInclusive: input.startMs,
    legacyEndMsExclusive: input.endMs,
  });
}

export async function prepareFocusAnalyticsContext(input: {
  state: DayPlanState;
  selection: FocusAnalyticsSelection;
  requestId: string;
  now?: Date;
  locale?: string;
}): Promise<PreparedFocusAnalyticsContext> {
  const now = input.now ?? new Date();
  const locale = input.locale
    ?? Intl.DateTimeFormat().resolvedOptions().locale
    ?? 'en-US';
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const range = buildAnalyticsDateRange(input.selection, now, locale);
  const todayKey = analyticsDateKey(now);
  const selectedOutcomes = range.expectedDayKeys.map(key =>
    dayOutcome(input.state, key, input.state.permission, todayKey)
  );
  const comparisonDayKeys = range.comparisonStartDate && range.comparisonEndDateExclusive
    ? enumerateKeys(range.comparisonStartDate, range.comparisonEndDateExclusive)
    : [];
  const comparisonOutcomes = comparisonDayKeys.map(key =>
    dayOutcome(input.state, key, input.state.permission, todayKey)
  );

  const [selectedEvents, comparisonEvents] = await Promise.all([
    queryPeriodEvents({
      startDay: range.selectedStartDate,
      endDayExclusive: range.selectedEndDateExclusive,
      startMs: range.selectedStartMsInclusive,
      endMs: range.selectedEndMsExclusive,
    }),
    range.comparisonStartDate
      && range.comparisonEndDateExclusive
      && range.comparisonStartMsInclusive != null
      && range.comparisonEndMsExclusive != null
      ? queryPeriodEvents({
          startDay: range.comparisonStartDate,
          endDayExclusive: range.comparisonEndDateExclusive,
          startMs: range.comparisonStartMsInclusive,
          endMs: range.comparisonEndMsExclusive,
        })
      : Promise.resolve([]),
  ]);

  const aggregateOptions = {
    excludeLegacyDayRows: input.selection.period === 'day',
  };
  const selectedSummary = aggregateFocusLocalPeriod(
    selectedEvents,
    selectedOutcomes,
    aggregateOptions
  );
  const comparisonSummary = comparisonDayKeys.length > 0
    ? aggregateFocusLocalPeriod(
        comparisonEvents,
        comparisonOutcomes,
        aggregateOptions
      )
    : null;
  const payload: FocusAnalyticsContextPayload = {
    schemaVersion: 1,
    requestId: input.requestId,
    generatedAt: now.getTime(),
    timezone,
    locale,
    period: input.selection.period,
    selectedStartDate: range.selectedStartDate,
    selectedEndDateExclusive: range.selectedEndDateExclusive,
    comparisonStartDate: range.comparisonStartDate,
    comparisonEndDateExclusive: range.comparisonEndDateExclusive,
    selected: summaryForPayload(selectedSummary),
    comparison: comparisonSummary ? summaryForPayload(comparisonSummary) : null,
    dayOutcomes: [...comparisonOutcomes, ...selectedOutcomes],
    quality: {
      legacyCalendarApproximation:
        selectedSummary.legacyCalendarApproximation
        || !!comparisonSummary?.legacyCalendarApproximation,
      malformedEventRows:
        selectedSummary.malformedEventRows
        + (comparisonSummary?.malformedEventRows ?? 0),
      ignoredEventRows:
        selectedSummary.ignoredEventRows
        + (comparisonSummary?.ignoredEventRows ?? 0),
    },
  };
  const nativeRequestJson = JSON.stringify(
    buildFocusAnalyticsNativeRequest(payload)
  );

  return {
    range,
    payload,
    selectedSummary,
    comparisonSummary,
    nativeRequestJson,
  };
}

function enumerateKeys(startKey: string, endKeyExclusive: string) {
  const keys: string[] = [];
  for (
    let cursor = analyticsDateFromKey(startKey);
    analyticsDateKey(cursor) < endKeyExclusive;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1, 12)
  ) {
    keys.push(analyticsDateKey(cursor));
  }
  return keys;
}
