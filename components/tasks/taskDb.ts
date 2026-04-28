import * as SQLite from 'expo-sqlite';
import { openUserContentDb } from '@/data/userContentDb';
import type {
  ChallengeTaskConfig,
  HabitTaskConfig,
  JournalTaskConfig,
  PrayerTaskConfig,
  ReadingBookTaskConfig,
  ScriptureTaskConfig,
  TaskDefinition,
  TaskDraft,
  TaskFrequency,
  TaskInstance,
  TaskInstanceStatus,
  TaskLifecycleStatus,
  TaskSchedule,
} from '@/components/tasks/taskTypes';
import {
  buildTaskInstance,
  getLocalDateKey,
  shouldTaskExistOnDate,
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

let initPromise: Promise<void> | null = null;

function boolToInt(value: boolean) {
  return value ? 1 : 0;
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

function normalizeDraft(draft: TaskDraft): TaskDefinition {
  const now = Date.now();
  const schedule = {
    ...defaultSchedule(),
    ...draft.schedule,
    selectedDays: draft.schedule.selectedDays ?? [],
    monthlyDays: draft.schedule.monthlyDays?.length ? draft.schedule.monthlyDays : [1],
    dayTimes: draft.schedule.dayTimes ?? {},
  };

  return {
    id: draft.id || nextId(),
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
    createdAt: draft.createdAt ?? now,
    activatedAt: draft.activatedAt ?? now,
    pausedAt: draft.pausedAt,
    removedAt: draft.removedAt,
  };
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
          instance_date TEXT NOT NULL,
          kind TEXT NOT NULL,
          fire_at INTEGER NOT NULL,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, removed_at, paused_at);
        CREATE INDEX IF NOT EXISTS idx_instances_date ON task_instances(date, status);
        CREATE INDEX IF NOT EXISTS idx_notifications_fire_at ON task_notifications(fire_at);
      `);
    })();
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
    await db.runAsync(
      `INSERT OR REPLACE INTO task_scripture_config (
        task_id, reading_type, start_book_id, start_chapter, chapters_per_day, total_units_read
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      config.taskId,
      config.readingType,
      config.startBookId ?? null,
      config.startChapter ?? null,
      config.chaptersPerDay ?? null,
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
}

export async function saveTask(draft: TaskDraft) {
  const db = await openTaskDb();
  const task = normalizeDraft(draft);

  await db.runAsync(
    `INSERT OR REPLACE INTO tasks (
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

function rowToTask(row: TaskRow, selectedDays: number[], monthlyDays: number[], dayTimes: Record<number, string>): TaskDefinition {
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

  const selectedByTask = new Map<string, number[]>();
  const monthlyByTask = new Map<string, number[]>();
  const timesByTask = new Map<string, Record<number, string>>();

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

  return rows.map(row => rowToTask(
    row,
    selectedByTask.get(row.id) ?? [],
    monthlyByTask.get(row.id) ?? [],
    timesByTask.get(row.id) ?? {},
  ));
}

export async function pauseTask(taskId: string) {
  const db = await openTaskDb();
  const date = getLocalDateKey();
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
  const date = getLocalDateKey();
  await db.runAsync('UPDATE tasks SET status = ?, removed_at = ? WHERE id = ?', 'archived', date, taskId);
  await db.runAsync('UPDATE task_active_periods SET end_date = ? WHERE task_id = ? AND end_date IS NULL', date, taskId);
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

export async function ensureTaskInstancesForDate(date: string, referenceDate: Date = new Date()) {
  const db = await openTaskDb();
  const tasks = await listTasks();
  const existingRows = await db.getAllAsync<InstanceRow>(
    'SELECT * FROM task_instances WHERE date = ?',
    date,
  );
  const existingByTask = new Map(existingRows.map(row => [row.task_id, rowToInstance(row)]));
  const activeTaskIds = new Set<string>();

  for (const task of tasks) {
    if (!shouldTaskExistOnDate(task, date)) continue;
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

  return listTaskInstancesForDate(date);
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

export async function setTaskInstanceStatus(
  instanceId: string,
  status: Extract<TaskInstanceStatus, 'pending' | 'completed' | 'skipped'>,
) {
  const db = await openTaskDb();
  const locked = status === 'completed' || status === 'skipped';
  await db.runAsync(
    'UPDATE task_instances SET status = ?, locked = ?, resolved_at = ? WHERE id = ?',
    status,
    boolToInt(locked),
    locked ? Date.now() : null,
    instanceId,
  );
}
