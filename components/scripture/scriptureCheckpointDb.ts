import * as SQLite from 'expo-sqlite';
import { openUserContentDb } from '@/data/userContentDb';
import { BIBLE_BOOKS, getBibleBook, PSALMS_ID, type BibleBook } from '@/constants/scripture';
import type { ScriptureTaskConfig } from '@/components/tasks/taskTypes';

export type ScriptureCheckpointKind = 'new_testament' | 'old_testament' | 'psalter';

export type ScriptureCheckpointUnit = {
  index: number;
  kind: ScriptureCheckpointKind;
  bookId: number;
  bookName: string;
  chapter: number;
  ref: string;
  noun: 'chapter' | 'psalm';
};

export type ScriptureCheckpoint = {
  kind: ScriptureCheckpointKind;
  title: string;
  accent: string;
  unitIndex: number;
  totalUnitsRead: number;
  totalUnits: number;
  nextUnit?: ScriptureCheckpointUnit;
  completed: boolean;
  updatedAt: number;
};

export type ScriptureCheckpointReaderSession = {
  checkpoint: ScriptureCheckpoint;
  units: ScriptureCheckpointUnit[];
  plannedUnits: ScriptureCheckpointUnit[];
  startUnitIndex: number;
  plannedCount: number;
};

export type ScriptureCheckpointProgressResult = {
  kind: ScriptureCheckpointKind;
  progressBefore: number;
  progressAfter: number;
  progressTotal: number;
  readUnits: number;
  completed: boolean;
};

type CheckpointRow = {
  kind: ScriptureCheckpointKind;
  current_unit_index: number;
  total_units_read: number;
  created_at: number;
  updated_at: number;
};

type CheckpointSessionRow = {
  id: string;
  kind: ScriptureCheckpointKind;
  task_instance_id: string | null;
  date: string | null;
  previous_unit_index: number;
  previous_total_units_read: number;
  read_units: number;
  next_unit_index: number;
  created_at: number;
  rolled_back_at: number | null;
};

const CHECKPOINT_META: Record<ScriptureCheckpointKind, { title: string; accent: string }> = {
  new_testament: { title: 'New Testament', accent: '#5E7B55' },
  old_testament: { title: 'Old Testament', accent: '#A97732' },
  psalter: { title: 'Psalter', accent: '#C58A2D' },
};

let initPromise: Promise<void> | null = null;

function nextId(prefix = 'scripture_checkpoint_session') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildUnits(kind: ScriptureCheckpointKind) {
  const source = BIBLE_BOOKS.filter(book => {
    if (kind === 'new_testament') return book.testament === 'nt';
    if (kind === 'psalter') return book.id === PSALMS_ID;
    return book.testament !== 'nt' && book.id !== PSALMS_ID;
  });

  const units: Omit<ScriptureCheckpointUnit, 'index'>[] = [];
  for (const book of source) {
    for (let chapter = 1; chapter <= book.chapters; chapter += 1) {
      units.push({
        kind,
        bookId: book.id,
        bookName: book.name,
        chapter,
        ref: book.id === PSALMS_ID ? `Psalm ${chapter}` : `${book.name} ${chapter}`,
        noun: book.id === PSALMS_ID ? 'psalm' : 'chapter',
      });
    }
  }

  return units.map((unit, index) => ({ ...unit, index }));
}

const UNITS_BY_KIND: Record<ScriptureCheckpointKind, ScriptureCheckpointUnit[]> = {
  new_testament: buildUnits('new_testament'),
  old_testament: buildUnits('old_testament'),
  psalter: buildUnits('psalter'),
};

export function getScriptureCheckpointUnits(kind: ScriptureCheckpointKind) {
  return UNITS_BY_KIND[kind];
}

export function getScriptureCheckpointKindsForReadingType(
  readingType?: ScriptureTaskConfig['readingType'] | string,
): ScriptureCheckpointKind[] {
  switch (readingType) {
    case 'new_testament':
      return ['new_testament'];
    case 'old_testament':
      return ['old_testament'];
    case 'psalter':
      return ['psalter'];
    case 'custom':
      return ['new_testament', 'old_testament', 'psalter'];
    default:
      return [];
  }
}

export function getScriptureCheckpointTitle(kind: ScriptureCheckpointKind) {
  return CHECKPOINT_META[kind].title;
}

