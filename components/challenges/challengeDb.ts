import * as SQLite from 'expo-sqlite';
import { openUserContentDb } from '@/data/userContentDb';
import type {
  ChallengeChurchConfig,
  ChallengePrayerConfig,
  ChallengeRecord,
  ChallengeScriptureConfig,
  ChallengeStatus,
} from '@/components/challenges/challengeData';
import { getLocalDateKey } from '@/components/tasks/taskScheduler';

type ChallengeRow = {
  id: string;
  template_id: string;
  title: string;
  description: string;
  category: ChallengeRecord['category'];
  group_key: ChallengeRecord['groupKey'];
  icon: ChallengeRecord['icon'];
  status: ChallengeStatus;
  progress_current: number;
  progress_total: number | null;
  progress_unit: string;
  headline: string;
  subline: string;
  show_bar: number;
  streak: number;
  best_streak: number;
  time: string | null;
  schedule_label: string;
  pace_label: string | null;
  ended_label: string | null;
  total_units: number | null;
  duration_days: number | null;
  started_at: string;
  paused_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  last_completed_date: string | null;
  created_at: number;
  updated_at: number;
};

type ScriptureConfigRow = {
  challenge_id: string;
  chapters_per_day: number;
  time: string | null;
  same_time_every_day: number;
  notification_mode: ChallengeScriptureConfig['notificationMode'] | null;
  reminder_minutes: number | null;
};

type PrayerConfigRow = {
  challenge_id: string;
  task_kind: ChallengePrayerConfig['taskKind'];
  prayer_type: ChallengePrayerConfig['prayerType'] | null;
  prayer_rule: ChallengePrayerConfig['prayerRule'] | null;
  jesus_prayer_mode: ChallengePrayerConfig['jesusPrayerMode'] | null;
  jesus_prayer_duration: number | null;
  jesus_prayer_count: number | null;
  time: string | null;
  same_time_every_day: number;
  notification_mode: ChallengePrayerConfig['notificationMode'] | null;
  reminder_minutes: number | null;
};

type ChurchConfigRow = {
  challenge_id: string;
  frequency: ChallengeChurchConfig['frequency'];
  selected_days: string | null;
  monthly_days: string | null;
  time: string | null;
  same_time_every_day: number;
  notification_mode: ChallengeChurchConfig['notificationMode'] | null;
  reminder_minutes: number | null;
};

type DayTimeRow = {
  challenge_id: string;
  day_index: number;
  time: string;
};

type DailyStatusRow = {
  challenge_id: string;
  date: string;
  status: 'completed' | 'skipped' | 'pending';
};

let initPromise: Promise<void> | null = null;

function toInt(value: boolean) {
  return value ? 1 : 0;
}

function toBool(value: unknown) {
  return Number(value || 0) === 1;
}

export function challengeTaskId(challengeId: string) {
  return `challenge_task_${challengeId}`;
}

function parseInstanceId(instanceId: string) {
  const match = instanceId.match(/^(.*)_(\d{4}-\d{2}-\d{2})$/);
  if (!match) return null;
  return {
    taskId: match[1],
    date: match[2],
  };
}

export async function openChallengeDb() {
  const db = await openUserContentDb();
  await initChallengeDb(db);
  return db;
}

