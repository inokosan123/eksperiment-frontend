import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Image,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedProps, withRepeat, withTiming, withDelay,
  withSequence, withSpring, Easing as REasing, interpolate,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Minus, Pause,
  Play, Plus, RotateCcw, Settings, X,
} from '@/components/icons/Icons';
import { Feather } from '@expo/vector-icons';
import { C, F } from '@/constants/tokens';
import { getTitleBarTopPadding, TITLE_BAR_BOTTOM_PADDING } from '@/components/shared/titleBar';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import FocusLottie from '@/components/focus/FocusLottie';
import { playArrowStrikeFeedback, preloadArrowStrikeSound } from '@/components/focus/focusFeedback';
import ConfirmModal from '@/components/shared/ConfirmModal';
import {
  getAllFocusSessions,
  getFocusTimerPreferences,
  logFocusSession,
  saveFocusTimerPreferences,
} from '@/components/focus/focusDb';
import { HapticTouchableOpacity as TouchableOpacity, HapticPressable as Pressable } from '@/components/shared/HapticTouch';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';


const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type TimerMode = 'single' | 'cycle';
type TimerPhase = 'focus' | 'shortBreak' | 'longBreak';
type StatsMode = 'streak' | 'time';
const SEGMENT_SPRING = {
  damping: 18,
  stiffness: 235,
  mass: 0.72,
};
type FocusSession = { id: string; duration: number; completedAt: number };
type FocusStatsData = {
  today: number;
  todayMin: number;
  bestDay: number;
  bestDayMin: number;
  thisWeek: number;
  thisWeekMin: number;
  thisMonth: number;
  thisMonthMin: number;
  thisYear: number;
  thisYearMin: number;
  allTime: number;
  allTimeMin: number;
  weekDays: number[];
  weekDaysMin: number[];
};

const GOLD = '#C5A059';
const GREEN = '#15803d';
const INK = '#1C1917';
const BG = '#FFFFFF';
const TARGET_RADIUS = 45;
const CIRCUMFERENCE = 2 * Math.PI * TARGET_RADIUS;

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const TARGET_ICON = require('@/assets/images/streak-target-512.png');

const SINGLE_PRESETS = [
  { label: '15 / 3', focus: 15, break: 3 },
  { label: '25 / 5', focus: 25, break: 5 },
  { label: '45 / 10', focus: 45, break: 10 },
] as const;

const CYCLE_PRESETS = [
  { label: 'Balanced', focus: 25, shortBreak: 5, longBreak: 15, sessions: 3 },
  { label: 'Classic', focus: 25, shortBreak: 5, longBreak: 20, sessions: 4 },
  { label: 'Deep', focus: 50, shortBreak: 10, longBreak: 25, sessions: 3 },
  { label: 'Light', focus: 15, shortBreak: 3, longBreak: 10, sessions: 3 },
] as const;

function mergeSessions(current: FocusSession[], incoming: FocusSession[]) {
  const merged = new Map<string, FocusSession>();

  current.forEach(session => {
    merged.set(session.id, session);
  });
  incoming.forEach(session => {
    merged.set(session.id, session);
  });

  return Array.from(merged.values()).sort((a, b) => a.completedAt - b.completedAt);
}

