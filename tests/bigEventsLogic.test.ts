import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { BigEvent } from '@/components/journal/bigEventsDb';
import {
  BIG_EVENT_DEFAULT_LEAD_DAYS,
  BIG_EVENT_MAX_LEAD_DAYS,
  normalizeBigEventLeadDays,
} from '@/components/journal/bigEventsConfig';
import {
  getBigEventCountdown,
  getBigEventSectionsForDate,
  getBigEventsForDate,
  getYearlyOccurrenceDate,
  resolveBigEventForDate,
} from '@/components/journal/bigEventsLogic';

function event(patch: Partial<BigEvent> = {}): BigEvent {
  return {
    id: 'event-1',
    title: 'Family anniversary',
    startDate: '2024-09-15',
    endDate: '2024-10-05',
    color: '#C5A059',
    icon: 'ring',
    recurrence: 'yearly',
    leadDays: 20,
    remindersEnabled: true,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    ...patch,
  };
}

describe('yearly Big Events', () => {
  test('appears precisely when its lead window begins', () => {
    const source = event();
    assert.equal(getBigEventsForDate([source], '2026-09-14').length, 0);
    const visible = getBigEventsForDate([source], '2026-09-15');
    assert.equal(visible.length, 1);
    assert.equal(visible[0].startDate, '2026-09-15');
    assert.equal(visible[0].endDate, '2026-10-05');
    assert.equal(getBigEventCountdown(visible[0], '2026-09-15'), 20);
  });

  test('stays visible through the event day, then waits for next year', () => {
    const source = event();
    assert.equal(getBigEventsForDate([source], '2026-10-05').length, 1);
    assert.equal(getBigEventCountdown(source, '2026-10-05'), 0);
    assert.equal(getBigEventsForDate([source], '2026-10-06').length, 0);
    assert.equal(resolveBigEventForDate(source, '2026-10-06').endDate, '2027-10-05');
  });

  test('stays in recurring until its configured lead window begins', () => {
    const source = event();
    const beforeWindow = getBigEventSectionsForDate([source], '2026-09-14');
    assert.equal(beforeWindow.upcoming.length, 0);
    assert.equal(beforeWindow.recurring.length, 1);
    assert.equal(beforeWindow.recurring[0].endDate, '2026-10-05');

    const activeWindow = getBigEventSectionsForDate([source], '2026-09-15');
    assert.equal(activeWindow.upcoming.length, 1);
    assert.equal(activeWindow.recurring.length, 0);
  });

  test('returns to recurring after this year occurrence passes', () => {
    const sections = getBigEventSectionsForDate([event()], '2026-10-06');
    assert.equal(sections.upcoming.length, 0);
    assert.equal(sections.recurring.length, 1);
    assert.equal(sections.recurring[0].endDate, '2027-10-05');
  });

  test('clamps February 29 safely and restores it in leap years', () => {
    const leapDay = event({ endDate: '2024-02-29' });
    assert.equal(getYearlyOccurrenceDate(leapDay, 2027), '2027-02-28');
    assert.equal(getYearlyOccurrenceDate(leapDay, 2028), '2028-02-29');
  });

  test('supports a custom lead window beyond the presets', () => {
    const custom = event({ leadDays: 60 });
    assert.equal(getBigEventsForDate([custom], '2026-08-05').length, 0);
    const visible = getBigEventsForDate([custom], '2026-08-06');
    assert.equal(visible.length, 1);
    assert.equal(visible[0].leadDays, 60);
    assert.equal(visible[0].startDate, '2026-08-06');
  });

  test('normalizes invalid custom values at the domain boundary', () => {
    assert.equal(normalizeBigEventLeadDays(45.6, 'yearly'), 46);
    assert.equal(normalizeBigEventLeadDays(0, 'yearly'), 1);
    assert.equal(normalizeBigEventLeadDays(900, 'yearly'), BIG_EVENT_MAX_LEAD_DAYS);
    assert.equal(normalizeBigEventLeadDays(Number.NaN, 'yearly'), BIG_EVENT_DEFAULT_LEAD_DAYS);
    assert.equal(normalizeBigEventLeadDays(30, 'none'), 0);
  });

  test('keeps existing one-time event behavior unchanged', () => {
    const oneTime = event({
      recurrence: 'none',
      startDate: '2026-07-01',
      endDate: '2026-07-20',
      leadDays: 0,
      remindersEnabled: false,
    });
    assert.equal(getBigEventsForDate([oneTime], '2026-06-30').length, 0);
    assert.equal(getBigEventsForDate([oneTime], '2026-07-10').length, 1);
    assert.equal(getBigEventsForDate([oneTime], '2026-07-21').length, 0);

    const before = getBigEventSectionsForDate([oneTime], '2026-07-10');
    assert.equal(before.upcoming.length, 1);
    assert.equal(before.recurring.length, 0);
    assert.equal(before.past.length, 0);

    const after = getBigEventSectionsForDate([oneTime], '2026-07-21');
    assert.equal(after.upcoming.length, 0);
    assert.equal(after.recurring.length, 0);
    assert.equal(after.past.length, 1);
  });
});
