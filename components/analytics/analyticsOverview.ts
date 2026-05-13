// RN-native port of Capacitor's src/lib/analyticsOverview.ts.
//
// Differences from Capacitor:
//   • Operates exclusively on TaskInstance rows (RN's single source of
//     truth) — Capacitor also kept legacy `tasks`/`weeklyTasks` arrays.
//   • Habit ID is resolved from `habitIdByTaskId` (built once via
//     listTaskHabitMap) instead of parsing a containerKey string.
//   • Capacitor's challenge/habit lifecycle summaries are skipped — RN
//     models don't carry the same `activePeriods`/`archivedAt` fields,
//     and the screen doesn't render that data anyway.

import type { TaskInstance, TaskType } from '@/components/tasks/taskTypes';
import { shouldMarkMissed } from '@/components/tasks/taskScheduler';
import type { ChallengeRecord } from '@/components/challenges/challengeData';

// Minimal habit shape that satisfies analytics — both habitData.HabitItem
// and habitDb.HabitItem (which adds stats fields) match this structurally,
// so callers can pass either without a cast.
export type AnalyticsHabit = {
  id: string;
  name: string;
  color: string;
  icon: string;
  active: boolean;
};

export type AnalyticsTaskMeta = {
  title: string;
  source: TaskInstance['source'];
  type: TaskType;
};

export type BalanceBucket = 'spiritual' | 'challenges' | 'other';

export interface CountBucket {
  scheduled: number;
  completed: number;
  skipped: number;
  missed: number;
  pct: number;
}

export interface DailyAnalyticsSnapshot {
  date: string;
  day: number;
  overall: CountBucket;
  balance: Record<BalanceBucket, CountBucket>;
  source: Record<AnalyticsSourceKey, CountBucket>;
  completionPct: number;
  perfectDay: boolean;
  activeDay: boolean;
  byHabit: Record<string, CountBucket>;
  byTaskId: Record<string, CountBucket>;
}

export interface RangeAnalyticsSummary {
  overall: CountBucket;
  balance: Record<BalanceBucket, CountBucket>;
  source: Record<AnalyticsSourceKey, CountBucket>;
  perfectDays: number;
  activeDays: number;
  avgDailyCompletion: number;
  currentStreak: number;
  bestStreak: number;
  bestDay?: { date: string; pct: number };
  weakestDay?: { date: string; pct: number };
}

export interface MonthPerformance {
  monthKey: string;
  label: string;
  completed: number;
  scheduled: number;
  skipped: number;
  missed: number;
  pct: number;
}

export interface AnalyticsOverviewData {
  startDate: string;
  today: string;
  dailySnapshots: DailyAnalyticsSnapshot[];
  global: RangeAnalyticsSummary;
  monthlyPerformance: MonthPerformance[];
  bestMonth?: MonthPerformance;
}

export interface AnalyticsInput {
  taskInstances: TaskInstance[];
  habitIdByTaskId: Record<string, string>;
  taskMetaById?: Record<string, AnalyticsTaskMeta>;
  habits: AnalyticsHabit[];
  challenges: ChallengeRecord[];
  minStartDate?: string;
  todayDate?: Date;
}

const SPIRITUAL_TYPES = new Set<TaskType>(['prayer', 'church']);
export type AnalyticsSourceKey =
  | 'habits'
  | 'challenges'
  | 'routineTasks'
  | 'spiritualTasks'
  | 'otherTasks'
  | 'quickTasks';

function emptyBucket(): CountBucket {
  return { scheduled: 0, completed: 0, skipped: 0, missed: 0, pct: 0 };
}

function emptySourceBuckets(): Record<AnalyticsSourceKey, CountBucket> {
  return {
    habits: emptyBucket(),
    challenges: emptyBucket(),
    routineTasks: emptyBucket(),
    spiritualTasks: emptyBucket(),
    otherTasks: emptyBucket(),
    quickTasks: emptyBucket(),
  };
}

function finalizeBucket(b: CountBucket): CountBucket {
  return { ...b, pct: b.scheduled > 0 ? Math.round((b.completed / b.scheduled) * 100) : 0 };
}

function pendingCount(b: CountBucket): number {
  return Math.max(0, b.scheduled - b.completed - b.skipped - b.missed);
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(key: string, days: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return formatDateKey(d);
}

function getMonthKey(key: string): string {
  return key.slice(0, 7);
}

function getWeekStartKey(key: string): string {
  const date = parseDateKey(key);
  const weekDay = date.getDay() || 7;
  date.setDate(date.getDate() - weekDay + 1);
  return formatDateKey(date);
}

export function getMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
    .format(new Date(y, m - 1, 1));
}