function clampDuration(value: string | number, min: number, max: number, fallback: number) {
  const parsed = typeof value === 'number' ? value : parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateKey(timestamp: number) {
  return toLocalDateKey(new Date(timestamp));
}

function mondayFirstDayIndex(date: Date = new Date()) {
  return (date.getDay() + 6) % 7;
}

function formatMinutes(mins: number) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function FocusZoneView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const activeAnim = useSharedValue(0);
  const entryAnim = useSharedValue(0);
  const breathe = useSharedValue(0);
  const r1 = useSharedValue(0);
  const r2 = useSharedValue(0);
  const phaseSwap = useSharedValue(0);
  const phaseSwapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [timerMode, setTimerMode] = useState<TimerMode>('single');
  const [focusDuration, setFocusDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [shortBreakDuration, setShortBreakDuration] = useState(5);
  const [longBreakDuration, setLongBreakDuration] = useState(15);
  const [sessionsPerCycle, setSessionsPerCycle] = useState(3);
  const [draftTimerMode, setDraftTimerMode] = useState<TimerMode>('single');
  const [draftFocus, setDraftFocus] = useState(25);
  const [draftBreak, setDraftBreak] = useState(5);
  const [draftShortBreak, setDraftShortBreak] = useState(5);
  const [draftLongBreak, setDraftLongBreak] = useState(15);
  const [draftSessionsPerCycle, setDraftSessionsPerCycle] = useState(3);

  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [phase, setPhase] = useState<TimerPhase>('focus');
  const [cycleCompleted, setCycleCompleted] = useState(0);
  const [cycleAwaitingFocus, setCycleAwaitingFocus] = useState(false);
  const [pendingAutoPhase, setPendingAutoPhase] = useState<TimerPhase | null>(null);
  const [pendingCycleCompleted, setPendingCycleCompleted] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [showRestartCycleConfirm, setShowRestartCycleConfirm] = useState(false);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [statsMode, setStatsMode] = useState<StatsMode>('streak');
  const [flightTarget, setFlightTarget] = useState<{ x: number; y: number } | null>(null);
  const [freshCycle, setFreshCycle] = useState(false);

  useEffect(() => {
    if (!showCompletion) setFlightTarget(null);
  }, [showCompletion]);

  const phaseDuration = phase === 'focus'
    ? focusDuration
    : timerMode === 'single'
      ? breakDuration
      : phase === 'longBreak'
        ? longBreakDuration
        : shortBreakDuration;
  const totalTimeForMode = phaseDuration * 60;
  const isFocusPhase = phase === 'focus';
  const activeColor = isFocusPhase ? GOLD : GREEN;
  const ringColor = isActive ? activeColor : INK;
  const trackColor = isActive ? '#E7E5E4' : INK;
  const timerProgress = Math.max(0, Math.min(1, timeLeft / Math.max(1, totalTimeForMode)));
  const diameter = Math.min(width - 24, 380);
  const timeFont = Math.round(diameter * 0.282);
  const colonFont = Math.round(diameter * 0.105);
  const currentFocusNumber = Math.min(cycleCompleted + 1, sessionsPerCycle);
  const cycleFinale = timerMode === 'cycle' && pendingAutoPhase === 'longBreak';
  const phaseLabel = timerMode === 'cycle'
    ? phase === 'focus'
      ? `Focus ${currentFocusNumber} of ${sessionsPerCycle}`
      : phase === 'longBreak'
        ? 'Long Break'
        : 'Short Break'
    : phase === 'focus'
      ? 'Focus Session'
      : 'Break';
  const timeObj = useMemo(() => {
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    return {
      m: String(mins).padStart(2, '0'),
      s: String(secs).padStart(2, '0'),
    };
  }, [timeLeft]);

  const sessionsByDate = useMemo(() => {
    const map: Record<string, number> = {};
    sessions.forEach(session => {
      const key = dateKey(session.completedAt);
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [sessions]);

  const minutesByDate = useMemo(() => {
    const map: Record<string, number> = {};
    sessions.forEach(session => {
      const key = dateKey(session.completedAt);
      map[key] = (map[key] || 0) + session.duration;
    });
    return map;
  }, [sessions]);

  const todayStr = toLocalDateKey(new Date());
  const dailySessions = sessionsByDate[todayStr] || 0;
  const totalMinutes = sessions.reduce((sum, session) => sum + session.duration, 0);

  const statsData = useMemo(() => {
    const today = sessionsByDate[todayStr] || 0;
    const todayMin = minutesByDate[todayStr] || 0;
    const bestDay = Object.values(sessionsByDate).length ? Math.max(...Object.values(sessionsByDate)) : 0;
    const bestDayMin = Object.values(minutesByDate).length ? Math.max(...Object.values(minutesByDate)) : 0;

    const now = new Date();
    const mondayOffset = -mondayFirstDayIndex(now);
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const weekDays = [0, 0, 0, 0, 0, 0, 0];
    const weekDaysMin = [0, 0, 0, 0, 0, 0, 0];
    let thisWeek = 0;
    let thisWeekMin = 0;

    for (let i = 0; i < 7; i += 1) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const key = toLocalDateKey(d);
      weekDays[i] = sessionsByDate[key] || 0;
      weekDaysMin[i] = minutesByDate[key] || 0;
      thisWeek += weekDays[i];
      thisWeekMin += weekDaysMin[i];
    }

    const monthStr = todayStr.substring(0, 7);
    const yearStr = todayStr.substring(0, 4);
    let thisMonth = 0;
    let thisMonthMin = 0;
    let thisYear = 0;
    let thisYearMin = 0;

    Object.entries(sessionsByDate).forEach(([key, value]) => {
      if (key.startsWith(monthStr)) thisMonth += value;
      if (key.startsWith(yearStr)) thisYear += value;
    });
    Object.entries(minutesByDate).forEach(([key, value]) => {
      if (key.startsWith(monthStr)) thisMonthMin += value;
      if (key.startsWith(yearStr)) thisYearMin += value;
    });

    return {
      today, todayMin, bestDay, bestDayMin, thisWeek, thisWeekMin,
      thisMonth, thisMonthMin, thisYear, thisYearMin,
      allTime: sessions.length,
      allTimeMin: totalMinutes,
      weekDays,
      weekDaysMin,
    };
  }, [minutesByDate, sessions.length, sessionsByDate, todayStr, totalMinutes]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1);
    const lastDay = new Date(calYear, calMonth + 1, 0);
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const cells: { day: number; dateStr: string; count: number; minutes: number }[] = [];
    for (let i = 0; i < startDow; i += 1) {
      cells.push({ day: 0, dateStr: '', count: 0, minutes: 0 });
    }
    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({ day, dateStr, count: sessionsByDate[dateStr] || 0, minutes: minutesByDate[dateStr] || 0 });
    }
    return cells;
  }, [calMonth, calYear, minutesByDate, sessionsByDate]);

  const triggerSuccess = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const persistTimerPreferences = useCallback((overrides: Partial<{
    timerMode: TimerMode;
    focusDuration: number;
    breakDuration: number;
    shortBreakDuration: number;
    longBreakDuration: number;
    sessionsPerCycle: number;
    cycleCompleted: number;
  }> = {}) => {
    void saveFocusTimerPreferences({
      timerMode: overrides.timerMode ?? timerMode,
      focusDuration: overrides.focusDuration ?? focusDuration,
      breakDuration: overrides.breakDuration ?? breakDuration,
      shortBreakDuration: overrides.shortBreakDuration ?? shortBreakDuration,
      longBreakDuration: overrides.longBreakDuration ?? longBreakDuration,
      sessionsPerCycle: overrides.sessionsPerCycle ?? sessionsPerCycle,
      cycleCompleted: overrides.cycleCompleted ?? cycleCompleted,
      updatedAt: Date.now(),
    });
  }, [breakDuration, cycleCompleted, focusDuration, longBreakDuration, sessionsPerCycle, shortBreakDuration, timerMode]);

  const secondsForPhase = useCallback((nextPhase: TimerPhase) => {
    if (nextPhase === 'focus') return focusDuration * 60;
    if (timerMode === 'single') return breakDuration * 60;
    return (nextPhase === 'longBreak' ? longBreakDuration : shortBreakDuration) * 60;
  }, [breakDuration, focusDuration, longBreakDuration, shortBreakDuration, timerMode]);

  const beginPendingBreak = useCallback(() => {
    if (!pendingAutoPhase) return;
    const nextPhase = pendingAutoPhase;
    setShowCompletion(false);
    setPendingAutoPhase(null);
    setPendingCycleCompleted(null);
    setCycleAwaitingFocus(false);
    setPhase(nextPhase);
    setTimeLeft(secondsForPhase(nextPhase));
    setIsActive(true);
  }, [pendingAutoPhase, secondsForPhase]);

  const finishBreakPhase = useCallback(() => {
    const shouldResetCycle = timerMode === 'cycle' && phase === 'longBreak';

    setIsActive(false);
    if (phaseSwapTimerRef.current) {
      clearTimeout(phaseSwapTimerRef.current);
      phaseSwapTimerRef.current = null;
    }

    phaseSwap.value = 0;
    phaseSwap.value = withTiming(1, {
      duration: 150,
      easing: REasing.out(REasing.quad),
    });

    phaseSwapTimerRef.current = setTimeout(() => {
      phaseSwapTimerRef.current = null;
      if (shouldResetCycle) {
        setCycleCompleted(0);
        setFreshCycle(true);
        persistTimerPreferences({ cycleCompleted: 0 });
      }
      setPhase('focus');
      setTimeLeft(focusDuration * 60);
      setCycleAwaitingFocus(timerMode === 'cycle');
      triggerSuccess();
      phaseSwap.value = withTiming(0, {
        duration: 280,
        easing: REasing.out(REasing.cubic),
      });
    }, 150);
  }, [focusDuration, persistTimerPreferences, phase, phaseSwap, timerMode, triggerSuccess]);

  useEffect(() => {
    let active = true;

    (async () => {
      const storedSessions = await getAllFocusSessions();
      if (!active) return;
      const hydratedSessions = storedSessions.map(session => ({
        id: session.id,
        duration: session.duration,
        completedAt: session.completedAt,
      }));
      setSessions(current => mergeSessions(current, hydratedSessions));
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      const preferences = await getFocusTimerPreferences();
      if (!active || !preferences) return;

      const nextMode: TimerMode = preferences.timerMode === 'cycle' ? 'cycle' : 'single';
      const nextFocus = clampDuration(preferences.focusDuration, 1, 180, 25);
      const nextBreak = clampDuration(preferences.breakDuration, 1, 60, 5);
      const nextShortBreak = clampDuration(preferences.shortBreakDuration, 1, 60, 5);
      const nextLongBreak = clampDuration(preferences.longBreakDuration, 1, 90, 15);
      const nextSessions = clampDuration(preferences.sessionsPerCycle, 2, 6, 3);
      const nextCycleCompleted = nextMode === 'cycle'
        ? clampDuration(preferences.cycleCompleted ?? 0, 0, nextSessions, 0)
        : 0;
      const nextPhase: TimerPhase = nextMode === 'cycle' && nextCycleCompleted >= nextSessions
        ? 'longBreak'
        : 'focus';

      setTimerMode(nextMode);
      setFocusDuration(nextFocus);
      setBreakDuration(nextBreak);
      setShortBreakDuration(nextShortBreak);
      setLongBreakDuration(nextLongBreak);
      setSessionsPerCycle(nextSessions);
      setDraftTimerMode(nextMode);
      setDraftFocus(nextFocus);
      setDraftBreak(nextBreak);
      setDraftShortBreak(nextShortBreak);
      setDraftLongBreak(nextLongBreak);
      setDraftSessionsPerCycle(nextSessions);
      setCycleCompleted(nextCycleCompleted);
      setCycleAwaitingFocus(false);
      setPendingAutoPhase(null);
      setPendingCycleCompleted(null);
      setIsActive(false);
      setPhase(nextPhase);
      setTimeLeft((nextPhase === 'longBreak' ? nextLongBreak : nextFocus) * 60);
    })();

    return () => {
      active = false;
    };
  }, []);

  const handleTimerComplete = useCallback(() => {
    setIsActive(false);

    if (phase === 'focus') {
      const now = Date.now();
      const sessionId = `focus_${now}`;
      const nextSession = { id: sessionId, duration: focusDuration, completedAt: now };
      setSessions(prev => mergeSessions(prev, [nextSession]));
      void logFocusSession(
        sessionId,
        dateKey(now),
        focusDuration,
        now,
      );
      if (timerMode === 'cycle') {
        const nextCompleted = Math.min(sessionsPerCycle, cycleCompleted + 1);
        const nextPhase = nextCompleted >= sessionsPerCycle ? 'longBreak' : 'shortBreak';
        setPendingAutoPhase(nextPhase);
        setPendingCycleCompleted(nextCompleted);
      }

      setShowCompletion(true);
    } else {
      finishBreakPhase();
    }
  }, [cycleCompleted, finishBreakPhase, focusDuration, phase, sessionsPerCycle, timerMode]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => Math.max(0, prev - 1));
      }, 1000);
    } else if (isActive && timeLeft === 0) {
      handleTimerComplete();
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [handleTimerComplete, isActive, timeLeft]);

  useEffect(() => {
    entryAnim.value = withTiming(1, { duration: 360, easing: REasing.out(REasing.cubic) });
    preloadArrowStrikeSound();
  }, []);

  useEffect(() => () => {
    if (phaseSwapTimerRef.current) {
      clearTimeout(phaseSwapTimerRef.current);
      phaseSwapTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    activeAnim.value = withTiming(isActive ? 1 : 0, { duration: 520, easing: REasing.out(REasing.cubic) });
    if (isActive) {
      breathe.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2400, easing: REasing.inOut(REasing.sin) }),
          withTiming(0.3, { duration: 2400, easing: REasing.inOut(REasing.sin) }),
        ), -1, false,
      );
      r1.value = 0;
      r1.value = withRepeat(withTiming(1, { duration: 1800, easing: REasing.out(REasing.quad) }), -1, false);
      r2.value = 0;
      r2.value = withDelay(750, withRepeat(withTiming(1, { duration: 1800, easing: REasing.out(REasing.quad) }), -1, false));
    } else {
      breathe.value = withTiming(0, { duration: 500 });
      r1.value = withTiming(0, { duration: 400 });
      r2.value = withTiming(0, { duration: 400 });
    }
  }, [isActive]);

  const handleBack = useCallback(() => {
    if (showSettings) {
      setShowSettings(false);
      return;
    }
    if (showStats) {
      setShowStats(false);
      return;
    }
    if (showCompletion) {
      return;
    }
    if (showRestartCycleConfirm) {
      setShowRestartCycleConfirm(false);
      return;
    }
    if (isActive) {
      setShowExitWarning(true);
      return;
    }
    router.back();
  }, [isActive, router, showCompletion, showRestartCycleConfirm, showSettings, showStats]);

  const toggleTimer = () => {
    if (isActive) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (cycleAwaitingFocus) {
      setCycleAwaitingFocus(false);
      setFreshCycle(false);
      setIsActive(true);
      return;
    }
    setIsActive(prev => !prev);
  };

  const resetTimer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsActive(false);
    setCycleAwaitingFocus(false);
    setTimeLeft(secondsForPhase(phase));
  };

  const restartCycle = () => {
    setShowRestartCycleConfirm(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setIsActive(false);
    setPhase('focus');
    setCycleCompleted(0);
    setCycleAwaitingFocus(false);
    setFreshCycle(false);
    setPendingAutoPhase(null);
    setPendingCycleCompleted(null);
    setTimeLeft(focusDuration * 60);
    persistTimerPreferences({ cycleCompleted: 0 });
  };

  const openSettings = () => {
    setDraftTimerMode(timerMode);
    setDraftFocus(focusDuration);
    setDraftBreak(breakDuration);
    setDraftShortBreak(shortBreakDuration);
    setDraftLongBreak(longBreakDuration);
    setDraftSessionsPerCycle(sessionsPerCycle);
    setShowSettings(true);
  };

  const applySettings = () => {
    const nextFocus = clampDuration(draftFocus, 1, 180, focusDuration);
    const nextBreak = clampDuration(draftBreak, 1, 60, breakDuration);
    const nextShortBreak = clampDuration(draftShortBreak, 1, 60, shortBreakDuration);
    const nextLongBreak = clampDuration(draftLongBreak, 1, 90, longBreakDuration);
    const nextSessionsPerCycle = clampDuration(draftSessionsPerCycle, 2, 6, 3);
    setTimerMode(draftTimerMode);
    setFocusDuration(nextFocus);
    setBreakDuration(nextBreak);
    setShortBreakDuration(nextShortBreak);
    setLongBreakDuration(nextLongBreak);
    setSessionsPerCycle(nextSessionsPerCycle);
    setIsActive(false);
    setPhase('focus');
    setCycleCompleted(0);
    setCycleAwaitingFocus(false);
    setFreshCycle(false);
    setPendingAutoPhase(null);
    setPendingCycleCompleted(null);
    setTimeLeft(nextFocus * 60);
    setShowSettings(false);
    persistTimerPreferences({
      timerMode: draftTimerMode,
      focusDuration: nextFocus,
      breakDuration: nextBreak,
      shortBreakDuration: nextShortBreak,
      longBreakDuration: nextLongBreak,
      sessionsPerCycle: nextSessionsPerCycle,
      cycleCompleted: 0,
    });
  };

  const collectFocusReward = useCallback(() => {
    if (pendingAutoPhase) {
      const nextCycleCompleted = pendingCycleCompleted ?? cycleCompleted;
      setCycleCompleted(nextCycleCompleted);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setPendingCycleCompleted(null);
      persistTimerPreferences({ cycleCompleted: nextCycleCompleted });
      beginPendingBreak();
      return;
    }
    setShowCompletion(false);
    setPhase('shortBreak');
    setTimeLeft(breakDuration * 60);
    setIsActive(true);
    persistTimerPreferences({ cycleCompleted });
  }, [beginPendingBreak, breakDuration, cycleCompleted, pendingAutoPhase, pendingCycleCompleted, persistTimerPreferences]);

  const prevMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(year => year - 1);
    } else {
      setCalMonth(month => month - 1);
    }
  };

  const nextMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(year => year + 1);
    } else {
      setCalMonth(month => month + 1);
    }
  };

  const todayDayIndex = mondayFirstDayIndex();

  const maxSessionBar = Math.max(...statsData.weekDays, 1);
  const maxMinuteBar = Math.max(...statsData.weekDaysMin, 1);

  const screenStyle = useAnimatedStyle(() => ({
    opacity: entryAnim.value,
    transform: [{ translateY: interpolate(entryAnim.value, [0, 1], [18, 0]) }],
  }));

  const timerTextStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(activeAnim.value, [0, 1], [0, -12]) }],
  }));

  const sandyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(activeAnim.value, [0, 0.45, 1], [0, 0, 1]),
    transform: [{ translateY: interpolate(activeAnim.value, [0, 1], [10, 0]) }],
  }));

  const phaseSwapStyle = useAnimatedStyle(() => ({
    opacity: interpolate(phaseSwap.value, [0, 0.72, 1], [1, 0.72, 0]),
    transform: [{ scale: interpolate(phaseSwap.value, [0, 1], [1, 0.985]) }],
  }));

  const glowProps = useAnimatedProps(() => ({
    opacity: breathe.value * 0.12,
  }));

  const pulse1Props = useAnimatedProps(() => ({
    opacity: (1 - r1.value) * 0.35,
    r: TARGET_RADIUS + r1.value * 4,
  }));

  const pulse2Props = useAnimatedProps(() => ({
    opacity: (1 - r2.value) * 0.25,
    r: TARGET_RADIUS + r2.value * 4.5,
  }));

  const sandyRing1Props = useAnimatedProps(() => ({
    r: 42 + r1.value * 24,
    opacity: (1 - r1.value) * 0.3,
  }));

  const sandyRing2Props = useAnimatedProps(() => ({
    r: 42 + r2.value * 27,
    opacity: (1 - r2.value) * 0.2,
  }));

  const sandyBreathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.94 + breathe.value * 0.07 }],
  }));

  return (
    <Animated.View style={[s.screen, screenStyle]}>
      <View style={[s.header, { paddingTop: getTitleBarTopPadding(insets.top) }]}>
        <TouchableOpacity onPress={handleBack} style={s.headerBtn} activeOpacity={0.72}>
          <ArrowLeft s={26} c="rgba(28,25,23,0.55)" />
        </TouchableOpacity>

        <View style={s.sessionPill}>
          <View style={s.sessionTargetHalo}>
            <Image source={TARGET_ICON} style={s.sessionTargetStill} resizeMode="contain" />
          </View>
          <Text style={s.sessionCount}>{dailySessions}</Text>
          <Text style={s.sessionLabel}>today</Text>
        </View>

        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowStats(true); }}
          style={s.headerBtn}
          activeOpacity={0.72}
        >
          <Feather name="bar-chart-2" size={20} color={GOLD} />
        </TouchableOpacity>
      </View>

      <View style={s.center}>
        <View style={[s.timerWrap, timerMode === 'cycle' ? s.timerWrapCycle : s.timerWrapSingle, { width: diameter, height: diameter }]}>
          {timerMode === 'cycle' && (
            <PomodoroCycleRail
              completed={cycleCompleted}
              total={sessionsPerCycle}
              phaseLabel={phaseLabel}
              measureSignal={showCompletion}
              nextIndex={Math.min(cycleCompleted, sessionsPerCycle - 1)}
              onSlotPoint={setFlightTarget}
            />
          )}

          <Animated.View style={[s.timerVisualLayer, phaseSwapStyle]}>
          <Svg width={diameter} height={diameter} viewBox="0 0 100 100" style={s.ring}>
            {/* Inner glow — breathes while active */}
            <AnimatedCircle cx="50" cy="50" r={TARGET_RADIUS - 0.5} fill={activeColor} animatedProps={glowProps} />
            {/* Pulse ring 1 — expands outward and fades */}
            <AnimatedCircle cx="50" cy="50" fill="none" stroke={activeColor} strokeWidth="0.8" animatedProps={pulse1Props} />
            {/* Pulse ring 2 — offset 750ms */}
            <AnimatedCircle cx="50" cy="50" fill="none" stroke={activeColor} strokeWidth="0.5" animatedProps={pulse2Props} />
            {/* Track (fill none — white bg shows through from parent) */}
            <Circle cx="50" cy="50" r={TARGET_RADIUS} strokeWidth="1.6" fill="none" stroke={trackColor} strokeLinecap="round" />
            {/* Progress */}
            <Circle
              cx="50"
              cy="50"
              r={TARGET_RADIUS}
              strokeWidth="1.7"
              fill="none"
              strokeLinecap="round"
              stroke={ringColor}
              strokeDasharray={`${CIRCUMFERENCE}`}
              strokeDashoffset={CIRCUMFERENCE * (1 - timerProgress)}
              transform="rotate(-90 50 50)"
            />
          </Svg>

          <Animated.View style={[s.timerTextWrap, timerTextStyle]}>
            {cycleAwaitingFocus ? (
              <Text style={s.readyText}>
                {freshCycle ? 'Cycle complete! Ready for a new one?' : 'Ready for the next session?'}
              </Text>
            ) : (
              <>
                <Text style={[s.timeText, { color: ringColor, fontSize: timeFont, lineHeight: timeFont + 4 }]}>{timeObj.m}</Text>
                <Text style={[s.colon, { color: ringColor, fontSize: colonFont }]}>:</Text>
                <Text style={[s.timeText, { color: ringColor, fontSize: timeFont, lineHeight: timeFont + 4 }]}>{timeObj.s}</Text>
              </>
            )}
          </Animated.View>

          {/* Sandy hourglass — the ground behind it stays white; soft rings ripple outward around it */}
          <Animated.View style={[s.sandyWrap, sandyStyle]} pointerEvents="none">
            <View style={s.sandyStage}>
              <Svg width={150} height={150} viewBox="0 0 150 150" style={s.sandyRings}>
                <AnimatedCircle cx="75" cy="75" fill="none" stroke={activeColor} strokeWidth="1" animatedProps={sandyRing1Props} />
                <AnimatedCircle cx="75" cy="75" fill="none" stroke={activeColor} strokeWidth="0.7" animatedProps={sandyRing2Props} />
              </Svg>
              <Animated.View style={sandyBreathStyle}>
                {phase === 'focus' ? (
                  <FocusLottie name="sandy-work" loop speed={0.4} style={s.sandyLottie} />
                ) : (
                  <FocusLottie name="sandy" loop speed={0.4} style={s.sandyLottie} />
                )}
              </Animated.View>
            </View>
          </Animated.View>
          </Animated.View>
        </View>

        <View style={[s.controlsDeck, timerMode === 'cycle' && s.controlsDeckCycle]}>
          <TouchableOpacity onPress={resetTimer} style={s.smallControl} activeOpacity={0.72}>
            <RotateCcw s={20} c="#8A8177" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={toggleTimer}
            activeOpacity={0.9}
            style={[
              s.mainControl,
              {
                backgroundColor: isActive ? activeColor : INK,
                shadowColor: isActive ? activeColor : INK,
              },
            ]}
          >
            {isActive ? <Pause s={32} c="#fff" /> : <Play s={32} c="#fff" />}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={openSettings}
            style={[s.smallControl, isActive && s.disabledControl]}
            activeOpacity={0.72}
            disabled={isActive}
          >
            <Settings s={20} c="#8A8177" />
          </TouchableOpacity>
        </View>

        {timerMode === 'cycle' && (
          <TouchableOpacity onPress={() => setShowRestartCycleConfirm(true)} style={s.restartCycleTag} activeOpacity={0.76}>
            <RotateCcw s={14} c="#BE123C" />
            <Text style={s.restartCycleText}>Restart Cycle</Text>
          </TouchableOpacity>
        )}
      </View>

      <SettingsModal
        visible={showSettings}
        timerMode={draftTimerMode}
        draftFocus={draftFocus}
        draftBreak={draftBreak}
        draftShortBreak={draftShortBreak}
        draftLongBreak={draftLongBreak}
        draftSessionsPerCycle={draftSessionsPerCycle}
        onClose={() => setShowSettings(false)}
        onSave={applySettings}
        onModeChange={setDraftTimerMode}
        onSessionsChange={setDraftSessionsPerCycle}
        onSinglePreset={(preset) => {
          setDraftTimerMode('single');
          setDraftFocus(preset.focus);
          setDraftBreak(preset.break);
        }}
        onCyclePreset={(preset) => {
          setDraftTimerMode('cycle');
          setDraftFocus(preset.focus);
          setDraftShortBreak(preset.shortBreak);
          setDraftLongBreak(preset.longBreak);
          setDraftSessionsPerCycle(preset.sessions);
        }}
        onFocusStep={(delta) => {
          const next = clampDuration(draftFocus + delta, 1, 180, draftFocus);
          setDraftFocus(next);
        }}
        onBreakStep={(delta) => {
          const next = clampDuration(draftBreak + delta, 1, 60, draftBreak);
          setDraftBreak(next);
        }}
        onShortBreakStep={(delta) => {
          const next = clampDuration(draftShortBreak + delta, 1, 60, draftShortBreak);
          setDraftShortBreak(next);
        }}
        onLongBreakStep={(delta) => {
          const next = clampDuration(draftLongBreak + delta, 1, 90, draftLongBreak);
          setDraftLongBreak(next);
        }}
      />

      <CompletionModal
        visible={showCompletion}
        collectToRail={timerMode === 'cycle'}
        flightTarget={flightTarget}
        finale={cycleFinale}
        eyebrow={cycleFinale
          ? `Cycle complete · ${sessionsPerCycle} targets`
          : timerMode === 'cycle'
            ? `Focus ${currentFocusNumber} of ${sessionsPerCycle} · ${focusDuration} min`
            : `Focus Session · ${focusDuration} min`}
        nextStepLabel={timerMode === 'cycle' ? 'COLLECT' : 'START BREAK'}
        onCollect={collectFocusReward}
      />

      <ConfirmModal
        visible={showRestartCycleConfirm}
        icon={<RotateCcw s={22} c={C.red} />}
        iconBg="#FFF1F2"
        title="Restart Cycle?"
        body="This will clear your completed targets and start the cycle from the first session."
        cancelLabel="NO"
        confirmLabel="YES"
        confirmColor={C.red}
        onCancel={() => setShowRestartCycleConfirm(false)}
        onConfirm={restartCycle}
      />

      <ExitWarningModal
        visible={showExitWarning}
        onResume={() => setShowExitWarning(false)}
        onEnd={() => {
          setShowExitWarning(false);
          setIsActive(false);
          router.back();
        }}
      />

      <StatsModal
        visible={showStats}
        statsMode={statsMode}
        setStatsMode={setStatsMode}
        statsData={statsData}
        todayDayIndex={todayDayIndex}
        maxSessionBar={maxSessionBar}
        maxMinuteBar={maxMinuteBar}
        calendarDays={calendarDays}
        calMonth={calMonth}
        calYear={calYear}
        todayStr={todayStr}
        onClose={() => setShowStats(false)}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
      />
    </Animated.View>
  );
}

