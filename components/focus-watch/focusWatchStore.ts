import { useSyncExternalStore } from 'react';

// Phase 1 mock store: in-memory only. Phase 2 replaces the internals with the
// Screen Time bridge (FamilyControls/ManagedSettings) + SQL persistence while
// keeping this exact public shape, so screens don't change.

export type ActiveWatchSession = {
  id: string;
  name: string;
  startedAt: number;
  endsAt: number;
  totalMs: number;
  strength: WatchStrength;
  categoryIds: string[];
};

export type PracticeKind = 'prayer' | 'jesus-prayer' | 'psalm' | 'chapter' | 'intention';
export type WatchStrength = 'loose' | 'strict';

export type WatchWhen =
  | { kind: 'always' }
  // days: 0 = Monday … 6 = Sunday, matching the M T W T F S S day row.
  | { kind: 'schedule'; startMinutes: number; endMinutes: number; days: number[] };

export type WatchPlan = {
  id: string;
  name: string;
  enabled: boolean;
  categoryIds: string[];
  appIds: string[];
  groupIds: string[];
  when: WatchWhen;
  strength: WatchStrength;
  practice: PracticeKind;
  // Days in a row this watch stood unbroken. Mock numbers until Phase 2
  // counts them from real sessions.
  streak: number;
};

export type CustomGroup = {
  id: string;
  name: string;
  appIds: string[];
};

export type WebPackId = 'gambling' | 'adult' | 'social' | 'news';

export type NeverAllowedEntry = {
  id: string;
  label: string;
  kind: 'site' | 'app';
};

export type StrictCooldown = '10m' | '1h' | 'morning';

export type StrictSettings = {
  enabled: boolean;
  cooldown: StrictCooldown;
  uninstallProtection: boolean;
  denyNewApps: boolean;
};

export type AllowlistConfig = {
  keep: { categoryIds: string[]; appIds: string[]; groupIds: string[] };
  strength: WatchStrength;
};

export type FocusWatchState = {
  activeSession: ActiveWatchSession | null;
  plans: WatchPlan[];
  customGroups: CustomGroup[];
  webPacks: { id: WebPackId; enabled: boolean }[];
  customDomains: string[];
  neverAllowed: NeverAllowedEntry[];
  neverPacks: { id: WebPackId; enabled: boolean }[];
  allowlistMode: boolean;
  allowlistConfig: AllowlistConfig;
  strictSettings: StrictSettings;
  returnedMoments: number;
};

// Stand-in categories until the Apple FamilyActivityPicker arrives in Phase 2.
export const APP_CATEGORIES = [
  { id: 'social', name: 'Social' },
  { id: 'entertainment', name: 'Entertainment' },
  { id: 'games', name: 'Games' },
  { id: 'news', name: 'News' },
  { id: 'shopping', name: 'Shopping' },
  { id: 'dating', name: 'Dating' },
] as const;

export const RETURN_PRACTICES: { id: PracticeKind; name: string; detail: string }[] = [
  { id: 'prayer', name: 'A short prayer', detail: 'One prayer before the door opens' },
  { id: 'jesus-prayer', name: 'Jesus Prayer', detail: 'Two minutes of the Jesus Prayer' },
  { id: 'psalm', name: 'A Psalm', detail: 'One Psalm, chosen for the moment' },
  { id: 'chapter', name: 'A Bible chapter', detail: 'One chapter before you enter' },
  { id: 'intention', name: 'Written intention', detail: 'Write down why you are opening it' },
];

export const ALLOWLIST_APPS = ['Phone', 'Messages', 'Maps', 'Anasta'];

