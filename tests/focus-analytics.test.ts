import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  analyticsDateKey,
  buildAnalyticsDateRange,
  retainNewestLocalDayKeys,
  shiftAnalyticsSelection,
} from '../components/focus-watch/analytics/focusAnalyticsDates';
import {
  buildFocusAnalyticsNativeRequest,
  nativeAnalyticsRequestMatchesPayload,
  type FocusAnalyticsContextPayload,
} from '../components/focus-watch/analytics/focusAnalyticsContext';
import {
  aggregateFocusLocalPeriod,
  focusEventBelongsToLocalPeriod,
  type FocusAnalyticsDayOutcome,
} from '../components/focus-watch/analytics/focusAnalyticsModel';
import {
  focusEventCalendarContext,
  getFocusEventRowsForLocalDays,
  hasFocusEventCalendarColumns,
  type EventRow,
} from '../components/focus-watch/focusWatchDb';
import {
  focusAnalyticsRequestCanCommit,
  reduceFocusAnalyticsRequest,
} from '../components/focus-watch/analytics/focusAnalyticsRequestState';
import { recordReturnedMoment } from '../components/focus-watch/dayPlanStore';

function event(kind: string, overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: `event-${kind}`,
    ts: new Date(2026, 6, 21, 12).getTime(),
    local_day: '2026-07-21',
    timezone_id: 'Europe/Belgrade',
    utc_offset_minutes: 120,
    kind,
    group_id: null,
    plan_id: 'plan-1',
    meta_json: null,
    ...overrides,
  };
}

function outcome(
  date: string,
  state: FocusAnalyticsDayOutcome['state']
): FocusAnalyticsDayOutcome {
  return {
    date,
    planId: 'plan-1',
    planName: 'Morning peace',
    targetMinutes: 240,
    hasExactPlanContext: true,
    state,
  };
}

