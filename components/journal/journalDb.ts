import * as SQLite from 'expo-sqlite';
import { openUserContentDb } from '@/data/userContentDb';
import type { JournalSection, SectionType } from '@/components/journal/journalSections';
import { DEFAULT_SECTIONS } from '@/components/journal/journalSections';

export type JournalKind = 'daily' | 'morning' | 'free';

export type JournalPromptAnswer = {
  id: string;
  question: string;
  answer: string;
};

export type JournalEntry = {
  date: string;
  mood?: number;
  energy?: number;
  satisfaction?: number;
  freeWritingHtml?: string;
  morningPagesHtml?: string;
  morningPagesWordCount?: number;
  prompts: JournalPromptAnswer[];
  whoChecks: Record<string, boolean>;
  scaleValues: Record<string, number>;
  createdAt: number;
  updatedAt: number;
};

type EntryRow = {
  date: string;
  mood: number | null;
  energy: number | null;
  satisfaction: number | null;
  free_writing_html: string | null;
  morning_pages_html: string | null;
  morning_pages_word_count: number | null;
  created_at: number;
  updated_at: number;
};

type PromptRow = {
  entry_date: string;
  prompt_id: string;
  question: string;
  answer: string;
};

type CheckRow = {
  entry_date: string;
  quality: string;
  checked: number;
};

type ScaleRow = {
  entry_date: string;
  scale_id: string;
  label: string | null;
  value: number;
};

type SectionRow = {
  id: string;
  type: SectionType;
  active: number;
  custom_label: string | null;
  sort_order: number;
};

let initPromise: Promise<void> | null = null;

type TableInfoRow = {
  name: string;
};

function boolToInt(value: boolean) {
  return value ? 1 : 0;
}

function intToBool(value: unknown) {
  return Number(value || 0) === 1;
}

export function emptyJournalEntry(date: string): JournalEntry {
  const now = Date.now();
  return {
    date,
    prompts: [],
    whoChecks: {},
    scaleValues: {},
    createdAt: now,
    updatedAt: now,
  };
}

export async function openJournalDb() {
  const db = await openUserContentDb();
  await initJournalDb(db);
  return db;
}

async function getTableColumns(db: SQLite.SQLiteDatabase, table: string) {
  const rows = await db.getAllAsync<TableInfoRow>(`PRAGMA table_info(${table})`);
  return new Set(rows.map(row => row.name));
}

