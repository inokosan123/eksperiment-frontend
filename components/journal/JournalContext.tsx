import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
} from '@/components/journal/journalLogic';
import type { JournalSection } from '@/components/journal/journalSections';

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

type JournalContextValue = {
  ready: boolean;
  entries: JournalEntry[];
  entriesByDate: Record<string, JournalEntry>;
  dotsByDate: Record<string, JournalDotKind[]>;
  sections: JournalSection[];
  streak: ReturnType<typeof computeJournalStreak>;
  refresh: () => Promise<void>;
  getEntry: (date: string) => JournalEntry;
  upsertEntry: (date: string, patch: JournalEntryPatch) => Promise<JournalEntry>;
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
  const now = Date.now();
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

export function JournalProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [sections, setSections] = useState<JournalSection[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [entryRows, sectionRows] = await Promise.all([
        listJournalEntries(),
        listJournalSections(),
      ]);
      setEntries(entryRows);
      setSections(sectionRows);
    } catch (error) {
      console.warn('Journal backend refresh failed', error);
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
        setEntries(entryRows);
        setSections(sectionRows);
      } catch (error) {
        console.warn('Journal backend init failed', error);
        if (!active) return;
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

  const upsertEntry = useCallback(async (date: string, patch: JournalEntryPatch) => {
    const next = mergeEntry(entriesByDate[date] ?? emptyJournalEntry(date), patch);

    setEntries(prev => {
      const exists = prev.some(entry => entry.date === date);
      const merged = exists
        ? prev.map(entry => entry.date === date ? next : entry)
        : [next, ...prev];
      return merged.sort((left, right) => right.date.localeCompare(left.date));
    });

    const saved = await upsertJournalEntry(next);
    setEntries(prev => prev.map(entry => entry.date === date ? saved : entry));
    return saved;
  }, [entriesByDate]);

  const setJournalSections = useCallback(async (nextSections: JournalSection[]) => {
    const previousSections = sections.length ? sections : nextSections;
    await backfillJournalEntrySections(previousSections);
    setEntries(prev => prev.map(entry => (
      entry.dailySections?.length ? entry : { ...entry, dailySections: previousSections }
    )));
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
    refresh,
    getEntry,
    upsertEntry,
    setJournalSections,
  }), [
    ready,
    entries,
    entriesByDate,
    dotsByDate,
    sections,
    streak,
    refresh,
    getEntry,
    upsertEntry,
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
