import type { NotificationMode } from '@/components/shared/NotificationSettings';
import type { TaskDayTimes } from '@/components/shared/TaskTimeEditor';
import { openTaskDb } from '@/components/tasks/taskDb';
import type { TaskFrequency, TaskInstanceStatus } from '@/components/tasks/taskTypes';
import { getLocalDateKey } from '@/components/tasks/taskScheduler';

export type HabitFrequency = TaskFrequency;

export type HabitHistory = {
  completed: string[];
  skipped: string[];
  missed: string[];
  scheduled: string[];
};

export type HabitStep = {
  id: string;
  title: string;
  time: string;
  frequency: HabitFrequency;
  selectedDays?: number[];
  monthlyDays?: number[];
  sameTimeEveryDay?: boolean;
  dayTimes?: TaskDayTimes;
  notificationMode?: NotificationMode;
  reminderMinutes?: number;
  completedToday: boolean;
  skippedToday: boolean;
  currentStreak: number;
  bestStreak: number;
  completionRate: number;
  history?: HabitHistory;
};

export type HabitItem = {
  id: string;
  name: string;
  color: string;
  icon: string;
  active: boolean;
  steps: HabitStep[];
};

type HabitRow = {
  id: string;
  name: string;
  color: string;
  icon: string;
  is_active: number;
  is_archived?: number;
  created_at: number;
};

type HabitStepRow = {
  habit_id: string;
  id: string;
  title: string;
  sort_order: number;
  time: string;
  frequency: HabitFrequency;
  same_time_every_day: number;
  notification_mode: NotificationMode;
  reminder_minutes: number | null;
};

type InstanceHistoryRow = {
  task_id: string;
  date: string;
  status: TaskInstanceStatus;
};

type OrphanHabitTaskRow = {
  task_id: string;
  habit_id: string;
  habit_step_id: string | null;
  title: string;
  subtitle: string | null;
  habit_color: string | null;
  icon: string | null;
  status: string;
  frequency: HabitFrequency;
  time: string;
  same_time_every_day: number;
  notification_mode: NotificationMode;
  reminder_minutes: number | null;
  created_at: number;
};

let initPromise: Promise<void> | null = null;

function boolToInt(value: boolean) {
  return value ? 1 : 0;
}

function intToBool(value: unknown) {
  return Number(value || 0) === 1;
}

export function habitStepTaskId(habitId: string, stepId: string) {
  return `habit_${habitId}_${stepId}`;
}