async function renameIncompatibleTable(
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

async function prepareLegacyJournalTables(db: SQLite.SQLiteDatabase) {
  await renameIncompatibleTable(db, 'journal_entries', ['date']);
  await renameIncompatibleTable(db, 'journal_prompt_answers', ['entry_date', 'prompt_id']);
  await renameIncompatibleTable(db, 'journal_ideal_checks', ['entry_date', 'quality']);
  await renameIncompatibleTable(db, 'journal_scale_values', ['entry_date', 'scale_id']);
  await renameIncompatibleTable(db, 'journal_sections', ['id', 'type']);
}

async function ensureJournalColumns(db: SQLite.SQLiteDatabase) {
  await ensureColumn(db, 'journal_entries', 'mood', 'INTEGER');
  await ensureColumn(db, 'journal_entries', 'energy', 'INTEGER');
  await ensureColumn(db, 'journal_entries', 'satisfaction', 'INTEGER');
  await ensureColumn(db, 'journal_entries', 'free_writing_html', 'TEXT');
  await ensureColumn(db, 'journal_entries', 'morning_pages_html', 'TEXT');
  await ensureColumn(db, 'journal_entries', 'morning_pages_word_count', 'INTEGER');
  await ensureColumn(db, 'journal_entries', 'created_at', `INTEGER NOT NULL DEFAULT ${Date.now()}`);
  await ensureColumn(db, 'journal_entries', 'updated_at', `INTEGER NOT NULL DEFAULT ${Date.now()}`);

  await ensureColumn(db, 'journal_prompt_answers', 'question', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'journal_prompt_answers', 'answer', "TEXT NOT NULL DEFAULT ''");

  await ensureColumn(db, 'journal_ideal_checks', 'checked', 'INTEGER NOT NULL DEFAULT 0');

  await ensureColumn(db, 'journal_scale_values', 'label', 'TEXT');
  await ensureColumn(db, 'journal_scale_values', 'value', 'INTEGER NOT NULL DEFAULT 0');

  await ensureColumn(db, 'journal_sections', 'active', 'INTEGER NOT NULL DEFAULT 1');
  await ensureColumn(db, 'journal_sections', 'custom_label', 'TEXT');
  await ensureColumn(db, 'journal_sections', 'sort_order', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'journal_sections', 'created_at', `INTEGER NOT NULL DEFAULT ${Date.now()}`);
  await ensureColumn(db, 'journal_sections', 'updated_at', `INTEGER NOT NULL DEFAULT ${Date.now()}`);
}

export async function initJournalDb(db?: SQLite.SQLiteDatabase) {
  if (!initPromise) {
    initPromise = (async () => {
      const conn = db ?? await openUserContentDb();
      await prepareLegacyJournalTables(conn);
      await conn.execAsync(`
        CREATE TABLE IF NOT EXISTS journal_entries (
          date TEXT PRIMARY KEY,
          mood INTEGER,
          energy INTEGER,
          satisfaction INTEGER,
          free_writing_html TEXT,
          morning_pages_html TEXT,
          morning_pages_word_count INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS journal_prompt_answers (
          entry_date TEXT NOT NULL,
          prompt_id TEXT NOT NULL,
          question TEXT NOT NULL,
          answer TEXT NOT NULL,
          PRIMARY KEY (entry_date, prompt_id),
          FOREIGN KEY (entry_date) REFERENCES journal_entries(date) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS journal_ideal_checks (
          entry_date TEXT NOT NULL,
          quality TEXT NOT NULL,
          checked INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (entry_date, quality),
          FOREIGN KEY (entry_date) REFERENCES journal_entries(date) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS journal_scale_values (
          entry_date TEXT NOT NULL,
          scale_id TEXT NOT NULL,
          label TEXT,
          value INTEGER NOT NULL,
          PRIMARY KEY (entry_date, scale_id),
          FOREIGN KEY (entry_date) REFERENCES journal_entries(date) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS journal_sections (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          active INTEGER NOT NULL DEFAULT 1,
          custom_label TEXT,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);
      await ensureJournalColumns(conn);
      await conn.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_journal_entries_updated_at
          ON journal_entries(updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_journal_prompt_date
          ON journal_prompt_answers(entry_date);
        CREATE INDEX IF NOT EXISTS idx_journal_checks_date
          ON journal_ideal_checks(entry_date);
        CREATE INDEX IF NOT EXISTS idx_journal_scales_date
          ON journal_scale_values(entry_date);
      `);
    })().catch(error => {
      initPromise = null;
      throw error;
    });
  }

  return initPromise;
}

function rowToEntry(
  row: EntryRow,
  prompts: JournalPromptAnswer[],
  checks: Record<string, boolean>,
  scaleValues: Record<string, number>,
): JournalEntry {
  return {
    date: row.date,
    mood: row.mood ?? undefined,
    energy: row.energy ?? undefined,
    satisfaction: row.satisfaction ?? undefined,
    freeWritingHtml: row.free_writing_html ?? undefined,
    morningPagesHtml: row.morning_pages_html ?? undefined,
    morningPagesWordCount: row.morning_pages_word_count ?? undefined,
    prompts,
    whoChecks: checks,
    scaleValues,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadEntryChildren(db: SQLite.SQLiteDatabase, dates: string[]) {
  const promptMap = new Map<string, JournalPromptAnswer[]>();
  const checkMap = new Map<string, Record<string, boolean>>();
  const scaleMap = new Map<string, Record<string, number>>();
  if (!dates.length) return { promptMap, checkMap, scaleMap };

  const promptRows = await db.getAllAsync<PromptRow>(
    'SELECT entry_date, prompt_id, question, answer FROM journal_prompt_answers',
  );
  const checkRows = await db.getAllAsync<CheckRow>(
    'SELECT entry_date, quality, checked FROM journal_ideal_checks',
  );
  const scaleRows = await db.getAllAsync<ScaleRow>(
    'SELECT entry_date, scale_id, label, value FROM journal_scale_values',
  );
  const allowed = new Set(dates);

  for (const row of promptRows) {
    if (!allowed.has(row.entry_date)) continue;
    promptMap.set(row.entry_date, [
      ...(promptMap.get(row.entry_date) ?? []),
      { id: row.prompt_id, question: row.question, answer: row.answer },
    ]);
  }

  for (const row of checkRows) {
    if (!allowed.has(row.entry_date)) continue;
    checkMap.set(row.entry_date, {
      ...(checkMap.get(row.entry_date) ?? {}),
      [row.quality]: intToBool(row.checked),
    });
  }

  for (const row of scaleRows) {
    if (!allowed.has(row.entry_date)) continue;
    scaleMap.set(row.entry_date, {
      ...(scaleMap.get(row.entry_date) ?? {}),
      [row.scale_id]: row.value,
    });
  }

  return { promptMap, checkMap, scaleMap };
}

export async function listJournalEntries() {
  const db = await openJournalDb();
  const rows = await db.getAllAsync<EntryRow>(
    'SELECT * FROM journal_entries ORDER BY date DESC, updated_at DESC',
  );
  const dates = rows.map(row => row.date);
  const { promptMap, checkMap, scaleMap } = await loadEntryChildren(db, dates);
  return rows.map(row => rowToEntry(
    row,
    promptMap.get(row.date) ?? [],
    checkMap.get(row.date) ?? {},
    scaleMap.get(row.date) ?? {},
  ));
}

export async function getJournalEntry(date: string) {
  const db = await openJournalDb();
  const row = await db.getFirstAsync<EntryRow>(
    'SELECT * FROM journal_entries WHERE date = ? LIMIT 1',
    date,
  );
  if (!row) return null;
  const { promptMap, checkMap, scaleMap } = await loadEntryChildren(db, [date]);
  return rowToEntry(row, promptMap.get(date) ?? [], checkMap.get(date) ?? {}, scaleMap.get(date) ?? {});
}

export async function upsertJournalEntry(entry: JournalEntry) {
  const db = await openJournalDb();
  const now = Date.now();
  const createdAt = entry.createdAt || now;
  const updatedAt = entry.updatedAt || now;

  await db.runAsync(
    `INSERT INTO journal_entries (
      date, mood, energy, satisfaction, free_writing_html, morning_pages_html,
      morning_pages_word_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      mood = excluded.mood,
      energy = excluded.energy,
      satisfaction = excluded.satisfaction,
      free_writing_html = excluded.free_writing_html,
      morning_pages_html = excluded.morning_pages_html,
      morning_pages_word_count = excluded.morning_pages_word_count,
      updated_at = excluded.updated_at`,
    entry.date,
    entry.mood ?? null,
    entry.energy ?? null,
    entry.satisfaction ?? null,
    entry.freeWritingHtml ?? null,
    entry.morningPagesHtml ?? null,
    entry.morningPagesWordCount ?? null,
    createdAt,
    updatedAt,
  );

  await db.runAsync('DELETE FROM journal_prompt_answers WHERE entry_date = ?', entry.date);
  for (const prompt of entry.prompts) {
    await db.runAsync(
      `INSERT OR REPLACE INTO journal_prompt_answers
       (entry_date, prompt_id, question, answer)
       VALUES (?, ?, ?, ?)`,
      entry.date,
      prompt.id,
      prompt.question,
      prompt.answer,
    );
  }

  await db.runAsync('DELETE FROM journal_ideal_checks WHERE entry_date = ?', entry.date);
  for (const [quality, checked] of Object.entries(entry.whoChecks)) {
    await db.runAsync(
      `INSERT OR REPLACE INTO journal_ideal_checks
       (entry_date, quality, checked)
       VALUES (?, ?, ?)`,
      entry.date,
      quality,
      boolToInt(checked),
    );
  }

  await db.runAsync('DELETE FROM journal_scale_values WHERE entry_date = ?', entry.date);
  for (const [scaleId, value] of Object.entries(entry.scaleValues)) {
    await db.runAsync(
      `INSERT OR REPLACE INTO journal_scale_values
       (entry_date, scale_id, label, value)
       VALUES (?, ?, ?, ?)`,
      entry.date,
      scaleId,
      null,
      value,
    );
  }

  return { ...entry, createdAt, updatedAt };
}

export async function deleteJournalEntry(date: string) {
  const db = await openJournalDb();
  await db.runAsync('DELETE FROM journal_entries WHERE date = ?', date);
}

export async function listJournalSections() {
  const db = await openJournalDb();
  const rows = await db.getAllAsync<SectionRow>(
    'SELECT id, type, active, custom_label, sort_order FROM journal_sections ORDER BY sort_order ASC',
  );
  if (!rows.length) return DEFAULT_SECTIONS;

  return rows.map(row => ({
    id: row.id,
    type: row.type,
    active: intToBool(row.active),
    customLabel: row.custom_label ?? undefined,
  }));
}

export async function saveJournalSections(sections: JournalSection[]) {
  const db = await openJournalDb();
  const now = Date.now();
  await db.runAsync('DELETE FROM journal_sections');
  for (const [index, section] of sections.entries()) {
    await db.runAsync(
      `INSERT OR REPLACE INTO journal_sections
       (id, type, active, custom_label, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      section.id,
      section.type,
      boolToInt(section.active),
      section.customLabel ?? null,
      index,
      now,
      now,
    );
  }
}
