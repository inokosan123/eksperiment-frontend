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
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import NotificationSettings, { type NotificationMode as SharedNotificationMode } from '@/components/shared/NotificationSettings';
import SetAsTaskSheet from '@/components/shared/SetAsTaskSheet';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import TaskFrequencyEditor, { type TaskFrequency } from '@/components/shared/TaskFrequencyEditor';
import TaskTimeEditor, { type TaskDayTimes } from '@/components/shared/TaskTimeEditor';
import {
  Activity,
  Apple,
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
  Flame,
  Heart,
  Home,
  Leaf,
  ListChecks,
  Moon,
  Music,
  Pill,
  Plus,
  Sparkles,
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
import { C, F } from '@/constants/tokens';
import { HabitItem, INITIAL_HABITS, getFreqLabel } from '@/components/habits/habitData';
import { useChallenges } from '@/components/challenges/ChallengesContext';
import { useTasks } from '@/components/tasks/TaskProvider';
import type { TaskDefinition, TaskDraft } from '@/components/tasks/taskTypes';

type RoutineFrequency = TaskFrequency;
type NotificationMode = SharedNotificationMode;
type RoutineLevel = 1 | 2;
type SpiritualType = 'prayer' | 'reading' | 'journal' | 'church' | 'custom';
type RoutineTaskSheetContext = 'prayer' | 'journal' | 'scripture';
type RoutineIconName =
  | 'Activity'
  | 'Apple'
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
  | 'Pill'
  | 'Sparkles'
  | 'Sun'
  | 'Target'
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
  level: RoutineLevel;
  type: SpiritualType;
  icon?: RoutineIconName;
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

const VISIBLE_ROUTINE_ICON_COUNT = 16;

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
  return {
    variant: task.level === 1 ? 'spiritual' : 'routine',
    title: task.title,
    time: getTaskTimeForDay(task, jsDay),
    subtitle: task.level === 1 ? getTaskFrequencyLabel(task) : getTaskFrequencyLabel(task),
    state: 'active',
    type: task.level === 1 ? task.type : 'custom',
    habitIconName: task.level === 2 ? task.icon : undefined,
  };
}

