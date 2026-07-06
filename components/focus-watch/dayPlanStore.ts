import { useSyncExternalStore } from 'react';
import {
  deletePlanRow,
  insertEventRow,
  loadFocusWatchData,
  setMetaRow,
  setScheduleDayRow,
  upsertDayRow,
  upsertPlanRow,
} from './focusWatchDb';

// The Focus (Day Plan) store — single source of truth for the FOCUS tab.
// Blueprint: docs/anasta-focus-blueprint-v3.md. Phase 1 keeps enforcement
// mocked (no real Screen Time), but every shape here is the one the native
// bridge will fill in Phase 2, and everything persists to SQLite.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Strength = 'loose' | 'strict';
export type PracticeKind = 'prayer' | 'jesus-prayer' | 'psalm' | 'chapter' | 'intention';

export type GroupRule = {
  groupId: string;                 // category id or custom group id
  dailyMinutes: number | null;     // null = no time limit
  strength: Strength;
  practice: PracticeKind;
};

export type PlanZone = {
  id: string;
  name: string;                    // Morning / Day / Evening / Night by default
  startMinutes: number;            // 0..1439
  endMinutes: number;              // endMinutes <= startMinutes ⇒ wraps past midnight
  closedGroupIds: string[];        // groups fully closed during this zone
};

export type DayPlan = {
  id: string;
  name: string;
  zones: PlanZone[];               // 0..4, non-overlapping; gaps = open time
  rules: GroupRule[];              // one per leisure group (categories + custom groups)
  createdAt: number;
  updatedAt: number;
};

export type CustomGroup = {
  id: string;
  name: string;
  appIds: string[];
};

// Monday-first: 0 = Mon … 6 = Sun (matches the rest of the app).
export type WeeklySchedule = (string | null)[];

export type DayStatus = 'pending' | 'kept' | 'broken' | 'off';

export type DayRecord = {
  date: string;                    // 'YYYY-MM-DD' (local)
  planId: string | null;
  status: DayStatus;
  violations: number;
};

export type WatchSelection = {
  categoryIds: string[];
  appIds: string[];
  groupIds: string[];
};

export type QuietHourSession = {
  startedAt: number;
  endsAt: number;
  totalMs: number;
  strength: Strength;
  selection: WatchSelection;
};

export type OpenDoor = {
  groupId: string;
  endsAt: number;
  totalMs: number;
};

export type FocusEventKind =
  | 'attempt'
  | 'returned'
  | 'door_opened'
  | 'limit_exceeded'
  | 'zone_breach'
  | 'plan_swapped'
  | 'quiet_started'
  | 'quiet_ended';

export type WebPackId = 'gambling' | 'adult' | 'social' | 'news';
export type PackMode = 'off' | 'on' | 'never';

export type CustomDomain = { domain: string; never: boolean };

export type LockCooldown = '10m' | '1h' | 'morning';

export type LocksState = {
  enabled: boolean;
  cooldown: LockCooldown;
  uninstallProtection: boolean;
  denyNewApps: boolean;
};

export type PurityState = {
  packs: { id: WebPackId; mode: PackMode }[];
  customDomains: CustomDomain[];
  locks: LocksState;
};

// A weakening change held back by the lock cooldown. Applied by tick().
export type PendingChange = {
  id: string;
  effectiveAt: number;
  label: string;
  action:
    | { kind: 'pack-mode'; packId: WebPackId; mode: PackMode }
    | { kind: 'domain-never'; domain: string; never: boolean }
    | { kind: 'domain-remove'; domain: string }
    | { kind: 'locks'; partial: Partial<LocksState> };
};

export type ScreenTimePermissionStatus = 'notDetermined' | 'approved' | 'denied';

export type StreakSummary = {
  current: number;
  best: number;
  trophies: number;
};

export type DayPlanState = {
  hydrated: boolean;
  permission: ScreenTimePermissionStatus;
  plans: DayPlan[];
  schedule: WeeklySchedule;
  customGroups: CustomGroup[];
  days: Record<string, DayRecord>;
  quiet: QuietHourSession | null;
  door: OpenDoor | null;
  purity: PurityState;
  pendingChanges: PendingChange[];
  streak: StreakSummary;
  milestonesShown: number[];
  pendingMilestone: number | null;
  returnedMoments: number;
};

// ---------------------------------------------------------------------------
// Static content
// ---------------------------------------------------------------------------

