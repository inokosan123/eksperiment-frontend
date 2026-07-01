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
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { CheckSmall, ChevronLeft, ChevronRight, Plus, Trash2 } from '@/components/icons/Icons';
import { useMonthlyGoals } from '@/components/inner-tools/MonthlyGoalsContext';
import { AnimatedGoalCheck, AnimatedStrikeText, fireGoalToggleHaptic } from '@/components/inner-tools/MonthlyGoalRow';
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
const MUTED = '#A8A29E';
const MONTHLY_GOALS_GUIDE_TARGETS = {
  months: 'monthly-goals.months',
  input: 'monthly-goals.input',
  add: 'monthly-goals.add',
} as const;

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

  const monthGoals = useMemo(() => {
    return [...(goalsByMonth[selectedMonth] ?? [])].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt,
    );
  }, [goalsByMonth, selectedMonth]);

  const completedCount = monthGoals.filter(g => g.isCompleted).length;
  const allDone = monthGoals.length > 0 && completedCount === monthGoals.length;
  const progress = monthGoals.length > 0 ? completedCount / monthGoals.length : 0;
  const progressColor = allDone ? GREEN : GOLD;
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
        message: 'Give your month a direction.\n\nChoose the month you want to begin with.',
      });
      return;
    }
    if (guidePhase === 'goal') {
      setPresentation({
        key: 'monthly-goals-input',
        targetId: MONTHLY_GOALS_GUIDE_TARGETS.input,
        placement: 'above',
        allowTargetInteraction: true,
        message: 'Write one goal that would make this month meaningful. Tap Done when it feels clear.',
      });
      return;
    }
    if (guidePhase === 'add') {
      setPresentation({
        key: 'monthly-goals-add',
        targetId: MONTHLY_GOALS_GUIDE_TARGETS.add,
        placement: 'above',
        allowTargetInteraction: true,
        message: 'A clear direction changes how the small choices feel. Add your first goal.',
      });
      return;
    }
    if (guidePhase === 'complete') {
      setPresentation({
        key: 'monthly-goals-complete',
        placement: 'center',
        message: 'Add another monthly goal for a future month?',
        ctaLabel: 'Yes',
        onCta: addAnotherGuidedGoal,
        secondaryCtaLabel: 'No',
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

  return (
    <View style={s.screen}>
      <ScreenTitleBar title="MONTHLY GOALS" showBack bg={BG} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 58 }]}
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'automatic' : undefined}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
      >
        {/* Year switcher */}
        <View style={s.yearRow}>
          <TouchableOpacity
            onPress={goPrevYear}
            disabled={!canPrevYear}
            activeOpacity={0.7}
            style={[s.yearBtn, !canPrevYear && s.yearBtnDisabled]}
          >
            <ChevronLeft s={18} c={canPrevYear ? GOLD : '#D6D3D1'} />
          </TouchableOpacity>
          <Text style={s.yearText}>{viewYear}</Text>
          <TouchableOpacity
            onPress={goNextYear}
            disabled={!canNextYear}
            activeOpacity={0.7}
            style={[s.yearBtn, !canNextYear && s.yearBtnDisabled]}
          >
            <ChevronRight s={18} c={canNextYear ? GOLD : '#D6D3D1'} />
          </TouchableOpacity>
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
            const isCurrent = key === todayMonth;
            const isPast = viewYear < todayYear || (viewYear === todayYear && idx < todayMonthIdx);
            const isFuture = viewYear > todayYear || (viewYear === todayYear && idx > todayMonthIdx);
            const isLocked = isPast && !hasGoals;
            const monthMeta = hasGoals
              ? `${completedInMonth}/${goalCount}`
              : isPast
                ? 'LOCKED'
                : isCurrent
                  ? 'CURRENT'
                  : 'PLAN';

            // Visual state hierarchy:
            //   1. Selected → gold gradient
            //   2. Current month (not selected) → gold ring
            //   3. Past + has goals → solid white + colored dot (gold or green)
            //   4. Past + no goals → muted, faded
            //   5. Future + has goals → solid white + green goal marker
            //   6. Future + no goals → soft white, low contrast
            if (isSelected) {
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => chooseMonth(key)}
                  activeOpacity={0.84}
                  style={s.monthCellWrap}
                >
                  <LinearGradient
                    colors={['#F2D58D', '#D2AA5C', '#A87E33']}
                    locations={[0, 0.52, 1]}
                    start={{ x: 0.1, y: 0 }}
                    end={{ x: 0.92, y: 1 }}
                    style={[s.monthCell, s.monthCellSelected]}
                  >
                    <View pointerEvents="none" style={s.monthSheen} />
                    <Text style={[s.monthLabel, s.monthLabelActive]}>{label}</Text>
                    <Text style={[s.monthMeta, s.monthMetaActive]}>{monthMeta}</Text>
                    <View style={s.monthSelectedSpark} />
                  </LinearGradient>
                </TouchableOpacity>
              );
            }

            const cellStyle: any[] = [s.monthCell];
            const labelStyle: any[] = [s.monthLabel];
            const metaStyle: any[] = [s.monthMeta];
            const railStyle: any[] = [s.monthRail];
            const goalGemStyle: any[] = [s.monthGoalGem];

            if (isCurrent) {
              cellStyle.push(s.monthCellCurrent);
              labelStyle.push(s.monthLabelCurrent);
              metaStyle.push(s.monthMetaCurrent);
              railStyle.push(s.monthRailCurrent);
            } else if (isPast && hasGoals) {
              cellStyle.push(s.monthCellPastFilled);
              labelStyle.push(s.monthLabelPastFilled);
              metaStyle.push(s.monthMetaPastFilled);
              railStyle.push(s.monthRailArchived);
              goalGemStyle.push(s.monthGoalGemArchived);
            } else if (isPast) {
              cellStyle.push(s.monthCellPastEmpty);
              labelStyle.push(s.monthLabelPastEmpty);
              metaStyle.push(s.monthMetaPastEmpty);
              railStyle.push(s.monthRailLocked);
            } else if (isFuture && hasGoals) {
              cellStyle.push(s.monthCellFutureFilled);
              labelStyle.push(s.monthLabelFutureFilled);
              metaStyle.push(s.monthMetaFutureFilled);
              railStyle.push(s.monthRailFutureFilled);
            } else {
              cellStyle.push(s.monthCellFutureEmpty);
              labelStyle.push(s.monthLabelFutureEmpty);
              metaStyle.push(s.monthMetaFutureEmpty);
              railStyle.push(s.monthRailFutureEmpty);
            }

            return (
              <TouchableOpacity
                key={key}
                onPress={() => chooseMonth(key)}
                disabled={isLocked}
                activeOpacity={0.84}
                style={s.monthCellWrap}
              >
                <View style={cellStyle}>
                  <View style={railStyle} />
                  <Text style={labelStyle}>{label}</Text>
                  <Text style={metaStyle}>{monthMeta}</Text>
                  {hasGoals && <View style={goalGemStyle} />}
                  {isLocked && <View style={s.monthLockedLine} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Progress card (only when goals exist) */}
        {monthGoals.length > 0 && (
          <LinearGradient
            colors={['#FFFFFF', '#FDF6E5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.card}
          >
            <View style={s.progressHead}>
              <Text style={s.progressKicker}>PROGRESS</Text>
              <Text style={[s.progressCount, { color: progressColor }]}>
                {completedCount}<Text style={s.progressCountMuted}>/{monthGoals.length}</Text>
              </Text>
            </View>
            <View style={s.progressTrack}>
              {progress > 0 && (
                allDone ? (
                  <View
                    style={[
                      s.progressFillSolid,
                      { width: `${progress * 100}%`, backgroundColor: GREEN },
                    ]}
                  />
                ) : (
                  <LinearGradient
                    colors={['#E2BD75', '#C5A059', '#A87E33']}
                    locations={[0, 0.55, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[s.progressFillSolid, { width: `${progress * 100}%` }]}
                  />
                )
              )}
            </View>
            {allDone && (
              <Text style={[s.progressDone, { color: GREEN }]}>
                All goals complete for {formatMonthFull(selectedMonth)} 🎉
              </Text>
            )}
          </LinearGradient>
        )}

        {canEditSelectedMonth ? (
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
              <Plus s={15} c="#FFFFFF" w={2.6} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.archiveNotice}>
            <Text style={s.archiveNoticeText}>Past months are locked. You can review or delete goals, but not change their completion state.</Text>
          </View>
        )}

        {/* Goals list */}
        <View style={s.goalsList}>
          {monthGoals.map(goal => (
            <View
              key={goal.id}
              style={[s.goalCard, goal.isCompleted && s.goalCardDone, isPastMonth && s.goalCardArchived]}
            >
              <View pointerEvents="none" style={[s.goalCardHighlight, goal.isCompleted && s.goalCardHighlightDone]} />
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
                <Trash2 s={15} c={RED} w={1.9} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Empty state */}
        {monthGoals.length === 0 && (
          <View style={[s.emptyState, isPastMonth && s.emptyStateArchived]}>
            <Text style={s.emptyTitle}>{isPastMonth ? 'No goals were set' : 'No goals yet'}</Text>
            <Text style={s.emptyKicker}>
              {isPastMonth
                ? `${selectedMonthLabel.toUpperCase()} IS ARCHIVED`
                : `SET YOUR INTENTIONS FOR ${selectedMonthLabel.toUpperCase()}`}
            </Text>
          </View>
        )}
      </ScrollView>

      <ConfirmModal
        visible={!!deleteTargetId}
        icon={<Trash2 s={20} c={C.red} />}
        iconBg="#FEF2F2"
        title="Delete goal?"
        body="This goal will be permanently removed."
        cancelLabel="KEEP"
        confirmLabel="DELETE"
        confirmColor={C.red}
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

  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 14,
    paddingVertical: 2,
  },
  yearBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(197,160,89,0.08)',
    borderWidth: 1, borderColor: 'rgba(197,160,89,0.22)',
  },
  yearBtnDisabled: { opacity: 0.38, backgroundColor: '#FFFFFF', borderColor: '#F0EDE6' },
  yearText: {
    fontFamily: F.serifSemiBold,
    fontSize: 22,
    lineHeight: 26,
    color: '#1A1714',
    minWidth: 90,
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: '#EEE4D4',
    borderRadius: 24,
    padding: 10,
    shadowColor: GOLD,
    shadowOpacity: 0.075,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 1,
  },
  monthCellWrap: {
    width: '23.2%',
  },
  monthCell: {
    minHeight: 55,
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: 17,
    alignItems: 'flex-start',
    justifyContent: 'center',
    rowGap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFE9DD',
    overflow: 'hidden',
    position: 'relative',
  },
  monthSheen: {
    position: 'absolute',
    top: 1, left: 1, right: 1,
    height: '48%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.20)',
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

  // Selected (gold gradient)
  monthCellSelected: {
    borderWidth: 0,
    shadowColor: '#A87E33',
    shadowOpacity: 0.23,
    shadowOffset: { width: 0, height: 7 },
    shadowRadius: 14,
    elevation: 3,
  },
  monthLabelActive: { color: '#FFFFFF', letterSpacing: 1.7 },
  monthMetaActive: { color: 'rgba(255,255,255,0.84)' },
  monthSelectedSpark: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.86)',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.42,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 5,
  },

  // Current month, not selected — clean cell with subtle gold underline
  monthCellCurrent: {
    backgroundColor: '#FFFCF2',
    borderColor: 'rgba(197,160,89,0.46)',
    shadowColor: GOLD,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 9,
    elevation: 1,
  },
  monthLabelCurrent: { color: '#1A1714' },
  monthMetaCurrent: { color: GOLD },
  // Past + has goals — solid white, full-strength label, dot indicator
  monthCellPastFilled: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E1D9CE',
  },
  monthLabelPastFilled: { color: '#3F3A34' },
  monthMetaPastFilled: { color: '#8B8278' },

  // Past + no goals — faded, lower visual weight (nothing was set)
  monthCellPastEmpty: {
    backgroundColor: '#F2EEE7',
    borderColor: '#E4DCD0',
    opacity: 0.68,
  },
  monthLabelPastEmpty: { color: '#B5AEA4' },
  monthMetaPastEmpty: { color: '#BDB5AA' },

  // Future + has goals — solid white with the same green goal marker
  monthCellFutureFilled: {
    backgroundColor: '#F8FFF7',
    borderColor: 'rgba(22,163,74,0.24)',
  },
  monthLabelFutureFilled: { color: '#243A2A' },
  monthMetaFutureFilled: { color: GREEN },

  // Future + no goals — soft white, neutral
  monthCellFutureEmpty: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F0E7D7',
  },
  monthLabelFutureEmpty: { color: '#625B52' },
  monthMetaFutureEmpty: { color: '#B49A64' },

  monthRail: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 2.5,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: '#E8DFD2',
  },
  monthRailCurrent: {
    backgroundColor: GOLD,
  },
  monthRailArchived: {
    backgroundColor: '#A79B88',
  },
  monthRailLocked: {
    backgroundColor: '#D4CCC0',
  },
  monthRailFutureFilled: {
    backgroundColor: GREEN,
  },
  monthRailFutureEmpty: {
    backgroundColor: '#E7D7B2',
  },
  monthGoalGem: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 6.5,
    height: 6.5,
    borderRadius: 3.25,
    backgroundColor: GREEN,
    shadowColor: GREEN,
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  monthGoalGemArchived: {
    backgroundColor: '#A79B88',
    shadowColor: '#A79B88',
  },
  monthLockedLine: {
    position: 'absolute',
    right: 8,
    top: 11,
    width: 13,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: '#CFC7BB',
    transform: [{ rotate: '-18deg' }],
  },

  card: {
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFE9DD',
    padding: 16,
    shadowColor: GOLD,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 1,
  },
  progressHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressKicker: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2,
    color: GOLD,
    textTransform: 'uppercase',
  },
  progressCount: { fontFamily: F.serifSemiBold, fontSize: 22, letterSpacing: 0.3 },
  progressCountMuted: { color: '#C9C5BD', fontSize: 17 },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: '#F4EEDD',
    overflow: 'hidden',
  },
  progressFillSolid: { height: '100%', borderRadius: 4 },
  progressDone: {
    marginTop: 10,
    fontFamily: F.serifMediumItalic,
    fontSize: 13,
    textAlign: 'center',
  },

  goalsList: {
    rowGap: 7,
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 11,
    backgroundColor: '#FFFDFC',
    borderRadius: 20,
    borderWidth: 1.4,
    borderColor: 'rgba(197,160,89,0.54)',
    paddingHorizontal: 14,
    paddingVertical: 11,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: GOLD,
    shadowOpacity: 0.09,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 12,
    elevation: 2,
  },
  goalCardDone: {
    backgroundColor: '#FFFDF4',
    borderColor: 'rgba(197,160,89,0.62)',
  },
  goalCardArchived: {
    backgroundColor: '#F8F4ED',
    borderColor: '#D8CBB8',
    shadowColor: '#8B8278',
    shadowOpacity: 0.035,
    elevation: 1,
  },
  goalCardHighlight: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 0,
    height: 1.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  goalCardHighlightDone: {
    backgroundColor: 'rgba(255,255,255,0.74)',
  },
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
    fontSize: 19,
    lineHeight: 24.4,
    color: INK,
  },
  goalTextArchived: { color: '#7D756B' },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0F0',
    borderWidth: 1,
    borderColor: '#F7D6D6',
    flexShrink: 0,
  },

  emptyState: {
    paddingVertical: 30,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0E9DD',
    alignItems: 'center',
    rowGap: 6,
  },
  emptyStateArchived: {
    backgroundColor: '#F5F1EA',
    borderColor: '#E5DED2',
  },
  emptyTitle: {
    fontFamily: F.serifMediumItalic,
    fontSize: 21,
    color: '#AFA69A',
  },
  emptyKicker: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 1.8,
    color: MUTED,
    textAlign: 'center',
  },

  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.20)',
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
    color: GOLD,
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
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
    elevation: 4,
  },
  addBtnDisabled: {
    backgroundColor: '#D6D3D1',
    shadowOpacity: 0,
  },
  archiveNotice: {
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#F3EFE7',
    borderWidth: 1,
    borderColor: '#E2D9CC',
  },
  archiveNoticeText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1,
    color: '#92887B',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
