import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import {
  APP_CATEGORIES,
  addCustomDomain,
  addDomainToWebPack,
  activeZone,
  assignPlanToWeekday,
  assignPlanToWeekdayAndToday,
  cancelPendingChange,
  computeStreak,
  connectedSessionsAreValid,
  dateKey,
  describeRules,
  describeZones,
  FOCUS_SESSION_PLANNING_ENABLED,
  getDayPlanState,
  getEffectivePlan,
  getPlanSnapshotForDate,
  HARD_LOCK_DISABLE_DELAY_MS,
  hardLockDelayMs,
  normalizeConnectedSessions,
  planHasProtectionNow,
  planLeisureBudget,
  plannedMinutesByGroup,
  permanentlyLockWebHardLock,
  reconcileNativeTargetArmedDays,
  recordUsageSnapshot,
  removeCustomDomain,
  removeDomainFromWebPack,
  removeSessionAndExtendPrevious,
  resolveAppAccess,
  rulesForPlanAt,
  runtimePlanKind,
  saveDayPlan,
  saveOptionalEssentialApps,
  setPackMode,
  splitSessionAt,
  startQuietHour,
  swapTodayPlan,
  tickDayPlanStore,
  updateWebHardLock,
  endQuietHour,
  weekdayMondayFirst,
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
import {
  sortUsageRows,
  usageActivityState,
  usageBoundaryState,
} from '../components/focus-watch/todayUsageModel';

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
    assert.equal(hardLockDelayMs('45m'), 45 * 60_000);
    assert.equal(hardLockDelayMs('3d'), 3 * 24 * 60 * 60_000);

    updateWebHardLock({ cooldown: '45m' });
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

  test('Hard Lock uses a full-day exit delay and preserves legacy permanent locks', () => {
    assert.equal(getDayPlanState().purity.locks.enabled, true);
    const requestedAt = Date.now();
    updateWebHardLock({ enabled: false });
    const pendingDisable = getDayPlanState().pendingChanges.find(change =>
      change.action.kind === 'locks' && change.action.partial.enabled === false
    );
    assert.ok(pendingDisable);
    assert.ok(pendingDisable.effectiveAt - requestedAt >= HARD_LOCK_DISABLE_DELAY_MS);
    assert.ok(pendingDisable.effectiveAt - requestedAt < HARD_LOCK_DISABLE_DELAY_MS + 1_000);
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
    assert.equal(updateWebHardLock({ cooldown: '45m' }), true);
    const pendingShorterDelay = getDayPlanState().pendingChanges.find(change =>
      change.action.kind === 'locks' && change.action.partial.cooldown === '45m'
    );
    assert.ok(pendingShorterDelay);
    assert.equal(getDayPlanState().purity.locks.cooldown, '3d');
    tickDayPlanStore(pendingShorterDelay.effectiveAt);
    assert.deepEqual(getDayPlanState().purity.locks, {
      enabled: true,
      locked: true,
      cooldown: '45m',
    });
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

  test('distinguishes planned, within, over, blocked, and open boundaries', () => {
    assert.equal(usageBoundaryState('limit', 45, null), 'planned');
    assert.equal(usageBoundaryState('limit', 45, 0), 'planned');
    assert.equal(usageBoundaryState('limit', 45, 44), 'within');
    assert.equal(usageBoundaryState('limit', 45, 46), 'over');
    assert.equal(usageBoundaryState('blocked', null, 0), 'blocked');
    assert.equal(usageBoundaryState('blocked', null, 1), 'over');
    assert.equal(usageBoundaryState('noLimit', null, 240), 'open');
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
