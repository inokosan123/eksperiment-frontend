import assert from 'node:assert/strict';
import test from 'node:test';
import {
  focusMainSnapshotEqual,
  selectFocusMainSnapshot,
  selectFocusUsageForDate,
} from '../components/focus-watch/focus-main-snapshot';
import type { DayPlanState } from '../components/focus-watch/dayPlanStore';

function fixture(): DayPlanState {
  return {
    hydrated: true,
    permission: 'approved',
    nativeProtection: { status: 'applied', appliedAt: 1, error: null, hardWallDate: null },
    plans: [],
    schedule: Array.from({ length: 7 }, () => null),
    customGroups: [],
    optionalEssentialAppIds: [],
    designatedCoreAppIds: [],
    alwaysBlockedApps: [],
    usageByDate: {},
    planSnapshotsByDate: {},
    targetArmedByDate: {},
    eligibilityByDate: {},
    days: {},
    quiet: null,
    door: null,
    purity: { packs: [], customPacks: [], customDomains: [], locks: { enabled: false, locked: false, unlockAt: null } },
    pendingChanges: [],
    streak: { current: 0, best: 0, trophies: 0 },
    milestonesShown: [],
    pendingMilestone: null,
    returnedMoments: 0,
  } as unknown as DayPlanState;
}

test('Focus snapshot ignores unrelated store emissions', () => {
  const previous = fixture();
  const unrelated = { ...previous, returnedMoments: 4 };
  assert.equal(
    focusMainSnapshotEqual(
      selectFocusMainSnapshot(previous),
      selectFocusMainSnapshot(unrelated),
    ),
    true,
  );
});

test('Focus snapshot publishes a relevant identity change', () => {
  const previous = fixture();
  const changed = { ...previous, days: { ...previous.days } };
  assert.equal(
    focusMainSnapshotEqual(
      selectFocusMainSnapshot(previous),
      selectFocusMainSnapshot(changed),
    ),
    false,
  );
});

test('Focus snapshot ignores usage outside the separately selected current day', () => {
  const previous = fixture();
  const changed = {
    ...previous,
    usageByDate: {
      '2026-07-31': {
        date: '2026-07-31',
        totalMinutes: 45,
        groupMinutes: {},
        appMinutes: {},
        sessionGroupMinutes: {},
        sessionAppMinutes: {},
        updatedAt: 1,
      },
    },
  } as unknown as DayPlanState;
  assert.equal(
    focusMainSnapshotEqual(
      selectFocusMainSnapshot(previous),
      selectFocusMainSnapshot(changed),
    ),
    true,
  );
  assert.equal(selectFocusUsageForDate(previous, '2026-08-02'), null);
  assert.equal(selectFocusUsageForDate(changed, '2026-08-02'), null);
});

test('Focus current-day usage selector preserves the entry identity', () => {
  const usage = {
    date: '2026-08-02',
    totalMinutes: 31,
    groupMinutes: {},
    appMinutes: {},
    sessionGroupMinutes: {},
    sessionAppMinutes: {},
    updatedAt: 1,
  };
  const previous = {
    ...fixture(),
    usageByDate: { '2026-08-02': usage },
  } as unknown as DayPlanState;
  const historicalWrite = {
    ...previous,
    usageByDate: {
      ...previous.usageByDate,
      '2026-07-31': { ...usage, date: '2026-07-31' },
    },
  } as unknown as DayPlanState;

  assert.equal(
    selectFocusUsageForDate(previous, '2026-08-02'),
    selectFocusUsageForDate(historicalWrite, '2026-08-02'),
  );
});
