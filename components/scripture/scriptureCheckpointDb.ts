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
  id: string;
  kind: ScriptureCheckpointKind;
  name: string;
  kindTitle: string;
  accent: string;
  unitIndex: number;
  totalUnitsRead: number;
  totalUnits: number;
  nextUnit?: ScriptureCheckpointUnit;
  completed: boolean;
  sessionCount: number;
  availableBackSteps: number;
  availableForwardSteps: number;
  createdAt: number;
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
  checkpointId: string;
  kind: ScriptureCheckpointKind;
  progressBefore: number;
  progressAfter: number;
  progressTotal: number;
  readUnits: number;
  completed: boolean;
};

type CheckpointRow = {
  id: string;
  kind: ScriptureCheckpointKind;
  name: string | null;
  current_unit_index: number;
  total_units_read: number;
  created_at: number;
  updated_at: number;
  active_session_count?: number | null;
  rolled_back_session_count?: number | null;
};

type CheckpointSessionRow = {
  id: string;
  checkpoint_id: string | null;
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

export type ScriptureCheckpointHistoryDirection = 'back' | 'forward';

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

function defaultCheckpointId(kind: ScriptureCheckpointKind) {
  return `scripture_checkpoint_${kind}_default`;
}

function checkpointPathId() {
  return nextId('scripture_checkpoint');
}

function defaultCheckpointName(kind: ScriptureCheckpointKind) {
  return `${CHECKPOINT_META[kind].title} Checkpoint`;
}

function normalizeCheckpointName(kind: ScriptureCheckpointKind, value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || defaultCheckpointName(kind);
}

async function tableColumns(db: SQLite.SQLiteDatabase, table: string) {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table});`);
  return new Set(rows.map(row => row.name));
}

async function ensureColumn(db: SQLite.SQLiteDatabase, table: string, column: string, definition: string) {
  const columns = await tableColumns(db, table);
  if (columns.has(column)) return;
  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
}

async function ensureCheckpointPathsSchema(db: SQLite.SQLiteDatabase) {
  const columns = await tableColumns(db, 'scripture_checkpoint_paths');
  if (!columns.has('id') || !columns.has('kind')) {
    await db.execAsync(`
      ALTER TABLE scripture_checkpoint_paths RENAME TO scripture_checkpoint_paths_legacy_${Date.now()};
      CREATE TABLE scripture_checkpoint_paths (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        current_unit_index INTEGER NOT NULL DEFAULT 0,
        total_units_read INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    return;
  }

  await ensureColumn(db, 'scripture_checkpoint_paths', 'name', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'scripture_checkpoint_paths', 'current_unit_index', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'scripture_checkpoint_paths', 'total_units_read', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'scripture_checkpoint_paths', 'created_at', `INTEGER NOT NULL DEFAULT ${Date.now()}`);
  await ensureColumn(db, 'scripture_checkpoint_paths', 'updated_at', `INTEGER NOT NULL DEFAULT ${Date.now()}`);
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
  const normalized = normalizeCheckpointReadingType(readingType);
  switch (normalized) {
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

export function normalizeCheckpointReadingType(
  readingType?: ScriptureTaskConfig['readingType'] | string | string[] | null,
): ScriptureTaskConfig['readingType'] | undefined {
  const raw = Array.isArray(readingType) ? readingType[0] : readingType;
  const key = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (!key) return undefined;
  if (key === 'custom' || key === 'all' || key === 'scripture_checkpoints') return 'custom';
  if (key === 'church_calendar') return 'church_calendar';
  if (key === 'psalter' || key === 'psalms' || key === 'psalm' || key.includes('psalter')) return 'psalter';
  if (key === 'new_testament' || key === 'nt' || key.includes('new_testament')) return 'new_testament';
  if (key === 'old_testament' || key === 'ot' || key.includes('old_testament')) return 'old_testament';

  return undefined;
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

        CREATE TABLE IF NOT EXISTS scripture_checkpoint_paths (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL,
          name TEXT NOT NULL,
          current_unit_index INTEGER NOT NULL DEFAULT 0,
          total_units_read INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS scripture_checkpoint_sessions (
          id TEXT PRIMARY KEY,
          checkpoint_id TEXT,
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

      await ensureCheckpointPathsSchema(conn);
      await ensureColumn(conn, 'scripture_checkpoint_sessions', 'checkpoint_id', 'TEXT');
      await conn.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_scripture_checkpoint_paths_kind
          ON scripture_checkpoint_paths(kind, created_at);

        CREATE INDEX IF NOT EXISTS idx_scripture_checkpoint_sessions_checkpoint
          ON scripture_checkpoint_sessions(checkpoint_id, created_at DESC);
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

      const pathCount = await conn.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM scripture_checkpoint_paths',
      );
      if (!pathCount?.count) {
        const legacyRows = await conn.getAllAsync<{
          kind: ScriptureCheckpointKind;
          current_unit_index: number;
          total_units_read: number;
          created_at: number;
          updated_at: number;
        }>('SELECT kind, current_unit_index, total_units_read, created_at, updated_at FROM scripture_checkpoints');

        for (const kind of Object.keys(CHECKPOINT_META) as ScriptureCheckpointKind[]) {
          const legacy = legacyRows.find(row => row.kind === kind);
          await conn.runAsync(
            `INSERT OR IGNORE INTO scripture_checkpoint_paths (
              id, kind, name, current_unit_index, total_units_read, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            defaultCheckpointId(kind),
            kind,
            defaultCheckpointName(kind),
            clamp(legacy?.current_unit_index ?? 0, 0, UNITS_BY_KIND[kind].length),
            Math.max(0, legacy?.total_units_read ?? 0),
            legacy?.created_at ?? now,
            legacy?.updated_at ?? now,
          );
        }
      }

      for (const kind of Object.keys(CHECKPOINT_META) as ScriptureCheckpointKind[]) {
        await conn.runAsync(
          `UPDATE scripture_checkpoint_sessions
           SET checkpoint_id = ?
           WHERE checkpoint_id IS NULL AND kind = ?`,
          defaultCheckpointId(kind),
          kind,
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
  const activeSessionCount = Math.max(0, row.active_session_count ?? 0);
  const rolledBackSessionCount = Math.max(0, row.rolled_back_session_count ?? 0);
  return {
    id: row.id,
    kind: row.kind,
    name: normalizeCheckpointName(row.kind, row.name),
    kindTitle: meta.title,
    accent: meta.accent,
    unitIndex,
    totalUnitsRead: Math.max(0, row.total_units_read ?? 0),
    totalUnits: units.length,
    nextUnit: units[unitIndex],
    completed: unitIndex >= units.length,
    sessionCount: activeSessionCount,
    availableBackSteps: Math.max(0, Math.min(3 - rolledBackSessionCount, activeSessionCount)),
    availableForwardSteps: rolledBackSessionCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function checkpointSessionCountsSql() {
  return `
    SELECT checkpoint_id,
           SUM(CASE WHEN rolled_back_at IS NULL THEN 1 ELSE 0 END) AS active_session_count,
           SUM(CASE WHEN rolled_back_at IS NOT NULL THEN 1 ELSE 0 END) AS rolled_back_session_count
    FROM scripture_checkpoint_sessions
    WHERE checkpoint_id IS NOT NULL
    GROUP BY checkpoint_id
  `;
}

export async function listScriptureCheckpoints(kinds?: ScriptureCheckpointKind[]) {
  const db = await openScriptureCheckpointDb();
  const rows = await db.getAllAsync<CheckpointRow>(
    `SELECT p.id, p.kind, p.name, p.current_unit_index, p.total_units_read,
            p.created_at, p.updated_at,
            COALESCE(s.active_session_count, 0) AS active_session_count,
            COALESCE(s.rolled_back_session_count, 0) AS rolled_back_session_count
     FROM scripture_checkpoint_paths p
     LEFT JOIN (${checkpointSessionCountsSql()}) s ON s.checkpoint_id = p.id`,
  );
  const allowed = new Set(kinds ?? (Object.keys(CHECKPOINT_META) as ScriptureCheckpointKind[]));
  const kindOrder = new Map((Object.keys(CHECKPOINT_META) as ScriptureCheckpointKind[]).map((kind, index) => [kind, index]));
  return rows
    .filter(row => allowed.has(row.kind))
    .map(rowToCheckpoint)
    .sort((left, right) => {
      const byKind = (kindOrder.get(left.kind) ?? 0) - (kindOrder.get(right.kind) ?? 0);
      if (byKind !== 0) return byKind;
      const byUpdated = right.updatedAt - left.updatedAt;
      if (byUpdated !== 0) return byUpdated;
      return right.createdAt - left.createdAt;
    });
}

export async function restoreScriptureCheckpointLatest(kinds?: ScriptureCheckpointKind[]) {
  const db = await openScriptureCheckpointDb();
  const allowed = new Set(kinds ?? (Object.keys(CHECKPOINT_META) as ScriptureCheckpointKind[]));
  const paths = await db.getAllAsync<{ id: string; kind: ScriptureCheckpointKind }>(
    'SELECT id, kind FROM scripture_checkpoint_paths',
  );
  const now = Date.now();
  let changed = false;

  for (const path of paths) {
    if (!allowed.has(path.kind)) continue;
    const latestRolledBack = await db.getFirstAsync<CheckpointSessionRow>(
      `SELECT id, checkpoint_id, kind, task_instance_id, date, previous_unit_index, previous_total_units_read,
              read_units, next_unit_index, created_at, rolled_back_at
       FROM scripture_checkpoint_sessions
       WHERE checkpoint_id = ? AND rolled_back_at IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      path.id,
    );
    if (!latestRolledBack) continue;

    await db.runAsync(
      `UPDATE scripture_checkpoint_paths
       SET current_unit_index = ?, total_units_read = ?, updated_at = ?
       WHERE id = ?`,
      latestRolledBack.next_unit_index,
      latestRolledBack.previous_total_units_read + latestRolledBack.read_units,
      now,
      path.id,
    );

    await db.runAsync(
      `UPDATE scripture_checkpoint_sessions
       SET rolled_back_at = NULL
       WHERE checkpoint_id = ? AND rolled_back_at IS NOT NULL`,
      path.id,
    );
    changed = true;
  }

  return changed;
}

export async function getScriptureCheckpoint(kind: ScriptureCheckpointKind) {
  const checkpoints = await listScriptureCheckpoints([kind]);
  return checkpoints[0];
}

export async function getScriptureCheckpointById(id: string) {
  const db = await openScriptureCheckpointDb();
  const row = await db.getFirstAsync<CheckpointRow>(
    `SELECT p.id, p.kind, p.name, p.current_unit_index, p.total_units_read,
            p.created_at, p.updated_at,
            COALESCE(s.active_session_count, 0) AS active_session_count,
            COALESCE(s.rolled_back_session_count, 0) AS rolled_back_session_count
     FROM scripture_checkpoint_paths p
     LEFT JOIN (${checkpointSessionCountsSql()}) s ON s.checkpoint_id = p.id
     WHERE p.id = ?
     LIMIT 1`,
    id,
  );
  return row ? rowToCheckpoint(row) : undefined;
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
    `UPDATE scripture_checkpoint_paths
     SET current_unit_index = ?, total_units_read = 0, updated_at = ?
     WHERE id = ?`,
    index,
    now,
    defaultCheckpointId(kind),
  );

  return getScriptureCheckpoint(kind);
}

export async function updateScriptureCheckpointStart({
  checkpointId,
  kind,
  bookId,
  chapter,
  name,
}: {
  checkpointId: string;
  kind: ScriptureCheckpointKind;
  bookId: number;
  chapter: number;
  name?: string;
}) {
  const db = await openScriptureCheckpointDb();
  const units = UNITS_BY_KIND[kind];
  const index = units.findIndex(unit => unit.bookId === bookId && unit.chapter === chapter);
  if (index < 0) return null;

  const now = Date.now();
  await db.runAsync(
    `UPDATE scripture_checkpoint_paths
     SET name = ?, current_unit_index = ?, total_units_read = 0, updated_at = ?
     WHERE id = ? AND kind = ?`,
    normalizeCheckpointName(kind, name),
    index,
    now,
    checkpointId,
    kind,
  );

  return getScriptureCheckpointById(checkpointId);
}

export async function createScriptureCheckpoint({
  kind,
  name,
  bookId,
  chapter,
}: {
  kind: ScriptureCheckpointKind;
  name?: string;
  bookId: number;
  chapter: number;
}) {
  const db = await openScriptureCheckpointDb();
  const units = UNITS_BY_KIND[kind];
  const index = units.findIndex(unit => unit.bookId === bookId && unit.chapter === chapter);
  if (index < 0) return null;

  const now = Date.now();
  const id = checkpointPathId();
  await db.runAsync(
    `INSERT INTO scripture_checkpoint_paths (
      id, kind, name, current_unit_index, total_units_read, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 0, ?, ?)`,
    id,
    kind,
    normalizeCheckpointName(kind, name),
    index,
    now,
    now,
  );

  return getScriptureCheckpointById(id);
}

export async function deleteScriptureCheckpoint(checkpointId: string) {
  const db = await openScriptureCheckpointDb();
  const existing = await getScriptureCheckpointById(checkpointId);
  if (!existing) return false;

  await db.runAsync(
    'DELETE FROM scripture_checkpoint_sessions WHERE checkpoint_id = ?',
    checkpointId,
  );
  await db.runAsync(
    'DELETE FROM scripture_checkpoint_paths WHERE id = ?',
    checkpointId,
  );

  return true;
}

export async function getScriptureCheckpointReaderSession(
  checkpointId: string,
  plannedCount = 1,
): Promise<ScriptureCheckpointReaderSession | null> {
  const checkpoint = await getScriptureCheckpointById(checkpointId);
  if (!checkpoint) return null;

  const kind = checkpoint.kind;
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
  checkpointId,
  kind,
  readUnits,
  taskInstanceId,
  date,
}: {
  checkpointId?: string;
  kind?: ScriptureCheckpointKind;
  readUnits: number;
  taskInstanceId?: string;
  date?: string;
}): Promise<ScriptureCheckpointProgressResult | null> {
  const db = await openScriptureCheckpointDb();
  if (taskInstanceId) {
    const existing = await db.getFirstAsync<CheckpointSessionRow>(
      `SELECT id, checkpoint_id, kind, task_instance_id, date, previous_unit_index, previous_total_units_read,
              read_units, next_unit_index, created_at, rolled_back_at
       FROM scripture_checkpoint_sessions
       WHERE task_instance_id = ?
       LIMIT 1`,
      taskInstanceId,
    );
    if (existing && !existing.rolled_back_at) {
      const total = UNITS_BY_KIND[existing.kind].length;
      return {
        checkpointId: existing.checkpoint_id ?? defaultCheckpointId(existing.kind),
        kind: existing.kind,
        progressBefore: existing.previous_unit_index,
        progressAfter: existing.next_unit_index,
        progressTotal: total,
        readUnits: existing.read_units,
        completed: existing.next_unit_index >= total,
      };
    }
  }

  const checkpoint = checkpointId
    ? await getScriptureCheckpointById(checkpointId)
    : kind
      ? await getScriptureCheckpoint(kind)
      : undefined;
  if (!checkpoint) return null;
  const resolvedKind = checkpoint.kind;
  const units = UNITS_BY_KIND[resolvedKind];
  const previousIndex = clamp(checkpoint.unitIndex, 0, units.length);
  const remaining = Math.max(0, units.length - previousIndex);
  if (remaining <= 0) {
    return {
      checkpointId: checkpoint.id,
      kind: resolvedKind,
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
    `DELETE FROM scripture_checkpoint_sessions
     WHERE checkpoint_id = ? AND rolled_back_at IS NOT NULL`,
    checkpoint.id,
  );

  if (taskInstanceId) {
    await db.runAsync(
      `DELETE FROM scripture_checkpoint_sessions
       WHERE task_instance_id = ? AND rolled_back_at IS NOT NULL`,
      taskInstanceId,
    );
  }

  await db.runAsync(
    `INSERT OR REPLACE INTO scripture_checkpoint_sessions (
      id, checkpoint_id, kind, task_instance_id, date, previous_unit_index, previous_total_units_read,
      read_units, next_unit_index, created_at, rolled_back_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    nextId(),
    checkpoint.id,
    resolvedKind,
    taskInstanceId ?? null,
    date ?? null,
    previousIndex,
    checkpoint.totalUnitsRead,
    boundedReadUnits,
    nextIndex,
    now,
  );

  await db.runAsync(
    `UPDATE scripture_checkpoint_paths
     SET current_unit_index = ?, total_units_read = ?, updated_at = ?
     WHERE id = ?`,
    nextIndex,
    checkpoint.totalUnitsRead + boundedReadUnits,
    now,
    checkpoint.id,
  );

  return {
    checkpointId: checkpoint.id,
    kind: resolvedKind,
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
    `SELECT id, checkpoint_id, kind, task_instance_id, date, previous_unit_index, previous_total_units_read,
            read_units, next_unit_index, created_at, rolled_back_at
     FROM scripture_checkpoint_sessions
     WHERE task_instance_id = ? AND rolled_back_at IS NULL
     LIMIT 1`,
    taskInstanceId,
  );
  if (!session) return false;

  const checkpoint = session.checkpoint_id
    ? await getScriptureCheckpointById(session.checkpoint_id)
    : await getScriptureCheckpoint(session.kind);
  const now = Date.now();
  if (checkpoint && checkpoint.unitIndex === session.next_unit_index) {
    await db.runAsync(
      `UPDATE scripture_checkpoint_paths
       SET current_unit_index = ?, total_units_read = ?, updated_at = ?
       WHERE id = ?`,
      session.previous_unit_index,
      session.previous_total_units_read,
      now,
      checkpoint.id,
    );
  }

  await db.runAsync(
    'UPDATE scripture_checkpoint_sessions SET rolled_back_at = ? WHERE id = ?',
    now,
    session.id,
  );

  return true;
}

export async function moveScriptureCheckpointHistory(
  checkpointId: string,
  direction: ScriptureCheckpointHistoryDirection,
) {
  const db = await openScriptureCheckpointDb();
  const checkpoint = await getScriptureCheckpointById(checkpointId);
  if (!checkpoint) return null;

  const now = Date.now();

  if (direction === 'back') {
    const rolledBackCount = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM scripture_checkpoint_sessions
       WHERE checkpoint_id = ? AND rolled_back_at IS NOT NULL`,
      checkpointId,
    );
    if ((rolledBackCount?.count ?? 0) >= 3) return checkpoint;

    const session = await db.getFirstAsync<CheckpointSessionRow>(
      `SELECT id, checkpoint_id, kind, task_instance_id, date, previous_unit_index, previous_total_units_read,
              read_units, next_unit_index, created_at, rolled_back_at
       FROM scripture_checkpoint_sessions
       WHERE checkpoint_id = ? AND rolled_back_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      checkpointId,
    );
    if (!session) return checkpoint;

    await db.runAsync(
      `UPDATE scripture_checkpoint_paths
       SET current_unit_index = ?, total_units_read = ?, updated_at = ?
       WHERE id = ?`,
      session.previous_unit_index,
      session.previous_total_units_read,
      now,
      checkpointId,
    );

    await db.runAsync(
      'UPDATE scripture_checkpoint_sessions SET rolled_back_at = ? WHERE id = ?',
      now,
      session.id,
    );

    return getScriptureCheckpointById(checkpointId);
  }

  const session = await db.getFirstAsync<CheckpointSessionRow>(
    `SELECT id, checkpoint_id, kind, task_instance_id, date, previous_unit_index, previous_total_units_read,
            read_units, next_unit_index, created_at, rolled_back_at
     FROM scripture_checkpoint_sessions
     WHERE checkpoint_id = ? AND rolled_back_at IS NOT NULL
     ORDER BY created_at ASC
     LIMIT 1`,
    checkpointId,
  );
  if (!session) return checkpoint;

  await db.runAsync(
    `UPDATE scripture_checkpoint_paths
     SET current_unit_index = ?, total_units_read = ?, updated_at = ?
     WHERE id = ?`,
    session.next_unit_index,
    session.previous_total_units_read + session.read_units,
    now,
    checkpointId,
  );

  await db.runAsync(
    'UPDATE scripture_checkpoint_sessions SET rolled_back_at = NULL WHERE id = ?',
    session.id,
  );

  return getScriptureCheckpointById(checkpointId);
}

export function getBooksForCheckpointKind(kind: ScriptureCheckpointKind): BibleBook[] {
  const ids = [...new Set(UNITS_BY_KIND[kind].map(unit => unit.bookId))];
  return ids.map(id => getBibleBook(id)).filter((book): book is BibleBook => !!book);
}
