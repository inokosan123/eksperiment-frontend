// Ported from Daily-Christian src/lib/statsDb.ts (buildTaskAnalyticsFromInstances).
// Legacy daily_log fallback, schedule-aware count, and activePeriods logic from DC
// were intentionally dropped — they only existed to bridge a legacy event-log
// table that doesn't exist in this RN app.

import { listTaskInstancesForTaskBetween } from './taskDb';
import { getLocalDateKey } from './taskScheduler';
import type { TaskInstance } from './taskTypes';

export type ConsistencyBucket = {
  completed: number;
  scheduled: number;
  pct: number;
};

export type TaskAnalyticsData = {
  currentStreak: number;
  bestStreak: number;
  thisWeek: ConsistencyBucket;
  thisMonth: ConsistencyBucket;
  sinceStart: ConsistencyBucket;
  totalSkips: number;
  firstTrackedDate?: string;
  completedDates: Set<string>;
  skippedDates: Set<string>;
  missedDates: Set<string>;
  scheduledDates: Set<string>;
};

const WINDOW_DAYS = 365;
const FUTURE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

type AnalyticsState = 'completed' | 'skipped' | 'missed' | 'pending' | 'not_applicable';

function shiftDateKey(dateKey: string, offsetDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const next = new Date(y, m - 1, d, 12, 0, 0, 0);
  next.setTime(next.getTime() + offsetDays * DAY_MS);
  return getLocalDateKey(next);
}

// For today: trust the stored status. Past pending → "missed" virtually so the
// task_instances table doesn't have to be reconciled before analytics is correct.
// Time-aware: today's task isn't "missed" until its scheduled time has passed.
function isDueTaskInstanceForAnalytics(instance: TaskInstance, referenceDate: Date): boolean {
  const todayStr = getLocalDateKey(referenceDate);
  if (instance.date < todayStr) return true;
  if (instance.date > todayStr) return false;
  const dueAt = instance.time
    ? new Date(`${instance.date}T${instance.time}:00`).getTime()
    : new Date(`${instance.date}T23:59:59.999`).getTime();
  return referenceDate.getTime() >= dueAt;
}

function getInstanceState(instance: TaskInstance, referenceDate: Date): AnalyticsState {
  if (instance.status === 'completed') return 'completed';
  if (instance.status === 'skipped') return 'skipped';
  if (instance.status === 'missed') return 'missed';
  if (instance.status === 'not_applicable') return 'not_applicable';
  return isDueTaskInstanceForAnalytics(instance, referenceDate) ? 'missed' : 'pending';
}

function buildAnalyticsFromInstances(
  instances: TaskInstance[],
  referenceDate: Date,
): TaskAnalyticsData | null {
  if (instances.length === 0) return null;

  const todayStr = getLocalDateKey(referenceDate);
  const monthStartStr = `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, '0')}-01`;
  const weekDay = referenceDate.getDay() || 7;
  const weekStart = new Date(referenceDate);
  weekStart.setDate(referenceDate.getDate() - weekDay + 1);
  const weekStartStr = getLocalDateKey(weekStart);
  const displayStart = weekStartStr < monthStartStr ? weekStartStr : monthStartStr;

  const sorted = [...instances].sort((a, b) => a.date.localeCompare(b.date));
  const tracked = sorted.filter(inst => inst.date <= todayStr);
  const firstTrackedDate = sorted[0]?.date;

  const summarizeRange = (start: string, end: string): ConsistencyBucket => {
    let completed = 0;
    let scheduled = 0;
    for (const inst of tracked) {
      if (inst.date < start || inst.date > end) continue;
      const state = getInstanceState(inst, referenceDate);
      if (state === 'pending' || state === 'not_applicable') continue;
      scheduled += 1;
      if (state === 'completed') completed += 1;
    }
    return {
      completed,
      scheduled,
      pct: scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0,
    };
  };

  let running = 0;
  let best = 0;
  for (const inst of tracked) {
    const state = getInstanceState(inst, referenceDate);
    if (state === 'pending' || state === 'not_applicable') continue;
    if (state === 'completed') {
      running += 1;
      best = Math.max(best, running);
      continue;
    }
    if (state === 'skipped') {
      // skipped preserves the running streak but doesn't extend it
      best = Math.max(best, running);
      continue;
    }
    running = 0;
  }

  const display = sorted.filter(inst => inst.date >= displayStart && inst.date <= todayStr);
  const completedDates = new Set<string>();
  const skippedDates = new Set<string>();
  const missedDates = new Set<string>();
  const scheduledDates = new Set<string>();
  for (const inst of display) {
    scheduledDates.add(inst.date);
    const state = getInstanceState(inst, referenceDate);
    if (state === 'completed') completedDates.add(inst.date);
    else if (state === 'skipped') skippedDates.add(inst.date);
    else if (state === 'missed') missedDates.add(inst.date);
  }

  const totalSkips = tracked.filter(
    inst => getInstanceState(inst, referenceDate) === 'skipped',
  ).length;

  return {
    currentStreak: running,
    bestStreak: best,
    thisWeek: summarizeRange(weekStartStr, todayStr),
    thisMonth: summarizeRange(monthStartStr, todayStr),
    sinceStart: firstTrackedDate
      ? summarizeRange(firstTrackedDate, todayStr)
      : { completed: 0, scheduled: 0, pct: 0 },
    totalSkips,
    firstTrackedDate,
    completedDates,
    skippedDates,
    missedDates,
    scheduledDates,
  };
}

export async function getTaskAnalytics(taskId: string): Promise<TaskAnalyticsData | null> {
  // Skip syncTaskInstancesWindow — TaskProvider already keeps the window fresh
  // when the user is interacting with tasks. `getInstanceState` below also
  // applies the "virtual missed" rule in-memory for any pending-past-time rows
  // so a stale DB doesn't produce incorrect counts here.
  const referenceDate = new Date();
  const todayKey = getLocalDateKey(referenceDate);
  const fromKey = shiftDateKey(todayKey, -WINDOW_DAYS);
  const toKey = shiftDateKey(todayKey, FUTURE_DAYS);
  // Task-specific query — only rows for this task instead of pulling the whole
  // window and filtering in memory.
  const taskInstances = await listTaskInstancesForTaskBetween(taskId, fromKey, toKey);
  return buildAnalyticsFromInstances(taskInstances, referenceDate);
}