async function initScriptureCheckpointDb(db?: SQLite.SQLiteDatabase) {
  if (!initPromise) {
    initPromise = (async () => {
      const conn = db ?? await openUserContentDb();
      await conn.execAsync(`
        CREATE TABLE IF NOT EXISTS scripture_checkpoints (
          kind TEXT PRIMARY KEY,
          current_unit_index INTEGER NOT NULL DEFAULT 0,
          total_units_read INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS scripture_checkpoint_sessions (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL,
          task_instance_id TEXT,
          date TEXT,
          previous_unit_index INTEGER NOT NULL,
          previous_total_units_read INTEGER NOT NULL,
          read_units INTEGER NOT NULL,
          next_unit_index INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          rolled_back_at INTEGER
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_scripture_checkpoint_task_instance
          ON scripture_checkpoint_sessions(task_instance_id)
          WHERE task_instance_id IS NOT NULL;
      `);

      const now = Date.now();
      for (const kind of Object.keys(CHECKPOINT_META) as ScriptureCheckpointKind[]) {
        await conn.runAsync(
          `INSERT OR IGNORE INTO scripture_checkpoints (
            kind, current_unit_index, total_units_read, created_at, updated_at
          ) VALUES (?, 0, 0, ?, ?)`,
          kind,
          now,
          now,
        );
      }
    })();
  }

  return initPromise;
}

export async function openScriptureCheckpointDb() {
  const db = await openUserContentDb();
  await initScriptureCheckpointDb(db);
  return db;
}

function rowToCheckpoint(row: CheckpointRow): ScriptureCheckpoint {
  const units = UNITS_BY_KIND[row.kind];
  const unitIndex = clamp(row.current_unit_index ?? 0, 0, units.length);
  const meta = CHECKPOINT_META[row.kind];
  return {
    kind: row.kind,
    title: meta.title,
    accent: meta.accent,
    unitIndex,
    totalUnitsRead: Math.max(0, row.total_units_read ?? 0),
    totalUnits: units.length,
    nextUnit: units[unitIndex],
    completed: unitIndex >= units.length,
    updatedAt: row.updated_at,
  };
}

export async function listScriptureCheckpoints(kinds?: ScriptureCheckpointKind[]) {
  const db = await openScriptureCheckpointDb();
  const rows = await db.getAllAsync<CheckpointRow>(
    'SELECT kind, current_unit_index, total_units_read, created_at, updated_at FROM scripture_checkpoints',
  );
  const allowed = new Set(kinds ?? (Object.keys(CHECKPOINT_META) as ScriptureCheckpointKind[]));
  const byKind = new Map(rows.map(row => [row.kind, rowToCheckpoint(row)]));
  return (Object.keys(CHECKPOINT_META) as ScriptureCheckpointKind[])
    .filter(kind => allowed.has(kind))
    .map(kind => byKind.get(kind))
    .filter((item): item is ScriptureCheckpoint => !!item);
}

export async function getScriptureCheckpoint(kind: ScriptureCheckpointKind) {
  const checkpoints = await listScriptureCheckpoints([kind]);
  return checkpoints[0];
}

export async function setScriptureCheckpointStart(
  kind: ScriptureCheckpointKind,
  bookId: number,
  chapter: number,
) {
  const db = await openScriptureCheckpointDb();
  const units = UNITS_BY_KIND[kind];
  const index = units.findIndex(unit => unit.bookId === bookId && unit.chapter === chapter);
  if (index < 0) return null;

  const now = Date.now();
  await db.runAsync(
    `UPDATE scripture_checkpoints
     SET current_unit_index = ?, total_units_read = ?, updated_at = ?
     WHERE kind = ?`,
    index,
    index,
    now,
    kind,
  );

  return getScriptureCheckpoint(kind);
}

export async function getScriptureCheckpointReaderSession(
  kind: ScriptureCheckpointKind,
  plannedCount = 1,
): Promise<ScriptureCheckpointReaderSession | null> {
  const checkpoint = await getScriptureCheckpoint(kind);
  if (!checkpoint) return null;

  const units = UNITS_BY_KIND[kind];
  const startUnitIndex = clamp(checkpoint.unitIndex, 0, units.length);
  const remaining = Math.max(0, units.length - startUnitIndex);
  const target = Math.max(1, Math.round(plannedCount || 1));
  return {
    checkpoint,
    units,
    plannedUnits: units.slice(startUnitIndex, startUnitIndex + Math.min(remaining, target)),
    startUnitIndex,
    plannedCount: target,
  };
}

