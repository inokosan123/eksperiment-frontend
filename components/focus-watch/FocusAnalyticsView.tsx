import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Linking,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { C } from '@/constants/tokens';
import {
  grantScreenTimePermission,
  markScreenTimePermissionDenied,
  markScreenTimePermissionNotDetermined,
  useDayPlan,
} from './dayPlanStore';
import FocusAnalyticsNativeReport, {
  hasNativeFocusAnalyticsReport,
} from './FocusAnalyticsNativeReport';
import {
  buildAnalyticsDateRange,
  focusAnalyticsRequestCanCommit,
  prepareFocusAnalyticsContext,
  selectionForPeriod,
  shiftAnalyticsSelection,
  type FocusAnalyticsPeriod,
  type FocusAnalyticsSelection,
  type PreparedFocusAnalyticsContext,
} from './analytics';
import FocusAnalyticsDateNavigator from './analytics/FocusAnalyticsDateNavigator';
import FocusAnalyticsFallback from './analytics/FocusAnalyticsFallback';
import FocusAnalyticsPeriodControl from './analytics/FocusAnalyticsPeriodControl';
import {
  isNativeFocusAvailable,
  isNativeFocusAnalyticsAvailable,
  getNativeAuthorizationStatus,
  requestNativeAuthorization,
  syncNativeAnalyticsContext,
} from './focusNativeBridge';

type FocusAnalyticsLoadState =
  | { kind: 'preparing'; requestId: string }
  | { kind: 'slow'; requestId: string; elapsedMs: number }
  | { kind: 'mounted'; requestId: string }
  | { kind: 'permissionRequired' }
  | { kind: 'unavailable'; reason: string };

const SLOW_REPORT_MS = 6_000;
const FOREGROUND_REFRESH_MS = 5 * 60_000;