describe('Focus Analytics calendar ranges', () => {
  test('builds a fixed Monday-through-Sunday current week with Sunday present', () => {
    const now = new Date(2026, 6, 26, 14, 20);
    const range = buildAnalyticsDateRange({
      period: 'week',
      anchorDate: analyticsDateKey(now),
    }, now, 'en-US');

    assert.equal(range.selectedStartDate, '2026-07-20');
    assert.equal(range.selectedEndDateExclusive, '2026-07-27');
    assert.deepEqual(range.expectedDayKeys, [
      '2026-07-20',
      '2026-07-21',
      '2026-07-22',
      '2026-07-23',
      '2026-07-24',
      '2026-07-25',
      '2026-07-26',
    ]);
    assert.equal(range.completeDayKeys.at(-1), '2026-07-25');
    assert.equal(range.displayLabel, 'This week');
  });

  test('uses calendar months and includes leap day', () => {
    const now = new Date(2026, 6, 28, 9);
    const range = buildAnalyticsDateRange({
      period: 'month',
      anchorDate: '2024-02-14',
    }, now, 'en-US');

    assert.equal(range.selectedStartDate, '2024-02-01');
    assert.equal(range.selectedEndDateExclusive, '2024-03-01');
    assert.equal(range.expectedDayKeys.length, 29);
    assert.equal(range.expectedDayKeys.at(-1), '2024-02-29');
    assert.equal(range.comparisonStartDate, '2024-01-01');
    assert.equal(range.comparisonEndDateExclusive, '2024-02-01');
  });

  test('keeps 30-day and 31-day months aligned to their real boundaries', () => {
    const now = new Date(2026, 6, 28, 9);
    const april = buildAnalyticsDateRange({
      period: 'month',
      anchorDate: '2026-04-12',
    }, now, 'en-US');
    const may = buildAnalyticsDateRange({
      period: 'month',
      anchorDate: '2026-05-12',
    }, now, 'en-US');

    assert.equal(april.expectedDayKeys.length, 30);
    assert.equal(april.selectedEndDateExclusive, '2026-05-01');
    assert.equal(may.expectedDayKeys.length, 31);
    assert.equal(may.selectedEndDateExclusive, '2026-06-01');
  });

  test('clamps future navigation and moves by whole calendar periods', () => {
    const now = new Date(2026, 6, 28, 9);
    const current = { period: 'month' as const, anchorDate: '2026-07-28' };

    assert.deepEqual(shiftAnalyticsSelection(current, -1, now), {
      period: 'month',
      anchorDate: '2026-06-01',
    });
    assert.deepEqual(shiftAnalyticsSelection(current, 1, now), {
      period: 'month',
      anchorDate: '2026-07-28',
    });
  });

  test('keeps today visible but excludes it from complete current-period days', () => {
    const now = new Date(2026, 6, 28, 9, 30);
    const range = buildAnalyticsDateRange({
      period: 'month',
      anchorDate: '2026-07-28',
    }, now, 'en-US');

    assert.equal(range.expectedDayKeys.length, 31);
    assert.equal(range.completeDayKeys.length, 27);
    assert.equal(range.completeDayKeys.at(-1), '2026-07-27');
    assert.equal(range.selectedEndMsExclusive, now.getTime() + 1);
    assert.equal(range.comparisonStartDate, '2026-06-01');
    assert.equal(range.comparisonEndDateExclusive, '2026-07-01');
  });

  test('does not invent a Day comparison', () => {
    const range = buildAnalyticsDateRange({
      period: 'day',
      anchorDate: '2026-07-21',
    }, new Date(2026, 6, 28, 9), 'en-US');

    assert.equal(range.comparisonStartDate, null);
    assert.equal(range.comparisonEndDateExclusive, null);
    assert.equal(range.completeDayKeys.length, 1);
    assert.equal(range.displayLabel, 'Tuesday · July 21');
  });

  test('uses local calendar boundaries across 23-hour and 25-hour DST days', () => {
    const spring = buildAnalyticsDateRange({
      period: 'day',
      anchorDate: '2026-03-29',
    }, new Date(2026, 6, 28, 9), 'en-US');
    const autumn = buildAnalyticsDateRange({
      period: 'day',
      anchorDate: '2026-10-25',
    }, new Date(2026, 11, 1, 9), 'en-US');

    assert.equal(
      spring.selectedEndMsExclusive - spring.selectedStartMsInclusive,
      23 * 60 * 60_000
    );
    assert.equal(
      autumn.selectedEndMsExclusive - autumn.selectedStartMsInclusive,
      25 * 60 * 60_000
    );
  });

  test('keeps a leap year as a calendar year rather than 365 rolling days', () => {
    const range = buildAnalyticsDateRange({
      period: 'year',
      anchorDate: '2024-08-10',
    }, new Date(2026, 6, 28, 9), 'en-US');

    assert.equal(range.selectedStartDate, '2024-01-01');
    assert.equal(range.selectedEndDateExclusive, '2025-01-01');
    assert.equal(range.expectedDayKeys.length, 366);
  });

  test('keeps the newest 800 local-day metadata keys at the exact boundary', () => {
    const keys: string[] = [];
    for (
      let cursor = new Date(2024, 0, 1, 12);
      keys.length < 802;
      cursor = new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate() + 1,
        12
      )
    ) {
      keys.push(analyticsDateKey(cursor));
    }
    const retained = retainNewestLocalDayKeys([
      keys[0],
      ...keys,
      keys.at(-1)!,
    ]);

    assert.equal(retained.length, 800);
    assert.equal(retained[0], keys[2]);
    assert.equal(retained.at(-1), keys.at(-1));
    assert.ok(retained.includes('2024-02-29'));
  });
});