function RetrievedToken({ index }: { index: number }) {
  const fade = useSharedValue(1);

  useEffect(() => {
    fade.value = withDelay(index * 90, withTiming(0, { duration: 280, easing: REasing.out(REasing.quad) }));
  }, [fade, index]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <>
      <Image source={TARGET_ICON} style={s.cycleTargetEmpty} resizeMode="contain" />
      <Animated.View pointerEvents="none" style={[s.retrievedOverlay, fadeStyle]}>
        <Image source={TARGET_ICON} style={s.cycleTargetFilled} resizeMode="contain" />
      </Animated.View>
    </>
  );
}

function PomodoroCycleRail({
  completed,
  total,
  phaseLabel,
  measureSignal,
  nextIndex,
  onSlotPoint,
}: {
  completed: number;
  total: number;
  phaseLabel: string;
  measureSignal: boolean;
  nextIndex: number;
  onSlotPoint: (point: { x: number; y: number } | null) => void;
}) {
  const slotRefs = useRef<(React.ElementRef<typeof View> | null)[]>([]);
  const prevCompletedRef = useRef(completed);
  const [resetFrom, setResetFrom] = useState(0);

  // When the cycle empties, the arrows are pulled one by one, left to
  // right - each token fades from full color back to its silhouette.
  useEffect(() => {
    const prev = prevCompletedRef.current;
    prevCompletedRef.current = completed;
    if (prev > 0 && completed === 0) {
      setResetFrom(prev);
      const timer = setTimeout(() => setResetFrom(0), prev * 90 + 420);
      return () => clearTimeout(timer);
    }
  }, [completed]);

  useEffect(() => {
    if (!measureSignal) return;
    const timer = setTimeout(() => {
      const slot = slotRefs.current[nextIndex];
      if (!slot) {
        onSlotPoint(null);
        return;
      }
      slot.measureInWindow((x, y, w, h) => {
        if ([x, y, w, h].some(v => !Number.isFinite(v)) || w === 0) {
          onSlotPoint(null);
          return;
        }
        onSlotPoint({ x: x + w / 2, y: y + h / 2 });
      });
    }, 80);
    return () => clearTimeout(timer);
  }, [measureSignal, nextIndex, onSlotPoint]);

  const slots = Array.from({ length: total }, (_, index) => index);
  return (
    <View style={s.cycleHeader}>
      <View style={s.cycleRail}>
        {slots.map(index => {
          const filled = index < completed;
          return (
            <View
              key={index}
              ref={el => { slotRefs.current[index] = el; }}
              style={s.cycleSlot}
            >
              {resetFrom > index ? (
                <RetrievedToken index={index} />
              ) : (
                /* key remount: once an Image has had tintColor, dropping it leaves
                   template rendering behind (iOS paints it system blue, Android
                   keeps the stale ColorFilter) - a fresh instance renders true */
                <Image
                  key={filled ? 'filled' : 'empty'}
                  source={TARGET_ICON}
                  style={filled ? s.cycleTargetFilled : s.cycleTargetEmpty}
                  resizeMode="contain"
                />
              )}
            </View>
          );
        })}
      </View>
      <Text style={s.phaseLabel}>{phaseLabel}</Text>
    </View>
  );
}

