import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput,
  Pressable, ScrollView, Image, useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedProps, withRepeat, withTiming, withDelay,
  withSequence, Easing as REasing, interpolate,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Minus, Pause,
  Play, Plus, RotateCcw, Settings, X,
} from '@/components/icons/Icons';
import { Feather } from '@expo/vector-icons';
import { F } from '@/constants/tokens';
import { getTitleBarTopPadding, TITLE_BAR_BOTTOM_PADDING } from '@/components/shared/titleBar';
import FocusLottie from '@/components/focus/FocusLottie';
import { getAllFocusSessions, logFocusSession } from '@/components/focus/focusDb';

type Mode = 'focus' | 'break';
type StatsMode = 'streak' | 'time';
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
const FLAME_ICON = require('@/assets/images/streak-flame-512.png');

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

function dateKey(timestamp: number) {
  return new Date(timestamp).toISOString().split('T')[0];
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

  const [focusDuration, setFocusDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [draftFocus, setDraftFocus] = useState(25);
  const [draftBreak, setDraftBreak] = useState(5);
  const [focusInput, setFocusInput] = useState('25');
  const [breakInput, setBreakInput] = useState('5');

  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<Mode>('focus');
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [statsMode, setStatsMode] = useState<StatsMode>('streak');

  const totalTimeForMode = mode === 'focus' ? focusDuration * 60 : breakDuration * 60;
  const activeColor = mode === 'focus' ? GOLD : GREEN;
  const ringColor = isActive ? activeColor : INK;
  const trackColor = isActive ? '#E7E5E4' : INK;
  const timerProgress = Math.max(0, Math.min(1, timeLeft / Math.max(1, totalTimeForMode)));
  const diameter = Math.min(width - 24, 380);
  const timeFont = Math.round(diameter * 0.282);
  const colonFont = Math.round(diameter * 0.105);

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

  const todayStr = new Date().toISOString().split('T')[0];
  const dailySessions = sessionsByDate[todayStr] || 0;
  const totalMinutes = sessions.reduce((sum, session) => sum + session.duration, 0);

  const statsData = useMemo(() => {
    const today = sessionsByDate[todayStr] || 0;
    const todayMin = minutesByDate[todayStr] || 0;
    const bestDay = Object.values(sessionsByDate).length ? Math.max(...Object.values(sessionsByDate)) : 0;
    const bestDayMin = Object.values(minutesByDate).length ? Math.max(...Object.values(minutesByDate)) : 0;

    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
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
      const key = d.toISOString().split('T')[0];
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

  const handleTimerComplete = useCallback(() => {
    setIsActive(false);

    if (mode === 'focus') {
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
      setShowCompletion(true);
      triggerSuccess();
    } else {
      setMode('focus');
      setTimeLeft(focusDuration * 60);
      triggerSuccess();
    }
  }, [focusDuration, mode, triggerSuccess]);

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
    setTimeLeft(mode === 'focus' ? focusDuration * 60 : breakDuration * 60);
  }, [breakDuration, focusDuration, mode]);

  useEffect(() => {
    entryAnim.value = withTiming(1, { duration: 360, easing: REasing.out(REasing.cubic) });
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
      setShowCompletion(false);
      return;
    }
    if (isActive) {
      setShowExitWarning(true);
      return;
    }
    router.back();
  }, [isActive, router, showCompletion, showSettings, showStats]);

  const toggleTimer = () => {
    if (isActive) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setIsActive(prev => !prev);
  };

  const resetTimer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsActive(false);
    setTimeLeft(mode === 'focus' ? focusDuration * 60 : breakDuration * 60);
  };

  const openSettings = () => {
    setDraftFocus(focusDuration);
    setDraftBreak(breakDuration);
    setFocusInput(String(focusDuration));
    setBreakInput(String(breakDuration));
    setShowSettings(true);
  };

  const applySettings = () => {
    const nextFocus = clampDuration(focusInput, 1, 180, draftFocus);
    const nextBreak = clampDuration(breakInput, 1, 60, draftBreak);
    setFocusDuration(nextFocus);
    setBreakDuration(nextBreak);
    setFocusInput(String(nextFocus));
    setBreakInput(String(nextBreak));
    setIsActive(false);
    setMode('focus');
    setTimeLeft(nextFocus * 60);
    setShowSettings(false);
  };

  const startBreak = () => {
    setShowCompletion(false);
    setMode('break');
    setTimeLeft(breakDuration * 60);
    setIsActive(true);
  };

  const skipBreak = () => {
    setShowCompletion(false);
    setMode('focus');
    setTimeLeft(focusDuration * 60);
  };

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

  const todayDayIndex = (() => {
    const day = new Date().getDay();
    return day === 0 ? 6 : day - 1;
  })();

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

  const sandyBreathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.94 + breathe.value * 0.07 }],
  }));

  return (
    <Animated.View style={[s.screen, screenStyle]}>
      <View style={[s.header, { paddingTop: getTitleBarTopPadding(insets.top) }]}>
        <TouchableOpacity onPress={handleBack} style={s.headerBtn} activeOpacity={0.72}>
          <ArrowLeft s={24} c="rgba(28,25,23,0.42)" />
        </TouchableOpacity>

        <View style={s.sessionPill}>
          <FocusLottie name="flame" loop style={s.flameLottie} />
          <Text style={s.sessionCount}>{dailySessions}</Text>
          <Text style={s.sessionLabel}>Today</Text>
        </View>

        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowStats(true); }}
          style={s.headerBtn}
          activeOpacity={0.72}
        >
          <Feather name="pie-chart" size={28} color="rgba(28,25,23,0.42)" />
        </TouchableOpacity>
      </View>

      <View style={s.center}>
        <View style={[s.timerWrap, { width: diameter, height: diameter }]}>
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
            <Text style={[s.timeText, { color: ringColor, fontSize: timeFont, lineHeight: timeFont + 4 }]}>{timeObj.m}</Text>
            <Text style={[s.colon, { color: ringColor, fontSize: colonFont }]}>:</Text>
            <Text style={[s.timeText, { color: ringColor, fontSize: timeFont, lineHeight: timeFont + 4 }]}>{timeObj.s}</Text>
          </Animated.View>

          {/* Sandy hourglass — new animation for focus, green sandy for break */}
          <Animated.View style={[s.sandyWrap, sandyStyle]}>
            <Animated.View style={sandyBreathStyle}>
              {mode === 'focus' ? (
                <FocusLottie name="sandy-work" loop speed={0.4} style={s.sandyLottie} />
              ) : (
                <View style={{ filter: 'hue-rotate(-55deg) brightness(0.85)' }}>
                  <FocusLottie name="sandy" loop speed={0.4} style={s.sandyLottie} />
                </View>
              )}
            </Animated.View>
          </Animated.View>
        </View>

        <View style={s.controlsDeck}>
          <TouchableOpacity onPress={resetTimer} style={s.smallControl} activeOpacity={0.72}>
            <RotateCcw s={20} c="rgba(28,25,23,0.42)" />
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
            <Settings s={20} c="rgba(28,25,23,0.42)" />
          </TouchableOpacity>
        </View>
      </View>

      <SettingsModal
        visible={showSettings}
        focusInput={focusInput}
        breakInput={breakInput}
        draftFocus={draftFocus}
        draftBreak={draftBreak}
        onClose={() => setShowSettings(false)}
        onSave={applySettings}
        onFocusInput={setFocusInput}
        onBreakInput={setBreakInput}
        onFocusStep={(delta) => {
          const next = clampDuration(draftFocus + delta, 1, 180, draftFocus);
          setDraftFocus(next);
          setFocusInput(String(next));
        }}
        onBreakStep={(delta) => {
          const next = clampDuration(draftBreak + delta, 1, 60, draftBreak);
          setDraftBreak(next);
          setBreakInput(String(next));
        }}
      />

      <CompletionModal
        visible={showCompletion}
        dailySessions={dailySessions}
        breakDuration={breakDuration}
        onBreak={startBreak}
        onSkip={skipBreak}
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
        insetsTop={insets.top}
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

