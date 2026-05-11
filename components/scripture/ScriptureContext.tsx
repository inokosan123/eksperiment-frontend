import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import * as SQLite from 'expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { HighlightColor, DEFAULT_CATEGORIES, ColorCategory } from '@/constants/annotationColors';
import {
  BIBLE_BOOKS, BibleBook, ScriptureLanguage, formatScriptureRef, getBibleBook,
} from '@/constants/scripture';
import { openUserContentDb } from '@/data/userContentDb';

export type BibleVerse = {
  bookId: number;
  chapter: number;
  verse: number;
  text: string;
};

export type ScriptureSearchResult = BibleVerse & {
  bookName: string;
};

export type ScriptureAnnotationKind = 'highlight' | 'underline' | 'favorite' | 'comment';

export type ScriptureAnnotation = {
  id: string;
  kind: ScriptureAnnotationKind;
  color: HighlightColor;
  text: string;
  bookId: number;
  chapter: number;
  verse: number;
  comment?: string;
  createdAt: number;
  updatedAt: number;
};

export type ScriptureBibleNote = {
  id: string;
  bookId: number;
  bookName: string;
  chapter: number;
  observations: string;
  lessons: string;
  application: string;
  createdAt: number;
  updatedAt: number;
};

type AnnotationInput = {
  kind: ScriptureAnnotationKind;
  color?: HighlightColor;
  bookId: number;
  chapter: number;
  verse: number;
  text: string;
  comment?: string;
};

type ScriptureContextValue = {
  ready: boolean;
  books: BibleBook[];
  categories: ColorCategory[];
  annotations: ScriptureAnnotation[];
  bibleNotes: ScriptureBibleNote[];
  updateCategory: (color: HighlightColor, label: string) => Promise<void>;
  getChapter: (bookId: number, chapter: number, lang: ScriptureLanguage) => Promise<BibleVerse[]>;
  searchVerses: (query: string, lang: ScriptureLanguage) => Promise<ScriptureSearchResult[]>;
  upsertAnnotation: (input: AnnotationInput) => Promise<void>;
  deleteAnnotation: (id: string) => Promise<void>;
  toggleAnnotation: (input: AnnotationInput) => Promise<void>;
  saveBibleNote: (bookId: number, chapter: number, observations: string, lessons: string, application: string) => Promise<void>;
  deleteBibleNote: (bookId: number, chapter: number) => Promise<void>;
  refreshScriptureData: () => Promise<void>;
};

const ScriptureContext = createContext<ScriptureContextValue | null>(null);

type TableInfoRow = {
  name: string;
};

function buildFtsQuery(query: string) {
  const terms = query
    .trim()
    .split(/\s+/)
    .map(term => term.replace(/[^\p{L}\p{N}_]+/gu, '').trim())
    .filter(term => term.length >= 2);

  return terms.map(term => `${term}*`).join(' AND ');
}

function annotationId(input: AnnotationInput) {
  return [
    input.kind,
    input.bookId,
    input.chapter,
    input.verse,
    input.color ?? 'gold',
  ].join(':');
}