function getBalanceBucketForMeta(meta: Pick<TaskInstance, 'source' | 'type'>): BalanceBucket {
  if (meta.source === 'challenge') return 'challenges';
  if (meta.source === 'spiritual') return 'spiritual';
  if (SPIRITUAL_TYPES.has(meta.type)) return 'spiritual';
  return 'other';
}

function getSourceFamily(instance: Pick<TaskInstance, 'source' | 'type'>): AnalyticsSourceKey {
  if (instance.source === 'habit') return 'habits';
  if (instance.source === 'challenge') return 'challenges';
  if (instance.source === 'quick') return 'quickTasks';
  if (instance.source === 'spiritual') return 'spiritualTasks';
  if (instance.source === 'gratitude' || instance.source === 'reading_book') return 'otherTasks';
  if (instance.type === 'gratitude' || instance.type === 'reading') return 'otherTasks';
  if (SPIRITUAL_TYPES.has(instance.type)) return 'spiritualTasks';
  return 'routineTasks';
}

function getInstanceMeta(
  instance: TaskInstance,
  taskMetaById: Record<string, AnalyticsTaskMeta> = {},
): Pick<TaskInstance, 'source' | 'type'> {
  return taskMetaById[instance.taskId] ?? instance;
}

function getTaskTitle(
  taskId: string,
  fallback: string | undefined,
  taskMetaById: Record<string, AnalyticsTaskMeta> = {},
) {
  return taskMetaById[taskId]?.title ?? fallback ?? 'Task';
}

function getEffectiveInstanceStatus(
  instance: TaskInstance,
  referenceDate: Date,
): TaskInstance['status'] {
  if (instance.status === 'pending' && shouldMarkMissed(instance.date, instance.time, referenceDate)) {
    return 'missed';
  }
  return instance.status;
}

function addInstance(bucket: CountBucket, inst: TaskInstance, referenceDate: Date) {
  const status = getEffectiveInstanceStatus(inst, referenceDate);
  if (status === 'not_applicable') return;
  bucket.scheduled += 1;
  if (status === 'completed') bucket.completed += 1;
  else if (status === 'skipped') bucket.skipped += 1;
  else if (status === 'missed') bucket.missed += 1;
}

function buildSnapshot(
  date: string,
  instances: TaskInstance[],
  referenceDate: Date,
  habitIdByTaskId: Record<string, string>,
  taskMetaById: Record<string, AnalyticsTaskMeta> = {},
): DailyAnalyticsSnapshot {
  const overall = emptyBucket();
  const balance: Record<BalanceBucket, CountBucket> = {
    spiritual: emptyBucket(),
    challenges: emptyBucket(),
    other: emptyBucket(),
  };
  const source = emptySourceBuckets();
  const byHabit: Record<string, CountBucket> = {};
  const byTaskId: Record<string, CountBucket> = {};

  for (const inst of instances) {
    const meta = getInstanceMeta(inst, taskMetaById);
    addInstance(overall, inst, referenceDate);
    const balanceKey = getBalanceBucketForMeta(meta);
    addInstance(balance[balanceKey], inst, referenceDate);

    const sourceKey = getSourceFamily(meta);
    addInstance(source[sourceKey], inst, referenceDate);

    const habitId = habitIdByTaskId[inst.taskId];
    if (habitId) {
      byHabit[habitId] = byHabit[habitId] ?? emptyBucket();
      addInstance(byHabit[habitId], inst, referenceDate);
    }

    byTaskId[inst.taskId] = byTaskId[inst.taskId] ?? emptyBucket();
    addInstance(byTaskId[inst.taskId], inst, referenceDate);
  }

  const finalizedOverall = finalizeBucket(overall);
  return {
    date,
    day: Number(date.slice(-2)),
    overall: finalizedOverall,
    balance: {
      spiritual: finalizeBucket(balance.spiritual),
      challenges: finalizeBucket(balance.challenges),
      other: finalizeBucket(balance.other),
    },
    source: {
      habits: finalizeBucket(source.habits),
      challenges: finalizeBucket(source.challenges),
      routineTasks: finalizeBucket(source.routineTasks),
      spiritualTasks: finalizeBucket(source.spiritualTasks),
      otherTasks: finalizeBucket(source.otherTasks),
      quickTasks: finalizeBucket(source.quickTasks),
    },
    completionPct: finalizedOverall.pct,
    perfectDay: finalizedOverall.scheduled > 0 && finalizedOverall.completed === finalizedOverall.scheduled,
    activeDay: finalizedOverall.completed > 0 || finalizedOverall.skipped > 0,
    byHabit: Object.fromEntries(Object.entries(byHabit).map(([k, v]) => [k, finalizeBucket(v)])),
    byTaskId: Object.fromEntries(Object.entries(byTaskId).map(([k, v]) => [k, finalizeBucket(v)])),
  };
}

