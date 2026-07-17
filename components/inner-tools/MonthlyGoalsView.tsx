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
import Svg, { Circle } from 'react-native-svg';
import Reanimated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { CheckSmall, ChevronLeft, ChevronRight, Plus, Trash2 } from '@/components/icons/Icons';
import { useMonthlyGoals } from '@/components/inner-tools/MonthlyGoalsContext';
import {
  AnimatedGoalCheck,
  AnimatedStrikeText,
  fireGoalToggleHaptic,
  GoalCompletionConfetti,
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

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];

function toRoman(index: number) {
  return ROMAN[index] ?? String(index + 1);
}

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

/* ── The month's seal ─────────────────────────────────────── */
// A ring seal carrying the month's count: the track is a quiet gold
// hairline, the fill sweeps as intentions are kept, and a finished
// month closes the ring in green.
function RingSeal({ completed, total }: { completed: number; total: number }) {
  const SIZE = 64;
  const CENTER = SIZE / 2;
  const R = 27;
  const CIRC = 2 * Math.PI * R;
  const allDone = total > 0 && completed === total;
  const frac = total > 0 ? completed / total : 0;
  const progress = useSharedValue(frac);

  useEffect(() => {
    progress.value = withTiming(frac, { duration: 620, easing: Easing.out(Easing.cubic) });
  }, [frac, progress]);

  const fillProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRC * (1 - progress.value),
  }));

  return (
    <View style={rs.stage}>
      <Svg width={SIZE} height={SIZE}>
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
      <View style={rs.center} pointerEvents="none">
        {total > 0 ? (
          <Text style={[rs.count, allDone && { color: GREEN }]}>
            {completed}
            <Text style={rs.countMuted}>/{total}</Text>
          </Text>
        ) : (
          <View style={rs.emptyDiamond} />
        )}
      </View>
    </View>
  );
}

const rs = StyleSheet.create({
  stage: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  count: { fontFamily: F.serifSemiBold, fontSize: 19, color: INK, letterSpacing: 0.2 },
  countMuted: { fontSize: 12.5, color: '#B9B0A0' },
  emptyDiamond: {
    width: 7,
    height: 7,
    borderRadius: 1,
    backgroundColor: 'rgba(197,160,89,0.55)',
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
    return [...(goalsByMonth[selectedMonth] ?? [])].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt,
    );
  }, [goalsByMonth, selectedMonth]);

  const completedCount = monthGoals.filter(g => g.isCompleted).length;
  const allDone = monthGoals.length > 0 && completedCount === monthGoals.length;
  const isPastMonth = selectedMonth < todayMonth;
  const isFutureMonth = selectedMonth > todayMonth;
  const canEditSelectedMonth = !isPastMonth;
  const selectedMonthLabel = formatMonthFull(selectedMonth);

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

  const handleToggle = async (id: string, willComplete: boolean) => {
    if (!canEditSelectedMonth) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    fireGoalToggleHaptic(willComplete);
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

        {/* The month's seal: title, state, ring — always present */}
        <View style={s.heroCard}>
          <View pointerEvents="none" style={s.heroFrame} />
          <View style={s.heroRow}>
            <View style={s.heroCopy}>
              <Text style={s.heroEyebrow}>{heroEyebrow}</Text>
              <Text style={s.heroTitle} numberOfLines={1}>{selectedMonthLabel}</Text>
              <Text style={[s.heroState, allDone && s.heroStateDone]} numberOfLines={2}>
                {heroState}
              </Text>
            </View>
            <RingSeal completed={completedCount} total={monthGoals.length} />
          </View>
          {allDone && (
            <>
              <View pointerEvents="none" style={[s.heroGlint, { right: 14, top: 12 }]} />
              <View pointerEvents="none" style={[s.heroGlintSmall, { right: 30, top: 26 }]} />
            </>
          )}
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

        {/* The intentions, numbered like an almanac's entries */}
        <View style={s.goalsList}>
          {monthGoals.map((goal, index) => (
            <View
              key={goal.id}
              style={[s.goalCard, goal.isCompleted && s.goalCardDone, isPastMonth && s.goalCardArchived]}
            >
              {canEditSelectedMonth ? (
                <AnimatedGoalCheck
                  done={goal.isCompleted}
                  onPress={() => handleToggle(goal.id, !goal.isCompleted)}
                  size={22}
                />
              ) : (
                <View style={[s.readOnlyCheck, goal.isCompleted && s.readOnlyCheckDone]}>
                  {goal.isCompleted && <CheckSmall s={13} c="#FFFFFF" w={3} />}
                </View>
              )}
              <Text
                style={[
                  s.goalNumeral,
                  goal.isCompleted && s.goalNumeralDone,
                  isPastMonth && s.goalNumeralArchived,
                ]}
              >
                {toRoman(index)}
              </Text>
              <AnimatedStrikeText
                text={goal.text}
                done={goal.isCompleted}
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
              <GoalCompletionConfetti done={goal.isCompleted} />
            </View>
          ))}
        </View>
      </ScrollView>

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
    borderRadius: 22,
    borderCurve: 'continuous',
    backgroundColor: '#FFFEFB',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.26)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: GOLD,
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 12,
    elevation: 1,
  },
  heroFrame: {
    position: 'absolute',
    top: 7,
    left: 7,
    right: 7,
    bottom: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.13)',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 14,
  },
  heroCopy: { flex: 1, minWidth: 0, rowGap: 2 },
  heroEyebrow: {
    fontFamily: F.sansBold,
    fontSize: 8.5,
    lineHeight: 11,
    letterSpacing: 2,
    color: '#B89A5A',
  },
  heroTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 23,
    lineHeight: 28,
    color: INK,
  },
  heroState: {
    fontFamily: F.serifMediumItalic,
    fontSize: 13.5,
    lineHeight: 18,
    color: '#8A8177',
  },
  heroStateDone: { color: GREEN },
  heroGlint: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 1.5,
    backgroundColor: 'rgba(197,160,89,0.68)',
    transform: [{ rotate: '45deg' }],
  },
  heroGlintSmall: {
    position: 'absolute',
    width: 3.5,
    height: 3.5,
    borderRadius: 1,
    backgroundColor: 'rgba(197,160,89,0.5)',
    transform: [{ rotate: '45deg' }],
  },
  heroArchiveNote: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: 'rgba(197,160,89,0.14)',
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

  /* The intentions */
  goalsList: {
    rowGap: 8,
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    backgroundColor: '#FFFEFB',
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.30)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: GOLD,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 1,
  },
  goalCardDone: {
    backgroundColor: '#FDFBF3',
    borderColor: 'rgba(197,160,89,0.42)',
  },
  goalCardArchived: {
    backgroundColor: '#F9F6F0',
    borderColor: '#E2DACB',
    shadowOpacity: 0.03,
  },
  goalNumeral: {
    fontFamily: F.serifMediumItalic,
    fontSize: 12.5,
    lineHeight: 16,
    color: 'rgba(139,107,47,0.85)',
    minWidth: 18,
    textAlign: 'center',
    flexShrink: 0,
  },
  goalNumeralDone: { color: '#C0B49B' },
  goalNumeralArchived: { color: '#B3A996' },
  readOnlyCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.7,
    borderColor: '#CFC7BB',
    backgroundColor: '#F8F5EF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  readOnlyCheckDone: {
    borderColor: '#A79B88',
    backgroundColor: '#A79B88',
  },
  goalText: {
    fontFamily: F.serifMedium,
    fontSize: 18,
    lineHeight: 23.5,
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
