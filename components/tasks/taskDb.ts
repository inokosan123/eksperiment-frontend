import * as SQLite from 'expo-sqlite';
import { openUserContentDb } from '@/data/userContentDb';
import type {
  ChallengeTaskConfig,
  HabitTaskConfig,
  JournalTaskConfig,
  PrayerTaskConfig,
  QuickTaskConfig,
  ReadingBookTaskConfig,
  ScriptureTaskConfig,
  TaskDefinition,
  TaskDraft,
  TaskFrequency,
  TaskInstance,
  TaskInstanceStatus,
  TaskLaunchConfigBundle,
  TaskLifecycleStatus,
  TaskSchedule,
} from '@/components/tasks/taskTypes';
import {
  addDays,
  buildTaskInstance,
  getEffectiveTaskTime,
  getDateFromLocalKey,
  getLocalDateKey,
  parseTaskTimeToDate,
  scheduleMatchesDate,
  shouldMarkMissed,
  isTaskInstanceLocked,
} from '@/components/tasks/taskScheduler';

type TaskRow = {
  id: string;
  title: string;
  subtitle: string | null;
  level: number;
  source: TaskDefinition['source'];
  type: TaskDefinition['type'];
  icon: string | null;
  habit_color: string | null;
  target_view: string | null;
  target_tab: string | null;
  status: TaskLifecycleStatus;
  frequency: TaskFrequency;
  time: string;
  same_time_every_day: number;
  notification_mode: TaskDefinition['notificationMode'];
  reminder_minutes: number | null;
  created_at: number;
  activated_at: number;
  paused_at: string | null;
  removed_at: string | null;
};

type InstanceRow = {
  id: string;
  task_id: string;
  date: string;
  time: string;
  status: TaskInstanceStatus;
  locked: number;
  title: string;
  subtitle: string | null;
  level: number;
  source: TaskDefinition['source'];
  type: TaskDefinition['type'];
  icon: string | null;
  habit_color: string | null;
  target_view: string | null;
  target_tab: string | null;
  created_at: number;
  resolved_at: number | null;
};

type ActivePeriodRow = {
  task_id: string;
  start_date: string;
  end_date: string | null;
  activated_at: number;
};

type PrayerConfigRow = {
  task_id: string;
  prayer_type: string | null;
  prayer_rule: string | null;
  prayer_task_kind: string | null;
  jesus_prayer_mode: string | null;
  jesus_prayer_duration: number | null;
  jesus_prayer_count: number | null;
};

type ScriptureConfigRow = {
  task_id: string;
  reading_type: ScriptureTaskConfig['readingType'];
  start_book_id: number | null;
  start_chapter: number | null;
  chapters_per_day: number | null;
  total_units_read: number | null;
};

type JournalConfigRow = {
  task_id: string;
  journal_type: JournalTaskConfig['journalType'];
  technique: string | null;
};

type TaskLaunchConfigRow = PrayerConfigRow & Partial<ScriptureConfigRow> & Partial<JournalConfigRow> & {
  reading_book_id: string | null;
};

let initPromise: Promise<void> | null = null;

const LEGACY_DEMO_HABIT_TASK_IDS = [
  'habit_habit_1_h1s1',
  'habit_habit_1_h1s2',
  'habit_habit_2_h2s1',
  'habit_habit_2_h2s2',
  'habit_habit_3_h3s1',
];

export const TASK_INSTANCE_HORIZON_DAYS = 120;
const TASK_INSTANCE_GAP_FILL_DAYS = 120;

function boolToInt(value: boolean) {
  return value ? 1 : 0;
}

