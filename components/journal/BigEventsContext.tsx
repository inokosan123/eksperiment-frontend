import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import {
  type BigEvent,
  loadAllBigEvents,
  insertBigEvent,
  updateBigEventRow,
  hardDeleteBigEvent,
} from './bigEventsDb';
import { todayKey } from './bigEventsLogic';
import {
  cancelBigEventNotifications,
  reconcileBigEventNotifications,
} from './bigEventNotifications';

type BigEventsContextValue = {
  bigEvents: BigEvent[];
  loaded: boolean;
  refresh: () => Promise<void>;
  addBigEvent: (event: Omit<BigEvent, 'createdAt' | 'updatedAt' | 'deletedAt'> & {
    createdAt?: number;
    updatedAt?: number;
    deletedAt?: string | null;
  }) => Promise<void>;
  updateBigEvent: (event: BigEvent) => Promise<void>;
  softDeleteBigEvent: (id: string) => Promise<void>;
  hardDeleteBigEvent: (id: string) => Promise<void>;
};

const BigEventsContext = createContext<BigEventsContextValue | null>(null);

export function BigEventsProvider({ children }: { children: React.ReactNode }) {
  const [bigEvents, setBigEvents] = useState<BigEvent[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadAndSet = useCallback(async (requestPermission = false) => {
    const rows = await loadAllBigEvents();
    setBigEvents(rows);
    setLoaded(true);
    void reconcileBigEventNotifications(rows, { requestPermission }).catch(error => {
      console.warn('[BigEvents] notification reconcile failed', error);
    });
    return rows;
  }, []);

  const refresh = useCallback(async () => {
    await loadAndSet(false);
  }, [loadAndSet]);

  useEffect(() => {
    refresh().catch(err => {
      console.warn('[BigEvents] initial load failed', err);
      setLoaded(true);
    });
  }, [refresh]);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      void loadAndSet(false).catch(error => {
        console.warn('[BigEvents] foreground refresh failed', error);
      });
    });
    return () => subscription.remove();
  }, [loadAndSet]);

  const addBigEvent = useCallback<BigEventsContextValue['addBigEvent']>(async (input) => {
    const now = Date.now();
    const event: BigEvent = {
      id: input.id,
      title: input.title,
      startDate: input.startDate,
      endDate: input.endDate,
      color: input.color,
      icon: input.icon,
      recurrence: input.recurrence,
      leadDays: input.leadDays,
      remindersEnabled: input.remindersEnabled,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
      deletedAt: input.deletedAt ?? null,
    };
    await insertBigEvent(event);
    await loadAndSet(event.remindersEnabled);
  }, [loadAndSet]);

  const updateBigEvent = useCallback(async (event: BigEvent) => {
    const next: BigEvent = { ...event, updatedAt: Date.now() };
    await updateBigEventRow(next);
    await loadAndSet(next.remindersEnabled);
  }, [loadAndSet]);

  const softDeleteBigEvent = useCallback(async (id: string) => {
    const target = bigEvents.find(e => e.id === id);
    if (!target) return;
    const next: BigEvent = {
      ...target,
      deletedAt: todayKey(),
      updatedAt: Date.now(),
    };
    await updateBigEventRow(next);
    await cancelBigEventNotifications(id);
    await loadAndSet(false);
  }, [bigEvents, loadAndSet]);

  const hardDeleteFn = useCallback(async (id: string) => {
    await hardDeleteBigEvent(id);
    await cancelBigEventNotifications(id);
    await loadAndSet(false);
  }, [loadAndSet]);

  const value: BigEventsContextValue = {
    bigEvents,
    loaded,
    refresh,
    addBigEvent,
    updateBigEvent,
    softDeleteBigEvent,
    hardDeleteBigEvent: hardDeleteFn,
  };

  return (
    <BigEventsContext.Provider value={value}>
      {children}
    </BigEventsContext.Provider>
  );
}

export function useBigEvents() {
  const ctx = useContext(BigEventsContext);
  if (!ctx) {
    throw new Error('useBigEvents must be used inside <BigEventsProvider>');
  }
  return ctx;
}
