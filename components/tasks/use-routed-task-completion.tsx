import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { AlertTriangle } from '@/components/icons/Icons';
import { C } from '@/constants/tokens';
import { useTasks } from '@/components/tasks/TaskProvider';
import {
  beginTaskCompletionReturn,
  clearTaskCompletionReturnAnimation,
  markTaskCompletionReturnSettled,
  queueTaskCompletionReturnAnimation,
} from '@/components/tasks/taskReturnAnimation';
import { HOME_POST_TRANSITION_SETTLE_MS } from '@/components/tasks/taskCompletionTimeline';
import { createCompletionAttemptGuard } from '@/components/tasks/task-completion-attempt';

type IdleRuntime = typeof globalThis & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
};

function scheduleIdle(callback: () => void) {
  const runtime = globalThis as IdleRuntime;
  if (runtime.requestIdleCallback) {
    runtime.requestIdleCallback(callback, { timeout: 900 });
    return;
  }
  setTimeout(callback, 0);
}

type CompletionRequest<T> = {
  persistCritical?: () => Promise<T>;
  reconcileAfterReturn?: () => void | Promise<void>;
};

export type RoutedCompletionResult<T> =
  | { ok: true; value: T }
  | { ok: false };

type StoredRequest = {
  request: CompletionRequest<unknown>;
};

