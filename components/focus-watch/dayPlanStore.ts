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
import { normalizeWebDomain } from './webProtectionCatalog';

// The Focus v4 store is the React-side source of truth. Product state persists
// to SQLite; private Family Controls selections stay in the shared iOS App
// Group and are referenced here only by stable selection ids.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Strength = 'loose' | 'strict';
export type PracticeKind = 'prayer' | 'jesus-prayer' | 'psalm' | 'chapter' | 'intention';
export type PlanKind = 'daily' | 'session';
export type RuleMode = 'noLimit' | 'limit' | 'blocked';

export type AppRule = {
  appId: string;
  label?: string;
  mode: RuleMode;
  minutes: number | null;
  strength: Strength;
  practice: PracticeKind;
  checkInMinutes: number | null;
};

export type GroupRule = {
  groupId: string;                 // category id or custom group id
  dailyMinutes: number | null;     // null = no time limit
  strength: Strength;
  practice: PracticeKind;
  mode?: RuleMode;                 // absent legacy values are derived from dailyMinutes
  checkInMinutes?: number | null;
  appRules?: AppRule[];
  // Optional slices of this group's minutes given to specific apps
  // ("2h social → 1h Instagram, 30m TikTok, rest shared").
  appSplits?: Record<string, number>;
};

export type PlanZone = {
  id: string;
  name: string;                    // Morning / Day / Evening / Night by default
  startMinutes: number;            // 0..1439
  endMinutes: number;              // endMinutes <= startMinutes ⇒ wraps past midnight
  closedGroupIds: string[];        // groups fully closed during this zone
  rules?: GroupRule[];             // Session-local rules in the v4 model
};

export type DayPlan = {
  id: string;
  name: string;
  kind: PlanKind;
  // The day's whole leisure budget ("4h with this plan"), distributed across
  // group rules; null = no budget, limits stand on their own.
  budgetMinutes: number | null;
  tolerableMinutes: number | null;
  essentialOnlyMinutes: number | null;
  customGroupIds: string[];
  groupCatalog: Record<string, string[]>;
  strength: Strength;              // the plan's default firmness for new limits
  zones: PlanZone[];               // Session plans: 1..4 connected ranges covering 24h
  rules: GroupRule[];              // one per leisure group (categories + custom groups)
  createdAt: number;
  updatedAt: number;
};

export type AlwaysBlockedRule = {
  appId: string;
  strength: Strength;
  practice: PracticeKind;
};

export type FocusUsageSnapshot = {
  date: string;
  planId?: string | null;
  targetMinutes?: number | null;
  tolerableMinutes?: number | null;
  essentialOnlyMinutes?: number | null;
  totalMinutes: number;
  groupMinutes: Record<string, number>;
  appMinutes: Record<string, number>;
  sessionGroupMinutes: Record<string, Record<string, number>>;
  sessionAppMinutes: Record<string, Record<string, number>>;
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
  targetLost: boolean;
};

