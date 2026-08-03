import * as SQLite from 'expo-sqlite';
import { openUserContentDb } from '@/data/userContentDb';
import type {
  ChallengeChurchConfig,
  ChallengeChurchWeek,
  ChallengePrayerConfig,
  ChallengeRecord,
  ChallengeScriptureConfig,
  ChallengeStatus,
} from '@/components/challenges/challengeData';
import { getLocalDateKey } from '@/components/tasks/taskScheduler';
import {
  addChurchDays,
  churchDateFromKey,
  churchRequiredDatesForWeek,
  churchSchedulesMatch,
  churchStartWeekQualifies,
  churchWeekStart,
  evaluateChurchWeek,
  summarizeChurchWeekStreaks,
  type ChurchWeekEvaluation,
  type ChurchWeekStatus,
} from '@/components/challenges/churchWeeklyTrophies';
import { challengeIdFromTaskId } from '@/components/challenges/challenge-task-identity';
import {
  challengeUsesFiniteScriptureReader,
  resolveDayCountChallengeTotal,
  resolveDayCountProgress,
} from '@/components/challenges/challenge-progress';
import {
  CHALLENGE_COMPLETION_EVENT_INSERT_SQL,
  CHALLENGE_COMPLETION_EVENT_RETRACT_SQL,
  CHALLENGE_DAILY_STATUS_REPAIR_SQL,
  CHALLENGE_RECORD_UPSERT_SQL,
  CHALLENGE_TASK_LINK_REPAIR_SQL,
  challengeCompletionEventId,
} from '@/components/challenges/challenge-persistence-sql';
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

type ChurchTaskScheduleRow = {
  frequency: ChallengeChurchConfig['frequency'];
  time: string | null;
  same_time_every_day: number;
  notification_mode: ChallengeChurchConfig['notificationMode'] | null;
  reminder_minutes: number | null;
};

type ChurchWeekRow = {
  challenge_id: string;
  week_start: string;
  week_end: string;
  required_dates: string;
  status: ChurchWeekStatus;
  earned_at: number | null;
  celebrated_at: number | null;
  created_at: number;
  updated_at: number;
};

type ChallengeCompletionEventRow = {
  id: string;
  challenge_id: string;
  kind: 'challenge' | 'church_week';
  title: string;
  week_start: string | null;
  trophy_count: number | null;
  current_streak: number | null;
  created_at: number;
  acknowledged_at: number | null;
};

export type ChallengeCompletionCelebration = {
  eventId: string;
  challengeId: string;
  title: string;
  variant: 'challenge' | 'churchWeek';
  weekStart?: string;
  trophyCount?: number;
  currentStreak?: number;
};

export type ChurchWeekSyncResult = {
  challengeId: string;
  challengeTitle: string;
  trophyAwarded: boolean;
  week: ChallengeChurchWeek;
  trophyCount: number;
  currentStreak: number;
  celebration?: ChallengeCompletionCelebration;
};

/**
 * A day-counted challenge (prayer, journal) reaching its last day.
 *
 * Scripture reports its own finish through the reader, which is why finishing
 * a reading plan raises the trophy overlay; the day-counted categories worked
 * the completion out here, wrote `status: 'completed'` to the record — and
 * then returned null, so nothing upstream ever learned of it. The rule simply
 * stopped appearing and the last tick felt like any other tick.
 */
export type ChallengeCompletedSyncResult = {
  challengeCompleted: true;
  challengeId: string;
  challengeTitle: string;
  celebration: ChallengeCompletionCelebration;
};

export type ChallengeSyncResult = ChurchWeekSyncResult | ChallengeCompletedSyncResult;

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

function startOfDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
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
      const completionEventsExisted = !!(await conn.getFirstAsync<{ name: string }>(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'challenge_completion_events'
         LIMIT 1`,
      ));
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

        CREATE TABLE IF NOT EXISTS challenge_church_weeks (
          challenge_id TEXT NOT NULL,
          week_start TEXT NOT NULL,
          week_end TEXT NOT NULL,
          required_dates TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          earned_at INTEGER,
          celebrated_at INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (challenge_id, week_start),
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

        CREATE TABLE IF NOT EXISTS challenge_completion_events (
          id TEXT PRIMARY KEY,
          challenge_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          title TEXT NOT NULL,
          week_start TEXT,
          trophy_count INTEGER,
          current_streak INTEGER,
          created_at INTEGER NOT NULL,
          acknowledged_at INTEGER,
          FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status, started_at DESC);
        CREATE INDEX IF NOT EXISTS idx_challenge_daily_status ON challenge_daily_status(date, status);
        CREATE INDEX IF NOT EXISTS idx_challenge_scripture_sessions ON challenge_scripture_sessions(challenge_id, date);
        CREATE INDEX IF NOT EXISTS idx_challenge_church_weeks ON challenge_church_weeks(challenge_id, week_start);
        CREATE INDEX IF NOT EXISTS idx_challenge_completion_events_pending
          ON challenge_completion_events(acknowledged_at, created_at);
      `);

      const churchWeekColumns = await conn.getAllAsync<{ name: string }>(
        'PRAGMA table_info(challenge_church_weeks)',
      );
      if (!churchWeekColumns.some(column => column.name === 'celebrated_at')) {
        await conn.execAsync('ALTER TABLE challenge_church_weeks ADD COLUMN celebrated_at INTEGER;');
        // Historical trophies pre-date this acknowledgement column and should
        // not all replay. Keep only the current week unacknowledged so a trophy
        // affected by the old missing-popup bug gets one recovery celebration.
        await conn.runAsync(
          `UPDATE challenge_church_weeks
           SET celebrated_at = earned_at
           WHERE status = 'earned' AND celebrated_at IS NULL AND week_start < ?`,
          churchWeekStart(getLocalDateKey()),
        );
      }

      if (!completionEventsExisted) {
        const now = Date.now();
        // Recent completions may be exactly the rewards lost by the old RAM
        // queue. Recover those once; seed older ids as acknowledged so an
        // upgrade cannot replay a whole archive.
        await conn.runAsync(
          `INSERT OR IGNORE INTO challenge_completion_events (
             id, challenge_id, kind, title, created_at, acknowledged_at
           )
           SELECT 'challenge:' || id, id, 'challenge', title,
                  COALESCE(updated_at, ?),
                  CASE WHEN completed_at >= ? THEN NULL ELSE COALESCE(updated_at, ?) END
           FROM challenges
           WHERE status = 'completed'`,
          now,
          addChurchDays(getLocalDateKey(), -7),
          now,
        );
        // Keep an unacknowledged current-week Church trophy recoverable. Older
        // rows are seeded as acknowledged so an upgrade never floods Home with
        // months of historical popups.
        await conn.runAsync(
          `INSERT OR IGNORE INTO challenge_completion_events (
             id, challenge_id, kind, title, week_start, trophy_count,
             current_streak, created_at, acknowledged_at
           )
           SELECT 'church_week:' || week.challenge_id || ':' || week.week_start,
                  week.challenge_id, 'church_week', challenge.title,
                  week.week_start,
                  (SELECT COUNT(*) FROM challenge_church_weeks earned
                   WHERE earned.challenge_id = week.challenge_id
                     AND earned.status = 'earned'
                     AND earned.week_start <= week.week_start),
                  challenge.streak,
                  COALESCE(week.earned_at, week.updated_at, ?),
                  COALESCE(
                    week.celebrated_at,
                    CASE WHEN week.week_start < ?
                      THEN COALESCE(week.earned_at, week.updated_at, ?)
                      ELSE NULL
                    END
                  )
           FROM challenge_church_weeks week
           JOIN challenges challenge ON challenge.id = week.challenge_id
           WHERE week.status = 'earned'`,
          now,
          churchWeekStart(getLocalDateKey()),
          now,
        );
      }
    })();
    initPromise = initPromise.catch(error => {
      // A transient native SQLite startup error must not poison every later
      // attempt for the remainder of the app process.
      initPromise = null;
      throw error;
    });
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
  await replaceChurchConfig(db, record.id, record.churchConfig);
}

