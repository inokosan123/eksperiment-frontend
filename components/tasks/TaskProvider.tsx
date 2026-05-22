import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import {
  cleanupLegacyDemoHabitTasks,
  ensureTaskInstancesForDate,
  archiveTaskImmediately,
  listTaskInstancesForDate,
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
import { syncChallengeProgressForTaskInstance } from '@/components/challenges/challengeDb';
import {
  cancelNotificationsForInstance,
  cancelNotificationsForTask,
} from '@/components/notifications/notificationService';
import type { TaskDefinition, TaskDraft, TaskInstance, TaskListItem } from '@/components/tasks/taskTypes';

type TaskContextValue = {
  ready: boolean;
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
  completeInstance: (instanceId: string, refreshDate?: string) => Promise<void>;
  skipInstance: (instanceId: string, refreshDate?: string) => Promise<void>;
  resetInstance: (instanceId: string, refreshDate?: string) => Promise<void>;
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
  const initialDate = useMemo(() => getLocalDateKey(), []);
  const selectedDateRef = useRef(initialDate);
  const taskDataDateRef = useRef(initialDate);
  const refreshSeqRef = useRef(0);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [taskDataDate, setTaskDataDate] = useState(initialDate);
  const [isDateLoading, setIsDateLoading] = useState(false);
  const [tasks, setTasks] = useState<TaskDefinition[]>([]);
  const [instances, setInstances] = useState<TaskInstance[]>([]);

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
    const [nextTasks, nextInstances] = await Promise.all([
      listTasks(),
      listTaskInstancesForDate(targetDate),
    ]);
    if (refreshSeq !== refreshSeqRef.current) return;
    taskDataDateRef.current = targetDate;
    setTasks(nextTasks);
    setInstances(nextInstances);
    setTaskDataDate(targetDate);
    setIsDateLoading(false);
    setReady(true);
  }, []);

  useEffect(() => {
    const boot = async () => {
      await syncTaskInstancesWindow();
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

  const completeInstance = useCallback(async (instanceId: string, refreshDate?: string) => {
    if (refreshDate) await ensureTaskInstancesForDate(refreshDate);
    const updated = await setTaskInstanceStatus(instanceId, 'completed');
    if (updated) await syncChallengeProgressForTaskInstance(instanceId, 'completed');
    if (updated) await cancelNotificationsForInstance(instanceId);
    await refresh(refreshDate);
  }, [refresh]);

  const skipInstance = useCallback(async (instanceId: string, refreshDate?: string) => {
    if (refreshDate) await ensureTaskInstancesForDate(refreshDate);
    const updated = await setTaskInstanceStatus(instanceId, 'skipped');
    if (updated) await syncChallengeProgressForTaskInstance(instanceId, 'skipped');
    if (updated) await cancelNotificationsForInstance(instanceId);
    await refresh(refreshDate);
  }, [refresh]);

  const resetInstance = useCallback(async (instanceId: string, refreshDate?: string) => {
    if (refreshDate) await ensureTaskInstancesForDate(refreshDate);
    const updated = await setTaskInstanceStatus(instanceId, 'pending');
    if (updated) {
      await syncChallengeProgressForTaskInstance(instanceId, 'pending');
    }
    await refresh(refreshDate);
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

  const listItems = useMemo(() => instances.map(taskInstanceToListItem), [instances]);

  const value = useMemo<TaskContextValue>(() => ({
    ready,
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
    completeInstance,
    skipInstance,
    resetInstance,
  }), [
    ready,
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
    completeInstance,
    skipInstance,
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
