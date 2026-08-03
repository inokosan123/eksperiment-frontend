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
  calendarStartDate?: string;
  completedDates: Set<string>;
  skippedDates: Set<string>;
  missedDates: Set<string>;
  scheduledDates: Set<string>;
};

type AnalyticsState = 'completed' | 'skipped' | 'missed' | 'pending' | 'not_applicable';

// A skipped occurrence is deliberately neutral throughout the app: it keeps a
// streak alive, but neither improves nor lowers consistency.
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

export function buildTaskAnalyticsFromInstances(
  instances: TaskInstance[],
  referenceDate: Date,
  calendarStartDate?: string,
): TaskAnalyticsData | null {
  if (instances.length === 0) return null;

  const todayStr = getLocalDateKey(referenceDate);
  const monthStartStr = `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, '0')}-01`;
  const weekDay = referenceDate.getDay() || 7;
  const weekStart = new Date(referenceDate);
  weekStart.setDate(referenceDate.getDate() - weekDay + 1);
  const weekStartStr = getLocalDateKey(weekStart);

  const sorted = [...instances].sort((a, b) => a.date.localeCompare(b.date));
  const tracked = sorted.filter(instance => instance.date <= todayStr);
  const firstTrackedDate = sorted[0]?.date;

  const summarizeRange = (start: string, end: string): ConsistencyBucket => {
    let completed = 0;
    let scheduled = 0;
    for (const instance of tracked) {
      if (instance.date < start || instance.date > end) continue;
      const state = getInstanceState(instance, referenceDate);
      if (state === 'pending' || state === 'not_applicable' || state === 'skipped') continue;
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
  for (const instance of tracked) {
    const state = getInstanceState(instance, referenceDate);
    if (state === 'pending' || state === 'not_applicable') continue;
    if (state === 'completed') {
      running += 1;
      best = Math.max(best, running);
      continue;
    }
    if (state === 'skipped') {
      best = Math.max(best, running);
      continue;
    }
    running = 0;
  }

  const completedDates = new Set<string>();
  const skippedDates = new Set<string>();
  const missedDates = new Set<string>();
  const scheduledDates = new Set<string>();
  for (const instance of tracked) {
    scheduledDates.add(instance.date);
    const state = getInstanceState(instance, referenceDate);
    if (state === 'completed') completedDates.add(instance.date);
    else if (state === 'skipped') skippedDates.add(instance.date);
    else if (state === 'missed') missedDates.add(instance.date);
  }

  const totalSkips = tracked.filter(
    instance => getInstanceState(instance, referenceDate) === 'skipped',
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
    calendarStartDate: calendarStartDate ?? firstTrackedDate,
    completedDates,
    skippedDates,
    missedDates,
    scheduledDates,
  };
}
