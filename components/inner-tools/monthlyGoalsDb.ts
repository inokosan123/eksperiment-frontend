import * as SQLite from 'expo-sqlite';
import { openUserContentDb } from '@/data/userContentDb';

export type MonthlyGoal = {
  id: string;
  month: string; // 'YYYY-MM'
  text: string;
  isCompleted: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

type GoalRow = {
  id: string;
  month: string;
  text: string;
  is_completed: number;
  sort_order: number;
  created_at: number;
  updated_at: number;
};

let initPromise: Promise<void> | null = null;

async function ensureSchema(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS monthly_goals (
      id TEXT PRIMARY KEY,
      month TEXT NOT NULL,
      text TEXT NOT NULL,
      is_completed INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_monthly_goals_month ON monthly_goals(month);
  `);
}

export async function initMonthlyGoalsDb(db?: SQLite.SQLiteDatabase) {
  if (!initPromise) {
    initPromise = (async () => {
      const conn = db ?? await openUserContentDb();
      await ensureSchema(conn);
    })();
  }
  await initPromise;
}

function rowToGoal(row: GoalRow): MonthlyGoal {
  return {
    id: row.id,
    month: row.month,
    text: row.text,
    isCompleted: row.is_completed === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listMonthlyGoals(): Promise<MonthlyGoal[]> {
  await initMonthlyGoalsDb();
  const db = await openUserContentDb();
  const rows = await db.getAllAsync<GoalRow>(
    'SELECT id, month, text, is_completed, sort_order, created_at, updated_at FROM monthly_goals ORDER BY month ASC, sort_order ASC, created_at ASC',
  );
  return rows.map(rowToGoal);
}

export async function upsertMonthlyGoal(goal: MonthlyGoal): Promise<MonthlyGoal> {
  await initMonthlyGoalsDb();
  const db = await openUserContentDb();
  const now = Date.now();
  const next: MonthlyGoal = { ...goal, updatedAt: now, createdAt: goal.createdAt || now };
  await db.runAsync(
    `INSERT INTO monthly_goals (id, month, text, is_completed, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       month = excluded.month,
       text = excluded.text,
       is_completed = excluded.is_completed,
       sort_order = excluded.sort_order,
       updated_at = excluded.updated_at`,
    [
      next.id,
      next.month,
      next.text,
      next.isCompleted ? 1 : 0,
      next.sortOrder,
      next.createdAt,
      next.updatedAt,
    ],
  );
  return next;
}

export async function deleteMonthlyGoal(id: string): Promise<void> {
  await initMonthlyGoalsDb();
  const db = await openUserContentDb();
  await db.runAsync('DELETE FROM monthly_goals WHERE id = ?', [id]);
}
