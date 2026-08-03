import * as SQLite from 'expo-sqlite';
import { USER_CONTENT_DB_NAME } from '@/constants/userDatabase';

let userContentDbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function openUserContentDb() {
  if (!userContentDbPromise) {
    userContentDbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(USER_CONTENT_DB_NAME);
      // Connection pragmas belong to connection startup. Re-running
      // `journal_mode` from a nested challenge/task transaction can fail on a
      // real phone and leave the two stores out of sync.
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA foreign_keys = ON;');
      return db;
    })().catch(error => {
      userContentDbPromise = null;
      throw error;
    });
  }
  return userContentDbPromise;
}

export async function initJournalStoreTable(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS journal_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

export function parseStoredJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value.trim()) return fallback;

  try {
    const parsed = JSON.parse(value) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export async function getStoredJson<T>(
  db: SQLite.SQLiteDatabase,
  key: string,
  fallback: T,
) {
  await initJournalStoreTable(db);
  const rows = await db.getAllAsync<{ value: string }>(
    'SELECT value FROM journal_store WHERE key = ? LIMIT 1',
    key,
  );

  if (!rows.length) return fallback;
  return parseStoredJson(rows[0].value, fallback);
}

export async function saveStoredJson<T>(
  db: SQLite.SQLiteDatabase,
  key: string,
  value: T,
) {
  await initJournalStoreTable(db);
  await db.runAsync(
    'INSERT OR REPLACE INTO journal_store (key, value) VALUES (?, ?)',
    key,
    JSON.stringify(value),
  );
}