async function ensureColumn(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  definition: string,
) {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (rows.some(row => row.name === column)) return;
  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

async function ensureTaskNotificationColumns(db: SQLite.SQLiteDatabase) {
  await ensureColumn(db, 'task_notifications', 'instance_id', 'TEXT');
  await ensureColumn(db, 'task_notifications', 'native_id', 'TEXT');
  await ensureColumn(db, 'task_notifications', 'route', 'TEXT');
  await ensureColumn(db, 'task_notifications', 'source', 'TEXT');
  await ensureColumn(db, 'task_notifications', 'type', 'TEXT');
  await ensureColumn(db, 'task_notifications', 'payload_json', 'TEXT');
  await ensureColumn(db, 'task_notifications', 'status', "TEXT NOT NULL DEFAULT 'scheduled'");
}

function intToBool(value: unknown) {
  return Number(value || 0) === 1;
}

function nextId(prefix = 'task') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultSchedule(): TaskSchedule {
  return {
    frequency: 'daily',
    selectedDays: [],
    monthlyDays: [1],
    time: '08:00',
    sameTimeEveryDay: true,
    dayTimes: {},
  };
}

function inferScriptureReadingTypeForTask(title: string, subtitle?: string | null): ScriptureTaskConfig['readingType'] {
  const label = `${title} ${subtitle ?? ''}`.toLowerCase();
  if (label.includes('church') || label.includes('lectionary')) return 'church_calendar';
  if (label.includes('psalter') || label.includes('psalm')) return 'psalter';
  if (label.includes('old testament')) return 'old_testament';
  if (label.includes('new testament')) return 'new_testament';
  return 'custom';
}

function inferScriptureChaptersPerDayForTask(
  title: string,
  subtitle: string | null | undefined,
  readingType: ScriptureTaskConfig['readingType'],
) {
  if (readingType === 'church_calendar') return 0;
  const label = `${title} ${subtitle ?? ''}`;
  const match = label.match(/\b(\d{1,2})\s*(?:chapter|chapters|psalm|psalms)\b/i)
    ?? label.match(/\b(?:chapter|chapters|psalm|psalms)\s*(?:per\s*day|\/day)?\D{0,8}(\d{1,2})\b/i);
  const parsed = Number.parseInt(match?.[1] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 1;
}

async function repairMissingScriptureTaskConfigs(db: SQLite.SQLiteDatabase) {
  const missingRows = await db.getAllAsync<{ id: string; title: string; subtitle: string | null }>(
    `SELECT t.id, t.title, t.subtitle
     FROM tasks t
     LEFT JOIN task_scripture_config c ON c.task_id = t.id
     WHERE c.task_id IS NULL
       AND t.source = 'spiritual'
       AND t.type = 'reading'`,
  );

  for (const row of missingRows) {
    const readingType = inferScriptureReadingTypeForTask(row.title, row.subtitle);
    await db.runAsync(
      `INSERT OR IGNORE INTO task_scripture_config (
        task_id, reading_type, start_book_id, start_chapter, chapters_per_day, total_units_read
      ) VALUES (?, ?, NULL, NULL, ?, 0)`,
      row.id,
      readingType,
      inferScriptureChaptersPerDayForTask(row.title, row.subtitle, readingType),
    );
  }
}

function normalizeSchedule(schedule: TaskSchedule): TaskSchedule {
  return {
    ...defaultSchedule(),
    ...schedule,
    selectedDays: schedule.selectedDays ?? [],
    monthlyDays: schedule.monthlyDays?.length ? schedule.monthlyDays : [1],
    dayTimes: schedule.dayTimes ?? {},
  };
}

function sortedNumbers(values: number[]) {
  return [...values].sort((a, b) => a - b);
}

function numberListsEqual(a: number[], b: number[]) {
  const left = sortedNumbers(a);
  const right = sortedNumbers(b);
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function dayTimesEqual(a: Record<number, string>, b: Record<number, string>) {
  const leftKeys = Object.keys(a).map(Number).sort((left, right) => left - right);
  const rightKeys = Object.keys(b).map(Number).sort((left, right) => left - right);
  return numberListsEqual(leftKeys, rightKeys)
    && leftKeys.every(key => a[key] === b[key]);
}

function schedulesEqual(a: TaskSchedule, b: TaskSchedule) {
  return a.frequency === b.frequency
    && a.time === b.time
    && a.sameTimeEveryDay === b.sameTimeEveryDay
    && numberListsEqual(a.selectedDays, b.selectedDays)
    && numberListsEqual(a.monthlyDays, b.monthlyDays)
    && dayTimesEqual(a.dayTimes, b.dayTimes);
}

function nextActivatedAt(
  draft: TaskDraft,
  existing: TaskDefinition | undefined,
  schedule: TaskSchedule,
  now: number,
) {
  if (draft.activatedAt !== undefined) return draft.activatedAt;
  if (!existing) return now;

  const nextStatus = draft.status ?? 'active';
  if (nextStatus !== 'active') return existing.activatedAt;
  if (existing.status !== 'active') return now;
  if (!schedulesEqual(existing.schedule, schedule)) return now;

  return existing.activatedAt;
}

function normalizeDraft(draft: TaskDraft, existing?: TaskDefinition): TaskDefinition {
  const now = Date.now();
  const id = draft.id || nextId();
  const schedule = normalizeSchedule(draft.schedule);

  return {
    id,
    title: draft.title.trim() || 'Untitled Task',
    subtitle: draft.subtitle,
    level: draft.level,
    source: draft.source,
    type: draft.type,
    icon: draft.icon,
    habitColor: draft.habitColor,
    targetView: draft.targetView,
    targetTab: draft.targetTab,
    status: draft.status ?? 'active',
    schedule,
    notificationMode: draft.notificationMode,
    reminderMinutes: draft.notificationMode === 'double' ? draft.reminderMinutes : undefined,
    createdAt: draft.createdAt ?? existing?.createdAt ?? now,
    activatedAt: nextActivatedAt(draft, existing, schedule, now),
    pausedAt: draft.pausedAt,
    removedAt: draft.removedAt,
    quickConfig: draft.quickConfig ? { taskId: id, ...draft.quickConfig } : undefined,
  };
}

function nullableText(value?: string | null) {
  return value ?? null;
}

function taskDisplayTextChanged(existing: TaskDefinition, next: TaskDefinition) {
  return existing.title !== next.title
    || nullableText(existing.subtitle) !== nullableText(next.subtitle);
}

async function refreshTaskDisplaySnapshotsFromDate(
  db: SQLite.SQLiteDatabase,
  task: TaskDefinition,
  fromDate: string,
) {
  await db.runAsync(
    `UPDATE task_instances
     SET title = ?,
         subtitle = ?
     WHERE task_id = ?
       AND date >= ?
       AND status <> 'not_applicable'`,
    task.title,
    task.subtitle ?? null,
    task.id,
    fromDate,
  );
}

export async function openTaskDb() {
  const db = await openUserContentDb();
  await initTaskDb(db);
  return db;
}

export async function initTaskDb(db?: SQLite.SQLiteDatabase) {
  if (!initPromise) {
    initPromise = (async () => {
      const conn = db ?? await openUserContentDb();
      await conn.execAsync(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          subtitle TEXT,
          level INTEGER NOT NULL,
          source TEXT NOT NULL,
          type TEXT NOT NULL,
          icon TEXT,
          habit_color TEXT,
          target_view TEXT,
          target_tab TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          frequency TEXT NOT NULL DEFAULT 'daily',
          time TEXT NOT NULL DEFAULT '08:00',
          same_time_every_day INTEGER NOT NULL DEFAULT 1,
          notification_mode TEXT NOT NULL DEFAULT 'none',
          reminder_minutes INTEGER,
          created_at INTEGER NOT NULL,
          activated_at INTEGER NOT NULL,
          paused_at TEXT,
          removed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS task_schedule_days (
          task_id TEXT NOT NULL,
          day_index INTEGER NOT NULL,
          PRIMARY KEY (task_id, day_index),
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS task_schedule_month_days (
          task_id TEXT NOT NULL,
          month_day INTEGER NOT NULL,
          PRIMARY KEY (task_id, month_day),
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS task_day_times (
          task_id TEXT NOT NULL,
          day_index INTEGER NOT NULL,
          time TEXT NOT NULL,
          PRIMARY KEY (task_id, day_index),
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS task_instances (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          date TEXT NOT NULL,
          time TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          locked INTEGER NOT NULL DEFAULT 0,
          title TEXT NOT NULL,
          subtitle TEXT,
          level INTEGER NOT NULL,
          source TEXT NOT NULL,
          type TEXT NOT NULL,
          icon TEXT,
          habit_color TEXT,
          target_view TEXT,
          target_tab TEXT,
          created_at INTEGER NOT NULL,
          resolved_at INTEGER,
          UNIQUE(task_id, date)
        );

        CREATE TABLE IF NOT EXISTS task_active_periods (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id TEXT NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT,
          activated_at INTEGER NOT NULL,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS task_prayer_config (
          task_id TEXT PRIMARY KEY,
          prayer_type TEXT,
          prayer_rule TEXT,
          prayer_task_kind TEXT,
          jesus_prayer_mode TEXT,
          jesus_prayer_duration INTEGER,
          jesus_prayer_count INTEGER,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS task_journal_config (
          task_id TEXT PRIMARY KEY,
          journal_type TEXT NOT NULL,
          technique TEXT,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS task_scripture_config (
          task_id TEXT PRIMARY KEY,
          reading_type TEXT NOT NULL,
          start_book_id INTEGER,
          start_chapter INTEGER,
          chapters_per_day INTEGER,
          total_units_read INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS task_reading_book_config (
          task_id TEXT PRIMARY KEY,
          book_id TEXT NOT NULL,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS task_habit_config (
          task_id TEXT PRIMARY KEY,
          habit_id TEXT NOT NULL,
          habit_step_id TEXT,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS task_challenge_config (
          task_id TEXT PRIMARY KEY,
          challenge_id TEXT NOT NULL,
          template_id TEXT,
          progress_current INTEGER NOT NULL DEFAULT 0,
          progress_total INTEGER NOT NULL DEFAULT 0,
          progress_unit TEXT,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS task_quick_config (
          task_id TEXT PRIMARY KEY,
          date TEXT NOT NULL,
          note TEXT,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS task_challenge_assignments (
          task_id TEXT NOT NULL,
          date TEXT NOT NULL,
          sequence INTEGER NOT NULL,
          label TEXT NOT NULL,
          book_id INTEGER,
          chapter INTEGER,
          PRIMARY KEY (task_id, date, sequence),
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS task_notifications (
          id INTEGER PRIMARY KEY,
          task_id TEXT NOT NULL,
          instance_id TEXT,
          instance_date TEXT NOT NULL,
          kind TEXT NOT NULL,
          fire_at INTEGER NOT NULL,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          native_id TEXT,
          route TEXT,
          source TEXT,
          type TEXT,
          payload_json TEXT,
          status TEXT NOT NULL DEFAULT 'scheduled',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, removed_at, paused_at);
        CREATE INDEX IF NOT EXISTS idx_instances_date ON task_instances(date, status);
        CREATE INDEX IF NOT EXISTS idx_notifications_fire_at ON task_notifications(fire_at);
      `);

      await ensureTaskNotificationColumns(conn);

      await conn.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_notifications_native_id ON task_notifications(native_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_task_instance ON task_notifications(task_id, instance_id, status);
      `);

      await conn.runAsync(
        `UPDATE tasks
         SET source = 'routine',
             level = 2,
             icon = COALESCE(icon, 'Feather')
         WHERE source = 'spiritual'
           AND type = 'journal'`,
      );
      await conn.runAsync(
        `UPDATE task_instances
         SET source = 'routine',
             level = 2,
             icon = COALESCE(icon, 'Feather')
         WHERE source = 'spiritual'
           AND type = 'journal'`,
      );

      await repairMissingScriptureTaskConfigs(conn);
    })();
    initPromise = initPromise.catch(error => {
      initPromise = null;
      throw error;
    });
  }

  return initPromise;
}

async function replaceNumberRows(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  taskId: string,
  values: number[],
) {
  await db.runAsync(`DELETE FROM ${table} WHERE task_id = ?`, taskId);
  for (const value of [...new Set(values)].sort((a, b) => a - b)) {
    await db.runAsync(
      `INSERT OR REPLACE INTO ${table} (task_id, ${column}) VALUES (?, ?)`,
      taskId,
      value,
    );
  }
}

async function replaceDayTimes(
  db: SQLite.SQLiteDatabase,
  taskId: string,
  values: Record<number, string>,
) {
  await db.runAsync('DELETE FROM task_day_times WHERE task_id = ?', taskId);
  for (const [dayIndex, time] of Object.entries(values)) {
    await db.runAsync(
      'INSERT OR REPLACE INTO task_day_times (task_id, day_index, time) VALUES (?, ?, ?)',
      taskId,
      Number(dayIndex),
      time,
    );
  }
}

async function saveConfigs(db: SQLite.SQLiteDatabase, taskId: string, draft: TaskDraft) {
  if (draft.prayerConfig) {
    const config: PrayerTaskConfig = { taskId, ...draft.prayerConfig };
    await db.runAsync(
      `INSERT OR REPLACE INTO task_prayer_config (
        task_id, prayer_type, prayer_rule, prayer_task_kind,
        jesus_prayer_mode, jesus_prayer_duration, jesus_prayer_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      config.taskId,
      config.prayerType ?? null,
      config.prayerRule ?? null,
      config.prayerTaskKind ?? null,
      config.jesusPrayerMode ?? null,
      config.jesusPrayerDuration ?? null,
      config.jesusPrayerCount ?? null,
    );
  }

  if (draft.journalConfig) {
    const config: JournalTaskConfig = { taskId, ...draft.journalConfig };
    await db.runAsync(
      'INSERT OR REPLACE INTO task_journal_config (task_id, journal_type, technique) VALUES (?, ?, ?)',
      config.taskId,
      config.journalType,
      config.technique ?? null,
    );
  }

  if (draft.scriptureConfig) {
    const config: ScriptureTaskConfig = { taskId, ...draft.scriptureConfig };
    const rawChaptersPerDay = Number(config.chaptersPerDay);
    const chaptersPerDay = config.readingType === 'church_calendar'
      ? 0
      : Math.max(1, Math.round(Number.isFinite(rawChaptersPerDay) ? rawChaptersPerDay : 1));
    await db.runAsync(
      `INSERT OR REPLACE INTO task_scripture_config (
        task_id, reading_type, start_book_id, start_chapter, chapters_per_day, total_units_read
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      config.taskId,
      config.readingType,
      config.startBookId ?? null,
      config.startChapter ?? null,
      chaptersPerDay,
      config.totalUnitsRead ?? 0,
    );
  }

  if (draft.readingBookConfig) {
    const config: ReadingBookTaskConfig = { taskId, ...draft.readingBookConfig };
    await db.runAsync(
      'INSERT OR REPLACE INTO task_reading_book_config (task_id, book_id) VALUES (?, ?)',
      config.taskId,
      config.bookId,
    );
  }

  if (draft.habitConfig) {
    const config: HabitTaskConfig = { taskId, ...draft.habitConfig };
    await db.runAsync(
      'INSERT OR REPLACE INTO task_habit_config (task_id, habit_id, habit_step_id) VALUES (?, ?, ?)',
      config.taskId,
      config.habitId,
      config.habitStepId ?? null,
    );
  }

  if (draft.challengeConfig) {
    const config: ChallengeTaskConfig = { taskId, ...draft.challengeConfig };
    await db.runAsync(
      `INSERT OR REPLACE INTO task_challenge_config (
        task_id, challenge_id, template_id, progress_current, progress_total, progress_unit
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      config.taskId,
      config.challengeId,
      config.templateId ?? null,
      config.progressCurrent ?? 0,
      config.progressTotal ?? 0,
      config.progressUnit ?? null,
    );
  }

  if (draft.quickConfig) {
    const config: QuickTaskConfig = { taskId, ...draft.quickConfig };
    await db.runAsync(
      'INSERT OR REPLACE INTO task_quick_config (task_id, date, note) VALUES (?, ?, ?)',
      config.taskId,
      config.date,
      config.note ?? null,
    );
  }
}

export async function saveTask(draft: TaskDraft) {
  const db = await openTaskDb();
  const existing = draft.id
    ? (await listTasks()).find(item => item.id === draft.id)
    : undefined;
  const task = normalizeDraft(draft, existing);

  if (existing) {
    await db.runAsync(
      `UPDATE tasks
       SET title = ?,
           subtitle = ?,
           level = ?,
           source = ?,
           type = ?,
           icon = ?,
           habit_color = ?,
           target_view = ?,
           target_tab = ?,
           status = ?,
           frequency = ?,
           time = ?,
           same_time_every_day = ?,
           notification_mode = ?,
           reminder_minutes = ?,
           created_at = ?,
           activated_at = ?,
           paused_at = ?,
           removed_at = ?
       WHERE id = ?`,
      task.title,
      task.subtitle ?? null,
      task.level,
      task.source,
      task.type,
      task.icon ?? null,
      task.habitColor ?? null,
      task.targetView ?? null,
      task.targetTab ?? null,
      task.status,
      task.schedule.frequency,
      task.schedule.time,
      boolToInt(task.schedule.sameTimeEveryDay),
      task.notificationMode,
      task.reminderMinutes ?? null,
      task.createdAt,
      task.activatedAt,
      task.pausedAt ?? null,
      task.removedAt ?? null,
      task.id,
    );

    if (taskDisplayTextChanged(existing, task)) {
      await refreshTaskDisplaySnapshotsFromDate(db, task, getLocalDateKey());
    }
  } else {
    await db.runAsync(
      `INSERT INTO tasks (
        id, title, subtitle, level, source, type, icon, habit_color,
        target_view, target_tab, status, frequency, time, same_time_every_day,
        notification_mode, reminder_minutes, created_at, activated_at, paused_at, removed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      task.id,
      task.title,
      task.subtitle ?? null,
      task.level,
      task.source,
      task.type,
      task.icon ?? null,
      task.habitColor ?? null,
      task.targetView ?? null,
      task.targetTab ?? null,
      task.status,
      task.schedule.frequency,
      task.schedule.time,
      boolToInt(task.schedule.sameTimeEveryDay),
      task.notificationMode,
      task.reminderMinutes ?? null,
      task.createdAt,
      task.activatedAt,
      task.pausedAt ?? null,
      task.removedAt ?? null,
    );
  }

  await replaceNumberRows(db, 'task_schedule_days', 'day_index', task.id, task.schedule.selectedDays);
  await replaceNumberRows(db, 'task_schedule_month_days', 'month_day', task.id, task.schedule.monthlyDays);
  await replaceDayTimes(db, task.id, task.schedule.dayTimes);
  await saveConfigs(db, task.id, draft);

  await db.runAsync(
    `INSERT INTO task_active_periods (task_id, start_date, activated_at)
     SELECT ?, ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM task_active_periods WHERE task_id = ? AND end_date IS NULL
     )`,
    task.id,
    getLocalDateKey(new Date(task.activatedAt)),
    task.activatedAt,
    task.id,
  );

  return task;
}

function rowToTask(
  row: TaskRow,
  selectedDays: number[],
  monthlyDays: number[],
  dayTimes: Record<number, string>,
  quickConfig?: QuickTaskConfig,
): TaskDefinition {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    level: row.level as TaskDefinition['level'],
    source: row.source,
    type: row.type,
    icon: row.icon ?? undefined,
    habitColor: row.habit_color ?? undefined,
    targetView: row.target_view ?? undefined,
    targetTab: row.target_tab ?? undefined,
    status: row.status,
    schedule: {
      frequency: row.frequency,
      selectedDays,
      monthlyDays: monthlyDays.length ? monthlyDays : [1],
      time: row.time,
      sameTimeEveryDay: intToBool(row.same_time_every_day),
      dayTimes,
    },
    notificationMode: row.notification_mode,
    reminderMinutes: row.reminder_minutes ?? undefined,
    createdAt: row.created_at,
    activatedAt: row.activated_at,
    pausedAt: row.paused_at ?? undefined,
    removedAt: row.removed_at ?? undefined,
    quickConfig,
  };
}

export async function listTasks() {
  const db = await openTaskDb();
  const rows = await db.getAllAsync<TaskRow>('SELECT * FROM tasks ORDER BY time ASC, created_at ASC');
  const taskIds = rows.map(row => row.id);
  if (!taskIds.length) return [];

  const dayRows = await db.getAllAsync<{ task_id: string; day_index: number }>(
    'SELECT task_id, day_index FROM task_schedule_days',
  );
  const monthRows = await db.getAllAsync<{ task_id: string; month_day: number }>(
    'SELECT task_id, month_day FROM task_schedule_month_days',
  );
  const timeRows = await db.getAllAsync<{ task_id: string; day_index: number; time: string }>(
    'SELECT task_id, day_index, time FROM task_day_times',
  );
  const quickRows = await db.getAllAsync<{ task_id: string; date: string; note: string | null }>(
    'SELECT task_id, date, note FROM task_quick_config',
  );

  const selectedByTask = new Map<string, number[]>();
  const monthlyByTask = new Map<string, number[]>();
  const timesByTask = new Map<string, Record<number, string>>();
  const quickByTask = new Map<string, QuickTaskConfig>();

  for (const row of dayRows) {
    selectedByTask.set(row.task_id, [...(selectedByTask.get(row.task_id) ?? []), row.day_index]);
  }
  for (const row of monthRows) {
    monthlyByTask.set(row.task_id, [...(monthlyByTask.get(row.task_id) ?? []), row.month_day]);
  }
  for (const row of timeRows) {
    timesByTask.set(row.task_id, {
      ...(timesByTask.get(row.task_id) ?? {}),
      [row.day_index]: row.time,
    });
  }
  for (const row of quickRows) {
    quickByTask.set(row.task_id, {
      taskId: row.task_id,
      date: row.date,
      note: row.note ?? undefined,
    });
  }

  return rows.map(row => rowToTask(
    row,
    selectedByTask.get(row.id) ?? [],
    monthlyByTask.get(row.id) ?? [],
    timesByTask.get(row.id) ?? {},
    quickByTask.get(row.id),
  ));
}

export async function getPrayerTaskConfig(taskId: string): Promise<PrayerTaskConfig | undefined> {
  const db = await openTaskDb();
  const row = await db.getFirstAsync<PrayerConfigRow>(
    `SELECT task_id, prayer_type, prayer_rule, prayer_task_kind,
            jesus_prayer_mode, jesus_prayer_duration, jesus_prayer_count
     FROM task_prayer_config
     WHERE task_id = ?
     LIMIT 1`,
    taskId,
  );

  if (!row) return undefined;

  return {
    taskId: row.task_id,
    prayerType: row.prayer_type ?? undefined,
    prayerRule: row.prayer_rule ?? undefined,
    prayerTaskKind: row.prayer_task_kind ?? undefined,
    jesusPrayerMode: row.jesus_prayer_mode ?? undefined,
    jesusPrayerDuration: row.jesus_prayer_duration ?? undefined,
    jesusPrayerCount: row.jesus_prayer_count ?? undefined,
  };
}

export async function listTaskLaunchConfigs(): Promise<Record<string, TaskLaunchConfigBundle>> {
  const db = await openTaskDb();
  const rows = await db.getAllAsync<TaskLaunchConfigRow>(
    `SELECT
       t.id AS task_id,
       p.prayer_type,
       p.prayer_rule,
       p.prayer_task_kind,
       p.jesus_prayer_mode,
       p.jesus_prayer_duration,
       p.jesus_prayer_count,
       j.journal_type,
       j.technique,
       s.reading_type,
       s.start_book_id,
       s.start_chapter,
       s.chapters_per_day,
       s.total_units_read,
       r.book_id AS reading_book_id
     FROM tasks t
     LEFT JOIN task_prayer_config p ON p.task_id = t.id
     LEFT JOIN task_journal_config j ON j.task_id = t.id
     LEFT JOIN task_scripture_config s ON s.task_id = t.id
     LEFT JOIN task_reading_book_config r ON r.task_id = t.id`,
  );

  const configs: Record<string, TaskLaunchConfigBundle> = {};
  for (const row of rows) {
    const bundle: TaskLaunchConfigBundle = {};
    if (
      row.prayer_type != null
      || row.prayer_rule != null
      || row.prayer_task_kind != null
      || row.jesus_prayer_mode != null
    ) {
      bundle.prayer = {
        taskId: row.task_id,
        prayerType: row.prayer_type ?? undefined,
        prayerRule: row.prayer_rule ?? undefined,
        prayerTaskKind: row.prayer_task_kind ?? undefined,
        jesusPrayerMode: row.jesus_prayer_mode ?? undefined,
        jesusPrayerDuration: row.jesus_prayer_duration ?? undefined,
        jesusPrayerCount: row.jesus_prayer_count ?? undefined,
      };
    }
    if (row.journal_type) {
      bundle.journal = {
        taskId: row.task_id,
        journalType: row.journal_type,
        technique: row.technique ?? undefined,
      };
    }
    if (row.reading_type) {
      const rawChaptersPerDay = Number(row.chapters_per_day);
      bundle.scripture = {
        taskId: row.task_id,
        readingType: row.reading_type,
        startBookId: row.start_book_id ?? undefined,
        startChapter: row.start_chapter ?? undefined,
        chaptersPerDay: row.reading_type === 'church_calendar'
          ? 0
          : Math.max(1, Math.round(Number.isFinite(rawChaptersPerDay) ? rawChaptersPerDay : 1)),
        totalUnitsRead: row.total_units_read ?? undefined,
      };
    }
    if (row.reading_book_id) {
      bundle.readingBook = { taskId: row.task_id, bookId: row.reading_book_id };
    }
    configs[row.task_id] = bundle;
  }
  return configs;
}

export async function getScriptureTaskConfig(taskId: string): Promise<ScriptureTaskConfig | undefined> {
  const db = await openTaskDb();
  const row = await db.getFirstAsync<ScriptureConfigRow>(
    `SELECT task_id, reading_type, start_book_id, start_chapter, chapters_per_day, total_units_read
     FROM task_scripture_config
     WHERE task_id = ?
     LIMIT 1`,
    taskId,
  );

  if (!row) return undefined;
  const rawChaptersPerDay = Number(row.chapters_per_day);
  const chaptersPerDay = row.reading_type === 'church_calendar'
    ? 0
    : Math.max(1, Math.round(Number.isFinite(rawChaptersPerDay) ? rawChaptersPerDay : 1));

  return {
    taskId: row.task_id,
    readingType: row.reading_type,
    startBookId: row.start_book_id ?? undefined,
    startChapter: row.start_chapter ?? undefined,
    chaptersPerDay,
    totalUnitsRead: row.total_units_read ?? undefined,
  };
}

export async function getJournalTaskConfig(taskId: string): Promise<JournalTaskConfig | undefined> {
  const db = await openTaskDb();
  const row = await db.getFirstAsync<JournalConfigRow>(
    `SELECT task_id, journal_type, technique
     FROM task_journal_config
     WHERE task_id = ?
     LIMIT 1`,
    taskId,
  );

  if (!row) return undefined;

  return {
    taskId: row.task_id,
    journalType: row.journal_type,
    technique: row.technique ?? undefined,
  };
}

async function getTaskLifecycleStopDate(db: SQLite.SQLiteDatabase, taskId: string) {
  const today = getLocalDateKey();
  const todayInstance = await db.getFirstAsync<{ status: TaskInstanceStatus }>(
    'SELECT status FROM task_instances WHERE task_id = ? AND date = ? LIMIT 1',
    taskId,
    today,
  );

  // task_active_periods.end_date is exclusive. If today's task already counted,
  // keep that snapshot visible today and stop future appearances tomorrow.
  if (todayInstance?.status === 'completed' || todayInstance?.status === 'skipped') {
    return getLocalDateKey(addDays(new Date(), 1));
  }

  return today;
}

export async function pauseTask(taskId: string) {
  const db = await openTaskDb();
  const date = await getTaskLifecycleStopDate(db, taskId);
  await db.runAsync('UPDATE tasks SET status = ?, paused_at = ? WHERE id = ?', 'paused', date, taskId);
  await db.runAsync('UPDATE task_active_periods SET end_date = ? WHERE task_id = ? AND end_date IS NULL', date, taskId);
}

export async function resumeTask(taskId: string) {
  const db = await openTaskDb();
  const now = Date.now();
  const date = getLocalDateKey(new Date(now));
  await db.runAsync('UPDATE tasks SET status = ?, paused_at = NULL, activated_at = ? WHERE id = ?', 'active', now, taskId);
  await db.runAsync(
    'INSERT INTO task_active_periods (task_id, start_date, activated_at) VALUES (?, ?, ?)',
    taskId,
    date,
    now,
  );
}

export async function softDeleteTask(taskId: string) {
  const db = await openTaskDb();
  const date = await getTaskLifecycleStopDate(db, taskId);
  const today = getLocalDateKey();
  await db.runAsync('UPDATE tasks SET status = ?, removed_at = ? WHERE id = ?', 'archived', date, taskId);
  await db.runAsync('UPDATE task_active_periods SET end_date = ? WHERE task_id = ? AND end_date IS NULL', date, taskId);

  if (date === today) {
    await db.runAsync(
      `UPDATE task_instances
       SET status = ?, locked = 0, resolved_at = NULL
       WHERE task_id = ?
         AND date = ?
         AND status NOT IN ('completed', 'skipped')`,
      'not_applicable',
      taskId,
      today,
    );
    await db.runAsync(
      `UPDATE task_instances
       SET status = ?, locked = 0, resolved_at = NULL
       WHERE task_id = ? AND date > ?`,
      'not_applicable',
      taskId,
      today,
    );
    return;
  }

  await db.runAsync(
    `UPDATE task_instances
     SET status = ?, locked = 0, resolved_at = NULL
     WHERE task_id = ? AND date >= ?`,
    'not_applicable',
    taskId,
    date,
  );
}

export async function archiveTaskImmediately(taskId: string) {
  const db = await openTaskDb();
  const date = getLocalDateKey();
  await db.runAsync('UPDATE tasks SET status = ?, removed_at = ? WHERE id = ?', 'archived', date, taskId);
  await db.runAsync('UPDATE task_active_periods SET end_date = ? WHERE task_id = ? AND end_date IS NULL', date, taskId);
  await db.runAsync(
    'UPDATE task_instances SET status = ?, locked = 0, resolved_at = NULL WHERE task_id = ? AND date >= ?',
    'not_applicable',
    taskId,
    date,
  );
}

export async function cleanupLegacyDemoHabitTasks() {
  const db = await openTaskDb();
  const date = getLocalDateKey();
  const placeholders = LEGACY_DEMO_HABIT_TASK_IDS.map(() => '?').join(', ');

  await db.runAsync(
    `UPDATE tasks
     SET status = 'archived', removed_at = COALESCE(removed_at, ?)
     WHERE id IN (${placeholders})`,
    date,
    ...LEGACY_DEMO_HABIT_TASK_IDS,
  );

  await db.runAsync(
    `UPDATE task_active_periods
     SET end_date = COALESCE(end_date, ?)
     WHERE task_id IN (${placeholders})`,
    date,
    ...LEGACY_DEMO_HABIT_TASK_IDS,
  );

  await db.runAsync(
    `UPDATE task_instances
     SET status = 'not_applicable', locked = 0
     WHERE task_id IN (${placeholders})`,
    ...LEGACY_DEMO_HABIT_TASK_IDS,
  );
}

function rowToInstance(row: InstanceRow): TaskInstance {
  return {
    id: row.id,
    taskId: row.task_id,
    date: row.date,
    time: row.time,
    status: row.status,
    locked: intToBool(row.locked),
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    level: row.level as TaskInstance['level'],
    source: row.source,
    type: row.type,
    icon: row.icon ?? undefined,
    habitColor: row.habit_color ?? undefined,
    targetView: row.target_view ?? undefined,
    targetTab: row.target_tab ?? undefined,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at ?? undefined,
  };
}

function shiftDateKey(dateKey: string, days: number) {
  return getLocalDateKey(addDays(getDateFromLocalKey(dateKey), days));
}

function daysBetweenDateKeys(fromDate: string, toDate: string) {
  const from = getDateFromLocalKey(fromDate).getTime();
  const to = getDateFromLocalKey(toDate).getTime();
  return Math.round((to - from) / 86400000);
}

function taskInstanceResolvedAt(dateKey: string, time?: string) {
  const dueAt = time
    ? parseTaskTimeToDate(dateKey, time)
    : new Date(`${dateKey}T23:59:59.999`);
  return dueAt?.getTime() ?? Date.now();
}

function parseTaskInstanceId(instanceId: string) {
  const match = instanceId.match(/^(.*)_(\d{4}-\d{2}-\d{2})$/);
  if (!match) return null;
  return { taskId: match[1], date: match[2] };
}

function fallbackActivePeriodForTask(task: TaskDefinition): ActivePeriodRow {
  const endDate = task.status === 'active'
    ? null
    : task.removedAt ?? task.pausedAt ?? getLocalDateKey();

  return {
    task_id: task.id,
    start_date: getLocalDateKey(new Date(task.activatedAt)),
    end_date: endDate,
    activated_at: task.activatedAt,
  };
}

function activePeriodMatchesDate(task: TaskDefinition, period: ActivePeriodRow, date: string) {
  if (date < period.start_date) return false;
  if (period.end_date && date >= period.end_date) return false;
  if (task.source === 'quick' && task.quickConfig?.date) {
    return date === task.quickConfig.date;
  }
  if (!scheduleMatchesDate(task.schedule, date)) return false;

  if (date > period.start_date) return true;

  const effectiveTime = getEffectiveTaskTime(task.schedule, date);
  const scheduledAt = parseTaskTimeToDate(date, effectiveTime);
  if (!scheduledAt) return true;

  return period.activated_at <= scheduledAt.getTime();
}

function taskPassesActivationCutoff(task: TaskDefinition, date: string) {
  if (task.source === 'quick') return true;

  const activatedDate = getLocalDateKey(new Date(task.activatedAt));
  if (date !== activatedDate) return true;

  const effectiveTime = getEffectiveTaskTime(task.schedule, date);
  const scheduledAt = parseTaskTimeToDate(date, effectiveTime);
  if (!scheduledAt) return true;

  return task.activatedAt <= scheduledAt.getTime();
}

async function loadActivePeriodsByTask(db: SQLite.SQLiteDatabase) {
  const rows = await db.getAllAsync<ActivePeriodRow>(
    'SELECT task_id, start_date, end_date, activated_at FROM task_active_periods',
  );
  const periodsByTask = new Map<string, ActivePeriodRow[]>();

  for (const row of rows) {
    periodsByTask.set(row.task_id, [...(periodsByTask.get(row.task_id) ?? []), row]);
  }

  return periodsByTask;
}

function shouldTaskHaveSnapshotOnDate(
  task: TaskDefinition,
  date: string,
  periodsByTask: Map<string, ActivePeriodRow[]>,
) {
  const periods = periodsByTask.get(task.id);
  const passesActivationCutoff = taskPassesActivationCutoff(task, date);

  if (!periods?.length) {
    return passesActivationCutoff
      && activePeriodMatchesDate(task, fallbackActivePeriodForTask(task), date);
  }

  return passesActivationCutoff
    && periods.some(period => activePeriodMatchesDate(task, period, date));
}

async function upsertInstance(db: SQLite.SQLiteDatabase, instance: TaskInstance) {
  await db.runAsync(
    `INSERT OR REPLACE INTO task_instances (
      id, task_id, date, time, status, locked, title, subtitle, level, source,
      type, icon, habit_color, target_view, target_tab, created_at, resolved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    instance.id,
    instance.taskId,
    instance.date,
    instance.time,
    instance.status,
    boolToInt(instance.locked),
    instance.title,
    instance.subtitle ?? null,
    instance.level,
    instance.source,
    instance.type,
    instance.icon ?? null,
    instance.habitColor ?? null,
    instance.targetView ?? null,
    instance.targetTab ?? null,
    instance.createdAt,
    instance.resolvedAt ?? null,
  );
}

async function materializeTaskInstancesForDate(
  db: SQLite.SQLiteDatabase,
  tasks: TaskDefinition[],
  activePeriodsByTask: Map<string, ActivePeriodRow[]>,
  date: string,
  referenceDate: Date,
  allowPastBackfill = false,
) {
  const existingRows = await db.getAllAsync<InstanceRow>(
    'SELECT * FROM task_instances WHERE date = ?',
    date,
  );

  const today = getLocalDateKey(referenceDate);
  if (date < today) {
    const hasExistingSnapshot = existingRows.some(row => row.status !== 'not_applicable');
    for (const row of existingRows) {
      if (row.status !== 'pending' || row.locked) continue;
      if (!shouldMarkMissed(row.date, row.time, referenceDate)) continue;
      await db.runAsync(
        'UPDATE task_instances SET status = ?, locked = 1, resolved_at = ? WHERE id = ?',
        'missed',
        taskInstanceResolvedAt(row.date, row.time),
        row.id,
      );
    }
    if (hasExistingSnapshot || !allowPastBackfill) return;
  }

  const existingByTask = new Map(existingRows.map(row => [row.task_id, rowToInstance(row)]));
  const activeTaskIds = new Set<string>();

  for (const task of tasks) {
    const hasSnapshot = shouldTaskHaveSnapshotOnDate(task, date, activePeriodsByTask);
    if (!hasSnapshot) continue;
    activeTaskIds.add(task.id);
    const existing = existingByTask.get(task.id);
    const instance = buildTaskInstance(task, date, existing, referenceDate);
    await upsertInstance(db, instance);
  }

  for (const existing of existingByTask.values()) {
    if (activeTaskIds.has(existing.taskId) || existing.locked) continue;
    await db.runAsync(
      'UPDATE task_instances SET status = ?, locked = 0 WHERE id = ?',
      'not_applicable',
      existing.id,
    );
  }
}

export async function ensureTaskInstancesForDate(date: string, referenceDate: Date = new Date()) {
  const db = await openTaskDb();
  const tasks = await listTasks();
  const activePeriodsByTask = await loadActivePeriodsByTask(db);
  await materializeTaskInstancesForDate(db, tasks, activePeriodsByTask, date, referenceDate);

  return listTaskInstancesForDate(date);
}

async function getLatestTrackedInstanceDate(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ latest_date: string | null }>(
    `SELECT MAX(date) AS latest_date
     FROM task_instances
     WHERE status <> 'not_applicable'`,
  );
  return row?.latest_date ?? undefined;
}

async function bridgeLongInactivity(
  db: SQLite.SQLiteDatabase,
  latestTrackedDate: string,
  referenceDate: Date,
) {
  const today = getLocalDateKey(referenceDate);
  const pausedFrom = shiftDateKey(latestTrackedDate, 1);
  const now = referenceDate.getTime();
  const activeTaskRows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM tasks
     WHERE status = 'active' AND source <> 'quick'`,
  );

  if (!activeTaskRows.length || pausedFrom >= today) return;

  await db.runAsync(
    `UPDATE task_active_periods
     SET end_date = ?
     WHERE end_date IS NULL
       AND start_date < ?
       AND task_id IN (SELECT id FROM tasks WHERE status = 'active' AND source <> 'quick')`,
    pausedFrom,
    pausedFrom,
  );

  await db.runAsync(
    `UPDATE tasks
     SET activated_at = ?, paused_at = NULL
     WHERE status = 'active' AND source <> 'quick'`,
    now,
  );

  for (const row of activeTaskRows) {
    await db.runAsync(
      `INSERT INTO task_active_periods (task_id, start_date, activated_at)
       SELECT ?, ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM task_active_periods WHERE task_id = ? AND end_date IS NULL
       )`,
      row.id,
      today,
      now,
      row.id,
    );
  }
}

async function markDueTaskInstancesMissedInDb(
  db: SQLite.SQLiteDatabase,
  referenceDate: Date = new Date(),
) {
  const today = getLocalDateKey(referenceDate);
  const rows = await db.getAllAsync<InstanceRow>(
    `SELECT * FROM task_instances
     WHERE date = ? AND status = 'pending' AND locked = 0`,
    today,
  );

  let changed = 0;
  for (const row of rows) {
    if (!shouldMarkMissed(row.date, row.time, referenceDate)) continue;
    await db.runAsync(
      'UPDATE task_instances SET status = ?, locked = 1, resolved_at = ? WHERE id = ?',
      'missed',
      taskInstanceResolvedAt(row.date, row.time),
      row.id,
    );
    changed += 1;
  }

  return changed;
}

export async function markDueTaskInstancesMissed(referenceDate: Date = new Date()) {
  const db = await openTaskDb();
  return markDueTaskInstancesMissedInDb(db, referenceDate);
}

export async function syncTaskInstancesWindow(referenceDate: Date = new Date()) {
  const db = await openTaskDb();
  const today = getLocalDateKey(referenceDate);
  const horizon = getLocalDateKey(addDays(referenceDate, TASK_INSTANCE_HORIZON_DAYS));
  const latestTrackedDate = await getLatestTrackedInstanceDate(db);

  let fromDate = today;
  let pausedForLongInactivity = false;

  if (latestTrackedDate && latestTrackedDate < today) {
    const gapDays = daysBetweenDateKeys(latestTrackedDate, today);
    if (gapDays <= TASK_INSTANCE_GAP_FILL_DAYS) {
      fromDate = shiftDateKey(latestTrackedDate, 1);
    } else {
      pausedForLongInactivity = true;
      await bridgeLongInactivity(db, latestTrackedDate, referenceDate);
    }
  }

  const tasks = await listTasks();
  const activePeriodsByTask = await loadActivePeriodsByTask(db);

  for (let cursor = fromDate; cursor <= horizon; cursor = shiftDateKey(cursor, 1)) {
    await materializeTaskInstancesForDate(db, tasks, activePeriodsByTask, cursor, referenceDate, true);
  }

  await markDueTaskInstancesMissedInDb(db, referenceDate);

  return {
    fromDate,
    toDate: horizon,
    latestTrackedDate,
    pausedForLongInactivity,
  };
}

export async function listTaskInstancesForDate(date: string) {
  const db = await openTaskDb();
  const rows = await db.getAllAsync<InstanceRow>(
    `SELECT * FROM task_instances
     WHERE date = ? AND status <> 'not_applicable'
     ORDER BY time ASC, created_at ASC`,
    date,
  );
  return rows.map(rowToInstance);
}

// Range query for analytics: pulls every applicable instance whose date
// falls within [fromDate, toDate] (inclusive). Used by analyticsOverview
// to build the 12-month rolling snapshot window — calling listTaskInstancesForDate
// once per day would issue 365+ separate queries on screen entry.
export async function listTaskInstancesBetween(fromDate: string, toDate: string) {
  const db = await openTaskDb();
  const rows = await db.getAllAsync<InstanceRow>(
    `SELECT * FROM task_instances
     WHERE date >= ? AND date <= ? AND status <> 'not_applicable'
     ORDER BY date ASC, time ASC, created_at ASC`,
    fromDate,
    toDate,
  );
  return rows.map(rowToInstance);
}

export type TaskDailyStatusCounts = {
  date: string;
  completed: number;
  skipped: number;
  missed: number;
  pending: number;
};

// Compact all-time feed for Home trophies. SQL performs the aggregation so
// opening Home never has to hydrate every historical task instance into JS.
export async function listTaskDailyStatusCountsThrough(toDate: string): Promise<TaskDailyStatusCounts[]> {
  const db = await openTaskDb();
  return db.getAllAsync<TaskDailyStatusCounts>(
    `SELECT
       date,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
       SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) AS skipped,
       SUM(CASE WHEN status = 'missed' THEN 1 ELSE 0 END) AS missed,
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending
     FROM task_instances
     WHERE date <= ? AND status <> 'not_applicable'
     GROUP BY date
     ORDER BY date ASC`,
    toDate,
  );
}

// Single-task range query: only rows for the given taskId. Used by the
// per-task analytics popup so we don't pull thousands of unrelated rows
// just to filter one task in memory.
export async function listTaskInstancesForTaskBetween(
  taskId: string,
  fromDate: string,
  toDate: string,
) {
  const db = await openTaskDb();
  const rows = await db.getAllAsync<InstanceRow>(
    `SELECT * FROM task_instances
     WHERE task_id = ? AND date >= ? AND date <= ? AND status <> 'not_applicable'
     ORDER BY date ASC, time ASC, created_at ASC`,
    taskId,
    fromDate,
    toDate,
  );
  return rows.map(rowToInstance);
}

export async function getTaskDateBounds(taskId: string): Promise<{ createdAt: number; activatedAt: number } | undefined> {
  const db = await openTaskDb();
  const row = await db.getFirstAsync<{ created_at: number; activated_at: number }>(
    'SELECT created_at, activated_at FROM tasks WHERE id = ? LIMIT 1',
    taskId,
  );
  if (!row) return undefined;
  return {
    createdAt: row.created_at,
    activatedAt: row.activated_at,
  };
}

// Lightweight title lookup for analytics: { taskId → current title }.
// Avoids iterating thousands of denormalized inst.title snapshots to find
// the latest name for each task. Source of truth = tasks definition table.
export type TaskAnalyticsMeta = {
  title: string;
  source: TaskDefinition['source'];
  type: TaskDefinition['type'];
};

export async function listTaskAnalyticsMeta(): Promise<Record<string, TaskAnalyticsMeta>> {
  const db = await openTaskDb();
  const rows = await db.getAllAsync<{
    id: string;
    title: string;
    source: TaskDefinition['source'];
    type: TaskDefinition['type'];
  }>(
    'SELECT id, title, source, type FROM tasks',
  );
  const map: Record<string, TaskAnalyticsMeta> = {};
  for (const row of rows) {
    map[row.id] = {
      title: row.title,
      source: row.source,
      type: row.type,
    };
  }
  return map;
}

// Lightweight lookup table for analytics: { taskId → habitId } for every
// task that's tied to a habit. Lets per-habit aggregation happen in pure
// memory without joining task_habit_config row-by-row.
export async function listTaskHabitMap() {
  const db = await openTaskDb();
  const rows = await db.getAllAsync<{ task_id: string; habit_id: string }>(
    `SELECT c.task_id, c.habit_id
     FROM task_habit_config c
     JOIN tasks t ON t.id = c.task_id
     WHERE t.source = 'habit'`,
  );
  const map: Record<string, string> = {};
  for (const row of rows) map[row.task_id] = row.habit_id;
  return map;
}

export async function setTaskInstanceStatus(
  instanceId: string,
  status: Extract<TaskInstanceStatus, 'pending' | 'completed' | 'skipped'>,
) {
  const db = await openTaskDb();
  const resolved = status === 'completed' || status === 'skipped';
  const locked = isTaskInstanceLocked(status);
  const updateStatus = () => db.runAsync(
    'UPDATE task_instances SET status = ?, locked = ?, resolved_at = ? WHERE id = ?',
    status,
    boolToInt(locked),
    resolved ? Date.now() : null,
    instanceId,
  );

  let result = await updateStatus();
  if (result.changes > 0) return true;

  const parsed = parseTaskInstanceId(instanceId);
  if (!parsed) return false;

  const tasks = await listTasks();
  const task = tasks.find(item => item.id === parsed.taskId);
  if (!task) return false;

  const activePeriodsByTask = await loadActivePeriodsByTask(db);
  if (!shouldTaskHaveSnapshotOnDate(task, parsed.date, activePeriodsByTask)) return false;

  const instance = buildTaskInstance(task, parsed.date, undefined, new Date());
  await upsertInstance(db, instance);

  result = await updateStatus();
  return result.changes > 0;
}