export async function saveScriptureCheckpointProgress({
  kind,
  readUnits,
  taskInstanceId,
  date,
}: {
  kind: ScriptureCheckpointKind;
  readUnits: number;
  taskInstanceId?: string;
  date?: string;
}): Promise<ScriptureCheckpointProgressResult | null> {
  const db = await openScriptureCheckpointDb();
  if (taskInstanceId) {
    const existing = await db.getFirstAsync<CheckpointSessionRow>(
      `SELECT id, kind, task_instance_id, date, previous_unit_index, previous_total_units_read,
              read_units, next_unit_index, created_at, rolled_back_at
       FROM scripture_checkpoint_sessions
       WHERE task_instance_id = ?
       LIMIT 1`,
      taskInstanceId,
    );
    if (existing && !existing.rolled_back_at) {
      const total = UNITS_BY_KIND[existing.kind].length;
      return {
        kind: existing.kind,
        progressBefore: existing.previous_unit_index,
        progressAfter: existing.next_unit_index,
        progressTotal: total,
        readUnits: existing.read_units,
        completed: existing.next_unit_index >= total,
      };
    }
  }

  const checkpoint = await getScriptureCheckpoint(kind);
  if (!checkpoint) return null;
  const units = UNITS_BY_KIND[kind];
  const previousIndex = clamp(checkpoint.unitIndex, 0, units.length);
  const remaining = Math.max(0, units.length - previousIndex);
  if (remaining <= 0) {
    return {
      kind,
      progressBefore: previousIndex,
      progressAfter: previousIndex,
      progressTotal: units.length,
      readUnits: 0,
      completed: true,
    };
  }

  const boundedReadUnits = Math.min(remaining, Math.max(1, Math.round(readUnits || 1)));
  const nextIndex = previousIndex + boundedReadUnits;
  const now = Date.now();

  await db.runAsync(
    `INSERT OR REPLACE INTO scripture_checkpoint_sessions (
      id, kind, task_instance_id, date, previous_unit_index, previous_total_units_read,
      read_units, next_unit_index, created_at, rolled_back_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    nextId(),
    kind,
    taskInstanceId ?? null,
    date ?? null,
    previousIndex,
    checkpoint.totalUnitsRead,
    boundedReadUnits,
    nextIndex,
    now,
  );

  await db.runAsync(
    `UPDATE scripture_checkpoints
     SET current_unit_index = ?, total_units_read = ?, updated_at = ?
     WHERE kind = ?`,
    nextIndex,
    checkpoint.totalUnitsRead + boundedReadUnits,
    now,
    kind,
  );

  return {
    kind,
    progressBefore: previousIndex,
    progressAfter: nextIndex,
    progressTotal: units.length,
    readUnits: boundedReadUnits,
    completed: nextIndex >= units.length,
  };
}

export async function rollbackScriptureCheckpointForTaskInstance(taskInstanceId: string) {
  const db = await openScriptureCheckpointDb();
  const session = await db.getFirstAsync<CheckpointSessionRow>(
    `SELECT id, kind, task_instance_id, date, previous_unit_index, previous_total_units_read,
            read_units, next_unit_index, created_at, rolled_back_at
     FROM scripture_checkpoint_sessions
     WHERE task_instance_id = ? AND rolled_back_at IS NULL
     LIMIT 1`,
    taskInstanceId,
  );
  if (!session) return false;

  const checkpoint = await getScriptureCheckpoint(session.kind);
  const now = Date.now();
  if (checkpoint && checkpoint.unitIndex === session.next_unit_index) {
    await db.runAsync(
      `UPDATE scripture_checkpoints
       SET current_unit_index = ?, total_units_read = ?, updated_at = ?
       WHERE kind = ?`,
      session.previous_unit_index,
      session.previous_total_units_read,
      now,
      session.kind,
    );
  }

  await db.runAsync(
    'UPDATE scripture_checkpoint_sessions SET rolled_back_at = ? WHERE id = ?',
    now,
    session.id,
  );

  return true;
}

export function getBooksForCheckpointKind(kind: ScriptureCheckpointKind): BibleBook[] {
  const ids = [...new Set(UNITS_BY_KIND[kind].map(unit => unit.bookId))];
  return ids.map(id => getBibleBook(id)).filter((book): book is BibleBook => !!book);
}
