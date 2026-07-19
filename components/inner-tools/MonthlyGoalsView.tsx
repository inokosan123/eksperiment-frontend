import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import Reanimated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  FadeIn,
  FadeOut,
  LinearTransition,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { CheckSmall, ChevronLeft, ChevronRight, Plus, Trash2 } from '@/components/icons/Icons';
import { sortMonthlyGoals, useMonthlyGoals } from '@/components/inner-tools/MonthlyGoalsContext';
import {
  AnimatedSealCheck,
  AnimatedStrikeText,
  fireGoalToggleHaptic,
  GoalCompletionConfetti,
  MONTHLY_GOAL_CELEBRATION_MS,
  StaticSealCheck,
  toRoman,
} from '@/components/inner-tools/MonthlyGoalRow';
import { C, F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import {
  notifyGuideEvent,
  useGuidedSetup,
  useGuideTarget,
} from '@/components/onboarding/guided/GuidedSetupContext';


const BG = '#FAF7F0';
const GOLD = '#C5A059';
const GREEN = '#16A34A';
const RED = C.red;
const INK = '#1A1714';
const MONTHLY_GOALS_GUIDE_TARGETS = {
  months: 'monthly-goals.months',
  input: 'monthly-goals.input',
  add: 'monthly-goals.add',
} as const;

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);

// The coin: the DateStrip selected-day gradient, the app's struck gold.
const COIN_COLORS = ['#E2BD75', '#C5A059', '#A87E33'] as const;
const COIN_LOCATIONS = [0, 0.55, 1] as const;

function monthKey(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

function currentMonthKey() {
  const d = new Date();
  return monthKey(d.getFullYear(), d.getMonth());
}

function formatMonthFull(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1, 12).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

const MONTH_LABELS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/* ── Dawn backdrop ────────────────────────────────────────── */
// The trophy card's shine grammar for the hero: a diagonal hairline
// weave and a few four-point sparkles twinkling at their own rhythms.

const SPARKLE_PATH = 'M12 0 C13.2 7.4 16.6 10.8 24 12 C16.6 13.2 13.2 16.6 12 24 C10.8 16.6 7.4 13.2 0 12 C7.4 10.8 10.8 7.4 12 0 Z';

function Sparkle({
  size,
  delay,
  style,
}: {
  size: number;
  delay: number;
  style: object;
}) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      t.value = 0.5;
      return;
    }
    t.value = 0;
    t.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(t);
  }, [reduceMotion, delay, t]);

  const twinkle = useAnimatedStyle(() => ({
    opacity: 0.14 + t.value * 0.42,
  }));

  return (
    <Reanimated.View pointerEvents="none" style={[{ position: 'absolute' }, style, twinkle]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={SPARKLE_PATH} fill={GOLD} />
      </Svg>
    </Reanimated.View>
  );
}

function HeroBackdrop() {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const step = 30;
  const lineCount = box.w > 0 ? Math.ceil((box.w + box.h) / step) + 1 : 0;

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        setBox({ w: width, h: height });
      }}
    >
      {lineCount > 0 && (
        <Svg width={box.w} height={box.h} style={StyleSheet.absoluteFill}>
          {Array.from({ length: lineCount }).map((_, index) => {
            const offset = index * step;
            return (
              <Line
                key={index}
                x1={offset}
                y1={-4}
                x2={offset - box.h - 8}
                y2={box.h + 4}
                stroke={GOLD}
                strokeOpacity={0.05}
                strokeWidth={1}
              />
            );
          })}
        </Svg>
      )}
      <Sparkle size={12} delay={0} style={{ right: 96, top: 14 }} />
      <Sparkle size={8} delay={900} style={{ right: 14, top: 40 }} />
      <Sparkle size={9} delay={1900} style={{ left: 130, bottom: 12 }} />
    </View>
  );
}