export type EligibilityState = 'eligible' | 'lost';
export type DayEligibilityLedger = {
  target: EligibilityState;
  groups: Record<string, EligibilityState>;
  apps: Record<string, EligibilityState>;
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
  strength: 'strict';
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
  | 'checkin_continued'
  | 'limit_exceeded'
  | 'zone_breach'
  | 'plan_swapped'
  | 'quiet_started'
  | 'quiet_ended';

export type WebPackId = 'gambling' | 'adult' | 'social' | 'news';
export type PackMode = 'off' | 'on' | 'never';

export type CustomDomain = { domain: string; never: boolean };
export type CustomWebPack = {
  id: string;
  name: string;
  domains: string[];
  mode: PackMode;
};

export type LockCooldown = '10m' | '1h' | 'morning';

export type LocksState = {
  enabled: boolean;
  cooldown: LockCooldown;
  uninstallProtection: boolean;
  denyNewApps: boolean;
};

export type PurityState = {
  packs: { id: WebPackId; mode: PackMode }[];
  customPacks: CustomWebPack[];
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
    | { kind: 'custom-pack-mode'; packId: string; mode: PackMode }
    | { kind: 'custom-pack-remove'; packId: string }
    | { kind: 'custom-pack-domain-remove'; packId: string; domain: string }
    | { kind: 'domain-never'; domain: string; never: boolean }
    | { kind: 'domain-remove'; domain: string }
    | { kind: 'locks'; partial: Partial<LocksState> };
};

export type ScreenTimePermissionStatus = 'notDetermined' | 'approved' | 'denied' | 'preview';

export type NativeProtectionState = {
  status: 'idle' | 'applying' | 'applied' | 'error' | 'preview';
  appliedAt: number | null;
  error: string | null;
  hardWallDate: string | null;
};

export type StreakSummary = {
  current: number;
  best: number;
  trophies: number;
};

export type DayPlanState = {
  hydrated: boolean;
  permission: ScreenTimePermissionStatus;
  nativeProtection: NativeProtectionState;
  plans: DayPlan[];
  schedule: WeeklySchedule;
  customGroups: CustomGroup[];
  optionalEssentialAppIds: string[];
  designatedCoreAppIds: string[];
  alwaysBlockedApps: AlwaysBlockedRule[];
  usageByDate: Record<string, FocusUsageSnapshot>;
  planSnapshotsByDate: Record<string, DayPlan | null>;
  targetArmedByDate: Record<string, string>;
  eligibilityByDate: Record<string, DayEligibilityLedger>;
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

export const DEFAULT_GROUP_APP_IDS: Record<string, string[]> = {
  social: ['whatsapp', 'viber', 'instagram', 'tiktok', 'x', 'facebook', 'reddit', 'snapchat'],
  entertainment: ['youtube', 'netflix', 'twitch', 'primevideo'],
  games: ['roblox', 'pubg', 'clashroyale', 'candycrush', 'brawlstars'],
  news: ['googlenews', 'bbc', 'cnn'],
  shopping: ['amazon', 'ebay', 'temu'],
  dating: ['tinder', 'bumble', 'hinge'],
};

export const RETURN_PRACTICES: { id: PracticeKind; name: string; detail: string }[] = [
  { id: 'prayer', name: 'Short Prayer', detail: 'One short prayer before the door opens' },
  { id: 'jesus-prayer', name: 'Jesus Prayer', detail: 'Two minutes of the Jesus Prayer' },
  { id: 'psalm', name: 'Psalm', detail: 'One Psalm, chosen for the moment' },
  { id: 'chapter', name: 'A Bible chapter', detail: 'One chapter before you enter' },
  { id: 'intention', name: 'Written intention', detail: 'Write down why you are opening it' },
];

export const STREAK_MILESTONES = [7, 30, 100] as const;

export const CORE_ESSENTIAL_APP_IDS = [
  'phone',
  'messages',
  'facetime',
  'maps',
] as const;

export const DEFAULT_OPTIONAL_ESSENTIAL_APP_IDS = [
  'mail',
  'gmail',
  'camera',
  'wallet',
  'calendar',
  'reminders',
  'clock',
  'googlemaps',
  'health',
  'findmy',
  'settings',
  'safari',
  'chrome',
] as const;

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

export const SESSION_MIN_MINUTES = 30;
export const DEVICE_ACTIVITY_MIN_MINUTES = 15;

function forwardMinutes(from: number, to: number) {
  const value = ((to - from) % 1440 + 1440) % 1440;
  return value === 0 ? 1440 : value;
}

export function normalizeConnectedSessions(sessions: PlanZone[]): PlanZone[] {
  if (sessions.length === 0) return [];
  if (sessions.length === 1) return [{ ...sessions[0], startMinutes: 0, endMinutes: 0 }];
  const sorted = [...sessions].sort((a, b) => a.startMinutes - b.startMinutes);
  return sorted.map((session, index) => ({
    ...session,
    endMinutes: sorted[(index + 1) % sorted.length].startMinutes,
  }));
}

export function connectedSessionsAreValid(sessions: PlanZone[]) {
  if (sessions.length < 1 || sessions.length > 4) return false;
  if (sessions.length === 1) return sessions[0].startMinutes === sessions[0].endMinutes;
  const normalized = normalizeConnectedSessions(sessions);
  const logicalDurationsValid = normalized.every(
    session => zoneDurationMinutes(session) >= SESSION_MIN_MINUTES
  );
  if (!logicalDurationsValid) return false;

  const overnight = normalized.find(session => session.endMinutes <= session.startMinutes);
  if (!overnight) return true;
  const beforeMidnight = 1440 - overnight.startMinutes;
  const afterMidnight = overnight.endMinutes;
  return (beforeMidnight === 0 || beforeMidnight >= DEVICE_ACTIVITY_MIN_MINUTES)
    && (afterMidnight === 0 || afterMidnight >= DEVICE_ACTIVITY_MIN_MINUTES);
}

export function moveSessionBoundary(
  sessions: PlanZone[],
  sessionId: string,
  nextStartMinutes: number
): PlanZone[] {
  if (sessions.length <= 1) return sessions;
  const ordered = normalizeConnectedSessions(sessions);
  const index = ordered.findIndex(session => session.id === sessionId);
  if (index < 0) return sessions;
  const previous = ordered[(index - 1 + ordered.length) % ordered.length];
  const next = ordered[(index + 1) % ordered.length];
  const snapped = ((Math.round(nextStartMinutes / 5) * 5) % 1440 + 1440) % 1440;
  if (
    forwardMinutes(previous.startMinutes, snapped) < SESSION_MIN_MINUTES
    || forwardMinutes(snapped, next.startMinutes) < SESSION_MIN_MINUTES
  ) return sessions;
  const candidate = normalizeConnectedSessions(
    ordered.map(session => session.id === sessionId ? { ...session, startMinutes: snapped } : session)
  );
  return connectedSessionsAreValid(candidate) ? candidate : sessions;
}

export function splitSessionAt(
  sessions: PlanZone[],
  startMinutes: number,
  name = 'New Session'
): PlanZone[] | null {
  if (sessions.length >= 4 || sessions.length === 0) return null;
  const snapped = ((Math.round(startMinutes / 5) * 5) % 1440 + 1440) % 1440;
  const ordered = normalizeConnectedSessions(sessions);
  const source = ordered.find(session => zoneContains(session, snapped));
  if (!source) return null;
  if (
    forwardMinutes(source.startMinutes, snapped) < SESSION_MIN_MINUTES
    || forwardMinutes(snapped, source.endMinutes) < SESSION_MIN_MINUTES
  ) return null;
  const copyRules = (source.rules ?? []).map(rule => ({
    ...rule,
    appRules: (rule.appRules ?? []).map(appRule => ({ ...appRule })),
  }));
  const candidate = normalizeConnectedSessions([
    ...ordered,
    {
      id: makeId('session'),
      name,
      startMinutes: snapped,
      endMinutes: source.endMinutes,
      closedGroupIds: [...source.closedGroupIds],
      rules: copyRules,
    },
  ]);
  return connectedSessionsAreValid(candidate) ? candidate : null;
}

export function removeSessionAndExtendPrevious(
  sessions: PlanZone[],
  sessionId: string
): PlanZone[] | null {
  if (sessions.length <= 1) return null;
  const ordered = normalizeConnectedSessions(sessions);
  if (!ordered.some(session => session.id === sessionId)) return null;
  return normalizeConnectedSessions(ordered.filter(session => session.id !== sessionId));
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
  if (plan.kind === 'daily') return 'Daily Plan · one set of rules';
  if (plan.zones.length === 0) return 'Session Plan · setup needed';
  const count = `${plan.zones.length} ${plan.zones.length === 1 ? 'Session' : 'Sessions'}`;
  const names = plan.zones.map(zone => zone.name).join(', ');
  return `${count} · ${names}`;
}

export function describeRules(state: DayPlanState, plan: DayPlan): string {
  const sourceRules = plan.kind === 'session'
    ? plan.zones.flatMap(session => session.rules ?? [])
    : plan.rules;
  const totals = new Map<string, number>();
  for (const rule of sourceRules) {
    if (rule.dailyMinutes == null || rule.mode === 'blocked') continue;
    totals.set(rule.groupId, (totals.get(rule.groupId) ?? 0) + rule.dailyMinutes);
  }
  const limited = Array.from(totals, ([groupId, dailyMinutes]) => ({ groupId, dailyMinutes }));
  if (limited.length === 0) return 'No daily limits';
  return limited
    .slice(0, 3)
    .map(rule => `${groupName(state, rule.groupId)} ${formatMinutesShort(rule.dailyMinutes)}`)
    .join(' · ') + (limited.length > 3 ? ` · +${limited.length - 3}` : '');
}

export function planLeisureBudget(plan: DayPlan): number {
  const rules = plan.kind === 'session'
    ? plan.zones.flatMap(session => session.rules ?? [])
    : plan.rules;
  return rules.reduce(
    (sum, rule) => sum + (rule.mode === 'blocked' ? 0 : (rule.dailyMinutes ?? 0)),
    0
  );
}

// ---------------------------------------------------------------------------
// Rules completeness — every leisure group always has a rule entry
// ---------------------------------------------------------------------------

const DEFAULT_RULE = (groupId: string): GroupRule => ({
  groupId,
  dailyMinutes: null,
  strength: 'loose',
  practice: 'prayer',
  mode: 'noLimit',
  checkInMinutes: null,
  appRules: [],
});

function withCompleteRules(plan: DayPlan, customGroups: CustomGroup[]): DayPlan {
  const referencedCustomIds = plan.customGroupIds?.length
    ? plan.customGroupIds
    : Array.from(new Set([
        ...plan.rules.map(rule => rule.groupId),
        ...plan.zones.flatMap(zone => (zone.rules ?? []).map(rule => rule.groupId)),
      ])).filter(id => !ALL_CATEGORY_IDS.includes(id as (typeof ALL_CATEGORY_IDS)[number]));
  const validCustomIds = referencedCustomIds.filter(id => customGroups.some(group => group.id === id));
  const groupIds = [...ALL_CATEGORY_IDS, ...validCustomIds];
  const validIds = new Set(groupIds);
  const complete = (source: GroupRule[]) => {
    const existing = new Map(source.map(rule => [rule.groupId, rule]));
    return groupIds.map(id => {
      const rule = existing.get(id);
      if (!rule) return DEFAULT_RULE(id);
      return {
        ...DEFAULT_RULE(id),
        ...rule,
        mode: rule.mode ?? (rule.dailyMinutes == null ? 'noLimit' : 'limit'),
        appRules: rule.appRules ?? [],
      };
    });
  };
  const kind: PlanKind = plan.kind ?? 'daily';
  const rules = complete(plan.rules);
  const target = plan.budgetMinutes;
  const tolerable = target == null
    ? null
    : Math.max(target, plan.tolerableMinutes ?? target + 60);
  const essentialOnly = target == null
    ? null
    : Math.max(tolerable ?? target, plan.essentialOnlyMinutes ?? target + 120);
  const sourceSessions = kind === 'session'
    ? (plan.zones.length > 0
        ? plan.zones
        : [{
            id: makeId('session'),
            name: 'Day',
            startMinutes: 0,
            endMinutes: 0,
            closedGroupIds: [],
            rules,
          }])
    : [];
  const catalog: Record<string, string[]> = Object.fromEntries(
    ALL_CATEGORY_IDS.map(id => [id, [...(plan.groupCatalog?.[id] ?? DEFAULT_GROUP_APP_IDS[id] ?? [])]])
  );
  for (const customId of validCustomIds) {
    const libraryGroup = customGroups.find(group => group.id === customId);
    catalog[customId] = [...(plan.groupCatalog?.[customId] ?? libraryGroup?.appIds ?? [])];
  }
  // One app has one owner inside a plan. Custom placement wins over defaults,
  // and later custom groups win over earlier ones if legacy data conflicted.
  const claimed = new Set<string>();
  for (const customId of [...validCustomIds].reverse()) {
    catalog[customId] = catalog[customId].filter(appId => {
      if (claimed.has(appId)) return false;
      claimed.add(appId);
      return true;
    });
  }
  for (const defaultId of ALL_CATEGORY_IDS) {
    catalog[defaultId] = catalog[defaultId].filter(appId => !claimed.has(appId));
  }
  return {
    ...plan,
    kind,
    tolerableMinutes: tolerable,
    essentialOnlyMinutes: essentialOnly,
    customGroupIds: validCustomIds,
    groupCatalog: catalog,
    rules,
    zones: sourceSessions.map(zone => ({
      ...zone,
      closedGroupIds: zone.closedGroupIds.filter(id => validIds.has(id)),
      rules: complete(zone.rules ?? []),
    })),
  };
}

export function ruleFor(plan: DayPlan | null | undefined, groupId: string): GroupRule {
  return plan?.rules.find(rule => rule.groupId === groupId) ?? DEFAULT_RULE(groupId);
}

export function rulesForPlanAt(plan: DayPlan | null | undefined, now: Date): GroupRule[] {
  if (!plan) return [];
  if (plan.kind === 'daily') return plan.rules;
  return activeZone(plan, now)?.rules ?? [];
}

export function plannedMinutesByGroup(plan: DayPlan): Record<string, number> {
  const source = plan.kind === 'session'
    ? plan.zones.flatMap(session => session.rules ?? [])
    : plan.rules;
  const totals: Record<string, number> = {};
  for (const rule of source) {
    if (rule.dailyMinutes == null || rule.mode === 'blocked') continue;
    totals[rule.groupId] = (totals[rule.groupId] ?? 0) + rule.dailyMinutes;
  }
  return totals;
}

// ---------------------------------------------------------------------------
// Existing Focus calendar behavior: one broken day is a recoverable gap.
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
  customPacks: [],
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
  nativeProtection: { status: 'idle', appliedAt: null, error: null, hardWallDate: null },
  plans: [],
  schedule: [null, null, null, null, null, null, null],
  customGroups: [],
  optionalEssentialAppIds: [...DEFAULT_OPTIONAL_ESSENTIAL_APP_IDS],
  designatedCoreAppIds: [],
  alwaysBlockedApps: [],
  usageByDate: {},
  planSnapshotsByDate: {},
  targetArmedByDate: {},
  eligibilityByDate: {},
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

// Native activity detail can reconcile live thresholds, but it must not turn
// into a growing React Native archive. Persistence keeps only compact day and
// group aggregates.
const liveUsageByDate: Record<string, FocusUsageSnapshot> = {};
const USAGE_ARCHIVE_DAY_LIMIT = 400;

function persistedUsageSnapshot(snapshot: FocusUsageSnapshot): FocusUsageSnapshot {
  return {
    date: snapshot.date,
    planId: snapshot.planId ?? null,
    targetMinutes: snapshot.targetMinutes ?? null,
    tolerableMinutes: snapshot.tolerableMinutes ?? null,
    essentialOnlyMinutes: snapshot.essentialOnlyMinutes ?? null,
    totalMinutes: snapshot.totalMinutes,
    groupMinutes: { ...snapshot.groupMinutes },
    appMinutes: {},
    sessionGroupMinutes: {},
    sessionAppMinutes: {},
    updatedAt: snapshot.updatedAt,
  };
}

function compactUsageArchive(
  archive: Record<string, FocusUsageSnapshot>
): Record<string, FocusUsageSnapshot> {
  const retainedKeys = Object.keys(archive).sort().slice(-USAGE_ARCHIVE_DAY_LIMIT);
  return Object.fromEntries(
    retainedKeys.map(key => [key, persistedUsageSnapshot(archive[key])])
  );
}

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
      target_lost: record.targetLost ? 1 : 0,
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
      meta_json: JSON.stringify({
        schemaVersion: 4,
        kind: plan.kind,
        budgetMinutes: plan.budgetMinutes,
        tolerableMinutes: plan.tolerableMinutes,
        essentialOnlyMinutes: plan.essentialOnlyMinutes,
        customGroupIds: plan.customGroupIds,
        groupCatalog: plan.groupCatalog,
        strength: plan.strength,
      }),
      created_at: plan.createdAt,
      updated_at: plan.updatedAt,
    })
  );
}

