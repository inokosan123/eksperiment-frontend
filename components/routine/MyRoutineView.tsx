import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import ConfirmModal from '@/components/shared/ConfirmModal';
import NotificationSettings, { type NotificationMode as SharedNotificationMode } from '@/components/shared/NotificationSettings';
import SetAsTaskSheet from '@/components/shared/SetAsTaskSheet';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import TaskFrequencyEditor, { type TaskFrequency } from '@/components/shared/TaskFrequencyEditor';
import TaskTimeEditor, { type TaskDayTimes } from '@/components/shared/TaskTimeEditor';
import {
  Activity,
  Apple,
  BarChart3,
  Bell,
  Book,
  Brain,
  Briefcase,
  Calendar,
  Candle,
  CheckSmall,
  ChevronDown,
  ChevronRight,
  Clock,
  Coffee,
  Cross,
  Droplets,
  Dumbbell,
  Eye,
  Feather,
  Heart,
  Home,
  Leaf,
  ListChecks,
  Moon,
  Music,
  Notebook,
  Pencil,
  Pill,
  Plus,
  Sparkles,
  Star,
  Sun,
  Target,
  Trash2,
  Trophy,
  Utensils,
  Waves,
  Wind,
  X,
} from '@/components/icons/Icons';
import { AnyTaskCard, TaskData } from '@/components/shared/TaskCards';
import ChallengeSummaryCard from '@/components/shared/ChallengeSummaryCard';
import { C, F } from '@/constants/tokens';
import type { HabitItem, HabitStep } from '@/components/habits/habitDb';
import { habitStepTaskId, listHabitsWithStats, setHabitRecordActive } from '@/components/habits/habitDb';
import { NotoEmoji } from '@/components/shared/NotoEmoji';
import { normalizeHabitIcon } from '@/components/shared/notoEmoji/legacyMap';
import { useChallenges } from '@/components/challenges/ChallengesContext';
import { useTasks } from '@/components/tasks/TaskProvider';
import { resolveDisplayIcon, resolveDisplayType, resolveTaskVariant } from '@/components/tasks/taskAdapters';
import type { TaskDefinition, TaskDraft, TaskLevel } from '@/components/tasks/taskTypes';

type RoutineFrequency = TaskFrequency;
type NotificationMode = SharedNotificationMode;
type RoutineLevel = TaskLevel;
type SpiritualType = TaskDefinition['type'];
type RoutineTaskSheetContext = 'prayer' | 'journal' | 'scripture';
type RoutineIconName =
  | 'Activity'
  | 'Apple'
  | 'BarChart3'
  | 'Bell'
  | 'Book'
  | 'Brain'
  | 'Briefcase'
  | 'Calendar'
  | 'Candle'
  | 'Clock'
  | 'Coffee'
  | 'Cross'
  | 'Droplets'
  | 'Dumbbell'
  | 'Eye'
  | 'Feather'
  | 'Heart'
  | 'Home'
  | 'Leaf'
  | 'ListChecks'
  | 'Moon'
  | 'Music'
  | 'Notebook'
  | 'Pencil'
  | 'Pill'
  | 'Sparkles'
  | 'Star'
  | 'Sun'
  | 'Target'
  | 'Trophy'
  | 'Utensils'
  | 'Waves'
  | 'Wind';

type DayOverride = {
  jsDay: number;
  time: string;
};

