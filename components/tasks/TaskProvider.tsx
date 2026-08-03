import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import {
  cleanupLegacyDemoHabitTasks,
  ensureTaskInstancesForDate,
  archiveTaskImmediately,
  listTaskInstancesForDate,
  listTaskLaunchConfigs,
  listTasks,
  markDueTaskInstancesMissed,
  pauseTask,
  resumeTask,
  saveTask,
  setTaskInstanceStatus,
  softDeleteTask,
  syncTaskInstancesWindow,
} from '@/components/tasks/taskDb';
import { getLocalDateKey } from '@/components/tasks/taskScheduler';
import { taskInstanceToListItem } from '@/components/tasks/taskAdapters';
import { resolveTaskLaunchDescriptor } from '@/components/tasks/task-launch-descriptor';
import { queueTaskCompletionReturnAnimation } from '@/components/tasks/taskReturnAnimation';
import {
  repairLegacyChallengeTaskProgress,
  syncChallengeProgressForTaskInstance,
  type ChallengeSyncResult,
} from '@/components/challenges/challengeDb';
import {
  cancelNotificationsForInstance,
  cancelNotificationsForTask,
} from '@/components/notifications/notificationService';
import type {
  TaskDefinition,
  TaskDraft,
  TaskInstance,
  TaskLaunchConfigBundle,
  TaskListItem,
} from '@/components/tasks/taskTypes';
import { openUserContentDb } from '@/data/userContentDb';

type TaskContextValue = {
  ready: boolean;
  challengeCompletionRevision: number;
  selectedDate: string;
  taskDataDate: string;
  isDateLoading: boolean;
  tasks: TaskDefinition[];
  instances: TaskInstance[];
  listItems: TaskListItem[];
  refresh: (date?: string) => Promise<void>;
  createOrUpdateTask: (draft: TaskDraft, refreshDate?: string) => Promise<TaskDefinition>;
  createOrUpdateTasks: (drafts: TaskDraft[], refreshDate?: string) => Promise<TaskDefinition[]>;
  pause: (taskId: string) => Promise<void>;
  pauseTasks: (taskIds: string[], refreshDate?: string) => Promise<void>;
  resume: (taskId: string) => Promise<void>;
  remove: (taskId: string) => Promise<void>;
  removeTasks: (taskIds: string[], refreshDate?: string) => Promise<void>;
  archiveTasksImmediately: (taskIds: string[], refreshDate?: string) => Promise<void>;
  commitInstanceCompletion: (
    instanceId: string,
    refreshDate?: string,
  ) => Promise<TaskCompletionCommitResult>;
  reconcileCommittedCompletion: (
    instanceId: string,
    refreshDate?: string,
    updated?: boolean,
  ) => Promise<void>;
  completeInstance: (instanceId: string, refreshDate?: string) => Promise<ChallengeSyncResult | null>;
  skipInstance: (instanceId: string, refreshDate?: string) => Promise<void>;
  skipInstances: (instanceIds: string[], refreshDate?: string) => Promise<void>;
  resetInstance: (instanceId: string, refreshDate?: string) => Promise<void>;
};

export type TaskCompletionCommitResult = {
  updated: boolean;
  challengeResult: ChallengeSyncResult | null;
};

const TaskContext = createContext<TaskContextValue | null>(null);

let legacyHabitCleanupPromise: Promise<void> | null = null;

function cleanupLegacyDemoHabitTasksOnce() {
  if (!legacyHabitCleanupPromise) {
    legacyHabitCleanupPromise = cleanupLegacyDemoHabitTasks().catch(error => {
      legacyHabitCleanupPromise = null;
      throw error;
    });
  }
  return legacyHabitCleanupPromise;
}