async function initHabitDb() {
  if (!initPromise) {
    initPromise = (async () => {
      const db = await openTaskDb();
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS habits (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          color TEXT NOT NULL,
          icon TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          is_archived INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          paused_at TEXT,
          archived_at TEXT
        );

        CREATE TABLE IF NOT EXISTS habit_steps (
          habit_id TEXT NOT NULL,
          id TEXT NOT NULL,
          title TEXT NOT NULL,
          sort_order INTEGER NOT NULL,
          time TEXT NOT NULL,
          frequency TEXT NOT NULL,
          same_time_every_day INTEGER NOT NULL DEFAULT 1,
          notification_mode TEXT NOT NULL DEFAULT 'none',
          reminder_minutes INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (habit_id, id),
          FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS habit_step_selected_days (
          habit_id TEXT NOT NULL,
          step_id TEXT NOT NULL,
          day_index INTEGER NOT NULL,
          PRIMARY KEY (habit_id, step_id, day_index),
          FOREIGN KEY (habit_id, step_id) REFERENCES habit_steps(habit_id, id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS habit_step_monthly_days (
          habit_id TEXT NOT NULL,
          step_id TEXT NOT NULL,
          month_day INTEGER NOT NULL,
          PRIMARY KEY (habit_id, step_id, month_day),
          FOREIGN KEY (habit_id, step_id) REFERENCES habit_steps(habit_id, id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS habit_step_day_times (
          habit_id TEXT NOT NULL,
          step_id TEXT NOT NULL,
          day_index INTEGER NOT NULL,
          time TEXT NOT NULL,
          PRIMARY KEY (habit_id, step_id, day_index),
          FOREIGN KEY (habit_id, step_id) REFERENCES habit_steps(habit_id, id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_habits_active ON habits(is_archived, is_active, created_at);
        CREATE INDEX IF NOT EXISTS idx_habit_steps_habit ON habit_steps(habit_id, sort_order);
      `);
    })();
  }

  return initPromise;
}

async function replaceNumberRows(
  table: string,
  column: string,
  habitId: string,
  stepId: string,
  values: number[],
) {
  const db = await openTaskDb();
  await db.runAsync(`DELETE FROM ${table} WHERE habit_id = ? AND step_id = ?`, habitId, stepId);
  for (const value of [...new Set(values)].sort((a, b) => a - b)) {
    await db.runAsync(
      `INSERT OR REPLACE INTO ${table} (habit_id, step_id, ${column}) VALUES (?, ?, ?)`,
      habitId,
      stepId,
      value,
    );
  }
}

async function replaceDayTimes(habitId: string, stepId: string, values: TaskDayTimes) {
  const db = await openTaskDb();
  await db.runAsync('DELETE FROM habit_step_day_times WHERE habit_id = ? AND step_id = ?', habitId, stepId);
  for (const [dayIndex, time] of Object.entries(values)) {
    await db.runAsync(
      'INSERT OR REPLACE INTO habit_step_day_times (habit_id, step_id, day_index, time) VALUES (?, ?, ?, ?)',
      habitId,
      stepId,
      Number(dayIndex),
      time,
    );
  }
}

function habitNameFromSubtitle(subtitle: string | null) {
  const name = subtitle?.split(' - ')[0]?.trim();
  return name || 'Habit';
}

function stepIdFromTask(row: OrphanHabitTaskRow) {
  if (row.habit_step_id) return row.habit_step_id;
  const prefix = `habit_${row.habit_id}_`;
  return row.task_id.startsWith(prefix) ? row.task_id.slice(prefix.length) : row.task_id;
}

async function migrateTaskBackedHabits() {
  const db = await openTaskDb();
  const rows = await db.getAllAsync<OrphanHabitTaskRow>(
    `SELECT
       t.id AS task_id,
       c.habit_id AS habit_id,
       c.habit_step_id AS habit_step_id,
       t.title AS title,
       t.subtitle AS subtitle,
       t.habit_color AS habit_color,
       t.icon AS icon,
       t.status AS status,
       t.frequency AS frequency,
       t.time AS time,
       t.same_time_every_day AS same_time_every_day,
       t.notification_mode AS notification_mode,
       t.reminder_minutes AS reminder_minutes,
       t.created_at AS created_at
     FROM tasks t
     JOIN task_habit_config c ON c.task_id = t.id
     LEFT JOIN habits h ON h.id = c.habit_id
     WHERE t.source = 'habit'
       AND t.status <> 'archived'
       AND h.id IS NULL
     ORDER BY t.created_at ASC`,
  );

  if (!rows.length) return;

  const days = await db.getAllAsync<{ task_id: string; day_index: number }>(
    'SELECT task_id, day_index FROM task_schedule_days',
  );
  const monthly = await db.getAllAsync<{ task_id: string; month_day: number }>(
    'SELECT task_id, month_day FROM task_schedule_month_days',
  );
  const dayTimes = await db.getAllAsync<{ task_id: string; day_index: number; time: string }>(
    'SELECT task_id, day_index, time FROM task_day_times',
  );

  const daysByTask = new Map<string, number[]>();
  const monthlyByTask = new Map<string, number[]>();
  const dayTimesByTask = new Map<string, TaskDayTimes>();

  for (const row of days) {
    daysByTask.set(row.task_id, [...(daysByTask.get(row.task_id) ?? []), row.day_index]);
  }
  for (const row of monthly) {
    monthlyByTask.set(row.task_id, [...(monthlyByTask.get(row.task_id) ?? []), row.month_day]);
  }
  for (const row of dayTimes) {
    dayTimesByTask.set(row.task_id, {
      ...(dayTimesByTask.get(row.task_id) ?? {}),
      [row.day_index]: row.time,
    });
  }

  const grouped = new Map<string, OrphanHabitTaskRow[]>();
  for (const row of rows) {
    grouped.set(row.habit_id, [...(grouped.get(row.habit_id) ?? []), row]);
  }

  for (const [habitId, taskRows] of grouped) {
    const first = taskRows[0];
    const createdAt = Math.min(...taskRows.map(row => row.created_at || Date.now()));
    const active = taskRows.some(row => row.status === 'active');
    await db.runAsync(
      `INSERT OR IGNORE INTO habits (
        id, name, color, icon, is_active, is_archived, created_at, updated_at, paused_at, archived_at
      ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, NULL)`,
      habitId,
      habitNameFromSubtitle(first.subtitle),
      first.habit_color ?? '#C5A059',
      first.icon && first.icon !== 'Heart' ? first.icon : '*',
      boolToInt(active),
      createdAt,
      Date.now(),
      active ? null : getLocalDateKey(),
    );

    for (const [index, row] of taskRows.entries()) {
      const stepId = stepIdFromTask(row);
      await db.runAsync(
        `INSERT OR IGNORE INTO habit_steps (
          habit_id, id, title, sort_order, time, frequency, same_time_every_day,
          notification_mode, reminder_minutes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        habitId,
        stepId,
        row.title,
        index,
        row.time,
        row.frequency,
        row.same_time_every_day,
        row.notification_mode,
        row.reminder_minutes,
        row.created_at,
        Date.now(),
      );
      await replaceNumberRows(
        'habit_step_selected_days',
        'day_index',
        habitId,
        stepId,
        daysByTask.get(row.task_id) ?? [],
      );
      await replaceNumberRows(
        'habit_step_monthly_days',
        'month_day',
        habitId,
        stepId,
        monthlyByTask.get(row.task_id) ?? [],
      );
      await replaceDayTimes(habitId, stepId, dayTimesByTask.get(row.task_id) ?? {});
    }
  }
}

async function loadNumberMap(table: string, column: string) {
  const db = await openTaskDb();
  const rows = await db.getAllAsync<{ habit_id: string; step_id: string; value: number }>(
    `SELECT habit_id, step_id, ${column} AS value FROM ${table} ORDER BY value ASC`,
  );
  const map = new Map<string, number[]>();
  for (const row of rows) {
    const key = `${row.habit_id}::${row.step_id}`;
    map.set(key, [...(map.get(key) ?? []), row.value]);
  }
  return map;
}

async function loadDayTimesMap() {
  const db = await openTaskDb();
  const rows = await db.getAllAsync<{ habit_id: string; step_id: string; day_index: number; time: string }>(
    'SELECT habit_id, step_id, day_index, time FROM habit_step_day_times',
  );
  const map = new Map<string, TaskDayTimes>();
  for (const row of rows) {
    const key = `${row.habit_id}::${row.step_id}`;
    map.set(key, { ...(map.get(key) ?? {}), [row.day_index]: row.time });
  }
  return map;
}

function computeHistoryStats(rows: InstanceHistoryRow[], today: string) {
  const history: HabitHistory = {
    completed: [],
    skipped: [],
    missed: [],
    scheduled: [],
  };

  const byDate = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  for (const row of byDate) {
    if (row.status === 'not_applicable') continue;
    history.scheduled.push(row.date);
    if (row.status === 'completed') history.completed.push(row.date);
    if (row.status === 'skipped') history.skipped.push(row.date);
    if (row.status === 'missed') history.missed.push(row.date);
  }

  let bestStreak = 0;
  let running = 0;
  for (const row of byDate) {
    if (row.status === 'completed') {
      running += 1;
      bestStreak = Math.max(bestStreak, running);
    } else if (row.date <= today && row.status !== 'not_applicable') {
      running = 0;
    }
  }

  let currentStreak = 0;
  const pastRows = byDate.filter(row => row.date <= today && row.status !== 'not_applicable');
  for (let index = pastRows.length - 1; index >= 0; index -= 1) {
    const row = pastRows[index];
    if (row.date === today && row.status === 'pending') continue;
    if (row.status !== 'completed') break;
    currentStreak += 1;
  }

  const completedCount = history.completed.length;
  const resolvedCount = history.completed.length + history.skipped.length + history.missed.length;
  const completionRate = resolvedCount > 0 ? Math.round((completedCount / resolvedCount) * 100) : 0;
  const completedToday = rows.some(row => row.date === today && row.status === 'completed');
  const skippedToday = rows.some(row => row.date === today && row.status === 'skipped');

  return {
    history,
    completedToday,
    skippedToday,
    currentStreak,
    bestStreak,
    completionRate,
  };
}

async function loadHistoryStats(stepKeys: string[], today: string) {
  const db = await openTaskDb();
  if (!stepKeys.length) return new Map<string, ReturnType<typeof computeHistoryStats>>();

  const placeholders = stepKeys.map(() => '?').join(', ');
  const rows = await db.getAllAsync<InstanceHistoryRow>(
    `SELECT task_id, date, status
     FROM task_instances
     WHERE task_id IN (${placeholders})
       AND status <> 'not_applicable'
     ORDER BY date ASC`,
    ...stepKeys,
  );
  const grouped = new Map<string, InstanceHistoryRow[]>();
  for (const row of rows) {
    grouped.set(row.task_id, [...(grouped.get(row.task_id) ?? []), row]);
  }

  const stats = new Map<string, ReturnType<typeof computeHistoryStats>>();
  for (const stepKey of stepKeys) {
    stats.set(stepKey, computeHistoryStats(grouped.get(stepKey) ?? [], today));
  }
  return stats;
}

// Keep habit step tasks (and today's instances) in sync with the habit's icon.
// Older habit step tasks were saved with icon='Heart' before emoji icons were
// wired up. This idempotent UPDATE refreshes them to the current habit emoji.
async function syncHabitStepTaskIcons() {
  const db = await openTaskDb();
  await db.runAsync(
    `UPDATE tasks
     SET icon = (
       SELECT habits.icon FROM habits
       JOIN task_habit_config ON task_habit_config.habit_id = habits.id
       WHERE task_habit_config.task_id = tasks.id
     )
     WHERE source = 'habit'
       AND id IN (SELECT task_id FROM task_habit_config)`,
  );
  await db.runAsync(
    `UPDATE task_instances
     SET icon = (
       SELECT habits.icon FROM habits
       JOIN task_habit_config ON task_habit_config.habit_id = habits.id
       WHERE task_habit_config.task_id = task_instances.task_id
     )
     WHERE task_id IN (
       SELECT task_id FROM task_habit_config
       WHERE task_id IN (SELECT id FROM tasks WHERE source = 'habit')
     )`,
  );
}

export async function listHabitsWithStats(today = getLocalDateKey()) {
  await initHabitDb();
  await migrateTaskBackedHabits();
  await syncHabitStepTaskIcons();

  const db = await openTaskDb();
  const [habitRows, stepRows, selectedDays, monthlyDays, dayTimes] = await Promise.all([
    db.getAllAsync<HabitRow>(
      `SELECT id, name, color, icon, is_active, created_at
       FROM habits
       WHERE is_archived = 0
       ORDER BY created_at DESC`,
    ),
    db.getAllAsync<HabitStepRow>(
      `SELECT habit_id, id, title, sort_order, time, frequency, same_time_every_day,
              notification_mode, reminder_minutes
       FROM habit_steps
       ORDER BY habit_id ASC, sort_order ASC`,
    ),
    loadNumberMap('habit_step_selected_days', 'day_index'),
    loadNumberMap('habit_step_monthly_days', 'month_day'),
    loadDayTimesMap(),
  ]);

  const taskIds = stepRows.map(row => habitStepTaskId(row.habit_id, row.id));
  const historyStats = await loadHistoryStats(taskIds, today);
  const stepsByHabit = new Map<string, HabitStep[]>();

  for (const row of stepRows) {
    const rowKey = `${row.habit_id}::${row.id}`;
    const taskKey = habitStepTaskId(row.habit_id, row.id);
    const stats = historyStats.get(taskKey) ?? computeHistoryStats([], today);
    const step: HabitStep = {
      id: row.id,
      title: row.title,
      time: row.time,
      frequency: row.frequency,
      selectedDays: selectedDays.get(rowKey) ?? [],
      monthlyDays: monthlyDays.get(rowKey) ?? [1],
      sameTimeEveryDay: intToBool(row.same_time_every_day),
      dayTimes: dayTimes.get(rowKey) ?? {},
      notificationMode: row.notification_mode,
      reminderMinutes: row.reminder_minutes ?? undefined,
      completedToday: stats.completedToday,
      skippedToday: stats.skippedToday,
      currentStreak: stats.currentStreak,
      bestStreak: stats.bestStreak,
      completionRate: stats.completionRate,
      history: stats.history,
    };
    stepsByHabit.set(row.habit_id, [...(stepsByHabit.get(row.habit_id) ?? []), step]);
  }

  return habitRows.map<HabitItem>(row => ({
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    active: intToBool(row.is_active),
    steps: stepsByHabit.get(row.id) ?? [],
  }));
}

export async function listHabitsForAnalytics() {
  await initHabitDb();
  await migrateTaskBackedHabits();
  await syncHabitStepTaskIcons();

  const db = await openTaskDb();
  const rows = await db.getAllAsync<Required<Pick<HabitRow, 'id' | 'name' | 'color' | 'icon' | 'is_active' | 'is_archived' | 'created_at'>>>(
    `SELECT id, name, color, icon, is_active, is_archived, created_at
     FROM habits
     ORDER BY is_archived ASC, created_at DESC`,
  );

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    active: intToBool(row.is_active) && !intToBool(row.is_archived),
  }));
}

export async function saveHabitRecord(habit: HabitItem) {
  await initHabitDb();
  const db = await openTaskDb();
  const now = Date.now();

  await db.runAsync(
    `INSERT INTO habits (
      id, name, color, icon, is_active, is_archived, created_at, updated_at, paused_at, archived_at
    ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, NULL)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      color = excluded.color,
      icon = excluded.icon,
      is_active = excluded.is_active,
      is_archived = 0,
      updated_at = excluded.updated_at,
      paused_at = excluded.paused_at,
      archived_at = NULL`,
    habit.id,
    habit.name,
    habit.color,
    habit.icon,
    boolToInt(habit.active),
    now,
    now,
    habit.active ? null : getLocalDateKey(),
  );

  if (habit.steps.length) {
    const placeholders = habit.steps.map(() => '?').join(', ');
    await db.runAsync(
      `DELETE FROM habit_steps WHERE habit_id = ? AND id NOT IN (${placeholders})`,
      habit.id,
      ...habit.steps.map(step => step.id),
    );
  } else {
    await db.runAsync('DELETE FROM habit_steps WHERE habit_id = ?', habit.id);
  }

  for (const [index, step] of habit.steps.entries()) {
    await db.runAsync(
      `INSERT INTO habit_steps (
        habit_id, id, title, sort_order, time, frequency, same_time_every_day,
        notification_mode, reminder_minutes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(habit_id, id) DO UPDATE SET
        title = excluded.title,
        sort_order = excluded.sort_order,
        time = excluded.time,
        frequency = excluded.frequency,
        same_time_every_day = excluded.same_time_every_day,
        notification_mode = excluded.notification_mode,
        reminder_minutes = excluded.reminder_minutes,
        updated_at = excluded.updated_at`,
      habit.id,
      step.id,
      step.title,
      index,
      step.time,
      step.frequency,
      boolToInt(step.sameTimeEveryDay ?? true),
      step.notificationMode ?? 'none',
      step.notificationMode === 'double' ? step.reminderMinutes ?? null : null,
      now,
      now,
    );

    await replaceNumberRows(
      'habit_step_selected_days',
      'day_index',
      habit.id,
      step.id,
      step.frequency === 'specific_days' ? step.selectedDays ?? [] : [],
    );
    await replaceNumberRows(
      'habit_step_monthly_days',
      'month_day',
      habit.id,
      step.id,
      step.frequency === 'monthly' ? step.monthlyDays ?? [1] : [1],
    );
    await replaceDayTimes(
      habit.id,
      step.id,
      step.sameTimeEveryDay === false ? step.dayTimes ?? {} : {},
    );
  }
}

export async function setHabitRecordActive(habitId: string, active: boolean) {
  await initHabitDb();
  const db = await openTaskDb();
  await db.runAsync(
    'UPDATE habits SET is_active = ?, paused_at = ?, updated_at = ? WHERE id = ?',
    boolToInt(active),
    active ? null : getLocalDateKey(),
    Date.now(),
    habitId,
  );
}

export async function archiveHabitRecord(habitId: string) {
  await initHabitDb();
  const db = await openTaskDb();
  await db.runAsync(
    `UPDATE habits
     SET is_archived = 1, is_active = 0, archived_at = ?, updated_at = ?
     WHERE id = ?`,
    getLocalDateKey(),
    Date.now(),
    habitId,
  );
}
