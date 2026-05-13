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
import {
  getScriptureChallengeProgressUnit,
  getScriptureChallengeTotal,
  getScriptureChallengeUnitLabel,
  getScriptureChallengeUnits,
  type ScriptureChallengeUnit,
} from '@/components/scripture/scriptureChallengePlan';

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

type ScriptureSessionRow = {
  instance_id: string;
  challenge_id: string;
  date: string;
  start_unit_index: number;
  read_units: number;
  target_units: number;
  completed: number;
  created_at: number;
  updated_at: number;
};

export type ScriptureChallengeReaderSession = {
  instanceId: string;
  taskId: string;
  date: string;
  challenge: ChallengeRecord;
  allUnits: ScriptureChallengeUnit[];
  plannedUnits: ScriptureChallengeUnit[];
  startUnitIndex: number;
  targetUnits: number;
  progressBefore: number;
  progressTotal: number;
  progressUnit: string;
  unitLabel: string;
  existingReadUnits: number;
};

export type ScriptureChallengeSessionResult = {
  challengeId: string;
  progressBefore: number;
  progressAfter: number;
  progressTotal: number;
  readUnits: number;
  completed: boolean;
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

        CREATE TABLE IF NOT EXISTS challenge_scripture_sessions (
          instance_id TEXT PRIMARY KEY,
          challenge_id TEXT NOT NULL,
          date TEXT NOT NULL,
          start_unit_index INTEGER NOT NULL DEFAULT 0,
          read_units INTEGER NOT NULL DEFAULT 0,
          target_units INTEGER NOT NULL DEFAULT 0,
          completed INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status, started_at DESC);
        CREATE INDEX IF NOT EXISTS idx_challenge_daily_status ON challenge_daily_status(date, status);
        CREATE INDEX IF NOT EXISTS idx_challenge_scripture_sessions ON challenge_scripture_sessions(challenge_id, date);
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
  await db.runAsync('DELETE FROM challenge_scripture_sessions WHERE challenge_id = ?', challengeId);
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

function clampProgress(value: number, total: number) {
  if (total <= 0) return Math.max(0, value);
  return Math.max(0, Math.min(total, value));
}

function legacyScriptureProgressOffset(record: ChallengeRecord) {
  const total = getScriptureChallengeTotal(record);
  if (record.progressUnit === 'days') {
    const chaptersPerDay = Math.max(1, record.scriptureConfig?.chaptersPerDay ?? 1);
    return clampProgress(record.progressCurrent * chaptersPerDay, total);
  }
  return clampProgress(record.progressCurrent, total);
}

function sumScriptureReadUnits(rows: ScriptureSessionRow[]) {
  return rows.reduce((sum, row) => sum + Math.max(0, row.read_units), 0);
}

function scriptureRowsProgress(rows: ScriptureSessionRow[], total: number) {
  const summed = sumScriptureReadUnits(rows);
  const furthest = rows.reduce(
    (max, row) => Math.max(max, row.start_unit_index + Math.max(0, row.read_units)),
    0,
  );
  return clampProgress(Math.max(summed, furthest), total);
}

async function getScriptureSessionRows(db: SQLite.SQLiteDatabase, challengeId: string) {
  return db.getAllAsync<ScriptureSessionRow>(
    `SELECT instance_id, challenge_id, date, start_unit_index, read_units, target_units, completed, created_at, updated_at
     FROM challenge_scripture_sessions
     WHERE challenge_id = ?
     ORDER BY date ASC, created_at ASC`,
    challengeId,
  );
}

function progressFromScriptureRows(record: ChallengeRecord, rows: ScriptureSessionRow[]) {
  const total = getScriptureChallengeTotal(record);
  if (rows.length > 0) return scriptureRowsProgress(rows, total);
  return legacyScriptureProgressOffset(record);
}

function scriptureProgressCopy(record: ChallengeRecord, progress: number, completedAt?: string) {
  const total = getScriptureChallengeTotal(record);
  const unitLabel = getScriptureChallengeUnitLabel(record, progress || 2);

  if (completedAt) {
    return {
      headline: `Completed ${total || progress} ${unitLabel}`,
      subline: 'Challenge completed',
    };
  }

  const units = getScriptureChallengeUnits(record);
  const nextUnit = total > 0 ? units[Math.min(progress, Math.max(0, total - 1))] : undefined;
  return {
    headline: total > 0 ? `${progress}/${total} ${unitLabel}` : 'Ready for Scripture',
    subline: nextUnit ? `Next: ${nextUnit.ref}` : record.subline,
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

async function getTaskChallengeConfig(db: SQLite.SQLiteDatabase, taskId: string) {
  return db.getFirstAsync<{ challenge_id: string; task_id: string }>(
    'SELECT task_id, challenge_id FROM task_challenge_config WHERE task_id = ? LIMIT 1',
    taskId,
  );
}

async function getChallengeRecord(challengeId: string) {
  return (await listChallengeRecords()).find(item => item.id === challengeId);
}

function scriptureSessionTarget(record: ChallengeRecord, startUnitIndex: number) {
  const total = getScriptureChallengeTotal(record);
  const remaining = Math.max(0, total - startUnitIndex);
  const requested = Math.max(1, record.scriptureConfig?.chaptersPerDay ?? 1);
  return Math.min(requested, remaining);
}

async function getScriptureStartIndex(
  db: SQLite.SQLiteDatabase,
  record: ChallengeRecord,
  challengeId: string,
  excludeInstanceId?: string,
) {
  const rows = await getScriptureSessionRows(db, challengeId);
  const relevant = excludeInstanceId
    ? rows.filter(row => row.instance_id !== excludeInstanceId)
    : rows;
  if (relevant.length > 0) {
    return scriptureRowsProgress(relevant, getScriptureChallengeTotal(record));
  }
  return legacyScriptureProgressOffset(record);
}

export async function getScriptureChallengeReaderSession(
  instanceId: string,
): Promise<ScriptureChallengeReaderSession | null> {
  const parsed = parseInstanceId(instanceId);
  if (!parsed) return null;

  const db = await openChallengeDb();
  const config = await getTaskChallengeConfig(db, parsed.taskId);
  if (!config) return null;

  const challenge = await getChallengeRecord(config.challenge_id);
  if (!challenge || challenge.category !== 'scripture') return null;

  const allUnits = getScriptureChallengeUnits(challenge);
  const progressTotal = getScriptureChallengeTotal(challenge);
  if (!allUnits.length || progressTotal <= 0) return null;

  const existing = await db.getFirstAsync<ScriptureSessionRow>(
    `SELECT instance_id, challenge_id, date, start_unit_index, read_units, target_units, completed, created_at, updated_at
     FROM challenge_scripture_sessions
     WHERE instance_id = ?
     LIMIT 1`,
    instanceId,
  );
  const startUnitIndex = existing
    ? clampProgress(existing.start_unit_index, progressTotal)
    : await getScriptureStartIndex(db, challenge, config.challenge_id);
  const targetUnits = existing?.target_units
    ? Math.min(existing.target_units, Math.max(0, progressTotal - startUnitIndex))
    : scriptureSessionTarget(challenge, startUnitIndex);
  const plannedUnits = allUnits.slice(startUnitIndex, startUnitIndex + targetUnits);

  return {
    instanceId,
    taskId: parsed.taskId,
    date: parsed.date,
    challenge,
    allUnits,
    plannedUnits,
    startUnitIndex,
    targetUnits,
    progressBefore: startUnitIndex,
    progressTotal,
    progressUnit: getScriptureChallengeProgressUnit(challenge),
    unitLabel: getScriptureChallengeUnitLabel(challenge, Math.max(1, targetUnits)),
    existingReadUnits: existing?.read_units ?? 0,
  };
}

export async function saveScriptureChallengeSessionProgress(
  instanceId: string,
  readUnits: number,
): Promise<ScriptureChallengeSessionResult | null> {
  const parsed = parseInstanceId(instanceId);
  if (!parsed) return null;

  const db = await openChallengeDb();
  const config = await getTaskChallengeConfig(db, parsed.taskId);
  if (!config) return null;

  const challenge = await getChallengeRecord(config.challenge_id);
  if (!challenge || challenge.category !== 'scripture') return null;

  const total = getScriptureChallengeTotal(challenge);
  if (total <= 0) return null;

  const existing = await db.getFirstAsync<ScriptureSessionRow>(
    `SELECT instance_id, challenge_id, date, start_unit_index, read_units, target_units, completed, created_at, updated_at
     FROM challenge_scripture_sessions
     WHERE instance_id = ?
     LIMIT 1`,
    instanceId,
  );
  const startUnitIndex = existing
    ? clampProgress(existing.start_unit_index, total)
    : await getScriptureStartIndex(db, challenge, config.challenge_id, instanceId);
  const remaining = Math.max(0, total - startUnitIndex);
  if (remaining <= 0) {
    return {
      challengeId: config.challenge_id,
      progressBefore: startUnitIndex,
      progressAfter: startUnitIndex,
      progressTotal: total,
      readUnits: 0,
      completed: true,
    };
  }

  const targetUnits = existing?.target_units && existing.target_units > 0
    ? existing.target_units
    : scriptureSessionTarget(challenge, startUnitIndex);
  const boundedReadUnits = Math.min(remaining, Math.max(1, Math.round(readUnits)));
  const now = Date.now();

  await db.runAsync(
    `INSERT OR REPLACE INTO challenge_scripture_sessions (
      instance_id, challenge_id, date, start_unit_index, read_units, target_units,
      completed, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM challenge_scripture_sessions WHERE instance_id = ?), ?), ?)`,
    instanceId,
    config.challenge_id,
    parsed.date,
    startUnitIndex,
    boundedReadUnits,
    Math.max(targetUnits, boundedReadUnits),
    boundedReadUnits >= remaining ? 1 : 0,
    instanceId,
    now,
    now,
  );

  const progressAfter = clampProgress(startUnitIndex + boundedReadUnits, total);
  return {
    challengeId: config.challenge_id,
    progressBefore: startUnitIndex,
    progressAfter,
    progressTotal: total,
    readUnits: boundedReadUnits,
    completed: progressAfter >= total,
  };
}

async function ensureDefaultScriptureSession(
  db: SQLite.SQLiteDatabase,
  instanceId: string,
  date: string,
  challenge: ChallengeRecord,
  challengeId: string,
) {
  const existing = await db.getFirstAsync<{ instance_id: string }>(
    'SELECT instance_id FROM challenge_scripture_sessions WHERE instance_id = ? LIMIT 1',
    instanceId,
  );
  if (existing) return;

  const startUnitIndex = await getScriptureStartIndex(db, challenge, challengeId, instanceId);
  const total = getScriptureChallengeTotal(challenge);
  const targetUnits = scriptureSessionTarget(challenge, startUnitIndex);
  const readUnits = Math.min(targetUnits, Math.max(0, total - startUnitIndex));
  if (readUnits <= 0) return;

  const now = Date.now();
  await db.runAsync(
    `INSERT OR REPLACE INTO challenge_scripture_sessions (
      instance_id, challenge_id, date, start_unit_index, read_units, target_units,
      completed, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    instanceId,
    challengeId,
    date,
    startUnitIndex,
    readUnits,
    targetUnits,
    startUnitIndex + readUnits >= total ? 1 : 0,
    now,
    now,
  );
}

async function updateTaskChallengeProgress(
  db: SQLite.SQLiteDatabase,
  taskId: string,
  record: ChallengeRecord,
  fromDate: string,
) {
  const subtitle = [
    record.paceLabel,
    record.progressTotal ? `${record.progressCurrent}/${record.progressTotal} ${record.progressUnit}` : null,
  ].filter(Boolean).join(' - ') || record.scheduleLabel;

  await db.runAsync(
    'UPDATE tasks SET subtitle = ? WHERE id = ?',
    subtitle,
    taskId,
  );
  await db.runAsync(
    `UPDATE task_challenge_config
     SET progress_current = ?, progress_total = ?, progress_unit = ?
     WHERE task_id = ?`,
    record.progressCurrent,
    record.progressTotal ?? 0,
    record.progressUnit,
    taskId,
  );
  await db.runAsync(
    'UPDATE task_scripture_config SET total_units_read = ? WHERE task_id = ?',
    record.progressCurrent,
    taskId,
  );
  await db.runAsync(
    `UPDATE task_instances
     SET subtitle = ?
     WHERE task_id = ? AND date >= ? AND status <> 'not_applicable'`,
    subtitle,
    taskId,
    fromDate,
  );
}

async function applyTaskLifecycleForChallengeCompletion(
  db: SQLite.SQLiteDatabase,
  taskId: string,
  previousRecord: ChallengeRecord,
  nextRecord: ChallengeRecord,
  fallbackDate: string,
) {
  if (nextRecord.completedAt) {
    await db.runAsync(
      'UPDATE tasks SET status = ?, removed_at = ? WHERE id = ?',
      'archived',
      nextRecord.completedAt,
      taskId,
    );
    await db.runAsync(
      'UPDATE task_active_periods SET end_date = ? WHERE task_id = ? AND end_date IS NULL',
      nextRecord.completedAt,
      taskId,
    );
  } else if (previousRecord.status === 'completed' && nextRecord.status === 'active') {
    await db.runAsync(
      'UPDATE tasks SET status = ?, removed_at = NULL WHERE id = ?',
      'active',
      taskId,
    );
    await db.runAsync(
      `INSERT INTO task_active_periods (task_id, start_date, activated_at)
       SELECT ?, ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM task_active_periods WHERE task_id = ? AND end_date IS NULL
       )`,
      taskId,
      fallbackDate,
      Date.now(),
      taskId,
    );
  }
}

async function syncScriptureChallengeRecord(
  db: SQLite.SQLiteDatabase,
  taskId: string,
  challengeId: string,
  record: ChallengeRecord,
  date: string,
  emptySessionProgressFallback?: number,
) {
  const dailyRows = await db.getAllAsync<DailyStatusRow>(
    'SELECT challenge_id, date, status FROM challenge_daily_status WHERE challenge_id = ? ORDER BY date ASC',
    challengeId,
  );
  const sessionRows = await getScriptureSessionRows(db, challengeId);
  const progressTotal = getScriptureChallengeTotal(record);
  const progressCurrent = sessionRows.length > 0
    ? progressFromScriptureRows(record, sessionRows)
    : clampProgress(emptySessionProgressFallback ?? legacyScriptureProgressOffset(record), progressTotal);
  const completedAt = progressTotal > 0 && progressCurrent >= progressTotal ? date : undefined;
  const streak = recalcStreak(dailyRows);
  const copy = scriptureProgressCopy(record, progressCurrent, completedAt);

  const nextRecord: ChallengeRecord = {
    ...record,
    status: completedAt ? 'completed' : record.status === 'completed' ? 'active' : record.status,
    progressCurrent,
    progressTotal,
    progressUnit: getScriptureChallengeProgressUnit(record),
    totalUnits: progressTotal,
    streak: streak.currentStreak,
    bestStreak: Math.max(record.bestStreak ?? record.streak, streak.currentStreak),
    lastCompletedDate: streak.lastCompletedDate,
    completedAt,
    endedLabel: completedAt ? `Completed ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${completedAt}T12:00:00`))}` : undefined,
    headline: copy.headline,
    subline: copy.subline,
  };

  await saveChallengeRecord(nextRecord);
  await applyTaskLifecycleForChallengeCompletion(db, taskId, record, nextRecord, date);
  await updateTaskChallengeProgress(db, taskId, nextRecord, date);
}

export async function syncChallengeProgressForTaskInstance(
  instanceId: string,
  nextStatus: 'pending' | 'completed' | 'skipped',
) {
  const parsed = parseInstanceId(instanceId);
  if (!parsed) return;
  const db = await openChallengeDb();
  const config = await getTaskChallengeConfig(db, parsed.taskId);
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

  const record = await getChallengeRecord(config.challenge_id);
  if (!record) return;

  if (record.category === 'scripture') {
    let removedSessionProgress: number | undefined;
    if (nextStatus === 'pending') {
      const removedSession = await db.getFirstAsync<Pick<ScriptureSessionRow, 'start_unit_index'>>(
        'SELECT start_unit_index FROM challenge_scripture_sessions WHERE instance_id = ? LIMIT 1',
        instanceId,
      );
      removedSessionProgress = removedSession?.start_unit_index;
      await db.runAsync(
        'DELETE FROM challenge_scripture_sessions WHERE instance_id = ?',
        instanceId,
      );
    } else if (nextStatus === 'completed') {
      await ensureDefaultScriptureSession(db, instanceId, parsed.date, record, config.challenge_id);
    }

    await syncScriptureChallengeRecord(db, config.task_id, config.challenge_id, record, parsed.date, removedSessionProgress);
    return;
  }

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
  await applyTaskLifecycleForChallengeCompletion(db, config.task_id, record, nextRecord, parsed.date);
  await updateTaskChallengeProgress(db, config.task_id, nextRecord, parsed.date);
}
