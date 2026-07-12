import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import {
  APP_CATEGORIES,
  addCustomDomain,
  activeZone,
  assignPlanToWeekday,
  computeStreak,
  connectedSessionsAreValid,
  dateKey,
  getDayPlanState,
  normalizeConnectedSessions,
  removeSessionAndExtendPrevious,
  resolveAppAccess,
  saveDayPlan,
  saveOptionalEssentialApps,
  splitSessionAt,
  startQuietHour,
  endQuietHour,
  zoneContains,
  zoneDurationMinutes,
  type DayPlan,
  type DayPlanState,
  type FocusUsageSnapshot,
  type GroupRule,
  type PlanZone,
} from '../components/focus-watch/dayPlanStore';
import {
  normalizeWebDomain,
  resolveWebProtectionDomains,
  WEB_DOMAIN_LIMIT,
} from '../components/focus-watch/webProtectionCatalog';

declare global {
  var __focusTestDb: { calls: { kind: string; sql: string }[] };
}

const now = new Date(2026, 6, 12, 9, 0, 0);

function rule(groupId: string, overrides: Partial<GroupRule> = {}): GroupRule {
  return {
    groupId,
    dailyMinutes: null,
    strength: 'loose',
    practice: 'prayer',
    mode: 'noLimit',
    checkInMinutes: null,
    appRules: [],
    ...overrides,
  };
}