function determineStartDate(input: AnalyticsInput, today: string): string {
  const candidates: string[] = [];
  for (const inst of input.taskInstances) candidates.push(inst.date);
  for (const ch of input.challenges) {
    if (ch.startedAt) candidates.push(ch.startedAt);
  }
  candidates.sort();
  const detected = candidates[0] ?? today;
  if (!input.minStartDate) return detected;
  return detected < input.minStartDate ? input.minStartDate : detected;
}

function summarizeSnapshots(snapshots: DailyAnalyticsSnapshot[]): RangeAnalyticsSummary {
  const overall = emptyBucket();
  const balance: Record<BalanceBucket, CountBucket> = {
    spiritual: emptyBucket(), challenges: emptyBucket(), other: emptyBucket(),
  };
  const source = emptySourceBuckets();

  let perfectDays = 0;
  let activeDays = 0;
  let pctTotal = 0;
  let pctDays = 0;
  let bestDay: { date: string; pct: number } | undefined;
  let weakestDay: { date: string; pct: number } | undefined;

  for (const snap of snapshots) {
    const merge = (target: CountBucket, src: CountBucket) => {
      target.scheduled += src.scheduled;
      target.completed += src.completed;
      target.skipped += src.skipped;
      target.missed += src.missed;
    };
    merge(overall, snap.overall);
    (Object.keys(balance) as BalanceBucket[]).forEach(k => merge(balance[k], snap.balance[k]));
    merge(source.habits, snap.source.habits);
    merge(source.challenges, snap.source.challenges);
    merge(source.routineTasks, snap.source.routineTasks);
    merge(source.spiritualTasks, snap.source.spiritualTasks);
    merge(source.otherTasks, snap.source.otherTasks);
    merge(source.quickTasks, snap.source.quickTasks);

    if (snap.perfectDay) perfectDays++;
    if (snap.activeDay) activeDays++;
    if (snap.overall.scheduled > 0) {
      pctTotal += snap.completionPct;
      pctDays++;
      if (!bestDay || snap.completionPct > bestDay.pct) bestDay = { date: snap.date, pct: snap.completionPct };
      if (!weakestDay || snap.completionPct < weakestDay.pct) weakestDay = { date: snap.date, pct: snap.completionPct };
    }
  }

  // Streaks: completed extends, skipped preserves, missed breaks.
  let bestStreak = 0;
  let runningStreak = 0;
  for (const snap of snapshots) {
    if (snap.overall.scheduled === 0) continue;
    if (snap.overall.completed > 0) {
      runningStreak += 1;
      bestStreak = Math.max(bestStreak, runningStreak);
    } else if (snap.overall.skipped > 0 && snap.overall.missed === 0) {
      bestStreak = Math.max(bestStreak, runningStreak);
    } else if (pendingCount(snap.overall) > 0 && snap.overall.missed === 0) {
      bestStreak = Math.max(bestStreak, runningStreak);
    } else {
      runningStreak = 0;
    }
  }
  let currentStreak = 0;
  for (let i = snapshots.length - 1; i >= 0; i--) {
    const snap = snapshots[i];
    if (snap.overall.scheduled === 0) continue;
    if (snap.overall.completed > 0) currentStreak += 1;
    else if (snap.overall.skipped > 0 && snap.overall.missed === 0) continue;
    else if (pendingCount(snap.overall) > 0 && snap.overall.missed === 0) continue;
    else break;
  }

  return {
    overall: finalizeBucket(overall),
    balance: {
      spiritual: finalizeBucket(balance.spiritual),
      challenges: finalizeBucket(balance.challenges),
      other: finalizeBucket(balance.other),
    },
    source: {
      habits: finalizeBucket(source.habits),
      challenges: finalizeBucket(source.challenges),
      routineTasks: finalizeBucket(source.routineTasks),
      spiritualTasks: finalizeBucket(source.spiritualTasks),
      otherTasks: finalizeBucket(source.otherTasks),
      quickTasks: finalizeBucket(source.quickTasks),
    },
    perfectDays,
    activeDays,
    avgDailyCompletion: pctDays > 0 ? Math.round(pctTotal / pctDays) : 0,
    currentStreak,
    bestStreak,
    bestDay,
    weakestDay,
  };
}