export function TaskProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [challengeCompletionRevision, setChallengeCompletionRevision] = useState(0);
  const initialDate = useMemo(() => getLocalDateKey(), []);
  const selectedDateRef = useRef(initialDate);
  const taskDataDateRef = useRef(initialDate);
  const refreshSeqRef = useRef(0);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [taskDataDate, setTaskDataDate] = useState(initialDate);
  const [isDateLoading, setIsDateLoading] = useState(false);
  const [tasks, setTasks] = useState<TaskDefinition[]>([]);
  const [instances, setInstances] = useState<TaskInstance[]>([]);
  const [launchConfigs, setLaunchConfigs] = useState<Record<string, TaskLaunchConfigBundle>>({});

  const refresh = useCallback(async (date?: string) => {
    const targetDate = date ?? selectedDateRef.current;
    const refreshSeq = refreshSeqRef.current + 1;
    refreshSeqRef.current = refreshSeq;
    selectedDateRef.current = targetDate;
    setSelectedDate(targetDate);
    const dateWillChange = targetDate !== taskDataDateRef.current;
    if (dateWillChange) setIsDateLoading(true);
    await cleanupLegacyDemoHabitTasksOnce();
    await ensureTaskInstancesForDate(targetDate);
    await markDueTaskInstancesMissed();
    const [nextTasks, nextInstances, nextLaunchConfigs] = await Promise.all([
      listTasks(),
      listTaskInstancesForDate(targetDate),
      listTaskLaunchConfigs(),
    ]);
    if (refreshSeq !== refreshSeqRef.current) return;
    taskDataDateRef.current = targetDate;
    setTasks(nextTasks);
    setInstances(nextInstances);
    setLaunchConfigs(nextLaunchConfigs);
    setTaskDataDate(targetDate);
    setIsDateLoading(false);
    setReady(true);
  }, []);

  useEffect(() => {
    const boot = async () => {
      await syncTaskInstancesWindow();
      await repairLegacyChallengeTaskProgress();
      await refresh(getLocalDateKey());
    };

    boot().catch(error => {
      console.warn('Task backend refresh failed:', error);
      setIsDateLoading(false);
      setReady(true);
    });
  }, [refresh]);

  const createOrUpdateTask = useCallback(async (draft: TaskDraft, refreshDate?: string) => {
    const task = await saveTask(draft);
    await cancelNotificationsForTask(task.id);
    await syncTaskInstancesWindow();
    await refresh(refreshDate);
    return task;
  }, [refresh]);

  const createOrUpdateTasks = useCallback(async (drafts: TaskDraft[], refreshDate?: string) => {
    const saved: TaskDefinition[] = [];
    for (const draft of drafts) {
      const task = await saveTask(draft);
      saved.push(task);
    }
    await Promise.all(saved.map(task => cancelNotificationsForTask(task.id)));
    await syncTaskInstancesWindow();
    await refresh(refreshDate);
    return saved;
  }, [refresh]);

  const pause = useCallback(async (taskId: string) => {
    await pauseTask(taskId);
    await cancelNotificationsForTask(taskId);
    await syncTaskInstancesWindow();
    await refresh();
  }, [refresh]);

  const pauseTasks = useCallback(async (taskIds: string[], refreshDate?: string) => {
    for (const taskId of taskIds) {
      await pauseTask(taskId);
    }
    await Promise.all(taskIds.map(taskId => cancelNotificationsForTask(taskId)));
    await syncTaskInstancesWindow();
    await refresh(refreshDate);
  }, [refresh]);

  const resume = useCallback(async (taskId: string) => {
    await resumeTask(taskId);
    await cancelNotificationsForTask(taskId);
    await syncTaskInstancesWindow();
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (taskId: string) => {
    await softDeleteTask(taskId);
    await cancelNotificationsForTask(taskId);
    await syncTaskInstancesWindow();
    await refresh();
  }, [refresh]);

  const removeTasks = useCallback(async (taskIds: string[], refreshDate?: string) => {
    for (const taskId of taskIds) {
      await softDeleteTask(taskId);
    }
    await Promise.all(taskIds.map(taskId => cancelNotificationsForTask(taskId)));
    await syncTaskInstancesWindow();
    await refresh(refreshDate);
  }, [refresh]);

  const archiveTasksImmediately = useCallback(async (taskIds: string[], refreshDate?: string) => {
    for (const taskId of taskIds) {
      await archiveTaskImmediately(taskId);
    }
    await Promise.all(taskIds.map(taskId => cancelNotificationsForTask(taskId)));
    await syncTaskInstancesWindow();
    await refresh(refreshDate);
  }, [refresh]);

  const commitInstanceCompletion = useCallback(async (
    instanceId: string,
    _refreshDate?: string,
  ): Promise<TaskCompletionCommitResult> => {
    const db = await openUserContentDb();
    let updated = false;
    // Keep the transaction output in a holder: TypeScript does not model
    // assignments made inside SQLite's async callback when it narrows the
    // value after the callback returns.
    const transactionResult: { challenge: ChallengeSyncResult | null } = { challenge: null };
    await db.withTransactionAsync(async () => {
      updated = await setTaskInstanceStatus(instanceId, 'completed');
      transactionResult.challenge = updated
        ? await syncChallengeProgressForTaskInstance(instanceId, 'completed')
        : null;
    });
    return {
      updated,
      challengeResult: transactionResult.challenge,
    };
  }, []);

  const reconcileCommittedCompletion = useCallback(async (
    instanceId: string,
    refreshDate?: string,
    updated = true,
  ) => {
    if (updated) {
      await cancelNotificationsForInstance(instanceId).catch(error => {
        console.warn('Completed task notification cleanup failed:', error);
      });
    }
    await refresh(refreshDate).catch(error => {
      // The SQL transaction is already committed. Keep the optimistic state
      // and let the next focus refresh rather than reporting a false failure.
      console.warn('Completed task refresh failed:', error);
    });
  }, [refresh]);

  const completeInstance = useCallback(async (instanceId: string, refreshDate?: string) => {
    const { updated, challengeResult } = await commitInstanceCompletion(instanceId, refreshDate);
    if (challengeResult) {
      // Home observes this even when the current tap merely repairs a legacy
      // Church row. That lets its durable SQL outbox surface a reward while the
      // Home tab stays focused (no navigation focus event required).
      setChallengeCompletionRevision(value => value + 1);
      const celebration = challengeResult.celebration;
      if (celebration) {
        queueTaskCompletionReturnAnimation(instanceId, undefined, {
          source: 'external',
          celebration: {
            type: 'challengeComplete',
            title: celebration.title,
            variant: celebration.variant,
            trophyCount: celebration.trophyCount,
            currentStreak: celebration.currentStreak,
            eventId: celebration.eventId,
            challengeId: celebration.challengeId,
            weekStart: celebration.weekStart,
          },
        });
      }
    }
    await reconcileCommittedCompletion(instanceId, refreshDate, updated);
    return challengeResult;
  }, [commitInstanceCompletion, reconcileCommittedCompletion]);

  const skipInstance = useCallback(async (instanceId: string, refreshDate?: string) => {
    if (refreshDate) await ensureTaskInstancesForDate(refreshDate);
    const db = await openUserContentDb();
    let updated = false;
    await db.withTransactionAsync(async () => {
      updated = await setTaskInstanceStatus(instanceId, 'skipped');
      if (updated) await syncChallengeProgressForTaskInstance(instanceId, 'skipped');
    });
    if (updated) {
      await cancelNotificationsForInstance(instanceId).catch(error => {
        console.warn('Skipped task notification cleanup failed:', error);
      });
    }
    await refresh(refreshDate).catch(error => {
      console.warn('Skipped task refresh failed:', error);
    });
  }, [refresh]);

  const skipInstances = useCallback(async (instanceIds: string[], refreshDate?: string) => {
    const uniqueInstanceIds = [...new Set(instanceIds.filter(Boolean))];
    if (uniqueInstanceIds.length === 0) return;
    if (refreshDate) await ensureTaskInstancesForDate(refreshDate);

    const db = await openUserContentDb();
    const updatedInstanceIds: string[] = [];
    // Skip the whole day as one unit. Running skipInstance in parallel used to
    // create competing transactions/refreshes on the shared SQLite connection,
    // which could roll optimistic cards back to pending on real phones.
    await db.withTransactionAsync(async () => {
      for (const instanceId of uniqueInstanceIds) {
        const updated = await setTaskInstanceStatus(instanceId, 'skipped');
        if (!updated) continue;
        updatedInstanceIds.push(instanceId);
        await syncChallengeProgressForTaskInstance(instanceId, 'skipped');
      }
    });

    await Promise.all(updatedInstanceIds.map(instanceId => (
      cancelNotificationsForInstance(instanceId).catch(error => {
        console.warn('Skipped task notification cleanup failed:', { instanceId, error });
      })
    )));
    await refresh(refreshDate).catch(error => {
      console.warn('Skipped tasks refresh failed:', error);
    });
  }, [refresh]);

  const resetInstance = useCallback(async (instanceId: string, refreshDate?: string) => {
    if (refreshDate) await ensureTaskInstancesForDate(refreshDate);
    const db = await openUserContentDb();
    let updated = false;
    await db.withTransactionAsync(async () => {
      updated = await setTaskInstanceStatus(instanceId, 'pending');
      if (updated) {
        await syncChallengeProgressForTaskInstance(instanceId, 'pending');
      }
    });
    await refresh(refreshDate).catch(error => {
      console.warn('Reset task refresh failed:', error);
    });
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;

    const reconcile = async () => {
      const changed = await markDueTaskInstancesMissed();
      if (!changed || cancelled) return;
      await refresh(selectedDateRef.current);
    };

    void reconcile();
    const interval = setInterval(() => {
      void reconcile();
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refresh]);

  const listItems = useMemo(() => instances.map(instance => taskInstanceToListItem(
    instance,
    resolveTaskLaunchDescriptor(instance, launchConfigs[instance.taskId]),
  )), [instances, launchConfigs]);

  const value = useMemo<TaskContextValue>(() => ({
    ready,
    challengeCompletionRevision,
    selectedDate,
    taskDataDate,
    isDateLoading,
    tasks,
    instances,
    listItems,
    refresh,
    createOrUpdateTask,
    createOrUpdateTasks,
    pause,
    pauseTasks,
    resume,
    remove,
    removeTasks,
    archiveTasksImmediately,
    commitInstanceCompletion,
    reconcileCommittedCompletion,
    completeInstance,
    skipInstance,
    skipInstances,
    resetInstance,
  }), [
    ready,
    challengeCompletionRevision,
    selectedDate,
    taskDataDate,
    isDateLoading,
    tasks,
    instances,
    listItems,
    refresh,
    createOrUpdateTask,
    createOrUpdateTasks,
    pause,
    pauseTasks,
    resume,
    remove,
    removeTasks,
    archiveTasksImmediately,
    commitInstanceCompletion,
    reconcileCommittedCompletion,
    completeInstance,
    skipInstance,
    skipInstances,
    resetInstance,
  ]);

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTasks() {
  const value = useContext(TaskContext);
  if (!value) {
    throw new Error('useTasks must be used inside TaskProvider');
  }
  return value;
}
