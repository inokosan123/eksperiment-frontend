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

// Anasta IdealSelf — nine-step "ideal self" flow split into LIFE + FAITH.
// Vision:               free text picture of the future self.
// Qualities:            5–10 short tags describing that person.
// Obstacles:            life-side blockers ("what separates you most").
// Actions:              life-side daily moves toward that person.
// Routines:             rhythms / habits that person keeps.
// RelationshipWithGod:  free text — the bond / trust / prayer they want.
// SpiritualObstacles:   what blocks that relationship most.
// SpiritualActions:     what they do daily to draw closer.
// FaithPractice:        concrete prayer / scripture / fasting practices.
export type IdealSelfProfile = {
  vision: string;
  qualities: string[];
  obstacles: string[];
  actions: string[];
  routines: string[];
  relationshipWithGod: string;
  spiritualObstacles: string[];
  spiritualActions: string[];
  faithPractice: string[];
  createdAt: number;
  updatedAt: number;
};

type GratitudeTaskFrequency = 'daily' | 'weekdays';
type GratitudeTaskDayTimes = Record<number, string>;

type GratitudeTaskSettings = {
  enabled: boolean;
  time: string;
  frequency: GratitudeTaskFrequency;
  sameTimeEveryDay: boolean;
  dayTimes: GratitudeTaskDayTimes;
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
  gratitudeTaskSameTimeEveryDay: boolean;
  setGratitudeTaskSameTimeEveryDay: (sameTimeEveryDay: boolean) => void;
  gratitudeTaskDayTimes: GratitudeTaskDayTimes;
  setGratitudeTaskDayTimes: (dayTimes: GratitudeTaskDayTimes) => void;
  idealSelf: IdealSelfProfile | null;
  saveIdealSelf: (profile: IdealSelfProfile) => void;
};

type GratitudeEntryRow = {
  id: string;
  kind: GratitudeKind;
  title: string | null;
  content: string | null;
  entry_date: string;
  created_at: number;
};

type GratitudeTaskRow = {
  enabled: number;
  time: string;
  frequency: GratitudeTaskFrequency;
  same_time_every_day: number;
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
  sameTimeEveryDay: true,
  dayTimes: {},
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

function rowToGratitudeEntry(row: GratitudeEntryRow): GratitudeEntry {
  return {
    id: row.id,
    kind: normalizeGratitudeKind(row.kind),
    title: row.title ?? '',
    content: row.content ?? '',
    date: row.entry_date,
    createdAt: row.created_at,
  };
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => typeof item === 'string' ? item.trim() : '')
    .filter(item => item.length > 0);
}

function normalizeIdealSelf(value: unknown): IdealSelfProfile | null {
  if (!value || typeof value !== 'object') return null;

  const raw = value as Record<string, unknown>;
  const vision = typeof raw.vision === 'string' ? raw.vision : '';
  // Migrate legacy 'calling' → 'relationshipWithGod'. Old saved profiles
  // still have the calling field; new shape stores it under the relationship
  // key. Whichever exists, prefer the new key.
  const relationshipWithGod =
    typeof raw.relationshipWithGod === 'string' ? raw.relationshipWithGod
    : typeof raw.calling === 'string' ? raw.calling
    : '';
  const qualities = toStringList(raw.qualities);
  const obstacles = toStringList(raw.obstacles);
  const actions = toStringList(raw.actions);
  const routines = toStringList(raw.routines);
  const spiritualObstacles = toStringList(raw.spiritualObstacles);
  const spiritualActions = toStringList(raw.spiritualActions);
  const faithPractice = toStringList(raw.faithPractice);

  // Treat a profile as missing if every field is empty — older data shapes
  // (description/gap/change/items) won't satisfy this and will trigger the
  // first-time flow rather than rendering a half-empty summary.
  if (
    !vision &&
    !relationshipWithGod &&
    qualities.length === 0 &&
    obstacles.length === 0 &&
    actions.length === 0 &&
    routines.length === 0 &&
    spiritualObstacles.length === 0 &&
    spiritualActions.length === 0 &&
    faithPractice.length === 0
  ) {
    return null;
  }

  return {
    vision,
    qualities,
    obstacles,
    actions,
    routines,
    relationshipWithGod,
    spiritualObstacles,
    spiritualActions,
    faithPractice,
    createdAt: Number(raw.createdAt ?? Date.now()),
    updatedAt: Number(raw.updatedAt ?? raw.createdAt ?? Date.now()),
  };
}