function plan(overrides: Partial<DayPlan> = {}): DayPlan {
  return {
    id: 'plan-1',
    name: 'Test plan',
    kind: 'daily',
    budgetMinutes: 240,
    tolerableMinutes: 300,
    essentialOnlyMinutes: 360,
    customGroupIds: [],
    groupCatalog: Object.fromEntries(APP_CATEGORIES.map(group => [group.id, []])),
    strength: 'loose',
    zones: [],
    rules: [],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function state(overrides: Partial<DayPlanState> = {}): DayPlanState {
  return {
    ...structuredClone(getDayPlanState()),
    hydrated: true,
    permission: 'approved',
    nativeProtection: { status: 'applied', appliedAt: 1, error: null, hardWallDate: null },
    plans: [],
    schedule: [null, null, null, null, null, null, null],
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
    ...overrides,
  };
}

function usage(overrides: Partial<FocusUsageSnapshot> = {}): FocusUsageSnapshot {
  return {
    date: dateKey(now),
    planId: 'plan-1',
    totalMinutes: 0,
    groupMinutes: {},
    appMinutes: {},
    sessionGroupMinutes: {},
    sessionAppMinutes: {},
    updatedAt: now.getTime(),
    ...overrides,
  };
}

before(async () => {
  const deadline = Date.now() + 2_000;
  while (!getDayPlanState().hydrated && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.equal(getDayPlanState().hydrated, true);
});

describe('legacy persistence hydration', () => {
  test('keeps the plan but removes retired independent Watch ranges', () => {
    const hydrated = getDayPlanState();
    const migrated = hydrated.plans.find(entry => entry.id === 'legacy-plan');
    assert.ok(migrated);
    assert.equal(migrated.kind, 'daily');
    assert.deepEqual(migrated.zones, []);
    assert.equal(migrated.rules.length, APP_CATEGORIES.length);
    assert.equal(hydrated.schedule[0], 'legacy-plan');
    assert.equal(hydrated.days['2026-07-10']?.status, 'kept');
    assert.ok(global.__focusTestDb.calls.some(call =>
      call.kind === 'write' && call.sql.includes('INSERT INTO focus_watch_plans')
    ));
  });
});

describe('connected Session geometry', () => {
  const sessions: PlanZone[] = [
    { id: 'day', name: 'Day', startMinutes: 360, endMinutes: 1260, closedGroupIds: [], rules: [] },
    { id: 'night', name: 'Night', startMinutes: 1260, endMinutes: 360, closedGroupIds: [], rules: [] },
  ];

  test('covers midnight without a gap or overlap', () => {
    const normalized = normalizeConnectedSessions(sessions);
    assert.equal(connectedSessionsAreValid(normalized), true);
    assert.equal(zoneDurationMinutes(normalized[0]), 900);
    assert.equal(zoneDurationMinutes(normalized[1]), 540);
    assert.equal(zoneContains(normalized[1], 30), true);
    assert.equal(zoneContains(normalized[0], 30), false);
  });

  test('selects the correct active Session around midnight', () => {
    const sessionPlan = plan({ kind: 'session', zones: sessions });
    assert.equal(activeZone(sessionPlan, new Date(2026, 6, 12, 22, 30))?.id, 'night');
    assert.equal(activeZone(sessionPlan, new Date(2026, 6, 13, 5, 30))?.id, 'night');
    assert.equal(activeZone(sessionPlan, new Date(2026, 6, 13, 6, 0))?.id, 'day');
  });

  test('adds a valid Session and gives removed time to its predecessor', () => {
    const one: PlanZone[] = [
      { id: 'all-day', name: 'All day', startMinutes: 0, endMinutes: 0, closedGroupIds: [], rules: [] },
    ];
    const split = splitSessionAt(one, 480, 'Morning');
    assert.ok(split);
    assert.equal(split.length, 2);
    assert.equal(connectedSessionsAreValid(split), true);
    const restored = removeSessionAndExtendPrevious(split, split[1].id);
    assert.ok(restored);
    assert.equal(restored.length, 1);
    assert.equal(zoneDurationMinutes(restored[0]), 1440);
  });

  test('rejects a fifth Session and a split shorter than 30 minutes', () => {
    const four = [0, 360, 720, 1080].map((startMinutes, index) => ({
      id: `s${index}`,
      name: `S${index}`,
      startMinutes,
      endMinutes: (startMinutes + 360) % 1440,
      closedGroupIds: [],
      rules: [],
    }));
    assert.equal(splitSessionAt(four, 1200), null);
    assert.equal(splitSessionAt(sessions, 370), null);
  });
});

describe('v4 protection hierarchy', () => {
  test('does not claim protection without authorization', () => {
    const decision = resolveAppAccess({
      state: state({ permission: 'notDetermined' }), plan: plan(), now,
      appId: 'instagram', groupId: 'social', usage: usage(),
    });
    assert.equal(decision.allowed, true);
    assert.equal(decision.layer, 'permission');
  });

  test('Quiet Hour may temporarily allow any selected app', () => {
    const decision = resolveAppAccess({
      state: state({ quiet: {
        startedAt: now.getTime(), endsAt: now.getTime() + 60 * 60_000,
        totalMs: 60 * 60_000, strength: 'strict',
        selection: { appIds: ['instagram'], categoryIds: [], groupIds: [] },
      } }),
      plan: plan(), now, appId: 'instagram', groupId: 'social', usage: usage(),
    });
    assert.equal(decision.allowed, true);
    assert.equal(decision.layer, 'quietHour');
  });

  test('Always Blocked wins over a Quiet Hour exception', () => {
    const decision = resolveAppAccess({
      state: state({
        quiet: {
          startedAt: now.getTime(), endsAt: now.getTime() + 60 * 60_000,
          totalMs: 60 * 60_000, strength: 'strict',
          selection: { appIds: ['instagram'], categoryIds: [], groupIds: [] },
        },
        alwaysBlockedApps: [{ appId: 'instagram', strength: 'strict', practice: 'prayer' }],
      }),
      plan: plan(), now, appId: 'instagram', groupId: 'social', usage: usage(),
    });
    assert.equal(decision.allowed, false);
    assert.equal(decision.layer, 'alwaysBlocked');
  });

  test('Daily hard wall and Quiet Hour combine by intersection', () => {
    const base = state({
      quiet: {
        startedAt: now.getTime(), endsAt: now.getTime() + 60 * 60_000,
        totalMs: 60 * 60_000, strength: 'strict',
        selection: { appIds: ['instagram'], categoryIds: [], groupIds: [] },
      },
      nativeProtection: {
        status: 'applied', appliedAt: 1, error: null, hardWallDate: dateKey(now),
      },
    });
    const blocked = resolveAppAccess({
      state: base, plan: plan(), now, appId: 'instagram', groupId: 'social', usage: usage(),
    });
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.layer, 'dailyHardWall');

    const allowed = resolveAppAccess({
      state: { ...base, optionalEssentialAppIds: ['instagram'] },
      plan: plan(), now, appId: 'instagram', groupId: 'social', usage: usage(),
    });
    assert.equal(allowed.allowed, true);
  });

  test('permanent Essentials bypass ordinary limits', () => {
    const social = rule('social', { dailyMinutes: 1, mode: 'limit', strength: 'strict' });
    const decision = resolveAppAccess({
      state: state({ optionalEssentialAppIds: ['instagram'] }),
      plan: plan({ rules: [social] }), now, appId: 'instagram', groupId: 'social',
      usage: usage({ groupMinutes: { social: 20 } }),
    });
    assert.equal(decision.allowed, true);
    assert.equal(decision.layer, 'essential');
  });

  test('strictest reached app or group rule wins', () => {
    const social = rule('social', {
      dailyMinutes: 120, mode: 'limit', strength: 'loose',
      appRules: [{
        appId: 'instagram', label: 'Instagram', mode: 'limit', minutes: 45,
        strength: 'strict', practice: 'prayer', checkInMinutes: 15,
      }],
    });
    const decision = resolveAppAccess({
      state: state(), plan: plan({ rules: [social] }), now,
      appId: 'instagram', groupId: 'social',
      usage: usage({ groupMinutes: { social: 120 }, appMinutes: { instagram: 45 } }),
    });
    assert.equal(decision.allowed, false);
    assert.equal(decision.strength, 'strict');
    assert.equal(decision.canContinue, false);
  });

  test('nearest remaining limit is shown before a wall is reached', () => {
    const social = rule('social', {
      dailyMinutes: 120, mode: 'limit',
      appRules: [{
        appId: 'instagram', mode: 'limit', minutes: 45,
        strength: 'loose', practice: 'prayer', checkInMinutes: 15,
      }],
    });
    const decision = resolveAppAccess({
      state: state(), plan: plan({ rules: [social] }), now,
      appId: 'instagram', groupId: 'social',
      usage: usage({ groupMinutes: { social: 100 }, appMinutes: { instagram: 30 } }),
    });
    assert.equal(decision.allowed, true);
    assert.equal(decision.remainingMinutes, 15);
  });

  test('a new Session gets its own allowance without carrying saved time forward', () => {
    const sessionRule = (minutes: number, strength: 'strict' | 'loose') => rule('social', {
      dailyMinutes: minutes, mode: 'limit', strength,
      appRules: [{
        appId: 'instagram', mode: 'limit', minutes, strength,
        practice: 'prayer', checkInMinutes: 15,
      }],
    });
    const sessionPlan = plan({
      kind: 'session',
      zones: [
        { id: 'morning', name: 'Morning', startMinutes: 0, endMinutes: 720, closedGroupIds: [], rules: [sessionRule(45, 'strict')] },
        { id: 'evening', name: 'Evening', startMinutes: 720, endMinutes: 0, closedGroupIds: [], rules: [sessionRule(45, 'loose')] },
      ],
    });
    const snapshot = usage({
      groupMinutes: { social: 100 }, appMinutes: { instagram: 100 },
      sessionGroupMinutes: { morning: { social: 45 }, evening: { social: 0 } },
      sessionAppMinutes: { morning: { instagram: 45 }, evening: { instagram: 0 } },
    });
    const morning = resolveAppAccess({
      state: state(), plan: sessionPlan, now: new Date(2026, 6, 12, 9),
      appId: 'instagram', groupId: 'social', usage: snapshot,
    });
    assert.equal(morning.allowed, false);
    assert.equal(morning.strength, 'strict');

    const evening = resolveAppAccess({
      state: state(), plan: sessionPlan, now: new Date(2026, 6, 12, 13),
      appId: 'instagram', groupId: 'social', usage: snapshot,
    });
    assert.equal(evening.allowed, true);
    assert.equal(evening.remainingMinutes, 45);
  });
});

describe('streak rules', () => {
  test('one broken day is a gap; two consecutive broken days reset the run', () => {
    const oneGap = computeStreak({
      a: { date: '2026-07-01', planId: 'p', status: 'kept', violations: 0, targetLost: false },
      b: { date: '2026-07-02', planId: 'p', status: 'kept', violations: 0, targetLost: false },
      c: { date: '2026-07-03', planId: 'p', status: 'broken', violations: 1, targetLost: true },
      d: { date: '2026-07-04', planId: 'p', status: 'kept', violations: 0, targetLost: false },
    });
    assert.deepEqual(oneGap, { current: 3, best: 3, trophies: 3 });

    const reset = computeStreak({
      a: { date: '2026-07-01', planId: 'p', status: 'kept', violations: 0, targetLost: false },
      b: { date: '2026-07-02', planId: 'p', status: 'broken', violations: 1, targetLost: true },
      c: { date: '2026-07-03', planId: 'p', status: 'broken', violations: 1, targetLost: true },
      d: { date: '2026-07-04', planId: 'p', status: 'kept', violations: 0, targetLost: false },
    });
    assert.equal(reset.current, 1);
    assert.equal(reset.trophies, 2);
  });
});

describe('Clean Sight domain rules', () => {
  test('normalizes user input and rejects malformed hostnames', () => {
    assert.equal(normalizeWebDomain(' HTTPS://WWW.Example.COM:443/path?q=1#top '), 'example.com');
    assert.equal(normalizeWebDomain('bad..example.com'), '');
    assert.equal(normalizeWebDomain('-bad.example.com'), '');
    assert.equal(normalizeWebDomain('localhost'), '');
  });

  test('prioritizes explicit domains, deduplicates, and reports overflow', () => {
    const customDomains = Array.from({ length: WEB_DOMAIN_LIMIT + 3 }, (_, index) => ({
      domain: `custom-${index}.example.com`,
    }));
    customDomains.push({ domain: 'https://www.custom-0.example.com/path' });
    const resolved = resolveWebProtectionDomains({
      packs: [
        { id: 'gambling', mode: 'on' },
        { id: 'adult', mode: 'off' },
        { id: 'social', mode: 'off' },
        { id: 'news', mode: 'off' },
      ],
      customPacks: [],
      customDomains,
    });
    assert.equal(resolved.domains.length, WEB_DOMAIN_LIMIT);
    assert.equal(resolved.domains[0], 'custom-0.example.com');
    assert.equal(new Set(resolved.domains).size, WEB_DOMAIN_LIMIT);
    assert.ok(resolved.omittedDomains.length > 3);
    assert.equal(resolved.adultFilterActive, false);
  });
});

describe('SQLite persistence queue', () => {
  test('persists plan, schedule, Essentials, Quiet Hour, and Clean Sight changes', async () => {
    const beforeWrites = global.__focusTestDb.calls.length;
    const saved = saveDayPlan({
      name: 'Persisted plan',
      budgetMinutes: 240,
      strength: 'strict',
      rules: [],
      zones: [],
    });
    assignPlanToWeekday(2, saved.id);
    saveOptionalEssentialApps(['gmail']);
    startQuietHour({
      minutes: 30,
      selection: { appIds: ['gmail'], categoryIds: [], groupIds: [] },
    });
    endQuietHour();
    addCustomDomain('example.com');

    const deadline = Date.now() + 2_000;
    while (Date.now() < deadline) {
      const writes = global.__focusTestDb.calls.slice(beforeWrites).filter(call => call.kind === 'write');
      if (
        writes.some(call => call.sql.includes('focus_watch_plans'))
        && writes.some(call => call.sql.includes('focus_watch_schedule'))
        && writes.filter(call => call.sql.includes('focus_watch_meta')).length >= 4
      ) break;
      await new Promise(resolve => setTimeout(resolve, 5));
    }

    const writes = global.__focusTestDb.calls.slice(beforeWrites).filter(call => call.kind === 'write');
    assert.ok(writes.some(call => call.sql.includes('focus_watch_plans')));
    assert.ok(writes.some(call => call.sql.includes('focus_watch_schedule')));
    assert.ok(writes.filter(call => call.sql.includes('focus_watch_meta')).length >= 4);
  });
});
