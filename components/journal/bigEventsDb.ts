import * as SQLite from 'expo-sqlite';
import { openUserContentDb } from '@/data/userContentDb';
import {
  BIG_EVENT_DEFAULT_LEAD_DAYS,
  normalizeBigEventLeadDays,
  type BigEventRecurrence,
} from './bigEventsConfig';

export type { BigEventRecurrence } from './bigEventsConfig';

export type BigEvent = {
  id: string;
  title: string;
  startDate: string;          // 'YYYY-MM-DD' — countdown starts showing
  endDate: string;            // 'YYYY-MM-DD' — target/event date
  color: string;
  icon: string;
  recurrence: BigEventRecurrence;
  leadDays: number;
  remindersEnabled: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: string | null;   // 'YYYY-MM-DD' soft-delete; hidden from this date onward
};

function rowToBigEvent(row: Record<string, unknown>): BigEvent {
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    startDate: String(row.start_date ?? ''),
    endDate: String(row.end_date ?? ''),
    color: String(row.color ?? '#C5A059'),
    icon: String(row.icon ?? ''),
    recurrence: row.recurrence === 'yearly' ? 'yearly' : 'none',
    leadDays: normalizeBigEventLeadDays(
      Number(row.lead_days ?? BIG_EVENT_DEFAULT_LEAD_DAYS),
      row.recurrence === 'yearly' ? 'yearly' : 'none',
    ),
    remindersEnabled: Number(row.reminders_enabled ?? 0) === 1,
    createdAt: Number(row.created_at ?? 0),
    updatedAt: Number(row.updated_at ?? 0),
    deletedAt: row.deleted_at != null ? String(row.deleted_at) : null,
  };
}

async function initBigEventsTable(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS big_events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      color TEXT NOT NULL,
      icon TEXT,
      recurrence TEXT NOT NULL DEFAULT 'none',
      lead_days INTEGER NOT NULL DEFAULT 0,
      reminders_enabled INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_big_events_end_date
      ON big_events(end_date);
  `);

  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(big_events)');
  const names = new Set(columns.map(column => column.name));
  if (!names.has('recurrence')) {
    await db.execAsync("ALTER TABLE big_events ADD COLUMN recurrence TEXT NOT NULL DEFAULT 'none'");
  }
  if (!names.has('lead_days')) {
    await db.execAsync('ALTER TABLE big_events ADD COLUMN lead_days INTEGER NOT NULL DEFAULT 0');
  }
  if (!names.has('reminders_enabled')) {
    await db.execAsync('ALTER TABLE big_events ADD COLUMN reminders_enabled INTEGER NOT NULL DEFAULT 0');
  }
}

async function getReadyDb() {
  const db = await openUserContentDb();
  await initBigEventsTable(db);
  return db;
}

export async function loadAllBigEvents(): Promise<BigEvent[]> {
  const db = await getReadyDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM big_events ORDER BY end_date ASC, created_at ASC',
  );
  return rows.map(rowToBigEvent);
}

export async function insertBigEvent(event: BigEvent) {
  const db = await getReadyDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO big_events
      (id, title, start_date, end_date, color, icon, recurrence, lead_days,
       reminders_enabled, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    event.id,
    event.title,
    event.startDate,
    event.endDate,
    event.color,
    event.icon,
    event.recurrence,
    normalizeBigEventLeadDays(event.leadDays, event.recurrence),
    event.remindersEnabled ? 1 : 0,
    event.createdAt,
    event.updatedAt,
    event.deletedAt,
  );
}

export async function updateBigEventRow(event: BigEvent) {
  const db = await getReadyDb();
  await db.runAsync(
    `UPDATE big_events
       SET title = ?, start_date = ?, end_date = ?, color = ?, icon = ?,
           recurrence = ?, lead_days = ?, reminders_enabled = ?,
           updated_at = ?, deleted_at = ?
     WHERE id = ?`,
    event.title,
    event.startDate,
    event.endDate,
    event.color,
    event.icon,
    event.recurrence,
    normalizeBigEventLeadDays(event.leadDays, event.recurrence),
    event.remindersEnabled ? 1 : 0,
    event.updatedAt,
    event.deletedAt,
    event.id,
  );
}

export async function hardDeleteBigEvent(id: string) {
  const db = await getReadyDb();
  await db.runAsync('DELETE FROM big_events WHERE id = ?', id);
}