export function buildAnalyticsOverview(input: AnalyticsInput): AnalyticsOverviewData {
  const referenceDate = input.todayDate ?? new Date();
  const today = formatDateKey(referenceDate);
  const startDate = determineStartDate(input, today);

  const instancesByDate = new Map<string, TaskInstance[]>();
  for (const inst of input.taskInstances) {
    const list = instancesByDate.get(inst.date) ?? [];
    list.push(inst);
    instancesByDate.set(inst.date, list);
  }

  const dailySnapshots: DailyAnalyticsSnapshot[] = [];
  for (let cursor = startDate; cursor <= today; cursor = addDays(cursor, 1)) {
    const list = instancesByDate.get(cursor) ?? [];
    dailySnapshots.push(buildSnapshot(
      cursor,
      list,
      referenceDate,
      input.habitIdByTaskId,
      input.taskMetaById,
    ));
  }

  const global = summarizeSnapshots(dailySnapshots);

  const monthlyMap = new Map<string, DailyAnalyticsSnapshot[]>();
  for (const snap of dailySnapshots) {
    const key = getMonthKey(snap.date);
    const list = monthlyMap.get(key) ?? [];
    list.push(snap);
    monthlyMap.set(key, list);
  }
  const monthlyPerformance = Array.from(monthlyMap.entries())
    .map(([monthKey, snaps]) => {
      const sum = summarizeSnapshots(snaps);
      return {
        monthKey,
        label: getMonthLabel(monthKey),
        completed: sum.overall.completed,
        scheduled: sum.overall.scheduled,
        skipped: sum.overall.skipped,
        missed: sum.overall.missed,
        pct: sum.overall.pct,
      } as MonthPerformance;
    })
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  const bestMonth = monthlyPerformance
    .filter(m => m.scheduled > 0)
    .sort((a, b) => b.pct - a.pct || b.completed - a.completed)[0];

  return { startDate, today, dailySnapshots, global, monthlyPerformance, bestMonth };
}

/* ─── Chart aggregation ─── */

export interface ChartDataPoint {
  label: string;
  date: string;
  scheduled: number;
  completed: number;
  skipped: number;
  missed: number;
  successRate: number;
}

export type AnalyticsPeriod = '1m' | '3m' | '6m' | '1y';
export type AnalyticsCriteria = 'completed' | 'skipped' | 'missed' | 'successRate';
export type SourceFilter = 'all' | AnalyticsSourceKey;

function getSourceBucket(snap: DailyAnalyticsSnapshot, filter: SourceFilter): CountBucket {
  if (filter === 'all') return snap.overall;
  return snap.source[filter];
}

function challengeTaskIdForAnalytics(challengeId: string) {
  return challengeId.startsWith('challenge_task_') ? challengeId : `challenge_task_${challengeId}`;
}

function getChallengeBucket(snapshot: DailyAnalyticsSnapshot, challengeId: string): CountBucket {
  return snapshot.byTaskId[challengeTaskIdForAnalytics(challengeId)]
    ?? snapshot.byTaskId[challengeId]
    ?? emptyBucket();
}

function summarizeBuckets(buckets: CountBucket[]) {
  return buckets.reduce((acc, bucket) => {
    acc.completed += bucket.completed;
    acc.scheduled += bucket.scheduled;
    acc.skipped += bucket.skipped;
    acc.missed += bucket.missed;
    return acc;
  }, { completed: 0, scheduled: 0, skipped: 0, missed: 0 });
}