function persistMeta(key: string, value: unknown | null) {
  persist(() => setMetaRow(key, value === null ? null : JSON.stringify(value)));
}

const PLAN_SNAPSHOT_DAY_LIMIT = 400;

function clonePlanSnapshot(plan: DayPlan): DayPlan {
  return JSON.parse(JSON.stringify(plan)) as DayPlan;
}

function compactPlanSnapshots(
  snapshots: Record<string, DayPlan | null>
): Record<string, DayPlan | null> {
  const retained = Object.keys(snapshots).sort().slice(-PLAN_SNAPSHOT_DAY_LIMIT);
  return Object.fromEntries(retained.map(key => [key, snapshots[key]]));
}

function compactTargetArmedDays(values: Record<string, string>): Record<string, string> {
  const retained = Object.keys(values).sort().slice(-PLAN_SNAPSHOT_DAY_LIMIT);
  return Object.fromEntries(retained.map(key => [key, values[key]]));
}

function snapshotPlanForDay(day: string, planId: string | null, overwrite = false) {
  if (!overwrite && Object.prototype.hasOwnProperty.call(state.planSnapshotsByDate, day)) return;
  const plan = planId ? state.plans.find(entry => entry.id === planId) ?? null : null;
  state.planSnapshotsByDate = compactPlanSnapshots({
    ...state.planSnapshotsByDate,
    [day]: plan ? clonePlanSnapshot(plan) : null,
  });
  persistMeta('plan_snapshots_by_date', state.planSnapshotsByDate);
}

// ---------------------------------------------------------------------------
// Day resolution — runs on hydrate and on every tick across midnight
// ---------------------------------------------------------------------------

function ensureTodayRecord(now: Date): DayRecord {
  const key = dateKey(now);
  const existing = state.days[key];
  if (existing) {
    snapshotPlanForDay(key, existing.planId);
    return existing;
  }
  const planId = state.schedule[weekdayMondayFirst(now)];
  const record: DayRecord = { date: key, planId, status: 'pending', violations: 0, targetLost: false };
  state.days = { ...state.days, [key]: record };
  snapshotPlanForDay(key, planId);
  persistDay(record);
  return record;
}

