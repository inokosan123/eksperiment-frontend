import type { WatchPlan } from './focusWatchStore';

// Phase 1 mock history: a deterministic story per plan (born ~7 weeks ago,
// a few misses, the last `plan.streak` scheduled days unbroken). Phase 2
// replaces this with real session records.

export type WatchDayStatus = 'completed' | 'missed' | 'off' | 'future';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function planHash(planId: string, dayIndex: number) {
  let hash = 0;
  for (let i = 0; i < planId.length; i++) hash = (hash * 31 + planId.charCodeAt(i)) | 0;
  return Math.abs(hash + dayIndex * 2654435761) % 1000;
}

function isScheduledDay(plan: WatchPlan, date: Date) {
  if (plan.when.kind === 'always') return true;
  const day = (date.getDay() + 6) % 7;
  return plan.when.days.includes(day);
}

export type WatchHistory = {
  firstDay: Date;
  today: Date;
  statusFor: (date: Date) => WatchDayStatus;
  current: number;
  longest: number;
};

export function getWatchHistory(plan: WatchPlan, now = new Date()): WatchHistory {
  const today = startOfDay(now);
  const bornDaysAgo = Math.max(45, plan.streak + 12);
  const firstDay = new Date(today.getTime() - bornDaysAgo * DAY_MS);

  // Walk backwards from today: the last `streak` scheduled days are unbroken,
  // the scheduled day just before them is the miss that reset the count.
  const completedSet = new Set<number>();
  const missedSet = new Set<number>();
  let scheduledSeen = 0;
  for (let ts = today.getTime(); ts >= firstDay.getTime(); ts -= DAY_MS) {
    const date = new Date(ts);
    if (!isScheduledDay(plan, date)) continue;
    scheduledSeen += 1;
    const dayIndex = Math.round((ts - firstDay.getTime()) / DAY_MS);
    if (scheduledSeen <= plan.streak) {
      completedSet.add(ts);
    } else if (scheduledSeen === plan.streak + 1) {
      missedSet.add(ts);
    } else if (planHash(plan.id, dayIndex) % 6 === 3) {
      missedSet.add(ts);
    } else {
      completedSet.add(ts);
    }
  }

  // Longest run across the generated story.
  let longest = 0;
  let run = 0;
  for (let ts = firstDay.getTime(); ts <= today.getTime(); ts += DAY_MS) {
    if (completedSet.has(ts)) {
      run += 1;
      longest = Math.max(longest, run);
    } else if (missedSet.has(ts)) {
      run = 0;
    }
  }

  const statusFor = (date: Date): WatchDayStatus => {
    const ts = startOfDay(date).getTime();
    if (ts > today.getTime()) return 'future';
    if (ts < firstDay.getTime()) return 'off';
    if (completedSet.has(ts)) return 'completed';
    if (missedSet.has(ts)) return 'missed';
    return 'off';
  };

  return { firstDay, today, statusFor, current: plan.streak, longest: Math.max(longest, plan.streak) };
}

// The last seven scheduled days, oldest first — for the small dot strip.
export function lastScheduledDays(plan: WatchPlan, history: WatchHistory, count = 7) {
  const result: { date: Date; status: WatchDayStatus }[] = [];
  for (let ts = history.today.getTime(); ts >= history.firstDay.getTime() && result.length < count; ts -= DAY_MS) {
    const date = new Date(ts);
    if (!isScheduledDay(plan, date)) continue;
    result.push({ date, status: history.statusFor(date) });
  }
  return result.reverse();
}
