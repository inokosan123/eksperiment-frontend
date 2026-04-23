import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import * as SQLite from 'expo-sqlite';
import {
  getStoredJson,
  openUserContentDb,
  saveStoredJson,
} from '@/data/userContentDb';

export type NoteKind = 'yellow' | 'note';
export type NoteColor = 'white' | 'gold' | 'rose' | 'peach' | 'yellow' | 'mint' | 'sky' | 'lavender';

export type NoteSourceRef = {
  bookId: number;
  chapter: number;
  startVerse?: number;
  endVerse?: number;
  label: string;
  text: string;
  verseTexts?: { verse: number; text: string }[];
};

export type InnerNote = {
  id: string;
  type: NoteKind;
  title: string;
  content: string;
  createdAt: number;
  updatedAt?: number;
  color?: NoteColor;
  sourceRef?: NoteSourceRef;
  sourceRefs?: NoteSourceRef[];
};

export type GratitudeKind = 'life' | 'daily';

export type GratitudeEntry = {
  id: string;
  kind: GratitudeKind;
  title: string;
  content: string;
  date: string;
  createdAt: number;
};

export type IdealSelfItem = {
  id: string;
  text: string;
  order: number;
};

export type IdealSelfProfile = {
  description: string;
  gapDescription: string;
  changeDescription: string;
  items: IdealSelfItem[];
  createdAt: number;
  updatedAt: number;
};

type GratitudeTaskFrequency = 'daily' | 'weekdays';

type GratitudeTaskSettings = {
  enabled: boolean;
  time: string;
  frequency: GratitudeTaskFrequency;
};

type InnerToolsSnapshot = {
  notes: InnerNote[];
  gratitudeEntries: GratitudeEntry[];
  gratitudeTask: GratitudeTaskSettings;
  idealSelf: IdealSelfProfile | null;
};

type InnerToolsContextValue = {
  notes: InnerNote[];
  upsertNote: (note: InnerNote) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  gratitudeEntries: GratitudeEntry[];
  upsertGratitudeEntry: (entry: GratitudeEntry) => void;
  deleteGratitudeEntry: (id: string) => void;
  gratitudeTaskEnabled: boolean;
  setGratitudeTaskEnabled: (enabled: boolean) => void;
  gratitudeTaskTime: string;
  setGratitudeTaskTime: (time: string) => void;
  gratitudeTaskFrequency: GratitudeTaskFrequency;
  setGratitudeTaskFrequency: (frequency: GratitudeTaskFrequency) => void;
  idealSelf: IdealSelfProfile | null;
  saveIdealSelf: (profile: IdealSelfProfile) => void;
};

const InnerToolsContext = createContext<InnerToolsContextValue | null>(null);

const NOTE_COLORS: NoteColor[] = ['white', 'gold', 'rose', 'peach', 'yellow', 'mint', 'sky', 'lavender'];
const STORE_KEYS = {
  gratitudeNotes: 'gratitude_notes',
  gratitudeTask: 'gratitude_task',
  idealSelf: 'ideal_self',
} as const;
const DEFAULT_GRATITUDE_TASK: GratitudeTaskSettings = {
  enabled: false,
  time: '08:00',
  frequency: 'daily',
};

function normalizeNoteType(value: unknown): NoteKind {
  return value === 'note' ? 'note' : 'yellow';
}

function normalizeNoteColor(value: unknown, type: NoteKind): NoteColor {
  if (typeof value === 'string' && NOTE_COLORS.includes(value as NoteColor)) {
    return value as NoteColor;
  }
  return type === 'note' ? 'white' : 'gold';
}

function parseSourceRef(value: unknown): NoteSourceRef | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;

  try {
    const parsed = JSON.parse(value) as NoteSourceRef;
    if (!parsed || typeof parsed !== 'object' || !parsed.label || !parsed.text) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function parseSourceRefs(value: unknown): NoteSourceRef[] {
  if (typeof value !== 'string' || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value) as NoteSourceRef | NoteSourceRef[];
    const refs = Array.isArray(parsed) ? parsed : [parsed];
    return refs.filter(ref => ref && typeof ref === 'object' && !!ref.label && !!ref.text);
  } catch {
    return [];
  }
}

function rowToInnerNote(row: Record<string, unknown>): InnerNote {
  const type = normalizeNoteType(row.type);
  const sourceRefs = parseSourceRefs(row.source_ref);

  return {
    id: String(row.id),
    type,
    title: String(row.title ?? ''),
    content: String(row.content ?? ''),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    color: normalizeNoteColor(row.note_color, type),
    sourceRef: sourceRefs[0] ?? parseSourceRef(row.source_ref),
    sourceRefs,
  };
}

