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
  when: WatchWhen;
  strength: WatchStrength;
  practice: PracticeKind;
};

export type AlwaysOnLayer = {
  id: string;
  name: string;
};

export type FocusWatchState = {
  activeSession: ActiveWatchSession | null;
  plans: WatchPlan[];
  alwaysOn: AlwaysOnLayer[];
  allowlistMode: boolean;
  strictWatch: boolean;
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
      when: { kind: 'schedule', startMinutes: 360, endMinutes: 450, days: [0, 1, 2, 3, 4] },
      strength: 'strict',
      practice: 'psalm',
    },
    {
      id: 'evening',
      name: 'Evening Watch',
      enabled: true,
      categoryIds: ['social', 'entertainment', 'games'],
      when: { kind: 'schedule', startMinutes: 1260, endMinutes: 1380, days: [0, 1, 2, 3, 4, 5, 6] },
      strength: 'loose',
      practice: 'prayer',
    },
  ],
  alwaysOn: [],
  allowlistMode: false,
  strictWatch: false,
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

export function startQuickWatch(minutes: number) {
  const now = Date.now();
  state.activeSession = {
    id: `quick-${now}`,
    name: 'Quick Watch',
    startedAt: now,
    endsAt: now + minutes * 60_000,
    totalMs: minutes * 60_000,
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

export function toggleAllowlistMode() {
  state.allowlistMode = !state.allowlistMode;
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