if (Platform.OS === 'android' && typeof UIManager.setLayoutAnimationEnabledExperimental === 'function') {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function animateRoutineLayoutChange() {
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

type RoutineTask = {
  id: string;
  title: string;
  subtitle?: string;
  level: RoutineLevel;
  source: TaskDefinition['source'];
  type: SpiritualType;
  icon?: RoutineIconName;
  habitColor?: string;
  targetView?: string;
  targetTab?: string;
  status: TaskDefinition['status'];
  time: string;
  frequency: RoutineFrequency;
  selectedDays?: number[];
  monthlyDays?: number[];
  sameTimeEveryDay: boolean;
  dayTimeOverrides?: DayOverride[];
  notificationMode: NotificationMode;
  reminderMinutes?: number;
};

const DAY_TABS = [
  { label: 'Mon', short: 'M', jsDay: 1 },
  { label: 'Tue', short: 'T', jsDay: 2 },
  { label: 'Wed', short: 'W', jsDay: 3 },
  { label: 'Thu', short: 'T', jsDay: 4 },
  { label: 'Fri', short: 'F', jsDay: 5 },
  { label: 'Sat', short: 'S', jsDay: 6 },
  { label: 'Sun', short: 'S', jsDay: 0 },
] as const;

const SPIRITUAL_TYPES: {
  id: SpiritualType;
  label: string;
  desc: string;
  accent: string;
  Icon: React.ComponentType<{ s?: number; c?: string; w?: number }>;
}[] = [
  { id: 'prayer', label: 'Prayer', desc: 'Morning, evening, and meal prayer tasks', accent: '#C5A059', Icon: Sun },
  { id: 'reading', label: 'Scripture', desc: 'Bible, Psalter, and reading rhythms', accent: '#B54155', Icon: Book },
  { id: 'journal', label: 'Journal', desc: 'Reflections, gratitude, and notes', accent: '#5B564F', Icon: Feather },
  { id: 'church', label: 'Church', desc: 'Liturgy and church attendance reminders', accent: '#7C3AED', Icon: Cross },
  { id: 'custom', label: 'Custom', desc: 'Create your own spiritual activity', accent: '#374151', Icon: Sparkles },
];

const ROUTINE_ICONS: {
  id: RoutineIconName;
  label: string;
  Icon: React.ComponentType<{ s?: number; c?: string; w?: number }>;
}[] = [
  { id: 'Activity', label: 'Fitness', Icon: Activity },
  { id: 'Book', label: 'Study', Icon: Book },
  { id: 'Briefcase', label: 'Work', Icon: Briefcase },
  { id: 'Home', label: 'Home', Icon: Home },
  { id: 'Heart', label: 'Health', Icon: Heart },
  { id: 'Dumbbell', label: 'Workout', Icon: Dumbbell },
  { id: 'Droplets', label: 'Water', Icon: Droplets },
  { id: 'Apple', label: 'Food', Icon: Apple },
  { id: 'Coffee', label: 'Coffee', Icon: Coffee },
  { id: 'Pill', label: 'Medicine', Icon: Pill },
  { id: 'Moon', label: 'Evening', Icon: Moon },
  { id: 'Sun', label: 'Morning', Icon: Sun },
  { id: 'Utensils', label: 'Meal', Icon: Utensils },
  { id: 'Feather', label: 'Write', Icon: Feather },
  { id: 'Target', label: 'Goal', Icon: Target },
  { id: 'ListChecks', label: 'Tasks', Icon: ListChecks },
  { id: 'Pencil', label: 'Note', Icon: Pencil },
  { id: 'Notebook', label: 'Journal', Icon: Notebook },
  { id: 'Star', label: 'Favorite', Icon: Star },
  { id: 'Trophy', label: 'Win', Icon: Trophy },
  { id: 'Bell', label: 'Reminder', Icon: Bell },
  { id: 'BarChart3', label: 'Stats', Icon: BarChart3 },
  { id: 'Brain', label: 'Mind', Icon: Brain },
  { id: 'Eye', label: 'Focus', Icon: Eye },
  { id: 'Leaf', label: 'Nature', Icon: Leaf },
  { id: 'Music', label: 'Music', Icon: Music },
  { id: 'Wind', label: 'Breath', Icon: Wind },
  { id: 'Waves', label: 'Calm', Icon: Waves },
  { id: 'Calendar', label: 'Plan', Icon: Calendar },
  { id: 'Clock', label: 'Time', Icon: Clock },
  { id: 'Sparkles', label: 'Custom', Icon: Sparkles },
  { id: 'Candle', label: 'Quiet', Icon: Candle },
  { id: 'Cross', label: 'Prayer', Icon: Cross },
];

const VISIBLE_ROUTINE_ICON_COUNT = 20;

function jsDayToTaskIndex(day: number) {
  return day === 0 ? 6 : day - 1;
}

function taskIndexToJsDay(index: number) {
  return index === 6 ? 0 : index + 1;
}

function selectedDaysToTaskIndexes(days: number[] = []) {
  return days.map(jsDayToTaskIndex).sort((a, b) => a - b);
}

function taskIndexesToSelectedDays(indexes: number[] = []) {
  return indexes.map(taskIndexToJsDay).sort((a, b) => a - b);
}

function taskDayTimesToOverrides(dayTimes: TaskDayTimes, activeIndexes: number[]) {
  return activeIndexes
    .filter(index => !!dayTimes[index])
    .map(index => ({ jsDay: taskIndexToJsDay(index), time: dayTimes[index] }));
}

function overridesToTaskDayTimes(overrides: DayOverride[] = []) {
  return overrides.reduce<TaskDayTimes>((acc, item) => {
    acc[jsDayToTaskIndex(item.jsDay)] = item.time;
    return acc;
  }, {});
}

function getActiveTaskIndexesForFrequency(frequency: RoutineFrequency, selectedDays: number[] = []) {
  switch (frequency) {
    case 'weekdays':
      return [0, 1, 2, 3, 4];
    case 'weekends':
      return [5, 6];
    case 'specific_days':
      return selectedDaysToTaskIndexes(selectedDays);
    default:
      return [0, 1, 2, 3, 4, 5, 6];
  }
}

function matchesTaskForDay(task: RoutineTask, jsDay: number) {
  switch (task.frequency) {
    case 'weekdays':
      return jsDay >= 1 && jsDay <= 5;
    case 'weekends':
      return jsDay === 0 || jsDay === 6;
    case 'specific_days':
      return (task.selectedDays ?? []).includes(jsDay);
    case 'monthly':
      return (task.monthlyDays ?? [1]).includes(new Date().getDate());
    case 'daily':
    default:
      return true;
  }
}

function getActiveDays(task: RoutineTask) {
  switch (task.frequency) {
    case 'weekdays':
      return DAY_TABS.filter(day => day.jsDay >= 1 && day.jsDay <= 5);
    case 'weekends':
      return DAY_TABS.filter(day => day.jsDay === 0 || day.jsDay === 6);
    case 'specific_days':
      return DAY_TABS.filter(day => (task.selectedDays ?? []).includes(day.jsDay));
    case 'monthly':
      return DAY_TABS;
    case 'daily':
    default:
      return [...DAY_TABS];
  }
}

function getTaskTimeForDay(task: RoutineTask, jsDay: number) {
  if (task.sameTimeEveryDay || !task.dayTimeOverrides?.length) return task.time;
  return task.dayTimeOverrides.find(item => item.jsDay === jsDay)?.time ?? task.time;
}

function getTaskFrequencyLabel(task: RoutineTask) {
  switch (task.frequency) {
    case 'weekdays':
      return 'Mon - Fri';
    case 'weekends':
      return 'Sat - Sun';
    case 'specific_days':
      return DAY_TABS
        .filter(day => (task.selectedDays ?? []).includes(day.jsDay))
        .map(day => day.short)
        .join(' ');
    case 'monthly':
      return `Monthly ${(task.monthlyDays ?? [1]).join(', ')}`;
    case 'daily':
    default:
      return 'Daily';
  }
}

function getHabitFrequencyLabel(step: HabitStep) {
  switch (step.frequency) {
    case 'weekdays':
      return 'Weekdays';
    case 'weekends':
      return 'Weekends';
    case 'specific_days': {
      const selected = step.selectedDays ?? [];
      const labels = DAY_TABS
        .filter(day => selected.includes(jsDayToTaskIndex(day.jsDay)) || selected.includes(day.jsDay))
        .map(day => day.short)
        .join(' ');
      return labels || 'Specific days';
    }
    case 'monthly':
      return `Monthly ${(step.monthlyDays ?? [1]).join(', ')}`;
    case 'daily':
    default:
      return 'Daily';
  }
}

function formatTimeGap(fromTime: string, toTime: string) {
  const [fromHour, fromMinute] = fromTime.split(':').map(Number);
  const [toHour, toMinute] = toTime.split(':').map(Number);
  const diff = (toHour * 60 + toMinute) - (fromHour * 60 + fromMinute);
  if (diff <= 0) return null;
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}

function toTaskCardData(task: RoutineTask, jsDay: number): TaskData {
  // Use the shared resolver so MyRoutine and Home end up with identical
  // variant / type / icon assignments — including 'reading' for book tasks
  // and prayer-icon overrides for spiritual rule tasks.
  const lookInput = {
    source: task.source,
    type: task.type,
    level: task.level,
    title: task.title,
    subtitle: task.subtitle,
    icon: task.icon,
    targetView: task.targetView,
  };
  const variant = resolveTaskVariant(lookInput);

  return {
    variant,
    title: task.title,
    time: getTaskTimeForDay(task, jsDay),
    subtitle: task.subtitle || getTaskFrequencyLabel(task),
    state: task.status === 'paused' ? 'locked' : 'active',
    type: resolveDisplayType(lookInput, variant),
    habitColor: task.habitColor,
    habitIconName: resolveDisplayIcon(lookInput, variant),
  };
}

function taskDefinitionToRoutineTask(task: TaskDefinition): RoutineTask {
  return {
    id: task.id,
    title: task.title,
    subtitle: task.subtitle,
    level: task.level,
    source: task.source,
    type: task.type,
    icon: task.icon as RoutineIconName | undefined,
    habitColor: task.habitColor,
    targetView: task.targetView,
    targetTab: task.targetTab,
    status: task.status,
    time: task.schedule.time,
    frequency: task.schedule.frequency,
    selectedDays: taskIndexesToSelectedDays(task.schedule.selectedDays),
    monthlyDays: task.schedule.monthlyDays,
    sameTimeEveryDay: task.schedule.sameTimeEveryDay,
    dayTimeOverrides: taskDayTimesToOverrides(task.schedule.dayTimes, [0, 1, 2, 3, 4, 5, 6]),
    notificationMode: task.notificationMode,
    reminderMinutes: task.reminderMinutes,
  };
}

function sourceRouteForTask(task: RoutineTask) {
  switch (task.source) {
    case 'habit':
      return '/habits';
    case 'challenge':
      return '/challenges';
    case 'reading_book':
      return '/reading-list';
    case 'gratitude':
      return '/gratitude';
    default:
      return null;
  }
}

function routineTaskToDraft(task: RoutineTask): TaskDraft {
  const dayTimes = overridesToTaskDayTimes(task.dayTimeOverrides ?? []);
  return {
    id: task.id,
    title: task.title,
    subtitle: task.source === 'routine' || task.source === 'spiritual'
      ? getTaskFrequencyLabel(task)
      : task.subtitle ?? getTaskFrequencyLabel(task),
    level: task.level,
    source: task.source,
    type: task.type,
    icon: task.icon,
    habitColor: task.habitColor,
    targetView: task.targetView,
    targetTab: task.targetTab,
    status: task.status,
    schedule: {
      frequency: task.frequency,
      selectedDays: task.frequency === 'specific_days' ? selectedDaysToTaskIndexes(task.selectedDays ?? []) : [],
      monthlyDays: task.frequency === 'monthly' ? task.monthlyDays ?? [1] : [1],
      time: task.time,
      sameTimeEveryDay: task.sameTimeEveryDay,
      dayTimes: task.sameTimeEveryDay ? {} : dayTimes,
    },
    notificationMode: task.notificationMode,
    reminderMinutes: task.reminderMinutes,
  };
}

function habitStepToTaskDraft(habit: HabitItem, step: HabitStep): TaskDraft {
  const sameTimeEveryDay = step.sameTimeEveryDay ?? true;
  return {
    id: habitStepTaskId(habit.id, step.id),
    title: step.title,
    subtitle: `${habit.name} - ${getHabitFrequencyLabel(step)}`,
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

export default function MyRoutineView() {
  const router = useRouter();
  const { activeChallenges } = useChallenges();
  const {
    tasks: backendTasks,
    createOrUpdateTask,
    remove: removeTask,
    pause: pauseTask,
    refresh: refreshTasks,
  } = useTasks();
  const tasks = useMemo(
    () => backendTasks
      .filter(task => task.source !== 'quick' && task.status !== 'archived')
      .map(taskDefinitionToRoutineTask),
    [backendTasks],
  );
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [showSpiritualTypePicker, setShowSpiritualTypePicker] = useState(false);
  const [spiritualTaskContext, setSpiritualTaskContext] = useState<RoutineTaskSheetContext | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorTask, setEditorTask] = useState<RoutineTask | null>(null);
  const [editorDefaultLevel, setEditorDefaultLevel] = useState<RoutineLevel | undefined>(undefined);
  const [editorDefaultType, setEditorDefaultType] = useState<SpiritualType | undefined>(undefined);
  const [habitTab, setHabitTab] = useState<'active' | 'paused'>('active');
  const [habits, setHabits] = useState<HabitItem[]>([]);
  const [expandedHabitId, setExpandedHabitId] = useState<string | null>(null);

  const selectedDay = DAY_TABS[selectedDayIndex];

  const tasksForDay = useMemo(() => (
    tasks
      .filter(task => matchesTaskForDay(task, selectedDay.jsDay))
      .sort((left, right) => getTaskTimeForDay(left, selectedDay.jsDay).localeCompare(getTaskTimeForDay(right, selectedDay.jsDay)))
  ), [selectedDay.jsDay, tasks]);

  const activeHabits = useMemo(() => habits.filter(item => item.active), [habits]);
  const pausedHabits = useMemo(() => habits.filter(item => !item.active), [habits]);
  const visibleHabits = habitTab === 'active' ? activeHabits : pausedHabits;

  useEffect(() => {
    let cancelled = false;
    listHabitsWithStats()
      .then(nextHabits => {
        if (!cancelled) setHabits(nextHabits);
      })
      .catch(error => console.warn('Routine habits failed to load:', error));
    return () => {
      cancelled = true;
    };
  }, [backendTasks]);

  const openAddSpiritual = () => {
    setShowSpiritualTypePicker(true);
  };

  const openAddRoutine = () => {
    setEditorTask(null);
    setEditorDefaultLevel(2);
    setEditorDefaultType(undefined);
    setEditorVisible(true);
  };

  const openEditTask = (task: RoutineTask) => {
    setEditorTask(task);
    setEditorDefaultLevel(undefined);
    setEditorDefaultType(undefined);
    setEditorVisible(true);
  };

  const openTask = (task: RoutineTask) => {
    const route = sourceRouteForTask(task);
    if (route) {
      router.push(route as never);
      return;
    }
    openEditTask(task);
  };

  const handleTaskSave = async (task: RoutineTask) => {
    await createOrUpdateTask(routineTaskToDraft(task));
    setEditorVisible(false);
    setEditorTask(null);
    setEditorDefaultLevel(undefined);
    setEditorDefaultType(undefined);
  };

  const handleTaskDelete = async (taskId: string) => {
    await removeTask(taskId);
    setEditorVisible(false);
    setEditorTask(null);
  };

  const toggleHabitStep = (habitId: string, stepId: string) => {
    setHabits(current => current.map(habit => habit.id === habitId ? {
      ...habit,
      steps: habit.steps.map(step => step.id === stepId ? { ...step, completedToday: !step.completedToday } : step),
    } : habit));
  };

  const toggleHabitActive = async (habitId: string) => {
    const habit = habits.find(item => item.id === habitId);
    if (!habit) return;
    const nextActive = !habit.active;

    setHabits(current => current.map(item => item.id === habitId ? { ...item, active: nextActive } : item));

    try {
      await setHabitRecordActive(habit.id, nextActive);
      if (nextActive) {
        const nextHabit = { ...habit, active: true };
        await Promise.all(nextHabit.steps.map(step => createOrUpdateTask(habitStepToTaskDraft(nextHabit, step))));
      } else {
        await Promise.all(habit.steps.map(step => pauseTask(habitStepTaskId(habit.id, step.id))));
      }
      const nextHabits = await listHabitsWithStats();
      setHabits(nextHabits);
      await refreshTasks();
    } catch (error) {
      console.warn('Habit active state failed to update:', error);
      const nextHabits = await listHabitsWithStats();
      setHabits(nextHabits);
    }
  };

  const progressForHabit = (habit: HabitItem) => {
    const total = habit.steps.length;
    const done = habit.steps.filter(step => step.completedToday).length;
    return { total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
  };

  return (
    <View style={s.screen}>
      <ScreenTitleBar title="MY ROUTINE" showBack />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View>
          <View style={s.sectionHead}>
            <Calendar s={16} c={C.gold} />
            <Text style={s.sectionKicker}>Weekly Template</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dayTabsRow}>
            {DAY_TABS.map((day, index) => {
              const active = index === selectedDayIndex;
              return (
                <TouchableOpacity
                  key={day.label}
                  onPress={() => setSelectedDayIndex(index)}
                  activeOpacity={0.84}
                  style={s.dayTabPress}
                >
                  {active ? (
                    <LinearGradient
                      colors={['#E2BD75', '#C5A059', '#A87E33']}
                      locations={[0, 0.55, 1]}
                      start={{ x: 0.15, y: 0 }}
                      end={{ x: 0.85, y: 1 }}
                      style={[s.dayTab, s.dayTabActive]}
                    >
                      <View pointerEvents="none" style={s.dayTabSheen} />
                      <View pointerEvents="none" style={s.dayTabRim} />
                      <Text style={[s.dayTabLabel, s.dayTabLabelActive]}>{day.label}</Text>
                      <View style={s.dayTabMarker} />
                    </LinearGradient>
                  ) : (
                    <View style={s.dayTab}>
                      <Text style={s.dayTabLabel}>{day.label}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={s.addRow}>
            <TouchableOpacity onPress={openAddSpiritual} activeOpacity={0.84} style={s.addBtnPress}>
              <LinearGradient
                colors={['#FFFBEB', '#FFF4D5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[s.addBtn, s.addSpiritualBtn]}
              >
                <View style={s.addIconCircle}>
                  <Plus s={12} c={C.gold} w={2.4} />
                </View>
                <Text style={s.addSpiritualText}>Spiritual</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={openAddRoutine} activeOpacity={0.84} style={s.addBtnPress}>
              <LinearGradient
                colors={['#FFFFFF', '#F4F6F8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[s.addBtn, s.addRoutineBtn]}
              >
                <View style={s.addIconCircleNeutral}>
                  <Plus s={12} c="#6B7280" w={2.4} />
                </View>
                <Text style={s.addRoutineText}>Routine</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={s.addRowDivider} />

          <View style={s.taskStack}>
            {tasksForDay.map((task, index) => {
              const time = getTaskTimeForDay(task, selectedDay.jsDay);
              const prev = index > 0 ? tasksForDay[index - 1] : null;
              const gap = prev ? formatTimeGap(getTaskTimeForDay(prev, selectedDay.jsDay), time) : null;

              return (
                <React.Fragment key={task.id}>
                  {gap && (
                    <View style={s.gapRow}>
                      <View style={s.gapLine} />
                      <Text style={s.gapText}>{gap}</Text>
                      <View style={s.gapLine} />
                    </View>
                  )}

                  <TouchableOpacity onPress={() => openTask(task)} activeOpacity={0.86} style={s.taskCardWrap}>
                    <AnyTaskCard task={toTaskCardData(task, selectedDay.jsDay)} />
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}

            {tasksForDay.length === 0 && (
              <View style={s.emptyBlock}>
                <Text style={s.emptyTitle}>No activities for {selectedDay.label}</Text>
              </View>
            )}
          </View>
        </View>

        <SectionDivider icon={<ListChecks s={14} c="#D1D5DB" />} />

        <View>
          <View style={s.sectionBetween}>
            <View style={s.sectionHead}>
              <ListChecks s={16} c="#16A34A" />
              <Text style={[s.sectionKicker, { color: '#16A34A' }]}>Habits</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/habits')} activeOpacity={0.84} style={s.roundMiniBtn}>
              <Plus s={18} c="#16A34A" />
            </TouchableOpacity>
          </View>

          <View style={s.segmentWrap}>
            {([
              { key: 'active' as const, label: `Active (${activeHabits.length})` },
              { key: 'paused' as const, label: `Paused (${pausedHabits.length})` },
            ]).map(item => {
              const active = habitTab === item.key;
              return (
                <TouchableOpacity key={item.key} onPress={() => setHabitTab(item.key)} activeOpacity={0.84} style={[s.segmentBtn, active && s.segmentBtnActive]}>
                  <Text style={[s.segmentText, active && s.segmentTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={s.helperBody}>
            {habitTab === 'active'
              ? 'Active habits stay in your daily flow and appear on Home when scheduled.'
              : 'Paused habits stay here so you can resume them whenever you want.'}
          </Text>

          <View style={s.habitList}>
            {visibleHabits.map(habit => {
              const expanded = expandedHabitId === habit.id;
              const progress = progressForHabit(habit);
              return (
                <View key={habit.id} style={[s.habitCard, !habit.active && s.habitCardPaused]}>
                  <TouchableOpacity onPress={() => setExpandedHabitId(current => current === habit.id ? null : habit.id)} activeOpacity={0.84} style={s.habitHead}>
                    <View style={[s.habitIconWrap, { backgroundColor: `${habit.color}18` }]}>
                      <NotoEmoji name={normalizeHabitIcon(habit.icon)} size={26} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={s.habitTitleRow}>
                        <Text style={s.habitTitle}>{habit.name}</Text>
                        <Text style={[s.habitCount, { color: habit.color }]}>{progress.done}/{progress.total}</Text>
                      </View>
                      <Text style={s.habitMeta}>
                        {habit.active ? `${habit.steps.length} scheduled steps` : 'Hidden from Home until resumed'}
                      </Text>
                      <View style={s.habitBar}>
                        <View style={[s.habitBarFill, { width: `${habit.active ? progress.pct : 100}%`, backgroundColor: habit.active ? habit.color : '#D6D3D1' }]} />
                      </View>
                    </View>
                    <ChevronDown s={16} c="#D1D5DB" />
                  </TouchableOpacity>

                  {expanded && (
                    <View style={s.habitBody}>
                      {habit.steps.map(step => (
                        <TouchableOpacity
                          key={step.id}
                          onPress={() => habit.active && toggleHabitStep(habit.id, step.id)}
                          activeOpacity={0.84}
                          style={[s.habitStepRow, !habit.active && { opacity: 0.6 }]}
                        >
                          <View style={[s.habitStepCheck, step.completedToday && { backgroundColor: habit.color, borderColor: habit.color }]}>
                            {step.completedToday && <CheckSmall s={12} c="#FFFFFF" />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.habitStepTitle, step.completedToday && s.habitStepTitleDone]}>{step.title}</Text>
                            <Text style={s.habitStepMeta}>{step.time} / {getHabitFrequencyLabel(step)}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}

                      <View style={s.inlineActionGrid}>
                        <TouchableOpacity onPress={() => toggleHabitActive(habit.id)} activeOpacity={0.84} style={[s.inlineActionBtn, habit.active ? s.inlineActionNeutral : s.inlineActionWarm]}>
                          <Text style={[s.inlineActionText, habit.active ? { color: '#6B7280' } : { color: '#8D7750' }]}>{habit.active ? 'Pause Habit' : 'Resume Habit'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => router.push('/habits')} activeOpacity={0.84} style={s.inlineActionBtn}>
                          <Text style={s.inlineActionText}>Manage</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        <SectionDivider icon={<Trophy s={14} c="#D1D5DB" />} />

        <View>
          <View style={s.sectionBetween}>
            <View style={s.sectionHead}>
              <Trophy s={16} c={C.gold} />
              <Text style={s.sectionKicker}>Challenges</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/challenges')} activeOpacity={0.84} style={s.inlineTextBtn}>
              <Text style={s.inlineTextBtnLabel}>Active ({activeChallenges.length})</Text>
              <ChevronRight s={14} c="#A8A29E" />
            </TouchableOpacity>
          </View>

          <View style={s.challengeList}>
            {activeChallenges.map(challenge => (
              <ChallengeSummaryCard
                key={challenge.id}
                challenge={challenge}
                onPress={() => router.push('/challenges')}
              />
            ))}

            <TouchableOpacity onPress={() => router.push('/challenges')} activeOpacity={0.84} style={s.viewAllChallenges}>
              <Trophy s={14} c={C.gold} />
              <Text style={s.viewAllChallengesText}>View All Challenges</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      <SpiritualTypePickerSheet
        visible={showSpiritualTypePicker}
        onClose={() => setShowSpiritualTypePicker(false)}
        onSelect={type => {
          setShowSpiritualTypePicker(false);
          if (type === 'prayer' || type === 'journal' || type === 'reading') {
            setSpiritualTaskContext(type === 'reading' ? 'scripture' : type);
            return;
          }
          setEditorTask(null);
          setEditorDefaultLevel(1);
          setEditorDefaultType(type);
          setEditorVisible(true);
        }}
      />

      {spiritualTaskContext && (
        <SetAsTaskSheet
          visible={!!spiritualTaskContext}
          context={spiritualTaskContext}
          onClose={() => setSpiritualTaskContext(null)}
          onTaskMutation={refreshTasks}
          onTaskDraft={async draft => {
            await createOrUpdateTask(draft);
            setSpiritualTaskContext(null);
          }}
        />
      )}

      <RoutineTaskEditorSheet
        visible={editorVisible}
        task={editorTask}
        defaultLevel={editorDefaultLevel}
        defaultType={editorDefaultType}
        onClose={() => {
          setEditorVisible(false);
          setEditorTask(null);
          setEditorDefaultLevel(undefined);
          setEditorDefaultType(undefined);
        }}
        onSave={handleTaskSave}
        onDelete={handleTaskDelete}
      />

    </View>
  );
}

function SectionDivider({ icon }: { icon: React.ReactNode }) {
  return (
    <View style={s.dividerRow}>
      <View style={s.dividerLine} />
      {icon}
      <View style={s.dividerLine} />
    </View>
  );
}

function SpiritualTypePickerSheet({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (type: SpiritualType) => void;
}) {
  if (!visible) return null;

  return (
    <SmoothBottomSheet visible={visible} onClose={onClose} sheetStyle={s.sheetShell} keyboardAware>
          <View style={s.sheetHandle} />
          <View style={s.sheetHeader}>
            <TouchableOpacity onPress={onClose} activeOpacity={0.84} style={s.sheetHeaderIcon}>
              <X s={20} c="#9CA3AF" />
            </TouchableOpacity>
            <Text style={s.sheetHeaderTitle}>Choose Type</Text>
            <View style={s.sheetHeaderSpacer} />
          </View>
          <ScrollView contentContainerStyle={s.typeSheetContent} showsVerticalScrollIndicator={false}>
            {SPIRITUAL_TYPES.map(item => (
              <TouchableOpacity key={item.id} onPress={() => onSelect(item.id)} activeOpacity={0.84} style={s.typeOptionCard}>
                <View style={[s.typeOptionIcon, { backgroundColor: `${item.accent}14` }]}>
                  <item.Icon s={20} c={item.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.typeOptionTitle}>{item.label}</Text>
                  <Text style={s.typeOptionBody}>{item.desc}</Text>
                </View>
                <ChevronRight s={16} c="#D1D5DB" />
              </TouchableOpacity>
            ))}
          </ScrollView>
    </SmoothBottomSheet>
  );
}

function RoutineTaskEditorSheet({
  visible,
  task,
  defaultLevel,
  defaultType,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  task: RoutineTask | null;
  defaultLevel?: RoutineLevel;
  defaultType?: SpiritualType;
  onClose: () => void;
  onSave: (task: RoutineTask) => void;
  onDelete: (taskId: string) => void | Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState<RoutineLevel>(1);
  const [type, setType] = useState<SpiritualType>('prayer');
  const [icon, setIcon] = useState<RoutineIconName>('ListChecks');
  const [time, setTime] = useState('08:00');
  const [frequency, setFrequency] = useState<RoutineFrequency>('daily');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [monthlyDays, setMonthlyDays] = useState<number[]>([1]);
  const [sameTimeEveryDay, setSameTimeEveryDay] = useState(true);
  const [dayTimeOverrides, setDayTimeOverrides] = useState<DayOverride[]>([]);
  const [notificationMode, setNotificationMode] = useState<NotificationMode>('none');
  const [reminderMinutes, setReminderMinutes] = useState(15);
  const [showAllRoutineIcons, setShowAllRoutineIcons] = useState(false);
  const [routineIconGridWidth, setRoutineIconGridWidth] = useState(0);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setShowAllRoutineIcons(false);
    setConfirmDeleteVisible(false);
    if (task) {
      setTitle(task.title);
      setLevel(task.level);
      setType(task.type);
      setIcon(task.icon ?? 'ListChecks');
      setTime(task.time);
      setFrequency(task.frequency);
      setSelectedDays(task.selectedDays ?? []);
      setMonthlyDays(task.monthlyDays ?? [1]);
      setSameTimeEveryDay(task.sameTimeEveryDay);
      setDayTimeOverrides(task.dayTimeOverrides ?? []);
      setNotificationMode(task.notificationMode);
      setReminderMinutes(task.reminderMinutes ?? 15);
      return;
    }

    setTitle('');
    setLevel(defaultLevel ?? 1);
    setType(defaultType ?? 'prayer');
    setIcon('ListChecks');
    setTime('08:00');
    setFrequency('daily');
    setSelectedDays([]);
    setMonthlyDays([1]);
    setSameTimeEveryDay(true);
    setDayTimeOverrides([]);
    setNotificationMode('none');
    setReminderMinutes(15);
  }, [defaultLevel, defaultType, task, visible]);

  const isSpiritual = level === 1;
  const accent = isSpiritual ? C.gold : '#1F2937';

  const draftTask: RoutineTask = {
    id: task?.id ?? `routine_${Date.now()}`,
    title: title.trim(),
    subtitle: task?.subtitle,
    level,
    source: task?.source ?? (isSpiritual ? 'spiritual' : 'routine'),
    type: task ? task.type : isSpiritual ? type : 'custom',
    icon: isSpiritual ? task?.icon : icon,
    habitColor: task?.habitColor,
    targetView: task?.targetView,
    targetTab: task?.targetTab,
    status: task?.status ?? 'active',
    time,
    frequency,
    selectedDays: frequency === 'specific_days' ? selectedDays : undefined,
    monthlyDays: frequency === 'monthly' ? monthlyDays : undefined,
    sameTimeEveryDay,
    dayTimeOverrides: sameTimeEveryDay ? undefined : dayTimeOverrides,
    notificationMode,
    reminderMinutes: notificationMode === 'double' ? reminderMinutes : undefined,
  };

  const activeDays = getActiveDays(draftTask);
  const activeTaskIndexes = getActiveTaskIndexesForFrequency(frequency, selectedDays);
  const selectedDayIndexes = selectedDaysToTaskIndexes(selectedDays);
  const dayTimes = overridesToTaskDayTimes(dayTimeOverrides);
  const allowPerDayTimes = frequency !== 'monthly' && (frequency !== 'specific_days' || selectedDays.length > 0);
  const canEditRoutineIcon = !isSpiritual && (!task || task.source === 'routine');
  const compactRoutineIcons = ROUTINE_ICONS.slice(0, VISIBLE_ROUTINE_ICON_COUNT);
  const selectedRoutineIcon = ROUTINE_ICONS.find(item => item.id === icon);
  const visibleRoutineIcons = showAllRoutineIcons
    ? ROUTINE_ICONS
    : compactRoutineIcons.some(item => item.id === icon) || !selectedRoutineIcon
      ? compactRoutineIcons
      : [...compactRoutineIcons.slice(0, VISIBLE_ROUTINE_ICON_COUNT - 1), selectedRoutineIcon];
  const routineIconGap = 8;
  const routineIconChipSize = routineIconGridWidth > 0
    ? Math.max(42, Math.min(58, Math.floor((routineIconGridWidth - routineIconGap * 4) / 5)))
    : 50;

  const save = () => {
    if (!title.trim()) return;
    const normalizedOverrides = sameTimeEveryDay || !allowPerDayTimes
      ? undefined
      : activeDays.map(day => ({
          jsDay: day.jsDay,
          time: dayTimeOverrides.find(item => item.jsDay === day.jsDay)?.time ?? time,
        }));
    onSave({
      ...draftTask,
      sameTimeEveryDay: allowPerDayTimes ? sameTimeEveryDay : true,
      selectedDays: frequency === 'specific_days' ? selectedDays : undefined,
      monthlyDays: frequency === 'monthly' ? monthlyDays : undefined,
      dayTimeOverrides: normalizedOverrides,
    });
  };

  if (!visible) return null;

  return (
    <>
    <SmoothBottomSheet visible={visible} onClose={onClose} sheetStyle={s.sheetShell} keyboardAware>
          <View style={s.sheetHandle} />

          <View style={s.editorHeader}>
            <TouchableOpacity onPress={onClose} activeOpacity={0.84} style={s.sheetHeaderIcon}>
              <X s={22} c="#9CA3AF" />
            </TouchableOpacity>
            <Text style={s.editorHeaderTitle}>{task ? 'Edit Activity' : 'New Activity'}</Text>
            <TouchableOpacity onPress={save} activeOpacity={0.84} style={[s.saveCircle, { backgroundColor: accent, opacity: title.trim() ? 1 : 0.35 }]}>
              <CheckSmall s={18} c="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.editorContent} showsVerticalScrollIndicator={false}>
            <View style={s.editorBlock}>
              <Text style={[s.editorBlockLabel, { color: accent }]}>Activity Name</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={isSpiritual ? 'e.g. Morning Prayer' : 'e.g. Evening Walk'}
                placeholderTextColor="#D1D5DB"
                style={s.titleInput}
              />
            </View>

            {!task && defaultLevel == null && (
              <View style={s.editorBlock}>
                <Text style={s.mutedLabel}>Category</Text>
                <View style={s.toggleRow}>
                  <TouchableOpacity
                    onPress={() => setLevel(1)}
                    activeOpacity={0.84}
                    style={[s.categoryBtn, level === 1 && s.categoryBtnWarm]}
                  >
                    <Text style={[s.categoryBtnText, level === 1 && { color: C.gold }]}>Spiritual</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setLevel(2)}
                    activeOpacity={0.84}
                    style={[s.categoryBtn, level === 2 && s.categoryBtnNeutral]}
                  >
                    <Text style={[s.categoryBtnText, level === 2 && { color: '#111827' }]}>Routine</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {!task && isSpiritual && defaultType == null && (
              <View style={s.editorBlock}>
                <Text style={s.mutedLabel}>Type</Text>
                <View style={s.typeGrid}>
                  {SPIRITUAL_TYPES.map(item => {
                    const active = type === item.id;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => setType(item.id)}
                        activeOpacity={0.84}
                        style={[
                          s.typeChip,
                          active && { backgroundColor: accent, borderColor: accent },
                        ]}
                      >
                        <item.Icon s={18} c={active ? '#FFFFFF' : '#9CA3AF'} />
                        <Text style={[s.typeChipText, active && { color: '#FFFFFF' }]}>{item.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {canEditRoutineIcon && (
              <View style={s.editorBlock}>
                <Text style={s.mutedLabel}>Icon</Text>
                <View style={s.iconGrid} onLayout={event => setRoutineIconGridWidth(event.nativeEvent.layout.width)}>
                  {visibleRoutineIcons.map(item => {
                    const active = icon === item.id;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => setIcon(item.id)}
                        activeOpacity={0.84}
                        style={[
                          s.iconChip,
                          { width: routineIconChipSize, height: routineIconChipSize },
                          active && s.iconChipActive,
                        ]}
                      >
                        <View style={s.iconGlyphBox}>
                          <item.Icon s={22} c={active ? '#FFFFFF' : '#4B5563'} w={1.8} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {ROUTINE_ICONS.length > VISIBLE_ROUTINE_ICON_COUNT && (
                  <TouchableOpacity
                    onPress={() => {
                      animateRoutineLayoutChange();
                      setShowAllRoutineIcons(value => !value);
                    }}
                    activeOpacity={0.84}
                    style={s.viewMoreIconsBtn}
                  >
                    <Text style={s.viewMoreIconsText}>{showAllRoutineIcons ? 'View Less' : 'View More'}</Text>
                    <View style={showAllRoutineIcons ? s.viewMoreIconOpen : undefined}>
                      <ChevronDown s={15} c="#8B909A" />
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={s.editorBlock}>
              <TaskFrequencyEditor
                frequency={frequency}
                selectedDays={selectedDayIndexes}
                monthlyDays={monthlyDays}
                onFrequencyChange={nextFrequency => {
                  animateRoutineLayoutChange();
                  setFrequency(nextFrequency);
                  if (nextFrequency === 'daily') setSelectedDays([]);
                  if (nextFrequency === 'weekdays') setSelectedDays([1, 2, 3, 4, 5]);
                  if (nextFrequency === 'weekends') setSelectedDays([6, 0]);
                  if (nextFrequency === 'monthly') setSameTimeEveryDay(true);
                }}
                onSelectedDaysChange={indexes => setSelectedDays(taskIndexesToSelectedDays(indexes))}
                onMonthlyDaysChange={setMonthlyDays}
                accent={accent}
                label="Schedule"
              />
            </View>

            <View style={s.editorBlock}>
              <TaskTimeEditor
                time={time}
                sameTimeEveryDay={sameTimeEveryDay}
                dayTimes={dayTimes}
                onTimeChange={setTime}
                onSameTimeEveryDayChange={nextValue => {
                  animateRoutineLayoutChange();
                  setSameTimeEveryDay(nextValue);
                }}
                onDayTimesChange={nextTimes => setDayTimeOverrides(taskDayTimesToOverrides(nextTimes, activeTaskIndexes))}
                activeDayIndexes={activeTaskIndexes}
                allowPerDayTimes={allowPerDayTimes}
                accent={accent}
                softBg={isSpiritual ? '#FFFBEB' : '#F9FAFB'}
                borderColor={isSpiritual ? 'rgba(197,160,89,0.24)' : '#E5E7EB'}
                mutedColor="#8B909A"
              />
            </View>

            <View style={s.editorBlock}>
              <NotificationSettings
                mode={notificationMode}
                reminderMinutes={reminderMinutes}
                onModeChange={setNotificationMode}
                onReminderChange={setReminderMinutes}
                accent={accent}
              />
            </View>

            {task && (
              <TouchableOpacity onPress={() => setConfirmDeleteVisible(true)} activeOpacity={0.84} style={s.deleteBtn}>
                <Trash2 s={16} c="#EF4444" />
                <Text style={s.deleteBtnText}>Delete Activity</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
    </SmoothBottomSheet>
    <ConfirmModal
      visible={confirmDeleteVisible}
      icon={<Trash2 s={22} c="#EF4444" />}
      title="Delete Activity?"
      body={task ? `"${task.title}" will be removed from your routine and Home tasks.` : ''}
      confirmLabel="DELETE"
      confirmColor="#EF4444"
      onCancel={() => setConfirmDeleteVisible(false)}
      onConfirm={() => {
        if (!task) return;
        setConfirmDeleteVisible(false);
        void onDelete(task.id);
      }}
    />
    </>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAFA' },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 120, gap: 28 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingHorizontal: 4 },
  sectionBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 4 },
  sectionKicker: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.8, color: C.gold, textTransform: 'uppercase' },
  dayTabsRow: { gap: 7, paddingBottom: 2, paddingHorizontal: 1 },
  dayTabPress: { borderRadius: 16 },
  dayTab: {
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0EDE6',
    paddingHorizontal: 14,
    paddingVertical: 11,
    overflow: 'hidden',
    position: 'relative',
  },
  dayTabActive: {
    borderWidth: 0,
    shadowColor: '#A87E33',
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 4,
  },
  dayTabSheen: {
    position: 'absolute',
    top: 1, left: 1, right: 1,
    height: '46%',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  dayTabRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(150,108,40,0.32)',
  },
  dayTabLabel: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.4, color: '#A8A29E', textTransform: 'uppercase' },
  dayTabLabelActive: { color: '#FFFFFF', letterSpacing: 1.6 },
  dayTabMarker: { position: 'absolute', bottom: 5, width: 14, height: 1.5, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.85)' },
  taskStack: { paddingTop: 4 },
  gapRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 1 },
  gapLine: { width: 34, borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#D6D3D1' },
  gapText: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.3, color: '#A8A29E', textTransform: 'uppercase' },
  taskCardWrap: { position: 'relative', marginBottom: 3 },
  emptyBlock: { paddingVertical: 28, alignItems: 'center' },
  emptyTitle: { fontFamily: F.serifItalic, fontSize: 15, color: '#A8A29E' },
  addRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  addRowDivider: {
    height: 1,
    backgroundColor: '#EDE9E0',
    marginTop: 18,
    marginHorizontal: 22,
    opacity: 0.7,
  },
  addBtnPress: { flex: 1, borderRadius: 18 },
  addBtn: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  addSpiritualBtn: {
    borderColor: 'rgba(197,160,89,0.45)',
    shadowColor: '#C5A059',
    shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 1,
  },
  addRoutineBtn: {
    borderColor: '#CBD5E1',
    shadowColor: '#1F2937',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 1,
  },
  addIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIconCircleNeutral: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSpiritualText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.8, color: C.gold, textTransform: 'uppercase' },
  addRoutineText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.8, color: '#6B7280', textTransform: 'uppercase' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 6 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E7E5E4' },
  roundMiniBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0EDE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentWrap: { flexDirection: 'row', backgroundColor: '#F4F0E7', borderRadius: 20, padding: 4, gap: 4 },
  segmentBtn: { flex: 1, minHeight: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  segmentBtnActive: { backgroundColor: '#FFFFFF' },
  segmentText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.3, color: '#9CA3AF', textTransform: 'uppercase' },
  segmentTextActive: { color: C.gold },
  helperBody: { marginTop: 10, paddingHorizontal: 4, fontFamily: F.serif, fontSize: 13, lineHeight: 20, color: '#A8A29E' },
  habitList: { gap: 12, paddingTop: 14 },
  habitCard: {
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0EDE6',
    overflow: 'hidden',
  },
  habitCardPaused: { backgroundColor: '#F8F5EF', borderColor: '#E8DFC9' },
  habitHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
  habitIconWrap: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  habitEmoji: { fontSize: 20 },
  habitTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  habitTitle: { flex: 1, fontFamily: F.serifMedium, fontSize: 17, color: '#111827' },
  habitCount: { fontFamily: F.serifMedium, fontSize: 16 },
  habitMeta: { marginTop: 3, fontFamily: F.serif, fontSize: 13, color: '#A8A29E' },
  habitBar: { marginTop: 9, height: 5, borderRadius: 999, backgroundColor: '#F3F4F6', overflow: 'hidden' },
  habitBarFill: { height: '100%', borderRadius: 999 },
  habitBody: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#F5F5F4' },
  habitStepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
  habitStepCheck: { width: 22, height: 22, borderRadius: 8, borderWidth: 1.5, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  habitStepTitle: { fontFamily: F.serif, fontSize: 18, lineHeight: 22, color: '#1F2937' },
  habitStepTitleDone: { color: '#A8A29E', textDecorationLine: 'line-through' },
  habitStepMeta: { marginTop: 4, fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.3, color: '#A8A29E', textTransform: 'uppercase' },
  inlineActionGrid: { flexDirection: 'row', gap: 8, marginTop: 10 },
  inlineActionBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineActionNeutral: { backgroundColor: '#F5F5F4' },
  inlineActionWarm: { backgroundColor: '#F7F1E7', borderColor: '#DCC6A0' },
  inlineActionText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.4, color: '#6B7280', textTransform: 'uppercase' },
  inlineTextBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  inlineTextBtnLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.2, color: '#A8A29E', textTransform: 'uppercase' },
  challengeList: { gap: 10, paddingTop: 6 },
  challengeCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderColor: 'rgba(197,160,89,0.35)',
    borderLeftColor: C.gold,
    borderRightColor: C.gold,
    backgroundColor: '#FFFDF7',
    padding: 16,
  },
  challengeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  challengeBadge: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.6, color: '#7C3AED', textTransform: 'uppercase', backgroundColor: '#F3E8FF', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 5 },
  challengeStreak: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFF7ED', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  challengeStreakText: { fontFamily: F.sansBold, fontSize: 10, color: '#F97316' },
  challengeTitle: { fontFamily: F.serifMedium, fontSize: 17, color: '#111827' },
  challengeMeta: { marginTop: 5, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.1, color: '#A08A63' },
  challengeProgressTrack: { marginTop: 12, height: 6, borderRadius: 999, backgroundColor: 'rgba(197,160,89,0.15)', overflow: 'hidden' },
  challengeProgressFill: { height: '100%', borderRadius: 999, backgroundColor: C.gold },
  viewAllChallenges: {
    marginTop: 6,
    minHeight: 52,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.35)',
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFDF7',
  },
  viewAllChallengesText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.6, color: C.gold, textTransform: 'uppercase' },
  sheetShell: { maxHeight: '88%', borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: '#FAFAFA', paddingBottom: 24 },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  sheetHeaderTitle: { fontFamily: F.serifMedium, fontSize: 20, color: '#111827' },
  sheetHeaderIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  sheetHeaderSpacer: { width: 38 },
  typeSheetContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20, gap: 10 },
  typeOptionCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F3F4F6', padding: 16 },
  typeOptionIcon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  typeOptionTitle: { fontFamily: F.serifMedium, fontSize: 16, color: '#111827' },
  typeOptionBody: { marginTop: 4, fontFamily: F.sans, fontSize: 12, color: '#A8A29E' },
  editorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  editorHeaderTitle: { fontFamily: F.serifMedium, fontSize: 20, color: '#111827' },
  saveCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  editorContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20, gap: 16 },
  editorBlock: { borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F2F1EC', padding: 18 },
  editorBlockLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 12 },
  mutedLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.6, color: '#A8A29E', textTransform: 'uppercase', marginBottom: 12 },
  titleInput: { minHeight: 52, borderRadius: 18, backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#F2F1EC', paddingHorizontal: 16, fontFamily: F.serif, fontSize: 22, color: '#111827' },
  toggleRow: { flexDirection: 'row', gap: 10 },
  categoryBtn: { flex: 1, minHeight: 48, borderRadius: 18, backgroundColor: '#F7F7F5', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  categoryBtnWarm: { backgroundColor: '#FFFBEB', borderColor: 'rgba(197,160,89,0.35)' },
  categoryBtnNeutral: { backgroundColor: '#FFFFFF', borderColor: '#111827' },
  categoryBtnText: { fontFamily: F.serifMedium, fontSize: 17, color: '#9CA3AF' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { width: '31%', minHeight: 74, borderRadius: 18, backgroundColor: '#F7F7F5', borderWidth: 1, borderColor: '#F2F1EC', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 6 },
  typeChipText: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.2, color: '#9CA3AF', textTransform: 'uppercase', textAlign: 'center' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 8 },
  iconChip: { borderRadius: 14, backgroundColor: '#F7F7F5', borderWidth: 1, borderColor: '#F2F1EC', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  iconChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  iconGlyphBox: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  iconChipText: { fontFamily: F.sansBold, fontSize: 7, letterSpacing: 1.1, color: '#9CA3AF', textTransform: 'uppercase', textAlign: 'center' },
  viewMoreIconsBtn: { marginTop: 10, minHeight: 38, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#D6D3D1', backgroundColor: '#FAFAFA', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  viewMoreIconsText: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.7, color: '#6B7280', textTransform: 'uppercase' },
  viewMoreIconOpen: { transform: [{ rotate: '180deg' }] },
  scheduleCard: { borderRadius: 22, backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#F2F1EC', padding: 16 },
  scheduleLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.5, color: '#A8A29E', textTransform: 'uppercase' },
  scheduleHint: { marginTop: 4, fontFamily: F.serif, fontSize: 12, lineHeight: 18, color: '#A8A29E', maxWidth: 220 },
  timeInput: { marginTop: 8, minHeight: 46, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0EDE6', paddingHorizontal: 14, fontFamily: F.serifMedium, fontSize: 20, color: '#111827' },
  frequencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  frequencyChip: { minHeight: 36, borderRadius: 18, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  frequencyChipText: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.3, color: '#9CA3AF', textTransform: 'uppercase' },
  daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  dayChip: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  dayChipText: { fontFamily: F.sansBold, fontSize: 11, color: '#A8A29E' },
  sameTimeRow: { marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  overrideList: { gap: 10, marginTop: 14 },
  overrideRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  overrideLabel: { fontFamily: F.serifMedium, fontSize: 16, color: '#111827' },
  overrideInput: { width: 92, minHeight: 42, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0EDE6', paddingHorizontal: 12, fontFamily: F.serifMedium, fontSize: 17, color: '#111827' },
  notificationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  notificationChip: { minHeight: 34, borderRadius: 17, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  notificationChipText: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.2, color: '#9CA3AF', textTransform: 'uppercase' },
  reminderRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  reminderChip: { minHeight: 34, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  reminderChipText: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.2, color: '#6B7280', textTransform: 'uppercase' },
  deleteBtn: { marginTop: 4, minHeight: 50, borderRadius: 18, backgroundColor: '#FEF2F2', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  deleteBtnText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.6, color: '#EF4444', textTransform: 'uppercase' },
});