function SettingsModal({
  visible, focusInput, breakInput, draftFocus, draftBreak, onClose, onSave,
  onFocusInput, onBreakInput, onFocusStep, onBreakStep,
}: {
  visible: boolean;
  focusInput: string;
  breakInput: string;
  draftFocus: number;
  draftBreak: number;
  onClose: () => void;
  onSave: () => void;
  onFocusInput: (value: string) => void;
  onBreakInput: (value: string) => void;
  onFocusStep: (delta: number) => void;
  onBreakStep: (delta: number) => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={modal.card}>
          <View style={modal.head}>
            <Text style={modal.title}>Session Settings</Text>
            <TouchableOpacity onPress={onClose} style={modal.close} activeOpacity={0.7}>
              <X s={20} c={INK} />
            </TouchableOpacity>
          </View>

          <DurationEditor
            label="Focus Duration"
            accent={GOLD}
            value={focusInput}
            draft={draftFocus}
            step={5}
            onInput={onFocusInput}
            onStep={onFocusStep}
          />

          <DurationEditor
            label="Break Duration"
            accent="#57534E"
            value={breakInput}
            draft={draftBreak}
            step={1}
            onInput={onBreakInput}
            onStep={onBreakStep}
          />

          <TouchableOpacity onPress={onSave} style={modal.saveBtn} activeOpacity={0.88}>
            <Text style={modal.saveText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function DurationEditor({
  label, accent, value, draft, step, onInput, onStep,
}: {
  label: string;
  accent: string;
  value: string;
  draft: number;
  step: number;
  onInput: (value: string) => void;
  onStep: (delta: number) => void;
}) {
  return (
    <View style={modal.field}>
      <Text style={modal.fieldLabel}>{label}</Text>
      <View style={modal.durationBox}>
        <TouchableOpacity onPress={() => onStep(-step)} style={modal.stepBtn} activeOpacity={0.75}>
          <Minus s={18} c="#57534E" />
        </TouchableOpacity>
        <View style={modal.inputWrap}>
          <TextInput
            value={value}
            onChangeText={onInput}
            keyboardType="number-pad"
            selectTextOnFocus
            style={[modal.input, { color: accent, borderColor: `${accent}55`, backgroundColor: accent === GOLD ? '#FFFBEB' : '#fff' }]}
          />
          <Text style={modal.minuteLabel}>min</Text>
        </View>
        <TouchableOpacity onPress={() => onStep(step)} style={modal.stepBtn} activeOpacity={0.75}>
          <Plus s={18} c="#57534E" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CompletionModal({
  visible, dailySessions, breakDuration, onBreak, onSkip,
}: {
  visible: boolean;
  dailySessions: number;
  breakDuration: number;
  onBreak: () => void;
  onSkip: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onSkip}>
      <View style={completion.overlay}>
        <View style={completion.card}>
          <TouchableOpacity onPress={onSkip} style={completion.closeBtn} activeOpacity={0.7}>
            <X s={20} c={INK} />
          </TouchableOpacity>
          <FocusLottie name="fire" loop style={completion.fire} />
          <Text style={completion.title}>Well Done!</Text>
          <View style={completion.sessionsRow}>
            <Text style={completion.sessionsNum}>{dailySessions}</Text>
            <Text style={completion.sessionsText}>sessions today</Text>
          </View>
          <View style={completion.actions}>
            <TouchableOpacity onPress={onBreak} style={completion.breakBtn} activeOpacity={0.88}>
              <Text style={completion.breakText}>Take a {breakDuration}m Break</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onSkip} style={completion.skipBtn} activeOpacity={0.72}>
              <Text style={completion.skipText}>Skip Break</Text>
            </TouchableOpacity>
          </View>
        </View>
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
            <X s={22} c="#EF4444" w={2.5} />
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
  visible, insetsTop, statsMode, setStatsMode, statsData, todayDayIndex,
  maxSessionBar, maxMinuteBar, calendarDays, calMonth, calYear, todayStr,
  onClose, onPrevMonth, onNextMonth,
}: {
  visible: boolean;
  insetsTop: number;
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
    pillAnim.value = withTiming(mode === 'time' ? 1 : 0, { duration: 220 });
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
        <View style={[stats.header, { paddingTop: getTitleBarTopPadding(insetsTop) }]}>
          <TouchableOpacity onPress={onClose} style={stats.headerBtn} activeOpacity={0.7}>
            <ArrowLeft s={24} c="#9CA3AF" />
          </TouchableOpacity>
          <Text style={stats.headerTitle}>ANALYTICS</Text>
          <View style={stats.headerBtn} />
        </View>

        <ScrollView contentContainerStyle={stats.content} showsVerticalScrollIndicator={false}>
          <View
            style={stats.toggle}
            onLayout={e => setToggleWidth(e.nativeEvent.layout.width)}
          >
            {toggleWidth > 0 && (
              <Animated.View style={[stats.togglePill, { width: (toggleWidth - 8) / 2 }, pillStyle]} />
            )}
            <Pressable onPress={() => handleSetMode('streak')} style={stats.toggleBtn}>
              <Image source={FLAME_ICON} style={[stats.toggleFlame, statsMode !== 'streak' && { opacity: 0.35 }]} />
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
                        <Image source={FLAME_ICON} style={stats.cellFlame} />
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
                            <Image source={FLAME_ICON} style={stats.barFlame} />
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
                          <Image source={FLAME_ICON} style={stats.calendarFlame} />
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
  headerBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  sessionPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 4, paddingRight: 16, height: 49, borderRadius: 25, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F5F5F4', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3, overflow: 'hidden' },
  flameLottie: { width: 48, height: 48 },
  flameWeb: { width: 48, height: 48 },
  sessionCount: { fontFamily: F.sansBold, fontSize: 20, color: '#44403C' },
  sessionLabel: { fontFamily: F.sans, fontSize: 16, color: '#D6D3D1' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingBottom: 24 },
  timerWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  ring: { position: 'absolute' },
  timerTextWrap: { position: 'absolute', flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  timeText: { fontFamily: F.serifBold, letterSpacing: -1 },
  colon: { fontFamily: F.serifBold, opacity: 0.4, marginHorizontal: 4 },
  sandyWrap: { position: 'absolute', top: '64%', left: 0, right: 0, alignItems: 'center' },
  sandyLottie: { width: 80, height: 80 },
  controlsDeck: { flexDirection: 'row', alignItems: 'center', gap: 24, backgroundColor: '#fff', padding: 12, paddingRight: 16, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(28,25,23,0.05)', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.08, shadowRadius: 30, elevation: 9 },
  smallControl: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  disabledControl: { opacity: 0.2 },
  mainControl: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 18, elevation: 10 },
});

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  overlayDark: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 390, borderRadius: 32, backgroundColor: '#fff', padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.18, shadowRadius: 30, elevation: 12 },
  centerCard: { alignItems: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  title: { fontFamily: F.serifMedium, fontSize: 22, color: '#111827' },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  field: { marginBottom: 24 },
  fieldLabel: { fontFamily: F.sansBold, fontSize: 12, letterSpacing: 2.2, color: '#A8A29E', textTransform: 'uppercase', marginBottom: 12 },
  durationBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FAFAF9', borderWidth: 1, borderColor: '#F5F5F4', borderRadius: 18, padding: 8 },
  stepBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  input: { width: 66, height: 44, borderWidth: 1, borderRadius: 12, textAlign: 'center', fontFamily: F.serifBold, fontSize: 24, paddingVertical: 0 },
  minuteLabel: { fontFamily: F.sans, fontSize: 14, color: '#A8A29E' },
  saveBtn: { width: '100%', paddingVertical: 16, borderRadius: 18, backgroundColor: '#000', alignItems: 'center', marginTop: 2 },
  saveText: { fontFamily: F.sansBold, fontSize: 12, letterSpacing: 2, color: '#fff', textTransform: 'uppercase' },
  warningCard: { width: '100%', maxWidth: 320, borderRadius: 28, backgroundColor: '#fff', padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.18, shadowRadius: 28, elevation: 12 },
  warningIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  warningTitle: { fontFamily: F.serifMedium, fontSize: 21, color: '#111827', textAlign: 'center', marginBottom: 8 },
  warningBody: { fontFamily: F.serif, fontSize: 15, lineHeight: 23, color: '#6B7280', textAlign: 'center', marginBottom: 22 },
  warningRow: { flexDirection: 'row', gap: 10, width: '100%' },
  resumeBtn: { flex: 1, borderRadius: 13, backgroundColor: '#F9FAFB', paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  endBtn: { flex: 1, borderRadius: 13, backgroundColor: '#EF4444', paddingVertical: 13, alignItems: 'center' },
  resumeText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.8, color: '#4B5563' },
  endText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.8, color: '#fff' },
});

const completion = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.38)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, borderRadius: 32, backgroundColor: '#fff', paddingHorizontal: 28, paddingTop: 16, paddingBottom: 28, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.18, shadowRadius: 40, elevation: 16 },
  closeBtn: { alignSelf: 'flex-end', width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F4', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  fire: { width: 180, height: 180 },
  title: { fontFamily: F.serifMedium, fontSize: 36, color: '#111827', marginTop: 4, marginBottom: 6 },
  sessionsRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 28 },
  sessionsNum: { fontFamily: F.serifMedium, fontSize: 64, color: GOLD },
  sessionsText: { fontFamily: F.sans, fontSize: 18, color: 'rgba(197,160,89,0.62)', marginLeft: 8 },
  actions: { width: '100%', gap: 12 },
  breakBtn: { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(197,160,89,0.22)', backgroundColor: '#FFFBEB', paddingVertical: 16, alignItems: 'center' },
  breakText: { fontFamily: F.sansBold, fontSize: 12, letterSpacing: 1.8, color: GOLD, textTransform: 'uppercase' },
  skipBtn: { paddingVertical: 16, alignItems: 'center' },
  skipText: { fontFamily: F.sansBold, fontSize: 12, letterSpacing: 1.8, color: '#A8A29E', textTransform: 'uppercase' },
});

