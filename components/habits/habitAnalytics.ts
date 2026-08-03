import type { ConsistencyBucket, TaskAnalyticsData } from '@/components/tasks/taskAnalyticsModel';

export type HabitStepAnalyticsEntry = {
  stepId: string;
  analytics: TaskAnalyticsData | null;
};

export type HabitAggregateAnalytics = {
  thisWeek: ConsistencyBucket;
  thisMonth: ConsistencyBucket;
  sinceStart: ConsistencyBucket;
  totalSkips: number;
  trackedSteps: number;
};

const EMPTY_BUCKET: ConsistencyBucket = { completed: 0, scheduled: 0, pct: 0 };

function aggregateBucket(
  entries: HabitStepAnalyticsEntry[],
  key: 'thisWeek' | 'thisMonth' | 'sinceStart',
): ConsistencyBucket {
  const completed = entries.reduce(
    (total, entry) => total + (entry.analytics?.[key].completed ?? 0),
    0,
  );
  const scheduled = entries.reduce(
    (total, entry) => total + (entry.analytics?.[key].scheduled ?? 0),
    0,
  );
  return {
    completed,
    scheduled,
    pct: scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0,
  };
}

export function aggregateHabitAnalytics(entries: HabitStepAnalyticsEntry[]): HabitAggregateAnalytics {
  if (entries.length === 0) {
    return {
      thisWeek: EMPTY_BUCKET,
      thisMonth: EMPTY_BUCKET,
      sinceStart: EMPTY_BUCKET,
      totalSkips: 0,
      trackedSteps: 0,
    };
  }

  return {
    thisWeek: aggregateBucket(entries, 'thisWeek'),
    thisMonth: aggregateBucket(entries, 'thisMonth'),
    sinceStart: aggregateBucket(entries, 'sinceStart'),
    totalSkips: entries.reduce((total, entry) => total + (entry.analytics?.totalSkips ?? 0), 0),
    trackedSteps: entries.filter(entry => (entry.analytics?.sinceStart.scheduled ?? 0) > 0).length,
  };
}

export function rankTrackedHabitSteps(entries: HabitStepAnalyticsEntry[]) {
  return entries
    .filter(entry => (entry.analytics?.sinceStart.scheduled ?? 0) > 0)
    .sort((a, b) => {
      const aBucket = a.analytics?.sinceStart ?? EMPTY_BUCKET;
      const bBucket = b.analytics?.sinceStart ?? EMPTY_BUCKET;
      return bBucket.pct - aBucket.pct
        || bBucket.completed - aBucket.completed
        || bBucket.scheduled - aBucket.scheduled;
    });
}