function normalizeGratitudeKind(value: unknown): GratitudeKind {
  return value === 'daily' ? 'daily' : 'life';
}

function normalizeGratitudeEntries(value: unknown): GratitudeEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
    .map(entry => ({
      id: String(entry.id ?? `gratitude_${Date.now()}`),
      kind: normalizeGratitudeKind(entry.kind),
      title: String(entry.title ?? ''),
      content: String(entry.content ?? ''),
      date: String(entry.date ?? new Date().toISOString().split('T')[0]),
      createdAt: Number(entry.createdAt ?? Date.now()),
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

function normalizeIdealSelf(value: unknown): IdealSelfProfile | null {
  if (!value || typeof value !== 'object') return null;

  const raw = value as Record<string, unknown>;
  const rawItems = Array.isArray(raw.items) ? raw.items : [];

  return {
    description: String(raw.description ?? ''),
    gapDescription: String(raw.gapDescription ?? ''),
    changeDescription: String(raw.changeDescription ?? ''),
    items: rawItems
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item, index) => ({
        id: String(item.id ?? `ideal_self_${index}`),
        text: String(item.text ?? ''),
        order: Number(item.order ?? index),
      }))
      .sort((a, b) => a.order - b.order),
    createdAt: Number(raw.createdAt ?? Date.now()),
    updatedAt: Number(raw.updatedAt ?? raw.createdAt ?? Date.now()),
  };
}

function normalizeGratitudeTaskSettings(value: unknown): GratitudeTaskSettings {
  if (!value || typeof value !== 'object') return DEFAULT_GRATITUDE_TASK;

  const raw = value as Record<string, unknown>;
  return {
    enabled: Boolean(raw.enabled),
    time: typeof raw.time === 'string' && raw.time.trim() ? raw.time : DEFAULT_GRATITUDE_TASK.time,
    frequency: raw.frequency === 'weekdays' ? 'weekdays' : 'daily',
  };
}

async function initInnerToolsDb(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS journal_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT,
      content TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'yellow',
      note_color TEXT,
      source_ref TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notes_type ON notes(type);
    CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);
  `);
}

async function loadInnerToolsSnapshot(db: SQLite.SQLiteDatabase): Promise<InnerToolsSnapshot> {
  const [noteRows, gratitudeBlob, gratitudeTaskBlob, idealSelfBlob] = await Promise.all([
    db.getAllAsync<Record<string, unknown>>('SELECT * FROM notes ORDER BY created_at DESC'),
    getStoredJson<unknown>(db, STORE_KEYS.gratitudeNotes, []),
    getStoredJson<unknown>(db, STORE_KEYS.gratitudeTask, DEFAULT_GRATITUDE_TASK),
    getStoredJson<unknown>(db, STORE_KEYS.idealSelf, null),
  ]);

  return {
    notes: noteRows.map(rowToInnerNote),
    gratitudeEntries: normalizeGratitudeEntries(gratitudeBlob),
    gratitudeTask: normalizeGratitudeTaskSettings(gratitudeTaskBlob),
    idealSelf: normalizeIdealSelf(idealSelfBlob),
  };
}

export function InnerToolsProvider({ children }: { children: React.ReactNode }) {
  const [userDb, setUserDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [notes, setNotes] = useState<InnerNote[]>([]);
  const [gratitudeEntries, setGratitudeEntries] = useState<GratitudeEntry[]>([]);
  const [gratitudeTask, setGratitudeTask] = useState<GratitudeTaskSettings>(DEFAULT_GRATITUDE_TASK);
  const [idealSelf, setIdealSelf] = useState<IdealSelfProfile | null>(null);

  const getReadyDb = useCallback(async () => {
    const db = userDb ?? await openUserContentDb();
    await initInnerToolsDb(db);

    if (!userDb) {
      setUserDb(current => current ?? db);
    }

    return db;
  }, [userDb]);

  const applySnapshot = useCallback((snapshot: InnerToolsSnapshot) => {
    setNotes(snapshot.notes);
    setGratitudeEntries(snapshot.gratitudeEntries);
    setGratitudeTask(snapshot.gratitudeTask);
    setIdealSelf(snapshot.idealSelf);
  }, []);

  const refreshInnerTools = useCallback(async (dbOverride?: SQLite.SQLiteDatabase) => {
    const db = dbOverride ?? userDb;
    if (!db) return;
    applySnapshot(await loadInnerToolsSnapshot(db));
  }, [applySnapshot, userDb]);

  const persistGratitudeEntries = useCallback(async (entries: GratitudeEntry[]) => {
    const db = await getReadyDb();
    await saveStoredJson(db, STORE_KEYS.gratitudeNotes, entries);
    await refreshInnerTools(db);
  }, [getReadyDb, refreshInnerTools]);

  const persistGratitudeTask = useCallback(async (settings: GratitudeTaskSettings) => {
    const db = await getReadyDb();
    await saveStoredJson(db, STORE_KEYS.gratitudeTask, settings);
    await refreshInnerTools(db);
  }, [getReadyDb, refreshInnerTools]);

  const persistIdealSelf = useCallback(async (profile: IdealSelfProfile) => {
    const db = await getReadyDb();
    await saveStoredJson(db, STORE_KEYS.idealSelf, profile);
    await refreshInnerTools(db);
  }, [getReadyDb, refreshInnerTools]);

  useEffect(() => {
    let active = true;

    (async () => {
      const db = await openUserContentDb();
      await initInnerToolsDb(db);
      if (!active) return;
      const snapshot = await loadInnerToolsSnapshot(db);
      if (!active) return;
      applySnapshot(snapshot);
      setUserDb(db);
    })();

    return () => {
      active = false;
    };
  }, [applySnapshot]);

  const upsertNote = useCallback(async (note: InnerNote) => {
    const db = await getReadyDb();
    const now = Date.now();
    const type = normalizeNoteType(note.type);
    const color = normalizeNoteColor(note.color, type);

    await db.runAsync(
      `INSERT INTO notes
        (id, title, content, type, note_color, source_ref, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        content = excluded.content,
        type = excluded.type,
        note_color = excluded.note_color,
        source_ref = excluded.source_ref,
        updated_at = excluded.updated_at`,
      note.id,
      note.title || null,
      note.content ?? '',
      type,
      color,
      note.sourceRefs && note.sourceRefs.length > 0
        ? JSON.stringify(note.sourceRefs)
        : note.sourceRef ? JSON.stringify(note.sourceRef) : null,
      note.createdAt || now,
      now,
    );

    await refreshInnerTools(db);
  }, [getReadyDb, refreshInnerTools]);

  const deleteNote = useCallback(async (id: string) => {
    const db = await getReadyDb();
    await db.runAsync('DELETE FROM notes WHERE id = ?', id);
    await refreshInnerTools(db);
  }, [getReadyDb, refreshInnerTools]);

  const value = useMemo<InnerToolsContextValue>(() => ({
    notes,
    upsertNote,
    deleteNote,
    gratitudeEntries,
    upsertGratitudeEntry: (entry) => {
      setGratitudeEntries(prev => {
        const exists = prev.some(item => item.id === entry.id);
        const next = exists
          ? prev.map(item => item.id === entry.id ? entry : item)
          : [entry, ...prev];

        void persistGratitudeEntries(
          [...next].sort((a, b) => b.createdAt - a.createdAt),
        );
        return next;
      });
    },
    deleteGratitudeEntry: (id) => {
      setGratitudeEntries(prev => {
        const next = prev.filter(item => item.id !== id);
        void persistGratitudeEntries(next);
        return next;
      });
    },
    gratitudeTaskEnabled: gratitudeTask.enabled,
    setGratitudeTaskEnabled: (enabled) => {
      setGratitudeTask(prev => {
        const next = { ...prev, enabled };
        void persistGratitudeTask(next);
        return next;
      });
    },
    gratitudeTaskTime: gratitudeTask.time,
    setGratitudeTaskTime: (time) => {
      setGratitudeTask(prev => {
        const next = { ...prev, time };
        void persistGratitudeTask(next);
        return next;
      });
    },
    gratitudeTaskFrequency: gratitudeTask.frequency,
    setGratitudeTaskFrequency: (frequency) => {
      setGratitudeTask(prev => {
        const next = { ...prev, frequency };
        void persistGratitudeTask(next);
        return next;
      });
    },
    idealSelf,
    saveIdealSelf: (profile) => {
      setIdealSelf(profile);
      void persistIdealSelf(profile);
    },
  }), [
    deleteNote,
    gratitudeEntries,
    gratitudeTask,
    idealSelf,
    notes,
    persistGratitudeEntries,
    persistGratitudeTask,
    persistIdealSelf,
    upsertNote,
  ]);

  return (
    <InnerToolsContext.Provider value={value}>
      {children}
    </InnerToolsContext.Provider>
  );
}

export function useInnerTools() {
  const ctx = useContext(InnerToolsContext);
  if (!ctx) {
    throw new Error('useInnerTools must be used inside InnerToolsProvider');
  }
  return ctx;
}
