import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import ConfirmModal from '@/components/shared/ConfirmModal';
import NotificationSettings, { type NotificationMode as SharedNotificationMode } from '@/components/shared/NotificationSettings';
import SetAsTaskSheet, {
  ChallengePanel,
  defaultChallengeSchedule,
  type ChallengeChurchScheduleDraft,
  type ChallengeScheduleDraft,
  type PrayerChallengeRuleChoice,
} from '@/components/shared/SetAsTaskSheet';
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
  OrthodoxCross,
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
import RoutinePhonePlanCard from '@/components/focus-watch/RoutinePhonePlanCard';
import { C, F } from '@/constants/tokens';
import type { HabitItem, HabitStep } from '@/components/habits/habitDb';
import { habitStepTaskId, listHabitsWithStats, saveHabitRecord } from '@/components/habits/habitDb';
import HabitsView, { type HabitsViewHandle } from '@/components/habits/HabitsView';
import { NotoEmoji } from '@/components/shared/NotoEmoji';
import { normalizeHabitIcon } from '@/components/shared/notoEmoji/legacyMap';
import { useInnerTools } from '@/components/inner-tools/InnerToolsContext';
import { useReadingList } from '@/components/library/ReadingListContext';
import { useChallenges } from '@/components/challenges/ChallengesContext';
import type { ChallengeRecord } from '@/components/challenges/challengeData';
import { useTasks } from '@/components/tasks/TaskProvider';
import { getPrayerTaskConfig, getScriptureTaskConfig } from '@/components/tasks/taskDb';
import { resolveDisplayIcon, resolveDisplayType, resolveTaskVariant } from '@/components/tasks/taskAdapters';
import type { PrayerTaskConfig, ScriptureTaskConfig, TaskDefinition, TaskDraft, TaskLevel } from '@/components/tasks/taskTypes';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import {
  notifyGuideEvent,
  useGuidedSetup,
  useGuideTarget,
} from '@/components/onboarding/guided/GuidedSetupContext';
import { GuidedOverlayHost } from '@/components/onboarding/guided/GuidedOverlayHost';
import QuickTaskSheet, { QUICK_TASK_GUIDE_TARGETS } from '@/components/shared/QuickTaskSheet';


type RoutineFrequency = TaskFrequency;
type NotificationMode = SharedNotificationMode;
type RoutineLevel = TaskLevel;
type SpiritualType = TaskDefinition['type'];
type RoutineTaskSheetContext = 'prayer' | 'journal' | 'scripture';
type JesusPrayerMode = 'duration' | 'count';
type RoutinePrayerType = 'morning' | 'evening' | 'meal';
type RoutinePrayerRuleChoice = PrayerChallengeRuleChoice | 'breakfast' | 'lunch' | 'dinner';
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

