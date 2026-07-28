import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  emptyJournalEntry,
  backfillJournalEntrySections,
  listJournalEntries,
  listJournalSections,
  saveJournalSections,
  upsertJournalEntry,
  type JournalEntry,
  type JournalPromptAnswer,
} from '@/components/journal/journalDb';
import {
  computeJournalStreak,
  getJournalKindsForEntry,
  isJournalDayComplete,
} from '@/components/journal/journalLogic';
import type { JournalSection } from '@/components/journal/journalSections';
import {
  createJournalWriteCoordinator,
  type JournalWriteCoordinator,
} from '@/components/journal/journal-write-coordinator';

export type JournalDotKind = 'daily' | 'morning' | 'morningDraft' | 'free';

export type JournalEntryPatch = Partial<
  Pick<
    JournalEntry,
    | 'mood'
    | 'energy'
    | 'satisfaction'
    | 'dailySections'
    | 'freeWritingHtml'
    | 'morningPagesHtml'
    | 'morningPagesWordCount'
    | 'prompts'
    | 'whoChecks'
    | 'scaleValues'
  >
>;

export type JournalCompletionEvent = {
  id: number;
  date: string;
  currentStreak: number;
};

export type JournalUpsertOptions = {
  queueCompletionCelebration?: boolean;
};

type JournalContextValue = {
  ready: boolean;
  entries: JournalEntry[];
  entriesByDate: Record<string, JournalEntry>;
  dotsByDate: Record<string, JournalDotKind[]>;
  sections: JournalSection[];
  streak: ReturnType<typeof computeJournalStreak>;
  completionEvent: JournalCompletionEvent | null;
  refresh: () => Promise<void>;
  getEntry: (date: string) => JournalEntry;
  upsertEntry: (
    date: string,
    patch: JournalEntryPatch,
    options?: JournalUpsertOptions,
  ) => Promise<JournalEntry>;
  dismissCompletionEvent: (id: number) => void;
  setJournalSections: (sections: JournalSection[]) => Promise<void>;
};

const JournalContext = createContext<JournalContextValue | null>(null);

function indexEntries(entries: JournalEntry[]) {
  return entries.reduce<Record<string, JournalEntry>>((acc, entry) => {
    acc[entry.date] = entry;
    return acc;
  }, {});
}

function buildDots(entries: JournalEntry[]) {
  return entries.reduce<Record<string, JournalDotKind[]>>((acc, entry) => {
    const kinds = getJournalKindsForEntry(entry);
    if (kinds.length) {
      acc[entry.date] = kinds;
    }
    return acc;
  }, {});
}

function normalizePrompts(prompts?: JournalPromptAnswer[]) {
  return Array.isArray(prompts) ? prompts : [];
}

function mergeEntry(base: JournalEntry, patch: JournalEntryPatch): JournalEntry {
  const now = Math.max(Date.now(), base.updatedAt + 1);
  return {
    ...base,
    ...patch,
    dailySections: patch.dailySections ?? base.dailySections,
    prompts: normalizePrompts(patch.prompts ?? base.prompts),
    whoChecks: patch.whoChecks ?? base.whoChecks ?? {},
    scaleValues: patch.scaleValues ?? base.scaleValues ?? {},
    updatedAt: now,
    createdAt: base.createdAt || now,
  };
}

function upsertEntryInList(entries: JournalEntry[], next: JournalEntry) {
  const exists = entries.some(entry => entry.date === next.date);
  const merged = exists
    ? entries.map(entry => entry.date === next.date ? next : entry)
    : [next, ...entries];
  return merged.sort((left, right) => right.date.localeCompare(left.date));
}