function taskDefinitionToRoutineTask(task: TaskDefinition): RoutineTask {
  return {
    id: task.id,
    title: task.title,
    level: task.level === 1 ? 1 : 2,
    type: task.type === 'reading' ? 'reading' : task.type === 'journal' ? 'journal' : task.type === 'church' ? 'church' : task.type === 'prayer' ? 'prayer' : 'custom',
    icon: task.icon as RoutineIconName | undefined,
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

function routineTaskToDraft(task: RoutineTask): TaskDraft {
  const dayTimes = overridesToTaskDayTimes(task.dayTimeOverrides ?? []);
  return {
    id: task.id,
    title: task.title,
    subtitle: getTaskFrequencyLabel(task),
    level: task.level,
    source: task.level === 1 ? 'spiritual' : 'routine',
    type: task.type === 'reading' ? 'reading' : task.type === 'journal' ? 'journal' : task.type === 'church' ? 'church' : task.type === 'prayer' ? 'prayer' : 'custom',
    icon: task.level === 2 ? task.icon : undefined,
    status: 'active',
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

export default function MyRoutineView() {
  const router = useRouter();
  const { activeChallenges } = useChallenges();
  const {
    tasks: backendTasks,
    createOrUpdateTask,
    remove: removeTask,
  } = useTasks();
  const tasks = useMemo(
    () => backendTasks.map(taskDefinitionToRoutineTask),
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
  const [habits, setHabits] = useState<HabitItem[]>(INITIAL_HABITS);
  const [expandedHabitId, setExpandedHabitId] = useState<string | null>(INITIAL_HABITS[0]?.id ?? null);

  const selectedDay = DAY_TABS[selectedDayIndex];

  const tasksForDay = useMemo(() => (
    tasks
      .filter(task => matchesTaskForDay(task, selectedDay.jsDay))
      .sort((left, right) => getTaskTimeForDay(left, selectedDay.jsDay).localeCompare(getTaskTimeForDay(right, selectedDay.jsDay)))
  ), [selectedDay.jsDay, tasks]);

  const activeHabits = useMemo(() => habits.filter(item => item.active), [habits]);
  const pausedHabits = useMemo(() => habits.filter(item => !item.active), [habits]);
  const visibleHabits = habitTab === 'active' ? activeHabits : pausedHabits;

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

  const toggleHabitActive = (habitId: string) => {
    setHabits(current => current.map(habit => habit.id === habitId ? { ...habit, active: !habit.active } : habit));
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
                  style={[s.dayTab, active && s.dayTabActive]}
                >
                  <Text style={[s.dayTabLabel, active && s.dayTabLabelActive]}>{day.label}</Text>
                  {active && <View style={s.dayTabMarker} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

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

                  <TouchableOpacity onPress={() => openEditTask(task)} activeOpacity={0.86} style={s.taskCardWrap}>
                    <AnyTaskCard task={toTaskCardData(task, selectedDay.jsDay)} />
                    <View style={s.frequencyBadge}>
                      <Text style={s.frequencyBadgeText}>{getTaskFrequencyLabel(task)}</Text>
                    </View>
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}

            {tasksForDay.length === 0 && (
              <View style={s.emptyBlock}>
                <Text style={s.emptyTitle}>No activities for {selectedDay.label}</Text>
              </View>
            )}

            <View style={s.addRow}>
              <TouchableOpacity onPress={openAddSpiritual} activeOpacity={0.84} style={s.addSpiritualBtn}>
                <Plus s={14} c={C.gold} />
                <Text style={s.addSpiritualText}>Spiritual</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={openAddRoutine} activeOpacity={0.84} style={s.addRoutineBtn}>
                <Plus s={14} c="#6B7280" />
                <Text style={s.addRoutineText}>Routine</Text>
              </TouchableOpacity>
            </View>
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
                      <Text style={s.habitEmoji}>{habit.icon}</Text>
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
                            <Text style={s.habitStepMeta}>{step.time} / {getFreqLabel(step)}</Text>
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
            {activeChallenges.map(challenge => {
              const progressTotal = challenge.progressTotal ?? 0;
              const progressCurrent = challenge.progressCurrent ?? 0;
              const pct = progressTotal > 0
                ? Math.round((progressCurrent / progressTotal) * 100)
                : 0;
              return (
                <TouchableOpacity key={challenge.id} onPress={() => router.push('/challenges')} activeOpacity={0.84} style={s.challengeCard}>
                  <View style={s.challengeTop}>
                    <Text style={s.challengeBadge}>{challenge.category.toUpperCase()}</Text>
                    {challenge.streak > 0 && (
                      <View style={s.challengeStreak}>
                        <Flame s={10} color="#F97316" filled />
                        <Text style={s.challengeStreakText}>{challenge.streak}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.challengeTitle}>{challenge.title}</Text>
                  <Text style={s.challengeMeta}>{challenge.time} / {challenge.headline}</Text>
                  {progressTotal > 0 && (
                    <View style={s.challengeProgressTrack}>
                      <View style={[s.challengeProgressFill, { width: `${pct}%` }]} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}

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
  onDelete: (taskId: string) => void;
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

  useEffect(() => {
    if (!visible) return;
    setShowAllRoutineIcons(false);
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
    level,
    type: isSpiritual ? type : 'custom',
    icon: isSpiritual ? undefined : icon,
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
  const compactRoutineIcons = ROUTINE_ICONS.slice(0, VISIBLE_ROUTINE_ICON_COUNT);
  const selectedRoutineIcon = ROUTINE_ICONS.find(item => item.id === icon);
  const visibleRoutineIcons = showAllRoutineIcons
    ? ROUTINE_ICONS
    : compactRoutineIcons.some(item => item.id === icon) || !selectedRoutineIcon
      ? compactRoutineIcons
      : [...compactRoutineIcons.slice(0, VISIBLE_ROUTINE_ICON_COUNT - 1), selectedRoutineIcon];

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

            {defaultLevel == null && (
              <View style={s.editorBlock}>
                <Text style={s.mutedLabel}>Category</Text>
                <View style={s.toggleRow}>
                  <TouchableOpacity onPress={() => setLevel(1)} activeOpacity={0.84} style={[s.categoryBtn, level === 1 && s.categoryBtnWarm]}>
                    <Text style={[s.categoryBtnText, level === 1 && { color: C.gold }]}>Spiritual</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setLevel(2)} activeOpacity={0.84} style={[s.categoryBtn, level === 2 && s.categoryBtnNeutral]}>
                    <Text style={[s.categoryBtnText, level === 2 && { color: '#111827' }]}>Routine</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {isSpiritual && defaultType == null && (
              <View style={s.editorBlock}>
                <Text style={s.mutedLabel}>Type</Text>
                <View style={s.typeGrid}>
                  {SPIRITUAL_TYPES.map(item => {
                    const active = type === item.id;
                    return (
                      <TouchableOpacity key={item.id} onPress={() => setType(item.id)} activeOpacity={0.84} style={[s.typeChip, active && { backgroundColor: accent, borderColor: accent }]}>
                        <item.Icon s={18} c={active ? '#FFFFFF' : '#9CA3AF'} />
                        <Text style={[s.typeChipText, active && { color: '#FFFFFF' }]}>{item.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {!isSpiritual && (
              <View style={s.editorBlock}>
                <Text style={s.mutedLabel}>Icon</Text>
                <View style={s.iconGrid}>
                  {visibleRoutineIcons.map(item => {
                    const active = icon === item.id;
                    return (
                      <TouchableOpacity key={item.id} onPress={() => setIcon(item.id)} activeOpacity={0.84} style={[s.iconChip, active && s.iconChipActive]}>
                        <item.Icon s={18} c={active ? '#FFFFFF' : '#6B7280'} />
                        <Text style={[s.iconChipText, active && { color: '#FFFFFF' }]}>{item.label}</Text>
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
              <TouchableOpacity onPress={() => onDelete(task.id)} activeOpacity={0.84} style={s.deleteBtn}>
                <Trash2 s={16} c="#EF4444" />
                <Text style={s.deleteBtnText}>Delete Activity</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
    </SmoothBottomSheet>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAFA' },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 120, gap: 28 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingHorizontal: 4 },
  sectionBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 4 },
  sectionKicker: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.8, color: C.gold, textTransform: 'uppercase' },
  dayTabsRow: { gap: 8, paddingBottom: 2 },
  dayTab: {
    minWidth: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0EDE6',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dayTabActive: {
    backgroundColor: C.gold,
    borderColor: C.gold,
    shadowColor: C.gold,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 3,
  },
  dayTabLabel: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.2, color: '#A8A29E', textTransform: 'uppercase' },
  dayTabLabelActive: { color: '#FFFFFF' },
  dayTabMarker: { position: 'absolute', bottom: 6, width: 16, height: 2, borderRadius: 2, backgroundColor: '#FFFFFF' },
  taskStack: { paddingTop: 14 },
  gapRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 6 },
  gapLine: { width: 34, borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#D6D3D1' },
  gapText: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.3, color: '#A8A29E', textTransform: 'uppercase' },
  taskCardWrap: { position: 'relative', marginBottom: 6 },
  frequencyBadge: {
    position: 'absolute',
    right: 14,
    bottom: 12,
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  frequencyBadgeText: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.2, color: '#A8A29E', textTransform: 'uppercase' },
  emptyBlock: { paddingVertical: 28, alignItems: 'center' },
  emptyTitle: { fontFamily: F.serifItalic, fontSize: 15, color: '#A8A29E' },
  addRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  addSpiritualBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(197,160,89,0.35)',
    borderStyle: 'dashed',
    backgroundColor: '#FFFBEB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addRoutineBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#D6D3D1',
    borderStyle: 'dashed',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addSpiritualText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.8, color: C.gold, textTransform: 'uppercase' },
  addRoutineText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.8, color: '#6B7280', textTransform: 'uppercase' },
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
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconChip: { width: '22%', minHeight: 74, borderRadius: 18, backgroundColor: '#F7F7F5', borderWidth: 1, borderColor: '#F2F1EC', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 6 },
  iconChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
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
