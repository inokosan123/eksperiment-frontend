import { openTaskDb, ensureTaskInstancesForDate, setTaskInstanceStatus } from '@/components/tasks/taskDb';
import { buildInstanceId, getLocalDateKey } from '@/components/tasks/taskScheduler';
import type {
  ReadingBook,
  ReadingCategoryDef,
  ReadingFrequency,
  ReadingNotificationMode,
  ReadingSession,
  ReadingStatus,
} from './ReadingListContext';

type ReadingBookRow = {
  id: string;
  title: string;
  author: string | null;
  category: string | null;
  status: ReadingStatus;
  created_at: number;
  started_at: number | null;
  finished_at: number | null;
  rating: number | null;
  review: string | null;
  key_lessons: string | null;
  show_on_home: number;
  task_time: string | null;
  task_frequency: ReadingFrequency | null;
  task_same_time_every_day: number;
  task_notification_mode: ReadingNotificationMode | null;
  task_reminder_minutes: number | null;
  sessions: number;
  total_minutes: number;
  last_session_at: number | null;
};

type ReadingSessionRow = {
  id: string;
  book_id: string;
  minutes: number;
  session_date: string;
  created_at: number;
};


export const DEFAULT_READING_CATEGORIES: ReadingCategoryDef[] = [
  { label: 'Spirituality', color: '#B8860B' },
  { label: 'Theology', color: '#92400E' },
  { label: 'Patristics', color: '#7C3AED' },
  { label: 'Prayer', color: '#C5A059' },
  { label: 'Philosophy', color: '#6D28D9' },
  { label: 'Psychology', color: '#DB2777' },
  { label: 'Biography', color: '#2563EB' },
  { label: 'Memoir', color: '#0F766E' },
  { label: 'History', color: '#B45309' },
  { label: 'Classic', color: '#1C1917' },
  { label: 'Literature', color: '#4338CA' },
  { label: 'Fiction', color: '#7C3AED' },
  { label: 'Poetry', color: '#9D174D' },
  { label: 'Self-Help', color: '#16A34A' },
  { label: 'Productivity', color: '#0891B2' },
  { label: 'Business', color: '#374151' },
  { label: 'Leadership', color: '#1D4ED8' },
  { label: 'Science', color: '#065F46' },
  { label: 'Health', color: '#DC2626' },
  { label: 'Nature', color: '#15803D' },
  { label: 'Art', color: '#7E22CE' },
  { label: 'Travel', color: '#0369A1' },
];

export const DEFAULT_READING_BOOKS: ReadingBook[] = [];

let initPromise: Promise<void> | null = null;

function boolToInt(value: boolean | undefined) {
  return value ? 1 : 0;
}

function intToBool(value: unknown) {
  return Number(value || 0) === 1;
}

function normalizeStatus(value: unknown): ReadingStatus {
  if (value === 'reading' || value === 'finished') return value;
  return 'to_read';
}

function normalizeFrequency(value: unknown): ReadingFrequency {
  if (
    value === 'weekdays' ||
    value === 'weekends' ||
    value === 'specific_days' ||
    value === 'monthly'
  ) {
    return value;
  }
  return 'daily';
}

function normalizeNotificationMode(value: unknown): ReadingNotificationMode {
  if (value === 'single' || value === 'double') return value;
  return 'none';
}

function rowToBook(
  row: ReadingBookRow,
  selectedDays: number[],
  monthlyDays: number[],
  dayTimes: Record<number, string>,
): ReadingBook {
  return {
    id: row.id,
    title: row.title,
    author: row.author ?? undefined,
    category: row.category ?? undefined,
    status: normalizeStatus(row.status),
    createdAt: row.created_at,
    startedAt: row.started_at ?? undefined,
    finishedAt: row.finished_at ?? undefined,
    rating: row.rating ?? undefined,
    review: row.review ?? undefined,
    keyLessons: row.key_lessons ?? undefined,
    showOnHome: intToBool(row.show_on_home),
    taskTime: row.task_time ?? '21:00',
    taskFrequency: normalizeFrequency(row.task_frequency),
    taskSelectedDays: selectedDays,
    taskMonthlyDays: monthlyDays.length ? monthlyDays : [1],
    taskSameTimeEveryDay: intToBool(row.task_same_time_every_day),
    taskDayTimes: dayTimes,
    taskNotificationMode: normalizeNotificationMode(row.task_notification_mode),
    taskReminderMinutes: row.task_reminder_minutes ?? 15,
    sessions: row.sessions,
    totalMinutes: row.total_minutes,
    lastSessionAt: row.last_session_at ?? undefined,
  };
}

