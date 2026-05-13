import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import {
  cleanupLegacyDemoHabitTasks,
  ensureTaskInstancesForDate,
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
import { rollbackScriptureCheckpointForTaskInstance } from '@/components/scripture/scriptureCheckpointDb';
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
  createOrUpdateTask: (draft: TaskDraft) => Promise<TaskDefinition>;
  pause: (taskId: string) => Promise<void>;
  resume: (taskId: string) => Promise<void>;
  remove: (taskId: string) => Promise<void>;
  completeInstance: (instanceId: string, refreshDate?: string) => Promise<void>;
  skipInstance: (instanceId: string, refreshDate?: string) => Promise<void>;
  resetInstance: (instanceId: string, refreshDate?: string) => Promise<void>;
};

const TaskContext = createContext<TaskContextValue | null>(null);

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
    await cleanupLegacyDemoHabitTasks();
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

  const createOrUpdateTask = useCallback(async (draft: TaskDraft) => {
    const task = await saveTask(draft);
    await syncTaskInstancesWindow();
    await refresh();
    return task;
  }, [refresh]);

  const pause = useCallback(async (taskId: string) => {
    await pauseTask(taskId);
    await syncTaskInstancesWindow();
    await refresh();
  }, [refresh]);

  const resume = useCallback(async (taskId: string) => {
    await resumeTask(taskId);
    await syncTaskInstancesWindow();
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (taskId: string) => {
    await softDeleteTask(taskId);
    await syncTaskInstancesWindow();
    await refresh();
  }, [refresh]);

  const completeInstance = useCallback(async (instanceId: string, refreshDate?: string) => {
    if (refreshDate) await ensureTaskInstancesForDate(refreshDate);
    const updated = await setTaskInstanceStatus(instanceId, 'completed');
    if (updated) await syncChallengeProgressForTaskInstance(instanceId, 'completed');
    await refresh(refreshDate);
  }, [refresh]);

  const skipInstance = useCallback(async (instanceId: string, refreshDate?: string) => {
    if (refreshDate) await ensureTaskInstancesForDate(refreshDate);
    const updated = await setTaskInstanceStatus(instanceId, 'skipped');
    if (updated) await syncChallengeProgressForTaskInstance(instanceId, 'skipped');
    await refresh(refreshDate);
  }, [refresh]);

  const resetInstance = useCallback(async (instanceId: string, refreshDate?: string) => {
    if (refreshDate) await ensureTaskInstancesForDate(refreshDate);
    const updated = await setTaskInstanceStatus(instanceId, 'pending');
    if (updated) {
      await syncChallengeProgressForTaskInstance(instanceId, 'pending');
      await rollbackScriptureCheckpointForTaskInstance(instanceId);
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
    pause,
    resume,
    remove,
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
    pause,
    resume,
    remove,
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
