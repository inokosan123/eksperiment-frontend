import { useCallback, useEffect, useMemo, useState } from 'react';
import { useChallenges } from '@/components/challenges/ChallengesContext';
import { useTasks } from '@/components/tasks/TaskProvider';
import { listTaskHabitMap, listTaskInstancesBetween, syncTaskInstancesWindow } from '@/components/tasks/taskDb';
import { listHabitsForAnalytics } from '@/components/habits/habitDb';
import type { TaskInstance } from '@/components/tasks/taskTypes';
import {
  buildAnalyticsOverview,
  formatDateKey,
  type AnalyticsHabit,
  type AnalyticsOverviewData,
} from '@/components/analytics/analyticsOverview';

// 12-month rolling window matches Capacitor's analyticsMinStartDate logic.
function rollingStart(date: Date) {
  const anchor = new Date(date.getFullYear(), date.getMonth() - 12, 1, 12, 0, 0, 0);
  return formatDateKey(anchor);
}

export function useAnalytics() {
  const { challenges } = useChallenges();
  // refresh is exposed for callers that mutate something while on the screen
  const { refresh: refreshTasks } = useTasks();

  const [instances, setInstances] = useState<TaskInstance[]>([]);
  const [habits, setHabits] = useState<AnalyticsHabit[]>([]);
  const [habitIdByTaskId, setHabitIdByTaskId] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const today = new Date();
      const fromKey = rollingStart(today);
      const toKey = formatDateKey(today);
      await syncTaskInstancesWindow(today);
      const [insts, hMap, hList] = await Promise.all([
        listTaskInstancesBetween(fromKey, toKey),
        listTaskHabitMap(),
        listHabitsForAnalytics(),
      ]);
      setInstances(insts);
      setHabitIdByTaskId(hMap);
      setHabits(hList);
    } catch (err) {
      console.warn('Analytics load failed', err);
      setError(err);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    await refreshTasks();
    await load();
  }, [load, refreshTasks]);

  const overview: AnalyticsOverviewData | null = useMemo(() => {
    if (!ready) return null;
    return buildAnalyticsOverview({
      taskInstances: instances,
      habitIdByTaskId,
      habits,
      challenges,
      // 12-month floor
      minStartDate: rollingStart(new Date()),
    });
  }, [ready, instances, habitIdByTaskId, habits, challenges]);

  return {
    ready,
    error,
    overview,
    instances,
    habits,
    habitIdByTaskId,
    challenges,
    refresh,
  };
}
