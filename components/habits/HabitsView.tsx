import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
  CircleIcon,
  Flame,
  Pause,
  Pencil,
  Play,
  Plus,
  Skip,
  Target,
  Trash2,
  X,
} from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { NotoEmoji } from '@/components/shared/NotoEmoji';
import { normalizeHabitIcon } from '@/components/shared/notoEmoji/legacyMap';
import type { HabitEmojiName } from '@/components/shared/notoEmoji/habits';
import { playTaskCompleteFeedback, playTaskUndoFeedback } from '@/components/shared/taskFeedback';
import { AnimatedProgressFill, AnimatedTaskRow, CompletionFlourish } from '@/components/shared/taskAnimations';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';


const HABIT_COLORS = [
  '#C5A059', // gold
  '#16A34A', // green
  '#0EA5E9', // sky blue
  '#2563EB', // royal blue
  '#7C3AED', // purple
  '#DB2777', // pink
  '#DC2626', // red
  '#EA580C', // orange
  '#0F766E', // teal
  '#475569', // slate
];
const HABIT_ICONS: HabitEmojiName[] = [
  // Spiritual (4)
  'praying-hands', 'open-book', 'candle', 'latin-cross',
  // Body & health (7)
  'droplet', 'person-running', 'person-walking', 'flexed-biceps',
  'green-salad', 'red-apple', 'shower',
  // Work, business, focus (7)
  'briefcase', 'laptop', 'chart-increasing', 'bullseye',
  'alarm-clock', 'handshake', 'money-bag',
  // Learning & creative (4)
  'writing-hand', 'books', 'light-bulb', 'artist-palette',
  // Time of day & nature (5)
  'sun', 'crescent-moon', 'sunrise', 'seedling', 'evergreen-tree',
  // Activity & motivation (3)
  'hot-beverage', 'red-heart', 'fire',
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
  return getActiveDayIndexes(step.frequency, step.selectedDays).includes(todayTaskDayIndex());
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

export default function HabitsView() {
  const {
    createOrUpdateTask,
    remove: removeTask,
    pause: pauseTask,
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

  const activeHabits = useMemo(() => habits.filter(item => item.active), [habits]);
  const pausedHabits = useMemo(() => habits.filter(item => !item.active), [habits]);
  const visibleHabits = tab === 'active' ? activeHabits : pausedHabits;

  const loadHabits = useCallback(async () => {
    const today = getLocalDateKey();
    await refreshTasks(today);
    const nextHabits = await listHabitsWithStats(today);
    setHabits(nextHabits);
  }, [refreshTasks]);

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
    await createOrUpdateTask(habitStepToTaskDraft(updatedHabit, nextStep));
    await saveHabitRecord(updatedHabit);
    await loadHabits();
  };

  const saveHabit = async (habit: HabitItem) => {
    const previous = habits.find(item => item.id === habit.id);
    const nextStepIds = new Set(habit.steps.map(step => step.id));
    if (previous) {
      await Promise.all(previous.steps
        .filter(step => !nextStepIds.has(step.id))
        .map(step => removeTask(habitStepTaskId(previous.id, step.id))));
    }
    await Promise.all(habit.steps.map(step => createOrUpdateTask(habitStepToTaskDraft(habit, step))));
    await saveHabitRecord(habit);
    await loadHabits();
    setEditorOpen(false);
    setEditTarget(null);
    setExpandedId(habit.id);
  };

  const setHabitActiveState = async (habit: HabitItem, active: boolean) => {
    await setHabitRecordActive(habit.id, active);
    if (active) {
      const nextHabit = { ...habit, active: true };
      await Promise.all(nextHabit.steps.map(step => createOrUpdateTask(habitStepToTaskDraft(nextHabit, step))));
    } else {
      await Promise.all(habit.steps.map(step => pauseTask(habitStepTaskId(habit.id, step.id))));
    }

    await loadHabits();
    setTab(active ? 'active' : 'paused');
    setExpandedId(habit.id);
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

  return (
    <View style={s.screen}>
      <ScreenTitleBar
        title="HABITS"
        showBack
        rightElement={(
          <TouchableOpacity onPress={() => { setEditTarget(null); setEditorOpen(true); }} activeOpacity={0.76} style={s.headerBtn}>
            <Plus s={24} c={C.gold} w={2.4} />
          </TouchableOpacity>
        )}
      />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <HabitTabBar
          tab={tab}
          activeCount={activeHabits.length}
          pausedCount={pausedHabits.length}
          onChange={key => { setTab(key); setExpandedId(null); }}
        />

        <Text style={s.helperText}>
          {tab === 'active'
            ? 'Active habits appear in your daily flow and can be checked off each day.'
            : 'Paused habits stay here so you can resume them whenever you want.'}
        </Text>

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
                <TouchableOpacity onPress={() => setExpandedId(current => current === habit.id ? null : habit.id)} activeOpacity={0.85} style={s.habitHead}>
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
                          const isSkipped = step.skippedToday;
                          const isResolved = step.completedToday || isSkipped;
                          const stepBaseAlpha = !habit.active ? 0 : (isResolved ? 0.04 : 0.10);
                          const stepTopAlpha = !habit.active ? 0 : (isResolved ? 0.015 : 0.04);
                          const stepAccentColor = !habit.active || isSkipped ? '#D1D5DB' : habit.color;
                          return (
                            <AnimatedTaskRow key={step.id} done={isResolved}>
                              <TouchableOpacity
                                onPress={() => habit.active && toggleStep(habit.id, step.id)}
                                activeOpacity={0.84}
                                style={[
                                  s.stepCard,
                                  { borderColor: hexToRgba(habit.color, !habit.active ? 0.10 : 0.20) },
                                  !habit.active && s.stepCardDim,
                                  isSkipped && s.stepCardSkipped,
                                ]}
                              >
                                <LinearGradient
                                  colors={['#FFFFFF', '#FFFFFF', hexToRgba(habit.color, stepBaseAlpha)]}
                                  locations={[0, 0.55, 1]}
                                  start={{ x: 0, y: 0 }}
                                  end={{ x: 1, y: 1 }}
                                  style={s.stepGradientLayer}
                                  pointerEvents="none"
                                />
                                <LinearGradient
                                  colors={[hexToRgba(habit.color, stepTopAlpha), 'rgba(255,255,255,0)']}
                                  locations={[0, 0.55]}
                                  start={{ x: 0.5, y: 0 }}
                                  end={{ x: 0.5, y: 1 }}
                                  style={s.stepGradientLayer}
                                  pointerEvents="none"
                                />
                                <View style={[s.stepCornerRibbonTop, { backgroundColor: stepAccentColor }]} />
                                <View style={[s.stepCornerRibbonBottom, { backgroundColor: stepAccentColor, opacity: 0.55 }]} />
                                <View
                                  style={[
                                    s.stepCheckLg,
                                    { borderColor: hexToRgba(habit.color, 0.45) },
                                    step.completedToday && { backgroundColor: habit.color, borderColor: habit.color },
                                    isSkipped && { backgroundColor: '#F5F5F4', borderColor: '#D6D3D1' },
                                  ]}
                                >
                                  {step.completedToday
                                    ? <CheckSmall s={16} c="#FFFFFF" />
                                    : isSkipped
                                      ? <Skip s={14} c="#A8A29E" w={2.4} />
                                      : <CircleIcon s={16} c={hexToRgba(habit.color, 0.45)} w={2} />}
                                </View>
                                <CompletionFlourish
                                  done={step.completedToday}
                                  color={habit.color}
                                  layerStyle={{ left: 14, top: 0, bottom: 0, width: 28 }}
                                />
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Text
                                    style={[
                                      s.stepCardTitle,
                                      step.completedToday && s.stepCardTitleDone,
                                      isSkipped && s.stepCardTitleSkipped,
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {step.title}
                                  </Text>
                                  <View style={s.stepCardMetaRow}>
                                    <Text style={[s.stepCardMeta, { color: habit.active && !isSkipped ? habit.color : '#A8A29E' }]}>{getStepDisplayTime(step)}</Text>
                                    <Text style={s.stepCardMetaDot}>·</Text>
                                    <Text style={s.stepCardMeta}>{getFreqLabel(step)}</Text>
                                  </View>
                                </View>
                                <TouchableOpacity
                                  onPress={e => {
                                    e.stopPropagation?.();
                                    setStepEditTarget({ habit, step });
                                  }}
                                  activeOpacity={0.7}
                                  hitSlop={8}
                                  style={s.stepEditBtn}
                                >
                                  <Pencil s={14} c="#A8A29E" w={2} />
                                  <Text style={s.stepEditLabel}>EDIT</Text>
                                </TouchableOpacity>
                              </TouchableOpacity>
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
                          {otherSteps.map(step => (
                            <View
                              key={step.id}
                              style={[
                                s.stepCard,
                                s.stepCardDim,
                                { borderColor: hexToRgba(habit.color, 0.10) },
                              ]}
                            >
                              <View
                                style={[
                                  s.stepCheckLg,
                                  { borderColor: '#E7E5E4', backgroundColor: '#FAFAF9' },
                                ]}
                              >
                                <CircleIcon s={16} c="#D6D3D1" w={2} />
                              </View>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={[s.stepCardTitle, s.stepCardTitleSkipped]} numberOfLines={1}>{step.title}</Text>
                                <View style={s.stepCardMetaRow}>
                                  <Text style={[s.stepCardMeta, { color: '#A8A29E' }]}>{getStepDisplayTime(step)}</Text>
                                  <Text style={s.stepCardMetaDot}>·</Text>
                                  <Text style={s.stepCardMeta}>{getFreqLabel(step)}</Text>
                                </View>
                              </View>
                              <TouchableOpacity
                                onPress={() => setStepEditTarget({ habit, step })}
                                activeOpacity={0.7}
                                hitSlop={8}
                                style={s.stepEditBtn}
                              >
                                <Pencil s={14} c="#A8A29E" w={2} />
                                <Text style={s.stepEditLabel}>EDIT</Text>
                              </TouchableOpacity>
                            </View>
                          ))}
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
            <Text style={s.emptyTitle}>{tab === 'active' ? 'No active habits' : 'No paused habits'}</Text>
            <Text style={s.emptyBody}>
              {tab === 'active'
                ? 'Tap + to add your first habit.'
                : 'Paused habits will appear here.'}
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={() => { setEditTarget(null); setEditorOpen(true); }}
          activeOpacity={0.7}
          style={[s.addHabitCard, { borderColor: hexToRgba(C.gold, 0.45) }]}
        >
          <Plus s={16} c={C.gold} w={2.4} />
          <Text style={s.addHabitText}>Add Habit</Text>
        </TouchableOpacity>
      </ScrollView>

      <HabitEditorSheet
        visible={editorOpen}
        editHabit={editTarget}
        onClose={() => { setEditorOpen(false); setEditTarget(null); }}
        onSave={saveHabit}
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
          if (deleteTarget) {
            await Promise.all(deleteTarget.steps.map(step => removeTask(habitStepTaskId(deleteTarget.id, step.id))));
            await archiveHabitRecord(deleteTarget.id);
            await loadHabits();
          }
          setDeleteTarget(null);
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
      />
    </View>
  );
}

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
}: {
  visible: boolean;
  editHabit: HabitItem | null;
  onClose: () => void;
  onSave: (habit: HabitItem) => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(HABIT_COLORS[0]);
  const [icon, setIcon] = useState<HabitEmojiName>(HABIT_ICONS[0]);
  const [iconExpanded, setIconExpanded] = useState(false);
  const [steps, setSteps] = useState<HabitStep[]>([]);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editStep, setEditStep] = useState<HabitStep | null>(null);
  const [habitIconGridWidth, setHabitIconGridWidth] = useState(0);
  const [pendingDeleteStep, setPendingDeleteStep] = useState<HabitStep | null>(null);

  useEffect(() => {
    if (!visible) return;
    setIconExpanded(false);
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
        onClose={() => { setTaskOpen(false); setEditStep(null); }}
        onSave={step => {
          setSteps(current => {
            const exists = current.some(item => item.id === step.id);
            return exists ? current.map(item => item.id === step.id ? step : item) : [...current, step];
          });
          setTaskOpen(false);
          setEditStep(null);
        }}
      />
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
                onPress={() => {
                  if (!name.trim() || steps.length === 0) return;
                  onSave({
                    id: editHabit?.id ?? `habit_${Date.now()}`,
                    name: name.trim(),
                    color,
                    icon,
                    active: editHabit?.active ?? true,
                    steps,
                  });
                }}
                style={[s.sheetHeadBtn, s.sheetSave]}
                activeOpacity={0.84}
              >
                <CheckSmall s={16} c="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.sheetContent} showsVerticalScrollIndicator={false}>
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
                  value={name}
                  onChangeText={setName}
                  placeholder="Name this habit..."
                  placeholderTextColor="#D1D5DB"
                  style={s.sheetInput}
                />
              </View>

              <View style={s.sheetBlock}>
                <Text style={s.sheetBlockLabel}>Color</Text>
                <View style={s.colorRow}>
                  {HABIT_COLORS.map(item => {
                    const active = color === item;
                    return (
                      <TouchableOpacity
                        key={item}
                        onPress={() => setColor(item)}
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
                  const COLLAPSED = 20; // 4 rows × 5 chips
                  const total = HABIT_ICONS.length;
                  const hasMore = total > COLLAPSED;
                  let visibleIcons = iconExpanded ? HABIT_ICONS : HABIT_ICONS.slice(0, COLLAPSED);
                  if (!iconExpanded && hasMore && !visibleIcons.includes(icon)) {
                    // Always keep the currently selected icon visible even when collapsed.
                    visibleIcons = [icon, ...visibleIcons.slice(0, COLLAPSED - 1)];
                  }
                  return (
                    <>
                      <View style={s.iconGrid} onLayout={event => setHabitIconGridWidth(event.nativeEvent.layout.width)}>
                        {visibleIcons.map(item => {
                          const active = icon === item;
                          return (
                            <TouchableOpacity
                              key={item}
                              onPress={() => setIcon(item)}
                              activeOpacity={0.84}
                              style={[
                                s.iconChip,
                                { width: habitIconChipSize, height: habitIconChipSize },
                                active && { borderColor: color, backgroundColor: hexToRgba(color, 0.08) },
                              ]}
                            >
                              <View style={s.iconGlyphBox}>
                                <NotoEmoji name={item} size={27} />
                              </View>
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
                    onPress={() => { setEditStep(null); setTaskOpen(true); }}
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
  embedded = false,
}: {
  visible: boolean;
  step: HabitStep | null;
  accent: string;
  onClose: () => void;
  onSave: (step: HabitStep) => void;
  embedded?: boolean;
}) {
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('07:00');
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [monthlyDays, setMonthlyDays] = useState<number[]>([1]);
  const [sameTimeEveryDay, setSameTimeEveryDay] = useState(true);
  const [dayTimes, setDayTimes] = useState<TaskDayTimes>({});
  const [notificationMode, setNotificationMode] = useState<NotificationMode>('none');
  const [reminderMinutes, setReminderMinutes] = useState(15);

  useEffect(() => {
    if (!visible) return;
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

  const activeDayIndexes = useMemo(
    () => getActiveDayIndexes(frequency, selectedDays),
    [frequency, selectedDays],
  );
  const allowPerDayTimes = frequency !== 'monthly' && (frequency !== 'specific_days' || selectedDays.length > 0);
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

  return (
    <SmoothBottomSheet visible={visible} onClose={onClose} sheetStyle={s.taskBottomSheet} keyboardAware embedded={embedded}>
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
          onPress={saveStep}
          disabled={!canSave}
          style={[s.sheetHeadBtn, s.sheetSave, { backgroundColor: accent, opacity: canSave ? 1 : 0.38 }]}
          activeOpacity={0.84}
        >
          <CheckSmall s={16} c="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.taskContent} showsVerticalScrollIndicator={false}>
        <View style={s.sheetBlock}>
          <Text style={[s.sheetBlockLabel, { color: accent }]}>Step Name</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Step name..."
            placeholderTextColor="#D1D5DB"
            style={s.sheetInput}
          />
        </View>

        <View style={s.sheetBlock}>
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

        <View style={s.sheetBlock}>
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
  sheetInput: { minHeight: 52, borderRadius: 20, backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#F2F1EC', paddingHorizontal: 16, fontFamily: F.serif, fontSize: 22, color: '#1F2937' },
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
    overflow: 'hidden',
  },
  iconGlyphBox: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
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
