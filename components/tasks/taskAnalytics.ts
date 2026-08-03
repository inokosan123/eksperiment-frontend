// Ported from Daily-Christian src/lib/statsDb.ts (buildTaskAnalyticsFromInstances).
// Legacy daily_log fallback, schedule-aware count, and activePeriods logic from DC
// were intentionally dropped — they only existed to bridge a legacy event-log
// table that doesn't exist in this RN app.

import { getTaskDateBounds, listTaskInstancesForTaskBetween } from './taskDb';
import { getLocalDateKey } from './taskScheduler';
import { buildTaskAnalyticsFromInstances } from './taskAnalyticsModel';
import type { TaskAnalyticsData } from './taskAnalyticsModel';

export { buildTaskAnalyticsFromInstances } from './taskAnalyticsModel';
export type { ConsistencyBucket, TaskAnalyticsData } from './taskAnalyticsModel';

const WINDOW_DAYS = 365;
const FUTURE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function shiftDateKey(dateKey: string, offsetDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const next = new Date(y, m - 1, d, 12, 0, 0, 0);
  next.setTime(next.getTime() + offsetDays * DAY_MS);
  return getLocalDateKey(next);
}

// For today: trust the stored status. Past pending → "missed" virtually so the
// task_instances table doesn't have to be reconciled before analytics is correct.
// Time-aware: today's task isn't "missed" until its scheduled time has passed.
export async function getTaskAnalytics(taskId: string): Promise<TaskAnalyticsData | null> {
  // Skip syncTaskInstancesWindow — TaskProvider already keeps the window fresh
  // when the user is interacting with tasks. The shared analytics model also
  // applies the "virtual missed" rule in-memory for any pending-past-time rows
  // so a stale DB doesn't produce incorrect counts here.
  const referenceDate = new Date();
  const todayKey = getLocalDateKey(referenceDate);
  const bounds = await getTaskDateBounds(taskId);
  const createdDate = bounds?.createdAt ? getLocalDateKey(new Date(bounds.createdAt)) : undefined;
  const fromKey = createdDate ?? shiftDateKey(todayKey, -WINDOW_DAYS);
  const toKey = shiftDateKey(todayKey, FUTURE_DAYS);
  // Task-specific query — only rows for this task instead of pulling the whole
  // window and filtering in memory.
  const taskInstances = await listTaskInstancesForTaskBetween(taskId, fromKey, toKey);
  return buildTaskAnalyticsFromInstances(taskInstances, referenceDate, createdDate);
}
