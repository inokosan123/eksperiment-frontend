import * as SQLite from 'expo-sqlite';
import { openUserContentDb } from '@/data/userContentDb';

export type FocusSessionRecord = {
  id: string;
  date: string;
  duration: number;
  completedAt: number;
};

function rowToFocusSession(row: Record<string, unknown>): FocusSessionRecord {
  return {
    id: String(row.id),
    date: String(row.date ?? ''),
    duration: Number(row.duration_minutes ?? 0),
    completedAt: Number(row.completed_at ?? 0),
  };
}

async function initFocusDb(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS focus_sessions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      completed_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_focus_sessions_date
      ON focus_sessions(date);

    CREATE TABLE IF NOT EXISTS focus_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

async function getReadyDb() {
  const db = await openUserContentDb();
  await initFocusDb(db);
  return db;
}

export async function logFocusSession(
  id: string,
  date: string,
  durationMinutes: number,
  completedAt: number,
) {
  const db = await getReadyDb();
  await db.runAsync(
    `INSERT OR IGNORE INTO focus_sessions
      (id, date, duration_minutes, completed_at)
     VALUES (?, ?, ?, ?)`,
    id,
    date,
    durationMinutes,
    completedAt,
  );
}

export async function getAllFocusSessions() {
  const db = await getReadyDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM focus_sessions ORDER BY completed_at ASC',
  );
  return rows.map(rowToFocusSession);
}