export function aggregateByPeriod(
  snapshots: DailyAnalyticsSnapshot[],
  period: AnalyticsPeriod,
  filter: SourceFilter,
  selectedMonth?: string,
): ChartDataPoint[] {
  const now = new Date();
  now.setHours(12, 0, 0, 0);

  if (period === '1m') {
    const monthKey = selectedMonth || getMonthKey(formatDateKey(now));
    const filtered = snapshots.filter(s => s.date.startsWith(monthKey));
    return filtered.map(s => {
      const b = getSourceBucket(s, filter);
      return {
        label: String(s.day),
        date: s.date,
        scheduled: b.scheduled,
        completed: b.completed,
        skipped: b.skipped,
        missed: b.missed,
        successRate: b.pct,
      };
    });
  }

  let cutoff: Date;
  switch (period) {
    case '3m': cutoff = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate(), 12); break;
    case '6m': cutoff = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate(), 12); break;
    case '1y': cutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 12); break;
  }
  const cutoffKey = formatDateKey(cutoff);
  const filtered = snapshots.filter(s => s.date >= cutoffKey);

  const groupByWeek = period === '3m';
  const groups = new Map<string, { completed: number; skipped: number; missed: number; scheduled: number; label: string; date: string }>();

  for (const s of filtered) {
    const d = parseDateKey(s.date);
    let key: string;
    let label: string;
    if (groupByWeek) {
      const dow = d.getDay() || 7;
      const monday = new Date(d);
      monday.setDate(d.getDate() - dow + 1);
      key = formatDateKey(monday);
      label = `${monday.getDate()}/${monday.getMonth() + 1}`;
    } else {
      key = s.date.slice(0, 7);
      label = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(d);
    }
    const b = getSourceBucket(s, filter);
    const existing = groups.get(key) ?? { completed: 0, skipped: 0, missed: 0, scheduled: 0, label, date: key };
    existing.completed += b.completed;
    existing.skipped += b.skipped;
    existing.missed += b.missed;
    existing.scheduled += b.scheduled;
    groups.set(key, existing);
  }

  return Array.from(groups.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(g => ({
      label: g.label,
      date: g.date,
      completed: g.completed,
      skipped: g.skipped,
      missed: g.missed,
      scheduled: g.scheduled,
      successRate: g.scheduled > 0 ? Math.round((g.completed / g.scheduled) * 100) : 0,
    }));
}

export function computeTrend(
  snapshots: DailyAnalyticsSnapshot[],
  period: AnalyticsPeriod,
  filter: SourceFilter,
  selectedMonth?: string,
  criteria: AnalyticsCriteria = 'successRate',
): { value: number; direction: 'up' | 'down' | 'flat'; unit: 'count' | 'pct' } {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const metric = (snaps: DailyAnalyticsSnapshot[]) => {
    const total = snaps.reduce((acc, snap) => {
      const bucket = getSourceBucket(snap, filter);
      acc.completed += bucket.completed;
      acc.skipped += bucket.skipped;
      acc.missed += bucket.missed;
      acc.scheduled += bucket.scheduled;
      return acc;
    }, { completed: 0, skipped: 0, missed: 0, scheduled: 0 });

    if (criteria === 'successRate') {
      return total.scheduled > 0 ? Math.round((total.completed / total.scheduled) * 100) : 0;
    }

    return total[criteria];
  };

  if (period === '1m' && selectedMonth) {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prev = new Date(y, m - 2, 1, 12);
    const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    const cur = snapshots.filter(s => s.date.startsWith(selectedMonth));
    const pre = snapshots.filter(s => s.date.startsWith(prevKey));
    const diff = metric(cur) - metric(pre);
    return {
      value: Math.abs(diff),
      direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
      unit: criteria === 'successRate' ? 'pct' : 'count',
    };
  }

  let monthsBack = 1;
  if (period === '3m') monthsBack = 3;
  else if (period === '6m') monthsBack = 6;
  else if (period === '1y') monthsBack = 12;

  const curStart = new Date(now.getFullYear(), now.getMonth() - monthsBack, now.getDate(), 12);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - monthsBack * 2, now.getDate(), 12);
  const curKey = formatDateKey(curStart);
  const prevKey = formatDateKey(prevStart);
  const todayKey = formatDateKey(now);
  const cur = snapshots.filter(s => s.date >= curKey && s.date <= todayKey);
  const pre = snapshots.filter(s => s.date >= prevKey && s.date < curKey);
  const diff = metric(cur) - metric(pre);
  return {
    value: Math.abs(diff),
    direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
    unit: criteria === 'successRate' ? 'pct' : 'count',
  };
}

export function getAvailableMonths(snapshots: DailyAnalyticsSnapshot[]): string[] {
  const set = new Set<string>();
  for (const s of snapshots) set.add(s.date.slice(0, 7));
  return Array.from(set).sort();
}

/* ─── Highlight cards / streak leaders ─── */

export interface StreakLeader {
  name: string;
  currentStreak: number;
  bestStreak: number;
}