export async function initChallengeDb(db?: SQLite.SQLiteDatabase) {
  if (!initPromise) {
    initPromise = (async () => {
      const conn = db ?? await openUserContentDb();
      await conn.execAsync(`
        CREATE TABLE IF NOT EXISTS challenges (
          id TEXT PRIMARY KEY,
          template_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          category TEXT NOT NULL,
          group_key TEXT NOT NULL,
          icon TEXT NOT NULL,
          status TEXT NOT NULL,
          progress_current INTEGER NOT NULL DEFAULT 0,
          progress_total INTEGER,
          progress_unit TEXT NOT NULL,
          headline TEXT NOT NULL,
          subline TEXT NOT NULL,
          show_bar INTEGER NOT NULL DEFAULT 1,
          streak INTEGER NOT NULL DEFAULT 0,
          best_streak INTEGER NOT NULL DEFAULT 0,
          time TEXT,
          schedule_label TEXT NOT NULL,
          pace_label TEXT,
          ended_label TEXT,
          total_units INTEGER,
          duration_days INTEGER,
          started_at TEXT NOT NULL,
          paused_at TEXT,
          completed_at TEXT,
          cancelled_at TEXT,
          last_completed_date TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS challenge_scripture_config (
          challenge_id TEXT PRIMARY KEY,
          chapters_per_day INTEGER NOT NULL DEFAULT 0,
          time TEXT,
          same_time_every_day INTEGER NOT NULL DEFAULT 1,
          notification_mode TEXT,
          reminder_minutes INTEGER,
          FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS challenge_scripture_day_times (
          challenge_id TEXT NOT NULL,
          day_index INTEGER NOT NULL,
          time TEXT NOT NULL,
          PRIMARY KEY (challenge_id, day_index),
          FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS challenge_prayer_config (
          challenge_id TEXT PRIMARY KEY,
          task_kind TEXT NOT NULL,
          prayer_type TEXT,
          prayer_rule TEXT,
          jesus_prayer_mode TEXT,
          jesus_prayer_duration INTEGER,
          jesus_prayer_count INTEGER,
          time TEXT,
          same_time_every_day INTEGER NOT NULL DEFAULT 1,
          notification_mode TEXT,
          reminder_minutes INTEGER,
          FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS challenge_prayer_day_times (
          challenge_id TEXT NOT NULL,
          day_index INTEGER NOT NULL,
          time TEXT NOT NULL,
          PRIMARY KEY (challenge_id, day_index),
          FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS challenge_church_config (
          challenge_id TEXT PRIMARY KEY,
          frequency TEXT NOT NULL DEFAULT 'specific_days',
          selected_days TEXT,
          monthly_days TEXT,
          time TEXT,
          same_time_every_day INTEGER NOT NULL DEFAULT 1,
          notification_mode TEXT,
          reminder_minutes INTEGER,
          FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS challenge_church_day_times (
          challenge_id TEXT NOT NULL,
          day_index INTEGER NOT NULL,
          time TEXT NOT NULL,
          PRIMARY KEY (challenge_id, day_index),
          FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS challenge_daily_status (
          challenge_id TEXT NOT NULL,
          date TEXT NOT NULL,
          status TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (challenge_id, date),
          FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status, started_at DESC);
        CREATE INDEX IF NOT EXISTS idx_challenge_daily_status ON challenge_daily_status(date, status);
      `);
    })();
  }

  return initPromise;
}

async function replaceDayTimes(
  db: SQLite.SQLiteDatabase,
  table: 'challenge_scripture_day_times' | 'challenge_prayer_day_times' | 'challenge_church_day_times',
  challengeId: string,
  values: Record<number, string> | undefined,
) {
  await db.runAsync(`DELETE FROM ${table} WHERE challenge_id = ?`, challengeId);
  for (const [dayIndex, time] of Object.entries(values ?? {})) {
    await db.runAsync(
      `INSERT OR REPLACE INTO ${table} (challenge_id, day_index, time) VALUES (?, ?, ?)`,
      challengeId,
      Number(dayIndex),
      time,
    );
  }
}

