import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  type BigEvent,
  loadAllBigEvents,
  insertBigEvent,
  updateBigEventRow,
  hardDeleteBigEvent,
} from './bigEventsDb';
import { todayKey } from './bigEventsLogic';

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

  const refresh = useCallback(async () => {
    const rows = await loadAllBigEvents();
    setBigEvents(rows);
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh().catch(err => {
      console.warn('[BigEvents] initial load failed', err);
      setLoaded(true);
    });
  }, [refresh]);

  const addBigEvent = useCallback<BigEventsContextValue['addBigEvent']>(async (input) => {
    const now = Date.now();
    const event: BigEvent = {
      id: input.id,
      title: input.title,
      startDate: input.startDate,
      endDate: input.endDate,
      color: input.color,
      icon: input.icon,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
      deletedAt: input.deletedAt ?? null,
    };
    await insertBigEvent(event);
    await refresh();
  }, [refresh]);

  const updateBigEvent = useCallback(async (event: BigEvent) => {
    const next: BigEvent = { ...event, updatedAt: Date.now() };
    await updateBigEventRow(next);
    await refresh();
  }, [refresh]);

  const softDeleteBigEvent = useCallback(async (id: string) => {
    const target = bigEvents.find(e => e.id === id);
    if (!target) return;
    const next: BigEvent = {
      ...target,
      deletedAt: todayKey(),
      updatedAt: Date.now(),
    };
    await updateBigEventRow(next);
    await refresh();
  }, [bigEvents, refresh]);

  const hardDeleteFn = useCallback(async (id: string) => {
    await hardDeleteBigEvent(id);
    await refresh();
  }, [refresh]);

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