describe('Focus Analytics local summaries', () => {
  test('uses idempotent event migrations and writes original local-day context', async () => {
    const calls = global.__focusTestDb.calls as {
      kind: string;
      sql: string;
      params?: unknown[];
    }[];
    const migrationSql = calls
      .filter(call => call.kind === 'exec')
      .map(call => call.sql)
      .join('\n');
    assert.match(migrationSql, /ADD COLUMN local_day TEXT/);
    assert.match(migrationSql, /ADD COLUMN timezone_id TEXT/);
    assert.match(migrationSql, /ADD COLUMN utc_offset_minutes INTEGER/);
    assert.match(
      migrationSql,
      /CREATE INDEX IF NOT EXISTS idx_focus_watch_events_local_day/
    );
    assert.ok(calls.some(call =>
      call.kind === 'select'
      && call.sql.includes('PRAGMA table_info(focus_watch_events)')
    ));
    assert.equal(hasFocusEventCalendarColumns([
      { name: 'local_day' },
      { name: 'timezone_id' },
      { name: 'utc_offset_minutes' },
    ]), true);
    assert.equal(hasFocusEventCalendarColumns([
      { name: 'local_day' },
      { name: 'timezone_id' },
    ]), false);

    const before = calls.length;
    recordReturnedMoment('social');
    const deadline = Date.now() + 1_000;
    let write: (typeof calls)[number] | undefined;
    while (Date.now() < deadline) {
      write = calls.slice(before).find(call =>
        call.kind === 'write'
        && call.sql.includes('INSERT OR IGNORE INTO focus_watch_events')
      );
      if (write) break;
      await new Promise(resolve => setTimeout(resolve, 5));
    }

    assert.ok(write);
    assert.match(String(write.params?.[2]), /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(typeof write.params?.[3], 'string');
    assert.equal(typeof write.params?.[4], 'number');
    assert.equal(write.params?.[5], 'returned');

    const queryStart = calls.length;
    await getFocusEventRowsForLocalDays({
      startDayInclusive: '2026-07-20',
      endDayExclusive: '2026-07-27',
      legacyStartMsInclusive: 100,
      legacyEndMsExclusive: 200,
    });
    const query = calls.slice(queryStart).find(call =>
      call.kind === 'select'
      && call.sql.includes('FROM focus_watch_events')
    );
    assert.ok(query);
    assert.match(query.sql, /local_day >= \? AND local_day < \?/);
    assert.match(query.sql, /local_day IS NULL/);
    assert.deepEqual(query.params, [
      '2026-07-20',
      '2026-07-27',
      100,
      200,
    ]);
  });

  test('preserves write-time day across Belgrade and New York travel', () => {
    const timestamp = Date.parse('2026-07-28T22:30:00.000Z');
    assert.deepEqual(
      focusEventCalendarContext(timestamp, 'Europe/Belgrade'),
      {
        localDay: '2026-07-29',
        timezoneId: 'Europe/Belgrade',
        utcOffsetMinutes: 120,
      }
    );
    assert.deepEqual(
      focusEventCalendarContext(timestamp, 'America/New_York'),
      {
        localDay: '2026-07-28',
        timezoneId: 'America/New_York',
        utcOffsetMinutes: -240,
      }
    );
  });

  test('assigns local-day rows exactly and legacy rows by timestamp fallback', () => {
    const bounds = {
      startDayInclusive: '2026-07-20',
      endDayExclusive: '2026-07-27',
      legacyStartMsInclusive: 1_000,
      legacyEndMsExclusive: 2_000,
    };
    assert.equal(focusEventBelongsToLocalPeriod(
      event('returned', { local_day: '2026-07-26', ts: 99_999 }),
      bounds
    ), true);
    assert.equal(focusEventBelongsToLocalPeriod(
      event('returned', { local_day: '2026-07-27', ts: 1_500 }),
      bounds
    ), false);
    assert.equal(focusEventBelongsToLocalPeriod(
      event('returned', { local_day: null, ts: 1_999 }),
      bounds
    ), true);
    assert.equal(focusEventBelongsToLocalPeriod(
      event('returned', { local_day: null, ts: 2_000 }),
      bounds
    ), false);
  });

  test('counts only supported event semantics and target outcomes', () => {
    const summary = aggregateFocusLocalPeriod([
      event('returned'),
      event('door_opened'),
      event('checkin_continued'),
      event('limit_exceeded'),
      event('zone_breach'),
      event('quiet_started'),
      event('quiet_ended'),
      event('attempt'),
    ], [
      outcome('2026-07-20', 'kept'),
      outcome('2026-07-21', 'broken'),
      outcome('2026-07-22', 'pending'),
      outcome('2026-07-23', 'off'),
    ]);

    assert.equal(summary.resolvedTargetDays, 2);
    assert.equal(summary.keptTargetDays, 1);
    assert.equal(summary.brokenTargetDays, 1);
    assert.equal(summary.returnedMoments, 1);
    assert.equal(summary.doorOpened, 1);
    assert.equal(summary.checkinsContinued, 1);
    assert.equal(summary.limitExceeded, 1);
    assert.equal(summary.zoneBreaches, 1);
    assert.equal(summary.quietHoursStarted, 1);
    assert.equal(summary.ignoredEventRows, 2);
  });

  test('isolates malformed metadata and marks legacy calendar approximation', () => {
    const summary = aggregateFocusLocalPeriod([
      event('returned', {
        id: 'bad',
        local_day: null,
        timezone_id: null,
        utc_offset_minutes: null,
        meta_json: '{not-json',
      }),
      event('returned', { id: 'good', meta_json: '{"source":"intervention"}' }),
    ], []);

    assert.equal(summary.returnedMoments, 1);
    assert.equal(summary.malformedEventRows, 1);
    assert.equal(summary.legacyCalendarApproximation, true);
  });

  test('deduplicates event ids and excludes ambiguous legacy rows from Day claims', () => {
    const duplicate = event('returned', { id: 'same-event' });
    const legacy = event('door_opened', {
      id: 'legacy-boundary',
      local_day: null,
      timezone_id: null,
      utc_offset_minutes: null,
    });
    const summary = aggregateFocusLocalPeriod(
      [duplicate, duplicate, legacy],
      [],
      { excludeLegacyDayRows: true }
    );

    assert.equal(summary.returnedMoments, 1);
    assert.equal(summary.doorOpened, 0);
    assert.equal(summary.legacyCalendarApproximation, true);
    assert.equal(summary.ignoredEventRows, 2);
  });

});

describe('Focus Analytics request contract', () => {
  test('encodes only the versioned native request and detects stale identity', () => {
    const payload: FocusAnalyticsContextPayload = {
      schemaVersion: 1,
      requestId: 'analytics-request-7',
      generatedAt: new Date(2026, 6, 28, 9).getTime(),
      timezone: 'Europe/Belgrade',
      locale: 'en-US',
      period: 'week',
      selectedStartDate: '2026-07-27',
      selectedEndDateExclusive: '2026-08-03',
      comparisonStartDate: '2026-07-20',
      comparisonEndDateExclusive: '2026-07-27',
      selected: {
        resolvedTargetDays: 1,
        keptTargetDays: 1,
        brokenTargetDays: 0,
        returnedMoments: 0,
        doorOpened: 0,
        checkinsContinued: 0,
        limitExceeded: 0,
        zoneBreaches: 0,
        quietHoursStarted: 0,
      },
      comparison: null,
      dayOutcomes: [],
      quality: {
        legacyCalendarApproximation: false,
        malformedEventRows: 0,
        ignoredEventRows: 0,
      },
    };
    const request = buildFocusAnalyticsNativeRequest(payload);

    assert.deepEqual(Object.keys(request).sort(), [
      'comparisonEndDateExclusive',
      'comparisonStartDate',
      'period',
      'requestId',
      'schemaVersion',
      'selectedEndDateExclusive',
      'selectedStartDate',
      'timezone',
    ]);
    assert.equal(nativeAnalyticsRequestMatchesPayload(request, payload), true);
    assert.equal(nativeAnalyticsRequestMatchesPayload({
      ...request,
      requestId: 'stale-request',
    }, payload), false);
    assert.equal(nativeAnalyticsRequestMatchesPayload({
      ...request,
      selectedStartDate: '2026-07-20',
    }, payload), false);
  });

  test('latest request wins even when an older request resolves last', () => {
    let state = {
      latestGeneration: 0,
      committed: null as string | null,
    };
    state = reduceFocusAnalyticsRequest(state, {
      type: 'started',
      generation: 1,
    });
    state = reduceFocusAnalyticsRequest(state, {
      type: 'started',
      generation: 2,
    });
    state = reduceFocusAnalyticsRequest(state, {
      type: 'resolved',
      generation: 1,
      value: 'stale',
    });
    assert.equal(state.committed, null);
    state = reduceFocusAnalyticsRequest(state, {
      type: 'resolved',
      generation: 2,
      value: 'current',
    });
    assert.equal(state.committed, 'current');
    state = reduceFocusAnalyticsRequest(state, {
      type: 'invalidated',
      generation: 3,
    });
    assert.equal(state.committed, null);
    assert.equal(focusAnalyticsRequestCanCommit(3, 3, false), true);
    assert.equal(focusAnalyticsRequestCanCommit(2, 3, false), false);
    assert.equal(focusAnalyticsRequestCanCommit(3, 3, true), false);
  });
});