function SettingsModal({
  visible,
  timerMode,
  draftFocus,
  draftBreak,
  draftShortBreak,
  draftLongBreak,
  draftSessionsPerCycle,
  onClose,
  onSave,
  onModeChange,
  onSessionsChange,
  onSinglePreset,
  onCyclePreset,
  onFocusStep,
  onBreakStep,
  onShortBreakStep,
  onLongBreakStep,
}: {
  visible: boolean;
  timerMode: TimerMode;
  draftFocus: number;
  draftBreak: number;
  draftShortBreak: number;
  draftLongBreak: number;
  draftSessionsPerCycle: number;
  onClose: () => void;
  onSave: () => void;
  onModeChange: (mode: TimerMode) => void;
  onSessionsChange: (value: number) => void;
  onSinglePreset: (preset: (typeof SINGLE_PRESETS)[number]) => void;
  onCyclePreset: (preset: (typeof CYCLE_PRESETS)[number]) => void;
  onFocusStep: (delta: number) => void;
  onBreakStep: (delta: number) => void;
  onShortBreakStep: (delta: number) => void;
  onLongBreakStep: (delta: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const modeMotion = useSharedValue(timerMode === 'cycle' ? 1 : 0);
  const [modeWidth, setModeWidth] = useState(0);
  const sheetHeight = Math.min(height * 0.88, 720);
  const modeDescription = timerMode === 'single' ? (
    <Text style={modal.modeDescription}>
      Use <Text style={modal.modeDescriptionStrong}>Single Session</Text> for one focused block and one planned break. Clean and simple for a quick reset.
    </Text>
  ) : (
    <Text style={modal.modeDescription}>
      Use <Text style={modal.modeDescriptionStrong}>Pomodoro Cycle</Text> for multiple focus sessions, when you want a steady rhythm for deeper work.
    </Text>
  );
  useEffect(() => {
    modeMotion.value = withSpring(timerMode === 'cycle' ? 1 : 0, SEGMENT_SPRING);
  }, [modeMotion, timerMode]);
  const modePillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: modeMotion.value * ((modeWidth - 8) / 2) }],
  }));
  const selectedSinglePreset = SINGLE_PRESETS.find(preset => (
    preset.focus === draftFocus
    && preset.break === draftBreak
  ))?.label;
  const selectedCyclePreset = CYCLE_PRESETS.find(preset => (
    preset.focus === draftFocus
    && preset.shortBreak === draftShortBreak
    && preset.longBreak === draftLongBreak
    && preset.sessions === draftSessionsPerCycle
  ))?.label;

  return (
    <SmoothBottomSheet
      visible={visible}
      onClose={onClose}
      keyboardAware
      backdropOpacity={0.34}
      sheetStyle={[
        modal.sheet,
        {
          height: sheetHeight,
          paddingBottom: Math.max(insets.bottom, 10) + 12,
        },
      ]}
    >
      <View style={modal.handle} />
      <View style={modal.sheetHead}>
        <View style={modal.headSpacer} />
        <View style={modal.sheetHeadCopy}>
          <Text style={modal.sheetEyebrow}>Pomodoro Timer</Text>
          <Text style={modal.sheetTitle}>Settings</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={modal.sheetClose} activeOpacity={0.78}>
          <X s={19} c="#A8A29E" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={modal.sheetScroll}
        contentContainerStyle={modal.sheetContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={modal.block}>
          <Text style={modal.blockLabel}>Mode</Text>
          <View
            style={modal.modeToggle}
            onLayout={event => setModeWidth(event.nativeEvent.layout.width)}
          >
            {modeWidth > 0 && (
              <Animated.View style={[modal.modePill, { width: (modeWidth - 8) / 2 }, modePillStyle]} />
            )}
            {[
              { value: 'single' as TimerMode, label: 'Single Session' },
              { value: 'cycle' as TimerMode, label: 'Pomodoro Cycle' },
            ].map(option => {
              const active = timerMode === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onModeChange(option.value);
                  }}
                  activeOpacity={0.88}
                  style={modal.modeBtn}
                >
                  <Text style={[modal.modeBtnText, active && modal.modeBtnTextActive]} numberOfLines={1}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {modeDescription}
        </View>

        {timerMode === 'single' ? (
          <View style={modal.block}>
            <Text style={modal.blockLabel}>Quick Presets</Text>
            <View style={modal.presetGrid}>
              {SINGLE_PRESETS.map(preset => {
                const selected = selectedSinglePreset === preset.label;
                return (
                  <TouchableOpacity key={preset.label} onPress={() => onSinglePreset(preset)} activeOpacity={0.86} style={[modal.presetBtn, modal.presetBtnSingle, selected && modal.presetBtnSelected]}>
                    <Text style={[modal.presetText, selected && modal.presetTextSelected]}>{preset.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <DurationEditor label="Focus Duration" accent={GOLD} draft={draftFocus} onStep={onFocusStep} />
            <DurationEditor label="Break Duration" accent="#57534E" draft={draftBreak} onStep={onBreakStep} />
          </View>
        ) : (
          <View style={modal.block}>
            <Text style={modal.blockLabel}>Cycle Presets</Text>
            <View style={modal.presetGrid}>
              {CYCLE_PRESETS.map(preset => {
                const selected = selectedCyclePreset === preset.label;
                return (
                  <TouchableOpacity key={preset.label} onPress={() => onCyclePreset(preset)} activeOpacity={0.86} style={[modal.presetBtn, modal.presetBtnCycle, selected && modal.presetBtnSelected]}>
                    <Text style={[modal.presetText, selected && modal.presetTextSelected]}>{preset.label}</Text>
                    <Text style={[modal.presetSub, selected && modal.presetSubSelected]}>{preset.focus}/{preset.shortBreak}/{preset.longBreak}{' \u00B7 '}{preset.sessions} sessions</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <DurationEditor label="Focus Duration" accent={GOLD} draft={draftFocus} onStep={onFocusStep} />
            <DurationEditor label="Short Break" accent="#57534E" draft={draftShortBreak} onStep={onShortBreakStep} />
            <DurationEditor label="Long Break" accent={GREEN} draft={draftLongBreak} onStep={onLongBreakStep} />
            <CycleCountEditor value={draftSessionsPerCycle} onChange={onSessionsChange} />
          </View>
        )}

        <TouchableOpacity onPress={onSave} style={modal.saveBtn} activeOpacity={0.9}>
          <Text style={modal.saveText}>SAVE SETTINGS</Text>
        </TouchableOpacity>
      </ScrollView>
    </SmoothBottomSheet>
  );
}

function DurationEditor({
  label, accent, draft, onStep,
}: {
  label: string;
  accent: string;
  draft: number;
  onStep: (delta: number) => void;
}) {
  return (
    <View style={modal.field}>
      <Text style={modal.fieldLabel}>{label}</Text>
      <View style={modal.durationBox}>
        <DurationStepButton label="-5" onPress={() => onStep(-5)} />
        <DurationStepButton label="-1" onPress={() => onStep(-1)} />
        <View style={[modal.durationValueWrap, { borderColor: `${accent}55`, backgroundColor: accent === GOLD ? '#FFFBEB' : '#fff' }]}>
          <Text style={[modal.durationValue, { color: accent }]}>{draft}</Text>
          <Text style={modal.durationUnit}>min</Text>
        </View>
        <DurationStepButton label="+1" onPress={() => onStep(1)} />
        <DurationStepButton label="+5" onPress={() => onStep(5)} />
      </View>
    </View>
  );
}

function DurationStepButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={modal.durationStepBtn} activeOpacity={0.75}>
      <Text style={modal.durationStepText}>{label}</Text>
    </TouchableOpacity>
  );
}

function CycleCountEditor({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const change = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(Math.min(6, Math.max(2, value + delta)));
  };

  return (
    <View style={modal.field}>
      <Text style={modal.fieldLabel}>Focus Sessions</Text>
      <View style={modal.sessionCountBox}>
        <TouchableOpacity onPress={() => change(-1)} style={modal.stepBtn} activeOpacity={0.75}>
          <Minus s={18} c="#57534E" />
        </TouchableOpacity>
        <View style={modal.sessionCountMid}>
          <Text style={modal.sessionCountValue}>{value}</Text>
          <Text style={modal.sessionUnitLabel}>sessions</Text>
        </View>
        <TouchableOpacity onPress={() => change(1)} style={modal.stepBtn} activeOpacity={0.75}>
          <Plus s={18} c="#57534E" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CompletionModal({
  visible,
  collectToRail,
  flightTarget,
  finale,
  eyebrow,
  nextStepLabel,
  onCollect,
}: {
  visible: boolean;
  collectToRail: boolean;
  flightTarget: { x: number; y: number } | null;
  finale: boolean;
  eyebrow: string;
  nextStepLabel: string;
  onCollect: () => void;
}) {
  const { height } = useWindowDimensions();
  const [collecting, setCollecting] = useState(false);
  const [heroReady, setHeroReady] = useState(false);
  const collectingRef = useRef(false);
  const collectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sealRef = useRef<React.ElementRef<typeof View>>(null);
  const appearProgress = useSharedValue(0);
  const collectProgress = useSharedValue(0);
  const flyX = useSharedValue(0);
  const flyY = useSharedValue(-18);

  useEffect(() => {
    if (!visible) {
      collectingRef.current = false;
      if (collectTimerRef.current) {
        clearTimeout(collectTimerRef.current);
        collectTimerRef.current = null;
      }
      setHeroReady(false);
      appearProgress.value = 0;
      collectProgress.value = 0;
      return;
    }
    setCollecting(false);
    collectingRef.current = false;
    appearProgress.value = 0;
    collectProgress.value = 0;
    flyX.value = 0;
    flyY.value = collectToRail ? -Math.min(172, Math.max(132, height * 0.18)) : -18;
    appearProgress.value = withTiming(1, {
      duration: 180,
      easing: REasing.out(REasing.cubic),
    });
    // Mount the hero Lottie a beat after the Modal window exists —
    // autoplay on simultaneous mount is unreliable on Android.
    const heroTimer = setTimeout(() => setHeroReady(true), 120);
    const hapticTimer = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, 80);
    // Thunk + heavy haptic timed to the arrow hitting the bullseye:
    // hero mounts at 120ms, impact is frame 19 of 30fps (~633ms in).
    const strikeTimer = setTimeout(() => {
      void playArrowStrikeFeedback();
    }, 730);
    return () => {
      clearTimeout(heroTimer);
      clearTimeout(hapticTimer);
      clearTimeout(strikeTimer);
      if (collectTimerRef.current) {
        clearTimeout(collectTimerRef.current);
        collectTimerRef.current = null;
      }
    };
  }, [appearProgress, collectProgress, collectToRail, flyX, flyY, height, visible]);

  useEffect(() => {
    if (!visible || !flightTarget) return;
    const timer = setTimeout(() => {
      sealRef.current?.measureInWindow((x, y, w, h) => {
        if ([x, y, w, h].some(v => !Number.isFinite(v)) || w === 0) return;
        flyX.value = flightTarget.x - (x + w / 2);
        flyY.value = flightTarget.y - (y + h / 2);
      });
    }, 260);
    return () => clearTimeout(timer);
  }, [flightTarget, flyX, flyY, visible]);

  const handleCollect = () => {
    if (collectingRef.current) return;
    collectingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCollecting(true);
    const duration = collectToRail ? 700 : 430;
    collectProgress.value = withTiming(1, {
      duration,
      easing: REasing.inOut(REasing.cubic),
    });
    collectTimerRef.current = setTimeout(() => {
      collectTimerRef.current = null;
      if (collectToRail) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onCollect();
    }, duration);
  };

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: appearProgress.value * interpolate(collectProgress.value, [0, 0.75, 1], [1, 0, 0]),
  }));
  const cardEnterStyle = useAnimatedStyle(() => ({
    opacity: appearProgress.value,
    transform: [
      { translateY: interpolate(appearProgress.value, [0, 1], [8, 0]) },
      { scale: interpolate(appearProgress.value, [0, 1], [0.988, 1]) },
    ],
  }));
  const cardBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(collectProgress.value, [0, 0.55, 1], [1, 0.9, 0]),
    transform: [{ scale: interpolate(collectProgress.value, [0, 1], [1, 0.97]) }],
  }));
  const copyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(collectProgress.value, [0, 0.18, 0.42, 1], [1, 0.78, 0, 0]),
    transform: [
      {
        translateY: interpolate(collectProgress.value, [0, 1], [0, -8]),
      },
      { scale: interpolate(collectProgress.value, [0, 1], [1, 0.98]) },
    ],
  }));
  // The dark seal disc dissolves the instant collect starts; the bare
  // target token remains and makes the flight alone.
  const sealDiscStyle = useAnimatedStyle(() => ({
    opacity: interpolate(collectProgress.value, [0, 0.2, 1], [1, 0, 0]),
  }));
  const flyTokenStyle = useAnimatedStyle(() => ({
    opacity: interpolate(collectProgress.value, [0, 0.05, 1], [0, 1, 1]),
  }));
  const sealFlightStyle = useAnimatedStyle(() => {
    const p = collectProgress.value;
    const endScale = collectToRail ? 0.32 : 0.8;
    return {
      opacity: interpolate(p, [0, 0.92, 1], [1, 1, 0]),
      transform: [
        // Y leads and X trails slightly — the token rises, then curves home.
        { translateY: interpolate(p, [0, 0.55, 1], [0, flyY.value * 0.62, flyY.value]) },
        { translateX: interpolate(p, [0, 0.35, 1], [0, flyX.value * 0.14, flyX.value]) },
        { scale: interpolate(p, [0, 1], [1, endScale]) },
      ],
    };
  });

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={handleCollect}>
      <View style={completion.root}>
        <Animated.View pointerEvents="none" style={[completion.backdrop, backdropStyle]} />
        <Animated.View style={[completion.card, cardEnterStyle]}>
          <Animated.View pointerEvents="none" style={[completion.cardBg, cardBgStyle]}>
            <View style={completion.cardFrame} />
          </Animated.View>
          <Animated.View style={[completion.sealFlight, sealFlightStyle]}>
            <Animated.View style={sealDiscStyle}>
              <View pointerEvents="none" style={[completion.bloom, completion.bloomOuter]} />
              <View pointerEvents="none" style={[completion.bloom, completion.bloomMid]} />
              <View pointerEvents="none" style={[completion.bloom, completion.bloomInner]} />
              <View style={completion.seal} ref={sealRef}>
                <View style={completion.targetAura} />
                {heroReady && (
                  <FocusLottie name="target" loop={false} speed={1} style={completion.target} />
                )}
              </View>
            </Animated.View>
            <Animated.View pointerEvents="none" style={[completion.flyToken, flyTokenStyle]}>
              <Image source={TARGET_ICON} style={completion.flyTokenImg} resizeMode="contain" />
            </Animated.View>
          </Animated.View>
          <Animated.View style={[completion.copy, copyStyle]}>
            <Text style={completion.eyebrow}>{eyebrow}</Text>
            <Text style={completion.title}>Congratulations!</Text>
            <View style={completion.ornamentRow}>
              <View style={completion.ornamentLine} />
              <View style={completion.ornamentDiamond} />
              <View style={completion.ornamentLine} />
            </View>
            <Text style={completion.body}>
              {finale ? (
                <>
                  <Text style={completion.bodyStrong}>You hit every target in this cycle!</Text> Now enjoy a long break!
                </>
              ) : (
                <>
                  <Text style={completion.bodyStrong}>You hit the target!</Text> Now take a well-earned break!
                </>
              )}
            </Text>
            <TouchableOpacity onPress={handleCollect} disabled={collecting} style={completion.collectBtn} activeOpacity={0.9}>
              <View style={completion.collectDiamond} />
              <Text style={completion.collectText}>{nextStepLabel}</Text>
              <View style={completion.collectDiamond} />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function ExitWarningModal({
  visible, onResume, onEnd,
}: {
  visible: boolean;
  onResume: () => void;
  onEnd: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onResume}>
      <View style={modal.overlayDark}>
        <View style={modal.warningCard}>
          <View style={modal.warningIcon}>
            <X s={22} c={C.red} w={2.5} />
          </View>
          <Text style={modal.warningTitle}>Stop Session?</Text>
          <Text style={modal.warningBody}>
            You are in the middle of a focus session. Leaving now will reset your current progress.
          </Text>
          <View style={modal.warningRow}>
            <TouchableOpacity onPress={onResume} style={modal.resumeBtn} activeOpacity={0.82}>
              <Text style={modal.resumeText}>RESUME</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onEnd} style={modal.endBtn} activeOpacity={0.82}>
              <Text style={modal.endText}>END</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function StatsModal({
  visible, statsMode, setStatsMode, statsData, todayDayIndex,
  maxSessionBar, maxMinuteBar, calendarDays, calMonth, calYear, todayStr,
  onClose, onPrevMonth, onNextMonth,
}: {
  visible: boolean;
  statsMode: StatsMode;
  setStatsMode: (mode: StatsMode) => void;
  statsData: FocusStatsData;
  todayDayIndex: number;
  maxSessionBar: number;
  maxMinuteBar: number;
  calendarDays: { day: number; dateStr: string; count: number; minutes: number }[];
  calMonth: number;
  calYear: number;
  todayStr: string;
  onClose: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const pillAnim = useSharedValue(statsMode === 'time' ? 1 : 0);
  const [toggleWidth, setToggleWidth] = useState(0);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillAnim.value * (toggleWidth - 8) / 2 }],
  }));

  const handleSetMode = (mode: StatsMode) => {
    pillAnim.value = withSpring(mode === 'time' ? 1 : 0, SEGMENT_SPRING);
    setStatsMode(mode);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const rows = [
    [
      { label: 'Today', sessions: statsData.today, mins: statsData.todayMin, accent: true },
      { label: 'Best Day', sessions: statsData.bestDay, mins: statsData.bestDayMin, accent: false },
    ],
    [
      { label: 'This Week', sessions: statsData.thisWeek, mins: statsData.thisWeekMin, accent: false },
      { label: 'This Month', sessions: statsData.thisMonth, mins: statsData.thisMonthMin, accent: false },
    ],
    [
      { label: 'This Year', sessions: statsData.thisYear, mins: statsData.thisYearMin, accent: false },
      { label: 'All Time', sessions: statsData.allTime, mins: statsData.allTimeMin, accent: false },
    ],
  ];

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={stats.screen}>
        <ScreenTitleBar title="ANALYTICS" showBack bg="#FDFCF8" onBackOverride={onClose} />

        <ScrollView contentContainerStyle={stats.content} showsVerticalScrollIndicator={false}>
          <View
            style={stats.toggle}
            onLayout={e => setToggleWidth(e.nativeEvent.layout.width)}
          >
            {toggleWidth > 0 && (
              <Animated.View style={[stats.togglePill, { width: (toggleWidth - 8) / 2 }, pillStyle]} />
            )}
            <Pressable onPress={() => handleSetMode('streak')} style={stats.toggleBtn}>
              <Image source={TARGET_ICON} style={[stats.toggleTarget, statsMode !== 'streak' && { opacity: 0.35 }]} />
              <Text style={[stats.toggleText, statsMode === 'streak' && stats.toggleTextActive]}>Streak</Text>
            </Pressable>
            <Pressable onPress={() => handleSetMode('time')} style={stats.toggleBtn}>
              <Text style={[stats.toggleText, statsMode === 'time' && stats.toggleTextActive]}>Focused Time</Text>
            </Pressable>
          </View>

          <View style={stats.gridCard}>
            {rows.map((row, rowIdx) => (
              <View key={rowIdx} style={[stats.gridRow, rowIdx > 0 && stats.rowBorder]}>
                {row.map((cell, colIdx) => (
                  <View key={cell.label} style={[stats.gridCell, colIdx > 0 && stats.colBorder, cell.accent && stats.accentCell]}>
                    <Text style={[stats.cellLabel, cell.accent && stats.accentLabel]}>{cell.label}</Text>
                    {statsMode === 'streak' ? (
                      <View style={stats.cellValueRow}>
                        <Text style={[stats.cellValue, cell.accent && stats.accentValue]}>{cell.sessions}</Text>
                        <Image source={TARGET_ICON} style={stats.cellTarget} />
                      </View>
                    ) : (
                      <Text style={[stats.cellValue, cell.accent && stats.accentValue]}>{formatMinutes(cell.mins)}</Text>
                    )}
                  </View>
                ))}
              </View>
            ))}
          </View>

          <View style={stats.card}>
            <Text style={stats.cardHeading}>This week</Text>
            <View style={stats.weekBars}>
              {(statsMode === 'streak' ? statsData.weekDays : statsData.weekDaysMin).map((value, index) => {
                const isToday = index === todayDayIndex;
                const max = statsMode === 'streak' ? maxSessionBar : maxMinuteBar;
                const barHeight = value > 0 ? Math.max(Math.round((value / max) * 72), 10) : 4;
                return (
                  <View key={index} style={stats.weekCol}>
                    <View style={stats.barValueSlot}>
                      {value > 0 && (
                        statsMode === 'streak' ? (
                          <View style={stats.barValueStack}>
                            <Image source={TARGET_ICON} style={stats.barTarget} />
                            <Text style={[stats.barValue, isToday && stats.todayGold]}>{value}</Text>
                          </View>
                        ) : (
                          <Text style={[stats.barValue, isToday && stats.todayGold]}>{formatMinutes(value)}</Text>
                        )
                      )}
                    </View>
                    <View
                      style={[
                        stats.bar,
                        { height: barHeight },
                        isToday ? stats.barToday : value > 0 ? stats.barActive : stats.barEmpty,
                        statsMode === 'time' && (isToday ? stats.timeBarToday : value > 0 ? stats.timeBarActive : null),
                      ]}
                    />
                    <Text style={[stats.dayLabel, isToday && stats.todayGold]}>{DAY_LABELS[index]}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={stats.card}>
            <View style={stats.monthNav}>
              <TouchableOpacity onPress={onPrevMonth} style={stats.monthBtn} activeOpacity={0.72}>
                <ChevronLeft s={18} c="#A8A29E" />
              </TouchableOpacity>
              <Text style={stats.monthTitle}>{MONTH_NAMES[calMonth]} {calYear}</Text>
              <TouchableOpacity onPress={onNextMonth} style={stats.monthBtn} activeOpacity={0.72}>
                <ChevronRight s={18} c="#A8A29E" />
              </TouchableOpacity>
            </View>
            <View style={stats.calendarHeader}>
              {DAY_LABELS.map((day, index) => (
                <Text key={`${day}-${index}`} style={stats.calendarHeadText}>{day}</Text>
              ))}
            </View>
            <View style={stats.calendarGrid}>
              {calendarDays.map((cell, index) => {
                if (cell.day === 0) return <View key={index} style={stats.calendarCellOuter} />;
                const isToday = cell.dateStr === todayStr;
                const hasActivity = statsMode === 'streak' ? cell.count > 0 : cell.minutes > 0;
                return (
                  <View key={index} style={stats.calendarCellOuter}>
                    <View style={[stats.calendarCell, isToday && stats.todayCell, hasActivity && stats.activityCell]}>
                      <Text style={[stats.calendarDay, isToday && stats.todayDay]}>{cell.day}</Text>
                      {statsMode === 'streak' && cell.count > 0 && (
                        <View style={stats.calendarActivity}>
                          <Text style={stats.calendarCount} numberOfLines={1}>
                            {cell.count > 99 ? '99+' : cell.count}
                          </Text>
                          <Image source={TARGET_ICON} style={stats.calendarTarget} />
                        </View>
                      )}
                      {statsMode === 'time' && cell.minutes > 0 && (
                        <Text style={stats.calendarMinutes} numberOfLines={1}>
                          {cell.minutes < 60
                            ? `${cell.minutes}m`
                            : `${Math.floor(cell.minutes / 60)}h${cell.minutes % 60 > 0 ? `${cell.minutes % 60}` : ''}`}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingBottom: TITLE_BAR_BOTTOM_PADDING, zIndex: 10 },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#FFFEFB',
    borderWidth: 1,
    borderColor: '#F1ECE2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  sessionPill: {
    height: 44,
    minWidth: 116,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingLeft: 8,
    paddingRight: 13,
    borderRadius: 22,
    backgroundColor: '#FFFEFB',
    borderWidth: 1,
    borderColor: '#F1ECE2',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
    overflow: 'hidden',
  },
  sessionTargetHalo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDEFEA',
    borderWidth: 1,
    borderColor: 'rgba(234,83,84,0.16)',
  },
  sessionTargetStill: { width: 23, height: 23 },
  sessionCount: { fontFamily: F.serifBold, fontSize: 21, lineHeight: 24, color: INK, fontVariant: ['tabular-nums'] },
  sessionLabel: { marginLeft: -2, fontFamily: F.sansBold, fontSize: 8, lineHeight: 10, letterSpacing: 1.5, color: '#A8A29E', textTransform: 'uppercase' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingBottom: 24 },
  cycleHeader: { position: 'absolute', top: -70, left: 0, right: 0, alignItems: 'center', zIndex: 2 },
  phaseLabel: { marginTop: 6, fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2, color: '#A8A29E', textTransform: 'uppercase' },
  cycleRail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFFEFB',
    borderWidth: 1,
    borderColor: '#F1ECE2',
  },
  cycleSlot: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cycleTargetFilled: { width: 26, height: 26 },
  cycleTargetEmpty: { width: 24, height: 24, tintColor: '#C9C4B7', opacity: 0.4 },
  retrievedOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  timerWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  timerWrapSingle: { transform: [{ translateY: -14 }] },
  timerWrapCycle: { transform: [{ translateY: 18 }] },
  timerVisualLayer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute' },
  timerTextWrap: { position: 'absolute', flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  readyText: { maxWidth: 220, fontFamily: F.serifMedium, fontSize: 26, lineHeight: 31, color: INK, textAlign: 'center' },
  timeText: { fontFamily: F.serifBold, letterSpacing: -1 },
  colon: { fontFamily: F.serifBold, opacity: 0.4, marginHorizontal: 4 },
  sandyWrap: { position: 'absolute', top: '64%', left: 0, right: 0, alignItems: 'center' },
  sandyStage: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  sandyRings: { position: 'absolute', top: -35, left: -35 },
  sandyLottie: { width: 80, height: 80 },
  controlsDeck: { flexDirection: 'row', alignItems: 'center', gap: 18, backgroundColor: '#FFFEFB', padding: 10, borderRadius: 999, borderWidth: 1, borderColor: '#F1ECE2', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.08, shadowRadius: 30, elevation: 9, transform: [{ translateY: 14 }] },
  controlsDeckCycle: { transform: [{ translateY: 22 }] },
  restartCycleTag: {
    marginTop: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: 'rgba(225,29,72,0.28)',
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  restartCycleText: {
    fontFamily: F.serifSemiBold,
    fontSize: 16,
    lineHeight: 20,
    color: '#BE123C',
  },
  smallControl: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAF7F1', borderWidth: 1, borderColor: '#F1ECE2' },
  disabledControl: { opacity: 0.24 },
  mainControl: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 18, elevation: 10 },
});

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  overlayDark: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: '#FFFEFB',
    overflow: 'hidden',
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#D6D3D1',
    alignSelf: 'center',
    marginTop: 10,
  },
  sheetHead: {
    minHeight: 70,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDE8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headSpacer: { width: 38, height: 38 },
  sheetHeadCopy: { alignItems: 'center', flex: 1 },
  sheetEyebrow: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 2,
    color: '#A8A29E',
    textTransform: 'uppercase',
  },
  sheetTitle: {
    marginTop: 2,
    fontFamily: F.serifMedium,
    fontSize: 22,
    color: INK,
  },
  sheetClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F7F5F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetScroll: { flex: 1 },
  sheetContent: { padding: 18, gap: 14 },
  block: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1EEE8',
    padding: 16,
    gap: 14,
  },
  blockLabel: {
    fontFamily: F.serifMedium,
    fontSize: 19,
    lineHeight: 23,
    color: GOLD,
  },
  modeToggle: {
    flexDirection: 'row',
    borderRadius: 18,
    backgroundColor: '#F8F6F1',
    borderWidth: 1,
    borderColor: '#EEE7DA',
    padding: 4,
    gap: 4,
    overflow: 'hidden',
  },
  modePill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 14,
    backgroundColor: GOLD,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  modeBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    paddingHorizontal: 8,
  },
  modeBtnText: {
    fontFamily: F.serifMedium,
    fontSize: 15.5,
    letterSpacing: 0,
    color: '#9CA3AF',
  },
  modeBtnTextActive: { color: '#FFFFFF' },
  modeDescription: {
    fontFamily: F.serif,
    fontSize: 16,
    lineHeight: 22,
    color: '#8A8177',
    textAlign: 'center',
  },
  modeDescriptionStrong: {
    fontFamily: F.serifBold,
    color: INK,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetBtn: {
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: '#EFE3CA',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C5A059',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  presetBtnSelected: {
    backgroundColor: '#C5A059',
    borderColor: '#C5A059',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 3,
  },
  presetBtnSingle: {
    flex: 1,
  },
  presetBtnCycle: {
    flexBasis: '48%',
    flexGrow: 1,
  },
  presetText: {
    fontFamily: F.serifMedium,
    fontSize: 16,
    lineHeight: 20,
    color: '#7C5A17',
  },
  presetTextSelected: {
    color: '#FFFFFF',
  },
  presetSub: {
    marginTop: 2,
    fontFamily: F.sansBold,
    fontSize: 8.5,
    lineHeight: 11,
    letterSpacing: 1.1,
    color: '#B89A5A',
    textTransform: 'uppercase',
  },
  presetSubSelected: {
    color: 'rgba(255,255,255,0.82)',
  },
  card: { width: '100%', maxWidth: 390, borderRadius: 32, backgroundColor: '#fff', padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.18, shadowRadius: 30, elevation: 12 },
  centerCard: { alignItems: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  title: { fontFamily: F.serifMedium, fontSize: 22, color: '#111827' },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  field: { gap: 10 },
  fieldLabel: { fontFamily: F.serifMedium, fontSize: 17, lineHeight: 21, color: INK, marginBottom: 2 },
  durationBox: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FAFAF9', borderWidth: 1, borderColor: '#F5F5F4', borderRadius: 18, padding: 8 },
  stepBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  durationStepBtn: { width: 36, height: 38, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#EFEDE7' },
  durationStepText: { fontFamily: F.sansBold, fontSize: 11, lineHeight: 14, color: '#57534E', fontVariant: ['tabular-nums'] },
  durationValueWrap: { flex: 1, minWidth: 88, height: 44, borderWidth: 1, borderRadius: 13, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 4, paddingTop: 5 },
  durationValue: { fontFamily: F.serifBold, fontSize: 28, lineHeight: 32, fontVariant: ['tabular-nums'] },
  durationUnit: { fontFamily: F.serifMedium, fontSize: 16, lineHeight: 19, color: INK },
  sessionCountBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FAFAF9', borderWidth: 1, borderColor: '#F5F5F4', borderRadius: 18, padding: 8 },
  sessionCountMid: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 0 },
  sessionCountValue: { fontFamily: F.serifBold, fontSize: 31, lineHeight: 34, color: GOLD, fontVariant: ['tabular-nums'] },
  sessionUnitLabel: { fontFamily: F.serifMedium, fontSize: 15, lineHeight: 16, color: INK },
  saveBtn: { width: '100%', paddingVertical: 16, borderRadius: 18, backgroundColor: '#000', alignItems: 'center', marginTop: 2 },
  saveText: { fontFamily: F.sansBold, fontSize: 12, letterSpacing: 2, color: '#fff', textTransform: 'uppercase' },
  warningCard: { width: '100%', maxWidth: 320, borderRadius: 28, backgroundColor: '#fff', padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.18, shadowRadius: 28, elevation: 12 },
  warningIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  warningTitle: { fontFamily: F.serifMedium, fontSize: 21, color: '#111827', textAlign: 'center', marginBottom: 8 },
  warningBody: { fontFamily: F.serif, fontSize: 15, lineHeight: 23, color: '#6B7280', textAlign: 'center', marginBottom: 22 },
  warningRow: { flexDirection: 'row', gap: 10, width: '100%' },
  resumeBtn: { flex: 1, borderRadius: 13, backgroundColor: '#F9FAFB', paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  endBtn: { flex: 1, borderRadius: 13, backgroundColor: C.red, paddingVertical: 13, alignItems: 'center' },
  resumeText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.8, color: '#4B5563' },
  endText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.8, color: '#fff' },
});

const completion = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(23,18,12,0.42)' },
  card: { width: '100%', maxWidth: 360, minHeight: 386, borderRadius: 34, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 32, overflow: 'visible' },
  cardBg: { ...StyleSheet.absoluteFillObject, borderRadius: 34, backgroundColor: '#FFFEFB', borderWidth: 1, borderColor: 'rgba(197,160,89,0.20)', shadowColor: '#000', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.18, shadowRadius: 40, elevation: 16 },
  cardFrame: { position: 'absolute', top: 10, left: 10, right: 10, bottom: 10, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(197,160,89,0.16)' },
  sealFlight: { alignItems: 'center', justifyContent: 'center', zIndex: 4 },
  seal: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: '#17130F', borderWidth: 1.2, borderColor: 'rgba(232,195,116,0.74)', shadowColor: GOLD, shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.34, shadowRadius: 34, elevation: 6 },
  bloom: { position: 'absolute', alignSelf: 'center' },
  bloomOuter: { top: -28, width: 168, height: 168, borderRadius: 84, backgroundColor: 'rgba(197,160,89,0.05)' },
  bloomMid: { top: -15, width: 142, height: 142, borderRadius: 71, backgroundColor: 'rgba(197,160,89,0.08)', borderWidth: 1, borderColor: 'rgba(197,160,89,0.10)' },
  bloomInner: { top: -4, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,214,122,0.13)' },
  targetAura: { position: 'absolute', width: 92, height: 92, borderRadius: 46, backgroundColor: 'rgba(255,214,122,0.20)', borderWidth: 1, borderColor: 'rgba(255,233,182,0.36)' },
  target: { width: 82, height: 82 },
  flyToken: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  flyTokenImg: { width: 82, height: 82 },
  copy: { width: '100%', alignItems: 'center', marginTop: 20 },
  eyebrow: { fontFamily: F.sansBold, fontSize: 9.5, lineHeight: 13, letterSpacing: 2, color: '#B89A5A', textTransform: 'uppercase', marginBottom: 7 },
  title: { fontFamily: F.serifSemiBold, fontSize: 36, lineHeight: 41, color: INK, textAlign: 'center', marginBottom: 10 },
  ornamentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  ornamentLine: { width: 34, height: 1, backgroundColor: 'rgba(197,160,89,0.45)' },
  ornamentDiamond: { width: 6, height: 6, marginHorizontal: 8, borderRadius: 1, backgroundColor: GOLD, transform: [{ rotate: '45deg' }] },
  body: { fontFamily: F.serif, fontSize: 16.5, lineHeight: 24, color: '#8A8177', textAlign: 'center', marginBottom: 24 },
  bodyStrong: { fontFamily: F.serifSemiBold, color: INK },
  collectBtn: { width: '100%', minHeight: 56, borderRadius: 18, backgroundColor: '#17130F', borderWidth: 1, borderColor: 'rgba(232,195,116,0.55)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: GOLD, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.26, shadowRadius: 18, elevation: 8 },
  collectText: { fontFamily: F.sansBold, fontSize: 12, lineHeight: 15, letterSpacing: 2.2, color: '#E8C374', textTransform: 'uppercase', marginHorizontal: 10 },
  collectDiamond: { width: 4, height: 4, borderRadius: 0.5, backgroundColor: 'rgba(232,195,116,0.55)', transform: [{ rotate: '45deg' }] },
});

const stats = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FDFCF8' },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F4', alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 48 },
  toggle: { flexDirection: 'row', backgroundColor: '#F5F5F4', borderRadius: 18, padding: 4, marginBottom: 24 },
  toggleBtn: { flex: 1, minHeight: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, zIndex: 1 },
  togglePill: { position: 'absolute', top: 0, left: 4, bottom: 0, borderRadius: 14, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 5, elevation: 3 },
  toggleText: { fontFamily: F.sansBold, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: '#A8A29E' },
  toggleTextActive: { color: '#1C1917' },
  toggleTarget: { width: 20, height: 20, resizeMode: 'contain' },
  gridCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#F5F5F4', borderRadius: 24, overflow: 'hidden', marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  gridRow: { flexDirection: 'row' },
  rowBorder: { borderTopWidth: 1, borderTopColor: '#FAFAF9' },
  gridCell: { flex: 1, paddingHorizontal: 20, paddingVertical: 16 },
  colBorder: { borderLeftWidth: 1, borderLeftColor: '#FAFAF9' },
  accentCell: { backgroundColor: '#FFFBEB' },
  cellLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: '#A8A29E', textTransform: 'uppercase', marginBottom: 8 },
  accentLabel: { color: 'rgba(197,160,89,0.62)' },
  cellValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cellValue: { fontFamily: F.serifMedium, fontSize: 27, color: '#292524' },
  accentValue: { color: GOLD },
  cellTarget: { width: 22, height: 22, resizeMode: 'contain' },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#F5F5F4', borderRadius: 24, padding: 22, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardHeading: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2.2, color: '#A8A29E', textTransform: 'uppercase', marginBottom: 16 },
  weekBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  weekCol: { flex: 1, alignItems: 'center', gap: 6 },
  barValueSlot: { height: 40, alignItems: 'center', justifyContent: 'flex-end' },
  barValueStack: { alignItems: 'center', gap: 2 },
  barTarget: { width: 14, height: 14, resizeMode: 'contain' },
  barValue: { fontFamily: F.serifBold, fontSize: 13, color: '#57534E' },
  bar: { width: '100%', borderRadius: 8 },
  barToday: { backgroundColor: GOLD },
  barActive: { backgroundColor: 'rgba(197,160,89,0.30)' },
  barEmpty: { backgroundColor: '#F5F5F4' },
  timeBarToday: { backgroundColor: '#1C1917' },
  timeBarActive: { backgroundColor: 'rgba(28,25,23,0.20)' },
  dayLabel: { fontFamily: F.serifBold, fontSize: 13, color: '#D6D3D1', textTransform: 'uppercase', marginTop: 2 },
  todayGold: { color: GOLD },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  monthBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { fontFamily: F.serifMedium, fontSize: 20, color: '#44403C' },
  calendarHeader: { flexDirection: 'row', marginBottom: 6 },
  calendarHeadText: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: F.sansBold, fontSize: 12, color: '#D6D3D1' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCellOuter: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  calendarCell: { flex: 1, borderRadius: 10, backgroundColor: 'rgba(245,245,244,0.5)', alignItems: 'center', justifyContent: 'center' },
  todayCell: { borderWidth: 2, borderColor: '#1C1917' },
  activityCell: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: 'rgba(197,160,89,0.22)' },
  calendarDay: { fontFamily: F.serifMedium, fontSize: 13, color: '#A8A29E', lineHeight: 15 },
  todayDay: { fontFamily: F.serifBold, color: '#1C1917' },
  calendarActivity: { flexDirection: 'row', alignItems: 'center', gap: 1, marginTop: 1 },
  calendarTarget: { width: 12, height: 12, resizeMode: 'contain' },
  calendarCount: { fontFamily: F.serifBold, fontSize: 12, color: '#C93B3C', lineHeight: 13 },
  calendarMinutes: { fontFamily: F.serifBold, fontSize: 12, color: GOLD, marginTop: 1, lineHeight: 13 },
});
