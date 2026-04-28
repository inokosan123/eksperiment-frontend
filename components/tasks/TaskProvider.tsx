import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import {
  ensureTaskInstancesForDate,
  listTasks,
  pauseTask,
  resumeTask,
  saveTask,
  setTaskInstanceStatus,
  softDeleteTask,
} from '@/components/tasks/taskDb';
import { getLocalDateKey } from '@/components/tasks/taskScheduler';
import { taskInstanceToListItem } from '@/components/tasks/taskAdapters';
import type { TaskDefinition, TaskDraft, TaskInstance, TaskListItem } from '@/components/tasks/taskTypes';

type TaskContextValue = {
  ready: boolean;
  selectedDate: string;
  tasks: TaskDefinition[];
  instances: TaskInstance[];
  listItems: TaskListItem[];
  refresh: (date?: string) => Promise<void>;
  createOrUpdateTask: (draft: TaskDraft) => Promise<TaskDefinition>;
  pause: (taskId: string) => Promise<void>;
  resume: (taskId: string) => Promise<void>;
  remove: (taskId: string) => Promise<void>;
  completeInstance: (instanceId: string) => Promise<void>;
  skipInstance: (instanceId: string) => Promise<void>;
  resetInstance: (instanceId: string) => Promise<void>;
};

const TaskContext = createContext<TaskContextValue | null>(null);

export function TaskProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const initialDate = useMemo(() => getLocalDateKey(), []);
  const selectedDateRef = useRef(initialDate);
  const refreshSeqRef = useRef(0);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [tasks, setTasks] = useState<TaskDefinition[]>([]);
  const [instances, setInstances] = useState<TaskInstance[]>([]);

  const refresh = useCallback(async (date?: string) => {
    const targetDate = date ?? selectedDateRef.current;
    const refreshSeq = refreshSeqRef.current + 1;
    refreshSeqRef.current = refreshSeq;
    selectedDateRef.current = targetDate;
    setSelectedDate(targetDate);
    const [nextTasks, nextInstances] = await Promise.all([
      listTasks(),
      ensureTaskInstancesForDate(targetDate),
    ]);
    if (refreshSeq !== refreshSeqRef.current) return;
    setTasks(nextTasks);
    setInstances(nextInstances);
    setReady(true);
  }, []);

  useEffect(() => {
    refresh(getLocalDateKey()).catch(error => {
      console.warn('Task backend refresh failed:', error);
      setReady(true);
    });
  }, [refresh]);

  const createOrUpdateTask = useCallback(async (draft: TaskDraft) => {
    const task = await saveTask(draft);
    await refresh();
    return task;
  }, [refresh]);

  const pause = useCallback(async (taskId: string) => {
    await pauseTask(taskId);
    await refresh();
  }, [refresh]);

  const resume = useCallback(async (taskId: string) => {
    await resumeTask(taskId);
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (taskId: string) => {
    await softDeleteTask(taskId);
    await refresh();
  }, [refresh]);

  const completeInstance = useCallback(async (instanceId: string) => {
    await setTaskInstanceStatus(instanceId, 'completed');
    await refresh();
  }, [refresh]);

  const skipInstance = useCallback(async (instanceId: string) => {
    await setTaskInstanceStatus(instanceId, 'skipped');
    await refresh();
  }, [refresh]);

  const resetInstance = useCallback(async (instanceId: string) => {
    await setTaskInstanceStatus(instanceId, 'pending');
    await refresh();
  }, [refresh]);

  const listItems = useMemo(() => instances.map(taskInstanceToListItem), [instances]);

  const value = useMemo<TaskContextValue>(() => ({
    ready,
    selectedDate,
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