async function saveScriptureConfig(db: SQLite.SQLiteDatabase, record: ChallengeRecord) {
  await db.runAsync('DELETE FROM challenge_scripture_config WHERE challenge_id = ?', record.id);
  await db.runAsync('DELETE FROM challenge_scripture_day_times WHERE challenge_id = ?', record.id);

  if (!record.scriptureConfig) return;
  const config = record.scriptureConfig;
  await db.runAsync(
    `INSERT OR REPLACE INTO challenge_scripture_config (
      challenge_id, chapters_per_day, time, same_time_every_day, notification_mode, reminder_minutes
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    record.id,
    config.chaptersPerDay,
    config.time ?? null,
    toInt(config.sameTimeEveryDay !== false),
    config.notificationMode ?? null,
    config.notificationMode === 'double' ? config.reminderMinutes ?? null : null,
  );
  await replaceDayTimes(db, 'challenge_scripture_day_times', record.id, config.dayTimes);
}

async function savePrayerConfig(db: SQLite.SQLiteDatabase, record: ChallengeRecord) {
  await db.runAsync('DELETE FROM challenge_prayer_config WHERE challenge_id = ?', record.id);
  await db.runAsync('DELETE FROM challenge_prayer_day_times WHERE challenge_id = ?', record.id);

  if (!record.prayerConfig) return;
  const config = record.prayerConfig;
  await db.runAsync(
    `INSERT OR REPLACE INTO challenge_prayer_config (
      challenge_id, task_kind, prayer_type, prayer_rule, jesus_prayer_mode,
      jesus_prayer_duration, jesus_prayer_count, time, same_time_every_day,
      notification_mode, reminder_minutes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    record.id,
    config.taskKind,
    config.prayerType ?? null,
    config.prayerRule ?? null,
    config.jesusPrayerMode ?? null,
    config.jesusPrayerDuration ?? null,
    config.jesusPrayerCount ?? null,
    config.time ?? null,
    toInt(config.sameTimeEveryDay !== false),
    config.notificationMode ?? null,
    config.notificationMode === 'double' ? config.reminderMinutes ?? null : null,
  );
  await replaceDayTimes(db, 'challenge_prayer_day_times', record.id, config.dayTimes);
}

function safeNumberList(value: string | null | undefined, fallback: number[]) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return fallback;
    const numbers = parsed
      .map(item => Number(item))
      .filter(item => Number.isInteger(item) && item >= 0);
    return numbers.length ? numbers : fallback;
  } catch {
    return fallback;
  }
}

