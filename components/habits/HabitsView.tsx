import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { LayoutAnimation, Platform, ScrollView, StyleSheet, Text, TextInput, UIManager, View } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import ConfirmModal from '@/components/shared/ConfirmModal';
import NotificationSettings, { NotificationMode } from '@/components/shared/NotificationSettings';
import TaskFrequencyEditor from '@/components/shared/TaskFrequencyEditor';
import TaskTimeEditor, { TaskDayTimes } from '@/components/shared/TaskTimeEditor';
import { useTasks } from '@/components/tasks/TaskProvider';
import { buildInstanceId, getLocalDateKey } from '@/components/tasks/taskScheduler';
import type { TaskDraft } from '@/components/tasks/taskTypes';
import {
  archiveHabitRecord,
  habitStepTaskId,
  listHabitsWithStats,
  DEFAULT_HABIT_COLOR,
  saveHabitRecord,
  setHabitRecordActive,
  type HabitFrequency,
  type HabitItem,
  type HabitStep,
} from '@/components/habits/habitDb';
import {
  BarChart3,
  Calendar,
  CheckSmall,
  ChevronDown,
  Flame,
  Pause,
  Pencil,
  Play,
  Plus,
  Target,
  Trash2,
  X,
} from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { NotoEmoji } from '@/components/shared/NotoEmoji';
import { normalizeHabitIcon } from '@/components/shared/notoEmoji/legacyMap';
import type { HabitEmojiName } from '@/components/shared/notoEmoji/habits';
import { AnyTaskCard, type TaskData, type TaskState } from '@/components/shared/TaskCards';
import { playTaskCompleteFeedback, playTaskUndoFeedback } from '@/components/shared/taskFeedback';
import { AnimatedProgressFill, AnimatedTaskRow, CompletionFlourish } from '@/components/shared/taskAnimations';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import {
  notifyGuideEvent,
  useGuidedSetup,
  useGuideTarget,
} from '@/components/onboarding/guided/GuidedSetupContext';
import { GuidedOverlayHost } from '@/components/onboarding/guided/GuidedOverlayHost';


const HABIT_COLORS = [
  DEFAULT_HABIT_COLOR, // yellow
  '#16A34A', // green
  '#84CC16', // lime
  '#0EA5E9', // sky blue
  '#2563EB', // royal blue
  '#4F46E5', // indigo
  '#7C3AED', // purple
  '#A855F7', // violet
  '#DB2777', // pink
  '#F43F5E', // rose
  '#DC2626', // red
  '#EA580C', // orange
  '#F97316', // tangerine
  '#0F766E', // teal
  '#14B8A6', // aqua
  '#475569', // slate
];
const HABITS_GUIDE_TARGETS = {
  add: 'habits.add',
  name: 'habits.name',
  colors: 'habits.colors',
  icons: 'habits.icons',
  addStep: 'habits.add-step',
  activity: 'habits.activity',
  frequency: 'habits.frequency',
  time: 'habits.time',
  stepSave: 'habits.step-save',
  habitSave: 'habits.habit-save',
} as const;
const HABIT_ICONS: HabitEmojiName[] = [
  // Faith & spiritual rhythm
  'praying-hands', 'open-book', 'scroll', 'candle', 'latin-cross', 'church', 'glowing-star',
  // Time, rest & reminders
  'sunrise', 'sun', 'crescent-moon', 'bed', 'sleeping-face',
  'alarm-clock', 'stopwatch', 'hourglass-done', 'bell', 'calendar', 'spiral-calendar',
  // Body, meals & care
  'droplet', 'red-apple', 'green-salad', 'bread', 'bowl-with-spoon', 'cooking',
  'fork-and-knife-with-plate', 'shower', 'soap', 'toothbrush', 'pill', 'stethoscope',
  // Movement & strength
  'person-running', 'person-walking', 'running-shoe', 'bicycle',
  'flexed-biceps', 'person-lifting-weights', 'soccer-ball',
  // Home, order & upkeep
  'house', 'broom', 'sponge', 'toolbox', 'hammer-and-wrench', 'wrench',
  // Work, focus & learning
  'briefcase', 'laptop', 'chart-increasing', 'bullseye', 'memo', 'notebook',
  'writing-hand', 'books', 'graduation-cap', 'bookmark', 'newspaper', 'brain',
  'light-bulb', 'handshake', 'money-bag',
  // Creative practice
  'artist-palette', 'camera', 'movie-camera', 'microphone', 'musical-notes', 'headphones', 'guitar',
  // Growth & motivation
  'seedling', 'potted-plant', 'herb', 'leaf-flutter', 'evergreen-tree',
  'hot-beverage', 'red-heart', 'fire', 'rocket', 'chequered-flag',
  'trophy', 'first-place-medal', 'sports-medal', 'sparkles',
];

const DAY_OPTIONS = [
  { key: 0, label: 'M' },
  { key: 1, label: 'T' },
  { key: 2, label: 'W' },
  { key: 3, label: 'T' },
  { key: 4, label: 'F' },
  { key: 5, label: 'S' },
  { key: 6, label: 'S' },
];
const SEGMENT_SPRING = {
  damping: 18,
  stiffness: 235,
  mass: 0.72,
};