async function replaceChurchConfig(
  db: SQLite.SQLiteDatabase,
  challengeId: string,
  config: ChallengeChurchConfig | undefined,
) {
  await db.runAsync('DELETE FROM challenge_church_config WHERE challenge_id = ?', challengeId);
  await db.runAsync('DELETE FROM challenge_church_day_times WHERE challenge_id = ?', challengeId);

  if (!config) return;
  await db.runAsync(
    `INSERT OR REPLACE INTO challenge_church_config (
      challenge_id, frequency, selected_days, monthly_days, time, same_time_every_day,
      notification_mode, reminder_minutes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    challengeId,
    config.frequency,
    JSON.stringify(config.selectedDays ?? []),
    JSON.stringify(config.monthlyDays ?? [1]),
    config.time ?? null,
    toInt(config.sameTimeEveryDay !== false),
    config.notificationMode ?? null,
    config.notificationMode === 'double' ? config.reminderMinutes ?? null : null,
  );
  await replaceDayTimes(db, 'challenge_church_day_times', challengeId, config.dayTimes);
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
    createdAt: row.created_at,
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

async function getStoredChurchConfig(
  db: SQLite.SQLiteDatabase,
  challengeId: string,
): Promise<ChallengeChurchConfig | undefined> {
  const row = await db.getFirstAsync<ChurchConfigRow>(
    'SELECT * FROM challenge_church_config WHERE challenge_id = ? LIMIT 1',
    challengeId,
  );
  if (!row) return undefined;
  const timeRows = await db.getAllAsync<DayTimeRow>(
    'SELECT challenge_id, day_index, time FROM challenge_church_day_times WHERE challenge_id = ?',
    challengeId,
  );
  return {
    frequency: row.frequency,
    selectedDays: safeNumberList(row.selected_days, [6]),
    monthlyDays: safeNumberList(row.monthly_days, [1]),
    time: row.time ?? undefined,
    sameTimeEveryDay: toBool(row.same_time_every_day),
    dayTimes: dayTimesFor(timeRows, challengeId),
    notificationMode: row.notification_mode ?? undefined,
    reminderMinutes: row.reminder_minutes ?? undefined,
  };
}

async function getChurchConfigFromTask(
  db: SQLite.SQLiteDatabase,
  taskId: string,
): Promise<ChallengeChurchConfig | null> {
  const row = await db.getFirstAsync<ChurchTaskScheduleRow>(
    `SELECT frequency, time, same_time_every_day, notification_mode, reminder_minutes
     FROM tasks
     WHERE id = ? AND source = 'challenge'
     LIMIT 1`,
    taskId,
  );
  if (!row) return null;
  const [selectedRows, monthlyRows, timeRows] = await Promise.all([
    db.getAllAsync<{ day_index: number }>(
      'SELECT day_index FROM task_schedule_days WHERE task_id = ? ORDER BY day_index ASC',
      taskId,
    ),
    db.getAllAsync<{ month_day: number }>(
      'SELECT month_day FROM task_schedule_month_days WHERE task_id = ? ORDER BY month_day ASC',
      taskId,
    ),
    db.getAllAsync<{ day_index: number; time: string }>(
      'SELECT day_index, time FROM task_day_times WHERE task_id = ? ORDER BY day_index ASC',
      taskId,
    ),
  ]);
  return {
    frequency: row.frequency,
    selectedDays: selectedRows.map(item => item.day_index),
    monthlyDays: monthlyRows.map(item => item.month_day),
    time: row.time ?? undefined,
    sameTimeEveryDay: toBool(row.same_time_every_day),
    dayTimes: Object.fromEntries(timeRows.map(item => [item.day_index, item.time])),
    notificationMode: row.notification_mode ?? undefined,
    reminderMinutes: row.reminder_minutes ?? undefined,
  };
}

/**
 * The task schedule is what the user can actually see and check on Home, so
 * it is the authoritative Church scoring schedule if a legacy/partial write
 * left the two stores apart. Reset only the still-unearned current week; earned
 * history remains immutable and schedule edits continue to affect next week.
 */
async function synchronizeChurchConfigFromTask(
  db: SQLite.SQLiteDatabase,
  challengeId: string,
  taskId: string,
  referenceDate: string,
) {
  const challenge = await db.getFirstAsync<{ category: ChallengeRecord['category'] }>(
    'SELECT category FROM challenges WHERE id = ? LIMIT 1',
    challengeId,
  );
  if (challenge?.category !== 'church') return false;

  const taskConfig = await getChurchConfigFromTask(db, taskId);
  if (!taskConfig) return false;
  const storedConfig = await getStoredChurchConfig(db, challengeId);
  if (churchSchedulesMatch(storedConfig, taskConfig)) return false;

  await replaceChurchConfig(db, challengeId, taskConfig);
  await db.runAsync(
    `DELETE FROM challenge_church_weeks
     WHERE challenge_id = ? AND week_start = ?
       AND status <> 'earned' AND earned_at IS NULL`,
    challengeId,
    churchWeekStart(referenceDate),
  );
  return true;
}

async function persistChallengeRecord(db: SQLite.SQLiteDatabase, record: ChallengeRecord) {
  const now = Date.now();
  const startedAt = record.startedAt ?? getLocalDateKey();

  await db.runAsync(
    CHALLENGE_RECORD_UPSERT_SQL,
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
    record.createdAt ?? now,
    now,
  );

  await saveScriptureConfig(db, { ...record, startedAt });
  await savePrayerConfig(db, { ...record, startedAt });
  await saveChurchConfig(db, { ...record, startedAt });
  return { ...record, startedAt };
}

export async function saveChallengeRecord(record: ChallengeRecord) {
  const db = await openChallengeDb();
  let saved: ChallengeRecord | undefined;
  await db.withTransactionAsync(async () => {
    saved = await persistChallengeRecord(db, record);
  });
  return saved ?? record;
}

export async function deleteChallengeRecord(challengeId: string) {
  const db = await openChallengeDb();
  await db.runAsync('DELETE FROM challenge_daily_status WHERE challenge_id = ?', challengeId);
  await db.runAsync('DELETE FROM challenge_church_weeks WHERE challenge_id = ?', challengeId);
  await db.runAsync('DELETE FROM challenge_scripture_sessions WHERE challenge_id = ?', challengeId);
  await db.runAsync('DELETE FROM challenge_scripture_day_times WHERE challenge_id = ?', challengeId);
  await db.runAsync('DELETE FROM challenge_scripture_config WHERE challenge_id = ?', challengeId);
  await db.runAsync('DELETE FROM challenge_prayer_day_times WHERE challenge_id = ?', challengeId);
  await db.runAsync('DELETE FROM challenge_prayer_config WHERE challenge_id = ?', challengeId);
  await db.runAsync('DELETE FROM challenge_church_day_times WHERE challenge_id = ?', challengeId);
  await db.runAsync('DELETE FROM challenge_church_config WHERE challenge_id = ?', challengeId);
  await db.runAsync('DELETE FROM challenges WHERE id = ?', challengeId);
}

function safeStringList(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter(item => typeof item === 'string'))].sort();
  } catch {
    return [];
  }
}

function toChallengeChurchWeek(week: ChurchWeekEvaluation): ChallengeChurchWeek {
  return {
    weekStart: week.weekStart,
    weekEnd: week.weekEnd,
    requiredDates: week.requiredDates,
    completedDates: week.completedDates,
    requiredCount: week.requiredCount,
    completedCount: week.completedCount,
    status: week.status,
  };
}

async function writeChurchWeek(
  db: SQLite.SQLiteDatabase,
  challengeId: string,
  week: ChurchWeekEvaluation,
  previous?: ChurchWeekRow,
) {
  const now = Date.now();
  const earnedAt = week.status === 'earned'
    ? previous?.earned_at ?? now
    : previous?.earned_at ?? null;
  // An explicit uncheck revokes this completion occurrence. Keep the original
  // earned timestamp for the week's identity, but clear delivery state so a
  // later re-check can celebrate the restored trophy without adding a second
  // week to History.
  const celebratedAt = week.status === 'earned' ? previous?.celebrated_at ?? null : null;
  await db.runAsync(
    `INSERT OR REPLACE INTO challenge_church_weeks (
      challenge_id, week_start, week_end, required_dates, status,
      earned_at, celebrated_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM challenge_church_weeks WHERE challenge_id = ? AND week_start = ?), ?), ?)`,
    challengeId,
    week.weekStart,
    week.weekEnd,
    JSON.stringify(week.requiredDates),
    week.status,
    earnedAt,
    celebratedAt,
    challengeId,
    week.weekStart,
    now,
    now,
  );
}

async function reconcileChurchWeeks(
  db: SQLite.SQLiteDatabase,
  record: ChallengeRecord,
  todayKey = getLocalDateKey(),
) {
  const config: ChallengeChurchConfig = record.churchConfig ?? {
    frequency: 'specific_days',
    selectedDays: [6],
  };
  const [storedRows, dailyRows] = await Promise.all([
    db.getAllAsync<ChurchWeekRow>(
      'SELECT * FROM challenge_church_weeks WHERE challenge_id = ? ORDER BY week_start ASC',
      record.id,
    ),
    db.getAllAsync<DailyStatusRow>(
      'SELECT challenge_id, date, status FROM challenge_daily_status WHERE challenge_id = ? ORDER BY date ASC',
      record.id,
    ),
  ]);
  const storedByWeek = new Map(storedRows.map(row => [row.week_start, row]));
  const completedDates = new Set(dailyRows.filter(row => row.status === 'completed').map(row => row.date));
  const skippedDates = new Set(dailyRows.filter(row => row.status === 'skipped').map(row => row.date));
  const firstWeek = churchWeekStart(record.startedAt ?? todayKey);
  const currentWeekStart = churchWeekStart(todayKey);
  const startedDate = record.startedAt ? churchDateFromKey(record.startedAt) : null;
  const startedDayIndex = startedDate
    ? (startedDate.getDay() === 0 ? 6 : startedDate.getDay() - 1)
    : 6;
  const startDayTime = config.sameTimeEveryDay === false
    ? config.dayTimes?.[startedDayIndex] ?? config.time
    : config.time;
  const evaluations: ChurchWeekEvaluation[] = [];

  // A Church rhythm is open-ended. Materializing one compact row per week
  // keeps its scoring deterministic even after the user later changes days.
  for (let weekStart = firstWeek; weekStart <= currentWeekStart; weekStart = addChurchDays(weekStart, 7)) {
    const previous = storedByWeek.get(weekStart);
    const requiredDates = previous
      ? safeStringList(previous.required_dates)
      : churchRequiredDatesForWeek(config, weekStart);
    const isStartWeek = weekStart === firstWeek;
    const pausedThisWeek = record.status === 'paused'
      && !!record.pausedAt
      && weekStart >= churchWeekStart(record.pausedAt);
    const practice = previous?.status === 'practice'
      || (!previous && isStartWeek && !churchStartWeekQualifies(
        requiredDates,
        record.startedAt,
        record.createdAt,
        startDayTime,
      ))
      || (!previous && pausedThisWeek);
    const evaluation = evaluateChurchWeek({
      weekStart,
      requiredDates,
      completedDates,
      skippedDates,
      todayKey,
      practice,
    });
    evaluations.push(evaluation);

    const requiredJson = JSON.stringify(evaluation.requiredDates);
    if (
      !previous
      || previous.status !== evaluation.status
      || previous.week_end !== evaluation.weekEnd
      || previous.required_dates !== requiredJson
    ) {
      await writeChurchWeek(db, record.id, evaluation, previous);
    }
  }

  const trophyWeeks = evaluations
    .filter(week => week.status === 'earned')
    .map(week => week.weekStart);
  const currentWeek = evaluations.find(week => week.weekStart === currentWeekStart)
    ?? evaluateChurchWeek({
      weekStart: currentWeekStart,
      requiredDates: churchRequiredDatesForWeek(config, currentWeekStart),
      completedDates,
      skippedDates,
      todayKey,
    });
  const streaks = summarizeChurchWeekStreaks(evaluations);

  const weeklyCopy = currentWeek.status === 'practice'
    ? { headline: 'Practice week', subline: 'Your next full week can earn a trophy' }
    : currentWeek.status === 'earned'
      ? { headline: `${currentWeek.completedCount}/${currentWeek.requiredCount} this week`, subline: 'Weekly trophy earned' }
      : currentWeek.status === 'missed'
        ? { headline: `${currentWeek.completedCount}/${currentWeek.requiredCount} this week`, subline: 'A fresh trophy week begins Monday' }
        : {
          headline: `${currentWeek.completedCount}/${currentWeek.requiredCount} this week`,
          subline: currentWeek.requiredCount === 1
            ? 'Complete this visit to earn the weekly trophy'
            : 'Complete every planned visit to earn the weekly trophy',
        };

  return {
    record: {
      ...record,
      progressCurrent: trophyWeeks.length,
      progressUnit: 'trophies',
      headline: weeklyCopy.headline,
      subline: weeklyCopy.subline,
      streak: streaks.current,
      bestStreak: streaks.best,
      lastCompletedDate: trophyWeeks.length
        ? addChurchDays(trophyWeeks[trophyWeeks.length - 1], 6)
        : undefined,
      churchWeek: toChallengeChurchWeek(currentWeek),
      churchTrophyWeeks: trophyWeeks,
      churchTrophyCount: trophyWeeks.length,
    } satisfies ChallengeRecord,
    currentWeek,
  };
}

export async function markChurchWeeksPractice(
  record: ChallengeRecord,
  fromDate: string,
  throughDate: string = fromDate,
) {
  if (record.category !== 'church') return;
  const db = await openChallengeDb();
  const config = record.churchConfig ?? { frequency: 'specific_days' as const, selectedDays: [6] };
  const first = churchWeekStart(fromDate);
  const last = churchWeekStart(throughDate);

  for (let weekStart = first; weekStart <= last; weekStart = addChurchDays(weekStart, 7)) {
    const previous = await db.getFirstAsync<ChurchWeekRow>(
      'SELECT * FROM challenge_church_weeks WHERE challenge_id = ? AND week_start = ? LIMIT 1',
      record.id,
      weekStart,
    );
    if (previous?.status === 'earned') continue;
    const evaluation = evaluateChurchWeek({
      weekStart,
      requiredDates: previous
        ? safeStringList(previous.required_dates)
        : churchRequiredDatesForWeek(config, weekStart),
      completedDates: [],
      skippedDates: [],
      todayKey: throughDate,
      practice: true,
    });
    await writeChurchWeek(db, record.id, evaluation, previous ?? undefined);
  }
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

  const records = rows.map(row => rowToRecord(
    row,
    scriptureById.get(row.id),
    dayTimesFor(scriptureTimeRows, row.id),
    prayerById.get(row.id),
    dayTimesFor(prayerTimeRows, row.id),
    churchById.get(row.id),
    dayTimesFor(churchTimeRows, row.id),
    dailyRows,
  ));

  return Promise.all(records.map(async record => (
    record.category === 'church'
      ? (await reconcileChurchWeeks(db, record)).record
      : record
  )));
}

function eventRowToCelebration(row: ChallengeCompletionEventRow): ChallengeCompletionCelebration {
  return {
    eventId: row.id,
    challengeId: row.challenge_id,
    title: row.title,
    variant: row.kind === 'church_week' ? 'churchWeek' : 'challenge',
    weekStart: row.week_start ?? undefined,
    trophyCount: row.trophy_count ?? undefined,
    currentStreak: row.current_streak ?? undefined,
  };
}

async function createChallengeCompletionEvent(
  db: SQLite.SQLiteDatabase,
  celebration: Omit<ChallengeCompletionCelebration, 'eventId'>,
) {
  const kind: ChallengeCompletionEventRow['kind'] = celebration.variant === 'churchWeek'
    ? 'church_week'
    : 'challenge';
  const eventId = challengeCompletionEventId(kind, celebration.challengeId, celebration.weekStart);
  const createdAt = Date.now();
  const inserted = await db.runAsync(
    CHALLENGE_COMPLETION_EVENT_INSERT_SQL,
    eventId,
    celebration.challengeId,
    kind,
    celebration.title,
    celebration.weekStart ?? null,
    celebration.trophyCount ?? null,
    celebration.currentStreak ?? null,
    createdAt,
  );
  if (inserted.changes === 0) return null;
  return { ...celebration, eventId } satisfies ChallengeCompletionCelebration;
}

async function retractChallengeCompletionEvent(
  db: SQLite.SQLiteDatabase,
  kind: ChallengeCompletionEventRow['kind'],
  challengeId: string,
  weekStart?: string,
) {
  await db.runAsync(
    CHALLENGE_COMPLETION_EVENT_RETRACT_SQL,
    challengeCompletionEventId(kind, challengeId, weekStart),
  );
}

async function repairChurchRewardInputs(db: SQLite.SQLiteDatabase) {
  const taskStoreReady = !!(await db.getFirstAsync<{ name: string }>(
    `SELECT name FROM sqlite_master
     WHERE type = 'table' AND name = 'task_instances'
     LIMIT 1`,
  ));
  if (!taskStoreReady) return;

  await db.withTransactionAsync(async () => {
    await db.runAsync(CHALLENGE_TASK_LINK_REPAIR_SQL);
    await synchronizeStoredChurchConfigs(db);
    await db.runAsync(CHALLENGE_DAILY_STATUS_REPAIR_SQL, Date.now());
  });
}

/**
 * Returns the oldest reward that has not yet been dismissed on Home.
 *
 * Unlike the previous in-memory return queue, this outbox survives native
 * route timing, background notification actions, process death and app
 * restarts. Reconciliation runs first so legacy Church progress is visible.
 */
export async function getPendingChallengeCelebration(): Promise<ChallengeCompletionCelebration | null> {
  const db = await openChallengeDb();
  // Home is the final delivery boundary. Reconcile the two legacy stores here
  // as well as at TaskProvider boot so Fast Refresh, notification actions and
  // previously checked Church tasks cannot leave the popup/history waiting for
  // another process restart.
  await repairChurchRewardInputs(db);
  const records = await listChallengeRecords();
  let pending = await db.getFirstAsync<ChallengeCompletionEventRow>(
    `SELECT * FROM challenge_completion_events
     WHERE acknowledged_at IS NULL
     ORDER BY created_at ASC, id ASC
     LIMIT 1`,
  );

  // Compatibility bridge for a Church trophy earned by a build that had only
  // `celebrated_at`. Limit recovery to the current week so old achievements do
  // not replay in a burst after an upgrade.
  if (!pending) {
    const currentWeekStart = churchWeekStart(getLocalDateKey());
    const legacy = await db.getFirstAsync<Pick<ChurchWeekRow, 'challenge_id' | 'week_start'>>(
      `SELECT challenge_id, week_start
       FROM challenge_church_weeks
       WHERE status = 'earned' AND celebrated_at IS NULL AND week_start = ?
       ORDER BY earned_at DESC
       LIMIT 1`,
      currentWeekStart,
    );
    const record = legacy ? records.find(item => item.id === legacy.challenge_id) : undefined;
    if (legacy && record) {
      await createChallengeCompletionEvent(db, {
        challengeId: record.id,
        title: record.title,
        variant: 'churchWeek',
        weekStart: legacy.week_start,
        trophyCount: record.churchTrophyCount ?? 0,
        currentStreak: record.streak,
      });
      pending = await db.getFirstAsync<ChallengeCompletionEventRow>(
        `SELECT * FROM challenge_completion_events
         WHERE acknowledged_at IS NULL
         ORDER BY created_at ASC, id ASC
         LIMIT 1`,
      );
    }
  }

  return pending ? eventRowToCelebration(pending) : null;
}

export async function acknowledgeChallengeCelebration(eventId: string) {
  const db = await openChallengeDb();
  const event = await db.getFirstAsync<ChallengeCompletionEventRow>(
    'SELECT * FROM challenge_completion_events WHERE id = ? LIMIT 1',
    eventId,
  );
  if (!event) return;

  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE challenge_completion_events
       SET acknowledged_at = ?
       WHERE id = ? AND acknowledged_at IS NULL`,
      now,
      eventId,
    );
    if (event.kind === 'church_week' && event.week_start) {
      await db.runAsync(
        `UPDATE challenge_church_weeks
         SET celebrated_at = ?, updated_at = ?
         WHERE challenge_id = ? AND week_start = ? AND status = 'earned'`,
        now,
        now,
        event.challenge_id,
        event.week_start,
      );
    }
  });
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
  const total = resolveDayCountChallengeTotal(record);
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