async function saveChurchConfig(db: SQLite.SQLiteDatabase, record: ChallengeRecord) {
  await db.runAsync('DELETE FROM challenge_church_config WHERE challenge_id = ?', record.id);
  await db.runAsync('DELETE FROM challenge_church_day_times WHERE challenge_id = ?', record.id);

  if (!record.churchConfig) return;
  const config = record.churchConfig;
  await db.runAsync(
    `INSERT OR REPLACE INTO challenge_church_config (
      challenge_id, frequency, selected_days, monthly_days, time, same_time_every_day,
      notification_mode, reminder_minutes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    record.id,
    config.frequency,
    JSON.stringify(config.selectedDays ?? []),
    JSON.stringify(config.monthlyDays ?? [1]),
    config.time ?? null,
    toInt(config.sameTimeEveryDay !== false),
    config.notificationMode ?? null,
    config.notificationMode === 'double' ? config.reminderMinutes ?? null : null,
  );
  await replaceDayTimes(db, 'challenge_church_day_times', record.id, config.dayTimes);
}

function dayTimesFor(rows: DayTimeRow[], challengeId: string) {
  return rows
    .filter(row => row.challenge_id === challengeId)
    .reduce<Record<number, string>>((acc, row) => {
      acc[row.day_index] = row.time;
      return acc;
    }, {});
}

function dailyDatesFor(rows: DailyStatusRow[], challengeId: string, status: DailyStatusRow['status']) {
  return rows
    .filter(row => row.challenge_id === challengeId && row.status === status)
    .map(row => row.date)
    .sort();
}

function rowToRecord(
  row: ChallengeRow,
  scripture?: ScriptureConfigRow,
  scriptureDayTimes?: Record<number, string>,
  prayer?: PrayerConfigRow,
  prayerDayTimes?: Record<number, string>,
  church?: ChurchConfigRow,
  churchDayTimes?: Record<number, string>,
  dailyRows: DailyStatusRow[] = [],
): ChallengeRecord {
  return {
    id: row.id,
    templateId: row.template_id,
    title: row.title,
    description: row.description,
    category: row.category,
    groupKey: row.group_key,
    icon: row.icon,
    status: row.status,
    progressCurrent: row.progress_current,
    progressTotal: row.progress_total ?? undefined,
    progressUnit: row.progress_unit,
    headline: row.headline,
    subline: row.subline,
    showBar: toBool(row.show_bar),
    streak: row.streak,
    bestStreak: row.best_streak,
    time: row.time ?? undefined,
    scheduleLabel: row.schedule_label,
    paceLabel: row.pace_label ?? undefined,
    endedLabel: row.ended_label ?? undefined,
    totalUnits: row.total_units ?? undefined,
    durationDays: row.duration_days ?? undefined,
    startedAt: row.started_at,
    pausedAt: row.paused_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    lastCompletedDate: row.last_completed_date ?? undefined,
    completedDates: dailyDatesFor(dailyRows, row.id, 'completed'),
    skippedDates: dailyDatesFor(dailyRows, row.id, 'skipped'),
    scriptureConfig: scripture ? {
      chaptersPerDay: scripture.chapters_per_day,
      time: scripture.time ?? undefined,
      sameTimeEveryDay: toBool(scripture.same_time_every_day),
      dayTimes: scriptureDayTimes ?? {},
      notificationMode: scripture.notification_mode ?? undefined,
      reminderMinutes: scripture.reminder_minutes ?? undefined,
    } : undefined,
    prayerConfig: prayer ? {
      taskKind: prayer.task_kind,
      prayerType: prayer.prayer_type ?? undefined,
      prayerRule: prayer.prayer_rule ?? undefined,
      jesusPrayerMode: prayer.jesus_prayer_mode ?? undefined,
      jesusPrayerDuration: prayer.jesus_prayer_duration ?? undefined,
      jesusPrayerCount: prayer.jesus_prayer_count ?? undefined,
      time: prayer.time ?? undefined,
      sameTimeEveryDay: toBool(prayer.same_time_every_day),
      dayTimes: prayerDayTimes ?? {},
      notificationMode: prayer.notification_mode ?? undefined,
      reminderMinutes: prayer.reminder_minutes ?? undefined,
    } : undefined,
    churchConfig: church ? {
      frequency: church.frequency,
      selectedDays: safeNumberList(church.selected_days, [6]),
      monthlyDays: safeNumberList(church.monthly_days, [1]),
      time: church.time ?? undefined,
      sameTimeEveryDay: toBool(church.same_time_every_day),
      dayTimes: churchDayTimes ?? {},
      notificationMode: church.notification_mode ?? undefined,
      reminderMinutes: church.reminder_minutes ?? undefined,
    } : undefined,
  };
}

export async function saveChallengeRecord(record: ChallengeRecord) {
  const db = await openChallengeDb();
  const now = Date.now();
  const startedAt = record.startedAt ?? getLocalDateKey();

  await db.runAsync(
    `INSERT OR REPLACE INTO challenges (
      id, template_id, title, description, category, group_key, icon, status,
      progress_current, progress_total, progress_unit, headline, subline,
      show_bar, streak, best_streak, time, schedule_label, pace_label,
      ended_label, total_units, duration_days, started_at, paused_at,
      completed_at, cancelled_at, last_completed_date, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM challenges WHERE id = ?), ?), ?)`,
    record.id,
    record.templateId,
    record.title,
    record.description,
    record.category,
    record.groupKey,
    record.icon,
    record.status,
    record.progressCurrent,
    record.progressTotal ?? null,
    record.progressUnit,
    record.headline,
    record.subline,
    toInt(record.showBar),
    record.streak,
    record.bestStreak ?? record.streak,
    record.time ?? null,
    record.scheduleLabel,
    record.paceLabel ?? null,
    record.endedLabel ?? null,
    record.totalUnits ?? null,
    record.durationDays ?? null,
    startedAt,
    record.pausedAt ?? null,
    record.completedAt ?? null,
    record.cancelledAt ?? null,
    record.lastCompletedDate ?? null,
    record.id,
    now,
    now,
  );

  await saveScriptureConfig(db, { ...record, startedAt });
  await savePrayerConfig(db, { ...record, startedAt });
  await saveChurchConfig(db, { ...record, startedAt });
  return { ...record, startedAt };
}

export async function deleteChallengeRecord(challengeId: string) {
  const db = await openChallengeDb();
  await db.runAsync('DELETE FROM challenge_daily_status WHERE challenge_id = ?', challengeId);
  await db.runAsync('DELETE FROM challenge_scripture_day_times WHERE challenge_id = ?', challengeId);
  await db.runAsync('DELETE FROM challenge_scripture_config WHERE challenge_id = ?', challengeId);
  await db.runAsync('DELETE FROM challenge_prayer_day_times WHERE challenge_id = ?', challengeId);
  await db.runAsync('DELETE FROM challenge_prayer_config WHERE challenge_id = ?', challengeId);
  await db.runAsync('DELETE FROM challenge_church_day_times WHERE challenge_id = ?', challengeId);
  await db.runAsync('DELETE FROM challenge_church_config WHERE challenge_id = ?', challengeId);
  await db.runAsync('DELETE FROM challenges WHERE id = ?', challengeId);
}

export async function listChallengeRecords() {
  const db = await openChallengeDb();
  const [
    rows,
    scriptureRows,
    scriptureTimeRows,
    prayerRows,
    prayerTimeRows,
    churchRows,
    churchTimeRows,
    dailyRows,
  ] = await Promise.all([
    db.getAllAsync<ChallengeRow>('SELECT * FROM challenges ORDER BY started_at DESC, created_at DESC'),
    db.getAllAsync<ScriptureConfigRow>('SELECT * FROM challenge_scripture_config'),
    db.getAllAsync<DayTimeRow>('SELECT * FROM challenge_scripture_day_times'),
    db.getAllAsync<PrayerConfigRow>('SELECT * FROM challenge_prayer_config'),
    db.getAllAsync<DayTimeRow>('SELECT * FROM challenge_prayer_day_times'),
    db.getAllAsync<ChurchConfigRow>('SELECT * FROM challenge_church_config'),
    db.getAllAsync<DayTimeRow>('SELECT * FROM challenge_church_day_times'),
    db.getAllAsync<DailyStatusRow>('SELECT challenge_id, date, status FROM challenge_daily_status'),
  ]);

  const scriptureById = new Map(scriptureRows.map(row => [row.challenge_id, row]));
  const prayerById = new Map(prayerRows.map(row => [row.challenge_id, row]));
  const churchById = new Map(churchRows.map(row => [row.challenge_id, row]));

  return rows.map(row => rowToRecord(
    row,
    scriptureById.get(row.id),
    dayTimesFor(scriptureTimeRows, row.id),
    prayerById.get(row.id),
    dayTimesFor(prayerTimeRows, row.id),
    churchById.get(row.id),
    dayTimesFor(churchTimeRows, row.id),
    dailyRows,
  ));
}

function recalcStreak(rows: DailyStatusRow[]) {
  const completed = rows.filter(row => row.status === 'completed').map(row => row.date).sort();
  if (!completed.length) {
    return { currentStreak: 0, lastCompletedDate: undefined };
  }

  const skipped = new Set(rows.filter(row => row.status === 'skipped').map(row => row.date));
  let streak = 1;
  for (let index = completed.length - 1; index > 0; index -= 1) {
    const current = new Date(`${completed[index]}T12:00:00`);
    const previous = new Date(`${completed[index - 1]}T12:00:00`);
    const gapDays = Math.round((current.getTime() - previous.getTime()) / 86400000);
    if (gapDays === 1) {
      streak += 1;
      continue;
    }

    let allSkipped = gapDays > 1;
    for (let day = 1; day < gapDays; day += 1) {
      const gapDate = new Date(previous.getTime() + day * 86400000);
      if (!skipped.has(getLocalDateKey(gapDate))) {
        allSkipped = false;
        break;
      }
    }
    if (!allSkipped) break;
    streak += 1;
  }

  return {
    currentStreak: streak,
    lastCompletedDate: completed[completed.length - 1],
  };
}

function progressCopy(record: ChallengeRecord, progress: number, completedAt?: string) {
  const total = record.progressTotal ?? record.durationDays ?? record.totalUnits ?? 0;
  if (completedAt) {
    return {
      headline: `Completed ${total || progress}`,
      subline: 'Challenge completed',
    };
  }

  if (total > 0) {
    const nextDay = Math.min(progress + 1, total);
    return {
      headline: `Day ${nextDay} of ${total}`,
      subline: `${progress}/${total} ${record.progressUnit} completed`,
    };
  }

  return {
    headline: progress > 0 ? `${progress} completed` : 'Today starts fresh',
    subline: record.subline,
  };
}

export async function syncChallengeProgressForTaskInstance(
  instanceId: string,
  nextStatus: 'pending' | 'completed' | 'skipped',
) {
  const parsed = parseInstanceId(instanceId);
  if (!parsed) return;
  const db = await openChallengeDb();
  const config = await db.getFirstAsync<{ challenge_id: string; task_id: string }>(
    'SELECT task_id, challenge_id FROM task_challenge_config WHERE task_id = ? LIMIT 1',
    parsed.taskId,
  );
  if (!config) return;

  const previous = await db.getFirstAsync<{ status: DailyStatusRow['status'] }>(
    'SELECT status FROM challenge_daily_status WHERE challenge_id = ? AND date = ? LIMIT 1',
    config.challenge_id,
    parsed.date,
  );
  if (previous?.status === nextStatus) return;

  if (nextStatus === 'pending') {
    await db.runAsync(
      'DELETE FROM challenge_daily_status WHERE challenge_id = ? AND date = ?',
      config.challenge_id,
      parsed.date,
    );
  } else {
    await db.runAsync(
      `INSERT OR REPLACE INTO challenge_daily_status (
        challenge_id, date, status, updated_at
      ) VALUES (?, ?, ?, ?)`,
      config.challenge_id,
      parsed.date,
      nextStatus,
      Date.now(),
    );
  }

  const record = (await listChallengeRecords()).find(item => item.id === config.challenge_id);
  if (!record) return;

  const dailyRows = await db.getAllAsync<DailyStatusRow>(
    'SELECT challenge_id, date, status FROM challenge_daily_status WHERE challenge_id = ? ORDER BY date ASC',
    config.challenge_id,
  );
  const completedCount = dailyRows.filter(row => row.status === 'completed').length;
  const streak = recalcStreak(dailyRows);
  const total = record.progressTotal ?? record.durationDays ?? 0;
  const completedAt = total > 0 && completedCount >= total ? parsed.date : undefined;
  const copy = progressCopy(record, completedCount, completedAt);

  const nextRecord: ChallengeRecord = {
    ...record,
    status: completedAt ? 'completed' : record.status === 'completed' ? 'active' : record.status,
    progressCurrent: completedCount,
    streak: streak.currentStreak,
    bestStreak: Math.max(record.bestStreak ?? record.streak, streak.currentStreak),
    lastCompletedDate: streak.lastCompletedDate,
    completedAt,
    endedLabel: completedAt ? `Completed ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${completedAt}T12:00:00`))}` : record.endedLabel,
    headline: copy.headline,
    subline: copy.subline,
  };

  await saveChallengeRecord(nextRecord);
  if (completedAt) {
    await db.runAsync(
      'UPDATE tasks SET status = ?, removed_at = ? WHERE id = ?',
      'archived',
      completedAt,
      config.task_id,
    );
    await db.runAsync(
      'UPDATE task_active_periods SET end_date = ? WHERE task_id = ? AND end_date IS NULL',
      completedAt,
      config.task_id,
    );
  } else if (record.status === 'completed' && nextRecord.status === 'active') {
    await db.runAsync(
      'UPDATE tasks SET status = ?, removed_at = NULL WHERE id = ?',
      'active',
      config.task_id,
    );
    await db.runAsync(
      `INSERT INTO task_active_periods (task_id, start_date, activated_at)
       SELECT ?, ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM task_active_periods WHERE task_id = ? AND end_date IS NULL
       )`,
      config.task_id,
      parsed.date,
      Date.now(),
      config.task_id,
    );
  }
  await db.runAsync(
    `UPDATE task_challenge_config
     SET progress_current = ?, progress_total = ?, progress_unit = ?
     WHERE task_id = ?`,
    nextRecord.progressCurrent,
    nextRecord.progressTotal ?? 0,
    nextRecord.progressUnit,
    config.task_id,
  );
}