function rowToAnnotation(row: Record<string, unknown>): ScriptureAnnotation {
  return {
    id: String(row.id),
    kind: row.kind as ScriptureAnnotationKind,
    color: row.color as HighlightColor,
    text: String(row.text ?? ''),
    bookId: Number(row.book_id),
    chapter: Number(row.chapter),
    verse: Number(row.verse),
    comment: row.comment ? String(row.comment) : undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function rowToBibleNote(row: Record<string, unknown>): ScriptureBibleNote {
  const bookId = Number(row.book_id);
  const chapter = Number(row.chapter);
  return {
    id: `${bookId}:${chapter}`,
    bookId,
    bookName: getBibleBook(bookId)?.name ?? `Book ${bookId}`,
    chapter,
    observations: String(row.observations ?? ''),
    lessons: String(row.lessons ?? ''),
    application: String(row.application ?? ''),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function rowToCategory(row: Record<string, unknown>): ColorCategory {
  return {
    color: row.color as HighlightColor,
    label: String(row.label ?? ''),
  };
}

async function getTableColumns(db: SQLite.SQLiteDatabase, table: string) {
  const rows = await db.getAllAsync<TableInfoRow>(`PRAGMA table_info(${table})`);
  return new Set(rows.map(row => row.name));
}

async function renameIfMissingCoreColumns(
  db: SQLite.SQLiteDatabase,
  table: string,
  requiredColumns: string[],
) {
  const columns = await getTableColumns(db, table);
  if (columns.size === 0) return;
  if (requiredColumns.every(column => columns.has(column))) return;

  await db.execAsync(`ALTER TABLE ${table} RENAME TO ${table}_legacy_${Date.now()};`);
}

async function ensureColumn(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  definition: string,
) {
  const columns = await getTableColumns(db, table);
  if (columns.has(column)) return;
  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
}

async function prepareLegacyScriptureTables(db: SQLite.SQLiteDatabase) {
  await renameIfMissingCoreColumns(db, 'scripture_annotations', ['id']);
  await renameIfMissingCoreColumns(db, 'bible_notes', ['book_id', 'chapter']);
  await renameIfMissingCoreColumns(db, 'color_categories', ['color']);
}

async function ensureScriptureColumns(db: SQLite.SQLiteDatabase) {
  await ensureColumn(db, 'scripture_annotations', 'kind', "TEXT NOT NULL DEFAULT 'highlight'");
  await ensureColumn(db, 'scripture_annotations', 'color', "TEXT NOT NULL DEFAULT 'gold'");
  await ensureColumn(db, 'scripture_annotations', 'text', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'scripture_annotations', 'book_id', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'scripture_annotations', 'chapter', 'INTEGER NOT NULL DEFAULT 1');
  await ensureColumn(db, 'scripture_annotations', 'verse', 'INTEGER NOT NULL DEFAULT 1');
  await ensureColumn(db, 'scripture_annotations', 'comment', 'TEXT');
  await ensureColumn(db, 'scripture_annotations', 'created_at', `INTEGER NOT NULL DEFAULT ${Date.now()}`);
  await ensureColumn(db, 'scripture_annotations', 'updated_at', `INTEGER NOT NULL DEFAULT ${Date.now()}`);

  await ensureColumn(db, 'bible_notes', 'observations', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'bible_notes', 'lessons', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'bible_notes', 'application', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'bible_notes', 'created_at', `INTEGER NOT NULL DEFAULT ${Date.now()}`);
  await ensureColumn(db, 'bible_notes', 'updated_at', `INTEGER NOT NULL DEFAULT ${Date.now()}`);

  await ensureColumn(db, 'color_categories', 'label', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'color_categories', 'updated_at', `INTEGER NOT NULL DEFAULT ${Date.now()}`);
}

async function initUserDb(db: SQLite.SQLiteDatabase) {
  await prepareLegacyScriptureTables(db);
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS scripture_annotations (
      id TEXT PRIMARY KEY NOT NULL,
      kind TEXT NOT NULL,
      color TEXT NOT NULL,
      text TEXT NOT NULL,
      book_id INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      comment TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bible_notes (
      book_id INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      observations TEXT NOT NULL DEFAULT '',
      lessons TEXT NOT NULL DEFAULT '',
      application TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (book_id, chapter)
    );

    CREATE TABLE IF NOT EXISTS color_categories (
      color TEXT PRIMARY KEY NOT NULL,
      label TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  await ensureScriptureColumns(db);
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_scripture_annotations_ref
      ON scripture_annotations(book_id, chapter, verse);
    CREATE INDEX IF NOT EXISTS idx_scripture_annotations_kind
      ON scripture_annotations(kind);
    CREATE INDEX IF NOT EXISTS idx_bible_notes_book ON bible_notes(book_id);
  `);

  const now = Date.now();
  for (const category of DEFAULT_CATEGORIES) {
    await db.runAsync(
      'INSERT OR IGNORE INTO color_categories (color, label, updated_at) VALUES (?, ?, ?)',
      category.color,
      category.label,
      now,
    );
  }
}

export function ScriptureProvider({ children }: { children: React.ReactNode }) {
  const bibleDb = useSQLiteContext();
  const [userDb, setUserDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [ready, setReady] = useState(false);
  const [annotations, setAnnotations] = useState<ScriptureAnnotation[]>([]);
  const [bibleNotes, setBibleNotes] = useState<ScriptureBibleNote[]>([]);
  const [categories, setCategories] = useState<ColorCategory[]>(DEFAULT_CATEGORIES);

  const refreshScriptureData = useCallback(async () => {
    if (!userDb) return;
    try {
      const annotationRows = await userDb.getAllAsync<Record<string, unknown>>(
        'SELECT * FROM scripture_annotations ORDER BY updated_at DESC',
      );
      const noteRows = await userDb.getAllAsync<Record<string, unknown>>(
        'SELECT * FROM bible_notes ORDER BY updated_at DESC',
      );
      const categoryRows = await userDb.getAllAsync<Record<string, unknown>>(
        'SELECT * FROM color_categories',
      );
      const categoryMap = new Map(categoryRows.map(row => {
        const category = rowToCategory(row);
        return [category.color, category];
      }));
      setAnnotations(annotationRows.map(rowToAnnotation));
      setBibleNotes(noteRows.map(rowToBibleNote));
      setCategories(DEFAULT_CATEGORIES.map(category => categoryMap.get(category.color) ?? category));
    } catch (error) {
      console.warn('Scripture user data refresh failed', error);
      setAnnotations([]);
      setBibleNotes([]);
      setCategories(DEFAULT_CATEGORIES);
    }
  }, [userDb]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const db = await openUserContentDb();
        await initUserDb(db);
        if (!active) return;
        setUserDb(db);
      } catch (error) {
        console.warn('Scripture user DB init failed', error);
        if (active) setReady(true);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!userDb) return;
    refreshScriptureData().finally(() => setReady(true));
  }, [refreshScriptureData, userDb]);

  const getChapter = useCallback(async (bookId: number, chapter: number, lang: ScriptureLanguage) => {
    const rows = await bibleDb.getAllAsync<{ verse: number; text: string }>(
      'SELECT verse, text FROM verses WHERE book = ? AND chapter = ? AND lang = ? ORDER BY verse',
      bookId,
      chapter,
      lang,
    );

    return rows.map(row => ({
      bookId,
      chapter,
      verse: row.verse,
      text: row.text,
    }));
  }, [bibleDb]);

  const searchVerses = useCallback(async (query: string, lang: ScriptureLanguage) => {
    const ftsQuery = buildFtsQuery(query);
    if (!ftsQuery) return [];

    const rows = await bibleDb.getAllAsync<{
      book: number;
      bookName: string;
      chapter: number;
      verse: number;
      text: string;
    }>(
      `SELECT verses_fts.book, b.name as bookName, verses_fts.chapter, verses_fts.verse, verses_fts.text
       FROM verses_fts
       JOIN books b ON b.id = verses_fts.book
       WHERE verses_fts MATCH ? AND verses_fts.lang = ?
       ORDER BY verses_fts.book, verses_fts.chapter, verses_fts.verse
       LIMIT 80`,
      ftsQuery,
      lang,
    );

    return rows.map(row => ({
      bookId: row.book,
      bookName: row.bookName,
      chapter: row.chapter,
      verse: row.verse,
      text: row.text,
    }));
  }, [bibleDb]);

  const upsertAnnotation = useCallback(async (input: AnnotationInput) => {
    if (!userDb) return;
    const now = Date.now();
    const id = annotationId(input);
    await userDb.runAsync(
      `INSERT INTO scripture_annotations
        (id, kind, color, text, book_id, chapter, verse, comment, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        color = excluded.color,
        text = excluded.text,
        comment = excluded.comment,
        updated_at = excluded.updated_at`,
      id,
      input.kind,
      input.color ?? 'gold',
      input.text,
      input.bookId,
      input.chapter,
      input.verse,
      input.comment ?? null,
      now,
      now,
    );
    await refreshScriptureData();
  }, [refreshScriptureData, userDb]);

  const deleteAnnotation = useCallback(async (id: string) => {
    if (!userDb) return;
    await userDb.runAsync('DELETE FROM scripture_annotations WHERE id = ?', id);
    await refreshScriptureData();
  }, [refreshScriptureData, userDb]);

  const updateCategory = useCallback(async (color: HighlightColor, label: string) => {
    if (!userDb) return;
    const fallback = DEFAULT_CATEGORIES.find(category => category.color === color)?.label ?? color;
    const nextLabel = label.trim() || fallback;
    await userDb.runAsync(
      `INSERT INTO color_categories (color, label, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(color) DO UPDATE SET
        label = excluded.label,
        updated_at = excluded.updated_at`,
      color,
      nextLabel,
      Date.now(),
    );
    await refreshScriptureData();
  }, [refreshScriptureData, userDb]);

  const toggleAnnotation = useCallback(async (input: AnnotationInput) => {
    const existing = annotations.find(annotation => annotation.id === annotationId(input));
    if (existing) {
      await deleteAnnotation(existing.id);
    } else {
      await upsertAnnotation(input);
    }
  }, [annotations, deleteAnnotation, upsertAnnotation]);

  const saveBibleNote = useCallback(async (
    bookId: number,
    chapter: number,
    observations: string,
    lessons: string,
    application: string,
  ) => {
    if (!userDb) return;
    const now = Date.now();
    const empty = !observations.trim() && !lessons.trim() && !application.trim();
    if (empty) {
      await userDb.runAsync('DELETE FROM bible_notes WHERE book_id = ? AND chapter = ?', bookId, chapter);
      await refreshScriptureData();
      return;
    }

    await userDb.runAsync(
      `INSERT INTO bible_notes
        (book_id, chapter, observations, lessons, application, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(book_id, chapter) DO UPDATE SET
        observations = excluded.observations,
        lessons = excluded.lessons,
        application = excluded.application,
        updated_at = excluded.updated_at`,
      bookId,
      chapter,
      observations,
      lessons,
      application,
      now,
      now,
    );
    await refreshScriptureData();
  }, [refreshScriptureData, userDb]);

  const deleteBibleNote = useCallback(async (bookId: number, chapter: number) => {
    if (!userDb) return;
    await userDb.runAsync('DELETE FROM bible_notes WHERE book_id = ? AND chapter = ?', bookId, chapter);
    await refreshScriptureData();
  }, [refreshScriptureData, userDb]);

  const value = useMemo<ScriptureContextValue>(() => ({
    ready,
    books: BIBLE_BOOKS,
    categories,
    annotations,
    bibleNotes,
    updateCategory,
    getChapter,
    searchVerses,
    upsertAnnotation,
    deleteAnnotation,
    toggleAnnotation,
    saveBibleNote,
    deleteBibleNote,
    refreshScriptureData,
  }), [
    annotations,
    bibleNotes,
    categories,
    deleteAnnotation,
    deleteBibleNote,
    getChapter,
    ready,
    refreshScriptureData,
    saveBibleNote,
    searchVerses,
    toggleAnnotation,
    updateCategory,
    upsertAnnotation,
  ]);

  return (
    <ScriptureContext.Provider value={value}>
      {children}
    </ScriptureContext.Provider>
  );
}

export function useScripture() {
  const ctx = useContext(ScriptureContext);
  if (!ctx) {
    throw new Error('useScripture must be used inside ScriptureProvider');
  }
  return ctx;
}

export function annotationLocation(annotation: ScriptureAnnotation) {
  return formatScriptureRef(annotation.bookId, annotation.chapter, annotation.verse);
}