function rowToSession(row: ReadingSessionRow): ReadingSession {
  return {
    id: row.id,
    bookId: row.book_id,
    minutes: row.minutes,
    sessionDate: row.session_date,
    createdAt: row.created_at,
  };
}

export function readingTaskId(bookId: string) {
  return `reading_book_${bookId}`;
}

async function initReadingListDb() {
  if (!initPromise) {
    initPromise = (async () => {
      const db = await openTaskDb();
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS reading_books (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          author TEXT,
          category TEXT,
          status TEXT NOT NULL DEFAULT 'to_read',
          created_at INTEGER NOT NULL,
          started_at INTEGER,
          finished_at INTEGER,
          rating INTEGER,
          review TEXT,
          key_lessons TEXT,
          show_on_home INTEGER NOT NULL DEFAULT 0,
          task_time TEXT,
          task_frequency TEXT,
          task_same_time_every_day INTEGER NOT NULL DEFAULT 1,
          task_notification_mode TEXT,
          task_reminder_minutes INTEGER,
          sessions INTEGER NOT NULL DEFAULT 0,
          total_minutes INTEGER NOT NULL DEFAULT 0,
          last_session_at INTEGER,
          archived_at INTEGER,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS reading_book_task_selected_days (
          book_id TEXT NOT NULL,
          day_index INTEGER NOT NULL,
          PRIMARY KEY (book_id, day_index)
        );

        CREATE TABLE IF NOT EXISTS reading_book_task_monthly_days (
          book_id TEXT NOT NULL,
          month_day INTEGER NOT NULL,
          PRIMARY KEY (book_id, month_day)
        );

        CREATE TABLE IF NOT EXISTS reading_book_task_day_times (
          book_id TEXT NOT NULL,
          day_index INTEGER NOT NULL,
          time TEXT NOT NULL,
          PRIMARY KEY (book_id, day_index)
        );

        CREATE TABLE IF NOT EXISTS reading_sessions (
          id TEXT PRIMARY KEY,
          book_id TEXT NOT NULL,
          minutes INTEGER NOT NULL,
          session_date TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS reading_categories (
          color TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          sort_order INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_reading_books_status ON reading_books(status, archived_at);
        CREATE INDEX IF NOT EXISTS idx_reading_books_created ON reading_books(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_reading_sessions_book_date ON reading_sessions(book_id, session_date);
      `);

      await seedReadingListIfNeeded();
      await syncReadingTaskFlags();
    })();
  }

  return initPromise;
}

async function replaceNumberRows(
  table: string,
  column: string,
  bookId: string,
  values: number[],
) {
  const db = await openTaskDb();
  await db.runAsync(`DELETE FROM ${table} WHERE book_id = ?`, bookId);
  for (const value of [...new Set(values)].sort((a, b) => a - b)) {
    await db.runAsync(
      `INSERT OR REPLACE INTO ${table} (book_id, ${column}) VALUES (?, ?)`,
      bookId,
      value,
    );
  }
}

async function replaceDayTimes(bookId: string, values: Record<number, string>) {
  const db = await openTaskDb();
  await db.runAsync('DELETE FROM reading_book_task_day_times WHERE book_id = ?', bookId);
  for (const [dayIndex, time] of Object.entries(values)) {
    await db.runAsync(
      'INSERT OR REPLACE INTO reading_book_task_day_times (book_id, day_index, time) VALUES (?, ?, ?)',
      bookId,
      Number(dayIndex),
      time,
    );
  }
}

async function seedReadingListIfNeeded() {
  const db = await openTaskDb();
  const categoryCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM reading_categories',
  );

  if (!categoryCount?.count) {
    await persistReadingCategories(DEFAULT_READING_CATEGORIES);
  }

  // One-time cleanup: remove the legacy demo books that earlier builds seeded
  // into the user database. They would otherwise persist forever even after
  // the seed code was removed. Safe to run repeatedly — DELETE on missing rows
  // is a no-op.
  await db.runAsync(
    "DELETE FROM reading_sessions WHERE id IN ('seed_session_book_1','seed_session_book_2','seed_session_book_3')",
  );
  await db.runAsync(
    "DELETE FROM reading_books WHERE id IN ('book_1','book_2','book_3')",
  );
}

async function syncReadingTaskFlags() {
  const db = await openTaskDb();
  await db.runAsync(`
    UPDATE reading_books
    SET show_on_home = 0,
        updated_at = ?
    WHERE show_on_home = 1
      AND (
        status <> 'reading'
        OR NOT EXISTS (
          SELECT 1
          FROM tasks
          WHERE tasks.id = 'reading_book_' || reading_books.id
            AND tasks.status = 'active'
            AND tasks.removed_at IS NULL
        )
      )
  `, Date.now());
}

async function loadNumberMap(table: string, column: string) {
  const db = await openTaskDb();
  const rows = await db.getAllAsync<{ book_id: string; value: number }>(
    `SELECT book_id, ${column} AS value FROM ${table} ORDER BY value ASC`,
  );
  const map = new Map<string, number[]>();
  for (const row of rows) {
    map.set(row.book_id, [...(map.get(row.book_id) ?? []), row.value]);
  }
  return map;
}

async function loadDayTimesMap() {
  const db = await openTaskDb();
  const rows = await db.getAllAsync<{ book_id: string; day_index: number; time: string }>(
    'SELECT book_id, day_index, time FROM reading_book_task_day_times',
  );
  const map = new Map<string, Record<number, string>>();
  for (const row of rows) {
    map.set(row.book_id, {
      ...(map.get(row.book_id) ?? {}),
      [row.day_index]: row.time,
    });
  }
  return map;
}

export async function listReadingBooks() {
  await initReadingListDb();
  const db = await openTaskDb();
  const [rows, selectedDays, monthlyDays, dayTimes] = await Promise.all([
    db.getAllAsync<ReadingBookRow>(
      `SELECT * FROM reading_books
       WHERE archived_at IS NULL
       ORDER BY created_at DESC`,
    ),
    loadNumberMap('reading_book_task_selected_days', 'day_index'),
    loadNumberMap('reading_book_task_monthly_days', 'month_day'),
    loadDayTimesMap(),
  ]);

  return rows.map(row => rowToBook(
    row,
    selectedDays.get(row.id) ?? [],
    monthlyDays.get(row.id) ?? [1],
    dayTimes.get(row.id) ?? {},
  ));
}

export async function listReadingSessions() {
  await initReadingListDb();
  const db = await openTaskDb();
  const rows = await db.getAllAsync<ReadingSessionRow>(
    'SELECT id, book_id, minutes, session_date, created_at FROM reading_sessions ORDER BY created_at DESC',
  );
  return rows.map(rowToSession);
}

async function persistReadingBook(book: ReadingBook) {
  const db = await openTaskDb();
  const now = Date.now();
  const status = normalizeStatus(book.status);
  const showOnHome = status === 'reading' && !!book.showOnHome;

  await db.runAsync(
    `INSERT INTO reading_books (
      id, title, author, category, status, created_at, started_at, finished_at,
      rating, review, key_lessons, show_on_home, task_time, task_frequency,
      task_same_time_every_day, task_notification_mode, task_reminder_minutes,
      sessions, total_minutes, last_session_at, archived_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      author = excluded.author,
      category = excluded.category,
      status = excluded.status,
      started_at = excluded.started_at,
      finished_at = excluded.finished_at,
      rating = excluded.rating,
      review = excluded.review,
      key_lessons = excluded.key_lessons,
      show_on_home = excluded.show_on_home,
      task_time = excluded.task_time,
      task_frequency = excluded.task_frequency,
      task_same_time_every_day = excluded.task_same_time_every_day,
      task_notification_mode = excluded.task_notification_mode,
      task_reminder_minutes = excluded.task_reminder_minutes,
      sessions = excluded.sessions,
      total_minutes = excluded.total_minutes,
      last_session_at = excluded.last_session_at,
      archived_at = NULL,
      updated_at = excluded.updated_at`,
    book.id,
    book.title.trim() || 'Untitled Book',
    book.author?.trim() || null,
    book.category?.trim() || null,
    status,
    book.createdAt || now,
    book.startedAt ?? null,
    book.finishedAt ?? null,
    book.rating ?? null,
    book.review ?? null,
    book.keyLessons ?? null,
    boolToInt(showOnHome),
    book.taskTime ?? '21:00',
    normalizeFrequency(book.taskFrequency),
    boolToInt(book.taskSameTimeEveryDay !== false),
    normalizeNotificationMode(book.taskNotificationMode),
    book.taskNotificationMode === 'double' ? book.taskReminderMinutes ?? 15 : book.taskReminderMinutes ?? 15,
    Math.max(0, book.sessions ?? 0),
    Math.max(0, book.totalMinutes ?? 0),
    book.lastSessionAt ?? null,
    now,
  );

  await replaceNumberRows(
    'reading_book_task_selected_days',
    'day_index',
    book.id,
    book.taskFrequency === 'specific_days' ? book.taskSelectedDays ?? [] : book.taskSelectedDays ?? [],
  );
  await replaceNumberRows(
    'reading_book_task_monthly_days',
    'month_day',
    book.id,
    book.taskFrequency === 'monthly' ? book.taskMonthlyDays ?? [1] : book.taskMonthlyDays ?? [1],
  );
  await replaceDayTimes(
    book.id,
    book.taskSameTimeEveryDay === false ? book.taskDayTimes ?? {} : {},
  );
}

export async function saveReadingBook(book: ReadingBook) {
  await initReadingListDb();
  await persistReadingBook(book);
}

export async function deleteReadingBook(bookId: string) {
  await initReadingListDb();
  const db = await openTaskDb();
  await db.runAsync('UPDATE reading_books SET archived_at = ?, show_on_home = 0, updated_at = ? WHERE id = ?', Date.now(), Date.now(), bookId);
  await db.runAsync('DELETE FROM reading_book_task_selected_days WHERE book_id = ?', bookId);
  await db.runAsync('DELETE FROM reading_book_task_monthly_days WHERE book_id = ?', bookId);
  await db.runAsync('DELETE FROM reading_book_task_day_times WHERE book_id = ?', bookId);
}

export async function recordReadingSession(
  bookId: string | null,
  minutes: number,
  sessionDate?: string,
  options?: { completeTask?: boolean },
) {
  if (!bookId || minutes <= 0) return;

  await initReadingListDb();
  const db = await openTaskDb();
  const now = Date.now();
  const targetDate = sessionDate ?? getLocalDateKey(new Date(now));
  const cleanMinutes = Math.max(1, Math.round(minutes));

  await db.withExclusiveTransactionAsync(async transaction => {
    await transaction.runAsync(
      `INSERT INTO reading_sessions (id, book_id, minutes, session_date, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      `reading_session_${now}_${Math.random().toString(36).slice(2, 8)}`,
      bookId,
      cleanMinutes,
      targetDate,
      now,
    );

    await transaction.runAsync(
      `UPDATE reading_books
       SET sessions = sessions + 1,
           total_minutes = total_minutes + ?,
           last_session_at = ?,
           status = CASE WHEN status = 'to_read' THEN 'reading' ELSE status END,
           started_at = COALESCE(started_at, ?),
           updated_at = ?
       WHERE id = ? AND archived_at IS NULL`,
      cleanMinutes,
      now,
      now,
      now,
      bookId,
    );
  });

  if (options?.completeTask !== false) {
    await ensureTaskInstancesForDate(targetDate, new Date(now));
    await setTaskInstanceStatus(buildInstanceId(readingTaskId(bookId), targetDate), 'completed');
  }
}

export async function syncReadingTaskCompletionsFromSessions(fromDate: string, toDate: string) {
  await initReadingListDb();
  const db = await openTaskDb();
  const rows = await db.getAllAsync<{ book_id: string; session_date: string }>(
    `SELECT book_id, session_date
     FROM reading_sessions
     WHERE session_date >= ? AND session_date <= ?
     GROUP BY book_id, session_date`,
    fromDate,
    toDate,
  );

  let changed = 0;
  for (const row of rows) {
    const updated = await setTaskInstanceStatus(
      buildInstanceId(readingTaskId(row.book_id), row.session_date),
      'completed',
    );
    if (updated) changed += 1;
  }
  return changed;
}

export async function listReadingCategories() {
  await initReadingListDb();
  const db = await openTaskDb();
  const rows = await db.getAllAsync<ReadingCategoryDef & { sort_order: number }>(
    'SELECT label, color, sort_order FROM reading_categories ORDER BY sort_order ASC',
  );
  return rows.length ? rows.map(({ label, color }) => ({ label, color })) : DEFAULT_READING_CATEGORIES;
}

async function persistReadingCategories(categories: ReadingCategoryDef[]) {
  const db = await openTaskDb();
  await db.runAsync('DELETE FROM reading_categories');
  for (const [index, category] of categories.entries()) {
    await db.runAsync(
      'INSERT OR REPLACE INTO reading_categories (color, label, sort_order) VALUES (?, ?, ?)',
      category.color,
      category.label.trim() || DEFAULT_READING_CATEGORIES[index]?.label || 'Tag',
      index,
    );
  }
}

export async function saveReadingCategories(categories: ReadingCategoryDef[]) {
  await initReadingListDb();
  await persistReadingCategories(categories);
}

export async function loadReadingListSnapshot() {
  await initReadingListDb();
  const [books, sessions, categoryDefs] = await Promise.all([
    listReadingBooks(),
    listReadingSessions(),
    listReadingCategories(),
  ]);
  return { books, sessions, categoryDefs };
}