function resolveDay(record: DayRecord): DayRecord {
  if (record.status !== 'pending') return record;
  // Macro outcome is intentionally separate from lower-level app/group
  // eligibility. Only the Daily Target can break the trophy.
  const hasSnapshot = Object.prototype.hasOwnProperty.call(state.planSnapshotsByDate, record.date);
  const plan = hasSnapshot
    ? state.planSnapshotsByDate[record.date]
    : state.plans.find(entry => entry.id === record.planId) ?? null;
  const hasTarget = plan?.budgetMinutes != null;
  const targetWasArmed = !!record.planId && state.targetArmedByDate[record.date] === record.planId;
  const status: DayStatus =
    record.targetLost ? 'broken' : hasTarget && targetWasArmed ? 'kept' : 'off';
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

function dateFromLocalKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function backfillMissingDayRecords(now: Date) {
  const today = dateKey(now);
  const existingKeys = Object.keys(state.days).filter(key => key <= today).sort();
  if (existingKeys.length === 0) return false;
  const cursor = dateFromLocalKey(existingKeys[existingKeys.length - 1]);
  cursor.setDate(cursor.getDate() + 1);
  const earliest = new Date(now);
  earliest.setHours(12, 0, 0, 0);
  earliest.setDate(earliest.getDate() - (PLAN_SNAPSHOT_DAY_LIMIT - 1));
  if (cursor < earliest) cursor.setTime(earliest.getTime());
  let changed = false;
  while (dateKey(cursor) < today) {
    const key = dateKey(cursor);
    if (!state.days[key]) {
      const planId = state.schedule[weekdayMondayFirst(cursor)];
      const record: DayRecord = {
        date: key,
        planId,
        status: 'pending',
        violations: 0,
        targetLost: false,
      };
      state.days[key] = record;
      snapshotPlanForDay(key, planId);
      persistDay(record);
      changed = true;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return changed;
}

function resolvePastDays(now: Date, fireMilestones = true, resolvePending = true) {
  const todayKeyStr = dateKey(now);
  let changed = backfillMissingDayRecords(now);
  const nextDays: Record<string, DayRecord> = { ...state.days };
  for (const key of Object.keys(nextDays)) {
    if (key >= todayKeyStr) continue;
    const record = nextDays[key];
    if (!resolvePending || record.status !== 'pending') continue;
    const resolved = resolveDay(record);
    nextDays[key] = resolved;
    persistDay(resolved);
    changed = true;
  }
  if (changed) {
    state.days = nextDays;
    refreshStreak(fireMilestones);
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
    state.optionalEssentialAppIds = parse<string[]>(
      data.meta.optional_essential_apps,
      [...DEFAULT_OPTIONAL_ESSENTIAL_APP_IDS]
    );
    state.designatedCoreAppIds = parse<string[]>(data.meta.designated_core_apps, []);

    let migratedLegacyPlan = false;
    let plans: DayPlan[] = data.plans.map(row => {
      const planMeta = parse<{
        schemaVersion?: number;
        kind?: PlanKind;
        budgetMinutes?: number | null;
        tolerableMinutes?: number | null;
        essentialOnlyMinutes?: number | null;
        customGroupIds?: string[];
        groupCatalog?: Record<string, string[]>;
        strength?: Strength;
      }>(
        row.meta_json ?? undefined,
        {}
      );
      const kind = planMeta.kind ?? 'daily';
      if (!planMeta.kind) migratedLegacyPlan = true;
      return {
        id: row.id,
        name: row.name,
        kind,
        budgetMinutes: planMeta.budgetMinutes ?? null,
        tolerableMinutes: planMeta.tolerableMinutes ?? null,
        essentialOnlyMinutes: planMeta.essentialOnlyMinutes ?? null,
        customGroupIds: planMeta.customGroupIds ?? [],
        groupCatalog: planMeta.groupCatalog ?? DEFAULT_GROUP_APP_IDS,
        strength: planMeta.strength ?? 'loose',
        // Legacy Watch zones were independent ranges. They cannot honestly be
        // migrated into v4 Sessions, which must cover a connected 24-hour day.
        zones: kind === 'session' ? parse<PlanZone[]>(row.zones_json, []) : [],
        rules: parse<GroupRule[]>(row.rules_json, []),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    let schedule: WeeklySchedule = [null, null, null, null, null, null, null];
    for (const row of data.schedule) {
      if (row.day >= 0 && row.day < 7) schedule[row.day] = row.plan_id;
    }

    // Earlier Focus prototypes inserted two fully configured sample plans.
    // They looked protected before a real Apple picker selection existed.
    // Remove only untouched samples; any plan the person edited is preserved.
    if (data.meta.seeded && !data.meta.v4_sample_cleanup_done) {
      const legacyIds = new Set(
        plans
          .filter(plan =>
            (plan.id === 'plan-weekdays' || plan.id === 'plan-weekend')
            && plan.createdAt === plan.updatedAt
          )
          .map(plan => plan.id)
      );
      if (legacyIds.size > 0) {
        plans = plans.filter(plan => !legacyIds.has(plan.id));
        schedule = schedule.map(planId => planId && legacyIds.has(planId) ? null : planId);
        legacyIds.forEach(id => persist(() => deletePlanRow(id)));
        schedule.forEach((planId, day) => persist(() => setScheduleDayRow(day, planId)));
      }
      persistMeta('v4_sample_cleanup_done', 1);
    }

    state.plans = plans.map(plan => withCompleteRules(plan, state.customGroups));
    if (migratedLegacyPlan) state.plans.forEach(persistPlan);
    state.schedule = schedule;

    state.days = {};
    for (const row of data.days) {
      state.days[row.date] = {
        date: row.date,
        planId: row.plan_id,
        status: (row.status as DayStatus) ?? 'pending',
        violations: row.violations ?? 0,
        targetLost: (row.target_lost ?? 0) > 0 || row.status === 'broken',
      };
    }

    state.permission = parse<ScreenTimePermissionStatus>(data.meta.permission, 'notDetermined');
    state.nativeProtection = state.permission === 'preview'
      ? { status: 'preview', appliedAt: null, error: null, hardWallDate: null }
      : { status: 'idle', appliedAt: null, error: null, hardWallDate: null };
    state.alwaysBlockedApps = parse<AlwaysBlockedRule[]>(data.meta.always_blocked_apps, []);
    state.usageByDate = compactUsageArchive(
      parse<Record<string, FocusUsageSnapshot>>(data.meta.usage_by_date, {})
    );
    persistMeta('usage_by_date', state.usageByDate);
    state.planSnapshotsByDate = compactPlanSnapshots(
      parse<Record<string, DayPlan | null>>(data.meta.plan_snapshots_by_date, {})
    );
    persistMeta('plan_snapshots_by_date', state.planSnapshotsByDate);
    state.targetArmedByDate = compactTargetArmedDays(
      parse<Record<string, string>>(data.meta.target_armed_by_date, {})
    );
    persistMeta('target_armed_by_date', state.targetArmedByDate);
    state.eligibilityByDate = parse<Record<string, DayEligibilityLedger>>(data.meta.eligibility_ledger, {});
    state.purity = { ...DEFAULT_PURITY, ...parse<Partial<PurityState>>(data.meta.purity_state, {}) };
    state.purity.customPacks = state.purity.customPacks ?? [];
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

    resolvePastDays(
      now,
      state.permission !== 'approved',
      state.permission !== 'approved'
    );
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
    resolvePastDays(
      now,
      state.permission !== 'approved',
      state.permission !== 'approved'
    );
    changed = true;
  }

  if (applyDuePendingChanges(nowMs)) changed = true;

  if (changed) emit();
}

// ---------------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------------

export function grantScreenTimePermission(status: 'approved' | 'preview' = 'approved') {
  if (state.permission === status) return;
  state.permission = status;
  state.nativeProtection = status === 'preview'
    ? { status: 'preview', appliedAt: null, error: null, hardWallDate: null }
    : { status: 'idle', appliedAt: null, error: null, hardWallDate: null };
  persistMeta('permission', state.permission);
  emit();
}

export function markScreenTimePermissionDenied() {
  if (state.permission === 'denied' && state.nativeProtection.status === 'idle') return;
  state.permission = 'denied';
  state.nativeProtection = { status: 'idle', appliedAt: null, error: null, hardWallDate: null };
  persistMeta('permission', state.permission);
  emit();
}

export function markScreenTimePermissionNotDetermined() {
  if (state.permission === 'notDetermined' && state.nativeProtection.status === 'idle') return;
  state.permission = 'notDetermined';
  state.nativeProtection = { status: 'idle', appliedAt: null, error: null, hardWallDate: null };
  persistMeta('permission', state.permission);
  emit();
}

export function setNativeProtectionState(next: NativeProtectionState) {
  const current = state.nativeProtection;
  if (
    current.status === next.status
    && current.appliedAt === next.appliedAt
    && current.error === next.error
    && current.hardWallDate === next.hardWallDate
  ) return;
  state.nativeProtection = next;
  emit();
}

// ---------------------------------------------------------------------------
// Plans & weekly schedule
// ---------------------------------------------------------------------------

export type SaveDayPlanInput = Omit<
  DayPlan,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'kind'
  | 'tolerableMinutes'
  | 'essentialOnlyMinutes'
  | 'customGroupIds'
  | 'groupCatalog'
> &
  Partial<Pick<
    DayPlan,
    'kind' | 'tolerableMinutes' | 'essentialOnlyMinutes' | 'customGroupIds' | 'groupCatalog'
  >> &
  { id?: string };

export function saveDayPlan(input: SaveDayPlanInput): DayPlan {
  const now = Date.now();
  const existing = input.id ? state.plans.find(plan => plan.id === input.id) : undefined;
  const saved = withCompleteRules(
    {
      ...input,
      id: input.id ?? makeId('plan'),
      kind: input.kind ?? existing?.kind ?? 'daily',
      tolerableMinutes: input.tolerableMinutes ?? existing?.tolerableMinutes ?? null,
      essentialOnlyMinutes: input.essentialOnlyMinutes ?? existing?.essentialOnlyMinutes ?? null,
      customGroupIds: input.customGroupIds ?? existing?.customGroupIds ?? [],
      groupCatalog: input.groupCatalog ?? existing?.groupCatalog ?? DEFAULT_GROUP_APP_IDS,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    },
    state.customGroups
  );
  state.plans = existing
    ? state.plans.map(plan => (plan.id === saved.id ? saved : plan))
    : [...state.plans, saved];
  persistPlan(saved);
  const todayDate = new Date();
  const todayKey = dateKey(todayDate);
  const todayRecord = state.days[todayKey];
  const todayPlanId = todayRecord
    ? todayRecord.planId
    : state.schedule[weekdayMondayFirst(todayDate)];
  if (todayPlanId === saved.id) snapshotPlanForDay(todayKey, saved.id, true);
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
    snapshotPlanForDay(today.date, null, true);
    persistDay(next);
  }

  persist(() => deletePlanRow(id));
  emit();
}

export function assignPlanToWeekday(day: number, planId: string | null) {
  if (day < 0 || day > 6) return;
  state.schedule = state.schedule.map((entry, index) => (index === day ? planId : entry));
  persist(() => setScheduleDayRow(day, planId));
  emit();
}

export function wouldPlanLoseTodayTarget(planId: string | null) {
  if (!planId) return false;
  const plan = state.plans.find(entry => entry.id === planId);
  const usage = state.usageByDate[dateKey(new Date())];
  return !!plan && plan.budgetMinutes != null && (usage?.totalMinutes ?? 0) > plan.budgetMinutes;
}

// Today can be changed deliberately, but elapsed usage remains historical
// truth. A replacement target already below actual use loses eligibility.
export function swapTodayPlan(planId: string | null) {
  const now = new Date();
  const today = ensureTodayRecord(now);
  const losesTarget = wouldPlanLoseTodayTarget(planId);
  const next = {
    ...today,
    planId,
    targetLost: today.targetLost || losesTarget,
  };
  state.days = { ...state.days, [today.date]: next };
  snapshotPlanForDay(today.date, planId, true);
  persistDay(next);
  logEvent('plan_swapped', { planId: planId ?? undefined, meta: { losesTarget } });
  emit();
}

export function getEffectivePlan(stateArg: DayPlanState, date: Date): DayPlan | null {
  const record = stateArg.days[dateKey(date)];
  const planId = record ? record.planId : stateArg.schedule[weekdayMondayFirst(date)];
  return stateArg.plans.find(plan => plan.id === planId) ?? null;
}

export function getPlanSnapshotForDate(stateArg: DayPlanState, date: Date): DayPlan | null {
  const key = dateKey(date);
  if (Object.prototype.hasOwnProperty.call(stateArg.planSnapshotsByDate, key)) {
    return stateArg.planSnapshotsByDate[key] ?? null;
  }
  return getEffectivePlan(stateArg, date);
}

export function getPlanById(stateArg: DayPlanState, planId: string | null | undefined): DayPlan | null {
  if (!planId) return null;
  return stateArg.plans.find(plan => plan.id === planId) ?? null;
}

// ---------------------------------------------------------------------------
// Custom groups
// ---------------------------------------------------------------------------

export function customGroupNameAvailable(name: string, exceptId?: string) {
  const normalized = name.trim().toLocaleLowerCase();
  if (!normalized) return false;
  if (APP_CATEGORIES.some(group => group.name.toLocaleLowerCase() === normalized)) return false;
  return !state.customGroups.some(
    group => group.id !== exceptId && group.name.toLocaleLowerCase() === normalized
  );
}

export function createCustomGroupId() {
  return makeId('group');
}

export function saveCustomGroup(group: Omit<CustomGroup, 'id'> & { id?: string }): CustomGroup | null {
  if (!customGroupNameAvailable(group.name, group.id)) return null;
  let saved: CustomGroup;
  if (group.id) {
    const id = group.id;
    saved = { ...group, id };
    state.customGroups = state.customGroups.map(existing =>
      existing.id === id ? saved : existing
    );
  } else {
    saved = { ...group, id: makeId('group') };
    state.customGroups = [...state.customGroups, saved];
  }
  persistMeta('custom_groups', state.customGroups);
  emit();
  return saved;
}

export function isCustomGroupInUse(id: string) {
  return state.plans.some(plan => plan.customGroupIds.includes(id));
}

export function deleteCustomGroup(id: string): boolean {
  if (isCustomGroupInUse(id)) return false;
  state.customGroups = state.customGroups.filter(group => group.id !== id);
  persistMeta('custom_groups', state.customGroups);
  emit();
  return true;
}

// ---------------------------------------------------------------------------
// Quiet Hour (the panic button)
// ---------------------------------------------------------------------------

export function quietHourDefaultSelection(): WatchSelection {
  const blocked = new Set(state.alwaysBlockedApps.map(entry => entry.appId));
  return {
    categoryIds: [],
    appIds: state.optionalEssentialAppIds.filter(id => !blocked.has(id)),
    groupIds: [],
  };
}

export function allCoreEssentialIds(stateArg: DayPlanState = state): string[] {
  return Array.from(new Set([
    ...(CORE_ESSENTIAL_APP_IDS as readonly string[]),
    ...stateArg.designatedCoreAppIds,
  ]));
}

export function saveOptionalEssentialApps(appIds: string[]) {
  const blocked = new Set(state.alwaysBlockedApps.map(entry => entry.appId));
  const core = new Set(allCoreEssentialIds());
  state.optionalEssentialAppIds = Array.from(new Set(appIds)).filter(
    id => !blocked.has(id) && !core.has(id)
  );
  persistMeta('optional_essential_apps', state.optionalEssentialAppIds);
  emit();
}

export function designateCoreEssentialApp(appId: string): boolean {
  if (state.alwaysBlockedApps.some(entry => entry.appId === appId)) return false;
  if (allCoreEssentialIds().includes(appId)) return true;
  state.designatedCoreAppIds = [...state.designatedCoreAppIds, appId];
  state.optionalEssentialAppIds = state.optionalEssentialAppIds.filter(id => id !== appId);
  persistMeta('designated_core_apps', state.designatedCoreAppIds);
  persistMeta('optional_essential_apps', state.optionalEssentialAppIds);
  emit();
  return true;
}

export function saveAlwaysBlockedApp(rule: AlwaysBlockedRule) {
  if (
    allCoreEssentialIds().includes(rule.appId)
    || state.optionalEssentialAppIds.includes(rule.appId)
  ) return false;
  state.alwaysBlockedApps = [
    ...state.alwaysBlockedApps.filter(entry => entry.appId !== rule.appId),
    rule,
  ];
  persistMeta('always_blocked_apps', state.alwaysBlockedApps);
  emit();
  return true;
}

export function removeAlwaysBlockedApp(appId: string) {
  state.alwaysBlockedApps = state.alwaysBlockedApps.filter(entry => entry.appId !== appId);
  persistMeta('always_blocked_apps', state.alwaysBlockedApps);
  emit();
}

export function recordUsageSnapshot(snapshot: FocusUsageSnapshot) {
  liveUsageByDate[snapshot.date] = snapshot;
  reconcileEligibility(snapshot);
  state.usageByDate = compactUsageArchive({
    ...state.usageByDate,
    [snapshot.date]: persistedUsageSnapshot(snapshot),
  });
  persistMeta('usage_by_date', state.usageByDate);
  persistMeta('eligibility_ledger', state.eligibilityByDate);
  emit();
}

export function getLiveUsageSnapshot(date: string) {
  return liveUsageByDate[date] ?? state.usageByDate[date] ?? null;
}

function ensureEligibility(date: string): DayEligibilityLedger {
  return state.eligibilityByDate[date] ?? { target: 'eligible', groups: {}, apps: {} };
}

function reconcileEligibility(snapshot: FocusUsageSnapshot) {
  const day = state.days[snapshot.date];
  const planId = snapshot.planId ?? day?.planId;
  const plan = state.plans.find(entry => entry.id === planId);
  if (!plan) return;
  const current = ensureEligibility(snapshot.date);
  const next: DayEligibilityLedger = {
    target: current.target,
    groups: { ...current.groups },
    apps: { ...current.apps },
  };
  const target = snapshot.targetMinutes ?? plan.budgetMinutes;
  if (target != null && snapshot.totalMinutes > target) next.target = 'lost';

  const checkRules = (
    rules: GroupRule[],
    groupUsage: Record<string, number>,
    appUsage: Record<string, number>,
    prefix = ''
  ) => {
    for (const rule of rules) {
      const groupKey = `${prefix}${rule.groupId}`;
      const used = groupUsage[rule.groupId] ?? 0;
      if (
        (ruleMode(rule) === 'blocked' && used > 0)
        || (rule.dailyMinutes != null && used > rule.dailyMinutes)
      ) next.groups[groupKey] = 'lost';
      for (const appRule of rule.appRules ?? []) {
        const appKey = `${prefix}${appRule.appId}`;
        const appUsed = appUsage[appRule.appId] ?? 0;
        if (
          (appRuleMode(appRule) === 'blocked' && appUsed > 0)
          || (appRule.minutes != null && appUsed > appRule.minutes)
        ) next.apps[appKey] = 'lost';
      }
    }
  };

  if (plan.kind === 'daily') {
    checkRules(plan.rules, snapshot.groupMinutes, snapshot.appMinutes);
  } else {
    for (const session of plan.zones) {
      checkRules(
        session.rules ?? [],
        snapshot.sessionGroupMinutes[session.id] ?? {},
        snapshot.sessionAppMinutes[session.id] ?? {},
        `${session.id}:`
      );
    }
  }
  state.eligibilityByDate = { ...state.eligibilityByDate, [snapshot.date]: next };

  if (day && next.target === 'lost' && !day.targetLost) {
    const updated = { ...day, targetLost: true };
    state.days = { ...state.days, [day.date]: updated };
    persistDay(updated);
  }
}

export function startQuietHour(options: {
  minutes: number;
  selection: WatchSelection;
}) {
  const now = Date.now();
  const safeMinutes = Math.max(15, Math.min(12 * 60, Math.round(options.minutes)));
  state.quiet = {
    startedAt: now,
    endsAt: now + safeMinutes * 60_000,
    totalMs: safeMinutes * 60_000,
    strength: 'strict',
    selection: options.selection,
  };
  persistMeta('quiet_session', state.quiet);
  logEvent('quiet_started', { meta: { minutes: safeMinutes, strength: 'strict' } });
  emit();
}

export function extendQuietHour(minutes: number) {
  if (!state.quiet) return;
  const maxEnd = state.quiet.startedAt + 12 * 60 * 60_000;
  const nextEnd = Math.min(maxEnd, state.quiet.endsAt + Math.max(0, minutes) * 60_000);
  if (nextEnd <= state.quiet.endsAt) return;
  state.quiet = {
    ...state.quiet,
    endsAt: nextEnd,
    totalMs: nextEnd - state.quiet.startedAt,
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

// A native start that cannot guarantee automatic expiry is not a running
// Quiet Hour. Roll back only the exact optimistic start that was rejected.
export function rollbackQuietHourStart(startedAt: number) {
  if (state.quiet?.startedAt !== startedAt) return;
  state.quiet = null;
  persistMeta('quiet_session', null);
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
  if (groupId) {
    const ledger = ensureEligibility(today.date);
    state.eligibilityByDate = {
      ...state.eligibilityByDate,
      [today.date]: {
        ...ledger,
        groups: { ...ledger.groups, [groupId]: 'lost' },
      },
    };
    persistMeta('eligibility_ledger', state.eligibilityByDate);
  }
  persistDay(next);
  logEvent(kind, { groupId, planId: today.planId ?? undefined });
}

export function recordReturnedMoment(groupId?: string) {
  state.returnedMoments += 1;
  persistMeta('returned_moments', state.returnedMoments);
  logEvent('returned', { groupId });
  emit();
}

// Entering through the loose door after a practice loses only the relevant
// lower-level eligibility. The macro trophy is governed by Daily Target use.
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

export function continueIntentionalUse(groupId: string, minutes = 15) {
  const now = Date.now();
  state.door = {
    groupId,
    endsAt: now + minutes * 60_000,
    totalMs: minutes * 60_000,
  };
  persistMeta('open_door', state.door);
  logEvent('checkin_continued', { groupId, meta: { minutes } });
  emit();
}

export function closeDoor() {
  if (!state.door) return;
  state.door = null;
  persistMeta('open_door', null);
  emit();
}

// Native threshold events call these through FocusNativeCoordinator. Preview
// mode can invoke the same transitions without claiming real enforcement.
function markDailyTargetLost(dayKey: string, planId?: string) {
  const todayKey = dateKey(new Date());
  if (!dayKey || dayKey > todayKey) return;
  const existing = state.days[dayKey] ?? {
    date: dayKey,
    planId: planId || null,
    status: 'pending' as DayStatus,
    violations: 0,
    targetLost: false,
  };
  if (existing.targetLost && existing.status === (dayKey < todayKey ? 'broken' : existing.status)) return;
  const next: DayRecord = {
    ...existing,
    planId: existing.planId ?? planId ?? null,
    status: dayKey < todayKey ? 'broken' : existing.status,
    targetLost: true,
  };
  state.days = { ...state.days, [dayKey]: next };
  snapshotPlanForDay(dayKey, next.planId);
  if (next.planId) {
    state.targetArmedByDate = compactTargetArmedDays({
      ...state.targetArmedByDate,
      [dayKey]: next.planId,
    });
    persistMeta('target_armed_by_date', state.targetArmedByDate);
  }
  const ledger = ensureEligibility(dayKey);
  state.eligibilityByDate = {
    ...state.eligibilityByDate,
    [dayKey]: { ...ledger, target: 'lost' },
  };
  persistDay(next);
  persistMeta('eligibility_ledger', state.eligibilityByDate);
  refreshStreak(false);
  logEvent('limit_exceeded', { groupId: 'daily-target', planId: next.planId ?? undefined, meta: { day: dayKey } });
  emit();
}

export function recordLimitExceeded(groupId: string) {
  if (groupId === 'daily-target') {
    markDailyTargetLost(dateKey(new Date()));
    return;
  }
  bumpTodayViolations('limit_exceeded', groupId);
  emit();
}

export function recordNativeBoundaryEvent(
  kind: 'daily-hard' | 'daily-target' | 'limit',
  selectionId: string,
  sessionId?: string,
  eventDate?: string,
  planId?: string
) {
  const todayKey = dateKey(new Date());
  const boundaryDay = eventDate || todayKey;
  if (kind === 'daily-hard') {
    if (boundaryDay !== todayKey) return;
    const hardWallDate = todayKey;
    if (state.nativeProtection.hardWallDate !== hardWallDate) {
      state.nativeProtection = { ...state.nativeProtection, hardWallDate };
      emit();
    }
    return;
  }

  if (kind === 'daily-target') {
    markDailyTargetLost(boundaryDay, planId);
    return;
  }

  if (boundaryDay !== todayKey) return;

  const groupMarker = '.group.';
  const appMarker = '.app.';
  const groupIndex = selectionId.lastIndexOf(groupMarker);
  const appIndex = selectionId.lastIndexOf(appMarker);
  const groupId = groupIndex >= 0
    ? selectionId.slice(
        groupIndex + groupMarker.length,
        appIndex > groupIndex ? appIndex : undefined
      )
    : '';
  const appId = appIndex >= 0 ? selectionId.slice(appIndex + appMarker.length) : '';
  if (!groupId && !appId) return;
  const scopePrefix = sessionId && sessionId !== 'daily' ? `${sessionId}:` : '';
  const groupKey = groupId && !appId ? `${scopePrefix}${groupId}` : '';
  const appKey = appId ? `${scopePrefix}${appId}` : '';

  const today = ensureTodayRecord(new Date());
  const ledger = ensureEligibility(today.date);
  const alreadyLost = groupKey
    ? ledger.groups[groupKey] === 'lost'
    : ledger.apps[appKey] === 'lost';
  if (alreadyLost) return;

  const nextLedger: DayEligibilityLedger = {
    ...ledger,
    groups: groupKey ? { ...ledger.groups, [groupKey]: 'lost' } : ledger.groups,
    apps: appKey ? { ...ledger.apps, [appKey]: 'lost' } : ledger.apps,
  };
  const nextDay = { ...today, violations: today.violations + 1 };
  state.eligibilityByDate = { ...state.eligibilityByDate, [today.date]: nextLedger };
  state.days = { ...state.days, [today.date]: nextDay };
  persistMeta('eligibility_ledger', state.eligibilityByDate);
  persistDay(nextDay);
  logEvent('limit_exceeded', {
    groupId: groupId || undefined,
    planId: today.planId ?? undefined,
    meta: appId ? { appId, source: 'native' } : { source: 'native' },
  });
  emit();
}

export function reconcileNativeTargetArmedDays(values: Record<string, string>) {
  const now = new Date();
  const today = dateKey(now);
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = dateKey(tomorrowDate);
  const next = { ...state.targetArmedByDate };
  delete next[today];
  delete next[tomorrow];
  for (const [day, planId] of Object.entries(values)) {
    if (day && planId) next[day] = planId;
  }
  state.targetArmedByDate = compactTargetArmedDays(next);
  persistMeta('target_armed_by_date', state.targetArmedByDate);
}

export function reconcileNativeTargetLostDays(values: Record<string, string>) {
  for (const [day, planId] of Object.entries(values).sort(([left], [right]) => left.localeCompare(right))) {
    markDailyTargetLost(day, planId);
  }
}

// Losing Screen Time authorization makes every still-pending day unverifiable.
// Keep already-resolved history, but never award a trophy from stale native
// scheduling metadata after the protection permission has been interrupted.
export function invalidateUnresolvedNativeTargetArming() {
  const next = { ...state.targetArmedByDate };
  let changed = false;
  for (const [day, record] of Object.entries(state.days)) {
    if (record.status !== 'pending' || !Object.prototype.hasOwnProperty.call(next, day)) continue;
    delete next[day];
    changed = true;
  }
  if (!changed) return;
  state.targetArmedByDate = compactTargetArmedDays(next);
  persistMeta('target_armed_by_date', state.targetArmedByDate);
}

// Native events can be delivered only when the host is opened again. Reward
// yesterday after that queue has been consumed, never during the transient
// state before a delayed Daily Target event is known to React Native.
export function finalizeNativeDayReconciliation() {
  resolvePastDays(new Date(), false, true);
  const previous = state.streak;
  state.streak = computeStreak(state.days);
  if (state.pendingMilestone == null) {
    for (const milestone of STREAK_MILESTONES) {
      if (state.streak.current >= milestone && !state.milestonesShown.includes(milestone)) {
        state.pendingMilestone = milestone;
        break;
      }
    }
  }
  if (
    previous.current !== state.streak.current
    || previous.best !== state.streak.best
    || previous.trophies !== state.streak.trophies
    || state.pendingMilestone != null
  ) emit();
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
  } else if (action.kind === 'custom-pack-mode') {
    state.purity = {
      ...state.purity,
      customPacks: state.purity.customPacks.map(pack =>
        pack.id === action.packId ? { ...pack, mode: action.mode } : pack
      ),
    };
  } else if (action.kind === 'custom-pack-remove') {
    state.purity = {
      ...state.purity,
      customPacks: state.purity.customPacks.filter(pack => pack.id !== action.packId),
    };
  } else if (action.kind === 'custom-pack-domain-remove') {
    state.purity = {
      ...state.purity,
      customPacks: state.purity.customPacks.map(pack =>
        pack.id === action.packId
          ? { ...pack, domains: pack.domains.filter(domain => domain !== action.domain) }
          : pack
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

function pendingChangeKeys(action: PendingChange['action']): string[] {
  if (action.kind === 'pack-mode') return [`pack:${action.packId}`];
  if (action.kind === 'custom-pack-mode' || action.kind === 'custom-pack-remove') {
    return [`custom-pack:${action.packId}`];
  }
  if (action.kind === 'custom-pack-domain-remove') {
    return [`custom-pack-domain:${action.packId}:${action.domain}`];
  }
  if (action.kind === 'domain-never' || action.kind === 'domain-remove') {
    return [`domain:${action.domain}`];
  }
  return Object.keys(action.partial).map(key => `lock:${key}`);
}

function pendingChangesOverlap(a: PendingChange['action'], b: PendingChange['action']) {
  const customPackId = (action: PendingChange['action']) =>
    action.kind === 'custom-pack-mode'
      || action.kind === 'custom-pack-remove'
      || action.kind === 'custom-pack-domain-remove'
      ? action.packId
      : null;
  const aPackId = customPackId(a);
  const bPackId = customPackId(b);
  if (aPackId && aPackId === bPackId) {
    const aWholePack = a.kind === 'custom-pack-mode' || a.kind === 'custom-pack-remove';
    const bWholePack = b.kind === 'custom-pack-mode' || b.kind === 'custom-pack-remove';
    if (aWholePack || bWholePack) return true;
  }
  const aKeys = new Set(pendingChangeKeys(a));
  return pendingChangeKeys(b).some(key => aKeys.has(key));
}

function queueOrApply(action: PendingChange['action'], label: string, weakening: boolean) {
  const nowMs = Date.now();
  // One pending intent per logical target. Repeating or superseding a request
  // replaces the old one instead of creating a stack of delayed surprises.
  state.pendingChanges = state.pendingChanges.filter(
    change => !pendingChangesOverlap(change.action, action)
  );
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
  const packName: Record<WebPackId, string> = {
    gambling: 'Gambling',
    adult: 'Adult Content',
    social: 'Social Feeds',
    news: 'News & Noise',
  };
  queueOrApply(
    { kind: 'pack-mode', packId, mode },
    `${packName[packId]} changes to ${mode === 'off' ? 'Off' : mode === 'on' ? 'On' : 'Never Allowed'}`,
    weakening
  );
}

export function createCustomWebPack(name: string, rawDomains: string[]): CustomWebPack | null {
  const normalizedName = name.trim();
  const domains = Array.from(new Set(rawDomains.map(normalizeDomain).filter(domain => domain.includes('.'))));
  if (!normalizedName || domains.length === 0) return null;
  const duplicate = state.purity.customPacks.some(
    pack => pack.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase()
  );
  if (duplicate) return null;
  const pack: CustomWebPack = {
    id: makeId('web-pack'),
    name: normalizedName,
    domains,
    mode: 'on',
  };
  state.purity = { ...state.purity, customPacks: [...state.purity.customPacks, pack] };
  persistPurity();
  emit();
  return pack;
}

export function setCustomWebPackMode(packId: string, mode: PackMode) {
  const pack = state.purity.customPacks.find(entry => entry.id === packId);
  const current = pack?.mode;
  if (!pack || !current || current === mode) return;
  const weakening = PACK_MODE_RANK[mode] < PACK_MODE_RANK[current];
  queueOrApply(
    { kind: 'custom-pack-mode', packId, mode },
    `${pack.name} changes to ${mode === 'off' ? 'Off' : mode === 'on' ? 'On' : 'Never Allowed'}`,
    weakening
  );
}

export function addDomainToCustomWebPack(packId: string, rawDomain: string) {
  const domain = normalizeDomain(rawDomain);
  if (!domain.includes('.')) return false;
  state.purity = {
    ...state.purity,
    customPacks: state.purity.customPacks.map(pack =>
      pack.id === packId && !pack.domains.includes(domain)
        ? { ...pack, domains: [...pack.domains, domain] }
        : pack
    ),
  };
  persistPurity();
  emit();
  return true;
}

export function removeDomainFromCustomWebPack(packId: string, rawDomain: string) {
  const domain = normalizeDomain(rawDomain);
  const pack = state.purity.customPacks.find(entry => entry.id === packId);
  if (!pack || pack.domains.length <= 1 || !pack.domains.includes(domain)) return;
  queueOrApply(
    { kind: 'custom-pack-domain-remove', packId, domain },
    `Remove ${domain} from ${pack.name}`,
    pack.mode !== 'off'
  );
}

export function removeCustomWebPack(packId: string) {
  const pack = state.purity.customPacks.find(entry => entry.id === packId);
  if (!pack) return;
  queueOrApply(
    { kind: 'custom-pack-remove', packId },
    `Remove ${pack.name}`,
    pack.mode !== 'off'
  );
}

export function normalizeDomain(raw: string) {
  return normalizeWebDomain(raw);
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
  queueOrApply(
    { kind: 'domain-never', domain, never },
    `${domain} ${never ? 'becomes Never Allowed' : 'leaves Never Allowed'}`,
    !never
  );
}

export function removeCustomDomain(domain: string) {
  const entry = state.purity.customDomains.find(item => item.domain === domain);
  if (!entry) return;
  queueOrApply({ kind: 'domain-remove', domain }, `Remove ${domain}`, true);
}

export function updateLocks(partial: Partial<LocksState>) {
  const current = state.purity.locks;
  const cooldownRank: Record<LockCooldown, number> = { '10m': 0, '1h': 1, morning: 2 };
  const weakening =
    (partial.enabled === false && current.enabled) ||
    (partial.uninstallProtection === false && current.uninstallProtection) ||
    (partial.denyNewApps === false && current.denyNewApps) ||
    (partial.cooldown != null && cooldownRank[partial.cooldown] < cooldownRank[current.cooldown]);
  const [key] = Object.keys(partial) as (keyof LocksState)[];
  const labels: Record<keyof LocksState, string> = {
    enabled: partial.enabled === false ? 'Turn off Strict Watch' : 'Turn on Strict Watch',
    cooldown: 'Change Strict Watch cooldown',
    uninstallProtection: partial.uninstallProtection === false
      ? 'Turn off uninstall protection'
      : 'Turn on uninstall protection',
    denyNewApps: partial.denyNewApps === false ? 'Allow new app installs' : 'Block new app installs',
  };
  queueOrApply({ kind: 'locks', partial }, labels[key] ?? 'Change Strict Watch', weakening);
}

// ---------------------------------------------------------------------------
// Live day view (NOW panel)
// ---------------------------------------------------------------------------

export type AppAccessLayer =
  | 'permission'
  | 'dailyHardWall'
  | 'quietHour'
  | 'essential'
  | 'alwaysBlocked'
  | 'ordinaryRule'
  | 'open';

export type AppAccessDecision = {
  allowed: boolean;
  layer: AppAccessLayer;
  reason: string;
  strength?: Strength;
  canContinue?: boolean;
  remainingMinutes?: number;
};

type ResolveAppAccessInput = {
  state: DayPlanState;
  plan: DayPlan | null;
  now: Date;
  appId: string;
  groupId?: string;
  usage?: FocusUsageSnapshot;
};

function ruleMode(rule: Pick<GroupRule, 'mode' | 'dailyMinutes'>): RuleMode {
  return rule.mode ?? (rule.dailyMinutes == null ? 'noLimit' : 'limit');
}

function appRuleMode(rule: AppRule): RuleMode {
  return rule.mode ?? (rule.minutes == null ? 'noLimit' : 'limit');
}

export function planHasProtectionNow(plan: DayPlan | null | undefined, now: Date): boolean {
  if (plan?.essentialOnlyMinutes != null) return true;
  const rules = rulesForPlanAt(plan, now);
  return rules.some(rule => {
    if (ruleMode(rule) === 'blocked' || rule.dailyMinutes != null) return true;
    return (rule.appRules ?? []).some(appRule => appRuleMode(appRule) !== 'noLimit');
  });
}

export function resolveAppAccess({
  state: stateArg,
  plan,
  now,
  appId,
  groupId,
  usage,
}: ResolveAppAccessInput): AppAccessDecision {
  if (stateArg.permission !== 'approved') {
    return {
      allowed: true,
      layer: 'permission',
      reason: 'Screen Time permission is required before protection can apply.',
    };
  }

  const coreEssential = allCoreEssentialIds(stateArg).includes(appId);
  const optionalEssential = stateArg.optionalEssentialAppIds.includes(appId);
  const globalEssential = coreEssential || optionalEssential;
  const quietAllowed = coreEssential || !!stateArg.quiet?.selection.appIds.includes(appId);
  const alwaysBlocked = stateArg.alwaysBlockedApps.find(entry => entry.appId === appId);
  const resolvedUsage = usage
    ?? liveUsageByDate[dateKey(now)]
    ?? stateArg.usageByDate[dateKey(now)];
  const totalMinutes = resolvedUsage?.totalMinutes ?? 0;
  const hardWallReached =
    stateArg.nativeProtection.hardWallDate === dateKey(now)
    || (plan?.essentialOnlyMinutes != null && totalMinutes >= plan.essentialOnlyMinutes);

  // The two allowlist walls combine by intersection. Neither one is allowed
  // to make the other wall more permissive.
  if (hardWallReached) {
    const allowed = !alwaysBlocked && globalEssential && (!stateArg.quiet || quietAllowed);
    return {
      allowed,
      layer: 'dailyHardWall',
      reason: allowed
        ? stateArg.quiet
          ? 'Available in both Daily Essentials and Quiet Hour Essentials.'
          : 'Available as a Daily Essential.'
        : alwaysBlocked
          ? 'Always Blocked remains unavailable inside every protection mode.'
          : stateArg.quiet
          ? 'Daily limit and Quiet Hour allowlists are both active.'
          : 'Daily limit reached - Essentials and iOS system access remain.',
      strength: allowed ? undefined : 'strict',
    };
  }

  // Always Blocked is intentionally ineligible for a Quiet Hour exception.
  if (alwaysBlocked) {
    return {
      allowed: false,
      layer: 'alwaysBlocked',
      reason: 'This app is Always Blocked.',
      strength: alwaysBlocked.strength,
      canContinue: alwaysBlocked.strength === 'loose',
    };
  }

  if (stateArg.quiet) {
    return quietAllowed
      ? {
          allowed: true,
          layer: 'quietHour',
          reason: 'Available in this Quiet Hour.',
        }
      : {
          allowed: false,
          layer: 'quietHour',
          reason: 'Quiet Hour is active.',
          strength: 'strict',
        };
  }

  if (globalEssential) {
    return { allowed: true, layer: 'essential', reason: 'Available as an Essential App.' };
  }

  const session = plan?.kind === 'session' ? activeZone(plan, now) : null;
  const rules = rulesForPlanAt(plan, now);
  const groupRule = groupId ? rules.find(rule => rule.groupId === groupId) : undefined;
  const appRule = rules.flatMap(rule => rule.appRules ?? []).find(rule => rule.appId === appId);
  const groupUsed = groupId
    ? plan?.kind === 'session' && session
      ? resolvedUsage?.sessionGroupMinutes[session.id]?.[groupId] ?? 0
      : resolvedUsage?.groupMinutes[groupId] ?? 0
    : 0;
  const appUsed = plan?.kind === 'session' && session
    ? resolvedUsage?.sessionAppMinutes[session.id]?.[appId] ?? 0
    : resolvedUsage?.appMinutes[appId] ?? 0;

  const blocked: AppAccessDecision[] = [];
  const remaining: number[] = [];

  if (groupRule) {
    const mode = ruleMode(groupRule);
    if (mode === 'blocked') {
      blocked.push({
        allowed: false,
        layer: 'ordinaryRule',
        reason: `${groupName(stateArg, groupRule.groupId)} is blocked${session ? ` in ${session.name}` : ' today'}.`,
        strength: groupRule.strength,
        canContinue: groupRule.strength === 'loose',
      });
    } else if (groupRule.dailyMinutes != null) {
      remaining.push(Math.max(0, groupRule.dailyMinutes - groupUsed));
      if (groupUsed >= groupRule.dailyMinutes) {
        blocked.push({
          allowed: false,
          layer: 'ordinaryRule',
          reason: `${groupName(stateArg, groupRule.groupId)} limit used.`,
          strength: groupRule.strength,
          canContinue: groupRule.strength === 'loose',
        });
      }
    }
  }

  if (appRule) {
    const appLabel = appRule.label?.trim() || appId;
    const mode = appRuleMode(appRule);
    if (mode === 'blocked') {
      blocked.push({
        allowed: false,
        layer: 'ordinaryRule',
        reason: `${appLabel} is blocked${session ? ` in ${session.name}` : ' today'}.`,
        strength: appRule.strength,
        canContinue: appRule.strength === 'loose',
      });
    } else if (appRule.minutes != null) {
      remaining.push(Math.max(0, appRule.minutes - appUsed));
      if (appUsed >= appRule.minutes) {
        blocked.push({
          allowed: false,
          layer: 'ordinaryRule',
          reason: `${appLabel} limit used.`,
          strength: appRule.strength,
          canContinue: appRule.strength === 'loose',
        });
      }
    }
  }

  if (blocked.length > 0) {
    return blocked.sort((a, b) => Number(b.strength === 'strict') - Number(a.strength === 'strict'))[0];
  }

  return {
    allowed: true,
    layer: 'open',
    reason: remaining.length > 0 ? 'Within the active plan limits.' : 'No active limit for this app.',
    remainingMinutes: remaining.length > 0 ? Math.min(...remaining) : undefined,
  };
}

export type LiveDayStatus = 'off' | 'on_track' | 'broken';

export function getTodayRecord(stateArg: DayPlanState, now: Date): DayRecord | null {
  return stateArg.days[dateKey(now)] ?? null;
}

export function getLiveDayStatus(stateArg: DayPlanState, now: Date): LiveDayStatus {
  const record = getTodayRecord(stateArg, now);
  const planId = record ? record.planId : stateArg.schedule[weekdayMondayFirst(now)];
  const plan = stateArg.plans.find(entry => entry.id === planId);
  if (plan?.budgetMinutes == null && !record?.targetLost) return 'off';
  return record?.targetLost ? 'broken' : 'on_track';
}

export function purityActiveCount(purity: PurityState) {
  const packs = purity.packs.filter(pack => pack.mode !== 'off').length
    + purity.customPacks.filter(pack => pack.mode !== 'off').length;
  return packs + purity.customDomains.length;
}
