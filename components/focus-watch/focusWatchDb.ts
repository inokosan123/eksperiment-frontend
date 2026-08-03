import * as SQLite from 'expo-sqlite';
import { openUserContentDb } from '@/data/userContentDb';

// SQLite layer for the Focus v4 day-plan system.
// The store (dayPlanStore.ts) is the only caller; every write goes through a
// serialized queue there, so these helpers can stay simple one-shot functions.

export type PlanRow = {
  id: string;
  name: string;
  zones_json: string;
  rules_json: string;
  meta_json?: string | null;
  created_at: number;
  updated_at: number;
};

export type DayRow = {
  date: string;
  plan_id: string | null;
  status: string;
  violations: number;
  target_lost?: number;
};

export type EventRow = {
  id: string;
  ts: number;
  local_day: string | null;
  timezone_id: string | null;
  utc_offset_minutes: number | null;
  kind: string;
  group_id: string | null;
  plan_id: string | null;
  meta_json: string | null;
};

let readyPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let eventCalendarSchemaReady = false;

const EVENT_CALENDAR_COLUMNS = [
  'local_day',
  'timezone_id',
  'utc_offset_minutes',
] as const;

export function hasFocusEventCalendarColumns(
  rows: readonly { name: string }[]
) {
  const names = new Set(rows.map(row => row.name));
  return EVENT_CALENDAR_COLUMNS.every(name => names.has(name));
}

function localDateParts(timestampMs: number, timezoneId: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezoneId,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(timestampMs));
  const values = Object.fromEntries(
    parts
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, Number(part.value)])
  ) as Record<string, number>;
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

export function focusEventCalendarContext(
  timestampMs: number,
  timezoneId =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
) {
  const value = Number.isFinite(timestampMs) ? timestampMs : Date.now();
  const parts = localDateParts(value, timezoneId);
  const pad = (number: number) => String(number).padStart(2, '0');
  const representedUtcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return {
    localDay: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    timezoneId,
    utcOffsetMinutes: Math.round(
      (representedUtcMs - Math.floor(value / 1_000) * 1_000) / 60_000
    ),
  };
}