if (Platform.OS === 'android' && typeof UIManager.setLayoutAnimationEnabledExperimental === 'function') {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function animateHabitExpand() {
  try {
    LayoutAnimation.configureNext({
      duration: 280,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
  } catch {
    // Web may ignore LayoutAnimation; native gets the smoother drawer.
  }
}

function getFreqLabel(step: HabitStep) {
  switch (step.frequency) {
    case 'monthly':
      return `Monthly ${step.monthlyDays?.length ? step.monthlyDays.join(', ') : '1'}`;
    case 'weekdays':
      return 'Weekdays';
    case 'weekends':
      return 'Weekends';
    case 'specific_days':
      return (step.selectedDays ?? [])
        .map(day => DAY_OPTIONS.find(item => item.key === day)?.label)
        .filter(Boolean)
        .join(' ');
    default:
      return 'Daily';
  }
}

function todayTaskDayIndex() {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

function getActiveDayIndexes(frequency: HabitFrequency, selectedDays: number[] = []) {
  switch (frequency) {
    case 'weekdays':
      return [0, 1, 2, 3, 4];
    case 'weekends':
      return [5, 6];
    case 'specific_days':
      return selectedDays;
    default:
      return [0, 1, 2, 3, 4, 5, 6];
  }
}

function getStepDisplayTime(step: HabitStep) {
  if (step.sameTimeEveryDay === false) {
    return step.dayTimes?.[todayTaskDayIndex()] || step.time;
  }
  return step.time;
}

function isStepActiveToday(step: HabitStep) {
  const today = getLocalDateKey();
  return step.history?.scheduled?.includes(today) ?? false;
}

function stepCardState(step: HabitStep, habitActive: boolean, availableToday: boolean): TaskState {
  if (!habitActive || !availableToday) return 'locked';
  if (step.completedToday) return 'done';
  if (step.skippedToday) return 'skipped';
  return 'pending';
}

function habitStepTaskCardData(habit: HabitItem, step: HabitStep, state: TaskState): TaskData {
  return {
    variant: 'habit',
    title: step.title,
    time: getStepDisplayTime(step),
    subtitle: getFreqLabel(step),
    state,
    type: 'custom',
    habitColor: habit.color,
    habitIconName: habit.icon,
    hideTypeBadge: true,
    reservedRightSpace: 36,
  };
}

function habitStepToTaskDraft(habit: HabitItem, step: HabitStep): TaskDraft {
  const sameTimeEveryDay = step.sameTimeEveryDay ?? true;
  return {
    id: habitStepTaskId(habit.id, step.id),
    title: step.title,
    subtitle: `${habit.name} - ${getFreqLabel(step)}`,
    level: 3,
    source: 'habit',
    type: 'custom',
    icon: habit.icon,
    habitColor: habit.color,
    targetView: '/habits',
    targetTab: habit.id,
    status: habit.active ? 'active' : 'paused',
    schedule: {
      frequency: step.frequency,
      selectedDays: step.frequency === 'specific_days' ? step.selectedDays ?? [] : [],
      monthlyDays: step.frequency === 'monthly' ? step.monthlyDays ?? [1] : [1],
      time: step.time,
      sameTimeEveryDay,
      dayTimes: sameTimeEveryDay ? {} : step.dayTimes ?? {},
    },
    notificationMode: step.notificationMode ?? 'none',
    reminderMinutes: step.notificationMode === 'double' ? step.reminderMinutes : undefined,
    habitConfig: {
      habitId: habit.id,
      habitStepId: step.id,
    },
  };
}

function buildCalendarSeed(step: HabitStep) {
  return {
    done: new Set(step.history?.completed ?? []),
    skipped: new Set(step.history?.skipped ?? []),
    missed: new Set(step.history?.missed ?? []),
  };
}

// Real per-window completion rates derived from a step's history. Mirrors the
// universal rule used elsewhere: skipped tasks are neutral and don't count in
// either numerator or denominator.
type WindowStats = { completed: number; scheduled: number; pct: number };
type StepWindowStats = { thisWeek: WindowStats; thisMonth: WindowStats; allTime: WindowStats };

function computeStepWindowStats(step: HabitStep, todayStr: string): StepWindowStats {
  const completed = step.history?.completed ?? [];
  const skipped = step.history?.skipped ?? [];
  const missed = step.history?.missed ?? [];
  const completedSet = new Set(completed);
  const skippedSet = new Set(skipped);
  const missedSet = new Set(missed);
  const allDates = new Set<string>([...completed, ...skipped, ...missed]);

  const monthStart = todayStr.slice(0, 7) + '-01';

  // ISO-style week (Mon-start), computed from todayStr.
  const [y, m, d] = todayStr.split('-').map(Number);
  const today = new Date(y, m - 1, d);
  const jsDay = today.getDay();
  const offsetToMonday = jsDay === 0 ? 6 : jsDay - 1;
  const weekStartDate = new Date(today.getTime() - offsetToMonday * 86_400_000);
  const weekStart = `${weekStartDate.getFullYear()}-${String(weekStartDate.getMonth() + 1).padStart(2, '0')}-${String(weekStartDate.getDate()).padStart(2, '0')}`;

  const summarize = (predicate: (date: string) => boolean): WindowStats => {
    let c = 0;
    let s = 0;
    let totalNonSkipped = 0;
    for (const date of allDates) {
      if (!predicate(date)) continue;
      if (date > todayStr) continue;
      if (skippedSet.has(date)) { s += 1; continue; }
      totalNonSkipped += 1;
      if (completedSet.has(date)) c += 1;
    }
    void s;
    void missedSet;
    return {
      completed: c,
      scheduled: totalNonSkipped,
      pct: totalNonSkipped > 0 ? Math.round((c / totalNonSkipped) * 100) : 0,
    };
  };

  return {
    thisWeek: summarize(date => date >= weekStart),
    thisMonth: summarize(date => date >= monthStart),
    allTime: summarize(() => true),
  };
}

function aggregateWindowStats(perStep: StepWindowStats[]): StepWindowStats {
  const sumWindow = (key: keyof StepWindowStats): WindowStats => {
    const c = perStep.reduce((acc, s) => acc + s[key].completed, 0);
    const t = perStep.reduce((acc, s) => acc + s[key].scheduled, 0);
    return { completed: c, scheduled: t, pct: t > 0 ? Math.round((c / t) * 100) : 0 };
  };
  return {
    thisWeek: sumWindow('thisWeek'),
    thisMonth: sumWindow('thisMonth'),
    allTime: sumWindow('allTime'),
  };
}

export type HabitsViewHandle = {
  openAddHabit: () => void;
};

export type HabitsViewProps = {
  /** Hide screen-level chrome (title bar + own ScrollView) for embedding inside another scroll. */
  compact?: boolean;
  /** Used by My Routine: show only active habits and hide the paused-management tab. */
  activeOnly?: boolean;
  /** Fires whenever habits are loaded or mutated — lets an embedded parent reuse the fresh list. */
  onHabitsChanged?: (habits: HabitItem[]) => void;
  /** Onboarding-only walkthrough. */
  guided?: boolean;
  onGuidedComplete?: () => void;
};

const HabitsView = forwardRef<HabitsViewHandle, HabitsViewProps>(function HabitsView({
  compact = false,
  activeOnly = false,
  onHabitsChanged,
  guided = false,
  onGuidedComplete,
}, ref) {
  const {
    completeStep,
    patchSession,
    session,
    setPresentation,
  } = useGuidedSetup();
  const {
    createOrUpdateTask,
    createOrUpdateTasks,
    removeTasks,
    pauseTasks,
    completeInstance,
    resetInstance,
    refresh: refreshTasks,
  } = useTasks();
  const [habits, setHabits] = useState<HabitItem[]>([]);
  const [tab, setTab] = useState<'active' | 'paused'>('active');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<HabitItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HabitItem | null>(null);
  const [pauseConfirmTarget, setPauseConfirmTarget] = useState<HabitItem | null>(null);
  const [analyticsTarget, setAnalyticsTarget] = useState<HabitItem | null>(null);
  const [taskDetail, setTaskDetail] = useState<{ habit: HabitItem; step: HabitStep } | null>(null);
  const [stepEditTarget, setStepEditTarget] = useState<{ habit: HabitItem; step: HabitStep | null } | null>(null);
  const isGuided = guided && session?.active === true && session.activeStep === 'buildHabits';
  const guidePhase = session?.phase ?? 'intro';
  const addTarget = useGuideTarget(HABITS_GUIDE_TARGETS.add, isGuided);

  const activeHabits = useMemo(() => habits.filter(item => item.active), [habits]);
  const pausedHabits = useMemo(() => habits.filter(item => !item.active), [habits]);
  const visibleHabits = activeOnly ? activeHabits : tab === 'active' ? activeHabits : pausedHabits;
  const showingActiveHabits = activeOnly || tab === 'active';

  const openAddHabit = useCallback(() => {
    setEditTarget(null);
    setEditorOpen(true);
    if (isGuided) patchSession({ phase: 'name' });
  }, [isGuided, patchSession]);

  useImperativeHandle(ref, () => ({
    openAddHabit,
  }), [openAddHabit]);

  const loadHabits = useCallback(async () => {
    const today = getLocalDateKey();
    await refreshTasks(today);
    const nextHabits = await listHabitsWithStats(today);
    setHabits(nextHabits);
    onHabitsChanged?.(nextHabits);
  }, [refreshTasks, onHabitsChanged]);

  useFocusEffect(
    useCallback(() => {
      void loadHabits();
    }, [loadHabits]),
  );

  const toggleStep = async (habitId: string, stepId: string) => {
    const habit = habits.find(item => item.id === habitId);
    const step = habit?.steps.find(item => item.id === stepId);
    if (!habit || !step) return;
    const nextCompleted = !step.completedToday;
    if (nextCompleted) void playTaskCompleteFeedback();
    else playTaskUndoFeedback();
    setHabits(current => current.map(habit => habit.id === habitId ? {
      ...habit,
      steps: habit.steps.map(step => step.id === stepId ? { ...step, completedToday: !step.completedToday } : step),
    } : habit));
    const today = getLocalDateKey();
    const instanceId = buildInstanceId(habitStepTaskId(habitId, stepId), today);
    if (nextCompleted) await completeInstance(instanceId, today);
    else await resetInstance(instanceId, today);
    await loadHabits();
  };

  const saveStepEdit = async (habit: HabitItem, nextStep: HabitStep) => {
    const exists = habit.steps.some(step => step.id === nextStep.id);
    const updatedHabit: HabitItem = {
      ...habit,
      steps: exists
        ? habit.steps.map(step => step.id === nextStep.id ? nextStep : step)
        : [...habit.steps, nextStep],
    };
    setHabits(current => current.map(item => item.id === updatedHabit.id ? updatedHabit : item));
    await createOrUpdateTask(habitStepToTaskDraft(updatedHabit, nextStep));
    await saveHabitRecord(updatedHabit);
    await loadHabits();
  };

  const deleteStepEdit = async (habit: HabitItem, step: HabitStep) => {
    const updatedHabit: HabitItem = {
      ...habit,
      steps: habit.steps.filter(item => item.id !== step.id),
    };
    setHabits(current => current.map(item => item.id === updatedHabit.id ? updatedHabit : item));
    await saveHabitRecord(updatedHabit);
    await removeTasks([habitStepTaskId(habit.id, step.id)], getLocalDateKey());
    await loadHabits();
  };

  const saveHabit = async (habit: HabitItem) => {
    const previous = habits.find(item => item.id === habit.id);
    setEditorOpen(false);
    setEditTarget(null);
    setExpandedId(habit.id);
    setHabits(current => {
      const exists = current.some(item => item.id === habit.id);
      return exists
        ? current.map(item => item.id === habit.id ? habit : item)
        : [habit, ...current];
    });

    const nextStepIds = new Set(habit.steps.map(step => step.id));
    const today = getLocalDateKey();
    if (previous) {
      const removedTaskIds = previous.steps
        .filter(step => !nextStepIds.has(step.id))
        .map(step => habitStepTaskId(previous.id, step.id));
      if (removedTaskIds.length) {
        await removeTasks(removedTaskIds, today);
      }
    }
    await saveHabitRecord(habit);
    if (habit.steps.length) {
      await createOrUpdateTasks(habit.steps.map(step => habitStepToTaskDraft(habit, step)), today);
    }
    await loadHabits();
    if (isGuided) {
      notifyGuideEvent({
        type: 'completed',
        step: 'buildHabits',
        phase: 'complete',
        entityKey: 'habit',
        entityId: habit.id,
      });
    }
  };

  const finishGuidedStep = useCallback(() => {
    completeStep('buildHabits');
    patchSession({
      activeStep: 'buildChallenges',
      phase: 'intro',
      route: '/onboarding',
    });
    setPresentation(null);
    onGuidedComplete?.();
  }, [completeStep, onGuidedComplete, patchSession, setPresentation]);

  useEffect(() => {
    if (!isGuided) return;
    if (guidePhase === 'intro') {
      setPresentation({
        key: 'habits-intro',
        targetId: HABITS_GUIDE_TARGETS.add,
        placement: 'above',
        allowTargetInteraction: true,
        message: 'Habits turn repeated actions into a rhythm you can keep.\n\nAdd one habit you want to build.',
      });
      return;
    }
    if (guidePhase === 'complete') {
      setPresentation({
        key: 'habits-complete',
        placement: 'center',
        celebrate: true,
        message: 'Your first habit is ready.',
        ctaLabel: 'CONTINUE',
        onCta: finishGuidedStep,
      });
    }
  }, [finishGuidedStep, guidePhase, isGuided, setPresentation]);

  useEffect(() => () => {
    if (guided) setPresentation(null);
  }, [guided, setPresentation]);

  const setHabitActiveState = async (habit: HabitItem, active: boolean) => {
    const today = getLocalDateKey();
    const nextHabit = { ...habit, active };
    setHabits(current => current.map(item => item.id === habit.id ? nextHabit : item));
    setTab(active || activeOnly ? 'active' : 'paused');
    setExpandedId(active ? habit.id : null);
    await setHabitRecordActive(habit.id, active);
    if (active) {
      await createOrUpdateTasks(nextHabit.steps.map(step => habitStepToTaskDraft(nextHabit, step)), today);
    } else {
      await pauseTasks(habit.steps.map(step => habitStepTaskId(habit.id, step.id)), today);
    }

    await loadHabits();
  };

  const progressFor = (habit: HabitItem) => {
    // Today's progress reflects only steps actually scheduled for today.
    // Skipped steps are neutral — excluded from the denominator (matches the
    // universal rule used by Home / WeeklyRhythm).
    const todaysSteps = habit.steps.filter(isStepActiveToday);
    const total = todaysSteps.length;
    const done = todaysSteps.filter(step => step.completedToday).length;
    const skipped = todaysSteps.filter(step => step.skippedToday).length;
    const effective = total - skipped;
    return { total, done, pct: effective === 0 ? 0 : Math.round((done / effective) * 100) };
  };

  const innerContent = (
    <>
      {!activeOnly && (
        <HabitTabBar
          tab={tab}
          activeCount={activeHabits.length}
          pausedCount={pausedHabits.length}
          onChange={key => { setTab(key); setExpandedId(null); }}
        />
      )}

      {!activeOnly && !compact && (
        <Text style={s.helperText}>
          {tab === 'active'
            ? 'Active habits appear in your daily flow and can be checked off each day.'
            : 'Paused habits stay here so you can resume them whenever you want.'}
        </Text>
      )}

        <View style={s.habitList}>
          {visibleHabits.map(habit => {
            const progress = progressFor(habit);
            const expanded = expandedId === habit.id;
            const todaysSteps = habit.steps.filter(isStepActiveToday);
            const otherSteps = habit.steps.filter(step => !isStepActiveToday(step));
            const todayMetaText = todaysSteps.length === 0
              ? 'Not scheduled today'
              : `${todaysSteps.length} ${todaysSteps.length === 1 ? 'step' : 'steps'} today`;
            return (
              <View key={habit.id} style={s.habitCard}>
                <TouchableOpacity onPress={() => { animateHabitExpand(); setExpandedId(current => current === habit.id ? null : habit.id); }} activeOpacity={0.85} style={s.habitHead}>
                  <LinearGradient
                    colors={[hexToRgba(habit.color, 0.18), hexToRgba(habit.color, 0.06)]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[s.iconCircle, { borderColor: hexToRgba(habit.color, 0.22) }]}
                  >
                    <NotoEmoji name={normalizeHabitIcon(habit.icon)} size={26} />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <View style={s.habitTitleRow}>
                      <Text style={s.habitTitle}>{habit.name}</Text>
                      <Text style={[s.progressText, { color: habit.color }]}>{progress.done}/{progress.total}</Text>
                    </View>
                    <Text style={s.habitMeta}>{todayMetaText}</Text>
                    <View style={s.progressBar}>
                      <AnimatedProgressFill percent={progress.pct} color={habit.color} height={6} />
                    </View>
                  </View>
                  <View style={[s.chevronWrap, expanded && s.chevronWrapExpanded]}>
                    <ChevronDown s={16} c="#D1D5DB" />
                  </View>
                </TouchableOpacity>

                {expanded && (
                  <View style={s.habitBody}>
                    {todaysSteps.length > 0 ? (
                      <View style={s.stepsContainer}>
                        {todaysSteps.map(step => {
                          const isResolved = step.completedToday || step.skippedToday;
                          const state = stepCardState(step, habit.active, true);
                          return (
                            <AnimatedTaskRow key={step.id} done={isResolved}>
                              <View style={s.stepTaskCardShell}>
                                <TouchableOpacity
                                  onPress={() => habit.active && toggleStep(habit.id, step.id)}
                                  activeOpacity={0.84}
                                  disabled={!habit.active}
                                >
                                  <AnyTaskCard task={habitStepTaskCardData(habit, step, state)} />
                                </TouchableOpacity>
                                <CompletionFlourish
                                  done={step.completedToday}
                                  color={habit.color}
                                  layerStyle={s.stepTaskFlourish}
                                />
                                <TouchableOpacity
                                  onPress={e => {
                                    e.stopPropagation?.();
                                    setStepEditTarget({ habit, step });
                                  }}
                                  activeOpacity={0.7}
                                  hitSlop={8}
                                  style={s.stepTaskEditBtn}
                                >
                                  <Pencil s={14} c="#A8A29E" w={2} />
                                </TouchableOpacity>
                              </View>
                            </AnimatedTaskRow>
                          );
                        })}
                      </View>
                    ) : (
                      <View style={s.stepsEmpty}>
                        <Text style={s.stepsEmptyText}>No steps scheduled today.</Text>
                      </View>
                    )}

                    {otherSteps.length > 0 && (
                      <View style={s.otherStepsBlock}>
                        <Text style={s.otherStepsLabel}>OTHER DAYS</Text>
                        <View style={s.stepsContainer}>
                          {otherSteps.map(step => {
                            const state = stepCardState(step, habit.active, false);
                            return (
                              <View key={step.id} style={[s.stepTaskCardShell, s.stepTaskCardInactive]}>
                                <AnyTaskCard task={habitStepTaskCardData(habit, step, state)} />
                              <TouchableOpacity
                                onPress={() => setStepEditTarget({ habit, step })}
                                activeOpacity={0.7}
                                hitSlop={8}
                                style={s.stepTaskEditBtn}
                              >
                                <Pencil s={14} c="#A8A29E" w={2} />
                              </TouchableOpacity>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    <TouchableOpacity
                      onPress={() => setStepEditTarget({ habit, step: null })}
                      activeOpacity={0.7}
                      style={[s.addStepCard, { borderColor: hexToRgba(habit.color, 0.45) }]}
                    >
                      <Plus s={16} c={habit.color} w={2.4} />
                      <Text style={[s.addStepCardText, { color: habit.color }]}>Add Step</Text>
                    </TouchableOpacity>

                    <View style={s.actionGrid}>
                      <ActionIconButton
                        icon={habit.active ? <Pause s={16} c="#6B7280" /> : <Play s={16} c="#FFFFFF" />}
                        label={habit.active ? 'Pause' : 'Resume'}
                        active={false}
                        filled={!habit.active}
                        onPress={() => habit.active ? setPauseConfirmTarget(habit) : void setHabitActiveState(habit, true)}
                      />
                      <ActionIconButton
                        icon={<Pencil s={16} c="#6B7280" />}
                        label="Edit"
                        onPress={() => { setEditTarget(habit); setEditorOpen(true); }}
                      />
                      <ActionIconButton
                        icon={<BarChart3 s={16} c="#6B7280" />}
                        label="Stats"
                        onPress={() => setAnalyticsTarget(habit)}
                      />
                      <ActionIconButton
                        icon={<Trash2 s={16} c="#DC2626" />}
                        label="Delete"
                        danger
                        onPress={() => setDeleteTarget(habit)}
                      />
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {visibleHabits.length === 0 && (
          <View style={s.emptyCard}>
            <Text style={s.emptyTitle}>{showingActiveHabits ? 'No active habits' : 'No paused habits'}</Text>
            <Text style={s.emptyBody}>
              {showingActiveHabits
                ? 'Tap + to add your first habit.'
                : 'Paused habits will appear here.'}
            </Text>
          </View>
        )}

        <TouchableOpacity
          ref={addTarget.ref}
          onLayout={addTarget.onLayout}
          onPress={openAddHabit}
          activeOpacity={0.7}
          style={[s.addHabitCard, { borderColor: hexToRgba(C.gold, 0.45) }]}
        >
          <Plus s={16} c={C.gold} w={2.4} />
          <Text style={s.addHabitText}>Add Habit</Text>
        </TouchableOpacity>
    </>
  );

  const modals = (
    <>
      <HabitEditorSheet
        visible={editorOpen}
        editHabit={editTarget}
        onClose={() => { setEditorOpen(false); setEditTarget(null); }}
        onSave={saveHabit}
        guided={isGuided}
      />

      <ConfirmModal
        visible={!!deleteTarget}
        icon={<Trash2 s={22} c="#EF4444" />}
        iconBg="#FEF2F2"
        title="Delete Habit"
        body={deleteTarget ? `"${deleteTarget.name}" and all its steps will be removed.` : ''}
        confirmLabel="DELETE"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          const target = deleteTarget;
          setDeleteTarget(null);
          if (target) {
            setHabits(current => current.filter(item => item.id !== target.id));
            const taskIds = target.steps.map(step => habitStepTaskId(target.id, step.id));
            if (taskIds.length) {
              await removeTasks(taskIds, getLocalDateKey());
            }
            await archiveHabitRecord(target.id);
            await loadHabits();
          }
        }}
      />

      <ConfirmModal
        visible={!!pauseConfirmTarget}
        icon={<Pause s={22} c={C.gold} />}
        iconBg="#FFF8E8"
        title="Pause Habit"
        body={pauseConfirmTarget ? `"${pauseConfirmTarget.name}" will stop appearing in your active habit list.` : ''}
        confirmLabel="CONTINUE"
        confirmColor={C.gold}
        onCancel={() => setPauseConfirmTarget(null)}
        onConfirm={() => {
          if (pauseConfirmTarget) {
            void setHabitActiveState(pauseConfirmTarget, false);
          }
          setPauseConfirmTarget(null);
        }}
      />

      <HabitAnalyticsSheet
        habit={analyticsTarget}
        onClose={() => setAnalyticsTarget(null)}
        onOpenStep={step => analyticsTarget && setTaskDetail({ habit: analyticsTarget, step })}
      />

      <TaskDetailSheet
        detail={taskDetail}
        onClose={() => setTaskDetail(null)}
      />

      <HabitTaskEditorSheet
        visible={!!stepEditTarget}
        step={stepEditTarget?.step ?? null}
        accent={stepEditTarget?.habit.color ?? C.gold}
        onClose={() => setStepEditTarget(null)}
        onSave={async nextStep => {
          if (stepEditTarget) {
            await saveStepEdit(stepEditTarget.habit, nextStep);
          }
          setStepEditTarget(null);
        }}
        onDelete={async step => {
          if (stepEditTarget) {
            await deleteStepEdit(stepEditTarget.habit, step);
          }
          setStepEditTarget(null);
        }}
      />
    </>
  );

  if (compact) {
    return (
      <View>
        {innerContent}
        {modals}
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <ScreenTitleBar
        title="HABITS"
        showBack
        rightElement={(
          <TouchableOpacity onPress={openAddHabit} activeOpacity={0.76} style={s.headerBtn}>
            <Plus s={24} c={C.gold} w={2.4} />
          </TouchableOpacity>
        )}
      />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {innerContent}
      </ScrollView>
      {modals}
    </View>
  );
});

export default HabitsView;

function HabitTabBar({
  tab,
  activeCount,
  pausedCount,
  onChange,
}: {
  tab: 'active' | 'paused';
  activeCount: number;
  pausedCount: number;
  onChange: (key: 'active' | 'paused') => void;
}) {
  const items = [
    { key: 'active' as const, label: `Active (${activeCount})` },
    { key: 'paused' as const, label: `Paused (${pausedCount})` },
  ];
  const [segWidth, setSegWidth] = useState(0);
  const tabProgress = useSharedValue(tab === 'active' ? 0 : 1);
  const pillWidth = segWidth > 0 ? (segWidth - 12) / 2 : 0;
  const pillTravel = pillWidth + 4;

  useEffect(() => {
    tabProgress.value = withSpring(tab === 'active' ? 0 : 1, SEGMENT_SPRING);
  }, [tab, tabProgress]);

  const pillStyle = useAnimatedStyle(() => ({
    width: pillWidth,
    transform: [{ translateX: tabProgress.value * pillTravel }],
  }), [pillWidth, pillTravel]);

  return (
    <View
      style={s.tabBar}
      onLayout={e => setSegWidth(e.nativeEvent.layout.width)}
    >
      <Reanimated.View pointerEvents="none" style={[s.tabIndicator, pillStyle]} />
      {items.map(item => {
        const isActive = tab === item.key;
        const Icon = item.key === 'active' ? Play : Pause;
        return (
          <TouchableOpacity
            key={item.key}
            onPress={() => onChange(item.key)}
            activeOpacity={0.84}
            style={s.tab}
          >
            <Icon s={13} c={isActive ? C.gold : '#A8A29E'} />
            <Text style={[s.tabText, isActive && s.tabTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ActionIconButton({
  icon,
  label,
  onPress,
  danger = false,
  filled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  danger?: boolean;
  active?: boolean;
  filled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.84}
      style={[
        s.actionBtn,
        filled && s.actionBtnFilled,
        danger && s.actionBtnDanger,
      ]}
    >
      {icon}
      <Text style={[s.actionBtnText, filled && s.actionBtnTextFilled, danger && s.actionBtnTextDanger]}>{label}</Text>
    </TouchableOpacity>
  );
}

function HabitEditorSheet({
  visible,
  editHabit,
  onClose,
  onSave,
  guided = false,
}: {
  visible: boolean;
  editHabit: HabitItem | null;
  onClose: () => void;
  onSave: (habit: HabitItem) => void | Promise<void>;
  guided?: boolean;
}) {
  const { patchSession, session, setPresentation } = useGuidedSetup();
  const isGuided = guided && session?.active === true && session.activeStep === 'buildHabits';
  const guidePhase = session?.phase ?? 'name';
  const nameTarget = useGuideTarget(HABITS_GUIDE_TARGETS.name, isGuided);
  const colorsTarget = useGuideTarget(HABITS_GUIDE_TARGETS.colors, isGuided);
  const iconsTarget = useGuideTarget(HABITS_GUIDE_TARGETS.icons, isGuided);
  const addStepTarget = useGuideTarget(HABITS_GUIDE_TARGETS.addStep, isGuided);
  const habitSaveTarget = useGuideTarget(HABITS_GUIDE_TARGETS.habitSave, isGuided);
  const [name, setName] = useState('');
  const [color, setColor] = useState(HABIT_COLORS[0]);
  const [icon, setIcon] = useState<HabitEmojiName>(HABIT_ICONS[0]);
  const [iconExpanded, setIconExpanded] = useState(false);
  const [steps, setSteps] = useState<HabitStep[]>([]);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editStep, setEditStep] = useState<HabitStep | null>(null);
  const [habitIconGridWidth, setHabitIconGridWidth] = useState(0);
  const [pendingDeleteStep, setPendingDeleteStep] = useState<HabitStep | null>(null);
  const [pendingNoSteps, setPendingNoSteps] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!visible) return;
    setIconExpanded(false);
    submittingRef.current = false;
    setSubmitting(false);
    setPendingNoSteps(false);
    if (editHabit) {
      setName(editHabit.name);
      setColor(editHabit.color);
      // Map any stored icon (legacy emoji glyph or current Noto name) to a
      // valid HabitEmojiName so the picker always shows the right selection.
      setIcon(normalizeHabitIcon(editHabit.icon));
      setSteps(editHabit.steps);
      setPendingDeleteStep(null);
      return;
    }
    setName('');
    setColor(HABIT_COLORS[0]);
    setIcon(HABIT_ICONS[0]);
    setSteps([]);
    setEditStep(null);
    setPendingDeleteStep(null);
  }, [editHabit, visible]);

  useEffect(() => {
    if (!isGuided || !visible) return;
    if (guidePhase === 'name') {
      setPresentation({
        key: 'habits-name',
        targetId: HABITS_GUIDE_TARGETS.name,
        placement: 'above',
        allowTargetInteraction: true,
        message: 'Name the habit you want to practice. Tap Done when it feels clear.',
      });
      return;
    }
    if (guidePhase === 'color') {
      setPresentation({
        key: 'habits-color',
        targetId: HABITS_GUIDE_TARGETS.colors,
        placement: 'above',
        allowTargetInteraction: true,
        message: 'Give it a color. A clear visual language makes your routine easier to scan.',
      });
      return;
    }
    if (guidePhase === 'icon') {
      setPresentation({
        key: 'habits-icon',
        targetId: HABITS_GUIDE_TARGETS.icons,
        cutoutPadding: 5,
        placement: 'above',
        allowTargetInteraction: true,
        message: 'Choose an icon that feels natural for this habit.',
      });
      return;
    }
    if (guidePhase === 'step') {
      setPresentation({
        key: 'habits-step',
        targetId: HABITS_GUIDE_TARGETS.addStep,
        placement: 'above',
        allowTargetInteraction: true,
        message: 'Now make it practical. Add the first action that will appear in your day.',
      });
      return;
    }
    if (guidePhase === 'habitSave') {
      setPresentation({
        key: 'habits-save',
        targetId: HABITS_GUIDE_TARGETS.habitSave,
        placement: 'below',
        allowTargetInteraction: true,
        message: 'Your habit has a clear action and schedule. Save it.',
      });
    }
  }, [guidePhase, isGuided, setPresentation, visible]);

  useEffect(() => {
    if (!isGuided || !visible) return;
    const positions: Record<string, number> = {
      name: 0,
      color: 100,
      icon: 205,
      step: 690,
      habitSave: 0,
    };
    const y = positions[guidePhase];
    if (y === undefined) return;
    let measureTimer: ReturnType<typeof setTimeout> | undefined;
    const scrollTimer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y, animated: true });
      measureTimer = setTimeout(() => {
        nameTarget.measure();
        colorsTarget.measure();
        iconsTarget.measure();
        addStepTarget.measure();
        habitSaveTarget.measure();
      }, 360);
    }, 120);
    return () => {
      clearTimeout(scrollTimer);
      if (measureTimer) clearTimeout(measureTimer);
    };
  }, [
    addStepTarget,
    colorsTarget,
    guidePhase,
    habitSaveTarget,
    iconsTarget,
    isGuided,
    nameTarget,
    visible,
  ]);

  if (!visible) return null;

  const habitIconGap = 8;
  const habitIconChipSize = habitIconGridWidth > 0
    ? Math.max(42, Math.min(58, Math.floor((habitIconGridWidth - habitIconGap * 4) / 5)))
    : 50;

  // The task editor and confirm dialog are rendered as overlayChildren of
  // the outer sheet so they share the same Modal — iOS UIKit refuses to
  // present a second Modal on top of an already-shown one, which silently
  // broke "+ Add Step" and the trash-confirm popup on iOS.
  const overlays = (
    <>
      <HabitTaskEditorSheet
        visible={taskOpen}
        step={editStep}
        accent={color}
        embedded
        guided={isGuided}
        onClose={() => { setTaskOpen(false); setEditStep(null); }}
        onSave={step => {
          setSteps(current => {
            const exists = current.some(item => item.id === step.id);
            return exists ? current.map(item => item.id === step.id ? step : item) : [...current, step];
          });
          setTaskOpen(false);
          setEditStep(null);
          if (isGuided) patchSession({ phase: 'habitSave' });
        }}
        onDelete={step => {
          setSteps(current => current.filter(item => item.id !== step.id));
          setTaskOpen(false);
          setEditStep(null);
        }}
      />
      {isGuided && <GuidedOverlayHost />}
      <ConfirmModal
        embedded
        visible={!!pendingDeleteStep}
        icon={<Trash2 s={22} c="#EF4444" />}
        iconBg="#FEF2F2"
        title="Delete Step"
        body={pendingDeleteStep ? `"${pendingDeleteStep.title}" will be removed from this habit.` : ''}
        confirmLabel="DELETE"
        confirmColor="#EF4444"
        onCancel={() => setPendingDeleteStep(null)}
        onConfirm={() => {
          if (pendingDeleteStep) {
            setSteps(current => current.filter(item => item.id !== pendingDeleteStep.id));
          }
          setPendingDeleteStep(null);
        }}
      />
      <ConfirmModal
        embedded
        visible={pendingNoSteps}
        icon={<Target s={22} c={color} w={2.2} />}
        iconBg={hexToRgba(color, 0.12)}
        title="Add at least one step"
        body="A habit is the rhythm you want to build. Steps are the concrete actions that appear on Home and help you practice it."
        cancelLabel="CLOSE"
        confirmLabel="ADD STEP"
        confirmColor={color}
        onCancel={() => setPendingNoSteps(false)}
        onConfirm={() => {
          setPendingNoSteps(false);
          setEditStep(null);
          setTaskOpen(true);
        }}
      />
    </>
  );

  return (
    <>
      <SmoothBottomSheet visible={visible} onClose={onClose} sheetStyle={s.sheet} keyboardAware overlayChildren={overlays}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHead}>
              <TouchableOpacity onPress={onClose} style={s.sheetHeadBtn} activeOpacity={0.7}>
                <X s={18} c="#9CA3AF" />
              </TouchableOpacity>
              <View style={{ alignItems: 'center' }}>
                <Text style={s.sheetKicker}>{editHabit ? 'Edit Habit' : 'Create Habit'}</Text>
                <Text style={s.sheetTitle}>Habit Builder</Text>
              </View>
              <TouchableOpacity
                ref={habitSaveTarget.ref}
                onLayout={habitSaveTarget.onLayout}
                onPress={() => {
                  if (submittingRef.current) return;
                  if (steps.length === 0) {
                    setPendingNoSteps(true);
                    return;
                  }
                  if (!name.trim()) return;
                  submittingRef.current = true;
                  setSubmitting(true);
                  void Promise.resolve(onSave({
                    id: editHabit?.id ?? `habit_${Date.now()}`,
                    name: name.trim(),
                    color,
                    icon,
                    active: editHabit?.active ?? true,
                    steps,
                  }))
                    .catch(error => {
                      console.warn('Failed to save habit:', error);
                    })
                    .finally(() => {
                      submittingRef.current = false;
                      setSubmitting(false);
                    });
                }}
                disabled={submitting}
                style={[s.sheetHeadBtn, s.sheetSave, submitting && s.sheetSaveDisabled]}
                activeOpacity={0.84}
              >
                <CheckSmall s={16} c="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView ref={scrollRef} contentContainerStyle={s.sheetContent} showsVerticalScrollIndicator={false}>
              <View style={[s.previewCard, { backgroundColor: hexToRgba(color, 0.08) }]}>
                <View style={[s.previewIconWrap, { backgroundColor: hexToRgba(color, 0.16) }]}>
                  <NotoEmoji name={icon} size={28} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.previewTitle}>{name.trim() || 'Your new habit'}</Text>
                  <Text style={s.previewSubtitle}>
                    {steps.length === 0 ? 'Add a name, choose a look, then add steps.' : `${steps.length} ${steps.length === 1 ? 'step' : 'steps'} ready`}
                  </Text>
                </View>
              </View>

              <View style={s.sheetBlock}>
                <Text style={s.sheetBlockLabel}>Habit Name</Text>
                <TextInput
                  ref={nameTarget.ref}
                  onLayout={nameTarget.onLayout}
                  value={name}
                  onChangeText={setName}
                  placeholder="Name this habit..."
                  placeholderTextColor="#D1D5DB"
                  style={s.sheetInput}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (isGuided && name.trim()) patchSession({ phase: 'color' });
                  }}
                />
              </View>

              <View style={s.sheetBlock}>
                <Text style={s.sheetBlockLabel}>Color</Text>
                <View ref={colorsTarget.ref} onLayout={colorsTarget.onLayout} style={s.colorRow}>
                  {HABIT_COLORS.map(item => {
                    const active = color === item;
                    return (
                      <TouchableOpacity
                        key={item}
                        onPress={() => {
                          setColor(item);
                          if (isGuided && guidePhase === 'color') patchSession({ phase: 'icon' });
                        }}
                        activeOpacity={0.85}
                        hitSlop={4}
                        style={[s.colorRing, active && { borderColor: item }]}
                      >
                        <View style={[s.colorDot, { backgroundColor: item }, active && s.colorDotActive]}>
                          {active && <CheckSmall s={14} c="#FFFFFF" w={3} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={s.sheetBlock}>
                <Text style={s.sheetBlockLabel}>Icon</Text>
                {(() => {
                  const COLLAPSED = 25; // 5 rows x 5 chips
                  const total = HABIT_ICONS.length;
                  const hasMore = total > COLLAPSED;
                  let visibleIcons = iconExpanded ? HABIT_ICONS : HABIT_ICONS.slice(0, COLLAPSED);
                  if (!iconExpanded && hasMore && !visibleIcons.includes(icon)) {
                    // Always keep the currently selected icon visible even when collapsed.
                    visibleIcons = [icon, ...visibleIcons.slice(0, COLLAPSED - 1)];
                  }
                  return (
                    <>
                      <View
                        ref={iconsTarget.ref}
                        style={s.iconGrid}
                        onLayout={event => {
                          setHabitIconGridWidth(event.nativeEvent.layout.width);
                          iconsTarget.onLayout(event);
                        }}
                      >
                        {visibleIcons.map(item => {
                          const active = icon === item;
                          return (
                            <TouchableOpacity
                              key={item}
                              onPress={() => {
                                setIcon(item);
                                if (isGuided && guidePhase === 'icon') patchSession({ phase: 'step' });
                              }}
                              accessibilityRole="button"
                              accessibilityState={{ selected: active }}
                              activeOpacity={0.84}
                              style={[
                                s.iconChip,
                                { width: habitIconChipSize, height: habitIconChipSize },
                                active && s.iconChipActive,
                                active && { borderColor: color, backgroundColor: hexToRgba(color, 0.12), shadowColor: color },
                              ]}
                            >
                              <View style={s.iconGlyphBox}>
                                <NotoEmoji name={item} size={29} />
                              </View>
                              {active && (
                                <View pointerEvents="none" style={[s.iconSelectedBadge, { backgroundColor: color }]}>
                                  <CheckSmall s={12} c="#FFFFFF" w={3} />
                                </View>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      {hasMore && (
                        <TouchableOpacity
                          onPress={() => setIconExpanded(value => !value)}
                          activeOpacity={0.7}
                          style={s.iconMoreBtn}
                        >
                          <Text style={[s.iconMoreText, { color }]}>
                            {iconExpanded ? 'Show less' : `Show more (${total - COLLAPSED})`}
                          </Text>
                          <Text style={[s.iconMoreArrow, { color, transform: [{ rotate: iconExpanded ? '180deg' : '0deg' }] }]}>›</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  );
                })()}
              </View>

              <View style={s.sheetBlock}>
                <View style={s.blockTitleCol}>
                  <Text style={s.editStepsLabel}>Steps</Text>
                  <Text style={s.editStepsHelper}>Add, edit or remove</Text>
                </View>
                <View style={s.stepDraftList}>
                  {steps.map(step => (
                    <TouchableOpacity
                      key={step.id}
                      activeOpacity={0.84}
                      onPress={() => { setEditStep(step); setTaskOpen(true); }}
                      style={[s.stepDraftCard, { borderColor: hexToRgba(color, 0.20) }]}
                    >
                      <LinearGradient
                        colors={['#FFFFFF', '#FFFFFF', hexToRgba(color, 0.10)]}
                        locations={[0, 0.55, 1]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={s.stepGradientLayer}
                        pointerEvents="none"
                      />
                      <LinearGradient
                        colors={[hexToRgba(color, 0.04), 'rgba(255,255,255,0)']}
                        locations={[0, 0.55]}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                        style={s.stepGradientLayer}
                        pointerEvents="none"
                      />
                      <View style={[s.stepCornerRibbonTop, { backgroundColor: color }]} />
                      <View style={[s.stepCornerRibbonBottom, { backgroundColor: color, opacity: 0.55 }]} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.stepDraftTitle} numberOfLines={1}>{step.title}</Text>
                        <View style={s.stepDraftMetaRow}>
                          <Text style={[s.stepDraftMetaTime, { color }]}>{step.time}</Text>
                          <Text style={s.stepDraftMetaDot}>·</Text>
                          <Text style={s.stepDraftMeta}>{getFreqLabel(step)}</Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={event => {
                          event.stopPropagation();
                          setPendingDeleteStep(step);
                        }}
                        activeOpacity={0.8}
                        hitSlop={6}
                        style={s.stepDraftDelete}
                      >
                        <Trash2 s={16} c="#EF4444" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    ref={addStepTarget.ref}
                    onLayout={addStepTarget.onLayout}
                    onPress={() => {
                      setEditStep(null);
                      setTaskOpen(true);
                      if (isGuided) patchSession({ phase: 'activity' });
                    }}
                    activeOpacity={0.7}
                    style={[s.stepDraftAddCard, { borderColor: hexToRgba(color, 0.45) }]}
                  >
                    <Plus s={16} c={color} w={2.4} />
                    <Text style={[s.stepDraftAddText, { color }]}>Add Step</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
      </SmoothBottomSheet>
    </>
  );
}

function HabitTaskEditorSheet({
  visible,
  step,
  accent,
  onClose,
  onSave,
  onDelete,
  embedded = false,
  guided = false,
}: {
  visible: boolean;
  step: HabitStep | null;
  accent: string;
  onClose: () => void;
  onSave: (step: HabitStep) => void;
  onDelete?: (step: HabitStep) => void | Promise<void>;
  embedded?: boolean;
  guided?: boolean;
}) {
  const { patchSession, session, setPresentation } = useGuidedSetup();
  const isGuided = guided && session?.active === true && session.activeStep === 'buildHabits';
  const guidePhase = session?.phase ?? 'activity';
  const activityTarget = useGuideTarget(HABITS_GUIDE_TARGETS.activity, isGuided);
  const frequencyTarget = useGuideTarget(HABITS_GUIDE_TARGETS.frequency, isGuided);
  const timeTarget = useGuideTarget(HABITS_GUIDE_TARGETS.time, isGuided);
  const stepSaveTarget = useGuideTarget(HABITS_GUIDE_TARGETS.stepSave, isGuided);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('07:00');
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [monthlyDays, setMonthlyDays] = useState<number[]>([1]);
  const [sameTimeEveryDay, setSameTimeEveryDay] = useState(true);
  const [dayTimes, setDayTimes] = useState<TaskDayTimes>({});
  const [notificationMode, setNotificationMode] = useState<NotificationMode>('none');
  const [reminderMinutes, setReminderMinutes] = useState(15);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!visible) return;
    setConfirmDeleteVisible(false);
    if (step) {
      setTitle(step.title);
      setTime(step.time);
      setFrequency(step.frequency);
      setSelectedDays(step.selectedDays ?? []);
      setMonthlyDays(step.monthlyDays ?? [1]);
      setSameTimeEveryDay(step.sameTimeEveryDay ?? true);
      setDayTimes(step.dayTimes ?? {});
      setNotificationMode(step.notificationMode ?? 'none');
      setReminderMinutes(step.reminderMinutes ?? 15);
      return;
    }
    setTitle('');
    setTime('07:00');
    setFrequency('daily');
    setSelectedDays([]);
    setMonthlyDays([1]);
    setSameTimeEveryDay(true);
    setDayTimes({});
    setNotificationMode('none');
    setReminderMinutes(15);
  }, [step, visible]);

  useEffect(() => {
    if (!isGuided || !visible) return;
    if (guidePhase === 'activity') {
      setPresentation({
        key: 'habits-activity',
        targetId: HABITS_GUIDE_TARGETS.activity,
        placement: 'above',
        allowTargetInteraction: true,
        message: 'What action will move this habit forward? Name your first step, then tap Done.',
      });
      return;
    }
    if (guidePhase === 'frequency') {
      setPresentation({
        key: 'habits-frequency',
        targetId: HABITS_GUIDE_TARGETS.frequency,
        placement: 'above',
        allowTargetInteraction: true,
        message: 'Choose how often this action belongs in your week.',
        ctaLabel: 'USE THIS SCHEDULE',
        onCta: () => patchSession({ phase: 'time' }),
      });
      return;
    }
    if (guidePhase === 'time') {
      setPresentation({
        key: 'habits-time',
        targetId: HABITS_GUIDE_TARGETS.time,
        placement: 'above',
        allowTargetInteraction: true,
        message: 'Give it a time. Your routine becomes easier to follow when it has a place.',
        ctaLabel: 'USE THIS TIME',
        onCta: () => patchSession({ phase: 'stepSave' }),
      });
      return;
    }
    if (guidePhase === 'stepSave') {
      setPresentation({
        key: 'habits-step-save',
        targetId: HABITS_GUIDE_TARGETS.stepSave,
        placement: 'below',
        allowTargetInteraction: true,
        message: 'Save this action and return to your habit.',
      });
    }
  }, [guidePhase, isGuided, patchSession, setPresentation, visible]);

  useEffect(() => {
    if (!isGuided || !visible) return;
    const positions: Record<string, number> = {
      activity: 0,
      frequency: 80,
      time: 300,
      stepSave: 0,
    };
    const y = positions[guidePhase];
    if (y === undefined) return;
    let measureTimer: ReturnType<typeof setTimeout> | undefined;
    const scrollTimer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y, animated: true });
      measureTimer = setTimeout(() => {
        activityTarget.measure();
        frequencyTarget.measure();
        timeTarget.measure();
        stepSaveTarget.measure();
      }, 360);
    }, 120);
    return () => {
      clearTimeout(scrollTimer);
      if (measureTimer) clearTimeout(measureTimer);
    };
  }, [
    activityTarget,
    frequencyTarget,
    guidePhase,
    isGuided,
    stepSaveTarget,
    timeTarget,
    visible,
  ]);

  const activeDayIndexes = useMemo(
    () => getActiveDayIndexes(frequency, selectedDays),
    [frequency, selectedDays],
  );
  const allowPerDayTimes = frequency !== 'monthly' && (frequency !== 'specific_days' || selectedDays.length > 0);
  const canDelete = !!step && !!onDelete;
  const canSave = title.trim().length > 0
    && (frequency !== 'specific_days' || selectedDays.length > 0)
    && (frequency !== 'monthly' || monthlyDays.length > 0);

  const saveStep = () => {
    if (!canSave) return;
    onSave({
      id: step?.id ?? `step_${Date.now()}`,
      title: title.trim(),
      time,
      frequency,
      selectedDays: frequency === 'specific_days' ? selectedDays : undefined,
      monthlyDays: frequency === 'monthly' ? monthlyDays : undefined,
      sameTimeEveryDay: allowPerDayTimes ? sameTimeEveryDay : true,
      dayTimes: allowPerDayTimes && !sameTimeEveryDay ? dayTimes : undefined,
      notificationMode,
      reminderMinutes: notificationMode === 'double' ? reminderMinutes : 15,
      completedToday: step?.completedToday ?? false,
      skippedToday: step?.skippedToday ?? false,
      currentStreak: step?.currentStreak ?? 0,
      bestStreak: step?.bestStreak ?? 0,
      completionRate: step?.completionRate ?? 70,
    });
  };

  if (!visible) return null;

  const deleteConfirmOverlay = canDelete ? (
    <ConfirmModal
      embedded
      visible={confirmDeleteVisible}
      icon={<Trash2 s={22} c="#EF4444" />}
      iconBg="#FEF2F2"
      title="Delete Step?"
      body={step ? `"${step.title}" will be removed from this habit.` : ''}
      confirmLabel="DELETE"
      confirmColor="#EF4444"
      onCancel={() => setConfirmDeleteVisible(false)}
      onConfirm={() => {
        if (!step || !onDelete) return;
        setConfirmDeleteVisible(false);
        void Promise.resolve(onDelete(step)).catch(error => {
          console.warn('Habit step delete failed:', error);
        });
      }}
    />
  ) : null;

  return (
    <SmoothBottomSheet
      visible={visible}
      onClose={onClose}
      sheetStyle={s.taskBottomSheet}
      keyboardAware
      embedded={embedded}
      overlayChildren={deleteConfirmOverlay}
    >
      <View style={s.sheetHandle} />
      <View style={s.sheetHead}>
        <TouchableOpacity onPress={onClose} style={s.sheetHeadBtn} activeOpacity={0.7}>
          <X s={18} c="#9CA3AF" />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={s.sheetKicker}>{step ? 'Edit Step' : 'New Step'}</Text>
          <Text style={s.sheetTitle}>Habit Schedule</Text>
        </View>
        <TouchableOpacity
          ref={stepSaveTarget.ref}
          onLayout={stepSaveTarget.onLayout}
          onPress={saveStep}
          disabled={!canSave}
          style={[s.sheetHeadBtn, s.sheetSave, { backgroundColor: accent, opacity: canSave ? 1 : 0.38 }]}
          activeOpacity={0.84}
        >
          <CheckSmall s={16} c="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={s.taskContent} showsVerticalScrollIndicator={false}>
        <View style={s.sheetBlock}>
          <Text style={[s.sheetBlockLabel, { color: accent }]}>Activity Name</Text>
          <TextInput
            ref={activityTarget.ref}
            onLayout={activityTarget.onLayout}
            value={title}
            onChangeText={setTitle}
            placeholder="Step name..."
            placeholderTextColor="#D1D5DB"
            style={s.sheetInput}
            returnKeyType="done"
            onSubmitEditing={() => {
              if (isGuided && title.trim()) patchSession({ phase: 'frequency' });
            }}
          />
        </View>

        <View ref={frequencyTarget.ref} onLayout={frequencyTarget.onLayout} style={s.sheetBlock}>
          <TaskFrequencyEditor
            frequency={frequency}
            selectedDays={selectedDays}
            monthlyDays={monthlyDays}
            onFrequencyChange={nextFrequency => {
              setFrequency(nextFrequency);
              if (nextFrequency === 'weekdays') setSelectedDays([0, 1, 2, 3, 4]);
              if (nextFrequency === 'weekends') setSelectedDays([5, 6]);
              if (nextFrequency === 'daily') setSelectedDays([]);
              if (nextFrequency === 'monthly') setSameTimeEveryDay(true);
            }}
            onSelectedDaysChange={setSelectedDays}
            onMonthlyDaysChange={setMonthlyDays}
            accent={accent}
            label="Schedule"
          />
        </View>

        <View ref={timeTarget.ref} onLayout={timeTarget.onLayout} style={s.sheetBlock}>
          <TaskTimeEditor
            time={time}
            sameTimeEveryDay={sameTimeEveryDay}
            dayTimes={dayTimes}
            onTimeChange={setTime}
            onSameTimeEveryDayChange={setSameTimeEveryDay}
            onDayTimesChange={setDayTimes}
            activeDayIndexes={activeDayIndexes}
            allowPerDayTimes={allowPerDayTimes}
            accent={accent}
            softBg={hexToRgba(accent, 0.06)}
            borderColor={hexToRgba(accent, 0.22)}
            mutedColor="#8B909A"
          />
        </View>

        <View style={s.sheetBlock}>
          <NotificationSettings
            mode={notificationMode}
            reminderMinutes={reminderMinutes}
            onModeChange={setNotificationMode}
            onReminderChange={setReminderMinutes}
            accent={accent}
          />
        </View>

        <TouchableOpacity
          onPress={saveStep}
          disabled={!canSave}
          activeOpacity={0.86}
          style={[s.taskSaveBtn, { backgroundColor: accent, opacity: canSave ? 1 : 0.38, shadowColor: accent }]}
        >
          <Text style={s.taskSaveText}>SAVE CHANGES</Text>
        </TouchableOpacity>

        {canDelete && (
          <TouchableOpacity
            onPress={() => setConfirmDeleteVisible(true)}
            activeOpacity={0.84}
            style={s.taskDeleteBtn}
          >
            <Trash2 s={16} c="#EF4444" />
            <Text style={s.taskDeleteText}>DELETE STEP</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SmoothBottomSheet>
  );
}

function HabitAnalyticsSheet({
  habit,
  onClose,
  onOpenStep,
}: {
  habit: HabitItem | null;
  onClose: () => void;
  onOpenStep: (step: HabitStep) => void;
}) {
  if (!habit) return null;

  const todayStr = getLocalDateKey();
  const perStepWindow = habit.steps.map(step => computeStepWindowStats(step, todayStr));
  const aggregated = aggregateWindowStats(perStepWindow);
  const overallPct = aggregated.allTime.pct;
  const bestStep = [...habit.steps].sort((a, b) => b.completionRate - a.completionRate)[0];
  const worstStep = [...habit.steps].sort((a, b) => a.completionRate - b.completionRate)[0];

  return (
    <SmoothBottomSheet visible={!!habit} onClose={onClose} sheetStyle={s.analyticsSheet}>
          <View style={s.sheetHandle} />
          <View style={s.analyticsHead}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[s.iconCircle, { backgroundColor: hexToRgba(habit.color, 0.12), width: 42, height: 42, borderRadius: 16 }]}>
                <NotoEmoji name={normalizeHabitIcon(habit.icon)} size={26} />
              </View>
              <Text style={s.analyticsTitle}>{habit.name}</Text>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.84} style={s.taskClose}>
              <X s={18} c="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.analyticsContent} showsVerticalScrollIndicator={false}>
            <View style={[s.analyticsHero, { backgroundColor: hexToRgba(habit.color, 0.1) }]}>
              <Text style={[s.analyticsPct, { color: habit.color }]}>{overallPct}%</Text>
              <Text style={s.analyticsHeroLabel}>OVERALL CONSISTENCY</Text>
            </View>

            <View style={s.analyticsStatRow}>
              <AnalyticsStatCard label="This Week" value={`${aggregated.thisWeek.pct}%`} accent={habit.color} />
              <AnalyticsStatCard label="This Month" value={`${aggregated.thisMonth.pct}%`} accent={habit.color} />
              <AnalyticsStatCard label="All Time" value={`${aggregated.allTime.pct}%`} accent={habit.color} />
            </View>

            {bestStep && worstStep && habit.steps.length > 1 && (
              <View style={s.analyticsPair}>
                <View style={s.analyticsBest}>
                  <Text style={s.analyticsMiniKicker}>BEST PERFORMING</Text>
                  <Text style={s.analyticsMiniTitle}>{bestStep.title}</Text>
                  <Text style={s.analyticsMiniPct}>{bestStep.completionRate}%</Text>
                </View>
                <View style={s.analyticsWorst}>
                  <Text style={s.analyticsMiniKicker}>WORST PERFORMING</Text>
                  <Text style={s.analyticsMiniTitle}>{worstStep.title}</Text>
                  <Text style={[s.analyticsMiniPct, { color: '#EF4444' }]}>{worstStep.completionRate}%</Text>
                </View>
              </View>
            )}

            <Text style={s.breakdownLabel}>TASK BREAKDOWN</Text>
            <View style={s.breakdownList}>
              {habit.steps.map(step => (
                <TouchableOpacity key={step.id} onPress={() => onOpenStep(step)} activeOpacity={0.84} style={s.breakdownCard}>
                  <View style={s.breakdownHead}>
                    <Text style={s.breakdownTitle}>{step.title}</Text>
                    <View style={s.breakdownMeta}>
                      {step.currentStreak > 0 && (
                        <View style={s.breakdownStreak}>
                          <Flame s={10} color={habit.color} filled />
                          <Text style={[s.breakdownStreakText, { color: habit.color }]}>{step.currentStreak}</Text>
                        </View>
                      )}
                      <Text style={[s.breakdownPct, { color: habit.color }]}>{step.completionRate}%</Text>
                    </View>
                  </View>
                  <View style={s.breakdownBar}>
                    <View style={[s.breakdownFill, { width: `${step.completionRate}%`, backgroundColor: habit.color }]} />
                  </View>
                  <Text style={s.breakdownFooter}>{step.time} / {getFreqLabel(step)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
    </SmoothBottomSheet>
  );
}

function AnalyticsStatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={s.analyticsStatCard}>
      <Text style={s.analyticsStatLabel}>{label}</Text>
      <Text style={[s.analyticsStatValue, { color: accent }]}>{value}</Text>
    </View>
  );
}

function TaskDetailSheet({
  detail,
  onClose,
}: {
  detail: { habit: HabitItem; step: HabitStep } | null;
  onClose: () => void;
}) {
  if (!detail) return null;

  const { habit, step } = detail;
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const seed = buildCalendarSeed(step);
  const todayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const stepWindow = computeStepWindowStats(step, todayStr);

  const cells: (number | null)[] = [];
  for (let index = 0; index < (firstDay === 0 ? 6 : firstDay - 1); index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);

  return (
    <SmoothBottomSheet visible={!!detail} onClose={onClose} sheetStyle={s.analyticsSheet}>
          <View style={s.sheetHandle} />
          <View style={s.analyticsHead}>
            <View style={{ flex: 1 }}>
              <Text style={s.analyticsTitle}>{step.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <NotoEmoji name={normalizeHabitIcon(habit.icon)} size={14} />
                <Text style={s.analyticsMeta}>{habit.name}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.84} style={s.taskClose}>
              <X s={18} c="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.analyticsContent} showsVerticalScrollIndicator={false}>
            <View style={s.streakRow}>
              <View style={s.streakCard}>
                <Text style={[s.streakValue, { color: habit.color }]}>{step.currentStreak}</Text>
                <Text style={s.streakLabel}>CURRENT STREAK</Text>
              </View>
              <View style={s.streakCard}>
                <Text style={s.streakValueMuted}>{step.bestStreak}</Text>
                <Text style={s.streakLabel}>BEST STREAK</Text>
              </View>
            </View>

            <View style={s.consistencyCard}>
              <View style={s.consistencyHead}>
                <Target s={14} c={habit.color} />
                <Text style={s.breakdownLabel}>CONSISTENCY</Text>
              </View>
              <ConsistencyRow label="This Week" pct={stepWindow.thisWeek.pct} color={habit.color} />
              <ConsistencyRow label="This Month" pct={stepWindow.thisMonth.pct} color={habit.color} />
              <ConsistencyRow label="Since Start" pct={stepWindow.allTime.pct} color={habit.color} />
            </View>

            <View style={s.calendarCard}>
              <View style={s.consistencyHead}>
                <Calendar s={14} c={habit.color} />
                <Text style={s.breakdownLabel}>{today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()}</Text>
              </View>
              <View style={s.calendarWeekRow}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(label => (
                  <Text key={label} style={s.calendarWeekLabel}>{label}</Text>
                ))}
              </View>
              <View style={s.calendarGrid}>
                {cells.map((day, index) => {
                  if (day === null) return <View key={`empty-${index}`} style={s.calendarCell} />;
                  const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const done = seed.done.has(dateKey);
                  const skipped = seed.skipped.has(dateKey);
                  const missed = seed.missed.has(dateKey);
                  const isToday = dateKey === todayStr;
                  return (
                    <View
                      key={dateKey}
                      style={[
                        s.calendarCell,
                        done && { backgroundColor: hexToRgba(habit.color, 0.14), borderColor: hexToRgba(habit.color, 0.24), borderWidth: 1 },
                        skipped && s.calendarCellSkipped,
                        missed && s.calendarCellMissed,
                        isToday && !done && !skipped && !missed && { borderWidth: 1.5, borderColor: habit.color },
                      ]}
                    >
                      {done ? <Flame s={11} color={habit.color} filled /> : <Text style={[s.calendarCellText, (skipped || missed) && s.calendarCellTextDim]}>{day}</Text>}
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>
    </SmoothBottomSheet>
  );
}

function ConsistencyRow({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <View style={s.consistencyRow}>
      <Text style={s.consistencyLabel}>{label}</Text>
      <View style={s.consistencyBar}>
        <View style={[s.consistencyFill, { width: `${Math.max(pct, 4)}%`, backgroundColor: color, opacity: pct >= 80 ? 1 : pct >= 50 ? 0.7 : 0.35 }]} />
      </View>
      <Text style={s.consistencyPct}>{pct}%</Text>
    </View>
  );
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const safe = normalized.length === 3 ? normalized.split('').map(char => `${char}${char}`).join('') : normalized;
  const parsed = Number.parseInt(safe, 16);
  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAFA' },
  headerBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 130 },
  tabBar: {
    position: 'relative',
    flexDirection: 'row',
    minHeight: 46,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.07)',
    backgroundColor: '#EDE6D6',
    padding: 4,
    gap: 4,
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  tab: { flex: 1, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, zIndex: 1 },
  tabText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2.2, color: '#A8A29E', textTransform: 'uppercase' },
  tabTextActive: { color: C.gold },
  helperText: { marginTop: 12, paddingHorizontal: 4, fontFamily: F.serif, fontSize: 14, lineHeight: 20, color: '#A8A29E' },
  habitList: { gap: 14, paddingTop: 14 },
  habitCard: { borderRadius: 28, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0EDE6', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 6 }, shadowRadius: 18, elevation: 2 },
  habitHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
  iconCircle: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  iconEmoji: { fontSize: 22 },
  habitTitleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' },
  habitTitle: { flex: 1, fontFamily: F.serifMedium, fontSize: 18, color: '#111827', letterSpacing: -0.1 },
  progressText: { fontFamily: F.serifMedium, fontSize: 15, letterSpacing: 0.2 },
  habitMeta: { marginTop: 3, fontFamily: F.sans, fontSize: 11, letterSpacing: 0.1, color: '#A8A29E' },
  progressBar: { marginTop: 11, height: 6, borderRadius: 999, backgroundColor: '#F3F0EA', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  chevronWrap: { marginTop: 2 },
  chevronWrapExpanded: { transform: [{ rotate: '180deg' }] },
  habitBody: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: '#FBF9F4',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(120,113,108,0.14)',
  },
  stepsContainer: { gap: 8, marginBottom: 12 },
  stepTaskCardShell: { position: 'relative' },
  stepTaskCardInactive: { opacity: 0.72 },
  stepTaskEditBtn: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(168,162,158,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  stepTaskFlourish: { left: 4, top: 0, bottom: 6, width: 52 },
  stepCard: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    overflow: 'hidden',
    shadowColor: '#1C1917',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  stepCardDim: { opacity: 0.55 },
  stepCardSkipped: { opacity: 0.7 },
  stepGradientLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  stepCornerRibbonTop: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 12,
    height: 2,
    borderRadius: 1,
  },
  stepCornerRibbonBottom: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 12,
    height: 2,
    borderRadius: 1,
  },
  stepCheckLg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.6,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepCardTitle: { fontFamily: F.serifMedium, fontSize: 16, lineHeight: 21, color: '#1C1917' },
  stepCardTitleDone: { color: '#A8A29E', textDecorationLine: 'line-through' },
  stepCardTitleSkipped: { color: '#A8A29E' },
  stepCardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  stepCardMeta: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.4, color: '#A8A29E', textTransform: 'uppercase' },
  stepCardMetaDot: { fontFamily: F.sansBold, fontSize: 11, color: '#D1D5DB', marginTop: -2 },
  stepEditBtn: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 4,
    marginLeft: 6,
  },
  stepEditLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.4, color: '#1C1917' },
  stepsEmpty: { paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center', marginBottom: 12 },
  stepsEmptyText: { fontFamily: F.serif, fontSize: 14, color: '#A8A29E', fontStyle: 'italic' },
  otherStepsBlock: { marginBottom: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(120,113,108,0.16)' },
  otherStepsLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.8, color: '#B8B0A0', marginBottom: 8, paddingHorizontal: 4 },
  otherStepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 6, paddingVertical: 6 },
  otherStepDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  otherStepTitle: { flex: 1, fontFamily: F.serif, fontSize: 14, color: '#78716C' },
  otherStepMeta: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.4, color: '#B8B0A0', textTransform: 'uppercase' },
  actionGrid: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionBtn: { flex: 1, minHeight: 60, borderRadius: 18, backgroundColor: '#F5F5F4', alignItems: 'center', justifyContent: 'center', gap: 4 },
  actionBtnFilled: { backgroundColor: C.gold },
  actionBtnDanger: { backgroundColor: '#FEF2F2' },
  actionBtnText: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.2, color: '#6B7280', textTransform: 'uppercase' },
  actionBtnTextFilled: { color: '#FFFFFF' },
  actionBtnTextDanger: { color: '#DC2626' },
  emptyCard: { marginTop: 12, borderRadius: 26, borderWidth: 1, borderStyle: 'dashed', borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', paddingVertical: 44, paddingHorizontal: 26, alignItems: 'center' },
  emptyTitle: { fontFamily: F.serifMediumItalic, fontSize: 22, color: '#9CA3AF', textAlign: 'center' },
  emptyBody: { marginTop: 8, fontFamily: F.sans, fontSize: 12, color: '#D1D5DB', textAlign: 'center' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.34)' },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.34)' },
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: '#FAFAFA', paddingBottom: 28, maxHeight: '88%' },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F4' },
  sheetHeadBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sheetSave: { backgroundColor: C.gold },
  sheetSaveDisabled: { opacity: 0.45 },
  sheetKicker: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: C.textMuted, textTransform: 'uppercase' },
  sheetTitle: { fontFamily: F.serifMedium, fontSize: 19, color: C.text, marginTop: 2 },
  sheetContent: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 12, gap: 16 },
  previewCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#F0EDE6' },
  previewIconWrap: { width: 50, height: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  previewIcon: { fontSize: 24 },
  previewTitle: { fontFamily: F.serifMedium, fontSize: 18, color: '#111827' },
  previewSubtitle: { marginTop: 3, fontFamily: F.sans, fontSize: 11, color: '#9CA3AF' },
  sheetBlock: { borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F2F1EC', padding: 18 },
  sheetBlockLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: C.gold, textTransform: 'uppercase', marginBottom: 12 },
  editStepsLabel: { fontFamily: F.serifMedium, fontSize: 17, color: '#1C1917', letterSpacing: 0.2 },
  sheetInput: { minHeight: 52, borderRadius: 18, backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#F2F1EC', paddingHorizontal: 16, fontFamily: F.serif, fontSize: 22, color: '#111827' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotActive: {
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 3,
  },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 10 },
  iconChip: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    shadowColor: '#8C7A4F',
    shadowOpacity: 0.035,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 1,
  },
  iconChipActive: {
    borderWidth: 2,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 11,
    elevation: 4,
  },
  iconGlyphBox: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  iconSelectedBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChipText: { fontSize: 26, textAlign: 'center', includeFontPadding: false, marginTop: -3 },
  iconMoreBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, alignSelf: 'flex-start' },
  iconMoreText: { fontFamily: F.sansSemiBold, fontSize: 12, letterSpacing: 0.4 },
  iconMoreArrow: { fontFamily: F.serifMedium, fontSize: 18, lineHeight: 18 },
  blockTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  blockTitleCol: { marginBottom: 12, gap: 3 },
  editStepsHelper: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.4, color: '#A8A29E', textTransform: 'uppercase' },
  addStepBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 28, borderRadius: 14, paddingHorizontal: 10, backgroundColor: '#F8F5ED' },
  addStepText: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.4, textTransform: 'uppercase' },
  stepDraftList: { gap: 10 },
  stepDraftCard: {
    position: 'relative',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
    shadowColor: '#1C1917',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  stepDraftTitle: { fontFamily: F.serifMedium, fontSize: 16, lineHeight: 21, color: '#1C1917' },
  stepDraftMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  stepDraftMetaTime: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.4, textTransform: 'uppercase' },
  stepDraftMetaDot: { fontFamily: F.sansBold, fontSize: 11, color: '#D1D5DB', marginTop: -2 },
  stepDraftMeta: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.4, color: '#A8A29E', textTransform: 'uppercase' },
  stepDraftDelete: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepDraftAddCard: {
    minHeight: 60,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stepDraftAddText: { fontFamily: F.serifMedium, fontSize: 15, letterSpacing: 0.2 },
  addHabitCard: {
    marginTop: 14,
    minHeight: 60,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addHabitText: { fontFamily: F.serifMedium, fontSize: 15, letterSpacing: 0.2, color: C.gold },
  addStepCard: {
    marginTop: 4,
    marginBottom: 12,
    height: 40,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addStepCardText: { fontFamily: F.serifMedium, fontSize: 13, letterSpacing: 0.2 },
  taskBottomSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: '#FAFAFA', paddingBottom: 22, maxHeight: '90%' },
  taskContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 14 },
  taskSheet: { width: '100%', maxWidth: 360, borderRadius: 28, backgroundColor: '#FFFFFF', padding: 22 },
  taskSheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  taskSheetTitle: { fontFamily: F.serifMedium, fontSize: 24, color: '#111827' },
  taskClose: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F8F8FA', alignItems: 'center', justifyContent: 'center' },
  frequencyWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  frequencyChip: { minHeight: 34, borderRadius: 17, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  frequencyChipActive: { backgroundColor: '#F8F5ED', borderColor: '#E8DCC4' },
  frequencyText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.3, color: '#9CA3AF', textTransform: 'uppercase' },
  daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  dayChipText: { fontFamily: F.sansBold, fontSize: 11, color: '#A8A29E' },
  taskSaveBtn: { minHeight: 50, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  taskSaveText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2, color: '#FFFFFF' },
  taskDeleteBtn: {
    minHeight: 50,
    borderRadius: 22,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  taskDeleteText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.7, color: '#EF4444' },
  applySheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: '#FFFFFF', paddingHorizontal: 22, paddingBottom: 28 },
  applyTitle: { marginTop: 4, fontFamily: F.serifMedium, fontSize: 24, color: '#111827', textAlign: 'center' },
  applyBody: { marginTop: 8, fontFamily: F.serif, fontSize: 16, lineHeight: 22, color: '#9CA3AF', textAlign: 'center' },
  applyOptions: { gap: 10, marginTop: 20 },
  applyOption: { borderRadius: 22, borderWidth: 1, borderColor: '#F0EDE6', backgroundColor: '#FAFAFA', padding: 16 },
  applyOptionTitle: { fontFamily: F.serifMedium, fontSize: 19, color: '#111827' },
  applyOptionBody: { marginTop: 4, fontFamily: F.sans, fontSize: 12, color: '#9CA3AF' },
  analyticsSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: '#FFFFFF', paddingBottom: 28, maxHeight: '88%' },
  analyticsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F4' },
  analyticsTitle: { fontFamily: F.serifMedium, fontSize: 22, color: '#111827' },
  analyticsMeta: { marginTop: 3, fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.4, color: '#9CA3AF', textTransform: 'uppercase' },
  analyticsContent: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 18, gap: 16 },
  analyticsHero: { borderRadius: 26, paddingVertical: 22, alignItems: 'center' },
  analyticsPct: { fontFamily: F.serifMedium, fontSize: 42, lineHeight: 44 },
  analyticsHeroLabel: { marginTop: 6, fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: '#A8A29E' },
  analyticsStatRow: { flexDirection: 'row', gap: 10 },
  analyticsStatCard: { flex: 1, borderRadius: 20, borderWidth: 1, borderColor: '#F0EDE6', backgroundColor: '#FFFFFF', alignItems: 'center', paddingVertical: 14 },
  analyticsStatLabel: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.5, color: '#A8A29E', textTransform: 'uppercase' },
  analyticsStatValue: { marginTop: 6, fontFamily: F.serifMedium, fontSize: 22 },
  analyticsPair: { gap: 10 },
  analyticsBest: { borderRadius: 20, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#DCFCE7', padding: 16 },
  analyticsWorst: { borderRadius: 20, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FEE2E2', padding: 16 },
  analyticsMiniKicker: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.6, color: '#A8A29E', textTransform: 'uppercase' },
  analyticsMiniTitle: { marginTop: 4, fontFamily: F.serifMedium, fontSize: 18, color: '#111827' },
  analyticsMiniPct: { marginTop: 6, fontFamily: F.serifMedium, fontSize: 22, color: '#16A34A' },
  breakdownLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.8, color: '#A8A29E', textTransform: 'uppercase' },
  breakdownList: { gap: 10 },
  breakdownCard: { borderRadius: 20, borderWidth: 1, borderColor: '#F0EDE6', backgroundColor: '#FFFFFF', padding: 14 },
  breakdownHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 9 },
  breakdownTitle: { flex: 1, fontFamily: F.serifMedium, fontSize: 18, color: '#111827' },
  breakdownMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  breakdownStreak: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  breakdownStreakText: { fontFamily: F.sansBold, fontSize: 10 },
  breakdownPct: { fontFamily: F.serifMedium, fontSize: 18 },
  breakdownBar: { height: 6, borderRadius: 999, backgroundColor: '#F3F4F6', overflow: 'hidden' },
  breakdownFill: { height: '100%', borderRadius: 999 },
  breakdownFooter: { marginTop: 9, fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.3, color: '#A8A29E', textTransform: 'uppercase' },
  streakRow: { flexDirection: 'row', gap: 10 },
  streakCard: { flex: 1, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0EDE6', alignItems: 'center', paddingVertical: 18 },
  streakValue: { fontFamily: F.serifMedium, fontSize: 40, lineHeight: 42 },
  streakValueMuted: { fontFamily: F.serifMedium, fontSize: 40, lineHeight: 42, color: '#6B7280' },
  streakLabel: { marginTop: 6, fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.6, color: '#A8A29E' },
  consistencyCard: { borderRadius: 24, borderWidth: 1, borderColor: '#F0EDE6', backgroundColor: '#FFFFFF', padding: 16, gap: 12 },
  consistencyHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  consistencyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  consistencyLabel: { width: 76, fontFamily: F.serif, fontSize: 14, color: '#6B7280' },
  consistencyBar: { flex: 1, height: 6, borderRadius: 999, backgroundColor: '#F3F4F6', overflow: 'hidden' },
  consistencyFill: { height: '100%', borderRadius: 999 },
  consistencyPct: { width: 36, textAlign: 'right', fontFamily: F.sansBold, fontSize: 10, color: '#A8A29E' },
  calendarCard: { borderRadius: 24, borderWidth: 1, borderColor: '#F0EDE6', backgroundColor: '#FFFFFF', padding: 16 },
  calendarWeekRow: { flexDirection: 'row', marginTop: 14, marginBottom: 10 },
  calendarWeekLabel: { flex: 1, textAlign: 'center', fontFamily: F.sansBold, fontSize: 9, color: '#D1D5DB' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  calendarCell: { width: '13.1%', aspectRatio: 1, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  calendarCellSkipped: { borderWidth: 1.5, borderColor: '#111827' },
  calendarCellMissed: { backgroundColor: '#FEF2F2' },
  calendarCellText: { fontFamily: F.serifMedium, fontSize: 13, color: '#A8A29E' },
  calendarCellTextDim: { color: '#D1D5DB' },
});