function wait(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function requestId(sequence: number) {
  return `analytics-${Date.now()}-${sequence}`;
}

export default function FocusAnalyticsView() {
  const state = useDayPlan();
  const reduceMotion = useReducedMotion();
  const [selection, setSelection] = useState<FocusAnalyticsSelection>(
    () => selectionForPeriod('week'),
  );
  const [prepared, setPrepared] = useState<PreparedFocusAnalyticsContext | null>(null);
  const [mountedRequest, setMountedRequest] = useState<PreparedFocusAnalyticsContext | null>(null);
  const [loadState, setLoadState] = useState<FocusAnalyticsLoadState>(() =>
    state.permission === 'approved' || state.permission === 'preview'
      ? { kind: 'preparing', requestId: 'initial' }
      : { kind: 'permissionRequired' },
  );
  const [retryNonce, setRetryNonce] = useState(0);
  const generationRef = useRef(0);
  const lastMountedAtRef = useRef(0);
  const lastMountedTimezoneRef = useRef(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  );
  const loadStateKindRef = useRef<FocusAnalyticsLoadState['kind']>(
    loadState.kind,
  );
  const backgroundInterruptedRef = useRef(false);
  const reportOpacity = useSharedValue(0);
  const reportY = useSharedValue(0);
  const nativeReportAvailable = hasNativeFocusAnalyticsReport();
  const nativeRuntimeAvailable = isNativeFocusAvailable();
  const nativeAnalyticsAvailable = isNativeFocusAnalyticsAvailable();
  const liveNativeReportReady = Platform.OS === 'ios'
    && nativeRuntimeAvailable
    && nativeAnalyticsAvailable
    && nativeReportAvailable;
  const usesPreviewReport = state.permission === 'preview'
    || !liveNativeReportReady;
  const permissionNeedsRecovery = !usesPreviewReport
    && (state.permission === 'notDetermined' || state.permission === 'denied');
  const range = useMemo(
    () => buildAnalyticsDateRange(selection),
    [selection],
  );

  const reportStyle = useAnimatedStyle(() => ({
    opacity: reportOpacity.value,
    transform: [{ translateY: reduceMotion ? 0 : reportY.value }],
  }));

  const reconcileNativePermission = useCallback(async () => {
    if (!nativeRuntimeAvailable || state.permission === 'preview') {
      return state.permission;
    }
    const status = await getNativeAuthorizationStatus();
    if (status === 'approved') grantScreenTimePermission('approved');
    else if (status === 'denied') markScreenTimePermissionDenied();
    else if (status === 'notDetermined') markScreenTimePermissionNotDetermined();
    return status;
  }, [nativeRuntimeAvailable, state.permission]);

  useEffect(() => {
    void reconcileNativePermission();
  }, [reconcileNativePermission]);

  useEffect(() => {
    loadStateKindRef.current = loadState.kind;
  }, [loadState.kind]);

  useEffect(() => {
    let cancelled = false;
    const generation = ++generationRef.current;
    const currentRequestId = requestId(generation);
    let slowTimer: ReturnType<typeof setTimeout> | null = null;

    if (usesPreviewReport) {
      reportOpacity.value = 1;
      setMountedRequest(null);
      setLoadState({ kind: 'mounted', requestId: currentRequestId });
      void prepareFocusAnalyticsContext({
        state,
        selection,
        requestId: currentRequestId,
      }).then(result => {
        if (focusAnalyticsRequestCanCommit(
          generation,
          generationRef.current,
          cancelled
        )) {
          setPrepared(result);
        }
      }).catch(() => {
        // Preview rendering does not depend on SQLite being available.
      });
      return () => {
        cancelled = true;
      };
    }

    if (permissionNeedsRecovery) {
      reportOpacity.value = 0;
      setPrepared(null);
      setMountedRequest(null);
      setLoadState({ kind: 'permissionRequired' });
      return () => {
        cancelled = true;
      };
    }

    reportOpacity.value = withTiming(0, { duration: reduceMotion ? 70 : 110 });
    setLoadState({ kind: 'preparing', requestId: currentRequestId });
    slowTimer = setTimeout(() => {
      if (focusAnalyticsRequestCanCommit(
        generation,
        generationRef.current,
        cancelled
      )) {
        setLoadState({
          kind: 'slow',
          requestId: currentRequestId,
          elapsedMs: SLOW_REPORT_MS,
        });
      }
    }, SLOW_REPORT_MS);

    void (async () => {
      try {
        const preparation = prepareFocusAnalyticsContext({
          state,
          selection,
          requestId: currentRequestId,
        });

        // Let the outgoing remote report disappear before removing it. A new
        // DeviceActivityReport is never mounted beside the previous request.
        await wait(reduceMotion ? 70 : 110);
        if (!focusAnalyticsRequestCanCommit(
          generation,
          generationRef.current,
          cancelled
        )) return;
        setMountedRequest(null);

        const next = await preparation;
        if (!focusAnalyticsRequestCanCommit(
          generation,
          generationRef.current,
          cancelled
        )) return;
        const synced = await syncNativeAnalyticsContext(
          JSON.stringify(next.payload),
        );
        if (
          synced.unavailable
          || !synced.stored
          || synced.requestId !== next.payload.requestId
        ) {
          throw new Error('iPhone could not synchronize the private report request.');
        }
        if (!focusAnalyticsRequestCanCommit(
          generation,
          generationRef.current,
          cancelled
        )) return;

        setPrepared(next);
        setMountedRequest(next);
        setLoadState({ kind: 'mounted', requestId: currentRequestId });
        lastMountedAtRef.current = Date.now();
        lastMountedTimezoneRef.current = next.payload.timezone;
        reportY.value = reduceMotion ? 0 : 5;
        reportOpacity.value = withTiming(1, {
          duration: reduceMotion ? 110 : 180,
        });
      } catch (error) {
        if (!focusAnalyticsRequestCanCommit(
          generation,
          generationRef.current,
          cancelled
        )) return;
        setMountedRequest(null);
        setLoadState({
          kind: 'unavailable',
          reason: error instanceof Error
            ? error.message
            : 'iPhone could not prepare this private report.',
        });
      } finally {
        if (slowTimer) clearTimeout(slowTimer);
      }
    })();

    return () => {
      cancelled = true;
      if (slowTimer) clearTimeout(slowTimer);
    };
  }, [
    nativeReportAvailable,
    nativeAnalyticsAvailable,
    nativeRuntimeAvailable,
    reduceMotion,
    reportOpacity,
    reportY,
    retryNonce,
    selection,
    state,
    permissionNeedsRecovery,
    usesPreviewReport,
  ]);

  useEffect(() => {
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', nextState => {
      const resumed = /inactive|background/.test(previousState) && nextState === 'active';
      previousState = nextState;
      if (
        nextState !== 'active'
        && (
          loadStateKindRef.current === 'preparing'
          || loadStateKindRef.current === 'slow'
        )
      ) {
        generationRef.current += 1;
        backgroundInterruptedRef.current = true;
        setMountedRequest(null);
        reportOpacity.value = 0;
        return;
      }
      if (!resumed) return;
      void reconcileNativePermission().then(status => {
        const interrupted = backgroundInterruptedRef.current;
        backgroundInterruptedRef.current = false;
        const currentTimezone =
          Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        const timezoneChanged =
          currentTimezone !== lastMountedTimezoneRef.current;
        if (
          status === 'approved'
          && (
            interrupted
            || timezoneChanged
            || (
              range.includesToday
              && lastMountedAtRef.current > 0
              && Date.now() - lastMountedAtRef.current
                >= FOREGROUND_REFRESH_MS
            )
          )
        ) {
          setRetryNonce(value => value + 1);
        }
      });
    });
    return () => subscription.remove();
  }, [range.includesToday, reconcileNativePermission, reportOpacity]);

  const changePeriod = useCallback((period: FocusAnalyticsPeriod) => {
    setSelection(selectionForPeriod(period));
  }, []);

  const movePeriod = useCallback((amount: number) => {
    setSelection(current => shiftAnalyticsSelection(current, amount));
  }, []);

  const recoverPermission = useCallback(async () => {
    if (state.permission === 'denied') {
      await Linking.openSettings();
      return;
    }
    const status = await requestNativeAuthorization();
    if (status === 'approved') {
      grantScreenTimePermission('approved');
    } else if (status === 'denied') {
      markScreenTimePermissionDenied();
    }
  }, [state.permission]);

  const retry = useCallback(() => {
    setRetryNonce(value => value + 1);
  }, []);

  const renderReport = () => {
    if (usesPreviewReport) {
      return (
        <FocusAnalyticsFallback
          kind="preview"
          period={selection.period}
          localSummary={prepared?.selectedSummary ?? null}
        />
      );
    }

    if (permissionNeedsRecovery) {
      return (
        <FocusAnalyticsFallback
          kind="permission"
          period={selection.period}
          denied={state.permission === 'denied'}
          onRecover={recoverPermission}
        />
      );
    }

    if (loadState.kind === 'unavailable') {
      return (
        <FocusAnalyticsFallback
          kind="unavailable"
          period={selection.period}
          reason={loadState.reason}
          onRetry={retry}
        />
      );
    }

    return (
      <View style={styles.nativeRegion}>
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents={loadState.kind === 'slow' ? 'auto' : 'none'}
        >
          <FocusAnalyticsFallback
            kind={loadState.kind === 'slow' ? 'slow' : 'preparing'}
            period={selection.period}
            onRetry={retry}
          />
        </View>
        {!!mountedRequest && (
          <Animated.View style={[StyleSheet.absoluteFill, reportStyle]}>
            <FocusAnalyticsNativeReport
              key={mountedRequest.payload.requestId}
              requestJson={mountedRequest.nativeRequestJson}
            />
          </Animated.View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <ScreenTitleBar
        title="FOCUS ANALYTICS"
        showBack
        bg={C.bg}
        compactBottom
      />
      <FocusAnalyticsPeriodControl
        value={selection.period}
        onChange={changePeriod}
      />
      <FocusAnalyticsDateNavigator
        label={range.displayLabel}
        accessibilityLabel={range.accessibilityLabel}
        canMoveForward={range.canMoveForward}
        isCurrent={range.isCurrentPeriod}
        onPrevious={() => movePeriod(-1)}
        onNext={() => movePeriod(1)}
        onToday={() => setSelection(selectionForPeriod(selection.period))}
        onRefresh={retry}
      />

      <View style={styles.reportRegion}>
        {renderReport()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  reportRegion: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#FEFBF4',
  },
  nativeRegion: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#FEFBF4',
  },
});