export function useRoutedTaskCompletion({
  taskInstanceId,
  taskDate,
}: {
  taskInstanceId?: string;
  taskDate?: string;
}) {
  const router = useRouter();
  const navigation = useNavigation();
  const rootNavigation = useNavigation('/') as any;
  const { commitInstanceCompletion, reconcileCommittedCompletion } = useTasks();
  const attemptGuardRef = useRef(createCompletionAttemptGuard());
  const awaitingCloseRef = useRef<{
    instanceId: string;
    taskDate?: string;
    updated: boolean;
    reconcileAfterReturn?: () => void | Promise<void>;
    settled: boolean;
  } | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storedRequestRef = useRef<StoredRequest | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [showSlowIndicator, setShowSlowIndicator] = useState(false);
  const [saveErrorVisible, setSaveErrorVisible] = useState(false);

  const clearSlowTimer = useCallback(() => {
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    slowTimerRef.current = null;
    setShowSlowIndicator(false);
  }, []);

  const settleReturn = useCallback(() => {
    const pending = awaitingCloseRef.current;
    if (!pending || pending.settled) return;
    pending.settled = true;
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = null;
    markTaskCompletionReturnSettled(pending.instanceId);
    setTimeout(() => {
      scheduleIdle(() => {
        void Promise.all([
          reconcileCommittedCompletion(pending.instanceId, pending.taskDate, pending.updated),
          Promise.resolve(pending.reconcileAfterReturn?.()),
        ]).catch(error => {
          console.warn('Task completion reconciliation failed:', error);
        });
      });
    }, HOME_POST_TRANSITION_SETTLE_MS + 24);
  }, [reconcileCommittedCompletion]);

  useEffect(() => () => {
    clearSlowTimer();
    // Native-stack normally emits transitionEnd before the route unmounts.
    // A completed route unmount is also a safe final signal and prevents an
    // interrupted/cancelled event from being stranded in the return queue.
    if (awaitingCloseRef.current && !awaitingCloseRef.current.settled) {
      settleReturn();
    } else if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, [clearSlowTimer, settleReturn]);

  const armTransitionFallback = useCallback(() => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    // Native transitionEnd is the normal path. This watchdog only prevents a
    // completion from remaining stranded after an interrupted OS transition.
    fallbackTimerRef.current = setTimeout(settleReturn, 850);
  }, [settleReturn]);

  useEffect(() => {
    const unsubscribeStart = rootNavigation.addListener('transitionStart', (event: any) => {
      if (event?.data?.closing && awaitingCloseRef.current) armTransitionFallback();
    });
    const unsubscribeEnd = rootNavigation.addListener('transitionEnd', (event: any) => {
      if (event?.data?.closing) settleReturn();
    });
    return () => {
      unsubscribeStart();
      unsubscribeEnd();
    };
  }, [armTransitionFallback, rootNavigation, settleReturn]);

  useEffect(() => navigation.addListener('beforeRemove', event => {
    if (!attemptGuardRef.current.isLocked() || awaitingCloseRef.current) return;
    // Critical content/task persistence is still in flight. Do not allow a
    // native swipe or hardware back to tear down the only in-memory draft.
    event.preventDefault();
  }), [navigation]);

  const run = useCallback(async <T,>(
    request: CompletionRequest<T>,
  ): Promise<RoutedCompletionResult<T>> => {
    if (!attemptGuardRef.current.tryStart()) return { ok: false };
    setIsFinishing(true);
    setSaveErrorVisible(false);
    Keyboard.dismiss();
    slowTimerRef.current = setTimeout(() => setShowSlowIndicator(true), 180);
    beginTaskCompletionReturn(taskInstanceId, taskDate);

    try {
      const value = request.persistCritical
        ? await request.persistCritical()
        : undefined as T;

      if (!taskInstanceId) {
        clearSlowTimer();
        attemptGuardRef.current.release();
        setIsFinishing(false);
        return { ok: true, value };
      }

      const commit = await commitInstanceCompletion(taskInstanceId, taskDate);
      const celebration = commit.challengeResult?.celebration;
      queueTaskCompletionReturnAnimation(taskInstanceId, undefined, {
        source: 'routed',
        taskDate,
        updated: commit.updated,
        celebration: celebration ? {
          type: 'challengeComplete',
          title: celebration.title,
          variant: celebration.variant,
          trophyCount: celebration.trophyCount,
          currentStreak: celebration.currentStreak,
          eventId: celebration.eventId,
          challengeId: celebration.challengeId,
          weekStart: celebration.weekStart,
        } : undefined,
      });
      awaitingCloseRef.current = {
        instanceId: taskInstanceId,
        taskDate,
        updated: commit.updated,
        reconcileAfterReturn: request.reconcileAfterReturn,
        settled: false,
      };
      clearSlowTimer();
      return { ok: true, value };
    } catch (error) {
      clearTaskCompletionReturnAnimation(taskInstanceId);
      clearSlowTimer();
      attemptGuardRef.current.release();
      setIsFinishing(false);
      setSaveErrorVisible(true);
      console.warn('Task finish commit failed:', error);
      return { ok: false };
    }
  }, [clearSlowTimer, commitInstanceCompletion, taskDate, taskInstanceId]);

  const completeBeforeReturn = useCallback(async <T,>(request: CompletionRequest<T>) => {
    storedRequestRef.current = { request };
    return run(request);
  }, [run]);

  const finishAndReturn = useCallback(async <T,>(request: CompletionRequest<T>) => {
    storedRequestRef.current = { request };
    const result = await run(request);
    if (result.ok) router.back();
    return result;
  }, [router, run]);

  const retry = useCallback(async () => {
    const stored = storedRequestRef.current;
    if (!stored) return;
    setSaveErrorVisible(false);
    const result = await run(stored.request);
    if (result.ok) router.back();
  }, [router, run]);

  const keepEditing = useCallback(() => {
    setSaveErrorVisible(false);
    storedRequestRef.current = null;
  }, []);

  return {
    completeBeforeReturn,
    finishAndReturn,
    isFinishing,
    showSlowIndicator,
    saveErrorVisible,
    retry,
    keepEditing,
  };
}

export function RoutedTaskCompletionErrorModal({
  visible,
  onRetry,
  onKeepEditing,
}: {
  visible: boolean;
  onRetry: () => void;
  onKeepEditing: () => void;
}) {
  return (
    <ConfirmModal
      visible={visible}
      icon={<AlertTriangle s={22} c="#9A3412" w={2.2} />}
      iconBg="#FFF1E8"
      title="Couldn’t finish this task"
      body="Your progress is still here. Try again to save it before leaving."
      cancelLabel="Keep editing"
      confirmLabel="Try again"
      confirmColor={C.text}
      naturalButtonLabels
      onCancel={onKeepEditing}
      onConfirm={onRetry}
    />
  );
}