async function initFocusWatchDb(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS focus_watch_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      zones_json TEXT NOT NULL,
      rules_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS focus_watch_schedule (
      day INTEGER PRIMARY KEY,
      plan_id TEXT
    );

    CREATE TABLE IF NOT EXISTS focus_watch_days (
      date TEXT PRIMARY KEY,
      plan_id TEXT,
      status TEXT NOT NULL,
      violations INTEGER NOT NULL DEFAULT 0,
      target_lost INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS focus_watch_events (
      id TEXT PRIMARY KEY,
      ts INTEGER NOT NULL,
      kind TEXT NOT NULL,
      group_id TEXT,
      plan_id TEXT,
      meta_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_focus_watch_events_ts
      ON focus_watch_events(ts);

    CREATE TABLE IF NOT EXISTS focus_watch_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // v2: plan-level budget/strength live in meta_json (added after first ship).
  try {
    await db.execAsync('ALTER TABLE focus_watch_plans ADD COLUMN meta_json TEXT');
  } catch {
    // column already exists
  }
  try {
    await db.execAsync('ALTER TABLE focus_watch_days ADD COLUMN target_lost INTEGER NOT NULL DEFAULT 0');
  } catch {
    // column already exists
  }
  try {
    await db.execAsync('ALTER TABLE focus_watch_events ADD COLUMN local_day TEXT');
  } catch {
    // column already exists
  }
  try {
    await db.execAsync('ALTER TABLE focus_watch_events ADD COLUMN timezone_id TEXT');
  } catch {
    // column already exists
  }
  try {
    await db.execAsync('ALTER TABLE focus_watch_events ADD COLUMN utc_offset_minutes INTEGER');
  } catch {
    // column already exists
  }
  try {
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_focus_watch_events_local_day
        ON focus_watch_events(local_day);
    `);
  } catch {
    // A partial migration disables only local event analytics below. The
    // Apple-private DeviceActivity report and the rest of Focus still load.
  }
  try {
    const columns = await db.getAllAsync<{ name: string }>(
      'PRAGMA table_info(focus_watch_events)'
    );
    eventCalendarSchemaReady = hasFocusEventCalendarColumns(columns);
  } catch {
    eventCalendarSchemaReady = false;
  }
}

export async function getFocusWatchDb() {
  if (!readyPromise) {
    readyPromise = (async () => {
      const db = await openUserContentDb();
      await initFocusWatchDb(db);
      return db;
    })();
  }
  return readyPromise;
}

// --- bulk load on hydrate ----------------------------------------------------

export async function loadFocusWatchData() {
  const db = await getFocusWatchDb();
  const [plans, schedule, days, meta] = await Promise.all([
    db.getAllAsync<PlanRow>('SELECT * FROM focus_watch_plans ORDER BY created_at ASC'),
    db.getAllAsync<{ day: number; plan_id: string | null }>(
      'SELECT * FROM focus_watch_schedule ORDER BY day ASC'
    ),
    db.getAllAsync<DayRow>('SELECT * FROM focus_watch_days ORDER BY date ASC'),
    db.getAllAsync<{ key: string; value: string | null }>('SELECT * FROM focus_watch_meta'),
  ]);

  const metaMap: Record<string, string> = {};
  for (const row of meta) {
    if (row.value != null) metaMap[row.key] = row.value;
  }
  return { plans, schedule, days, meta: metaMap };
}

// --- plans -------------------------------------------------------------------

export async function upsertPlanRow(row: PlanRow) {
  const db = await getFocusWatchDb();
  await db.runAsync(
    `INSERT INTO focus_watch_plans (id, name, zones_json, rules_json, meta_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       zones_json = excluded.zones_json,
       rules_json = excluded.rules_json,
       meta_json = excluded.meta_json,
       updated_at = excluded.updated_at`,
    row.id, row.name, row.zones_json, row.rules_json, row.meta_json ?? null, row.created_at, row.updated_at
  );
}

export async function deletePlanRow(id: string) {
  const db = await getFocusWatchDb();
  await db.runAsync('DELETE FROM focus_watch_plans WHERE id = ?', id);
}

// --- weekly schedule ----------------------------------------------------------

export async function setScheduleDayRow(day: number, planId: string | null) {
  const db = await getFocusWatchDb();
  await db.runAsync(
    `INSERT INTO focus_watch_schedule (day, plan_id) VALUES (?, ?)
     ON CONFLICT(day) DO UPDATE SET plan_id = excluded.plan_id`,
    day, planId
  );
}

// --- day records ---------------------------------------------------------------

export async function upsertDayRow(row: DayRow) {
  const db = await getFocusWatchDb();
  await db.runAsync(
    `INSERT INTO focus_watch_days (date, plan_id, status, violations, target_lost)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       plan_id = excluded.plan_id,
       status = excluded.status,
       violations = excluded.violations,
       target_lost = excluded.target_lost`,
    row.date, row.plan_id, row.status, row.violations, row.target_lost ?? 0
  );
}

// --- event journal --------------------------------------------------------------

export async function insertEventRow(row: EventRow) {
  const db = await getFocusWatchDb();
  if (!eventCalendarSchemaReady) return;
  await db.runAsync(
    `INSERT OR IGNORE INTO focus_watch_events (
       id, ts, local_day, timezone_id, utc_offset_minutes,
       kind, group_id, plan_id, meta_json
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.id,
    row.ts,
    row.local_day,
    row.timezone_id,
    row.utc_offset_minutes,
    row.kind,
    row.group_id,
    row.plan_id,
    row.meta_json
  );
}

export async function getFocusEventRowsBetween(
  startMsInclusive: number,
  endMsExclusive: number
): Promise<EventRow[]> {
  const db = await getFocusWatchDb();
  if (!eventCalendarSchemaReady) return [];
  return db.getAllAsync<EventRow>(
    `SELECT
       id, ts, local_day, timezone_id, utc_offset_minutes,
       kind, group_id, plan_id, meta_json
     FROM focus_watch_events
     WHERE ts >= ? AND ts < ?
     ORDER BY ts ASC, id ASC`,
    startMsInclusive,
    endMsExclusive
  );
}

export async function getFocusEventRowsForLocalDays(input: {
  startDayInclusive: string;
  endDayExclusive: string;
  legacyStartMsInclusive: number;
  legacyEndMsExclusive: number;
}): Promise<EventRow[]> {
  const db = await getFocusWatchDb();
  if (!eventCalendarSchemaReady) return [];
  return db.getAllAsync<EventRow>(
    `SELECT
       id, ts, local_day, timezone_id, utc_offset_minutes,
       kind, group_id, plan_id, meta_json
     FROM focus_watch_events
     WHERE
       (local_day >= ? AND local_day < ?)
       OR (
         local_day IS NULL
         AND ts >= ?
         AND ts < ?
       )
     ORDER BY ts ASC, id ASC`,
    input.startDayInclusive,
    input.endDayExclusive,
    input.legacyStartMsInclusive,
    input.legacyEndMsExclusive
  );
}

// --- meta ------------------------------------------------------------------------

export async function setMetaRow(key: string, value: string | null) {
  const db = await getFocusWatchDb();
  if (value === null) {
    await db.runAsync('DELETE FROM focus_watch_meta WHERE key = ?', key);
    return;
  }
  await db.runAsync(
    `INSERT INTO focus_watch_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key, value
  );
}