function buildDayCountProgressRecord(
  record: ChallengeRecord,
  dailyRows: DailyStatusRow[],
  completionDate: string,
) {
  const { completedCount, total, completedAt } = resolveDayCountProgress(
    record,
    dailyRows.map(row => row.status),
    completionDate,
  );
  const streak = recalcStreak(dailyRows);
  const copy = progressCopy(record, completedCount, completedAt);
  const nextRecord: ChallengeRecord = {
    ...record,
    status: completedAt ? 'completed' : record.status === 'completed' ? 'active' : record.status,
    progressCurrent: completedCount,
    progressTotal: record.templateId === 'lectionary_daily' ? total : record.progressTotal,
    streak: streak.currentStreak,
    bestStreak: Math.max(record.bestStreak ?? record.streak, streak.currentStreak),
    lastCompletedDate: streak.lastCompletedDate,
    completedAt,
    endedLabel: completedAt
      ? `Completed ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${completedAt}T12:00:00`))}`
      : record.status === 'completed'
        ? undefined
        : record.endedLabel,
    headline: copy.headline,
    subline: copy.subline,
  };
  return { nextRecord, completedAt };
}

async function getTaskChallengeConfig(db: SQLite.SQLiteDatabase, taskId: string) {
  const stored = await db.getFirstAsync<{ challenge_id: string; task_id: string }>(
    `SELECT config.task_id, config.challenge_id
     FROM task_challenge_config config
     JOIN challenges challenge ON challenge.id = config.challenge_id
     WHERE config.task_id = ?
     LIMIT 1`,
    taskId,
  );
  if (stored) return stored;

  // Challenge tasks created by older app versions can exist without their
  // config row. The task id has always carried the challenge id, so repair the
  // missing relationship at the exact point where progress needs it.
  const challengeId = challengeIdFromTaskId(taskId);
  if (!challengeId) return null;
  const legacyPair = await db.getFirstAsync<{ task_id: string; challenge_id: string; template_id: string }>(
    `SELECT t.id AS task_id, c.id AS challenge_id, c.template_id
     FROM tasks t
     JOIN challenges c ON c.id = ?
     WHERE t.id = ? AND t.source = 'challenge'
     LIMIT 1`,
    challengeId,
    taskId,
  );
  if (!legacyPair) return null;
  await db.runAsync(
    `INSERT INTO task_challenge_config (
      task_id, challenge_id, template_id, progress_current, progress_total, progress_unit
    ) SELECT ?, id, template_id, progress_current,
        COALESCE(progress_total, duration_days, total_units, 0), progress_unit
      FROM challenges WHERE id = ?
      ON CONFLICT(task_id) DO UPDATE SET
        challenge_id = excluded.challenge_id,
        template_id = excluded.template_id,
        progress_current = excluded.progress_current,
        progress_total = excluded.progress_total,
        progress_unit = excluded.progress_unit`,
    taskId,
    challengeId,
  );
  return { task_id: legacyPair.task_id, challenge_id: legacyPair.challenge_id };
}

async function reconcileStoredDayCountChallenges(db: SQLite.SQLiteDatabase) {
  const records = await listChallengeRecords();
  const dailyRows = await db.getAllAsync<DailyStatusRow>(
    'SELECT challenge_id, date, status FROM challenge_daily_status ORDER BY date ASC',
  );
  let repaired = 0;

  for (const record of records) {
    const dayCounted = record.category === 'prayer'
      || record.category === 'journal'
      || record.templateId === 'lectionary_daily';
    if (!dayCounted) continue;

    const rows = dailyRows.filter(row => row.challenge_id === record.id);
    if (rows.length === 0) continue;
    const completedRows = rows.filter(row => row.status === 'completed');
    // Never reduce trusted legacy progress when old task snapshots themselves
    // are missing. This repair is for recoverable checked instances only.
    if (completedRows.length < record.progressCurrent) continue;

    const completionDate = completedRows.at(-1)?.date ?? getLocalDateKey();
    const { nextRecord, completedAt } = buildDayCountProgressRecord(record, rows, completionDate);
    const changed = nextRecord.progressCurrent !== record.progressCurrent
      || nextRecord.status !== record.status
      || nextRecord.completedAt !== record.completedAt
      || nextRecord.streak !== record.streak
      || nextRecord.lastCompletedDate !== record.lastCompletedDate;
    if (!changed) continue;

    const taskId = challengeTaskId(record.id);
    await persistChallengeRecord(db, nextRecord);
    await applyTaskLifecycleForChallengeCompletion(db, taskId, record, nextRecord, completionDate);
    await updateTaskChallengeProgress(db, taskId, nextRecord, completionDate);

    if (!completedAt && record.completedAt) {
      await retractChallengeCompletionEvent(db, 'challenge', record.id);
    } else if (completedAt && !record.completedAt) {
      const celebration = await createChallengeCompletionEvent(db, {
        challengeId: nextRecord.id,
        title: nextRecord.title,
        variant: 'challenge',
      });
      if (celebration && completionDate < addChurchDays(getLocalDateKey(), -7)) {
        await db.runAsync(
          'UPDATE challenge_completion_events SET acknowledged_at = ? WHERE id = ?',
          Date.now(),
          celebration.eventId,
        );
      }
    }
    repaired += 1;
  }

  return repaired;
}

async function synchronizeStoredChurchConfigs(db: SQLite.SQLiteDatabase) {
  const rows = await db.getAllAsync<{ challenge_id: string; task_id: string }>(
    `SELECT challenge.id AS challenge_id, task.id AS task_id
     FROM challenges challenge
     JOIN tasks task ON task.id = ('challenge_task_' || challenge.id)
     WHERE challenge.category = 'church'
       AND task.source = 'challenge'`,
  );
  let repaired = 0;
  for (const row of rows) {
    if (await synchronizeChurchConfigFromTask(
      db,
      row.challenge_id,
      row.task_id,
      getLocalDateKey(),
    )) repaired += 1;
  }
  return repaired;
}

async function reconcileStoredChurchChallenges(db: SQLite.SQLiteDatabase) {
  const currentWeekStart = churchWeekStart(getLocalDateKey());
  const records = await listChallengeRecords();
  let repaired = 0;
  for (const record of records) {
    if (
      record.category !== 'church'
      || record.churchWeek?.weekStart !== currentWeekStart
      || record.churchWeek.status !== 'earned'
    ) continue;
    const celebration = await createChallengeCompletionEvent(db, {
      challengeId: record.id,
      title: record.title,
      variant: 'churchWeek',
      weekStart: currentWeekStart,
      trophyCount: record.churchTrophyCount ?? 0,
      currentStreak: record.streak,
    });
    if (celebration) repaired += 1;
  }
  return repaired;
}

/** Repairs Church history even when the user opens Challenges before Home. */
export async function repairChurchChallengeState() {
  const db = await openChallengeDb();
  await repairChurchRewardInputs(db);
  return reconcileStoredChurchChallenges(db);
}

/**
 * Repairs challenge tasks made before task_challenge_config was introduced,
 * then imports their already checked/skipped instances into challenge
 * progress. Without this bridge Home looked complete while Challenges still
 * saw zero progress, which also meant no trophy event could be emitted.
 */
export async function repairLegacyChallengeTaskProgress() {
  const db = await openChallengeDb();
  let repairedLinks = 0;
  let repairedChurchConfigs = 0;
  let importedStatuses = 0;
  let reconciledRecords = 0;
  let reconciledChurchRewards = 0;
  await db.withTransactionAsync(async () => {
    repairedLinks = (await db.runAsync(CHALLENGE_TASK_LINK_REPAIR_SQL)).changes;
    repairedChurchConfigs = await synchronizeStoredChurchConfigs(db);
    importedStatuses = (await db.runAsync(
      CHALLENGE_DAILY_STATUS_REPAIR_SQL,
      Date.now(),
    )).changes;
    reconciledRecords = await reconcileStoredDayCountChallenges(db);
    reconciledChurchRewards = await reconcileStoredChurchChallenges(db);
  });

  return repairedLinks
    + repairedChurchConfigs
    + importedStatuses
    + reconciledRecords
    + reconciledChurchRewards;
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
    const reopened = await db.runAsync(
      `UPDATE task_active_periods
       SET end_date = NULL
       WHERE task_id = ? AND end_date = ?`,
      taskId,
      fallbackDate,
    );
    if (reopened.changes > 0) return;

    const taskRow = await db.getFirstAsync<{ activated_at: number | null }>(
      'SELECT activated_at FROM tasks WHERE id = ? LIMIT 1',
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
      taskRow?.activated_at ?? startOfDateKey(fallbackDate),
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

  await persistChallengeRecord(db, nextRecord);
  await applyTaskLifecycleForChallengeCompletion(db, taskId, record, nextRecord, date);
  await updateTaskChallengeProgress(db, taskId, nextRecord, date);

  if (!completedAt && record.completedAt) {
    await retractChallengeCompletionEvent(db, 'challenge', nextRecord.id);
  }
  if (completedAt && !record.completedAt) {
    const celebration = await createChallengeCompletionEvent(db, {
      challengeId: nextRecord.id,
      title: nextRecord.title,
      variant: 'challenge',
    });
    if (celebration) {
      return {
        challengeCompleted: true,
        challengeId: nextRecord.id,
        challengeTitle: nextRecord.title,
        celebration,
      } satisfies ChallengeCompletedSyncResult;
    }
  }
  return null;
}

export async function syncChallengeProgressForTaskInstance(
  instanceId: string,
  nextStatus: 'pending' | 'completed' | 'skipped',
): Promise<ChallengeSyncResult | null> {
  const parsed = parseInstanceId(instanceId);
  if (!parsed) return null;
  const db = await openChallengeDb();
  const config = await getTaskChallengeConfig(db, parsed.taskId);
  if (!config) return null;
  await synchronizeChurchConfigFromTask(
    db,
    config.challenge_id,
    config.task_id,
    parsed.date,
  );
  const weekStart = churchWeekStart(parsed.date);

  const previous = await db.getFirstAsync<{ status: DailyStatusRow['status'] }>(
    'SELECT status FROM challenge_daily_status WHERE challenge_id = ? AND date = ? LIMIT 1',
    config.challenge_id,
    parsed.date,
  );
  const statusAlreadySynchronized = previous?.status === nextStatus;

  if (!statusAlreadySynchronized && nextStatus === 'pending') {
    await db.runAsync(
      'DELETE FROM challenge_daily_status WHERE challenge_id = ? AND date = ?',
      config.challenge_id,
      parsed.date,
    );
  } else if (!statusAlreadySynchronized) {
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
  if (!record) return null;

  if (record.category === 'church') {
    await persistChallengeRecord(db, record);
    await updateTaskChallengeProgress(db, config.task_id, record, parsed.date);
    const week = record.churchWeek;
    if (!week) return null;
    if (week.status !== 'earned') {
      await retractChallengeCompletionEvent(db, 'church_week', record.id, weekStart);
    }
    const earnedForThisCompletion = nextStatus === 'completed'
      && week.weekStart === weekStart
      && week.status === 'earned';
    let celebration = earnedForThisCompletion
      ? await createChallengeCompletionEvent(db, {
        challengeId: record.id,
        title: record.title,
        variant: 'churchWeek',
        weekStart: week.weekStart,
        trophyCount: record.churchTrophyCount ?? 0,
        currentStreak: record.streak,
      })
      : null;
    // A previous partial write may already have the durable event while the
    // UI never consumed it. Returning the still-pending row lets the same Home
    // tap display it. An explicit uncheck deletes the occurrence first, so a
    // later re-check can celebrate again without duplicating the trophy row.
    if (!celebration && earnedForThisCompletion) {
      const pending = await db.getFirstAsync<ChallengeCompletionEventRow>(
        `SELECT * FROM challenge_completion_events
         WHERE id = ? AND acknowledged_at IS NULL
         LIMIT 1`,
        challengeCompletionEventId('church_week', record.id, week.weekStart),
      );
      celebration = pending ? eventRowToCelebration(pending) : null;
    }
    return {
      challengeId: record.id,
      challengeTitle: record.title,
      trophyAwarded: !!celebration,
      week,
      trophyCount: record.churchTrophyCount ?? 0,
      currentStreak: record.streak,
      celebration: celebration ?? undefined,
    };
  }

  if (statusAlreadySynchronized) return null;

  if (challengeUsesFiniteScriptureReader(record)) {
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

    return syncScriptureChallengeRecord(
      db,
      config.task_id,
      config.challenge_id,
      record,
      parsed.date,
      removedSessionProgress,
    );
  }

  const dailyRows = await db.getAllAsync<DailyStatusRow>(
    'SELECT challenge_id, date, status FROM challenge_daily_status WHERE challenge_id = ? ORDER BY date ASC',
    config.challenge_id,
  );
  const { nextRecord, completedAt } = buildDayCountProgressRecord(record, dailyRows, parsed.date);

  await persistChallengeRecord(db, nextRecord);
  await applyTaskLifecycleForChallengeCompletion(db, config.task_id, record, nextRecord, parsed.date);
  await updateTaskChallengeProgress(db, config.task_id, nextRecord, parsed.date);

  if (!completedAt && record.completedAt) {
    await retractChallengeCompletionEvent(db, 'challenge', nextRecord.id);
  }
  // Only on the tick that finished it: `record` is the state before this one,
  // so a challenge already carrying a completion does not announce itself
  // again if a later day is ticked or a day is un-ticked and re-ticked.
  if (completedAt && !record.completedAt) {
    const celebration = await createChallengeCompletionEvent(db, {
      challengeId: nextRecord.id,
      title: nextRecord.title,
      variant: 'challenge',
    });
    if (celebration) {
      return {
        challengeCompleted: true,
        challengeId: nextRecord.id,
        challengeTitle: nextRecord.title,
        celebration,
      };
    }
  }
  return null;
}