let state: FocusWatchState = {
  activeSession: null,
  plans: [
    {
      id: 'morning',
      name: 'Morning Watch',
      enabled: true,
      categoryIds: ['social', 'news'],
      appIds: [],
      groupIds: [],
      when: { kind: 'schedule', startMinutes: 360, endMinutes: 450, days: [0, 1, 2, 3, 4] },
      strength: 'strict',
      practice: 'psalm',
      streak: 6,
    },
    {
      id: 'evening',
      name: 'Evening Watch',
      enabled: true,
      categoryIds: ['social', 'entertainment', 'games'],
      appIds: [],
      groupIds: [],
      when: { kind: 'schedule', startMinutes: 1260, endMinutes: 1380, days: [0, 1, 2, 3, 4, 5, 6] },
      strength: 'loose',
      practice: 'prayer',
      streak: 21,
    },
  ],
  customGroups: [],
  webPacks: [
    { id: 'gambling', enabled: false },
    { id: 'adult', enabled: false },
    { id: 'social', enabled: false },
    { id: 'news', enabled: false },
  ],
  customDomains: [],
  neverAllowed: [],
  // Never Allowed guards websites only — apps live in Protect Time.
  neverPacks: [
    { id: 'gambling', enabled: false },
    { id: 'adult', enabled: false },
    { id: 'social', enabled: false },
    { id: 'news', enabled: false },
  ],
  allowlistMode: false,
  allowlistConfig: {
    keep: { categoryIds: [], appIds: [], groupIds: [] },
    strength: 'loose',
  },
  strictSettings: {
    enabled: false,
    cooldown: '1h',
    uninstallProtection: true,
    denyNewApps: false,
  },
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

function getSnapshot(): FocusWatchState {
  return state;
}

export function useFocusWatch(): FocusWatchState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getFocusWatchState(): FocusWatchState {
  return state;
}

// --- Active session -------------------------------------------------------

export function startQuickWatch(options: {
  minutes: number;
  categoryIds: string[];
  strength: WatchStrength;
}) {
  const now = Date.now();
  state.activeSession = {
    id: `quick-${now}`,
    name: 'Quick Watch',
    startedAt: now,
    endsAt: now + options.minutes * 60_000,
    totalMs: options.minutes * 60_000,
    strength: options.strength,
    categoryIds: options.categoryIds,
  };
  emit();
}

export function extendActiveSession(minutes: number) {
  if (!state.activeSession) return;
  state.activeSession = {
    ...state.activeSession,
    endsAt: state.activeSession.endsAt + minutes * 60_000,
    totalMs: state.activeSession.totalMs + minutes * 60_000,
  };
  emit();
}

export function endActiveSession() {
  if (!state.activeSession) return;
  state.activeSession = null;
  emit();
}

// --- Watch plans -----------------------------------------------------------

export function togglePlanEnabled(id: string) {
  state.plans = state.plans.map(plan =>
    plan.id === id ? { ...plan, enabled: !plan.enabled } : plan
  );
  emit();
}

export function saveWatchPlan(plan: Omit<WatchPlan, 'id'> & { id?: string }) {
  if (plan.id) {
    const id = plan.id;
    state.plans = state.plans.map(existing =>
      existing.id === id ? { ...plan, id } : existing
    );
  } else {
    state.plans = [...state.plans, { ...plan, id: `plan-${Date.now()}` }];
  }
  emit();
}

export function deleteWatchPlan(id: string) {
  state.plans = state.plans.filter(plan => plan.id !== id);
  emit();
}

// --- Custom groups ---------------------------------------------------------

export function saveCustomGroup(group: Omit<CustomGroup, 'id'> & { id?: string }) {
  if (group.id) {
    const id = group.id;
    state.customGroups = state.customGroups.map(existing =>
      existing.id === id ? { ...group, id } : existing
    );
  } else {
    state.customGroups = [...state.customGroups, { ...group, id: `group-${Date.now()}` }];
  }
  emit();
}

export function deleteCustomGroup(id: string) {
  state.customGroups = state.customGroups.filter(group => group.id !== id);
  state.plans = state.plans.map(plan =>
    plan.groupIds.includes(id)
      ? { ...plan, groupIds: plan.groupIds.filter(entry => entry !== id) }
      : plan
  );
  emit();
}

export type WatchSelection = Pick<WatchPlan, 'categoryIds' | 'appIds' | 'groupIds'>;

export function selectionCount(selection: WatchSelection) {
  return selection.categoryIds.length + selection.appIds.length + selection.groupIds.length;
}

export function describeSelection(selection: WatchSelection) {
  const parts: string[] = [];
  if (selection.categoryIds.length > 0) {
    parts.push(
      `${selection.categoryIds.length} ${selection.categoryIds.length === 1 ? 'category' : 'categories'}`
    );
  }
  if (selection.appIds.length > 0) {
    parts.push(`${selection.appIds.length} ${selection.appIds.length === 1 ? 'app' : 'apps'}`);
  }
  if (selection.groupIds.length > 0) {
    parts.push(
      `${selection.groupIds.length} ${selection.groupIds.length === 1 ? 'group' : 'groups'}`
    );
  }
  return parts.length > 0 ? parts.join(' · ') : 'Nothing selected';
}

export function toggleAllowlistMode() {
  state.allowlistMode = !state.allowlistMode;
  emit();
}

export function updateAllowlistConfig(partial: Partial<AllowlistConfig>) {
  state.allowlistConfig = { ...state.allowlistConfig, ...partial };
  emit();
}

export function toggleNeverPack(id: WebPackId) {
  state.neverPacks = state.neverPacks.map(pack =>
    pack.id === id ? { ...pack, enabled: !pack.enabled } : pack
  );
  emit();
}

// --- Clean Sight -----------------------------------------------------------

export function toggleWebPack(id: WebPackId) {
  state.webPacks = state.webPacks.map(pack =>
    pack.id === id ? { ...pack, enabled: !pack.enabled } : pack
  );
  emit();
}

export function normalizeDomain(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
}

export function addCustomDomain(raw: string) {
  const domain = normalizeDomain(raw);
  if (!domain || !domain.includes('.') || state.customDomains.includes(domain)) return;
  state.customDomains = [...state.customDomains, domain];
  emit();
}

export function removeCustomDomain(domain: string) {
  state.customDomains = state.customDomains.filter(entry => entry !== domain);
  emit();
}

// --- Never Allowed ---------------------------------------------------------

export function addNeverAllowedSite(raw: string) {
  const domain = normalizeDomain(raw);
  if (!domain || !domain.includes('.')) return;
  if (state.neverAllowed.some(entry => entry.label === domain)) return;
  state.neverAllowed = [
    ...state.neverAllowed,
    { id: `never-${Date.now()}`, label: domain, kind: 'site' },
  ];
  emit();
}

export function removeNeverAllowed(id: string) {
  state.neverAllowed = state.neverAllowed.filter(entry => entry.id !== id);
  emit();
}

// --- Strict Watch ----------------------------------------------------------

export function updateStrictSettings(partial: Partial<StrictSettings>) {
  state.strictSettings = { ...state.strictSettings, ...partial };
  emit();
}

// --- Review ----------------------------------------------------------------

export function recordReturnedMoment() {
  state.returnedMoments += 1;
  emit();
}

// --- Formatting helpers ----------------------------------------------------

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export function formatTimeOfDay(minutes: number) {
  const clamped = ((minutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
}

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function formatDays(days: number[]) {
  const sorted = [...days].sort((a, b) => a - b);
  const key = sorted.join(',');
  if (key === '0,1,2,3,4,5,6') return 'Every day';
  if (key === '0,1,2,3,4') return 'Weekdays';
  if (key === '5,6') return 'Weekends';
  return sorted.map(day => DAY_SHORT[day]).join(', ');
}

export function formatWhen(when: WatchWhen) {
  if (when.kind === 'always') return 'Always on';
  return `${formatTimeOfDay(when.startMinutes)} – ${formatTimeOfDay(when.endMinutes)} · ${formatDays(when.days)}`;
}

export function practiceName(practice: PracticeKind) {
  return RETURN_PRACTICES.find(entry => entry.id === practice)?.name ?? '';
}

export function formatTimeRange(when: WatchWhen) {
  if (when.kind === 'always') return 'Always on';
  return `${formatTimeOfDay(when.startMinutes)} – ${formatTimeOfDay(when.endMinutes)}`;
}

export type ActiveScheduledWatch = {
  plan: WatchPlan;
  startedAt: number;
  endsAt: number;
};

function dayStartMs(base: Date, dayOffset: number, minutes: number) {
  const date = new Date(base);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date.getTime();
}

// Scheduled plans whose window covers this very moment (overnight windows
// like 22:00 – 06:00 included) — these stand guard in the NOW panel.
export function getActiveScheduledWatches(plans: WatchPlan[], now = new Date()): ActiveScheduledWatch[] {
  const nowDay = (now.getDay() + 6) % 7;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const result: ActiveScheduledWatch[] = [];

  for (const plan of plans) {
    if (!plan.enabled || plan.when.kind !== 'schedule') continue;
    const { startMinutes, endMinutes, days } = plan.when;
    const overnight = endMinutes <= startMinutes;

    if (!overnight) {
      if (days.includes(nowDay) && nowMin >= startMinutes && nowMin < endMinutes) {
        result.push({
          plan,
          startedAt: dayStartMs(now, 0, startMinutes),
          endsAt: dayStartMs(now, 0, endMinutes),
        });
      }
      continue;
    }

    // Overnight window that began today…
    if (days.includes(nowDay) && nowMin >= startMinutes) {
      result.push({
        plan,
        startedAt: dayStartMs(now, 0, startMinutes),
        endsAt: dayStartMs(now, 1, endMinutes),
      });
      continue;
    }
    // …or one that began yesterday and is still running.
    const yesterday = (nowDay + 6) % 7;
    if (days.includes(yesterday) && nowMin < endMinutes) {
      result.push({
        plan,
        startedAt: dayStartMs(now, -1, startMinutes),
        endsAt: dayStartMs(now, 0, endMinutes),
      });
    }
  }

  return result.sort((a, b) => a.endsAt - b.endsAt);
}

// Next upcoming start among enabled schedule plans, e.g. "Evening Watch · 21:00".
export function nextScheduleLabel(plans: WatchPlan[], now = new Date()): string | null {
  const nowDay = (now.getDay() + 6) % 7; // JS Sunday-first → our Monday-first
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let best: { minutesUntil: number; name: string; start: number } | null = null;

  for (const plan of plans) {
    if (!plan.enabled || plan.when.kind !== 'schedule') continue;
    for (let offset = 0; offset < 7; offset++) {
      const day = (nowDay + offset) % 7;
      if (!plan.when.days.includes(day)) continue;
      if (offset === 0 && plan.when.startMinutes <= nowMinutes) continue;
      const minutesUntil = offset * 1440 + plan.when.startMinutes - nowMinutes;
      if (!best || minutesUntil < best.minutesUntil) {
        best = { minutesUntil, name: plan.name, start: plan.when.startMinutes };
      }
      break;
    }
  }

  return best ? `${best.name} · ${formatTimeOfDay(best.start)}` : null;
}