const stats = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FDFCF8' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: TITLE_BAR_BOTTOM_PADDING, backgroundColor: '#FDFCF8', borderBottomWidth: 1, borderBottomColor: '#EDE9E0' },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: F.serifMedium, fontSize: 21, letterSpacing: 2.8, color: '#111827' },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F4', alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 48 },
  toggle: { flexDirection: 'row', backgroundColor: '#F5F5F4', borderRadius: 18, padding: 4, marginBottom: 24 },
  toggleBtn: { flex: 1, minHeight: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, zIndex: 1 },
  togglePill: { position: 'absolute', top: 0, left: 4, bottom: 0, borderRadius: 14, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 5, elevation: 3 },
  toggleText: { fontFamily: F.sansBold, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: '#A8A29E' },
  toggleTextActive: { color: '#1C1917' },
  toggleFlame: { width: 22, height: 22, resizeMode: 'contain' },
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
  cellFlame: { width: 24, height: 24, resizeMode: 'contain' },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#F5F5F4', borderRadius: 24, padding: 22, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardHeading: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2.2, color: '#A8A29E', textTransform: 'uppercase', marginBottom: 16 },
  weekBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  weekCol: { flex: 1, alignItems: 'center', gap: 6 },
  barValueSlot: { height: 40, alignItems: 'center', justifyContent: 'flex-end' },
  barValueStack: { alignItems: 'center', gap: 2 },
  barFlame: { width: 15, height: 15, resizeMode: 'contain' },
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
  calendarFlame: { width: 13, height: 13, resizeMode: 'contain' },
  calendarCount: { fontFamily: F.serifBold, fontSize: 12, color: '#F97316', lineHeight: 13 },
  calendarMinutes: { fontFamily: F.serifBold, fontSize: 12, color: GOLD, marginTop: 1, lineHeight: 13 },
});
