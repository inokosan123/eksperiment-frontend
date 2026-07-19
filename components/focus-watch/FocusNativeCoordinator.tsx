import { useEffect } from 'react';
import { router } from 'expo-router';
import { AppState } from 'react-native';
import {
  activeZone,
  dateKey,
  finalizeNativeDayReconciliation,
  getEffectivePlan,
  getDayPlanState,
  grantScreenTimePermission,
  invalidateUnresolvedNativeTargetArming,
  markScreenTimePermissionDenied,
  markScreenTimePermissionNotDetermined,
  recordNativeBoundaryEvent,
  reconcileNativeTargetArmedDays,
  reconcileNativeTargetLostDays,
  rollbackQuietHourStart,
  setNativeProtectionState,
  tickDayPlanStore,
  useDayPlan,
} from './dayPlanStore';
import {
  applyNativeProtection,
  clearNativeProtection,
  consumeNativeBoundaryEvents,
  consumeNativePendingIntervention,
  getNativeAuthorizationStatus,
  getNativeRuntimeStatus,
  isNativeFocusAvailable,
} from './focusNativeBridge';

let applyInFlight = false;
let applyQueued = false;
let lastInterventionCreatedAt = 0;

function selectionParts(value: string) {
  const groupMarker = '.group.';
  const appMarker = '.app.';
  const groupIndex = value.lastIndexOf(groupMarker);
  const appIndex = value.lastIndexOf(appMarker);
  return {
    group: groupIndex >= 0
      ? value.slice(groupIndex + groupMarker.length, appIndex > groupIndex ? appIndex : undefined)
      : '',
    app: appIndex >= 0 ? value.slice(appIndex + appMarker.length) : '',
  };
}

async function openPendingIntervention() {
  const pending = await consumeNativePendingIntervention();
  if (!pending || pending.createdAt <= lastInterventionCreatedAt) return;
  lastInterventionCreatedAt = pending.createdAt;

  const age = Date.now() - pending.createdAt;
  const canContinue = pending.strength === 'loose' || pending.kind === 'checkin';
  if (!canContinue || age < 0 || age > 10 * 60_000 || !pending.accessSelectionId) return;

  const now = new Date();
  const today = dateKey(now);
  if (pending.day && pending.day !== today) return;
  const currentState = getDayPlanState();
  const currentPlan = getEffectivePlan(currentState, now);
  if (pending.planId && currentPlan?.id !== pending.planId) return;
  if (pending.sessionId && pending.sessionId !== 'daily') {
    const currentSession = activeZone(currentPlan, now);
    if (currentSession?.id !== pending.sessionId) return;
  }

  const { group, app } = selectionParts(pending.selectionId);
  router.push({
    pathname: '/focus-intervention',
    params: {
      native: '1',
      nativeSelection: pending.accessSelectionId,
      sourceSelection: pending.selectionId,
      nativeKind: pending.kind,
      session: pending.sessionId,
      day: pending.day,
      plan: pending.planId,
      practice: pending.practice,
      strength: pending.strength,
      moment: pending.kind === 'checkin' ? 'checkin' : pending.kind === 'always' ? 'always' : 'limit',
      spent: String(pending.minutes || 15),
      ...(group ? { group } : {}),
      ...(pending.label || app ? { app: pending.label || app } : {}),
    },
  } as never);
}

async function reconcileNativeBoundaryLedger() {
  const events = await consumeNativeBoundaryEvents();
  for (const event of events) {
    if (event.kind === 'daily-target') {
      recordNativeBoundaryEvent('daily-target', event.selectionId, event.sessionId, event.day, event.planId);
    } else if (event.kind === 'daily-hard') {
      recordNativeBoundaryEvent('daily-hard', event.selectionId, event.sessionId, event.day, event.planId);
    }
  }
}