export const APP_CATEGORIES = [
  { id: 'social', name: 'Social' },
  { id: 'entertainment', name: 'Entertainment' },
  { id: 'games', name: 'Games' },
  { id: 'news', name: 'News' },
  { id: 'shopping', name: 'Shopping' },
  { id: 'dating', name: 'Dating' },
] as const;

export const RETURN_PRACTICES: { id: PracticeKind; name: string; detail: string }[] = [
  { id: 'prayer', name: 'Short Prayer', detail: 'One short prayer before the door opens' },
  { id: 'jesus-prayer', name: 'Jesus Prayer', detail: 'Two minutes of the Jesus Prayer' },
  { id: 'psalm', name: 'Psalm', detail: 'One Psalm, chosen for the moment' },
  { id: 'chapter', name: 'A Bible chapter', detail: 'One chapter before you enter' },
  { id: 'intention', name: 'Written intention', detail: 'Write down why you are opening it' },
];

export const STREAK_MILESTONES = [7, 30, 100] as const;

export const ZONE_NAME_SUGGESTIONS = ['Morning', 'Day', 'Evening', 'Night'];

const ALL_CATEGORY_IDS = APP_CATEGORIES.map(category => category.id);

// ---------------------------------------------------------------------------
// Date & time helpers (24h everywhere — one formatter for the whole tab)
// ---------------------------------------------------------------------------

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export function formatTimeOfDay(minutes: number) {
  const clamped = ((minutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
}

export function formatClockMs(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatEndsAt(endsAt: number) {
  const date = new Date(endsAt);
  return formatTimeOfDay(date.getHours() * 60 + date.getMinutes());
}

export function formatMinutesShort(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function weekdayMondayFirst(date: Date) {
  return (date.getDay() + 6) % 7;
}

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function minutesOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

export function dayFraction(now: Date) {
  return (minutesOfDay(now) * 60 + now.getSeconds()) / 86_400;
}

// ---------------------------------------------------------------------------
// Zone geometry (overnight aware)
// ---------------------------------------------------------------------------

export function zoneDurationMinutes(zone: Pick<PlanZone, 'startMinutes' | 'endMinutes'>) {
  const { startMinutes, endMinutes } = zone;
  return endMinutes > startMinutes ? endMinutes - startMinutes : 1440 - startMinutes + endMinutes;
}

export function zoneContains(zone: Pick<PlanZone, 'startMinutes' | 'endMinutes'>, minute: number) {
  const { startMinutes, endMinutes } = zone;
  if (endMinutes > startMinutes) return minute >= startMinutes && minute < endMinutes;
  return minute >= startMinutes || minute < endMinutes;
}

// Splits a zone into linear [start, end) segments on the 0..1440 line.
function zoneSegments(zone: Pick<PlanZone, 'startMinutes' | 'endMinutes'>): [number, number][] {
  const { startMinutes, endMinutes } = zone;
  if (endMinutes > startMinutes) return [[startMinutes, endMinutes]];
  return [[startMinutes, 1440], [0, endMinutes]];
}

export function zonesOverlap(zones: Pick<PlanZone, 'startMinutes' | 'endMinutes'>[]) {
  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      for (const [aStart, aEnd] of zoneSegments(zones[i])) {
        for (const [bStart, bEnd] of zoneSegments(zones[j])) {
          if (aStart < bEnd && bStart < aEnd) return true;
        }
      }
    }
  }
  return false;
}

export function activeZone(plan: DayPlan | null | undefined, now: Date): PlanZone | null {
  if (!plan) return null;
  const minute = minutesOfDay(now);
  return plan.zones.find(zone => zoneContains(zone, minute)) ?? null;
}

// The next moment the zone picture changes today — for "Next: Evening 21:00".
export function nextZoneStart(plan: DayPlan | null | undefined, now: Date): PlanZone | null {
  if (!plan || plan.zones.length === 0) return null;
  const minute = minutesOfDay(now);
  const upcoming = plan.zones
    .filter(zone => zone.startMinutes > minute)
    .sort((a, b) => a.startMinutes - b.startMinutes);
  return upcoming[0] ?? null;
}

// ---------------------------------------------------------------------------
// Names (fix for the old raw-id chips bug: always resolve display names)
// ---------------------------------------------------------------------------

export function groupName(state: DayPlanState, groupId: string): string {
  const category = APP_CATEGORIES.find(entry => entry.id === groupId);
  if (category) return category.name;
  const group = state.customGroups.find(entry => entry.id === groupId);
  if (group) return group.name;
  return groupId;
}

export function selectionCount(selection: WatchSelection) {
  return selection.categoryIds.length + selection.appIds.length + selection.groupIds.length;
}

export function selectionTagLabels(
  state: DayPlanState,
  selection: WatchSelection,
  maxVisible = 3
): string[] {
  const labels = [
    ...selection.categoryIds.map(id => groupName(state, id)),
    ...selection.groupIds.map(id => groupName(state, id)),
    ...selection.appIds.map(id => id.charAt(0).toUpperCase() + id.slice(1)),
  ];
  if (labels.length === 0) return ['Nothing selected'];
  if (labels.length <= maxVisible) return labels;
  const visibleCount = Math.max(1, maxVisible - 1);
  return [...labels.slice(0, visibleCount), `+${labels.length - visibleCount} more`];
}

export function describeZones(plan: DayPlan): string {
  if (plan.zones.length === 0) return 'No zones — limits only';
  const count = `${plan.zones.length} ${plan.zones.length === 1 ? 'zone' : 'zones'}`;
  const names = plan.zones.map(zone => zone.name).join(', ');
  return `${count} · ${names}`;
}

export function describeRules(state: DayPlanState, plan: DayPlan): string {
  const limited = plan.rules.filter(rule => rule.dailyMinutes != null);
  if (limited.length === 0) return 'No daily limits';
  return limited
    .slice(0, 3)
    .map(rule => `${groupName(state, rule.groupId)} ${formatMinutesShort(rule.dailyMinutes!)}`)
    .join(' · ') + (limited.length > 3 ? ` · +${limited.length - 3}` : '');
}

export function planLeisureBudget(plan: DayPlan): number {
  return plan.rules.reduce((sum, rule) => sum + (rule.dailyMinutes ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Rules completeness — every leisure group always has a rule entry
// ---------------------------------------------------------------------------

const DEFAULT_RULE = (groupId: string): GroupRule => ({
  groupId,
  dailyMinutes: null,
  strength: 'loose',
  practice: 'prayer',
});

function withCompleteRules(plan: DayPlan, customGroups: CustomGroup[]): DayPlan {
  const groupIds = [...ALL_CATEGORY_IDS, ...customGroups.map(group => group.id)];
  const existing = new Map(plan.rules.map(rule => [rule.groupId, rule]));
  const rules = groupIds.map(id => existing.get(id) ?? DEFAULT_RULE(id));
  const validIds = new Set(groupIds);
  return {
    ...plan,
    rules,
    zones: plan.zones.map(zone => ({
      ...zone,
      closedGroupIds: zone.closedGroupIds.filter(id => validIds.has(id)),
    })),
  };
}

export function ruleFor(plan: DayPlan | null | undefined, groupId: string): GroupRule {
  return plan?.rules.find(rule => rule.groupId === groupId) ?? DEFAULT_RULE(groupId);
}

// ---------------------------------------------------------------------------
// Streak math — the merciful streak (blueprint §2)
// ---------------------------------------------------------------------------

// One broken day is a gap the streak survives; two consecutive broken
// protected days reset it. Off days are invisible to the count.
export function computeStreak(days: Record<string, DayRecord>): StreakSummary {
  const resolved = Object.values(days)
    .filter(day => day.status === 'kept' || day.status === 'broken')
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  let run = 0;
  let best = 0;
  let trophies = 0;
  let brokenRun = 0;

  for (const day of resolved) {
    if (day.status === 'kept') {
      run += 1;
      brokenRun = 0;
      best = Math.max(best, run);
      trophies += 1;
    } else {
      brokenRun += 1;
      if (brokenRun >= 2) run = 0;
    }
  }

  return { current: run, best, trophies };
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const DEFAULT_PURITY: PurityState = {
  packs: [
    { id: 'gambling', mode: 'off' },
    { id: 'adult', mode: 'off' },
    { id: 'social', mode: 'off' },
    { id: 'news', mode: 'off' },
  ],
  customDomains: [],
  locks: {
    enabled: false,
    cooldown: '1h',
    uninstallProtection: true,
    denyNewApps: false,
  },
};

let state: DayPlanState = {
  hydrated: false,
  permission: 'notDetermined',
  plans: [],
  schedule: [null, null, null, null, null, null, null],
  customGroups: [],
  days: {},
  quiet: null,
  door: null,
  purity: DEFAULT_PURITY,
  pendingChanges: [],
  streak: { current: 0, best: 0, trophies: 0 },
  milestonesShown: [],
  pendingMilestone: null,
  returnedMoments: 0,
};

const listeners = new Set<() => void>();

function emit() {
  state = { ...state };
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): DayPlanState {
  return state;
}

export function useDayPlan(): DayPlanState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getDayPlanState(): DayPlanState {
  return state;
}

// Serialized write queue so SQLite writes never race each other.
let writeChain: Promise<unknown> = Promise.resolve();
function persist(work: () => Promise<unknown>) {
  writeChain = writeChain.then(work).catch(error => {
    console.warn('[focus-watch] persist failed', error);
  });
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function logEvent(kind: FocusEventKind, extra?: { groupId?: string; planId?: string; meta?: Record<string, unknown> }) {
  persist(() =>
    insertEventRow({
      id: makeId('ev'),
      ts: Date.now(),
      kind,
      group_id: extra?.groupId ?? null,
      plan_id: extra?.planId ?? null,
      meta_json: extra?.meta ? JSON.stringify(extra.meta) : null,
    })
  );
}

function persistDay(record: DayRecord) {
  persist(() =>
    upsertDayRow({
      date: record.date,
      plan_id: record.planId,
      status: record.status,
      violations: record.violations,
    })
  );
}

function persistPlan(plan: DayPlan) {
  persist(() =>
    upsertPlanRow({
      id: plan.id,
      name: plan.name,
      zones_json: JSON.stringify(plan.zones),
      rules_json: JSON.stringify(plan.rules),
      created_at: plan.createdAt,
      updated_at: plan.updatedAt,
    })
  );
}

function persistMeta(key: string, value: unknown | null) {
  persist(() => setMetaRow(key, value === null ? null : JSON.stringify(value)));
}

// ---------------------------------------------------------------------------
// Seeding (first run only)
// ---------------------------------------------------------------------------

function seededPlans(now: number): { plans: DayPlan[]; schedule: WeeklySchedule } {
  const weekdays: DayPlan = withCompleteRules(
    {
      id: 'plan-weekdays',
      name: 'Weekdays',
      zones: [
        { id: 'zone-wd-morning', name: 'Morning', startMinutes: 360, endMinutes: 540, closedGroupIds: ['social', 'news'] },
        { id: 'zone-wd-evening', name: 'Evening', startMinutes: 1260, endMinutes: 1380, closedGroupIds: ['social', 'entertainment', 'games'] },
        { id: 'zone-wd-night', name: 'Night', startMinutes: 1380, endMinutes: 360, closedGroupIds: [...ALL_CATEGORY_IDS] },
      ],
      rules: [
        { groupId: 'social', dailyMinutes: 45, strength: 'loose', practice: 'prayer' },
        { groupId: 'entertainment', dailyMinutes: 45, strength: 'loose', practice: 'prayer' },
        { groupId: 'games', dailyMinutes: 30, strength: 'loose', practice: 'prayer' },
      ],
      createdAt: now,
      updatedAt: now,
    },
    []
  );

  const weekend: DayPlan = withCompleteRules(
    {
      id: 'plan-weekend',
      name: 'Weekend',
      zones: [
        { id: 'zone-we-night', name: 'Night', startMinutes: 1410, endMinutes: 420, closedGroupIds: [...ALL_CATEGORY_IDS] },
      ],
      rules: [
        { groupId: 'social', dailyMinutes: 90, strength: 'loose', practice: 'prayer' },
        { groupId: 'entertainment', dailyMinutes: 90, strength: 'loose', practice: 'prayer' },
      ],
      createdAt: now,
      updatedAt: now,
    },
    []
  );

  return {
    plans: [weekdays, weekend],
    schedule: ['plan-weekdays', 'plan-weekdays', 'plan-weekdays', 'plan-weekdays', 'plan-weekdays', 'plan-weekend', 'plan-weekend'],
  };
}

// ---------------------------------------------------------------------------
// Day resolution — runs on hydrate and on every tick across midnight
// ---------------------------------------------------------------------------

function ensureTodayRecord(now: Date): DayRecord {
  const key = dateKey(now);
  const existing = state.days[key];
  if (existing) return existing;
  const planId = state.schedule[weekdayMondayFirst(now)];
  const record: DayRecord = { date: key, planId, status: 'pending', violations: 0 };
  state.days = { ...state.days, [key]: record };
  persistDay(record);
  return record;
}

function resolveDay(record: DayRecord): DayRecord {
  if (record.status !== 'pending') return record;
  // Sticky-broken rule: once violations happened, removing the plan cannot
  // convert the day into a neutral off day.
  const status: DayStatus =
    record.violations > 0 ? 'broken' : record.planId ? 'kept' : 'off';
  return { ...record, status };
}

function refreshStreak(fireMilestones: boolean) {
  const previous = state.streak.current;
  state.streak = computeStreak(state.days);
  if (!fireMilestones) return;
  if (state.streak.current <= previous) return;
  for (const milestone of STREAK_MILESTONES) {
    if (state.streak.current >= milestone && !state.milestonesShown.includes(milestone)) {
      state.pendingMilestone = milestone;
      break;
    }
  }
}

function resolvePastDays(now: Date) {
  const todayKeyStr = dateKey(now);
  let changed = false;
  const nextDays: Record<string, DayRecord> = { ...state.days };
  for (const key of Object.keys(nextDays)) {
    if (key >= todayKeyStr) continue;
    const record = nextDays[key];
    if (record.status !== 'pending') continue;
    const resolved = resolveDay(record);
    nextDays[key] = resolved;
    persistDay(resolved);
    changed = true;
  }
  if (changed) {
    state.days = nextDays;
    refreshStreak(true);
  }
  ensureTodayRecord(now);
}

// ---------------------------------------------------------------------------
// Hydration
// ---------------------------------------------------------------------------

let hydrationStarted = false;

export async function hydrateDayPlanStore() {
  if (hydrationStarted) return;
  hydrationStarted = true;

  try {
    const data = await loadFocusWatchData();
    const now = new Date();
    const nowMs = Date.now();

    const parse = <T,>(value: string | undefined, fallback: T): T => {
      if (!value) return fallback;
      try {
        return JSON.parse(value) as T;
      } catch {
        return fallback;
      }
    };

    state.customGroups = parse<CustomGroup[]>(data.meta.custom_groups, []);

    let plans: DayPlan[] = data.plans.map(row => ({
      id: row.id,
      name: row.name,
      zones: parse<PlanZone[]>(row.zones_json, []),
      rules: parse<GroupRule[]>(row.rules_json, []),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    let schedule: WeeklySchedule = [null, null, null, null, null, null, null];
    for (const row of data.schedule) {
      if (row.day >= 0 && row.day < 7) schedule[row.day] = row.plan_id;
    }

    if (!data.meta.seeded && plans.length === 0) {
      const seeded = seededPlans(nowMs);
      plans = seeded.plans;
      schedule = seeded.schedule;
      for (const plan of plans) persistPlan(plan);
      schedule.forEach((planId, day) => persist(() => setScheduleDayRow(day, planId)));
      persistMeta('seeded', 1);
    }

    state.plans = plans.map(plan => withCompleteRules(plan, state.customGroups));
    state.schedule = schedule;

    state.days = {};
    for (const row of data.days) {
      state.days[row.date] = {
        date: row.date,
        planId: row.plan_id,
        status: (row.status as DayStatus) ?? 'pending',
        violations: row.violations ?? 0,
      };
    }

    state.permission = parse<ScreenTimePermissionStatus>(data.meta.permission, 'notDetermined');
    state.purity = { ...DEFAULT_PURITY, ...parse<Partial<PurityState>>(data.meta.purity_state, {}) };
    state.purity.locks = { ...DEFAULT_PURITY.locks, ...state.purity.locks };
    state.pendingChanges = parse<PendingChange[]>(data.meta.pending_changes, []);
    state.milestonesShown = parse<number[]>(data.meta.milestones_shown, []);
    state.returnedMoments = parse<number>(data.meta.returned_moments, 0);

    const quiet = parse<QuietHourSession | null>(data.meta.quiet_session, null);
    state.quiet = quiet && quiet.endsAt > nowMs ? quiet : null;
    if (quiet && quiet.endsAt <= nowMs) persistMeta('quiet_session', null);

    const door = parse<OpenDoor | null>(data.meta.open_door, null);
    state.door = door && door.endsAt > nowMs ? door : null;
    if (door && door.endsAt <= nowMs) persistMeta('open_door', null);

    resolvePastDays(now);
    refreshStreak(false);
    applyDuePendingChanges(nowMs);
  } catch (error) {
    console.warn('[focus-watch] hydration failed', error);
  } finally {
    state.hydrated = true;
    emit();
  }
}

// Kick hydration off as soon as the module loads.
hydrateDayPlanStore();

// ---------------------------------------------------------------------------
// Tick — screens with a clock call this; it expires sessions, applies due
// pending changes and rolls the day over midnight. Idempotent and cheap.
// ---------------------------------------------------------------------------

export function tickDayPlanStore(nowMs = Date.now()) {
  if (!state.hydrated) return;
  let changed = false;

  if (state.quiet && state.quiet.endsAt <= nowMs) {
    state.quiet = null;
    persistMeta('quiet_session', null);
    logEvent('quiet_ended');
    changed = true;
  }

  if (state.door && state.door.endsAt <= nowMs) {
    state.door = null;
    persistMeta('open_door', null);
    changed = true;
  }

  const now = new Date(nowMs);
  if (!state.days[dateKey(now)]) {
    resolvePastDays(now);
    changed = true;
  }

  if (applyDuePendingChanges(nowMs)) changed = true;

  if (changed) emit();
}

// ---------------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------------

export function hasScreenTimePermission() {
  return state.permission === 'approved';
}

// Phase 1 mock. Phase 2 replaces this with FamilyControls.AuthorizationCenter.
export function grantScreenTimePermission() {
  state.permission = 'approved';
  persistMeta('permission', state.permission);
  emit();
}

export function markScreenTimePermissionDenied() {
  state.permission = 'denied';
  persistMeta('permission', state.permission);
  emit();
}

// ---------------------------------------------------------------------------
// Plans & weekly schedule
// ---------------------------------------------------------------------------

export function saveDayPlan(
  input: Omit<DayPlan, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): DayPlan {
  const now = Date.now();
  const existing = input.id ? state.plans.find(plan => plan.id === input.id) : undefined;
  const saved = withCompleteRules(
    {
      ...input,
      id: input.id ?? makeId('plan'),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    },
    state.customGroups
  );
  state.plans = existing
    ? state.plans.map(plan => (plan.id === saved.id ? saved : plan))
    : [...state.plans, saved];
  persistPlan(saved);
  emit();
  return saved;
}

export function deleteDayPlan(id: string) {
  state.plans = state.plans.filter(plan => plan.id !== id);
  state.schedule = state.schedule.map(planId => (planId === id ? null : planId));
  state.schedule.forEach((planId, day) => persist(() => setScheduleDayRow(day, planId)));

  // Today's record: keep a broken day broken; otherwise drop the reference.
  const today = state.days[dateKey(new Date())];
  if (today && today.planId === id) {
    const next = { ...today, planId: null };
    state.days = { ...state.days, [today.date]: next };
    persistDay(next);
  }

  persist(() => deletePlanRow(id));
  emit();
}

export function assignPlanToWeekday(day: number, planId: string | null) {
  if (day < 0 || day > 6) return;
  state.schedule = state.schedule.map((entry, index) => (index === day ? planId : entry));
  persist(() => setScheduleDayRow(day, planId));

  // If today's record is untouched (no swap, no violations), follow the template.
  const now = new Date();
  if (weekdayMondayFirst(now) === day) {
    const today = ensureTodayRecord(now);
    if (today.status === 'pending' && today.violations === 0) {
      const next = { ...today, planId };
      state.days = { ...state.days, [today.date]: next };
      persistDay(next);
    }
  }
  emit();
}

// Swapping today's plan is always allowed, in any direction, and never costs
// the trophy (user decision, blueprint §2). Only violations break the day.
export function swapTodayPlan(planId: string | null) {
  const now = new Date();
  const today = ensureTodayRecord(now);
  const next = { ...today, planId };
  state.days = { ...state.days, [today.date]: next };
  persistDay(next);
  logEvent('plan_swapped', { planId: planId ?? undefined });
  emit();
}

export function getEffectivePlan(stateArg: DayPlanState, date: Date): DayPlan | null {
  const record = stateArg.days[dateKey(date)];
  const planId = record ? record.planId : stateArg.schedule[weekdayMondayFirst(date)];
  return stateArg.plans.find(plan => plan.id === planId) ?? null;
}

export function getPlanById(stateArg: DayPlanState, planId: string | null | undefined): DayPlan | null {
  if (!planId) return null;
  return stateArg.plans.find(plan => plan.id === planId) ?? null;
}

// ---------------------------------------------------------------------------
// Custom groups
// ---------------------------------------------------------------------------

export function saveCustomGroup(group: Omit<CustomGroup, 'id'> & { id?: string }) {
  if (group.id) {
    const id = group.id;
    state.customGroups = state.customGroups.map(existing =>
      existing.id === id ? { ...group, id } : existing
    );
  } else {
    state.customGroups = [...state.customGroups, { ...group, id: makeId('group') }];
  }
  state.plans = state.plans.map(plan => withCompleteRules(plan, state.customGroups));
  state.plans.forEach(persistPlan);
  persistMeta('custom_groups', state.customGroups);
  emit();
}

export function deleteCustomGroup(id: string) {
  state.customGroups = state.customGroups.filter(group => group.id !== id);
  state.plans = state.plans.map(plan =>
    withCompleteRules(
      { ...plan, rules: plan.rules.filter(rule => rule.groupId !== id) },
      state.customGroups
    )
  );
  state.plans.forEach(persistPlan);
  persistMeta('custom_groups', state.customGroups);
  emit();
}

// ---------------------------------------------------------------------------
// Quiet Hour (the panic button)
// ---------------------------------------------------------------------------

export const QUIET_DEFAULT_SELECTION: WatchSelection = {
  categoryIds: [...ALL_CATEGORY_IDS],
  appIds: [],
  groupIds: [],
};

export function startQuietHour(options: {
  minutes: number;
  strength: Strength;
  selection: WatchSelection;
}) {
  const now = Date.now();
  state.quiet = {
    startedAt: now,
    endsAt: now + options.minutes * 60_000,
    totalMs: options.minutes * 60_000,
    strength: options.strength,
    selection: options.selection,
  };
  persistMeta('quiet_session', state.quiet);
  logEvent('quiet_started', { meta: { minutes: options.minutes, strength: options.strength } });
  emit();
}

export function extendQuietHour(minutes: number) {
  if (!state.quiet) return;
  state.quiet = {
    ...state.quiet,
    endsAt: state.quiet.endsAt + minutes * 60_000,
    totalMs: state.quiet.totalMs + minutes * 60_000,
  };
  persistMeta('quiet_session', state.quiet);
  emit();
}

export function endQuietHour() {
  if (!state.quiet) return;
  state.quiet = null;
  persistMeta('quiet_session', null);
  logEvent('quiet_ended');
  emit();
}

// ---------------------------------------------------------------------------
// Violations, returned moments, the open door
// ---------------------------------------------------------------------------

function bumpTodayViolations(kind: FocusEventKind, groupId?: string) {
  const now = new Date();
  const today = ensureTodayRecord(now);
  const next = { ...today, violations: today.violations + 1 };
  state.days = { ...state.days, [today.date]: next };
  persistDay(next);
  logEvent(kind, { groupId, planId: today.planId ?? undefined });
}

export function recordReturnedMoment(groupId?: string) {
  state.returnedMoments += 1;
  persistMeta('returned_moments', state.returnedMoments);
  logEvent('returned', { groupId });
  emit();
}

// Entering through the loose door after a practice: allowed, but it is a
// violation — the day's trophy is lost (blueprint §2).
export function openDoorFor(groupId: string, minutes: number) {
  const now = Date.now();
  state.door = {
    groupId,
    endsAt: now + minutes * 60_000,
    totalMs: minutes * 60_000,
  };
  persistMeta('open_door', state.door);
  bumpTodayViolations('door_opened', groupId);
  emit();
}

export function closeDoor() {
  if (!state.door) return;
  state.door = null;
  persistMeta('open_door', null);
  emit();
}

// Native Phase 2 will call these from real threshold events; the mock UI can
// also trigger them from the intervention preview.
export function recordLimitExceeded(groupId: string) {
  bumpTodayViolations('limit_exceeded', groupId);
  emit();
}

export function recordZoneBreach(groupId: string) {
  bumpTodayViolations('zone_breach', groupId);
  emit();
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export function acknowledgeMilestone() {
  if (state.pendingMilestone == null) return;
  state.milestonesShown = [...state.milestonesShown, state.pendingMilestone];
  state.pendingMilestone = null;
  persistMeta('milestones_shown', state.milestonesShown);
  emit();
}

// ---------------------------------------------------------------------------
// Purity (Clean Sight) + Locks with cooldown pending changes
// ---------------------------------------------------------------------------

function cooldownMs(cooldown: LockCooldown, nowMs: number) {
  if (cooldown === '10m') return 10 * 60_000;
  if (cooldown === '1h') return 60 * 60_000;
  const next = new Date(nowMs);
  next.setDate(next.getDate() + 1);
  next.setHours(6, 0, 0, 0);
  return next.getTime() - nowMs;
}

function persistPurity() {
  persistMeta('purity_state', state.purity);
}

function persistPendingChanges() {
  persistMeta('pending_changes', state.pendingChanges);
}

function applyChangeAction(action: PendingChange['action']) {
  if (action.kind === 'pack-mode') {
    state.purity = {
      ...state.purity,
      packs: state.purity.packs.map(pack =>
        pack.id === action.packId ? { ...pack, mode: action.mode } : pack
      ),
    };
  } else if (action.kind === 'domain-never') {
    state.purity = {
      ...state.purity,
      customDomains: state.purity.customDomains.map(entry =>
        entry.domain === action.domain ? { ...entry, never: action.never } : entry
      ),
    };
  } else if (action.kind === 'domain-remove') {
    state.purity = {
      ...state.purity,
      customDomains: state.purity.customDomains.filter(entry => entry.domain !== action.domain),
    };
  } else {
    state.purity = {
      ...state.purity,
      locks: { ...state.purity.locks, ...action.partial },
    };
  }
  persistPurity();
}

function applyDuePendingChanges(nowMs: number): boolean {
  const due = state.pendingChanges.filter(change => change.effectiveAt <= nowMs);
  if (due.length === 0) return false;
  for (const change of due) applyChangeAction(change.action);
  state.pendingChanges = state.pendingChanges.filter(change => change.effectiveAt > nowMs);
  persistPendingChanges();
  return true;
}

function queueOrApply(action: PendingChange['action'], label: string, weakening: boolean) {
  const nowMs = Date.now();
  if (weakening && state.purity.locks.enabled) {
    state.pendingChanges = [
      ...state.pendingChanges,
      {
        id: makeId('pending'),
        effectiveAt: nowMs + cooldownMs(state.purity.locks.cooldown, nowMs),
        label,
        action,
      },
    ];
    persistPendingChanges();
  } else {
    applyChangeAction(action);
  }
  emit();
}

export function cancelPendingChange(id: string) {
  state.pendingChanges = state.pendingChanges.filter(change => change.id !== id);
  persistPendingChanges();
  emit();
}

const PACK_MODE_RANK: Record<PackMode, number> = { off: 0, on: 1, never: 2 };

export function setPackMode(packId: WebPackId, mode: PackMode) {
  const current = state.purity.packs.find(pack => pack.id === packId)?.mode ?? 'off';
  if (current === mode) return;
  const weakening = PACK_MODE_RANK[mode] < PACK_MODE_RANK[current];
  queueOrApply({ kind: 'pack-mode', packId, mode }, `Pack change waits`, weakening);
}

export function normalizeDomain(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
}

export function addCustomDomain(raw: string, never = false) {
  const domain = normalizeDomain(raw);
  if (!domain || !domain.includes('.')) return;
  if (state.purity.customDomains.some(entry => entry.domain === domain)) return;
  state.purity = {
    ...state.purity,
    customDomains: [...state.purity.customDomains, { domain, never }],
  };
  persistPurity();
  emit();
}

export function setDomainNever(domain: string, never: boolean) {
  const entry = state.purity.customDomains.find(item => item.domain === domain);
  if (!entry || entry.never === never) return;
  // Marking a door "never" is strengthening; unmarking it is weakening.
  queueOrApply({ kind: 'domain-never', domain, never }, `${domain} change waits`, !never);
}

export function removeCustomDomain(domain: string) {
  const entry = state.purity.customDomains.find(item => item.domain === domain);
  if (!entry) return;
  queueOrApply({ kind: 'domain-remove', domain }, `${domain} removal waits`, entry.never);
}

export function updateLocks(partial: Partial<LocksState>) {
  const current = state.purity.locks;
  const weakening =
    (partial.enabled === false && current.enabled) ||
    (partial.uninstallProtection === false && current.uninstallProtection) ||
    (partial.denyNewApps === false && current.denyNewApps);
  queueOrApply({ kind: 'locks', partial }, 'Lock change waits', weakening);
}

// ---------------------------------------------------------------------------
// Live day view (NOW panel)
// ---------------------------------------------------------------------------

export type LiveDayStatus = 'off' | 'kept' | 'broken';

export function getTodayRecord(stateArg: DayPlanState, now: Date): DayRecord | null {
  return stateArg.days[dateKey(now)] ?? null;
}

export function getLiveDayStatus(stateArg: DayPlanState, now: Date): LiveDayStatus {
  const record = getTodayRecord(stateArg, now);
  const planId = record ? record.planId : stateArg.schedule[weekdayMondayFirst(now)];
  if (!planId && (record?.violations ?? 0) === 0) return 'off';
  return (record?.violations ?? 0) > 0 ? 'broken' : 'kept';
}

export function purityActiveCount(purity: PurityState) {
  const packs = purity.packs.filter(pack => pack.mode !== 'off').length;
  return packs + purity.customDomains.length;
}