/* ── The month's coin seal ────────────────────────────────── */
// A struck gold coin carrying the month's count, ringed by a progress
// track that sweeps as intentions are kept. A finished month closes the
// ring in green and the coin stands in a struck-medal ray burst.
function CoinSeal({ completed, total }: { completed: number; total: number }) {
  const allDone = total > 0 && completed === total;
  const frac = total > 0 ? completed / total : 0;
  const S = 88;
  const CENTER = S / 2;
  const R = 37;
  const CIRC = 2 * Math.PI * R;
  const RAY_FIELD = 118;
  const rayCx = RAY_FIELD / 2;
  const progress = useSharedValue(frac);

  useEffect(() => {
    progress.value = withTiming(frac, { duration: 620, easing: Easing.out(Easing.cubic) });
  }, [frac, progress]);

  const fillProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRC * (1 - progress.value),
  }));

  return (
    <View style={cs.stage}>
      {allDone && (
        <Svg pointerEvents="none" width={RAY_FIELD} height={RAY_FIELD} style={cs.rays}>
          {Array.from({ length: 12 }).map((_, index) => {
            const angle = (index / 12) * Math.PI * 2 - Math.PI / 2;
            const long = index % 2 === 0;
            const r1 = 45;
            const r2 = r1 + (long ? 12 : 7);
            return (
              <Line
                key={index}
                x1={rayCx + r1 * Math.cos(angle)}
                y1={rayCx + r1 * Math.sin(angle)}
                x2={rayCx + r2 * Math.cos(angle)}
                y2={rayCx + r2 * Math.sin(angle)}
                stroke={GOLD}
                strokeOpacity={long ? 0.5 : 0.28}
                strokeWidth={long ? 1.7 : 1.2}
                strokeLinecap="round"
              />
            );
          })}
        </Svg>
      )}
      <Svg width={S} height={S} style={{ position: 'absolute' }}>
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={R}
          fill="none"
          stroke="rgba(197,160,89,0.22)"
          strokeWidth={3}
        />
        {total > 0 && (
          <AnimatedCircle
            cx={CENTER}
            cy={CENTER}
            r={R}
            fill="none"
            stroke={allDone ? GREEN : GOLD}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeDasharray={`${CIRC}`}
            animatedProps={fillProps}
            transform={`rotate(-90 ${CENTER} ${CENTER})`}
          />
        )}
      </Svg>
      <View style={cs.coin}>
        <LinearGradient
          colors={[...COIN_COLORS]}
          locations={[...COIN_LOCATIONS]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={cs.coinSheen} />
        <View pointerEvents="none" style={cs.coinRim} />
        {total > 0 ? (
          <Text style={cs.coinCount}>
            {completed}
            <Text style={cs.coinCountMuted}>/{total}</Text>
          </Text>
        ) : (
          <View style={cs.coinDiamond} />
        )}
      </View>
    </View>
  );
}

const cs = StyleSheet.create({
  stage: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center' },
  rays: { position: 'absolute' },
  coin: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A87E33',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  coinSheen: {
    position: 'absolute',
    top: 1,
    left: 3,
    right: 3,
    height: '44%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  coinRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: 'rgba(150,108,40,0.34)',
  },
  coinCount: {
    fontFamily: F.serifSemiBold,
    fontSize: 19,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  coinCountMuted: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.78)',
  },
  coinDiamond: {
    width: 8,
    height: 8,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.85)',
    transform: [{ rotate: '45deg' }],
  },
});