export interface PerItemBreakdown {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  completed: number;
  scheduled: number;
  skipped: number;
  missed: number;
  pct: number;
  currentStreak: number;
  bestStreak: number;
  isActive?: boolean;
  subTasks?: {
    id: string;
    name: string;
    completed: number;
    scheduled: number;
    skipped: number;
    missed: number;
    pct: number;
    currentStreak: number;
    bestStreak: number;
  }[];
}

function streakFromBuckets(buckets: CountBucket[]): { current: number; best: number } {
  let running = 0;
  let best = 0;
  let current = 0;
  for (const b of buckets) {
    if (b.scheduled === 0) continue;
    if (b.completed > 0) {
      running += 1;
      best = Math.max(best, running);
    } else if (b.skipped > 0 && b.missed === 0) {
      best = Math.max(best, running);
    } else if (pendingCount(b) > 0 && b.missed === 0) {
      best = Math.max(best, running);
    } else {
      running = 0;
    }
  }
  for (let i = buckets.length - 1; i >= 0; i--) {
    const b = buckets[i];
    if (b.scheduled === 0) continue;
    if (b.completed > 0) current += 1;
    else if (b.skipped > 0 && b.missed === 0) continue;
    else if (pendingCount(b) > 0 && b.missed === 0) continue;
    else break;
  }
  return { current, best };
}

export function getStreakLeaders(
  challenges: ChallengeRecord[],
  habits: AnalyticsHabit[],
  snapshots: DailyAnalyticsSnapshot[],
  filter: SourceFilter,
  taskInstances: TaskInstance[] = [],
  taskMetaById: Record<string, AnalyticsTaskMeta> = {},
): {
  bestStreakEver: StreakLeader | null;
  worstStreakEver: StreakLeader | null;
  currentBestStreak: StreakLeader | null;
  currentWorstStreak: StreakLeader | null;
  mostConsistent: { name: string; pct: number } | null;
  leastConsistent: { name: string; pct: number } | null;
} {
  const items: {
    name: string;
    currentStreak: number;
    bestStreak: number;
    pct: number;
    scheduled: number;
  }[] = [];

  if (filter === 'all' || filter === 'challenges') {
    for (const ch of challenges) {
      if (ch.status === 'cancelled') continue;
      const buckets = snapshots.map(s => getChallengeBucket(s, ch.id));
      // ChallengeRecord has only `streak` (current) — derive best from history.
      const { current, best } = streakFromBuckets(buckets);
      const totals = summarizeBuckets(buckets);
      const hasHistory = totals.scheduled > 0;
      if (!hasHistory && (ch.progressCurrent ?? 0) === 0) continue;
      items.push({
        name: ch.title,
        currentStreak: hasHistory ? current : ch.streak ?? 0,
        bestStreak: hasHistory ? Math.max(best, ch.bestStreak ?? 0) : ch.bestStreak ?? ch.streak ?? 0,
        pct: totals.scheduled > 0 ? Math.round((totals.completed / totals.scheduled) * 100) : 0,
        scheduled: totals.scheduled,
      });
    }
  }

  if (filter === 'all' || filter === 'habits') {
    for (const h of habits) {
      const buckets = snapshots.map(s => s.byHabit[h.id] ?? emptyBucket());
      const totals = summarizeBuckets(buckets);
      if (totals.scheduled === 0) continue;
      const { current, best } = streakFromBuckets(buckets);
      items.push({
        name: h.name,
        currentStreak: current,
        bestStreak: best,
        pct: Math.round((totals.completed / totals.scheduled) * 100),
        scheduled: totals.scheduled,
      });
    }
  }

  if (
    filter === 'all' ||
    filter === 'routineTasks' ||
    filter === 'spiritualTasks' ||
    filter === 'otherTasks'
  ) {
    // Collect standalone taskIds by their analytics category.
    const taskIds = new Set<string>();
    for (const inst of taskInstances) {
      const meta = getInstanceMeta(inst, taskMetaById);
      if (meta.source === 'habit' || meta.source === 'challenge' || meta.source === 'quick') continue;
      const sourceFamily = getSourceFamily(meta);
      if (filter !== 'all' && sourceFamily !== filter) continue;
      taskIds.add(inst.taskId);
    }

    for (const taskId of taskIds) {
      // Title pulled from definitions map (single source of truth).
      const name = getTaskTitle(taskId, undefined, taskMetaById);
      const buckets = snapshots.map(s => s.byTaskId[taskId] ?? emptyBucket());
      const totals = summarizeBuckets(buckets);
      if (totals.scheduled === 0) continue;
      const { current, best } = streakFromBuckets(buckets);
      items.push({
        name,
        currentStreak: current,
        bestStreak: best,
        pct: Math.round((totals.completed / totals.scheduled) * 100),
        scheduled: totals.scheduled,
      });
    }
  }

  if (items.length === 0) {
    return {
      bestStreakEver: null,
      worstStreakEver: null,
      currentBestStreak: null,
      currentWorstStreak: null,
      mostConsistent: null,
      leastConsistent: null,
    };
  }

  const byBest = [...items].sort((a, b) => b.bestStreak - a.bestStreak);
  const byCurrent = [...items].sort((a, b) => b.currentStreak - a.currentStreak);
  const byPct = [...items].filter(i => i.scheduled > 0).sort((a, b) => b.pct - a.pct);

  const pickLeader = (i: typeof items[number] | undefined): StreakLeader | null =>
    i ? { name: i.name, currentStreak: i.currentStreak, bestStreak: i.bestStreak } : null;

  return {
    bestStreakEver: pickLeader(byBest[0]),
    worstStreakEver: byBest.length > 1 ? pickLeader(byBest[byBest.length - 1]) : null,
    currentBestStreak: pickLeader(byCurrent[0]),
    currentWorstStreak: byCurrent.length > 1 ? pickLeader(byCurrent[byCurrent.length - 1]) : null,
    mostConsistent: byPct[0] ? { name: byPct[0].name, pct: byPct[0].pct } : null,
    leastConsistent: byPct.length > 1 ? { name: byPct[byPct.length - 1].name, pct: byPct[byPct.length - 1].pct } : null,
  };
}