async function applyCurrentProtection() {
  if (applyInFlight) {
    applyQueued = true;
    return;
  }

  const current = getDayPlanState();
  if (!current.hydrated || current.permission !== 'approved' || !isNativeFocusAvailable()) return;

  applyInFlight = true;
  setNativeProtectionState({
    status: 'applying',
    appliedAt: current.nativeProtection.appliedAt,
    error: null,
    hardWallDate: current.nativeProtection.hardWallDate,
  });

  try {
    const result = await applyNativeProtection(getDayPlanState());
    if ('targetLostDays' in result && result.targetLostDays) {
      reconcileNativeTargetLostDays(result.targetLostDays);
    }
    if ('targetArmedDays' in result && result.targetArmedDays) {
      reconcileNativeTargetArmedDays(result.targetArmedDays);
    }
    if (
      current.quiet
      && 'quietHourActive' in result
      && result.quietHourActive === false
      && current.quiet.endsAt > Date.now()
    ) {
      rollbackQuietHourStart(current.quiet.startedAt);
    }
    if (result.applied) {
      const hardWallDate = !result.unavailable && result.hardWallReached
        ? result.hardWallDate ?? dateKey(new Date())
        : null;
      setNativeProtectionState({
        status: 'applied',
        appliedAt: Date.now(),
        error: null,
        hardWallDate,
      });
    } else {
      if ('errorCode' in result && result.errorCode === 'unauthorized') {
        const runtime = await getNativeRuntimeStatus();
        if (runtime?.targetLostDays) reconcileNativeTargetLostDays(runtime.targetLostDays);
        invalidateUnresolvedNativeTargetArming();
        finalizeNativeDayReconciliation();
        await clearNativeProtection();
        markScreenTimePermissionDenied();
        return;
      }
      setNativeProtectionState({
        status: 'error',
        appliedAt: null,
        error: ('error' in result ? result.error : undefined) ?? 'Protection could not be applied.',
        hardWallDate: current.nativeProtection.hardWallDate,
      });
    }
  } catch (error) {
    console.warn('[focus-native] could not apply protection', error);
    setNativeProtectionState({
      status: 'error',
      appliedAt: null,
      error: error instanceof Error ? error.message : 'Protection could not be applied.',
      hardWallDate: current.nativeProtection.hardWallDate,
    });
    const runtime = await getNativeRuntimeStatus();
    if (runtime?.targetLostDays) {
      reconcileNativeTargetLostDays(runtime.targetLostDays);
    }
    if (runtime?.targetArmedDays) {
      reconcileNativeTargetArmedDays(runtime.targetArmedDays);
    }
    if (current.quiet && runtime?.quietHourActive === false && current.quiet.endsAt > Date.now()) {
      rollbackQuietHourStart(current.quiet.startedAt);
    }
  } finally {
    applyInFlight = false;
    if (applyQueued) {
      applyQueued = false;
      void applyCurrentProtection();
    }
  }
}

async function reconcileAuthorization() {
  if (!isNativeFocusAvailable()) return;
  const status = await getNativeAuthorizationStatus();
  await reconcileNativeBoundaryLedger();
  if (status === 'approved') {
    grantScreenTimePermission('approved');
    await applyCurrentProtection();
    if (getDayPlanState().permission !== 'approved') return;
    const runtime = await getNativeRuntimeStatus();
    if (runtime) {
      reconcileNativeTargetLostDays(runtime.targetLostDays ?? {});
      reconcileNativeTargetArmedDays(runtime.targetArmedDays ?? {});
      const current = getDayPlanState().nativeProtection;
      setNativeProtectionState({
        ...current,
        hardWallDate: runtime.hardWallReached ? runtime.hardWallDate ?? dateKey(new Date()) : null,
      });
    }
    finalizeNativeDayReconciliation();
    await openPendingIntervention();
  } else if (status === 'denied') {
    const runtime = await getNativeRuntimeStatus();
    if (runtime) reconcileNativeTargetLostDays(runtime.targetLostDays ?? {});
    invalidateUnresolvedNativeTargetArming();
    finalizeNativeDayReconciliation();
    await clearNativeProtection();
    markScreenTimePermissionDenied();
  } else if (status === 'notDetermined') {
    const runtime = await getNativeRuntimeStatus();
    if (runtime) reconcileNativeTargetLostDays(runtime.targetLostDays ?? {});
    invalidateUnresolvedNativeTargetArming();
    finalizeNativeDayReconciliation();
    await clearNativeProtection();
    markScreenTimePermissionNotDetermined();
  }
}

function localTimeContext() {
  const now = new Date();
  return `${dateKey(now)}|${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
}

export default function FocusNativeCoordinator() {
  const state = useDayPlan();

  useEffect(() => {
    if (state.hydrated && state.permission === 'approved' && !isNativeFocusAvailable()) {
      setNativeProtectionState({
        status: 'error',
        appliedAt: null,
        error: 'The Anasta development build is required to apply iPhone protection.',
        hardWallDate: null,
      });
    }
    void reconcileAuthorization();

    let lastTimeContext = localTimeContext();
    const appStateSubscription = AppState.addEventListener('change', next => {
      if (next !== 'active') return;
      // A Hard Lock request may have become eligible while iOS suspended the
      // host. Apply it before rebuilding native web protection on foreground.
      tickDayPlanStore();
      lastTimeContext = localTimeContext();
      void reconcileAuthorization();
    });
    const timeContextTimer = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      tickDayPlanStore();
      const next = localTimeContext();
      if (next === lastTimeContext) return;
      lastTimeContext = next;
      void reconcileAuthorization();
    }, 30_000);

    return () => {
      appStateSubscription.remove();
      clearInterval(timeContextTimer);
    };
  }, [state.hydrated, state.permission]);

  useEffect(() => {
    if (!state.hydrated || state.permission !== 'approved' || !isNativeFocusAvailable()) return;
    const timer = setTimeout(() => {
      void applyCurrentProtection();
    }, 140);
    return () => clearTimeout(timer);
  }, [
    state.alwaysBlockedApps,
    state.days,
    state.designatedCoreAppIds,
    state.hydrated,
    state.optionalEssentialAppIds,
    state.permission,
    state.plans,
    state.purity,
    state.quiet,
    state.schedule,
  ]);

  return null;
}