export default function MonthlyGoalsView({
  guided = false,
  onGuidedComplete,
}: {
  guided?: boolean;
  onGuidedComplete?: () => void;
} = {}) {
  const { goalsByMonth, addGoal, toggleGoal, deleteGoal } = useMonthlyGoals();
  const {
    completeStep,
    patchSession,
    session,
    setPresentation,
  } = useGuidedSetup();
  const insets = useSafeAreaInsets();
  const todayMonth = currentMonthKey();
  const todayYear = new Date().getFullYear();
  const todayMonthIdx = new Date().getMonth();

  const [selectedMonth, setSelectedMonth] = useState(todayMonth);
  const [draftText, setDraftText] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [uncheckTarget, setUncheckTarget] = useState<{ id: string; text: string } | null>(null);
  const [celebratingGoalIds, setCelebratingGoalIds] = useState<string[]>([]);
  const completionTimersRef = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const isGuided = guided && session?.active === true && session.activeStep === 'buildMonthlyGoals';
  const guidePhase = session?.phase ?? 'intro';
  const monthsTarget = useGuideTarget(MONTHLY_GOALS_GUIDE_TARGETS.months, isGuided);
  const inputTarget = useGuideTarget(MONTHLY_GOALS_GUIDE_TARGETS.input, isGuided);
  const addTarget = useGuideTarget(MONTHLY_GOALS_GUIDE_TARGETS.add, isGuided);

  // Year being viewed in the month grid (independent of selectedMonth so the
  // user can browse a year without committing to selecting it).
  const [viewYear, setViewYear] = useState(todayYear);

  // Years that contain at least one goal — used to expand the navigable range
  // beyond [todayYear, todayYear+1].
  const yearsWithGoals = useMemo(() => {
    const set = new Set<number>();
    Object.keys(goalsByMonth).forEach(key => {
      const y = Number(key.slice(0, 4));
      if (Number.isFinite(y)) set.add(y);
    });
    return set;
  }, [goalsByMonth]);

  const minYear = useMemo(() => {
    let min = todayYear;
    yearsWithGoals.forEach(y => { if (y < min) min = y; });
    return min;
  }, [yearsWithGoals, todayYear]);

  const maxYear = todayYear + 10; // long-horizon goal planning

  const canPrevYear = viewYear > minYear;
  const canNextYear = viewYear < maxYear;

  const goPrevYear = () => {
    if (!canPrevYear) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setViewYear(y => y - 1);
  };
  const goNextYear = () => {
    if (!canNextYear) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setViewYear(y => y + 1);
  };

  // The viewed year at a glance — months planned and intentions kept.
  const yearStats = useMemo(() => {
    let goals = 0;
    let months = 0;
    let kept = 0;
    for (let i = 0; i < 12; i += 1) {
      const arr = goalsByMonth[monthKey(viewYear, i)] ?? [];
      if (arr.length > 0) {
        months += 1;
        goals += arr.length;
        kept += arr.filter(goal => goal.isCompleted).length;
      }
    }
    return { goals, months, kept };
  }, [goalsByMonth, viewYear]);

  const monthGoals = useMemo(() => {
    return sortMonthlyGoals(goalsByMonth[selectedMonth] ?? []);
  }, [goalsByMonth, selectedMonth]);

  const completedCount = monthGoals.filter(g => g.isCompleted).length;
  const allDone = monthGoals.length > 0 && completedCount === monthGoals.length;
  const isPastMonth = selectedMonth < todayMonth;
  const isFutureMonth = selectedMonth > todayMonth;
  const canEditSelectedMonth = !isPastMonth;
  const selectedMonthLabel = formatMonthFull(selectedMonth);
  const selectedMonthName = selectedMonthLabel.split(' ')[0];

  const handleAdd = async () => {
    if (!canEditSelectedMonth) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    const text = draftText.trim();
    if (!text) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setDraftText('');
    Keyboard.dismiss();
    const saved = await addGoal(selectedMonth, text);
    if (isGuided && saved) {
      notifyGuideEvent({
        type: 'completed',
        step: 'buildMonthlyGoals',
        phase: 'complete',
        entityKey: 'monthlyGoal',
        entityId: saved.id,
      });
    }
  };

  const chooseMonth = (key: string) => {
    if (key < todayMonth && (goalsByMonth[key]?.length ?? 0) === 0) return;
    Haptics.selectionAsync().catch(() => {});
    setSelectedMonth(key);
    if (isGuided && guidePhase === 'intro' && key >= todayMonth) patchSession({ phase: 'goal' });
  };

  const submitGoalDraft = () => {
    if (!canEditSelectedMonth) return;
    if (isGuided && guidePhase === 'goal' && draftText.trim()) {
      Keyboard.dismiss();
      patchSession({ phase: 'add' });
      return;
    }
    void handleAdd();
  };

  const finishGuidedStep = useCallback(() => {
    completeStep('buildMonthlyGoals');
    setPresentation(null);
    onGuidedComplete?.();
  }, [completeStep, onGuidedComplete, setPresentation]);

  const addAnotherGuidedGoal = useCallback(() => {
    Keyboard.dismiss();
    setPresentation(null);
    setDraftText('');
    patchSession({ phase: 'intro' });
  }, [patchSession, setPresentation]);

  useEffect(() => {
    if (!isGuided) return;
    if (guidePhase === 'intro') {
      setPresentation({
        key: 'monthly-goals-month',
        targetId: MONTHLY_GOALS_GUIDE_TARGETS.months,
        cutoutPadding: 5,
        placement: 'below',
        allowTargetInteraction: true,
        eyebrow: 'MONTHLY GOALS',
        progress: { current: 1, total: 3 },
        message: 'Give your month a direction. Goals do not replace daily discipline — they give it somewhere to go.',
        highlights: ['direction'],
        action: 'Tap the month you want to begin with',
      });
      return;
    }
    if (guidePhase === 'goal') {
      setPresentation({
        key: 'monthly-goals-input',
        targetId: MONTHLY_GOALS_GUIDE_TARGETS.input,
        placement: 'above',
        allowTargetInteraction: true,
        eyebrow: 'MONTHLY GOALS',
        progress: { current: 2, total: 3 },
        message: 'Write one goal that would make this month feel meaningful.',
        highlights: ['one goal'],
        action: 'Type it, then tap Done',
      });
      return;
    }
    if (guidePhase === 'add') {
      setPresentation({
        key: 'monthly-goals-add',
        targetId: MONTHLY_GOALS_GUIDE_TARGETS.add,
        placement: 'above',
        allowTargetInteraction: true,
        eyebrow: 'MONTHLY GOALS',
        progress: { current: 3, total: 3 },
        message: 'A clear direction changes how the small daily choices feel.',
        highlights: ['clear direction'],
        action: 'Tap to add your goal',
        hint: 'tap',
      });
      return;
    }
    if (guidePhase === 'complete') {
      setPresentation({
        key: 'monthly-goals-complete',
        placement: 'center',
        celebrate: true,
        eyebrow: 'MONTHLY GOALS',
        message: 'Your first monthly goal is set. It will be waiting at the top of the month.\n\nPlan another month ahead?',
        highlights: ['first monthly goal'],
        ctaLabel: 'Add another goal',
        onCta: addAnotherGuidedGoal,
        secondaryCtaLabel: 'Continue',
        onSecondaryCta: finishGuidedStep,
      });
    }
  }, [addAnotherGuidedGoal, finishGuidedStep, guidePhase, isGuided, setPresentation]);

  useEffect(() => {
    if (!isGuided) return;
    const timer = setTimeout(() => {
      monthsTarget.measure();
      inputTarget.measure();
      addTarget.measure();
    }, guidePhase === 'add' ? 360 : 120);
    return () => clearTimeout(timer);
  }, [addTarget, guidePhase, inputTarget, isGuided, monthsTarget]);

  useEffect(() => () => {
    if (guided) setPresentation(null);
  }, [guided, setPresentation]);

  useEffect(() => {
    if (isPastMonth && draftText) setDraftText('');
  }, [draftText, isPastMonth]);

  useEffect(() => () => {
    Object.values(completionTimersRef.current).forEach(clearTimeout);
  }, []);

  const completeAfterCelebration = useCallback((id: string) => {
    if (completionTimersRef.current[id]) return;
    setCelebratingGoalIds(current => current.includes(id) ? current : [...current, id]);
    completionTimersRef.current[id] = setTimeout(() => {
      delete completionTimersRef.current[id];
      void toggleGoal(id).finally(() => {
        setCelebratingGoalIds(current => current.filter(goalId => goalId !== id));
      });
    }, MONTHLY_GOAL_CELEBRATION_MS);
  }, [toggleGoal]);

  const handleToggle = async (id: string, willComplete: boolean) => {
    if (!canEditSelectedMonth) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    if (!willComplete) {
      const goal = monthGoals.find(item => item.id === id);
      if (goal) setUncheckTarget({ id: goal.id, text: goal.text });
      return;
    }
    fireGoalToggleHaptic(willComplete);
    completeAfterCelebration(id);
  };

  const confirmUncheck = async () => {
    if (!uncheckTarget) return;
    const id = uncheckTarget.id;
    setUncheckTarget(null);
    fireGoalToggleHaptic(false);
    await toggleGoal(id);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const id = deleteTargetId;
    setDeleteTargetId(null);
    await deleteGoal(id);
  };

  // The month's state, read aloud in one italic line.
  const heroState = monthGoals.length === 0
    ? isPastMonth
      ? 'This month passed without intentions.'
      : 'No intentions written yet.'
    : allDone
      ? 'Every intention kept.'
      : completedCount === 0
        ? `${monthGoals.length} ${monthGoals.length === 1 ? 'intention' : 'intentions'} awaiting.`
        : `${monthGoals.length - completedCount} still open · ${completedCount} kept.`;

  const heroEyebrow = isPastMonth
    ? 'FROM THE ARCHIVE'
    : isFutureMonth
      ? 'PLANNED AHEAD'
      : 'THIS MONTH';

  return (
    <View style={s.screen}>
      <ScreenTitleBar title="MONTHLY GOALS" showBack={!isGuided} bg={BG} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 58 }]}
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'automatic' : undefined}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
      >
        {/* The almanac head: the year between engraved rules */}
        <View style={s.yearHead}>
          <View style={s.yearRow}>
            <TouchableOpacity
              onPress={goPrevYear}
              disabled={!canPrevYear}
              activeOpacity={0.7}
              style={[s.yearBtn, !canPrevYear && s.yearBtnDisabled]}
            >
              <ChevronLeft s={17} c={canPrevYear ? GOLD : '#D9D3C6'} />
            </TouchableOpacity>
            <View style={s.yearOrnament}>
              <View style={s.yearRule} />
              <View style={s.yearDiamond} />
            </View>
            <Text style={s.yearText}>{viewYear}</Text>
            <View style={s.yearOrnament}>
              <View style={s.yearDiamond} />
              <View style={s.yearRule} />
            </View>
            <TouchableOpacity
              onPress={goNextYear}
              disabled={!canNextYear}
              activeOpacity={0.7}
              style={[s.yearBtn, !canNextYear && s.yearBtnDisabled]}
            >
              <ChevronRight s={17} c={canNextYear ? GOLD : '#D9D3C6'} />
            </TouchableOpacity>
          </View>
          <Text style={s.yearMeta}>
            {yearStats.months > 0
              ? `${yearStats.months} ${yearStats.months === 1 ? 'MONTH' : 'MONTHS'} PLANNED · ${yearStats.kept}/${yearStats.goals} KEPT`
              : 'AN OPEN YEAR'}
          </Text>
        </View>

        {/* Month grid (Jan → Dec) for the viewed year */}
        <View ref={monthsTarget.ref} onLayout={monthsTarget.onLayout} style={s.monthsGrid}>
          {MONTH_LABELS_SHORT.map((label, idx) => {
            const key = monthKey(viewYear, idx);
            const isSelected = key === selectedMonth;
            const monthItems = goalsByMonth[key] ?? [];
            const goalCount = monthItems.length;
            const hasGoals = goalCount > 0;
            const completedInMonth = monthItems.filter(goal => goal.isCompleted).length;
            const monthAllDone = hasGoals && completedInMonth === goalCount;
            const isCurrent = key === todayMonth;
            const isPast = viewYear < todayYear || (viewYear === todayYear && idx < todayMonthIdx);
            const isFuture = viewYear > todayYear || (viewYear === todayYear && idx > todayMonthIdx);
            const isLocked = isPast && !hasGoals;
            const monthMeta = hasGoals
              ? `${completedInMonth}/${goalCount}`
              : isPast
                ? '—'
                : isCurrent
                  ? 'NOW'
                  : 'PLAN';
            const railFrac = hasGoals ? completedInMonth / goalCount : 0;

            // The selected month is the struck coin.
            if (isSelected) {
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => chooseMonth(key)}
                  activeOpacity={0.84}
                  style={s.monthCellWrap}
                >
                  <View style={[s.monthCell, s.monthCellSelectedWrap]}>
                    <LinearGradient
                      colors={[...COIN_COLORS]}
                      locations={[...COIN_LOCATIONS]}
                      start={{ x: 0.15, y: 0 }}
                      end={{ x: 0.85, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View pointerEvents="none" style={s.monthCoinSheen} />
                    <View pointerEvents="none" style={s.monthCoinRim} />
                    <Text style={[s.monthLabel, s.monthLabelSelected]}>{label}</Text>
                    <Text style={[s.monthMeta, s.monthMetaSelected]}>{monthMeta}</Text>
                    {hasGoals && (
                      <View style={[s.monthRail, s.monthRailOnCoin]}>
                        <View style={[s.monthRailFill, s.monthRailFillOnCoin, { width: `${railFrac * 100}%` }]} />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }

            const cellStyle: any[] = [s.monthCell];
            const labelStyle: any[] = [s.monthLabel];
            const metaStyle: any[] = [s.monthMeta];
            let railFillColor = GOLD;

            if (isCurrent) {
              cellStyle.push(s.monthCellCurrent);
              labelStyle.push(s.monthLabelCurrent);
              metaStyle.push(s.monthMetaCurrent);
            } else if (isPast && hasGoals) {
              cellStyle.push(s.monthCellPastFilled);
              labelStyle.push(s.monthLabelPastFilled);
              metaStyle.push(s.monthMetaPastFilled);
              railFillColor = monthAllDone ? 'rgba(22,163,74,0.55)' : '#B3A78F';
            } else if (isPast) {
              cellStyle.push(s.monthCellPastEmpty);
              labelStyle.push(s.monthLabelPastEmpty);
              metaStyle.push(s.monthMetaPastEmpty);
            } else if (isFuture && hasGoals) {
              cellStyle.push(s.monthCellFutureFilled);
              labelStyle.push(s.monthLabelFutureFilled);
              metaStyle.push(s.monthMetaFutureFilled);
            } else {
              cellStyle.push(s.monthCellFutureEmpty);
              labelStyle.push(s.monthLabelFutureEmpty);
              metaStyle.push(s.monthMetaFutureEmpty);
            }
            if (monthAllDone) railFillColor = isPast ? 'rgba(22,163,74,0.55)' : GREEN;

            return (
              <TouchableOpacity
                key={key}
                onPress={() => chooseMonth(key)}
                disabled={isLocked}
                activeOpacity={0.84}
                style={s.monthCellWrap}
              >
                <View style={cellStyle}>
                  <Text style={labelStyle}>{label}</Text>
                  <Text style={metaStyle}>{monthMeta}</Text>
                  {hasGoals && (
                    <View style={s.monthRail}>
                      <View style={[s.monthRailFill, { width: `${railFrac * 100}%`, backgroundColor: railFillColor }]} />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* The month's seal: the dawn hero of the page */}
        <View style={s.heroCard}>
          <LinearGradient
            colors={['#F8E7BE', '#FFF8E9', '#FFFEFA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <HeroBackdrop />
          <View style={s.heroRow}>
            <View style={s.heroCopy}>
              <Text style={s.heroEyebrow}>{heroEyebrow}</Text>
              <Text style={s.heroTitle} numberOfLines={1}>{selectedMonthLabel}</Text>
              <View style={s.heroOrnament}>
                <View style={s.heroOrnamentLine} />
                <View style={s.heroOrnamentDiamond} />
                <View style={s.heroOrnamentLine} />
              </View>
              <Text style={[s.heroState, allDone && s.heroStateDone]} numberOfLines={2}>
                {heroState}
              </Text>
            </View>
            <CoinSeal completed={completedCount} total={monthGoals.length} />
          </View>
          {isPastMonth && monthGoals.length > 0 && (
            <Text style={s.heroArchiveNote}>
              Past months are archived — review or remove, the record stands.
            </Text>
          )}
        </View>

        {canEditSelectedMonth && (
          <View style={s.addCard}>
            <View style={s.addCopy}>
              <Text style={s.addLabel}>{isFutureMonth ? 'PLAN AHEAD' : 'ADD GOAL'}</Text>
              <TextInput
                ref={inputTarget.ref}
                onLayout={inputTarget.onLayout}
                value={draftText}
                onChangeText={setDraftText}
                onSubmitEditing={submitGoalDraft}
                placeholder={isFutureMonth ? 'Add a goal for this future month...' : 'Add a goal for this month...'}
                placeholderTextColor="#BEB7AB"
                returnKeyType="done"
                style={s.addInput}
              />
            </View>
            <TouchableOpacity
              ref={addTarget.ref}
              onLayout={addTarget.onLayout}
              onPress={handleAdd}
              disabled={!draftText.trim()}
              activeOpacity={0.86}
              style={[s.addBtn, !draftText.trim() && s.addBtnDisabled]}
            >
              {draftText.trim() ? (
                <>
                  <LinearGradient
                    colors={[...COIN_COLORS]}
                    locations={[...COIN_LOCATIONS]}
                    start={{ x: 0.15, y: 0 }}
                    end={{ x: 0.85, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View pointerEvents="none" style={s.addBtnSheen} />
                </>
              ) : null}
              <Plus s={15} c="#FFFFFF" w={2.6} />
            </TouchableOpacity>
          </View>
        )}

        {/* The intentions, sealed and numbered */}
        {monthGoals.length > 0 && (
          <View style={s.listMarker}>
            <View style={s.markerRule} />
            <Text style={s.markerText}>THE INTENTIONS</Text>
            <View style={s.markerRule} />
          </View>
        )}

        <View style={s.goalsList}>
          {monthGoals.map((goal, index) => (
            (() => {
              const isCelebrating = celebratingGoalIds.includes(goal.id);
              const displayDone = goal.isCompleted || isCelebrating;
              return (
            <Reanimated.View
              key={goal.id}
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(140)}
              layout={LinearTransition.duration(360).easing(Easing.out(Easing.cubic))}
            >
            <View
              pointerEvents={isCelebrating ? 'none' : 'auto'}
              style={[s.goalCard, displayDone && s.goalCardDone, isPastMonth && s.goalCardArchived]}
            >
              <View pointerEvents="none" style={[s.goalHighlight, displayDone && s.goalHighlightDone]} />
              {displayDone && <View pointerEvents="none" style={s.goalDoneSpine} />}
              {canEditSelectedMonth ? (
                <AnimatedSealCheck
                  done={displayDone}
                  numeral={toRoman(index)}
                  onPress={() => handleToggle(goal.id, !goal.isCompleted)}
                  size={33}
                />
              ) : (
                <StaticSealCheck done={goal.isCompleted} numeral={toRoman(index)} size={33} />
              )}
              <AnimatedStrikeText
                text={goal.text}
                done={displayDone}
                numberOfLines={3}
                textStyle={[s.goalText, isPastMonth && s.goalTextArchived]}
              />
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync().catch(() => {}); setDeleteTargetId(goal.id); }}
                activeOpacity={0.7}
                hitSlop={8}
                style={s.deleteBtn}
              >
                <Trash2 s={15} c="#B9AFA2" w={1.9} />
              </TouchableOpacity>
            </View>
            <GoalCompletionConfetti done={displayDone} />
            </Reanimated.View>
              );
            })()
          ))}
        </View>

        {/* An open page where no intentions are written yet */}
        {monthGoals.length === 0 && (
          <View style={s.emptyCharter}>
            <View style={s.listMarker}>
              <View style={s.markerRule} />
              <View style={s.markerDiamond} />
              <View style={s.markerRule} />
            </View>
            <Text style={s.charterLine}>
              {isPastMonth
                ? 'No intentions were written for this month.'
                : `Write the first intention of ${selectedMonthName}.`}
            </Text>
          </View>
        )}
      </ScrollView>

      <ConfirmModal
        visible={!!uncheckTarget}
        icon={<CheckSmall s={20} c="#9B6F22" w={3} />}
        iconBg="#FFF7E5"
        title="Uncheck this goal?"
        body="Do you want to mark this goal as incomplete?"
        subject={uncheckTarget?.text}
        confirmLabel="UNCHECK"
        confirmColor={C.red}
        onCancel={() => setUncheckTarget(null)}
        onConfirm={confirmUncheck}
      />

      <ConfirmModal
        visible={!!deleteTargetId}
        icon={<Trash2 s={20} c={C.red} />}
        iconBg="#FEF2F2"
        title="Delete goal?"
        body="This goal will be permanently removed."
        cancelLabel="KEEP"
        confirmLabel="DELETE"
        confirmColor={RED}
        onCancel={() => setDeleteTargetId(null)}
        onConfirm={confirmDelete}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 60,
    rowGap: 12,
  },

  /* Almanac head */
  yearHead: {
    alignItems: 'center',
    rowGap: 3,
    paddingVertical: 2,
  },
  yearRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    paddingHorizontal: 4,
  },
  yearOrnament: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 7,
  },
  yearRule: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(197,160,89,0.30)',
  },
  yearDiamond: {
    width: 5,
    height: 5,
    borderRadius: 1,
    backgroundColor: 'rgba(197,160,89,0.7)',
    transform: [{ rotate: '45deg' }],
  },
  yearBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFEFB',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.28)',
  },
  yearBtnDisabled: { opacity: 0.42, borderColor: '#EFEAE0' },
  yearText: {
    fontFamily: F.serifSemiBold,
    fontSize: 24,
    lineHeight: 28,
    color: INK,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  yearMeta: {
    fontFamily: F.sansBold,
    fontSize: 8.5,
    lineHeight: 11,
    letterSpacing: 1.8,
    color: '#B89A5A',
  },

  /* Month grid */
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.24)',
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: 10,
    shadowColor: GOLD,
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 1,
  },
  monthCellWrap: {
    width: '23.2%',
  },
  monthCell: {
    minHeight: 56,
    paddingHorizontal: 9,
    paddingTop: 8,
    paddingBottom: 11,
    borderRadius: 16,
    alignItems: 'flex-start',
    justifyContent: 'center',
    rowGap: 3,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0E9DC',
    overflow: 'hidden',
    position: 'relative',
  },

  monthLabel: {
    fontFamily: F.sansBold,
    fontSize: 11.2,
    letterSpacing: 1.15,
    color: '#78716C',
    textTransform: 'uppercase',
  },
  monthMeta: {
    fontFamily: F.sansBold,
    fontSize: 8.8,
    lineHeight: 10.5,
    letterSpacing: 0.75,
    color: '#A8A29E',
    textTransform: 'uppercase',
  },

  // The mini rail: each planned month carries its progress at its foot.
  monthRail: {
    position: 'absolute',
    left: 9,
    right: 9,
    bottom: 6,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(197,160,89,0.16)',
    overflow: 'hidden',
  },
  monthRailFill: {
    height: '100%',
    borderRadius: 1,
    backgroundColor: GOLD,
  },
  monthRailOnCoin: {
    backgroundColor: 'rgba(255,255,255,0.30)',
  },
  monthRailFillOnCoin: {
    backgroundColor: 'rgba(255,255,255,0.92)',
  },

  // Selected — the struck coin
  monthCellSelectedWrap: {
    borderWidth: 0,
    shadowColor: '#A87E33',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
  },
  monthCoinSheen: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    height: '46%',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  monthCoinRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(150,108,40,0.34)',
  },
  monthLabelSelected: { color: '#FFFFFF', letterSpacing: 1.7 },
  monthMetaSelected: { color: 'rgba(255,255,255,0.85)' },

  // Current month, not selected — warm plaque with gold hairline
  monthCellCurrent: {
    backgroundColor: '#FFFCF2',
    borderColor: 'rgba(197,160,89,0.46)',
  },
  monthLabelCurrent: { color: INK },
  monthMetaCurrent: { color: GOLD },

  // Past + goals — the archive's parchment
  monthCellPastFilled: {
    backgroundColor: '#FCFAF5',
    borderColor: '#E4DCCE',
  },
  monthLabelPastFilled: { color: '#57534E' },
  monthMetaPastFilled: { color: '#8B8278' },

  // Past + nothing — a quiet stone
  monthCellPastEmpty: {
    backgroundColor: '#F3F0E9',
    borderColor: '#E7E0D3',
    opacity: 0.62,
  },
  monthLabelPastEmpty: { color: '#B5AEA4' },
  monthMetaPastEmpty: { color: '#BDB5AA' },

  // Future + goals — planned ahead, gold-touched
  monthCellFutureFilled: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(197,160,89,0.34)',
  },
  monthLabelFutureFilled: { color: '#44403C' },
  monthMetaFutureFilled: { color: '#8B6B2F' },

  // Future + nothing — an open page
  monthCellFutureEmpty: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F0E8D8',
  },
  monthLabelFutureEmpty: { color: '#6B6459' },
  monthMetaFutureEmpty: { color: '#C2A868' },

  /* The month's seal (hero) */
  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E8D8B5',
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
  },
  heroCopy: { flex: 1, minWidth: 0, rowGap: 3 },
  heroEyebrow: {
    fontFamily: F.sansBold,
    fontSize: 8.5,
    lineHeight: 11,
    letterSpacing: 2,
    color: '#B89A5A',
  },
  heroTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 24,
    lineHeight: 29,
    color: INK,
  },
  heroOrnament: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
    maxWidth: 150,
  },
  heroOrnamentLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(197,160,89,0.35)',
  },
  heroOrnamentDiamond: {
    width: 4,
    height: 4,
    marginHorizontal: 6,
    borderRadius: 1,
    backgroundColor: 'rgba(197,160,89,0.7)',
    transform: [{ rotate: '45deg' }],
  },
  heroState: {
    fontFamily: F.serifMediumItalic,
    fontSize: 13.5,
    lineHeight: 18,
    color: '#8A8177',
  },
  heroStateDone: { color: GREEN },
  heroArchiveNote: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: 'rgba(197,160,89,0.18)',
    fontFamily: F.serifItalic,
    fontSize: 12,
    lineHeight: 16,
    color: '#A29A8C',
    textAlign: 'center',
  },

  /* Add goal */
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    backgroundColor: '#FFFEFB',
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.24)',
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 9,
    shadowColor: GOLD,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 2,
  },
  addCopy: {
    flex: 1,
    minWidth: 0,
  },
  addLabel: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 1.8,
    color: '#B89A5A',
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  addInput: {
    fontFamily: F.serifMedium,
    fontSize: 16,
    lineHeight: 21,
    color: INK,
    paddingVertical: 4,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A87E33',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 9,
    elevation: 4,
  },
  addBtnSheen: {
    position: 'absolute',
    top: 1,
    left: 3,
    right: 3,
    height: '44%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  addBtnDisabled: {
    backgroundColor: '#D9D4CA',
    shadowOpacity: 0,
  },

  /* Section marker + empty charter */
  listMarker: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    paddingHorizontal: 6,
  },
  markerRule: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(197,160,89,0.22)',
  },
  markerText: {
    fontFamily: F.sansBold,
    fontSize: 8.5,
    lineHeight: 11,
    letterSpacing: 2,
    color: '#B89A5A',
  },
  markerDiamond: {
    width: 5,
    height: 5,
    borderRadius: 1,
    backgroundColor: 'rgba(197,160,89,0.55)',
    transform: [{ rotate: '45deg' }],
  },
  emptyCharter: {
    alignItems: 'center',
    rowGap: 12,
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  charterLine: {
    fontFamily: F.serifItalic,
    fontSize: 14.5,
    lineHeight: 20,
    color: '#A29A8C',
    textAlign: 'center',
  },

  /* The intentions */
  goalsList: {
    rowGap: 8,
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    backgroundColor: '#FFFEFB',
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.30)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: GOLD,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 1,
  },
  goalCardDone: {
    backgroundColor: '#FDF8EA',
    borderColor: 'rgba(197,160,89,0.44)',
  },
  goalCardArchived: {
    backgroundColor: '#F9F6F0',
    borderColor: '#E2DACB',
    shadowOpacity: 0.03,
  },
  goalHighlight: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 0,
    height: 1.25,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  goalHighlightDone: {
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  goalDoneSpine: {
    position: 'absolute',
    left: 0,
    top: 9,
    bottom: 9,
    width: 3,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: 'rgba(197,160,89,0.55)',
  },
  goalText: {
    fontFamily: F.serifMedium,
    fontSize: 16.5,
    lineHeight: 20.5,
    color: INK,
  },
  goalTextArchived: { color: '#7D756B' },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