export function getPerChallengeBreakdown(
  challenges: ChallengeRecord[],
  snapshots: DailyAnalyticsSnapshot[],
): PerItemBreakdown[] {
  return challenges
    .filter(ch => ch.status !== 'cancelled')
    .map(ch => {
      const buckets = snapshots.map(s => getChallengeBucket(s, ch.id));
      const totals = summarizeBuckets(buckets);
      const { current, best } = streakFromBuckets(buckets);
      return {
        id: ch.id,
        name: ch.title,
        completed: totals.completed,
        scheduled: totals.scheduled,
        skipped: totals.skipped,
        missed: totals.missed,
        pct: totals.scheduled > 0 ? Math.round((totals.completed / totals.scheduled) * 100) : 0,
        currentStreak: totals.scheduled > 0 ? current : ch.streak ?? 0,
        bestStreak: totals.scheduled > 0 ? Math.max(best, ch.bestStreak ?? 0) : ch.bestStreak ?? ch.streak ?? 0,
      };
    })
    .filter(item => item.scheduled > 0 || item.completed > 0 || item.skipped > 0 || item.missed > 0)
    .sort((a, b) => b.pct - a.pct);
}

export function getPerHabitBreakdown(
  habits: AnalyticsHabit[],
  snapshots: DailyAnalyticsSnapshot[],
  habitIdByTaskId: Record<string, string>,
  taskMetaById: Record<string, AnalyticsTaskMeta> = {},
): PerItemBreakdown[] {

  return habits
    .map(h => {
      const buckets = snapshots.map(s => s.byHabit[h.id] ?? emptyBucket());
      const totals = summarizeBuckets(buckets);
      const { current, best } = streakFromBuckets(buckets);

      // Sub-tasks for this habit
      const subTasks = Object.entries(habitIdByTaskId)
        .filter(([, habitId]) => habitId === h.id)
        .map(([taskId]) => {
          const taskBuckets = snapshots.map(s => s.byTaskId[taskId] ?? emptyBucket());
          const stat = summarizeBuckets(taskBuckets);
          if (stat.scheduled === 0) return null;
          const { current: cur, best: bst } = streakFromBuckets(taskBuckets);
          return {
            id: taskId,
            name: getTaskTitle(taskId, undefined, taskMetaById),
            completed: stat.completed,
            scheduled: stat.scheduled,
            skipped: stat.skipped,
            missed: stat.missed,
            pct: stat.scheduled > 0 ? Math.round((stat.completed / stat.scheduled) * 100) : 0,
            currentStreak: cur,
            bestStreak: bst,
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null && s.scheduled > 0);

      return {
        id: h.id,
        name: h.name,
        color: h.color,
        icon: h.icon,
        completed: totals.completed,
        scheduled: totals.scheduled,
        skipped: totals.skipped,
        missed: totals.missed,
        pct: totals.scheduled > 0 ? Math.round((totals.completed / totals.scheduled) * 100) : 0,
        currentStreak: current,
        bestStreak: best,
        isActive: h.active,
        subTasks,
      };
    })
    .filter(item => item.scheduled > 0 || (item.subTasks?.length ?? 0) > 0)
    .sort((a, b) => {
      const aActive = a.isActive ? 1 : 0;
      const bActive = b.isActive ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return b.pct - a.pct;
    });
}

export function getPerTaskCategoryBreakdown(
  taskInstances: TaskInstance[],
  snapshots: DailyAnalyticsSnapshot[],
  taskMetaById: Record<string, AnalyticsTaskMeta> = {},
): Record<'routineTasks' | 'spiritualTasks' | 'otherTasks', PerItemBreakdown[]> {
  // Single pass to collect standalone taskIds + their type/source. Title comes
  // from the definitions map (single source of truth) — avoids re-iterating
  // thousands of instances just to read denormalized title snapshots.
  const taskMeta = new Map<string, {
    title?: string;
    type: TaskType;
    source: TaskInstance['source'];
  }>();

  for (const inst of taskInstances) {
    const meta = taskMetaById[inst.taskId] ?? inst;
    if (meta.source === 'habit' || meta.source === 'challenge' || meta.source === 'quick') continue;
    if (!taskMeta.has(inst.taskId)) {
      taskMeta.set(inst.taskId, {
        title: taskMetaById[inst.taskId]?.title ?? inst.title,
        type: meta.type,
        source: meta.source,
      });
    }
  }

  const breakdown = {
    routineTasks: [] as PerItemBreakdown[],
    spiritualTasks: [] as PerItemBreakdown[],
    otherTasks: [] as PerItemBreakdown[],
  };

  for (const [taskId, meta] of taskMeta) {
    const buckets = snapshots.map(s => s.byTaskId[taskId] ?? emptyBucket());
    const stat = summarizeBuckets(buckets);
    if (stat.scheduled === 0) continue;
    const { current: cur, best: bst } = streakFromBuckets(buckets);
    const item: PerItemBreakdown = {
      id: taskId,
      name: getTaskTitle(taskId, meta.title, taskMetaById),
      completed: stat.completed,
      scheduled: stat.scheduled,
      skipped: stat.skipped,
      missed: stat.missed,
      pct: stat.scheduled > 0 ? Math.round((stat.completed / stat.scheduled) * 100) : 0,
      currentStreak: cur,
      bestStreak: bst,
    };
    const sourceFamily = getSourceFamily(meta);
    if (sourceFamily === 'routineTasks' || sourceFamily === 'spiritualTasks' || sourceFamily === 'otherTasks') {
      breakdown[sourceFamily].push(item);
    }
  }

  breakdown.routineTasks.sort((a, b) => b.pct - a.pct);
  breakdown.spiritualTasks.sort((a, b) => b.pct - a.pct);
  breakdown.otherTasks.sort((a, b) => b.pct - a.pct);
  return breakdown;
}

export function getQuickTaskHighlights(snapshots: DailyAnalyticsSnapshot[]): {
  totalDone: number;
  avgPerDay: number;
  bestDay: { date: string; count: number } | null;
  worstDay: { date: string; count: number } | null;
  thisWeekCount: number;
  thisMonthCount: number;
} {
  const now = new Date();
  const todayKey = formatDateKey(now);
  const weekStartKey = getWeekStartKey(todayKey);
  const monthKey = todayKey.slice(0, 7);

  let totalDone = 0;
  let daysWithTasks = 0;
  let bestDay: { date: string; count: number } | null = null;
  let worstDay: { date: string; count: number } | null = null;
  let thisWeekCount = 0;
  let thisMonthCount = 0;

  for (const s of snapshots) {
    const qt = s.source.quickTasks;
    if (qt.scheduled === 0) continue;
    totalDone += qt.completed;
    daysWithTasks += 1;
    if (!bestDay || qt.completed > bestDay.count) bestDay = { date: s.date, count: qt.completed };
    if (!worstDay || qt.completed < worstDay.count) worstDay = { date: s.date, count: qt.completed };
    if (s.date >= weekStartKey) thisWeekCount += qt.completed;
    if (s.date.startsWith(monthKey)) thisMonthCount += qt.completed;
  }

  return {
    totalDone,
    avgPerDay: daysWithTasks > 0 ? Math.round((totalDone / daysWithTasks) * 10) / 10 : 0,
    bestDay,
    worstDay,
    thisWeekCount,
    thisMonthCount,
  };
}