export function JournalProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [sections, setSections] = useState<JournalSection[]>([]);
  const [completionEvent, setCompletionEvent] = useState<JournalCompletionEvent | null>(null);
  const entriesRef = useRef<JournalEntry[]>([]);
  const completionEventIdRef = useRef(0);
  const queuedCompletionDatesRef = useRef(new Set<string>());
  const persistedCompletionDatesRef = useRef(new Set<string>());
  const writeRevisionsRef = useRef(new Map<string, number>());
  const saveQueueRef = useRef<JournalWriteCoordinator<JournalEntry, JournalEntry> | null>(null);

  if (!saveQueueRef.current) {
    saveQueueRef.current = createJournalWriteCoordinator({
      persist: upsertJournalEntry,
      isLatestRevision: (date, revision) => (
        writeRevisionsRef.current.get(date) === revision
      ),
      onLatestPersisted: (date, request, saved) => {
        // A newer optimistic revision may have been requested while this write
        // was in flight. The coordinator only invokes this callback for the
        // latest revision, so an older result cannot roll back the UI or emit
        // completion feedback prematurely.
        const persistedEntries = upsertEntryInList(entriesRef.current, saved);
        entriesRef.current = persistedEntries;
        setEntries(persistedEntries);

        const wasPersistedComplete = persistedCompletionDatesRef.current.has(date);
        const isPersistedComplete = isJournalDayComplete(saved);
        if (isPersistedComplete) {
          persistedCompletionDatesRef.current.add(date);
        } else {
          persistedCompletionDatesRef.current.delete(date);
        }

        if (
          request.queueCompletionCelebration
          && !wasPersistedComplete
          && isPersistedComplete
          && !queuedCompletionDatesRef.current.has(date)
        ) {
          queuedCompletionDatesRef.current.add(date);
          completionEventIdRef.current += 1;
          setCompletionEvent({
            id: completionEventIdRef.current,
            date,
            currentStreak: computeJournalStreak(persistedEntries).currentStreak,
          });
        }

      },
    });
  }

  const refresh = useCallback(async () => {
    try {
      const [entryRows, sectionRows] = await Promise.all([
        listJournalEntries(),
        listJournalSections(),
      ]);
      entriesRef.current = entryRows;
      persistedCompletionDatesRef.current = new Set(
        entryRows.filter(entry => isJournalDayComplete(entry)).map(entry => entry.date),
      );
      setEntries(entryRows);
      setSections(sectionRows);
    } catch (error) {
      console.warn('Journal backend refresh failed', error);
      entriesRef.current = [];
      persistedCompletionDatesRef.current.clear();
      setEntries([]);
      setSections([]);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [entryRows, sectionRows] = await Promise.all([
          listJournalEntries(),
          listJournalSections(),
        ]);
        if (!active) return;
        entriesRef.current = entryRows;
        persistedCompletionDatesRef.current = new Set(
          entryRows.filter(entry => isJournalDayComplete(entry)).map(entry => entry.date),
        );
        setEntries(entryRows);
        setSections(sectionRows);
      } catch (error) {
        console.warn('Journal backend init failed', error);
        if (!active) return;
        entriesRef.current = [];
        persistedCompletionDatesRef.current.clear();
        setEntries([]);
        setSections([]);
      } finally {
        if (active) setReady(true);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const entriesByDate = useMemo(() => indexEntries(entries), [entries]);
  const dotsByDate = useMemo(() => buildDots(entries), [entries]);
  const streak = useMemo(() => computeJournalStreak(entries), [entries]);

  const getEntry = useCallback((date: string) => {
    return entriesByDate[date] ?? emptyJournalEntry(date);
  }, [entriesByDate]);

  const upsertEntry = useCallback(async (
    date: string,
    patch: JournalEntryPatch,
    options?: JournalUpsertOptions,
  ) => {
    const previousEntry = entriesRef.current.find(entry => entry.date === date);
    const next = mergeEntry(previousEntry ?? emptyJournalEntry(date), patch);
    const revision = (writeRevisionsRef.current.get(date) ?? 0) + 1;
    writeRevisionsRef.current.set(date, revision);
    const optimisticEntries = upsertEntryInList(entriesRef.current, next);
    entriesRef.current = optimisticEntries;
    setEntries(optimisticEntries);

    return saveQueueRef.current!.enqueue(date, {
      entry: next,
      revision,
      queueCompletionCelebration: options?.queueCompletionCelebration === true,
    });
  }, []);

  const dismissCompletionEvent = useCallback((id: number) => {
    setCompletionEvent(current => current?.id === id ? null : current);
  }, []);

  const setJournalSections = useCallback(async (nextSections: JournalSection[]) => {
    const previousSections = sections.length ? sections : nextSections;
    await backfillJournalEntrySections(previousSections);
    const nextEntries = entriesRef.current.map(entry => (
      entry.dailySections?.length ? entry : { ...entry, dailySections: previousSections }
    ));
    entriesRef.current = nextEntries;
    setEntries(nextEntries);
    setSections(nextSections);
    await saveJournalSections(nextSections);
  }, [sections]);

  const value = useMemo<JournalContextValue>(() => ({
    ready,
    entries,
    entriesByDate,
    dotsByDate,
    sections,
    streak,
    completionEvent,
    refresh,
    getEntry,
    upsertEntry,
    dismissCompletionEvent,
    setJournalSections,
  }), [
    ready,
    entries,
    entriesByDate,
    dotsByDate,
    sections,
    streak,
    completionEvent,
    refresh,
    getEntry,
    upsertEntry,
    dismissCompletionEvent,
    setJournalSections,
  ]);

  return (
    <JournalContext.Provider value={value}>
      {children}
    </JournalContext.Provider>
  );
}

export function useJournal() {
  const ctx = useContext(JournalContext);
  if (!ctx) {
    throw new Error('useJournal must be used inside JournalProvider');
  }
  return ctx;
}
