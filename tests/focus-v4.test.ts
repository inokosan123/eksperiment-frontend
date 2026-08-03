import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import {
  ALWAYS_BLOCKED_GROUP_ID,
  APP_CATEGORIES,
  addCustomDomain,
  addDomainToWebPack,
  activeZone,
  assignPlanToWeekday,
  assignPlanToWeekdayAndToday,
  cancelPendingChange,
  computeStreak,
  connectedSessionsAreValid,
  createNeverAllowedCommitment,
  dateKey,
  deleteDayPlan,
  describeRules,
  describeZones,
  FOCUS_SESSION_PLANNING_ENABLED,
  getDayPlanState,
  getEffectivePlan,
  getPlanSnapshotForDate,
  getWebProtectionSummary,
  grantScreenTimePermission,
  createCustomGroupId,
  groupIcon,
  groupName,
  hardLockDelayMs,
  normalizeConnectedSessions,
  planHasProtectionNow,
  planLeisureBudget,
  plannedMinutesByGroup,
  permanentlyLockWebHardLock,
  reconcileNativeTargetArmedDays,
  recordUsageSnapshot,
  removeAlwaysBlockedApp,
  removeCustomDomain,
  removeDomainFromWebPack,
  removeSessionAndExtendPrevious,
  resolveAppAccess,
  rulesForPlanAt,
  runtimePlanKind,
  saveAlwaysBlockedApp,
  saveDayPlan,
  saveOptionalEssentialApps,
  setPackMode,
  setNativeProtectionState,
  splitSessionAt,
  startQuietHour,
  swapTodayPlan,
  tickDayPlanStore,
  updateWebHardLock,
  endQuietHour,
  weekdayMondayFirst,
  zoneContains,
  zoneDurationMinutes,
  customGroupNameAvailable,
  saveCustomGroup,
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
import {
  focusBoundaryAppearance,
  focusInheritedBoundaryLabel,
  focusOverByMinutes,
  focusRailFraction,
  focusRemainingMinutes,
  focusSecondarySignal,
  focusSecondarySignalLabel,
  focusShowsProgressRail,
  focusStatusLabel,
  sortUsageRows,
  usageActivityState,
  usageBoundaryState,
  usageVisualState,
  type FocusBoundaryAppearance,
} from '../components/focus-watch/todayUsageModel';
import { gaugeStanding } from '../components/focus-watch/dayGaugeState';
import {
  allocatedGroupMinutes,
  appLimitBounds,
  groupLimitBounds,
  nearestValidLimitMinutes,
  validateFocusLimitBudget,
} from '../components/focus-watch/focusLimitBudget';

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
    mode: 'limit',
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

describe('Focus hierarchical limit budgets', () => {
  test('finite groups share one Daily Target without penalizing the group being edited', () => {
    const rules = [
      rule('social', { mode: 'limit', dailyMinutes: 180 }),
      rule('shopping', { mode: 'limit', dailyMinutes: 120 }),
      rule('games', { mode: 'limit', dailyMinutes: null }),
      rule('news', { mode: 'blocked', dailyMinutes: null }),
    ];

    assert.equal(allocatedGroupMinutes(rules), 300);
    assert.deepEqual(groupLimitBounds({
      dailyTargetMinutes: 300,
      rules,
      groupId: 'shopping',
    }), {
      currentMinutes: 120,
      minimumMinutes: 15,
      maximumMinutes: 120,
      allocatedElsewhereMinutes: 180,
      parentMinutes: 300,
      hasCapacity: true,
    });
    assert.equal(groupLimitBounds({
      dailyTargetMinutes: 300,
      rules,
      groupId: 'games',
    }).maximumMinutes, 0);
  });

  test('individual app limits share a finite group allowance', () => {
    const social = rule('social', {
      mode: 'limit',
      dailyMinutes: 180,
      appRules: [
        {
          appId: 'instagram',
          mode: 'limit',
          minutes: 45,
          strength: 'strict',
          practice: 'prayer',
          checkInMinutes: 15,
        },
        {
          appId: 'tiktok',
          mode: 'limit',
          minutes: 60,
          strength: 'loose',
          practice: 'prayer',
          checkInMinutes: 15,
        },
      ],
    });

    assert.equal(appLimitBounds({
      dailyTargetMinutes: 300,
      groupRule: social,
      appId: 'tiktok',
    }).maximumMinutes, 135);
    assert.equal(appLimitBounds({
      dailyTargetMinutes: 300,
      groupRule: social,
      appId: 'youtube',
    }).maximumMinutes, 75);
  });

  test('invalid parent reductions are reported instead of silently rewriting children', () => {
    const rules = [
      rule('social', {
        mode: 'limit',
        dailyMinutes: 60,
        appRules: [
          {
            appId: 'instagram',
            mode: 'limit',
            minutes: 45,
            strength: 'strict',
            practice: 'prayer',
            checkInMinutes: 15,
          },
          {
            appId: 'tiktok',
            mode: 'limit',
            minutes: 30,
            strength: 'strict',
            practice: 'prayer',
            checkInMinutes: 15,
          },
        ],
      }),
      rule('shopping', { mode: 'limit', dailyMinutes: 180 }),
    ];
    const issues = validateFocusLimitBudget({
      dailyTargetMinutes: 210,
      rules,
    });

    assert.ok(issues.some(issue => issue.code === 'groups-over-target'));
    assert.ok(issues.some(issue => issue.code === 'apps-over-group' && issue.groupId === 'social'));
  });

  test('wheel defaults snap to 15-minute values inside the available range', () => {
    assert.equal(nearestValidLimitMinutes(47, {
      minimumMinutes: 30,
      maximumMinutes: 80,
      hasCapacity: true,
    }), 45);
    assert.equal(nearestValidLimitMinutes(90, {
      minimumMinutes: 30,
      maximumMinutes: 80,
      hasCapacity: true,
    }), 75);
    assert.equal(nearestValidLimitMinutes(30, {
      minimumMinutes: 35,
      maximumMinutes: 30,
      hasCapacity: false,
    }), null);
  });

  test('five-minute boundaries are rejected by the 15-minute rule', () => {
    const issues = validateFocusLimitBudget({
      dailyTargetMinutes: 120,
      rules: [rule('social', { mode: 'limit', dailyMinutes: 35 })],
    });

    assert.ok(issues.some(issue => issue.code === 'invalid-duration'));
  });

  test('the persistence boundary rejects an over-allocated plan', () => {
    assert.throws(() => saveDayPlan({
      name: 'Invalid allocation',
      budgetMinutes: 120,
      strength: 'strict',
      rules: [
        rule('social', { mode: 'limit', dailyMinutes: 90 }),
        rule('shopping', { mode: 'limit', dailyMinutes: 60 }),
      ],
      zones: [],
    }), /Group limits use more time than the Daily Target/);
  });

  test('unlimited is Limit with no duration and does not reserve group capacity', () => {
    const rules = [
      rule('social', { mode: 'limit', dailyMinutes: null }),
      rule('shopping', { mode: 'limit', dailyMinutes: 90 }),
    ];

    assert.equal(allocatedGroupMinutes(rules), 90);
    assert.equal(groupLimitBounds({
      dailyTargetMinutes: 180,
      rules,
      groupId: 'social',
    }).maximumMinutes, 90);
  });

  test('blocked groups ignore dormant app budgets and preserve a zero-minute wall', () => {
    const blocked = rule('social', {
      mode: 'blocked',
      dailyMinutes: null,
      appRules: [{
        appId: 'instagram',
        mode: 'limit',
        minutes: 45,
        strength: 'loose',
        practice: 'prayer',
        checkInMinutes: 15,
      }],
    });

    assert.deepEqual(validateFocusLimitBudget({
      dailyTargetMinutes: 60,
      rules: [blocked],
    }), []);
    assert.equal(allocatedGroupMinutes([blocked]), 0);
  });

  test('legacy noLimit rules save as Limit with no duration', () => {
    const saved = saveDayPlan({
      name: 'Legacy mode migration',
      budgetMinutes: 120,
      strength: 'loose',
      rules: [rule('social', { mode: 'noLimit', dailyMinutes: null })],
      zones: [],
    });
    const social = saved.rules.find(entry => entry.groupId === 'social');

    assert.equal(social?.mode, 'limit');
    assert.equal(social?.dailyMinutes, null);
  });
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
    const dormant = hydrated.plans.find(entry => entry.id === 'daily-with-dormant-session-draft');
    assert.ok(dormant);
    assert.equal(dormant.kind, 'daily');
    assert.equal(dormant.zones.length, 2);
    assert.equal(activeZone(dormant, now), null);
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

  test('keeps Session ranges dormant in the Daily-only v1 runtime', () => {
    const sessionPlan = plan({ kind: 'session', zones: sessions });
    assert.equal(FOCUS_SESSION_PLANNING_ENABLED, false);
    assert.equal(runtimePlanKind(sessionPlan), 'daily');
    assert.equal(activeZone(sessionPlan, new Date(2026, 6, 12, 22, 30)), null);
    assert.equal(activeZone(sessionPlan, new Date(2026, 6, 13, 5, 30)), null);
    assert.equal(describeZones(sessionPlan), 'Daily Plan · one set of rules');
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

  test('Essentials-only protects from minute one without turning the target into zero', () => {
    const essentialsPlan = plan({
      essentialsOnly: true,
      essentialAppIds: ['gmail'],
      budgetMinutes: 90,
      tolerableMinutes: 150,
      essentialOnlyMinutes: 150,
    });
    assert.equal(planHasProtectionNow(essentialsPlan, now), true);
    assert.equal(essentialsPlan.budgetMinutes, 90);

    const allowed = resolveAppAccess({
      state: state(), plan: essentialsPlan, now,
      appId: 'gmail', usage: usage({ totalMinutes: 0 }),
    });
    assert.equal(allowed.allowed, true);
    assert.equal(allowed.layer, 'dailyHardWall');

    const blocked = resolveAppAccess({
      state: state(), plan: essentialsPlan, now,
      appId: 'instagram', groupId: 'social', usage: usage({ totalMinutes: 0 }),
    });
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.layer, 'dailyHardWall');
  });

  test('Always Blocked still wins over a plan-only Essentials exception', () => {
    const decision = resolveAppAccess({
      state: state({
        alwaysBlockedApps: [{ appId: 'gmail', strength: 'strict', practice: 'prayer' }],
      }),
      plan: plan({ essentialsOnly: true, essentialAppIds: ['gmail'] }),
      now,
      appId: 'gmail',
      usage: usage(),
    });
    assert.equal(decision.allowed, false);
    assert.equal(decision.strength, 'strict');
  });

  test('Essentials-only keeps former Daily and Session rules dormant everywhere', () => {
    const dormantRule = rule('social', { mode: 'blocked', dailyMinutes: 45 });
    const essentialsPlan = plan({
      essentialsOnly: true,
      kind: 'session',
      essentialAppIds: ['instagram'],
      rules: [dormantRule],
      zones: [{
        id: 'work',
        name: 'Work',
        startMinutes: 0,
        endMinutes: 0,
        closedGroupIds: ['social'],
        rules: [dormantRule],
      }],
    });

    assert.equal(activeZone(essentialsPlan, now), null);
    assert.deepEqual(rulesForPlanAt(essentialsPlan, now), []);
    assert.deepEqual(plannedMinutesByGroup(essentialsPlan), {});
    assert.equal(planLeisureBudget(essentialsPlan), 0);
    assert.equal(describeRules(state(), essentialsPlan), 'Protected from minute one');
    assert.equal(describeZones(essentialsPlan), 'Essentials-only Plan · protected all day');

    const decision = resolveAppAccess({
      state: state(), plan: essentialsPlan, now,
      appId: 'instagram', groupId: 'social', usage: usage(),
    });
    assert.equal(decision.allowed, true);
    assert.equal(decision.layer, 'dailyHardWall');
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

  test('dormant Session allowances cannot override the v1 Daily rule set', () => {
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
    assert.equal(morning.allowed, true);
    assert.deepEqual(rulesForPlanAt(sessionPlan, new Date(2026, 6, 12, 9)), sessionPlan.rules);

    const evening = resolveAppAccess({
      state: state(), plan: sessionPlan, now: new Date(2026, 6, 12, 13),
      appId: 'instagram', groupId: 'social', usage: snapshot,
    });
    assert.equal(evening.allowed, true);
    assert.deepEqual(rulesForPlanAt(sessionPlan, new Date(2026, 6, 12, 13)), sessionPlan.rules);
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
  test('derives one accurate Web Protection summary for Focus and My Routine', () => {
    const protectedState = state({
      purity: {
        packs: [
          { id: 'gambling', mode: 'on', extraDomains: ['extra.example.com'] },
          { id: 'adult', mode: 'off', extraDomains: ['inactive.example.com'] },
          { id: 'social', mode: 'off', extraDomains: [] },
          { id: 'news', mode: 'off', extraDomains: [] },
        ],
        customPacks: [
          { id: 'custom-on', name: 'Active', domains: ['extra.example.com', 'one.example.com', 'two.example.com'], mode: 'on' },
          { id: 'custom-off', name: 'Inactive', domains: ['hidden.example.com'], mode: 'off' },
        ],
        customDomains: [{ domain: 'personal.example.com', never: false }],
        neverAllowed: [],
        locks: { enabled: false, locked: false, cooldown: '12h' },
      },
    });

    assert.deepEqual(getWebProtectionSummary(protectedState), {
      state: 'on',
      configured: true,
      packsOn: 2,
      customSites: 4,
    });
    assert.equal(getWebProtectionSummary({ ...protectedState, permission: 'preview' }).state, 'preview');
    assert.equal(getWebProtectionSummary({
      ...protectedState,
      nativeProtection: { status: 'applying', appliedAt: null, error: null, hardWallDate: null },
    }).state, 'off');
  });

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

  test('gives Never Allowed domains first priority and carries only native routing metadata', () => {
    const ordinary = Array.from({ length: WEB_DOMAIN_LIMIT }, (_, index) => ({
      domain: `ordinary-${index}.example.com`,
    }));
    const resolved = resolveWebProtectionDomains({
      packs: [
        { id: 'gambling', mode: 'off' },
        { id: 'adult', mode: 'off' },
        { id: 'social', mode: 'off' },
        { id: 'news', mode: 'off' },
      ],
      customPacks: [],
      customDomains: ordinary,
      neverAllowed: [{
        id: 'promise-adult',
        targetKind: 'builtin-pack',
        targetId: 'adult',
        targetLabel: 'Adult Content',
        domainsSnapshot: ['promise.example.com'],
      }],
    });

    assert.equal(resolved.domains[0], 'promise.example.com');
    assert.equal(resolved.domains.length, WEB_DOMAIN_LIMIT);
    assert.equal(resolved.omittedDomains.length, 1);
    assert.deepEqual(resolved.neverDomainContexts, [{
      domain: 'promise.example.com',
      commitmentId: 'promise-adult',
      label: 'Adult Content',
    }]);
    assert.equal(resolved.adultFilterActive, true);
    assert.equal(resolved.adultFilterNeverCommitmentId, 'promise-adult');
    assert.equal('reason' in resolved.neverDomainContexts[0], false);
  });

  test('does not silently expand a permanent pack snapshot when the catalog grows', () => {
    const resolved = resolveWebProtectionDomains({
      packs: [
        { id: 'gambling', mode: 'off' },
        { id: 'adult', mode: 'off' },
        { id: 'social', mode: 'on' },
        { id: 'news', mode: 'off' },
      ],
      customPacks: [],
      customDomains: [],
      neverAllowed: [{
        id: 'social-snapshot',
        targetKind: 'builtin-pack',
        targetId: 'social',
        targetLabel: 'Social Web',
        domainsSnapshot: ['instagram.com'],
      }],
    });
    assert.deepEqual(resolved.domains, ['instagram.com']);
    assert.equal(resolved.domains.includes('x.com'), false);
  });

  test('keeps one domain in multiple protection packs while shielding it once', () => {
    const domain = 'shared-boundary.example.com';
    setPackMode('gambling', 'on');
    setPackMode('social', 'on');

    assert.equal(addDomainToWebPack('gambling', domain), true);
    assert.equal(addDomainToWebPack('social', domain), true);
    assert.equal(addDomainToWebPack('social', domain), false);

    const purity = getDayPlanState().purity;
    assert.ok(purity.packs.find(pack => pack.id === 'gambling')?.extraDomains.includes(domain));
    assert.ok(purity.packs.find(pack => pack.id === 'social')?.extraDomains.includes(domain));

    const resolved = resolveWebProtectionDomains(purity);
    assert.equal(resolved.domains.filter(entry => entry === domain).length, 1);
  });

  test('adds personal domains to a built-in pack and delays their removal through Hard Lock', () => {
    const domain = 'local-news.example.com';
    updateWebHardLock({ enabled: true });
    setPackMode('news', 'on');
    assert.equal(addDomainToWebPack('news', domain), true);
    assert.equal(addDomainToWebPack('news', domain), false);
    assert.equal(addDomainToWebPack('news', 'cnn.com'), false);

    const activePurity = getDayPlanState().purity;
    const resolved = resolveWebProtectionDomains(activePurity);
    assert.ok(resolved.domains.includes(domain));
    assert.ok(activePurity.packs.find(pack => pack.id === 'news')?.extraDomains.includes(domain));

    assert.equal(removeDomainFromWebPack('news', domain), true);
    const pendingRemoval = getDayPlanState().pendingChanges.find(change =>
      change.action.kind === 'pack-domain-remove'
        && change.action.packId === 'news'
        && change.action.domain === domain
    );
    assert.ok(pendingRemoval);
    assert.ok(getDayPlanState().purity.packs.find(pack => pack.id === 'news')?.extraDomains.includes(domain));

    tickDayPlanStore(pendingRemoval.effectiveAt);
    assert.equal(getDayPlanState().purity.packs.find(pack => pack.id === 'news')?.extraDomains.includes(domain), false);
  });

  test('Hard Lock keeps pack and domain weakening requests blocked until the delay ends', () => {
    const domain = 'hard-lock-test.example.com';
    assert.equal(hardLockDelayMs('12h'), 12 * 60 * 60_000);
    assert.equal(hardLockDelayMs('2d'), 2 * 24 * 60 * 60_000);
    assert.equal(hardLockDelayMs('3d'), 3 * 24 * 60 * 60_000);

    updateWebHardLock({ cooldown: '12h' });
    updateWebHardLock({ enabled: true });
    addCustomDomain(domain);
    setPackMode('gambling', 'on');

    removeCustomDomain(domain);
    setPackMode('gambling', 'off');
    const waiting = getDayPlanState().pendingChanges.filter(change =>
      change.action.kind === 'domain-remove' || change.action.kind === 'pack-mode'
    );
    assert.equal(waiting.length, 2);
    assert.equal(getDayPlanState().purity.customDomains.some(entry => entry.domain === domain), true);
    assert.equal(getDayPlanState().purity.packs.find(pack => pack.id === 'gambling')?.mode, 'on');

    const firstDue = Math.min(...waiting.map(change => change.effectiveAt));
    const lastDue = Math.max(...waiting.map(change => change.effectiveAt));
    tickDayPlanStore(firstDue - 1);
    assert.equal(getDayPlanState().purity.customDomains.some(entry => entry.domain === domain), true);
    assert.equal(getDayPlanState().purity.packs.find(pack => pack.id === 'gambling')?.mode, 'on');

    tickDayPlanStore(lastDue);
    assert.equal(getDayPlanState().purity.customDomains.some(entry => entry.domain === domain), false);
    assert.equal(getDayPlanState().purity.packs.find(pack => pack.id === 'gambling')?.mode, 'off');
  });

  test('Hard Lock uses its selected exit delay and preserves legacy permanent locks', () => {
    assert.equal(getDayPlanState().purity.locks.enabled, true);
    const requestedAt = Date.now();
    updateWebHardLock({ enabled: false });
    const pendingDisable = getDayPlanState().pendingChanges.find(change =>
      change.action.kind === 'locks' && change.action.partial.enabled === false
    );
    assert.ok(pendingDisable);
    const selectedDelay = hardLockDelayMs(getDayPlanState().purity.locks.cooldown);
    assert.ok(pendingDisable.effectiveAt - requestedAt >= selectedDelay);
    assert.ok(pendingDisable.effectiveAt - requestedAt < selectedDelay + 1_000);
    assert.equal(getDayPlanState().purity.locks.enabled, true);
    cancelPendingChange(pendingDisable.id);

    updateWebHardLock({ cooldown: '3d' });
    assert.equal(getDayPlanState().purity.locks.cooldown, '3d');
    assert.equal(permanentlyLockWebHardLock(), true);
    assert.deepEqual(getDayPlanState().purity.locks, {
      enabled: true,
      locked: true,
      cooldown: '3d',
    });
    assert.equal(updateWebHardLock({ enabled: false }), false);
    assert.equal(getDayPlanState().pendingChanges.some(change =>
      change.action.kind === 'locks' && change.action.partial.enabled === false
    ), false);

    // A shorter delay is itself a weakening request. The current three-day
    // delay stays visible until that request becomes due.
    assert.equal(updateWebHardLock({ cooldown: '12h' }), true);
    const pendingShorterDelay = getDayPlanState().pendingChanges.find(change =>
      change.action.kind === 'locks' && change.action.partial.cooldown === '12h'
    );
    assert.ok(pendingShorterDelay);
    assert.equal(getDayPlanState().purity.locks.cooldown, '3d');
    tickDayPlanStore(pendingShorterDelay.effectiveAt);
    assert.deepEqual(getDayPlanState().purity.locks, {
      enabled: true,
      locked: true,
      cooldown: '12h',
    });
  });

  test('persists a permanent promise and refuses every ordinary removal path', () => {
    const domain = 'never-guard.example.com';
    grantScreenTimePermission('approved');
    setNativeProtectionState({ status: 'applied', appliedAt: Date.now(), error: null, hardWallDate: null });
    addCustomDomain(domain);
    const created = createNeverAllowedCommitment({
      targetKind: 'domain',
      targetId: domain,
      reason: 'This has taken time and peace that I want to protect from now on.',
      temptation: 'It usually begins when I feel restless, alone, or tired late in the day.',
      nextStep: 'I will put the phone down, breathe, pray, and call someone I trust.',
    });
    assert.equal(created.ok, true);
    assert.equal(removeCustomDomain(domain), false);
    assert.equal(getDayPlanState().purity.customDomains.some(entry => entry.domain === domain), true);
    assert.equal(getDayPlanState().purity.neverAllowed.some(entry => entry.domainsSnapshot.includes(domain)), true);
  });
});

describe('today plan assignment', () => {
  test('the current weekday changes protection now and the reusable weekly template', () => {
    const today = new Date();
    const weekday = weekdayMondayFirst(today);
    const futureWeekday = (weekday + 1) % 7;
    const first = saveDayPlan({
      id: 'today-assignment-first',
      name: 'First today plan',
      budgetMinutes: 300,
      tolerableMinutes: 360,
      essentialOnlyMinutes: 420,
      strength: 'strict',
      rules: [],
      zones: [],
    });
    const second = saveDayPlan({
      id: 'today-assignment-second',
      name: 'Second today plan',
      budgetMinutes: 210,
      tolerableMinutes: 270,
      essentialOnlyMinutes: 330,
      strength: 'strict',
      rules: [],
      zones: [],
    });

    swapTodayPlan(first.id, today);
    assignPlanToWeekday(weekday, first.id);
    reconcileNativeTargetArmedDays({ [dateKey(today)]: first.id });
    recordUsageSnapshot({
      date: dateKey(today),
      planId: first.id,
      totalMinutes: 220,
      groupMinutes: {},
      appMinutes: {},
      sessionGroupMinutes: {},
      sessionAppMinutes: {},
      updatedAt: today.getTime(),
    });
    assert.equal(getEffectivePlan(getDayPlanState(), today)?.id, first.id);
    assert.equal(getDayPlanState().days[dateKey(today)]?.targetLost, false);

    const changed = assignPlanToWeekdayAndToday(weekday, second.id, today);
    const after = getDayPlanState();
    assert.equal(changed, true);
    assert.equal(after.schedule[weekday], second.id);
    assert.equal(after.days[dateKey(today)]?.planId, second.id);
    assert.equal(after.days[dateKey(today)]?.targetLost, true);
    assert.equal(getEffectivePlan(after, today)?.id, second.id);
    assert.equal(getPlanSnapshotForDate(after, today)?.id, second.id);
    assert.equal(after.targetArmedByDate[dateKey(today)], undefined);

    // Editing another weekday is planning only. It cannot silently replace the
    // active day or its immutable plan snapshot.
    assignPlanToWeekday(futureWeekday, first.id);
    const afterFutureEdit = getDayPlanState();
    assert.equal(afterFutureEdit.schedule[futureWeekday], first.id);
    assert.equal(getEffectivePlan(afterFutureEdit, today)?.id, second.id);
    assert.equal(getPlanSnapshotForDate(afterFutureEdit, today)?.id, second.id);
    assert.equal(assignPlanToWeekdayAndToday(futureWeekday, first.id, today), false);

    // Rest is a real assignment too. It clears both surfaces but cannot undo
    // eligibility already lost earlier in the same day.
    assert.equal(assignPlanToWeekdayAndToday(weekday, null, today), true);
    const rest = getDayPlanState();
    assert.equal(rest.schedule[weekday], null);
    assert.equal(rest.days[dateKey(today)]?.planId, null);
    assert.equal(rest.days[dateKey(today)]?.targetLost, true);
    assert.equal(getEffectivePlan(rest, today), null);
    assert.equal(getPlanSnapshotForDate(rest, today), null);
  });
});

describe('Today usage breakdown', () => {
  test('keeps active, quiet, and pending group states distinct', () => {
    assert.equal(usageActivityState(32), 'active');
    assert.equal(usageActivityState(0), 'quiet');
    assert.equal(usageActivityState(null), 'pending');
  });

  test('orders active groups and apps by usage, then quiet rows by name', () => {
    const ordered = sortUsageRows([
      { name: 'Shopping', usedMinutes: 0 },
      { name: 'Social', usedMinutes: 95 },
      { name: 'Dating', usedMinutes: 0 },
      { name: 'Games', usedMinutes: 28 },
      { name: 'Entertainment', usedMinutes: 61 },
    ]);

    assert.deepEqual(ordered.map(row => row.name), [
      'Social',
      'Entertainment',
      'Games',
      'Dating',
      'Shopping',
    ]);
  });

  test('distinguishes planned, within, met, over, blocked, and open boundaries', () => {
    assert.equal(usageBoundaryState('limit', 45, null), 'planned');
    assert.equal(usageBoundaryState('limit', 45, 0), 'planned');
    assert.equal(usageBoundaryState('limit', 45, 44), 'within');
    assert.equal(usageBoundaryState('limit', 45, 45), 'met');
    assert.equal(usageBoundaryState('limit', 45, 46), 'over');
    assert.equal(usageBoundaryState('blocked', null, 0), 'blocked');
    assert.equal(usageBoundaryState('blocked', null, 1), 'over');
    assert.equal(usageBoundaryState('noLimit', null, 240), 'open');
  });

  test('maps boundaries to the five report visual states', () => {
    assert.equal(usageVisualState('limit', 45, null), 'pending');
    assert.equal(usageVisualState('noLimit', null, 120), 'noLimit');
    assert.equal(usageVisualState('limit', 45, 0), 'limitActive');
    assert.equal(usageVisualState('limit', 45, 44), 'limitActive');
    assert.equal(usageVisualState('limit', 45, 45), 'atLimit');
    assert.equal(usageVisualState('limit', 45, 46), 'overLimit');
    assert.equal(usageVisualState('blocked', null, 0), 'atLimit');
    assert.equal(usageVisualState('blocked', null, 1), 'overLimit');
  });
});

describe('Today plan standing', () => {
  test('keeps the goal boundary healthy and makes the hard wall inclusive', () => {
    assert.equal(gaugeStanding(60, 90, null), 'unknown');
    assert.equal(gaugeStanding(60, 90, 60), 'under');
    assert.equal(gaugeStanding(60, 90, 61), 'tolerance');
    assert.equal(gaugeStanding(60, 90, 89), 'tolerance');
    assert.equal(gaugeStanding(60, 90, 90), 'essentials');
  });

  test('enters Essentials at the shared boundary when tolerance is zero', () => {
    assert.equal(gaugeStanding(60, 60, 59), 'under');
    assert.equal(gaugeStanding(60, 60, 60), 'essentials');
  });
});

describe('focus boundary appearance', () => {
  const cases: {
    name: string;
    mode: 'blocked' | 'limit' | 'noLimit';
    limitMinutes: number | null;
    usedMinutes: number | null;
    expected: FocusBoundaryAppearance;
  }[] = [
    // Pending outranks every other rule, including a configured block.
    { name: 'unknown usage on a limit', mode: 'limit', limitMinutes: 45, usedMinutes: null, expected: 'pending' },
    { name: 'unknown usage on a block', mode: 'blocked', limitMinutes: null, usedMinutes: null, expected: 'pending' },
    { name: 'unknown usage with no limit', mode: 'noLimit', limitMinutes: null, usedMinutes: null, expected: 'pending' },

    // A configured block stays a block whether or not minutes were recorded.
    { name: 'block held', mode: 'blocked', limitMinutes: null, usedMinutes: 0, expected: 'blocked' },
    { name: 'block with recorded usage', mode: 'blocked', limitMinutes: null, usedMinutes: 42, expected: 'blocked' },
    // Zero minutes allowed is a block wearing a limit's clothes.
    { name: 'zero-minute limit, unused', mode: 'limit', limitMinutes: 0, usedMinutes: 0, expected: 'blocked' },
    { name: 'zero-minute limit, used', mode: 'limit', limitMinutes: 0, usedMinutes: 9, expected: 'blocked' },

    { name: 'no limit, unused', mode: 'noLimit', limitMinutes: null, usedMinutes: 0, expected: 'noLimit' },
    { name: 'no limit, used', mode: 'noLimit', limitMinutes: null, usedMinutes: 240, expected: 'noLimit' },
    { name: 'limit mode without minutes', mode: 'limit', limitMinutes: null, usedMinutes: 30, expected: 'noLimit' },

    // The exact boundary values.
    { name: 'limit untouched', mode: 'limit', limitMinutes: 45, usedMinutes: 0, expected: 'limitActive' },
    { name: 'one minute under', mode: 'limit', limitMinutes: 45, usedMinutes: 44, expected: 'limitActive' },
    { name: 'exactly at limit', mode: 'limit', limitMinutes: 45, usedMinutes: 45, expected: 'atLimit' },
    { name: 'one minute over', mode: 'limit', limitMinutes: 45, usedMinutes: 46, expected: 'overLimit' },
    { name: 'far over', mode: 'limit', limitMinutes: 45, usedMinutes: 300, expected: 'overLimit' },
  ];

  for (const entry of cases) {
    test(entry.name, () => {
      assert.equal(
        focusBoundaryAppearance({
          mode: entry.mode,
          limitMinutes: entry.limitMinutes,
          usedMinutes: entry.usedMinutes,
        }),
        entry.expected
      );
    });
  }

  test('a configured block never reads as an over-limit violation', () => {
    // Apple's report counts the whole day, including minutes spent before the
    // plan became active, so recorded time under a block is a fact, not a
    // broken boundary.
    const appearance = focusBoundaryAppearance({
      mode: 'blocked',
      limitMinutes: null,
      usedMinutes: 42,
    });
    assert.equal(appearance, 'blocked');
    assert.notEqual(appearance, 'overLimit');
    assert.equal(focusStatusLabel(appearance), 'BLOCKED');
  });
});

describe('focus status copy', () => {
  test('names each state', () => {
    assert.equal(focusStatusLabel('pending'), 'PENDING');
    assert.equal(focusStatusLabel('noLimit'), 'NO LIMIT');
    assert.equal(focusStatusLabel('blocked'), 'BLOCKED');
    assert.equal(focusStatusLabel('atLimit'), 'AT LIMIT');
    // A limit that has not been touched yet is set, not "on track".
    assert.equal(focusStatusLabel('limitActive', { limitMinutes: 45, usedMinutes: 0 }), 'LIMIT SET');
    assert.equal(focusStatusLabel('limitActive', { limitMinutes: 45, usedMinutes: 20 }), 'ON TRACK');
    assert.equal(focusStatusLabel('overLimit', { limitMinutes: 45, usedMinutes: 57 }), 'OVER BY 12m');
  });

  test('states how far past the boundary the day went', () => {
    assert.equal(focusOverByMinutes(45, 57), 12);
    assert.equal(focusOverByMinutes(45, 45), 0);
    assert.equal(focusOverByMinutes(45, 10), 0);
    assert.equal(focusOverByMinutes(null, 10), 0);
    assert.equal(focusRemainingMinutes(45, 10), 35);
    assert.equal(focusRemainingMinutes(45, 90), 0);
  });

  test('never presents an app as escaping its group boundary', () => {
    assert.equal(focusInheritedBoundaryLabel('blocked', 'blocked'), 'GROUP BLOCKED');
    assert.equal(focusInheritedBoundaryLabel('limitActive', 'limit'), 'USES GROUP BOUNDARY');
    assert.equal(focusInheritedBoundaryLabel('noLimit', 'noLimit'), 'NO INDIVIDUAL LIMIT');
  });

  test('draws a rail only for a live finite limit', () => {
    assert.equal(focusShowsProgressRail('limitActive', 45), true);
    assert.equal(focusShowsProgressRail('atLimit', 45), true);
    assert.equal(focusShowsProgressRail('overLimit', 45), true);
    assert.equal(focusShowsProgressRail('blocked', null), false);
    assert.equal(focusShowsProgressRail('pending', 45), false);
    assert.equal(focusShowsProgressRail('noLimit', null), false);
    // Going over fills the rail rather than overflowing it.
    assert.equal(focusRailFraction(45, 90), 1);
    assert.equal(focusRailFraction(45, 0), 0);
    assert.equal(focusRailFraction(null, 30), 0);
  });
});

describe('focus secondary signal', () => {
  test('reports recorded minutes under a block as a fact', () => {
    assert.deepEqual(
      focusSecondarySignal({ appearance: 'blocked', usedMinutes: 42 }),
      { kind: 'recordedWhileBlocked', minutes: 42 }
    );
    assert.equal(
      focusSecondarySignalLabel({ kind: 'recordedWhileBlocked', minutes: 42 }),
      '42m RECORDED TODAY'
    );
    assert.equal(focusSecondarySignal({ appearance: 'blocked', usedMinutes: 0 }), null);
  });

  test('rolls child states up without repainting the parent', () => {
    assert.deepEqual(
      focusSecondarySignal({
        appearance: 'limitActive',
        usedMinutes: 20,
        childAppearances: ['limitActive', 'overLimit', 'atLimit', 'overLimit'],
      }),
      { kind: 'childOver', count: 2 }
    );
    assert.deepEqual(
      focusSecondarySignal({
        appearance: 'limitActive',
        usedMinutes: 20,
        childAppearances: ['limitActive', 'atLimit'],
      }),
      { kind: 'childAtLimit', count: 1 }
    );
    assert.equal(
      focusSecondarySignal({
        appearance: 'limitActive',
        usedMinutes: 20,
        childAppearances: ['limitActive', 'noLimit'],
      }),
      null
    );
  });

  test('over outranks at limit', () => {
    const signal = focusSecondarySignal({
      appearance: 'noLimit',
      usedMinutes: 60,
      childAppearances: ['atLimit', 'atLimit', 'overLimit'],
    });
    assert.deepEqual(signal, { kind: 'childOver', count: 1 });
  });

  test('claims nothing while any child is still pending', () => {
    assert.equal(
      focusSecondarySignal({
        appearance: 'limitActive',
        usedMinutes: 20,
        childAppearances: ['overLimit', 'pending'],
      }),
      null
    );
    assert.equal(focusSecondarySignal({ appearance: 'pending', usedMinutes: null }), null);
  });

  test('labels child counts with singular and plural', () => {
    assert.equal(focusSecondarySignalLabel({ kind: 'childOver', count: 1 }), '1 APP OVER');
    assert.equal(focusSecondarySignalLabel({ kind: 'childOver', count: 3 }), '3 APPS OVER');
    assert.equal(focusSecondarySignalLabel({ kind: 'childAtLimit', count: 1 }), '1 APP AT LIMIT');
    assert.equal(focusSecondarySignalLabel({ kind: 'childAtLimit', count: 2 }), '2 APPS AT LIMIT');
    assert.equal(focusSecondarySignalLabel(null), null);
  });
});

describe('custom groups', () => {
  test('stores a brand-new group that arrives with an id already minted', () => {
    // The create sheet mints the id up front so it has something to hang the
    // native app selection on while the form is still being filled. Saving used
    // to treat "has an id" as "already stored" and map over the list, which
    // matched nothing and dropped the group — while still handing the caller
    // its group back, so the plan recorded an id whose name and face were gone.
    const id = createCustomGroupId();
    const saved = saveCustomGroup({
      id,
      name: 'Evening scroll',
      appIds: ['instagram'],
      icon: 'mobile-phone',
    });

    assert.ok(saved);
    assert.equal(saved?.id, id);
    assert.equal(getDayPlanState().customGroups.some(group => group.id === id), true);
    // What the plan board actually reads back.
    assert.equal(groupName(getDayPlanState(), id), 'Evening scroll');
    assert.equal(groupIcon(getDayPlanState(), id), 'mobile-phone');
  });

  test('updates in place rather than duplicating when the group is already stored', () => {
    const id = createCustomGroupId();
    saveCustomGroup({ id, name: 'Late news', appIds: [], icon: 'newspaper' });
    saveCustomGroup({ id, name: 'Late news', appIds: ['reddit'], icon: 'books' });

    const matches = getDayPlanState().customGroups.filter(group => group.id === id);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].appIds.length, 1);
    assert.equal(groupIcon(getDayPlanState(), id), 'books');
  });
});

describe('Always Blocked system group', () => {
  test('reserves one stable group identity outside user-created plan groups', () => {
    assert.equal(ALWAYS_BLOCKED_GROUP_ID, 'always-blocked');
    assert.equal(groupName(state(), ALWAYS_BLOCKED_GROUP_ID), 'Always Blocked');
    assert.equal(customGroupNameAvailable('Always Blocked'), false);
  });

  test('never persists an Always Blocked app as a plan-only Essential', () => {
    assert.equal(saveAlwaysBlockedApp({
      appId: 'instagram',
      strength: 'strict',
      practice: 'prayer',
    }), true);

    const saved = saveDayPlan({
      name: 'Always Blocked invariant',
      essentialAppIds: ['instagram', 'gmail'],
      budgetMinutes: 240,
      strength: 'loose',
      rules: [],
      zones: [],
    });

    try {
      assert.deepEqual(saved.essentialAppIds, ['gmail']);
    } finally {
      removeAlwaysBlockedApp('instagram');
      deleteDayPlan(saved.id);
    }
  });

  test('keeps the previous plan group so removal restores the app there', () => {
    const saved = saveDayPlan({
      name: 'Always Blocked group restoration',
      budgetMinutes: 240,
      strength: 'loose',
      rules: [],
      zones: [],
      groupCatalog: {
        ...Object.fromEntries(APP_CATEGORIES.map(group => [group.id, []])),
        social: ['instagram'],
      },
    });

    try {
      assert.equal(saveAlwaysBlockedApp({
        appId: 'instagram',
        strength: 'loose',
        practice: 'prayer',
      }), true);
      assert.deepEqual(
        getDayPlanState().plans.find(item => item.id === saved.id)?.groupCatalog.social,
        ['instagram']
      );

      removeAlwaysBlockedApp('instagram');
      assert.deepEqual(
        getDayPlanState().plans.find(item => item.id === saved.id)?.groupCatalog.social,
        ['instagram']
      );
    } finally {
      removeAlwaysBlockedApp('instagram');
      deleteDayPlan(saved.id);
    }
  });

  test('changing strength updates in place instead of reordering the list', () => {
    removeAlwaysBlockedApp('instagram');
    removeAlwaysBlockedApp('tiktok');

    try {
      assert.equal(saveAlwaysBlockedApp({ appId: 'instagram', strength: 'strict', practice: 'prayer' }), true);
      assert.equal(saveAlwaysBlockedApp({ appId: 'tiktok', strength: 'strict', practice: 'prayer' }), true);
      assert.equal(saveAlwaysBlockedApp({ appId: 'instagram', strength: 'loose', practice: 'prayer' }), true);

      const rules = getDayPlanState().alwaysBlockedApps.filter(rule => (
        rule.appId === 'instagram' || rule.appId === 'tiktok'
      ));
      assert.deepEqual(rules.map(rule => rule.appId), ['instagram', 'tiktok']);
      assert.equal(rules[0]?.strength, 'loose');
    } finally {
      removeAlwaysBlockedApp('instagram');
      removeAlwaysBlockedApp('tiktok');
    }
  });
});

describe('SQLite persistence queue', () => {
  test('persists plan, schedule, Essentials, Quiet Hour, and Clean Sight changes', async () => {
    const beforeWrites = global.__focusTestDb.calls.length;
    const saved = saveDayPlan({
      name: 'Persisted plan',
      essentialsOnly: true,
      essentialAppIds: ['gmail'],
      budgetMinutes: 0,
      strength: 'strict',
      rules: [],
      zones: [],
    });
    assert.equal(saved.essentialsOnly, true);
    assert.equal(saved.budgetMinutes, 60);
    assert.equal(saved.tolerableMinutes, 180);
    assert.equal(saved.essentialOnlyMinutes, 180);
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