function normalizeTaskTime(value: unknown, fallback = DEFAULT_GRATITUDE_TASK.time) {
  if (typeof value !== 'string') return fallback;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;

  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function normalizeTaskDayTimes(value: unknown, fallbackTime: string): GratitudeTaskDayTimes {
  if (!value || typeof value !== 'object') return {};

  return Object.entries(value as Record<string, unknown>).reduce<GratitudeTaskDayTimes>((acc, [key, timeValue]) => {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index > 6) return acc;
    acc[index] = normalizeTaskTime(timeValue, fallbackTime);
    return acc;
  }, {});
}

function normalizeGratitudeTaskSettings(value: unknown): GratitudeTaskSettings {
  if (!value || typeof value !== 'object') return DEFAULT_GRATITUDE_TASK;

  const raw = value as Record<string, unknown>;
  const time = normalizeTaskTime(raw.time);
  return {
    enabled: Boolean(raw.enabled),
    time,
    frequency: raw.frequency === 'weekdays' ? 'weekdays' : 'daily',
    sameTimeEveryDay: typeof raw.sameTimeEveryDay === 'boolean' ? raw.sameTimeEveryDay : true,
    dayTimes: normalizeTaskDayTimes(raw.dayTimes, time),
  };
}

function rowToGratitudeTaskSettings(
  row: GratitudeTaskRow | null,
  dayTimes: GratitudeTaskDayTimes,
): GratitudeTaskSettings {
  if (!row) return DEFAULT_GRATITUDE_TASK;
  const time = normalizeTaskTime(row.time);
  return {
    enabled: Number(row.enabled || 0) === 1,
    time,
    frequency: row.frequency === 'weekdays' ? 'weekdays' : 'daily',
    sameTimeEveryDay: Number(row.same_time_every_day || 0) === 1,
    dayTimes: normalizeTaskDayTimes(dayTimes, time),
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

    CREATE TABLE IF NOT EXISTS gratitude_entries (
      id TEXT PRIMARY KEY NOT NULL,
      kind TEXT NOT NULL DEFAULT 'life',
      title TEXT,
      content TEXT NOT NULL DEFAULT '',
      entry_date TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gratitude_task_settings (
      id TEXT PRIMARY KEY NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 0,
      time TEXT NOT NULL DEFAULT '08:00',
      frequency TEXT NOT NULL DEFAULT 'daily',
      same_time_every_day INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gratitude_task_day_times (
      day_index INTEGER PRIMARY KEY NOT NULL,
      time TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_gratitude_entries_kind_date ON gratitude_entries(kind, entry_date);
    CREATE INDEX IF NOT EXISTS idx_gratitude_entries_created_at ON gratitude_entries(created_at DESC);
  `);
}

async function saveGratitudeTaskSettingsToDb(
  db: SQLite.SQLiteDatabase,
  settings: GratitudeTaskSettings,
) {
  const time = normalizeTaskTime(settings.time);
  await db.runAsync(
    `INSERT INTO gratitude_task_settings (
      id, enabled, time, frequency, same_time_every_day, updated_at
    ) VALUES ('default', ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      enabled = excluded.enabled,
      time = excluded.time,
      frequency = excluded.frequency,
      same_time_every_day = excluded.same_time_every_day,
      updated_at = excluded.updated_at`,
    settings.enabled ? 1 : 0,
    time,
    settings.frequency === 'weekdays' ? 'weekdays' : 'daily',
    settings.sameTimeEveryDay ? 1 : 0,
    Date.now(),
  );

  await db.runAsync('DELETE FROM gratitude_task_day_times');
  if (!settings.sameTimeEveryDay) {
    const normalizedDayTimes = normalizeTaskDayTimes(settings.dayTimes, time);
    for (const [dayIndex, dayTime] of Object.entries(normalizedDayTimes)) {
      await db.runAsync(
        'INSERT OR REPLACE INTO gratitude_task_day_times (day_index, time) VALUES (?, ?)',
        Number(dayIndex),
        dayTime,
      );
    }
  }
}

async function migrateLegacyGratitude(db: SQLite.SQLiteDatabase) {
  const entryCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM gratitude_entries',
  );
  if (!entryCount?.count) {
    const legacyEntries = normalizeGratitudeEntries(
      await getStoredJson<unknown>(db, STORE_KEYS.gratitudeNotes, []),
    );
    for (const entry of legacyEntries) {
      await db.runAsync(
        `INSERT OR IGNORE INTO gratitude_entries (
          id, kind, title, content, entry_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        entry.id,
        entry.kind,
        entry.title || null,
        entry.content ?? '',
        entry.date,
        entry.createdAt,
        entry.createdAt,
      );
    }
  }

  const taskCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM gratitude_task_settings',
  );
  if (!taskCount?.count) {
    const legacyTask = normalizeGratitudeTaskSettings(
      await getStoredJson<unknown>(db, STORE_KEYS.gratitudeTask, DEFAULT_GRATITUDE_TASK),
    );
    await saveGratitudeTaskSettingsToDb(db, legacyTask);
  }
}

async function loadGratitudeEntries(db: SQLite.SQLiteDatabase) {
  const rows = await db.getAllAsync<GratitudeEntryRow>(
    `SELECT id, kind, title, content, entry_date, created_at
     FROM gratitude_entries
     ORDER BY created_at DESC`,
  );
  return rows.map(rowToGratitudeEntry);
}

async function loadGratitudeTaskSettings(db: SQLite.SQLiteDatabase) {
  const [row, dayRows] = await Promise.all([
    db.getFirstAsync<GratitudeTaskRow>(
      `SELECT enabled, time, frequency, same_time_every_day
       FROM gratitude_task_settings
       WHERE id = 'default'
       LIMIT 1`,
    ),
    db.getAllAsync<{ day_index: number; time: string }>(
      'SELECT day_index, time FROM gratitude_task_day_times ORDER BY day_index ASC',
    ),
  ]);

  const dayTimes = dayRows.reduce<GratitudeTaskDayTimes>((acc, item) => {
    acc[item.day_index] = item.time;
    return acc;
  }, {});

  return rowToGratitudeTaskSettings(row, dayTimes);
}

async function loadInnerToolsSnapshot(db: SQLite.SQLiteDatabase): Promise<InnerToolsSnapshot> {
  await migrateLegacyGratitude(db);

  const [noteRows, gratitudeRows, gratitudeTaskSettings, idealSelfBlob] = await Promise.all([
    db.getAllAsync<Record<string, unknown>>('SELECT * FROM notes ORDER BY created_at DESC'),
    loadGratitudeEntries(db),
    loadGratitudeTaskSettings(db),
    getStoredJson<unknown>(db, STORE_KEYS.idealSelf, null),
  ]);

  return {
    notes: noteRows.map(rowToInnerNote),
    gratitudeEntries: gratitudeRows,
    gratitudeTask: gratitudeTaskSettings,
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

  const persistGratitudeEntry = useCallback(async (entry: GratitudeEntry) => {
    const db = await getReadyDb();
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO gratitude_entries (
        id, kind, title, content, entry_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        kind = excluded.kind,
        title = excluded.title,
        content = excluded.content,
        entry_date = excluded.entry_date,
        updated_at = excluded.updated_at`,
      entry.id,
      normalizeGratitudeKind(entry.kind),
      entry.title || null,
      entry.content ?? '',
      entry.date,
      entry.createdAt || now,
      now,
    );
    await refreshInnerTools(db);
  }, [getReadyDb, refreshInnerTools]);

  const persistDeleteGratitudeEntry = useCallback(async (id: string) => {
    const db = await getReadyDb();
    await db.runAsync('DELETE FROM gratitude_entries WHERE id = ?', id);
    await refreshInnerTools(db);
  }, [getReadyDb, refreshInnerTools]);

  const persistGratitudeTask = useCallback(async (settings: GratitudeTaskSettings) => {
    const db = await getReadyDb();
    await saveGratitudeTaskSettingsToDb(db, settings);
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

        void persistGratitudeEntry(entry);
        return [...next].sort((a, b) => b.createdAt - a.createdAt);
      });
    },
    deleteGratitudeEntry: (id) => {
      setGratitudeEntries(prev => {
        const next = prev.filter(item => item.id !== id);
        void persistDeleteGratitudeEntry(id);
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
    gratitudeTaskSameTimeEveryDay: gratitudeTask.sameTimeEveryDay,
    setGratitudeTaskSameTimeEveryDay: (sameTimeEveryDay) => {
      setGratitudeTask(prev => {
        const next = { ...prev, sameTimeEveryDay };
        void persistGratitudeTask(next);
        return next;
      });
    },
    gratitudeTaskDayTimes: gratitudeTask.dayTimes,
    setGratitudeTaskDayTimes: (dayTimes) => {
      setGratitudeTask(prev => {
        const next = { ...prev, dayTimes };
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
    persistDeleteGratitudeEntry,
    persistGratitudeEntry,
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