function hexToRgba(hex: string | undefined, alpha: number) {
  const normalized = hex?.replace('#', '') ?? '';
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return `rgba(31, 41, 55, ${alpha})`;
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Exported for the onboarding builders, which reuse the same editor sheet.
export type RoutineTask = {
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
  prayerConfig?: Omit<PrayerTaskConfig, 'taskId'>;
  scriptureConfig?: Omit<ScriptureTaskConfig, 'taskId'>;
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
  { id: 'church', label: 'Church', desc: 'Liturgy and church attendance reminders', accent: '#7C3AED', Icon: Cross },
  { id: 'custom', label: 'Custom', desc: 'Create your own spiritual activity', accent: '#374151', Icon: Sparkles },
];

const GRATITUDE_ACCENT = '#F43F5E';
const READING_TASK_ID_PREFIX = 'reading_book_';

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
const MY_ROUTINE_GUIDE_TARGETS = {
  addRow: 'my-routine.add-row',
  spiritualAdd: 'my-routine.spiritual-add',
  spiritualType: 'my-routine.spiritual-type',
  routineAdd: 'my-routine.routine-add',
  dayTabs: 'my-routine.day-tabs',
  title: 'my-routine.title',
  save: 'my-routine.save',
  taskCard: 'my-routine.task-card',
  habits: 'my-routine.habits',
  challenges: 'my-routine.challenges',
  blockingPlan: 'my-routine.blocking-plan',
} as const;
const ROUTINE_PRAYER_RULES: { key: PrayerChallengeRuleChoice; label: string; desc: string }[] = [
  { key: 'personal', label: 'My Rule', desc: 'For Christians of every tradition — Catholic, Protestant, Orthodox, non-denominational, and any other.' },
  { key: 'standard', label: 'Standard Rule', desc: 'Full morning or evening prayers' },
  { key: 'short', label: 'Shortened Rule', desc: 'Abbreviated prayer rule' },
  { key: 'seraphim', label: 'St. Seraphim Rule', desc: 'Rule of St. Seraphim of Sarov' },
];

const ROUTINE_MEAL_PRAYER_RULES: { key: RoutinePrayerRuleChoice; label: string; desc: string }[] = [
  { key: 'personal', label: 'My Rule', desc: 'Your own meal prayer or blessing' },
  { key: 'breakfast', label: 'Breakfast Prayer', desc: 'Prayer before the morning meal' },
  { key: 'lunch', label: 'Lunch Prayer', desc: 'Prayer before the midday meal' },
  { key: 'dinner', label: 'Dinner Prayer', desc: 'Prayer before the evening meal' },
];

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
    prayerConfig: undefined,
    scriptureConfig: undefined,
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

function readingBookIdFromTaskId(taskId: string) {
  return taskId.startsWith(READING_TASK_ID_PREFIX)
    ? taskId.slice(READING_TASK_ID_PREFIX.length)
    : null;
}

export function routineTaskToDraft(task: RoutineTask): TaskDraft {
  const dayTimes = overridesToTaskDayTimes(task.dayTimeOverrides ?? []);
  const subtitle = isJesusPrayerRoutineTask(task)
    ? getJesusPrayerRoutineSubtitle(task)
    : isScriptureRoutineTask(task)
      ? getScriptureRoutineSubtitle(task)
    : isRoutinePrayerRuleTask(task)
      ? getPrayerRuleRoutineSubtitle(task)
    : task.source === 'routine' || task.source === 'spiritual'
      ? getTaskFrequencyLabel(task)
      : task.subtitle ?? getTaskFrequencyLabel(task);
  return {
    id: task.id,
    title: task.title,
    subtitle,
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
    prayerConfig: task.prayerConfig,
    scriptureConfig: task.scriptureConfig,
  };
}

function isScriptureRoutineTask(task: RoutineTask | null | undefined) {
  return task?.source === 'spiritual'
    && task.type === 'reading'
    && task.targetView !== '/reading-list';
}

function inferScriptureReadingType(task: RoutineTask | null | undefined): ScriptureTaskConfig['readingType'] {
  const configured = task?.scriptureConfig?.readingType;
  if (
    configured === 'new_testament'
    || configured === 'old_testament'
    || configured === 'psalter'
    || configured === 'church_calendar'
    || configured === 'custom'
  ) {
    return configured;
  }

  const label = `${task?.title ?? ''} ${task?.subtitle ?? ''}`.toLowerCase();
  if (label.includes('church') || label.includes('lectionary')) return 'church_calendar';
  if (label.includes('psalter') || label.includes('psalm')) return 'psalter';
  if (label.includes('old testament')) return 'old_testament';
  if (label.includes('new testament')) return 'new_testament';
  return 'custom';
}

function normalizeScriptureChaptersPerDay(task: RoutineTask | null | undefined, readingType = inferScriptureReadingType(task)) {
  if (readingType === 'church_calendar') return 0;
  const configured = Number(task?.scriptureConfig?.chaptersPerDay);
  if (Number.isFinite(configured) && configured > 0) return Math.round(configured);

  const label = `${task?.title ?? ''} ${task?.subtitle ?? ''}`;
  const match = label.match(/\b(\d{1,2})\s*(?:chapter|chapters|psalm|psalms)\b/i)
    ?? label.match(/\b(?:chapter|chapters|psalm|psalms)\s*(?:per\s*day|\/day)?\D{0,8}(\d{1,2})\b/i);
  const parsed = Number.parseInt(match?.[1] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 1;
}

function scriptureAmountLabel(readingType: ScriptureTaskConfig['readingType'], amount: number) {
  if (readingType === 'church_calendar') return 'Church readings';
  const safeAmount = Math.max(1, Math.round(Number.isFinite(amount) ? amount : 1));
  if (readingType === 'psalter') return `${safeAmount} ${safeAmount === 1 ? 'psalm' : 'psalms'}/day`;
  return `${safeAmount} ${safeAmount === 1 ? 'chapter' : 'chapters'}/day`;
}

function getScriptureRoutineSubtitle(task: RoutineTask) {
  const readingType = inferScriptureReadingType(task);
  return `${scriptureAmountLabel(readingType, normalizeScriptureChaptersPerDay(task, readingType))} - ${getTaskFrequencyLabel(task)}`;
}

function isJesusPrayerRoutineTask(task: RoutineTask | null | undefined) {
  const label = `${task?.title ?? ''} ${task?.subtitle ?? ''}`.toLowerCase();
  return task?.type === 'prayer'
    && (
      task.prayerConfig?.prayerTaskKind === 'jesus_prayer'
      || task.prayerConfig?.prayerType === 'jesus'
      || task.targetView === '/jesus-prayer'
      || label.includes('jesus')
      || label.includes('isus')
    );
}

function normalizeJesusMode(value?: string): JesusPrayerMode {
  return value === 'count' ? 'count' : 'duration';
}

function normalizeJesusQuantity(value: number | string | undefined, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getJesusPrayerRoutineSubtitle(task: RoutineTask) {
  const mode = normalizeJesusMode(task.prayerConfig?.jesusPrayerMode);
  if (mode === 'count') {
    return `${normalizeJesusQuantity(task.prayerConfig?.jesusPrayerCount, 100)} repetitions - ${getTaskFrequencyLabel(task)}`;
  }
  return `${normalizeJesusQuantity(task.prayerConfig?.jesusPrayerDuration, 15)} min - ${getTaskFrequencyLabel(task)}`;
}

function routinePrayerType(task: RoutineTask | null | undefined): RoutinePrayerType | null {
  if (
    task?.prayerConfig?.prayerType === 'morning'
    || task?.prayerConfig?.prayerType === 'evening'
    || task?.prayerConfig?.prayerType === 'meal'
  ) {
    return task.prayerConfig.prayerType;
  }

  const label = `${task?.title ?? ''} ${task?.subtitle ?? ''}`.toLowerCase();
  const rule = task?.prayerConfig?.prayerRule;
  if (
    rule === 'breakfast'
    || rule === 'lunch'
    || rule === 'dinner'
    || label.includes('meal')
    || label.includes('breakfast')
    || label.includes('lunch')
    || label.includes('dinner')
  ) return 'meal';
  if (label.includes('evening')) return 'evening';
  if (label.includes('morning')) return 'morning';
  return null;
}

function isRoutinePrayerRuleTask(task: RoutineTask | null | undefined) {
  if (!task || task.type !== 'prayer' || isJesusPrayerRoutineTask(task)) return false;
  const type = routinePrayerType(task);
  return type === 'morning' || type === 'evening' || type === 'meal';
}

function normalizeRoutinePrayerRule(task: RoutineTask | null | undefined): RoutinePrayerRuleChoice {
  if (task?.prayerConfig?.prayerTaskKind === 'personal_rule' || task?.targetView === '/personal-rule') return 'personal';
  const rule = task?.prayerConfig?.prayerRule;
  if (routinePrayerType(task) === 'meal') {
    if (rule === 'personal' || rule === 'breakfast' || rule === 'lunch' || rule === 'dinner') return rule;
    return 'breakfast';
  }
  if (rule === 'personal' || rule === 'standard' || rule === 'short' || rule === 'seraphim') return rule;
  return 'standard';
}

function routinePrayerRuleSummary(rule: RoutinePrayerRuleChoice) {
  switch (rule) {
    case 'personal': return 'My Rule';
    case 'standard': return 'Standard Rule';
    case 'short': return 'Shortened Rule';
    case 'seraphim': return 'St. Seraphim Rule';
    case 'breakfast': return 'Breakfast Prayer';
    case 'lunch': return 'Lunch Prayer';
    case 'dinner': return 'Dinner Prayer';
    default: return 'Prayer Rule';
  }
}

function getPrayerRuleRoutineSubtitle(task: RoutineTask, rule = normalizeRoutinePrayerRule(task)) {
  return `${routinePrayerRuleSummary(rule)} - ${getTaskFrequencyLabel(task)}`;
}

function prayerRuleAccentForTask(task: RoutineTask | null | undefined) {
  const type = routinePrayerType(task);
  if (type === 'evening') return '#7867C6';
  if (type === 'meal') return '#7D8FC9';
  return '#D59D2C';
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

function habitStepToRoutineTask(habit: HabitItem, step: HabitStep): RoutineTask {
  return {
    id: habitStepTaskId(habit.id, step.id),
    title: step.title,
    subtitle: `${habit.name} - ${getHabitFrequencyLabel(step)}`,
    level: 3,
    source: 'habit',
    type: 'custom',
    icon: habit.icon as RoutineIconName,
    habitColor: habit.color,
    targetView: '/habits',
    targetTab: habit.id,
    status: habit.active ? 'active' : 'paused',
    time: step.time,
    frequency: step.frequency,
    selectedDays: taskIndexesToSelectedDays(step.selectedDays ?? []),
    monthlyDays: step.monthlyDays ?? [1],
    sameTimeEveryDay: step.sameTimeEveryDay ?? true,
    dayTimeOverrides: taskDayTimesToOverrides(step.dayTimes ?? {}, [0, 1, 2, 3, 4, 5, 6]),
    notificationMode: step.notificationMode ?? 'none',
    reminderMinutes: step.reminderMinutes,
  };
}

function challengeScheduleFromRecord(challenge: ChallengeRecord): ChallengeScheduleDraft {
  const saved = challenge.scriptureConfig ?? challenge.prayerConfig;
  return {
    time: saved?.time ?? challenge.time ?? '08:00',
    sameTimeEveryDay: saved?.sameTimeEveryDay ?? true,
    dayTimes: saved?.dayTimes ?? {},
    notificationMode: saved?.notificationMode ?? 'single',
    reminderMinutes: saved?.reminderMinutes ?? 15,
  };
}

function churchScheduleFromRecord(challenge: ChallengeRecord): ChallengeChurchScheduleDraft {
  return {
    frequency: challenge.churchConfig?.frequency ?? 'specific_days',
    selectedDays: challenge.churchConfig?.selectedDays?.length ? challenge.churchConfig.selectedDays : [6],
    monthlyDays: challenge.churchConfig?.monthlyDays?.length ? challenge.churchConfig.monthlyDays : [1],
    time: challenge.churchConfig?.time ?? challenge.time ?? '09:00',
    sameTimeEveryDay: challenge.churchConfig?.sameTimeEveryDay ?? true,
    dayTimes: challenge.churchConfig?.dayTimes ?? {},
    notificationMode: challenge.churchConfig?.notificationMode ?? 'single',
    reminderMinutes: challenge.churchConfig?.reminderMinutes ?? 15,
  };
}

function prayerRuleFromChallenge(challenge: ChallengeRecord): PrayerChallengeRuleChoice {
  if (challenge.prayerConfig?.taskKind === 'personal_rule') return 'personal';
  const rule = challenge.prayerConfig?.prayerRule;
  if (rule === 'standard' || rule === 'short' || rule === 'seraphim' || rule === 'personal') return rule;
  return 'personal';
}

export default function MyRoutineView({
  guided = false,
  onGuidedComplete,
}: {
  guided?: boolean;
  onGuidedComplete?: () => void;
} = {}) {
  const router = useRouter();
  const {
    challenges,
    activeChallenges,
    refreshChallenges,
    updateChallenge,
    pauseChallenge,
    resumeChallenge,
    endChallenge,
  } = useChallenges();
  const {
    tasks: backendTasks,
    createOrUpdateTask,
    remove: removeTask,
    refresh: refreshTasks,
  } = useTasks();
  const { updateBook } = useReadingList();
  const { setGratitudeTaskEnabled } = useInnerTools();
  const tasks = useMemo(
    () => backendTasks
      .filter(task => task.source !== 'quick' && task.status === 'active')
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
  const [challengeEditorItem, setChallengeEditorItem] = useState<ChallengeRecord | null>(null);
  const [challengeExpandedId, setChallengeExpandedId] = useState<string | null>(null);
  const [challengeSaveRequestId, setChallengeSaveRequestId] = useState(0);
  const [challengeSchedule, setChallengeSchedule] = useState<ChallengeScheduleDraft>(defaultChallengeSchedule('08:00'));
  const [challengePrayerRule, setChallengePrayerRule] = useState<PrayerChallengeRuleChoice>('personal');
  const [challengeJesusMode, setChallengeJesusMode] = useState<JesusPrayerMode>('duration');
  const [challengeJesusDuration, setChallengeJesusDuration] = useState('15');
  const [challengeJesusCount, setChallengeJesusCount] = useState('100');
  const [challengeScriptureDailyAmount, setChallengeScriptureDailyAmount] = useState(1);
  const [churchSchedule, setChurchSchedule] = useState<ChallengeChurchScheduleDraft>({
    frequency: 'specific_days',
    selectedDays: [6],
    monthlyDays: [1],
    time: '09:00',
    sameTimeEveryDay: true,
    dayTimes: {},
    notificationMode: 'single',
    reminderMinutes: 15,
  });
  const [habits, setHabits] = useState<HabitItem[]>([]);
  const habitsRef = useRef<HabitsViewHandle>(null);
  const routineScrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const [quickTaskSheetOpen, setQuickTaskSheetOpen] = useState(false);
  const quickTaskSavedRef = useRef(false);
  const {
    session,
    patchSession,
    setPresentation,
  } = useGuidedSetup();
  const isGuided = guided && session?.active === true && session.activeStep === 'buildMyRoutine';
  const guidePhase = isGuided ? session.phase : '';
  const addRowTarget = useGuideTarget(MY_ROUTINE_GUIDE_TARGETS.addRow, isGuided);
  const spiritualAddTarget = useGuideTarget(MY_ROUTINE_GUIDE_TARGETS.spiritualAdd, isGuided);
  const routineAddTarget = useGuideTarget(MY_ROUTINE_GUIDE_TARGETS.routineAdd, isGuided);
  const dayTabsTarget = useGuideTarget(MY_ROUTINE_GUIDE_TARGETS.dayTabs, isGuided);
  const taskCardTarget = useGuideTarget(MY_ROUTINE_GUIDE_TARGETS.taskCard, isGuided);
  const habitsTarget = useGuideTarget(MY_ROUTINE_GUIDE_TARGETS.habits, isGuided);
  const challengesTarget = useGuideTarget(MY_ROUTINE_GUIDE_TARGETS.challenges, isGuided);
  const blockingPlanTarget = useGuideTarget(MY_ROUTINE_GUIDE_TARGETS.blockingPlan, isGuided);

  // ─── Guided tour choreography ────────────────────────────────────────────
  // Mirrors the Home tour: glide the section into position, wait for the
  // scroll to settle, re-measure, then present on fresh coordinates.
  const guideInsets = useSafeAreaInsets();
  const { height: guideScreenHeight } = useWindowDimensions();
  const guideScrollY = useRef(0);
  const guideTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearGuideTimers = useCallback(() => {
    guideTimersRef.current.forEach(clearTimeout);
    guideTimersRef.current = [];
  }, []);

  const stageGuidePhase = useCallback((
    binding: ReturnType<typeof useGuideTarget> | null,
    position: 'origin' | 'lesson' | 'middle',
    present: () => void,
  ) => {
    const node = binding?.ref.current;
    if (!binding || !node?.measureInWindow) {
      guideTimersRef.current.push(setTimeout(present, 40));
      return;
    }
    if (position === 'origin') {
      if (guideScrollY.current < 4) {
        binding.measure();
        guideTimersRef.current.push(setTimeout(present, 56));
        return;
      }
      routineScrollRef.current?.scrollTo({ y: 0, animated: true });
      guideTimersRef.current.push(setTimeout(() => {
        binding.measure();
        guideTimersRef.current.push(setTimeout(present, 48));
      }, 330));
      return;
    }
    node.measureInWindow((_mx: number, my: number, _mw: number, mh: number) => {
      const desired = position === 'lesson'
        ? guideInsets.top + 124
        : Math.max(guideInsets.top + 90, guideScreenHeight * 0.5 - mh / 2);
      const delta = my - desired;
      if (Math.abs(delta) < 14) {
        binding.measure();
        guideTimersRef.current.push(setTimeout(present, 56));
        return;
      }
      routineScrollRef.current?.scrollTo({ y: Math.max(0, guideScrollY.current + delta), animated: true });
      guideTimersRef.current.push(setTimeout(() => {
        binding.measure();
        guideTimersRef.current.push(setTimeout(present, 48));
      }, 340));
    });
  }, [guideInsets.top, guideScreenHeight]);

  const finishGuidedRoutine = useCallback(() => {
    patchSession({
      activeStep: 'homeClimax',
      phase: 'intro',
      route: '/onboarding',
    });
    setPresentation(null);
    onGuidedComplete?.();
  }, [onGuidedComplete, patchSession, setPresentation]);

  useFocusEffect(
    useCallback(() => {
      void refreshChallenges();
    }, [refreshChallenges]),
  );

  const selectedDay = DAY_TABS[selectedDayIndex];

  const tasksForDay = useMemo(() => (
    tasks
      .filter(task => matchesTaskForDay(task, selectedDay.jsDay))
      .sort((left, right) => getTaskTimeForDay(left, selectedDay.jsDay).localeCompare(getTaskTimeForDay(right, selectedDay.jsDay)))
  ), [selectedDay.jsDay, tasks]);

  const refreshHabits = useCallback(async () => {
    const nextHabits = await listHabitsWithStats();
    setHabits(nextHabits);
  }, []);

  const handleHabitsChanged = useCallback((nextHabits: HabitItem[]) => {
    setHabits(nextHabits);
  }, []);

  useEffect(() => {
    let cancelled = false;
    refreshHabits()
      .then(() => {
        if (cancelled) return;
      })
      .catch(error => console.warn('Routine habits failed to load:', error));
    return () => {
      cancelled = true;
    };
  }, [refreshHabits]);

  useEffect(() => {
    if (!isGuided) return;
    // The tour follows the screen top-to-bottom: week tabs → add buttons →
    // the day's task list → the editor → habits → challenges → focus plan.
    if (guidePhase === 'tourWeek') {
      stageGuidePhase(dayTabsTarget, 'origin', () => {
        setPresentation({
          key: 'my-routine-tour-week',
          targetId: MY_ROUTINE_GUIDE_TARGETS.dayTabs,
          cutoutPadding: 7,
          placement: 'below',
          allowTargetInteraction: true,
          eyebrow: 'MY ROUTINE',
          progress: { current: 1, total: 7 },
          message: 'This is My Routine — the workshop behind your Home. Here you see the plan for every day of your week.',
          highlights: ['every day'],
          action: 'Tap a day to see its plan change below',
          hint: 'tap',
          hintAnchor: 'left',
          // Monday is already selected — pulse on the SECOND tab so a tap
          // visibly changes the list underneath.
          hintOffset: { x: 62 },
          ctaLabel: 'Continue',
          onCta: () => patchSession({ phase: 'tourAdd' }),
        });
      });
      return;
    }
    if (guidePhase === 'tourAdd') {
      stageGuidePhase(addRowTarget, 'origin', () => {
        setPresentation({
          key: 'my-routine-tour-add',
          targetId: MY_ROUTINE_GUIDE_TARGETS.addRow,
          cutoutPadding: 7,
          placement: 'below',
          allowTargetInteraction: false,
          eyebrow: 'MY ROUTINE',
          progress: { current: 2, total: 7 },
          message: 'New spiritual and routine tasks are added here — each lands on the days you choose.',
          highlights: ['spiritual', 'routine'],
          ctaLabel: 'Continue',
          onCta: () => patchSession({ phase: 'edit' }),
        });
      });
      return;
    }
    if (guidePhase === 'intro') {
      patchSession({ phase: 'spiritualAdd' });
      return;
    }
    if (guidePhase === 'spiritualAdd') {
      setPresentation({
        key: 'my-routine-spiritual-add',
        targetId: MY_ROUTINE_GUIDE_TARGETS.spiritualAdd,
        cutoutPadding: 7,
        placement: 'below',
        allowTargetInteraction: true,
        message: 'A stable week leaves a visible place for what matters most.\n\nAdd one spiritual task.',
      });
      return;
    }
    if (guidePhase === 'spiritualType') {
      setPresentation({
        key: 'my-routine-spiritual-type',
        targetId: MY_ROUTINE_GUIDE_TARGETS.spiritualType,
        cutoutPadding: 7,
        placement: 'above',
        allowTargetInteraction: true,
        message: 'Choose Custom for your first spiritual commitment.\n\nYou can explore the guided prayer and Scripture options later.',
      });
      return;
    }
    if (guidePhase === 'spiritualName') {
      setPresentation({
        key: 'my-routine-spiritual-name',
        targetId: MY_ROUTINE_GUIDE_TARGETS.title,
        cutoutPadding: 7,
        placement: 'above',
        allowTargetInteraction: true,
        message: 'Name a spiritual practice you want to keep visible in your week.\n\nFor example: Morning prayer.',
      });
      return;
    }
    if (guidePhase === 'spiritualSave') {
      setPresentation({
        key: 'my-routine-spiritual-save',
        targetId: MY_ROUTINE_GUIDE_TARGETS.save,
        cutoutPadding: 7,
        placement: 'below',
        allowTargetInteraction: true,
        message: 'Save your spiritual task.',
      });
      return;
    }
    if (guidePhase === 'routineAdd') {
      setPresentation({
        key: 'my-routine-routine-add',
        targetId: MY_ROUTINE_GUIDE_TARGETS.routineAdd,
        cutoutPadding: 7,
        placement: 'below',
        allowTargetInteraction: true,
        message: 'Now give one repeated responsibility a clear place.\n\nAdd a routine task.',
      });
      return;
    }
    if (guidePhase === 'routineName') {
      setPresentation({
        key: 'my-routine-routine-name',
        targetId: MY_ROUTINE_GUIDE_TARGETS.title,
        cutoutPadding: 7,
        placement: 'above',
        allowTargetInteraction: true,
        message: 'Name one routine you want to return to consistently.\n\nFor example: Plan tomorrow.',
      });
      return;
    }
    if (guidePhase === 'routineSave') {
      setPresentation({
        key: 'my-routine-routine-save',
        targetId: MY_ROUTINE_GUIDE_TARGETS.save,
        cutoutPadding: 7,
        placement: 'below',
        allowTargetInteraction: true,
        message: 'Save your routine task.',
      });
      return;
    }
    if (guidePhase === 'quickOffer') {
      setPresentation({
        key: 'my-routine-quick-offer',
        placement: 'center',
        message: 'Some things do not need a routine.\n\nQuick Tasks catch small one-time responsibilities without breaking your flow.',
        ctaLabel: 'Add a quick task',
        onCta: () => {
          quickTaskSavedRef.current = false;
          setQuickTaskSheetOpen(true);
          patchSession({ phase: 'quickName' });
        },
        secondaryCtaLabel: 'Skip for now',
        onSecondaryCta: () => patchSession({ phase: 'weekly' }),
      });
      return;
    }
    if (guidePhase === 'quickName') {
      setPresentation({
        key: 'my-routine-quick-name',
        targetId: QUICK_TASK_GUIDE_TARGETS.title,
        cutoutPadding: 7,
        placement: 'above',
        allowTargetInteraction: true,
        message: 'Name one small task you want to remember today.',
      });
      return;
    }
    if (guidePhase === 'quickSave') {
      setPresentation({
        key: 'my-routine-quick-save',
        targetId: QUICK_TASK_GUIDE_TARGETS.save,
        cutoutPadding: 7,
        placement: 'below',
        allowTargetInteraction: true,
        message: 'Save this one-time task.',
      });
      return;
    }
    if (guidePhase === 'weekly') {
      setPresentation({
        key: 'my-routine-weekly',
        targetId: MY_ROUTINE_GUIDE_TARGETS.taskCard,
        cutoutPadding: 7,
        placement: 'below',
        allowTargetInteraction: false,
        message: 'This is your real weekly rhythm.\n\nThe tasks you just created already live here.',
        ctaLabel: 'Continue',
        onCta: () => patchSession({ phase: 'edit' }),
      });
      return;
    }
    if (guidePhase === 'edit') {
      stageGuidePhase(taskCardTarget, 'lesson', () => {
        setPresentation({
          key: 'my-routine-edit',
          targetId: MY_ROUTINE_GUIDE_TARGETS.taskCard,
          cutoutPadding: 7,
          placement: 'below',
          allowTargetInteraction: true,
          eyebrow: 'MY ROUTINE',
          progress: { current: 3, total: 7 },
          message: 'These are the tasks of the day you selected. When life changes, the plan bends with it.',
          highlights: ['tasks of the day'],
          action: 'Tap the task to open its editor',
          hint: 'tap',
          hintAnchor: 'right',
        });
      });
      return;
    }
    if (guidePhase === 'editSave') {
      setPresentation({
        key: 'my-routine-edit-save',
        targetId: MY_ROUTINE_GUIDE_TARGETS.save,
        cutoutPadding: 7,
        placement: 'below',
        allowTargetInteraction: true,
        eyebrow: 'MY ROUTINE',
        progress: { current: 4, total: 7 },
        message: 'This is the editor — name, time, repeat days, every detail of the task lives here.',
        highlights: ['editor'],
        action: 'When you are done, tap the check at the top right',
        hint: 'tap',
      });
      return;
    }
    if (guidePhase === 'tourHabits') {
      stageGuidePhase(habitsTarget, 'middle', () => {
        setPresentation({
          key: 'my-routine-tour-habits',
          targetId: MY_ROUTINE_GUIDE_TARGETS.habits,
          cutoutPadding: 7,
          placement: 'above',
          allowTargetInteraction: false,
          eyebrow: 'MY ROUTINE',
          progress: { current: 5, total: 7 },
          message: 'Habits live here, with every control they need — edit, start, or pause them as seasons change.',
          highlights: ['Habits'],
          ctaLabel: 'Continue',
          onCta: () => patchSession({ phase: 'tourChallenges' }),
        });
      });
      return;
    }
    if (guidePhase === 'tourChallenges') {
      stageGuidePhase(challengesTarget, 'middle', () => {
        setPresentation({
          key: 'my-routine-tour-challenges',
          targetId: MY_ROUTINE_GUIDE_TARGETS.challenges,
          cutoutPadding: 7,
          placement: 'above',
          allowTargetInteraction: false,
          eyebrow: 'MY ROUTINE',
          progress: { current: 6, total: 7 },
          message: 'Your prayer, Scripture, and journal challenges gather here.',
          highlights: ['challenges'],
          ctaLabel: 'Continue',
          onCta: () => patchSession({ phase: 'tourBlocking' }),
        });
      });
      return;
    }
    if (guidePhase === 'tourBlocking') {
      stageGuidePhase(blockingPlanTarget, 'middle', () => {
        setPresentation({
          key: 'my-routine-tour-blocking',
          targetId: MY_ROUTINE_GUIDE_TARGETS.blockingPlan,
          cutoutPadding: 7,
          placement: 'above',
          allowTargetInteraction: false,
          eyebrow: 'MY ROUTINE',
          progress: { current: 7, total: 7 },
          message: 'And at the bottom — which focus plan guards your attention on each day of the week.',
          highlights: ['focus plan'],
          ctaLabel: 'Finish tour',
          onCta: () => patchSession({ phase: 'complete' }),
        });
      });
      return;
    }
    if (guidePhase === 'complete') {
      setPresentation({
        key: 'my-routine-complete',
        celebrate: true,
        placement: 'center',
        eyebrow: 'MY ROUTINE',
        message: 'Your weekly rhythm is in place.\n\nHome carries the day. My Routine carries the week.',
        highlights: ['weekly rhythm'],
        ctaLabel: 'Continue',
        onCta: finishGuidedRoutine,
      });
    }
  }, [
    addRowTarget,
    blockingPlanTarget,
    challengesTarget,
    dayTabsTarget,
    finishGuidedRoutine,
    guidePhase,
    habitsTarget,
    isGuided,
    patchSession,
    setPresentation,
    stageGuidePhase,
    taskCardTarget,
  ]);

  useEffect(() => {
    if (!isGuided) return;
    const timer = setTimeout(() => {
      spiritualAddTarget.measure();
      routineAddTarget.measure();
      dayTabsTarget.measure();
      taskCardTarget.measure();
      habitsTarget.measure();
      challengesTarget.measure();
      blockingPlanTarget.measure();
    }, guidePhase === 'weekly' || guidePhase === 'edit' ? 280 : 140);
    return () => clearTimeout(timer);
  }, [
    blockingPlanTarget,
    challengesTarget,
    dayTabsTarget,
    guidePhase,
    habitsTarget,
    isGuided,
    routineAddTarget,
    spiritualAddTarget,
    taskCardTarget,
  ]);

  // Clears any pending stage timers whenever the phase moves on (or the tour
  // unmounts) so a stale presentation can never fire over a newer phase.
  useEffect(() => clearGuideTimers, [clearGuideTimers, guidePhase]);

  const openAddSpiritual = () => {
    setShowSpiritualTypePicker(true);
    if (isGuided) patchSession({ phase: 'spiritualType' });
  };

  const openAddRoutine = () => {
    setEditorTask(null);
    setEditorDefaultLevel(2);
    setEditorDefaultType(undefined);
    setEditorVisible(true);
    if (isGuided) patchSession({ phase: 'routineName' });
  };

  const openEditTask = (task: RoutineTask) => {
    setEditorTask(task);
    void (async () => {
      const [prayerConfig, scriptureConfig] = await Promise.all([
        task.type === 'prayer'
          ? getPrayerTaskConfig(task.id).catch(() => undefined)
          : Promise.resolve(undefined),
        isScriptureRoutineTask(task)
          ? getScriptureTaskConfig(task.id).catch(() => undefined)
          : Promise.resolve(undefined),
      ]);
      setEditorTask({
        ...task,
        prayerConfig: prayerConfig ? {
          prayerType: prayerConfig.prayerType,
          prayerRule: prayerConfig.prayerRule,
          prayerTaskKind: prayerConfig.prayerTaskKind,
          jesusPrayerMode: prayerConfig.jesusPrayerMode,
          jesusPrayerDuration: prayerConfig.jesusPrayerDuration,
          jesusPrayerCount: prayerConfig.jesusPrayerCount,
        } : task.prayerConfig,
        scriptureConfig: scriptureConfig ? {
          readingType: scriptureConfig.readingType,
          startBookId: scriptureConfig.startBookId,
          startChapter: scriptureConfig.startChapter,
          chaptersPerDay: scriptureConfig.chaptersPerDay,
          totalUnitsRead: scriptureConfig.totalUnitsRead,
        } : task.scriptureConfig,
      });
    })();
    setEditorDefaultLevel(undefined);
    setEditorDefaultType(undefined);
    setEditorVisible(true);
  };

  const openChallengeEdit = (challenge: ChallengeRecord) => {
    setChallengeEditorItem(challenge);
    setChallengeExpandedId(challenge.id);
    setChallengeSchedule(challengeScheduleFromRecord(challenge));
    setChurchSchedule(churchScheduleFromRecord(challenge));
    setChallengePrayerRule(prayerRuleFromChallenge(challenge));
    setChallengeJesusMode(normalizeJesusMode(challenge.prayerConfig?.jesusPrayerMode));
    setChallengeJesusDuration(String(challenge.prayerConfig?.jesusPrayerDuration ?? 15));
    setChallengeJesusCount(String(challenge.prayerConfig?.jesusPrayerCount ?? 100));
    setChallengeScriptureDailyAmount(Math.max(1, challenge.scriptureConfig?.chaptersPerDay ?? 1));
  };

  const openHabitStepEdit = (habit: HabitItem, step: HabitStep) => {
    const taskId = habitStepTaskId(habit.id, step.id);
    const existing = tasks.find(item => item.id === taskId);
    openEditTask(existing
      ? {
        ...existing,
        icon: existing.icon ?? habit.icon as RoutineIconName,
        habitColor: habit.color,
        targetView: existing.targetView ?? '/habits',
        targetTab: existing.targetTab ?? habit.id,
      }
      : habitStepToRoutineTask(habit, step));
  };

  const openTask = (task: RoutineTask) => {
    if (task.source === 'challenge') {
      const challenge = challenges.find(item => item.id === task.targetTab || task.id.includes(item.id));
      if (challenge) {
        openChallengeEdit(challenge);
        return;
      }
    }
    if (task.source === 'habit') {
      const habit = habits.find(item => item.id === task.targetTab || task.id.startsWith(`habit_${item.id}_`));
      if (habit) {
        openEditTask({
          ...task,
          icon: task.icon ?? habit.icon as RoutineIconName,
          habitColor: habit.color,
          targetView: task.targetView ?? '/habits',
          targetTab: task.targetTab ?? habit.id,
        });
        return;
      }
    }
    openEditTask(task);
  };

  const saveHabitBackedTask = async (task: RoutineTask) => {
    const habit = habits.find(item => item.id === task.targetTab || task.id.startsWith(`habit_${item.id}_`));
    if (!habit) {
      await createOrUpdateTask(routineTaskToDraft(task));
      return;
    }

    const prefix = `habit_${habit.id}_`;
    const stepId = task.id.startsWith(prefix) ? task.id.slice(prefix.length) : undefined;
    const currentStep = habit.steps.find(step => step.id === stepId);
    if (!currentStep) {
      await createOrUpdateTask(routineTaskToDraft(task));
      return;
    }

    const dayTimes = overridesToTaskDayTimes(task.dayTimeOverrides ?? []);
    const nextStep: HabitStep = {
      ...currentStep,
      title: task.title,
      time: task.time,
      frequency: task.frequency,
      selectedDays: task.frequency === 'specific_days' ? selectedDaysToTaskIndexes(task.selectedDays ?? []) : [],
      monthlyDays: task.frequency === 'monthly' ? task.monthlyDays ?? [1] : [1],
      sameTimeEveryDay: task.sameTimeEveryDay,
      dayTimes: task.sameTimeEveryDay ? {} : dayTimes,
      notificationMode: task.notificationMode,
      reminderMinutes: task.notificationMode === 'double' ? task.reminderMinutes : undefined,
    };
    const nextHabit: HabitItem = {
      ...habit,
      steps: habit.steps.map(step => step.id === nextStep.id ? nextStep : step),
    };

    await saveHabitRecord(nextHabit);
    await createOrUpdateTask(habitStepToTaskDraft(nextHabit, nextStep));
    setHabits(current => current.map(item => item.id === nextHabit.id ? nextHabit : item));
  };

  const handleTaskSave = async (task: RoutineTask) => {
    let savedTask: TaskDefinition | undefined;
    if (task.source === 'habit') {
      await saveHabitBackedTask(task);
    } else {
      savedTask = await createOrUpdateTask(routineTaskToDraft(task));
    }
    await refreshHabits();
    setEditorVisible(false);
    setEditorTask(null);
    setEditorDefaultLevel(undefined);
    setEditorDefaultType(undefined);
    if (!isGuided) return;

    // Tour lesson: the user closed the editor with the top-right check —
    // the walkthrough moves on to the sections below.
    if (guidePhase === 'editSave') {
      patchSession({ phase: 'tourHabits' });
      return;
    }

    if (guidePhase === 'spiritualName' || guidePhase === 'spiritualSave') {
      notifyGuideEvent({
        type: 'saved',
        step: 'buildMyRoutine',
        phase: 'routineAdd',
        entityKey: 'spiritualTask',
        entityId: savedTask?.id,
      });
      return;
    }
    if (guidePhase === 'routineName' || guidePhase === 'routineSave') {
      notifyGuideEvent({
        type: 'saved',
        step: 'buildMyRoutine',
        phase: 'quickOffer',
        entityKey: 'routineTask',
        entityId: savedTask?.id,
      });
      return;
    }
    if (guidePhase === 'editSave') {
      notifyGuideEvent({
        type: 'completed',
        step: 'buildMyRoutine',
        phase: 'tourHabits',
        entityKey: 'editedRoutineTask',
        entityId: savedTask?.id,
      });
    }
  };

  const handleTaskDelete = async (taskId: string) => {
    const targetTask = editorTask;
    if (targetTask?.source === 'habit') {
      const habit = habits.find(item => item.id === targetTask.targetTab || targetTask.id.startsWith(`habit_${item.id}_`));
      if (habit) {
        const prefix = `habit_${habit.id}_`;
        const stepId = targetTask.id.startsWith(prefix) ? targetTask.id.slice(prefix.length) : undefined;
        const nextHabit = {
          ...habit,
          steps: habit.steps.filter(step => step.id !== stepId),
        };
        await saveHabitRecord(nextHabit);
        setHabits(current => current.map(item => item.id === nextHabit.id ? nextHabit : item));
      }
    }

    if (targetTask?.source === 'reading_book') {
      const bookId = readingBookIdFromTaskId(targetTask.id);
      if (bookId) {
        await updateBook(bookId, { showOnHome: false });
      }
    }

    if (targetTask?.source === 'gratitude' || targetTask?.type === 'gratitude') {
      setGratitudeTaskEnabled(false);
    }

    await removeTask(taskId);
    await refreshHabits();
    setEditorVisible(false);
    setEditorTask(null);
  };

  const progressForHabit = (habit: HabitItem) => {
    const total = habit.steps.length;
    const done = habit.steps.filter(step => step.completedToday).length;
    return { total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
  };

  return (
    <View style={s.screen}>
      <ScreenTitleBar title="MY ROUTINE" showBack />

        <ScrollView
          ref={routineScrollRef}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          onScroll={isGuided ? event => { guideScrollY.current = event.nativeEvent.contentOffset.y; } : undefined}
          scrollEventThrottle={isGuided ? 16 : undefined}
        >
        <View>
          <View style={s.sectionHead}>
            <Calendar s={16} c={C.gold} />
            <Text style={s.sectionKicker}>Weekly Template</Text>
          </View>

          <View {...dayTabsTarget}>
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
          </View>

          <View {...addRowTarget} style={s.addRow}>
            <TouchableOpacity {...spiritualAddTarget} onPress={openAddSpiritual} activeOpacity={0.84} style={s.addBtnPress}>
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
            <TouchableOpacity {...routineAddTarget} onPress={openAddRoutine} activeOpacity={0.84} style={s.addBtnPress}>
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

                  <TouchableOpacity
                    {...(isGuided && (task.id === session?.createdIds.routineTask || (!session?.createdIds.routineTask && index === 0)) ? taskCardTarget : {})}
                    onPress={() => {
                      openTask(task);
                      if (isGuided && guidePhase === 'edit') patchSession({ phase: 'editSave' });
                    }}
                    activeOpacity={0.86}
                    style={s.taskCardWrap}
                  >
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

        <SectionDivider icon={<ListChecks s={17} c="#D1D5DB" />} />

        <View {...habitsTarget}>
          <View style={s.sectionBetween}>
            <View style={s.sectionHead}>
              <ListChecks s={16} c="#16A34A" />
              <Text style={[s.sectionKicker, { color: '#16A34A' }]}>Habits</Text>
            </View>
            <TouchableOpacity onPress={() => habitsRef.current?.openAddHabit()} activeOpacity={0.84} style={s.roundMiniBtn}>
              <Plus s={18} c="#16A34A" />
            </TouchableOpacity>
          </View>

          <HabitsView
            compact
            ref={habitsRef}
            onHabitsChanged={handleHabitsChanged}
          />
        </View>

        <SectionDivider icon={<Trophy s={17} c="#D1D5DB" />} />

        <View {...challengesTarget}>
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
                onPress={() => openChallengeEdit(challenge)}
              />
            ))}

            <TouchableOpacity onPress={() => router.push('/challenges')} activeOpacity={0.84} style={s.viewAllChallenges}>
              <View style={s.viewAllChallengesIconWrap}>
                <Trophy s={15} c={C.gold} />
              </View>
              <View style={s.viewAllChallengesCopy}>
                <Text style={s.viewAllChallengesText}>View All Challenges</Text>
                <Text style={s.viewAllChallengesHint}>Browse the challenge library</Text>
              </View>
              <ChevronRight s={16} c={C.gold} w={2.2} />
            </TouchableOpacity>
          </View>
        </View>

        <View {...blockingPlanTarget}>
          <RoutinePhonePlanCard dayIndex={selectedDayIndex} />
        </View>

      </ScrollView>

      <SpiritualTypePickerSheet
        visible={showSpiritualTypePicker}
        guided={isGuided}
        onClose={() => setShowSpiritualTypePicker(false)}
        onSelect={type => {
          setShowSpiritualTypePicker(false);
          if (type === 'prayer' || type === 'reading') {
            setSpiritualTaskContext(type === 'reading' ? 'scripture' : type);
            return;
          }
          setEditorTask(null);
          setEditorDefaultLevel(1);
          setEditorDefaultType(type);
          setEditorVisible(true);
          if (isGuided) patchSession({ phase: 'spiritualName' });
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

      <SmoothBottomSheet
        visible={!!challengeEditorItem}
        onClose={() => {
          setChallengeEditorItem(null);
          setChallengeExpandedId(null);
        }}
        sheetStyle={s.sheetShell}
        keyboardAware
      >
        <View style={s.sheetHandle} />
        <View style={s.sheetHeader}>
          <TouchableOpacity
            onPress={() => {
              setChallengeEditorItem(null);
              setChallengeExpandedId(null);
            }}
            activeOpacity={0.84}
            style={s.sheetHeaderIcon}
          >
            <X s={20} c="#9CA3AF" />
          </TouchableOpacity>
          <Text style={s.sheetHeaderTitle}>Edit Challenge</Text>
          <TouchableOpacity
            onPress={() => setChallengeSaveRequestId(current => current + 1)}
            activeOpacity={0.84}
            style={[s.saveCircle, { backgroundColor: C.gold }]}
          >
            <CheckSmall s={18} c="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={s.challengeEditorSheetContent} showsVerticalScrollIndicator={false}>
          {challengeEditorItem && (
            <ChallengePanel
              context={challengeEditorItem.category as any}
              activeItems={challengeEditorItem.status === 'active' ? [challengeEditorItem] : []}
              pausedItems={challengeEditorItem.status === 'paused' ? [challengeEditorItem] : []}
              availableItems={[]}
              selectedCatalog={null}
              selectedPaceId={null}
              challengeSchedule={challengeSchedule}
              scriptureDailyAmount={challengeScriptureDailyAmount}
              challengePrayerRule={challengePrayerRule}
              challengeJesusMode={challengeJesusMode}
              challengeJesusDuration={challengeJesusDuration}
              challengeJesusCount={challengeJesusCount}
              churchSchedule={churchSchedule}
              expandedChallengeId={challengeExpandedId}
              recentlyStartedTemplateId={null}
              externalSaveRequestId={challengeSaveRequestId}
              showActiveLabel={false}
              showPausedLabel={false}
              onOpenSetup={() => {}}
              onSelectedPaceIdChange={() => {}}
              onChallengeScheduleChange={setChallengeSchedule}
              onScriptureDailyAmountChange={setChallengeScriptureDailyAmount}
              onChallengePrayerRuleChange={setChallengePrayerRule}
              onChallengeJesusModeChange={setChallengeJesusMode}
              onChallengeJesusDurationChange={setChallengeJesusDuration}
              onChallengeJesusCountChange={setChallengeJesusCount}
              onChurchScheduleChange={setChurchSchedule}
              onStartChallenge={() => {}}
              onExpandedChallengeChange={setChallengeExpandedId}
              onPauseChallenge={async id => {
                await pauseChallenge(id);
                await refreshTasks();
                setChallengeEditorItem(null);
                setChallengeExpandedId(null);
              }}
              onResumeChallenge={async id => {
                await resumeChallenge(id);
                await refreshTasks();
                setChallengeEditorItem(null);
                setChallengeExpandedId(null);
              }}
              onEndChallenge={async id => {
                await endChallenge(id);
                await refreshTasks();
                setChallengeEditorItem(null);
                setChallengeExpandedId(null);
              }}
              onUpdateChallenge={async (id, updates) => {
                await updateChallenge(id, updates);
                await refreshTasks();
                setChallengeEditorItem(null);
                setChallengeExpandedId(null);
              }}
            />
          )}
        </ScrollView>
      </SmoothBottomSheet>

      <RoutineTaskEditorSheet
        visible={editorVisible}
        guided={isGuided}
        task={editorTask}
        defaultLevel={editorDefaultLevel}
        defaultType={editorDefaultType}
        onClose={() => {
          setEditorVisible(false);
          setEditorTask(null);
          setEditorDefaultLevel(undefined);
          setEditorDefaultType(undefined);
          // If the user leaves the editor with the X during the tour lesson,
          // the walkthrough still moves on instead of stranding them.
          if (isGuided && guidePhase === 'editSave') {
            patchSession({ phase: 'tourHabits' });
          }
        }}
        onSave={handleTaskSave}
        onDelete={handleTaskDelete}
      />

      <QuickTaskSheet
        visible={quickTaskSheetOpen}
        guided={isGuided}
        onClose={() => {
          setQuickTaskSheetOpen(false);
          if (isGuided && !quickTaskSavedRef.current) patchSession({ phase: 'quickOffer' });
        }}
        onTaskDraft={async draft => {
          const saved = await createOrUpdateTask(draft);
          quickTaskSavedRef.current = true;
          notifyGuideEvent({
            type: 'saved',
            step: 'buildMyRoutine',
            phase: 'weekly',
            entityKey: 'quickTask',
            entityId: saved.id,
          });
        }}
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
  guided = false,
  onClose,
  onSelect,
}: {
  visible: boolean;
  guided?: boolean;
  onClose: () => void;
  onSelect: (type: SpiritualType) => void;
}) {
  const { session } = useGuidedSetup();
  const isGuided = guided && session?.active === true && session.activeStep === 'buildMyRoutine';
  const spiritualTypeTarget = useGuideTarget(MY_ROUTINE_GUIDE_TARGETS.spiritualType, isGuided);

  useEffect(() => {
    if (!isGuided || !visible) return;
    const timer = setTimeout(() => spiritualTypeTarget.measure(), 360);
    return () => clearTimeout(timer);
  }, [isGuided, spiritualTypeTarget, visible]);

  if (!visible) return null;

  return (
    <SmoothBottomSheet
      visible={visible}
      onClose={onClose}
      sheetStyle={s.sheetShell}
      keyboardAware
      overlayChildren={isGuided ? <GuidedOverlayHost /> : undefined}
    >
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
              <TouchableOpacity
                {...(isGuided && item.id === 'custom' ? spiritualTypeTarget : {})}
                key={item.id}
                onPress={() => onSelect(item.id)}
                activeOpacity={0.84}
                style={s.typeOptionCard}
              >
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

function RoutineJesusPrayerEditor({
  mode,
  duration,
  count,
  onModeChange,
  onDurationChange,
  onCountChange,
}: {
  mode: JesusPrayerMode;
  duration: string;
  count: string;
  onModeChange: (mode: JesusPrayerMode) => void;
  onDurationChange: (value: string) => void;
  onCountChange: (value: string) => void;
}) {
  const values = mode === 'duration'
    ? [5, 10, 15, 30, 45, 60]
    : [33, 50, 100, 200, 300];
  const selected = Number.parseInt(mode === 'duration' ? duration : count, 10);
  const [customFocused, setCustomFocused] = useState(false);
  const customValue = mode === 'duration' ? duration : count;
  const customActive = customFocused || (Number.isFinite(selected) && !values.includes(selected));
  const customUnit = mode === 'duration' ? 'min' : 'reps';
  const modeMotion = useSharedValue(mode === 'count' ? 1 : 0);
  const [modeWidth, setModeWidth] = useState(0);

  useEffect(() => {
    modeMotion.value = withSpring(mode === 'count' ? 1 : 0, {
      damping: 18,
      stiffness: 235,
      mass: 0.72,
    });
  }, [mode, modeMotion]);

  const modePillMotionStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: modeMotion.value * ((modeWidth - 8) / 2) }],
  }));

  const setValue = (next: number) => {
    if (mode === 'duration') {
      onDurationChange(String(next));
      return;
    }
    onCountChange(String(next));
  };

  const setCustomValue = (text: string) => {
    const clean = text.replace(/[^\d]/g, '');
    if (mode === 'duration') {
      onDurationChange(clean);
      return;
    }
    onCountChange(clean);
  };

  return (
    <View style={s.jesusEditorStack}>
      <View style={s.jesusModeRow} onLayout={event => setModeWidth(event.nativeEvent.layout.width)}>
        {modeWidth > 0 && (
          <Reanimated.View
            pointerEvents="none"
            style={[
              s.jesusModePill,
              { width: (modeWidth - 8) / 2 },
              modePillMotionStyle,
            ]}
          />
        )}
        {([
          { id: 'duration' as const, label: 'By Time' },
          { id: 'count' as const, label: 'By Count' },
        ]).map(item => {
          const active = mode === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => onModeChange(item.id)}
              activeOpacity={0.84}
              style={s.jesusModeBtn}
            >
              <Text style={[s.jesusModeText, active && s.jesusModeTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={s.jesusPresetRow}>
        {values.map(value => {
          const active = selected === value;
          return (
            <TouchableOpacity
              key={value}
              onPress={() => setValue(value)}
              activeOpacity={0.84}
              style={[s.jesusPresetChip, active && s.jesusPresetChipActive]}
            >
              <Text style={[s.jesusPresetText, active && s.jesusPresetTextActive]}>
                {mode === 'duration' ? `${value} min` : `${value}`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[s.jesusCustomBox, customActive && s.jesusCustomBoxActive]}>
        <View style={s.jesusCustomHeader}>
          <Text style={[s.jesusCustomLabel, customActive && s.jesusCustomLabelActive]}>
            Custom {mode === 'duration' ? 'time' : 'count'}
          </Text>
        </View>
        <View style={[s.jesusCustomInputWrap, customFocused && s.jesusCustomInputWrapFocused]}>
          <TextInput
            value={customValue}
            onChangeText={setCustomValue}
            onFocus={() => setCustomFocused(true)}
            onBlur={() => setCustomFocused(false)}
            keyboardType="number-pad"
            placeholder={mode === 'duration' ? '15' : '100'}
            placeholderTextColor="#D1D5DB"
            style={s.jesusCustomInput}
          />
          <View style={s.jesusCustomDivider} />
          <Text style={s.jesusCustomSuffix}>{customUnit}</Text>
        </View>
      </View>
    </View>
  );
}

function RoutinePrayerRuleEditor({
  value,
  prayerType,
  onChange,
  accent,
}: {
  value: RoutinePrayerRuleChoice;
  prayerType: RoutinePrayerType;
  onChange: (value: RoutinePrayerRuleChoice) => void;
  accent: string;
}) {
  const rules = prayerType === 'meal' ? ROUTINE_MEAL_PRAYER_RULES : ROUTINE_PRAYER_RULES;

  return (
    <View style={s.prayerRuleStack}>
      {rules.map(item => {
        const active = value === item.key;
        const orthodox = item.key !== 'personal';
        const desc = prayerType !== 'meal' && item.key === 'standard'
          ? `Full ${prayerType} prayers`
          : item.desc;

        return (
          <TouchableOpacity
            key={item.key}
            onPress={() => onChange(item.key)}
            activeOpacity={0.86}
            style={[
              s.prayerRuleCard,
              active && {
                borderColor: accent,
                backgroundColor: hexToRgba(accent, 0.08),
              },
            ]}
          >
            <View style={[s.prayerRuleRadio, active && { borderColor: accent }]}>
              {active && <View style={[s.prayerRuleRadioDot, { backgroundColor: accent }]} />}
            </View>
            <View style={s.prayerRuleCopy}>
              <Text style={[s.prayerRuleTitle, active && { color: accent }]}>{item.label}</Text>
              <Text style={s.prayerRuleDesc}>{desc}</Text>
            </View>
            {(orthodox || active) && (
              <View style={s.prayerRuleTrailing}>
                {orthodox && (
                  <View style={[s.prayerRuleBadge, { borderColor: hexToRgba(accent, 0.26), backgroundColor: hexToRgba(accent, 0.08) }]}>
                    <OrthodoxCross s={10} c={accent} w={1.35} />
                    <Text style={[s.prayerRuleBadgeText, { color: accent }]}>ORTH.</Text>
                  </View>
                )}
                {active && <CheckSmall s={16} c={accent} />}
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function RoutineScriptureAmountEditor({
  readingType,
  amount,
  onAmountChange,
  accent,
}: {
  readingType: ScriptureTaskConfig['readingType'];
  amount: number;
  onAmountChange: (amount: number) => void;
  accent: string;
}) {
  const amountValue = Math.max(1, Math.round(Number.isFinite(amount) ? amount : 1));
  const noun = readingType === 'psalter' ? 'Psalm' : 'Chapter';
  const presetValues = [1, 2, 3, 4, 5];

  return (
    <View style={s.scriptureAmountStack}>
      <View style={[s.scriptureAmountPanel, { borderColor: `${accent}26`, backgroundColor: `${accent}08` }]}>
        <TouchableOpacity
          onPress={() => onAmountChange(Math.max(1, amountValue - 1))}
          activeOpacity={0.84}
          style={s.scriptureAmountStepper}
        >
          <Text style={[s.scriptureAmountStepperText, { color: accent }]}>-</Text>
        </TouchableOpacity>
        <View style={s.scriptureAmountCenter}>
          <Text style={[s.scriptureAmountNumber, { color: accent }]}>{amountValue}</Text>
          <Text style={s.scriptureAmountCaption}>
            {amountValue === 1 ? noun : `${noun}s`} per session
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => onAmountChange(Math.min(10, amountValue + 1))}
          activeOpacity={0.84}
          style={s.scriptureAmountStepper}
        >
          <Plus s={18} c={accent} w={2.4} />
        </TouchableOpacity>
      </View>

      <View style={s.scripturePresetRow}>
        {presetValues.map(value => {
          const active = amountValue === value;
          return (
            <TouchableOpacity
              key={value}
              onPress={() => onAmountChange(value)}
              activeOpacity={0.84}
              style={[
                s.scripturePresetChip,
                active && {
                  borderColor: accent,
                  backgroundColor: `${accent}12`,
                },
              ]}
            >
              <Text style={[s.scripturePresetText, active && { color: accent }]}>{value}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// Exported for the onboarding builders — the exact editor the app uses.
export function RoutineTaskEditorSheet({
  visible,
  guided = false,
  task,
  initialTask = null,
  hideDelete = false,
  defaultLevel,
  defaultType,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  guided?: boolean;
  task: RoutineTask | null;
  initialTask?: RoutineTask | null;
  hideDelete?: boolean;
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
  const [prayerRule, setPrayerRule] = useState<RoutinePrayerRuleChoice>('standard');
  const [jesusMode, setJesusMode] = useState<JesusPrayerMode>('duration');
  const [jesusDuration, setJesusDuration] = useState('15');
  const [jesusCount, setJesusCount] = useState('100');
  const [scriptureReadingType, setScriptureReadingType] = useState<ScriptureTaskConfig['readingType']>('custom');
  const [scriptureChaptersPerDay, setScriptureChaptersPerDay] = useState(1);
  const categoryMotion = useSharedValue(level === 2 ? 1 : 0);
  const [categorySegmentWidth, setCategorySegmentWidth] = useState(0);
  const [showAllRoutineIcons, setShowAllRoutineIcons] = useState(false);
  const [routineIconGridWidth, setRoutineIconGridWidth] = useState(0);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const { session, patchSession } = useGuidedSetup();
  const isGuided = guided && session?.active === true && session.activeStep === 'buildMyRoutine';
  const guidePhase = isGuided ? session.phase : '';
  const titleTarget = useGuideTarget(MY_ROUTINE_GUIDE_TARGETS.title, isGuided);
  const saveTarget = useGuideTarget(MY_ROUTINE_GUIDE_TARGETS.save, isGuided);
  const formTask = task ?? initialTask;

  const advanceTitleGuide = useCallback(() => {
    if (!isGuided || !title.trim()) return;
    if (guidePhase === 'spiritualName') {
      patchSession({ phase: 'spiritualSave' });
      return;
    }
    if (guidePhase === 'routineName') {
      patchSession({ phase: 'routineSave' });
    }
  }, [guidePhase, isGuided, patchSession, title]);

  useEffect(() => {
    if (!isGuided || !visible) return;
    // Three passes: the sheet is still sliding at ~200ms, settled by ~520ms,
    // and the late pass catches keyboard-driven reflows. Without the settled
    // passes the editSave spotlight can miss the top-right check entirely.
    const timers = [200, 520, 900].map(delay => setTimeout(() => {
      titleTarget.measure();
      saveTarget.measure();
    }, delay));
    return () => timers.forEach(clearTimeout);
  }, [guidePhase, isGuided, saveTarget, titleTarget, visible]);

  useEffect(() => {
    categoryMotion.value = withSpring(level === 2 ? 1 : 0, {
      damping: 18,
      stiffness: 235,
      mass: 0.72,
    });
  }, [categoryMotion, level]);

  const categoryPillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: categoryMotion.value * ((categorySegmentWidth - 8) / 2) }],
  }));

  useEffect(() => {
    if (!visible) return;
    setShowAllRoutineIcons(false);
    setConfirmDeleteVisible(false);
    if (formTask) {
      setTitle(formTask.title);
      setLevel(formTask.level);
      setType(formTask.type);
      setIcon(formTask.icon ?? 'ListChecks');
      setTime(formTask.time);
      setFrequency(formTask.frequency);
      setSelectedDays(formTask.selectedDays ?? []);
      setMonthlyDays(formTask.monthlyDays ?? [1]);
      setSameTimeEveryDay(formTask.sameTimeEveryDay);
      setDayTimeOverrides(formTask.dayTimeOverrides ?? []);
      setNotificationMode(formTask.notificationMode);
      setReminderMinutes(formTask.reminderMinutes ?? 15);
      setPrayerRule(normalizeRoutinePrayerRule(formTask));
      if (isJesusPrayerRoutineTask(formTask)) {
        setJesusMode(normalizeJesusMode(formTask.prayerConfig?.jesusPrayerMode));
        setJesusDuration(String(formTask.prayerConfig?.jesusPrayerDuration ?? 15));
        setJesusCount(String(formTask.prayerConfig?.jesusPrayerCount ?? 100));
      } else {
        setJesusMode('duration');
        setJesusDuration('15');
        setJesusCount('100');
      }
      const nextScriptureType = inferScriptureReadingType(formTask);
      setScriptureReadingType(nextScriptureType);
      setScriptureChaptersPerDay(Math.max(1, normalizeScriptureChaptersPerDay(formTask, nextScriptureType) || 1));
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
    setPrayerRule('standard');
    setJesusMode('duration');
    setJesusDuration('15');
    setJesusCount('100');
    setScriptureReadingType('custom');
    setScriptureChaptersPerDay(1);
  }, [defaultLevel, defaultType, formTask, visible]);

  const isSpiritual = level === 1;
  const habitAccent = formTask?.source === 'habit' ? formTask.habitColor : undefined;
  const gratitudeAccent = formTask?.source === 'gratitude' || formTask?.type === 'gratitude' ? GRATITUDE_ACCENT : undefined;
  const editorAccent = habitAccent ?? gratitudeAccent;
  const accent = editorAccent ?? (isSpiritual ? C.gold : '#1F2937');
  const softAccentBg = editorAccent
    ? hexToRgba(editorAccent, 0.055)
    : isSpiritual ? '#FFFBEB' : '#F9FAFB';
  const softAccentBorder = editorAccent
    ? hexToRgba(editorAccent, 0.22)
    : isSpiritual ? 'rgba(197,160,89,0.24)' : '#E5E7EB';
  const themedHeaderStyle = editorAccent ? { borderBottomColor: hexToRgba(editorAccent, 0.16) } : undefined;
  const themedBlockStyle = editorAccent ? { borderColor: hexToRgba(editorAccent, 0.16) } : undefined;
  const themedTitleInputStyle = editorAccent
    ? { backgroundColor: hexToRgba(editorAccent, 0.045), borderColor: hexToRgba(editorAccent, 0.18) }
    : undefined;

  const draftTask: RoutineTask = {
    id: formTask?.id ?? `routine_${Date.now()}`,
    title: title.trim(),
    subtitle: formTask?.subtitle,
    level,
    source: formTask?.source ?? (isSpiritual ? 'spiritual' : 'routine'),
    type: formTask ? formTask.type : isSpiritual ? type : 'custom',
    icon: isSpiritual ? formTask?.icon : icon,
    habitColor: formTask?.habitColor,
    targetView: formTask?.targetView,
    targetTab: formTask?.targetTab,
    status: formTask?.status ?? 'active',
    time,
    frequency,
    selectedDays: frequency === 'specific_days' ? selectedDays : undefined,
    monthlyDays: frequency === 'monthly' ? monthlyDays : undefined,
    sameTimeEveryDay,
    dayTimeOverrides: sameTimeEveryDay ? undefined : dayTimeOverrides,
    notificationMode,
    reminderMinutes: notificationMode === 'double' ? reminderMinutes : undefined,
    prayerConfig: formTask?.prayerConfig,
    scriptureConfig: formTask?.scriptureConfig,
  };

  const activeDays = getActiveDays(draftTask);
  const activeTaskIndexes = getActiveTaskIndexesForFrequency(frequency, selectedDays);
  const selectedDayIndexes = selectedDaysToTaskIndexes(selectedDays);
  const dayTimes = overridesToTaskDayTimes(dayTimeOverrides);
  const allowPerDayTimes = frequency !== 'monthly' && (frequency !== 'specific_days' || selectedDays.length > 0);
  const isJesusPrayerTask = isJesusPrayerRoutineTask(draftTask);
  const isPrayerRuleTask = isRoutinePrayerRuleTask(draftTask);
  const prayerRuleType = routinePrayerType(draftTask) ?? 'morning';
  const prayerRuleAccent = prayerRuleAccentForTask(draftTask);
  const isScriptureTask = isScriptureRoutineTask(draftTask);
  const isHabitTask = task?.source === 'habit';
  const canEditRoutineIcon = !isSpiritual && (!formTask || formTask.source === 'routine');
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
      subtitle: isJesusPrayerTask
        ? `${jesusMode === 'duration'
          ? `${Number.parseInt(jesusDuration || '15', 10) || 15} min`
          : `${Number.parseInt(jesusCount || '100', 10) || 100} repetitions`} - ${getTaskFrequencyLabel(draftTask)}`
        : isScriptureTask
          ? `${scriptureAmountLabel(scriptureReadingType, scriptureChaptersPerDay)} - ${getTaskFrequencyLabel(draftTask)}`
        : isPrayerRuleTask
          ? `${routinePrayerRuleSummary(prayerRule)} - ${getTaskFrequencyLabel(draftTask)}`
        : draftTask.subtitle,
      prayerConfig: isJesusPrayerTask
        ? {
          ...(draftTask.prayerConfig ?? {}),
          prayerType: 'jesus',
          prayerTaskKind: 'jesus_prayer',
          jesusPrayerMode: jesusMode,
          jesusPrayerDuration: jesusMode === 'duration' ? Number.parseInt(jesusDuration || '15', 10) || 15 : undefined,
          jesusPrayerCount: jesusMode === 'count' ? Number.parseInt(jesusCount || '100', 10) || 100 : undefined,
        }
        : isPrayerRuleTask
          ? {
            ...(draftTask.prayerConfig ?? {}),
            prayerType: prayerRuleType,
            prayerRule,
            prayerTaskKind: prayerRule === 'personal' ? 'personal_rule' : 'guided_rule',
            jesusPrayerMode: undefined,
            jesusPrayerDuration: undefined,
            jesusPrayerCount: undefined,
          }
        : draftTask.prayerConfig,
      scriptureConfig: isScriptureTask
        ? {
          ...(draftTask.scriptureConfig ?? {}),
          readingType: scriptureReadingType,
          chaptersPerDay: scriptureReadingType === 'church_calendar' ? 0 : Math.max(1, Math.round(scriptureChaptersPerDay)),
          totalUnitsRead: draftTask.scriptureConfig?.totalUnitsRead ?? 0,
        }
        : draftTask.scriptureConfig,
      targetView: isJesusPrayerTask
        ? '/jesus-prayer'
        : isPrayerRuleTask
          ? prayerRule === 'personal' && prayerRuleType !== 'meal' ? '/personal-rule' : '/prayer'
          : draftTask.targetView,
      icon: isJesusPrayerTask ? 'Cross' : draftTask.icon,
      sameTimeEveryDay: allowPerDayTimes ? sameTimeEveryDay : true,
      selectedDays: frequency === 'specific_days' ? selectedDays : undefined,
      monthlyDays: frequency === 'monthly' ? monthlyDays : undefined,
      dayTimeOverrides: normalizedOverrides,
    });
  };

  if (!visible) return null;

  const deleteConfirmOverlay = (
    <>
      {isGuided && <GuidedOverlayHost />}
      <ConfirmModal
        embedded
        visible={confirmDeleteVisible}
        icon={<Trash2 s={22} c={C.red} />}
        title={isHabitTask ? 'Delete Habit / Step?' : 'Delete Activity?'}
        body={task
          ? isHabitTask
            ? `"${task.title}" will be removed from this goal.`
            : `"${task.title}" will be removed from your routine and Home tasks.`
          : ''}
        confirmLabel="DELETE"
        confirmColor={C.red}
        onCancel={() => setConfirmDeleteVisible(false)}
        onConfirm={() => {
          if (!task) return;
          setConfirmDeleteVisible(false);
          void Promise.resolve(onDelete(task.id)).catch(error => {
            console.warn('Routine activity delete failed:', error);
          });
        }}
      />
    </>
  );

  return (
    <>
    <SmoothBottomSheet
      visible={visible}
      onClose={onClose}
      sheetStyle={s.sheetShell}
      keyboardAware
      overlayChildren={deleteConfirmOverlay}
    >
          <View style={[s.sheetHandle, editorAccent && { backgroundColor: hexToRgba(editorAccent, 0.28) }]} />

          <View style={[s.editorHeader, themedHeaderStyle]}>
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.84}
              style={[s.sheetHeaderIcon, editorAccent && { backgroundColor: hexToRgba(editorAccent, 0.09) }]}
            >
              <X s={22} c={editorAccent ?? '#9CA3AF'} />
            </TouchableOpacity>
            <Text style={s.editorHeaderTitle}>{task ? 'Edit Activity' : 'New Activity'}</Text>
            <TouchableOpacity {...saveTarget} onPress={save} activeOpacity={0.84} style={[s.saveCircle, { backgroundColor: accent, opacity: title.trim() ? 1 : 0.35 }]}>
              <CheckSmall s={18} c="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.editorContent} showsVerticalScrollIndicator={false}>
            <View style={[s.editorBlock, themedBlockStyle]}>
              <Text style={[s.editorBlockLabel, { color: accent }]}>Activity Name</Text>
              <TextInput
                {...titleTarget}
                value={title}
                onChangeText={setTitle}
                placeholder={isSpiritual ? 'e.g. Morning Prayer' : 'e.g. Evening Walk'}
                placeholderTextColor="#D1D5DB"
                style={[s.titleInput, themedTitleInputStyle]}
                returnKeyType="done"
                onSubmitEditing={advanceTitleGuide}
              />
            </View>

            {isPrayerRuleTask && (
              <View style={[s.editorBlock, themedBlockStyle]}>
                <Text style={[s.editorBlockLabel, { color: prayerRuleAccent }]}>Prayer Rule</Text>
                <RoutinePrayerRuleEditor
                  value={prayerRule}
                  prayerType={prayerRuleType}
                  accent={prayerRuleAccent}
                  onChange={nextRule => {
                    animateRoutineLayoutChange();
                    setPrayerRule(nextRule);
                  }}
                />
              </View>
            )}

            {isJesusPrayerTask && (
              <View style={[s.editorBlock, themedBlockStyle]}>
                <Text style={[s.editorBlockLabel, { color: C.gold }]}>Jesus Prayer</Text>
                <RoutineJesusPrayerEditor
                  mode={jesusMode}
                  duration={jesusDuration}
                  count={jesusCount}
                  onModeChange={nextMode => {
                    animateRoutineLayoutChange();
                    setJesusMode(nextMode);
                  }}
                  onDurationChange={setJesusDuration}
                  onCountChange={setJesusCount}
                />
              </View>
            )}

            {isScriptureTask && scriptureReadingType !== 'church_calendar' && (
              <View style={[s.editorBlock, themedBlockStyle]}>
                <Text style={[s.editorBlockLabel, { color: C.gold }]}>Scripture Amount</Text>
                <RoutineScriptureAmountEditor
                  readingType={scriptureReadingType}
                  amount={scriptureChaptersPerDay}
                  onAmountChange={setScriptureChaptersPerDay}
                  accent={C.gold}
                />
              </View>
            )}

            {!task && defaultLevel == null && (
              <View style={[s.editorBlock, themedBlockStyle]}>
                <Text style={s.mutedLabel}>Category</Text>
                <View
                  style={s.categorySegmentWrap}
                  onLayout={event => setCategorySegmentWidth(event.nativeEvent.layout.width)}
                >
                  {categorySegmentWidth > 0 && (
                    <Reanimated.View
                      pointerEvents="none"
                      style={[
                        s.categorySegmentPill,
                        { width: (categorySegmentWidth - 8) / 2 },
                        categoryPillStyle,
                      ]}
                    />
                  )}
                  <TouchableOpacity
                    onPress={() => setLevel(1)}
                    activeOpacity={0.84}
                    style={s.categoryBtn}
                  >
                    <Text style={[s.categoryBtnText, level === 1 && { color: C.gold }]}>Spiritual</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setLevel(2)}
                    activeOpacity={0.84}
                    style={s.categoryBtn}
                  >
                    <Text style={[s.categoryBtnText, level === 2 && { color: '#111827' }]}>Routine</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {!task && isSpiritual && defaultType == null && (
              <View style={[s.editorBlock, themedBlockStyle]}>
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
              <View style={[s.editorBlock, themedBlockStyle]}>
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
                          active && { backgroundColor: accent, borderColor: accent },
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

            <View style={[s.editorBlock, themedBlockStyle]}>
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

            <View style={[s.editorBlock, themedBlockStyle]}>
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
                softBg={softAccentBg}
                borderColor={softAccentBorder}
                mutedColor="#8B909A"
              />
            </View>

            <View style={[s.editorBlock, themedBlockStyle]}>
              <NotificationSettings
                mode={notificationMode}
                reminderMinutes={reminderMinutes}
                onModeChange={setNotificationMode}
                onReminderChange={setReminderMinutes}
                accent={accent}
              />
            </View>

            {task && !hideDelete && (
              <TouchableOpacity onPress={() => setConfirmDeleteVisible(true)} activeOpacity={0.84} style={s.deleteBtn}>
                <Trash2 s={16} c="#EF4444" />
                <Text style={s.deleteBtnText}>{isHabitTask ? 'Delete Habit / Step' : 'Delete Activity'}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
    </SmoothBottomSheet>
    </>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAFA' },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 120, gap: 28 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, paddingHorizontal: 4 },
  sectionBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4 },
  sectionKicker: { fontFamily: F.sansBold, fontSize: 11.5, letterSpacing: 1.8, color: C.gold, textTransform: 'uppercase' },
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
  segmentWrap: { minHeight: 50, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F0E7', borderRadius: 20, padding: 4, position: 'relative', overflow: 'hidden' },
  segmentPill: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: 16, backgroundColor: '#FFFFFF', shadowColor: C.gold, shadowOpacity: 0.12, shadowOffset: { width: 0, height: 5 }, shadowRadius: 12, elevation: 2 },
  segmentBtn: { flex: 1, minHeight: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
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
  challengeList: { gap: 6, paddingTop: 0 },
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
    minHeight: 64,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.28)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFBF0',
    shadowColor: C.gold,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  viewAllChallengesIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(197,160,89,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewAllChallengesCopy: { flex: 1, minWidth: 0 },
  viewAllChallengesText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: C.gold,
    textTransform: 'uppercase',
  },
  viewAllChallengesHint: {
    marginTop: 3,
    fontFamily: F.serif,
    fontSize: 12.5,
    lineHeight: 16,
    color: '#9C8F73',
  },
  sheetShell: { maxHeight: '88%', borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: '#FAFAFA', paddingBottom: 24 },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  sheetHeaderTitle: { fontFamily: F.serifMedium, fontSize: 20, color: '#111827' },
  sheetHeaderIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  sheetHeaderSpacer: { width: 38 },
  challengeEditorSheetContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 24 },
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
  jesusEditorStack: { gap: 12 },
  jesusModeRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', padding: 4, borderRadius: 18, borderWidth: 1, borderColor: '#EEE3D1', backgroundColor: '#FFFDF8', position: 'relative', overflow: 'hidden' },
  jesusModePill: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: 14, backgroundColor: C.gold, shadowColor: C.gold, shadowOpacity: 0.26, shadowOffset: { width: 0, height: 7 }, shadowRadius: 12, elevation: 3 },
  jesusModeBtn: { flex: 1, minHeight: 36, borderRadius: 14, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  jesusModeText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.35, color: '#9CA3AF', textTransform: 'uppercase' },
  jesusModeTextActive: { color: '#FFFFFF' },
  jesusPresetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  jesusPresetChip: { flexGrow: 1, flexBasis: '30%', minHeight: 40, borderRadius: 15, borderWidth: 1, borderColor: '#EEE8DE', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  jesusPresetChipActive: { borderColor: '#D7AA54', backgroundColor: '#FFF7E8' },
  jesusPresetText: { fontFamily: F.sansBold, fontSize: 10.5, letterSpacing: 1.1, color: '#717782', textTransform: 'uppercase' },
  jesusPresetTextActive: { color: '#B6822D' },
  jesusCustomBox: { alignSelf: 'center', width: '54%', minWidth: 154, maxWidth: 188, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(197,160,89,0.18)', backgroundColor: '#FFFBF4', paddingHorizontal: 9, paddingVertical: 8, gap: 6 },
  jesusCustomBoxActive: { borderColor: 'rgba(197,160,89,0.42)', backgroundColor: '#FFF8EA', shadowColor: C.gold, shadowOpacity: 0.08, shadowOffset: { width: 0, height: 8 }, shadowRadius: 16, elevation: 2 },
  jesusCustomHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  jesusCustomLabel: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.25, color: '#9C948C', textTransform: 'uppercase', textAlign: 'center' },
  jesusCustomLabelActive: { color: '#B6822D' },
  jesusCustomUnitPill: { borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0E7D8', paddingHorizontal: 8, paddingVertical: 4 },
  jesusCustomUnitPillActive: { backgroundColor: '#FFF2D8', borderColor: 'rgba(197,160,89,0.28)' },
  jesusCustomUnitPillText: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1, color: '#B7B0A7', textTransform: 'uppercase' },
  jesusCustomUnitPillTextActive: { color: '#B6822D' },
  jesusCustomInputWrap: { minHeight: 42, borderRadius: 14, borderWidth: 1, borderColor: '#EEE8DE', backgroundColor: '#FFFFFF', paddingLeft: 12, paddingRight: 10, flexDirection: 'row', alignItems: 'center' },
  jesusCustomInputWrapFocused: { borderColor: '#D7AA54' },
  jesusCustomInput: { flex: 1, minHeight: 40, padding: 0, fontFamily: F.serifMedium, fontSize: 20, color: C.text, textAlign: 'center' },
  jesusCustomDivider: { width: 1, height: 20, backgroundColor: '#F0EDE6', marginLeft: 8, marginRight: 8 },
  jesusCustomSuffix: { minWidth: 30, fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1, color: '#B6822D', textTransform: 'uppercase', textAlign: 'right' },
  prayerRuleStack: { gap: 9 },
  prayerRuleCard: {
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
  },
  prayerRuleRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#D8D1C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  prayerRuleRadioDot: { width: 8, height: 8, borderRadius: 4 },
  prayerRuleCopy: { flex: 1, minWidth: 0, paddingRight: 2 },
  prayerRuleTitle: { fontFamily: F.serifMedium, fontSize: 17, lineHeight: 21, color: C.text },
  prayerRuleDesc: { marginTop: 3, fontFamily: F.sans, fontSize: 12, lineHeight: 17, color: '#8A8178', flexShrink: 1 },
  prayerRuleTrailing: { minWidth: 54, alignItems: 'flex-end', justifyContent: 'center', gap: 6, alignSelf: 'center' },
  prayerRuleBadge: {
    minHeight: 19,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  prayerRuleBadgeText: { fontFamily: F.sansBold, fontSize: 7.5, letterSpacing: 0.8, textTransform: 'uppercase' },
  scriptureAmountStack: { gap: 10 },
  scriptureAmountPanel: {
    minHeight: 82,
    borderRadius: 22,
    borderWidth: 1,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scriptureAmountStepper: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFE6D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scriptureAmountStepperText: { fontFamily: F.serifMedium, fontSize: 27, lineHeight: 29 },
  scriptureAmountCenter: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  scriptureAmountNumber: { fontFamily: F.serifMedium, fontSize: 34, lineHeight: 39 },
  scriptureAmountCaption: { marginTop: 1, fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.25, color: '#9C948C', textTransform: 'uppercase', textAlign: 'center' },
  scripturePresetRow: { flexDirection: 'row', gap: 8 },
  scripturePresetChip: {
    flex: 1,
    minHeight: 38,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#EEE8DE',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scripturePresetText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.1, color: '#8B909A', textTransform: 'uppercase' },
  categorySegmentWrap: { minHeight: 52, flexDirection: 'row', alignItems: 'center', padding: 4, borderRadius: 20, borderWidth: 1, borderColor: '#F0EDE6', backgroundColor: '#F7F7F5', position: 'relative', overflow: 'hidden' },
  categorySegmentPill: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(197,160,89,0.24)', shadowColor: C.gold, shadowOpacity: 0.13, shadowOffset: { width: 0, height: 5 }, shadowRadius: 12, elevation: 2 },
  categoryBtn: { flex: 1, minHeight: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
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
