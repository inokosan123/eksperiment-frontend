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

export type WatchSchedule = {
  id: string;
  name: string;
  timeLabel: string;
  daysLabel: string;
};

export type AlwaysOnLayer = {
  id: string;
  name: string;
};

export type FocusWatchState = {
  activeSession: ActiveWatchSession | null;
  schedules: WatchSchedule[];
  alwaysOn: AlwaysOnLayer[];
  strictWatch: boolean;
};

let state: FocusWatchState = {
  activeSession: null,
  schedules: [
    { id: 'morning', name: 'Morning Watch', timeLabel: '06:00 – 07:30', daysLabel: 'Weekdays' },
    { id: 'evening', name: 'Evening Watch', timeLabel: '21:00 – 23:00', daysLabel: 'Every day' },
  ],
  alwaysOn: [],
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
