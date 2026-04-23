import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import {
  Activity,
  Book,
  Calendar,
  Candle,
  CheckSmall,
  ChevronDown,
  ChevronRight,
  Cross,
  Feather,
  Flame,
  Heart,
  Home,
  ListChecks,
  Moon,
  Plus,
  Sparkles,
  Sun,
  Target,
  Trash2,
  Trophy,
  Utensils,
  X,
} from '@/components/icons/Icons';
import { AnyTaskCard, TaskData } from '@/components/shared/TaskCards';
import { C, F } from '@/constants/tokens';
import { DAY_OPTIONS, HabitItem, INITIAL_HABITS, getFreqLabel } from '@/components/habits/habitData';
import { useChallenges } from '@/components/challenges/ChallengesContext';

type RoutineFrequency = 'daily' | 'weekdays' | 'weekends' | 'specific_days';
type NotificationMode = 'none' | 'normal' | 'double';
type RoutineLevel = 1 | 2;
type SpiritualType = 'prayer' | 'reading' | 'journal' | 'church' | 'custom';
type RoutineIconName =
  | 'Activity'
  | 'Book'
  | 'Candle'
  | 'Cross'
  | 'Feather'
  | 'Heart'
  | 'Home'
  | 'Moon'
  | 'Sparkles'
  | 'Sun'
  | 'Target'
  | 'Utensils';

type DayOverride = {
  jsDay: number;
  time: string;
};

type RoutineTask = {
  id: string;
  title: string;
  level: RoutineLevel;
  type: SpiritualType;
  icon?: RoutineIconName;
  time: string;
  frequency: RoutineFrequency;
  selectedDays?: number[];
  sameTimeEveryDay: boolean;
  dayTimeOverrides?: DayOverride[];
  notificationMode: NotificationMode;
  reminderMinutes?: number;
};

type DayModel = {
  id: string;
  name: string;
  color: string;
  taskCount: number;
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
  { id: 'Candle', label: 'Quiet', Icon: Candle },
  { id: 'Cross', label: 'Prayer', Icon: Cross },
  { id: 'Feather', label: 'Write', Icon: Feather },
  { id: 'Heart', label: 'Health', Icon: Heart },
  { id: 'Home', label: 'Home', Icon: Home },
  { id: 'Moon', label: 'Evening', Icon: Moon },
  { id: 'Sparkles', label: 'Custom', Icon: Sparkles },
  { id: 'Sun', label: 'Morning', Icon: Sun },
  { id: 'Target', label: 'Goal', Icon: Target },
  { id: 'Utensils', label: 'Meal', Icon: Utensils },
];

const MODEL_COLORS = ['#C5A059', '#16A34A', '#2563EB', '#DB2777', '#7C3AED', '#EA580C', '#0F766E'];

const INITIAL_TASKS: RoutineTask[] = [
  {
    id: 'routine_1',
    title: 'Morning Prayer',
    level: 1,
    type: 'prayer',
    time: '07:00',
    frequency: 'daily',
    sameTimeEveryDay: true,
    notificationMode: 'normal',
  },
  {
    id: 'routine_2',
    title: 'Read the Gospels',
    level: 1,
    type: 'reading',
    time: '07:20',
    frequency: 'daily',
    sameTimeEveryDay: true,
    notificationMode: 'normal',
  },
  {
    id: 'routine_3',
    title: 'Water and vitamins',
    level: 2,
    type: 'custom',
    icon: 'Heart',
    time: '08:15',
    frequency: 'weekdays',
    sameTimeEveryDay: true,
    notificationMode: 'none',
  },
  {
    id: 'routine_4',
    title: 'Evening Walk',
    level: 2,
    type: 'custom',
    icon: 'Activity',
    time: '19:00',
    frequency: 'specific_days',
    selectedDays: [1, 3, 5],
    sameTimeEveryDay: false,
    dayTimeOverrides: [
      { jsDay: 1, time: '19:00' },
      { jsDay: 3, time: '18:30' },
      { jsDay: 5, time: '19:20' },
    ],
    notificationMode: 'double',
    reminderMinutes: 15,
  },
];

const INITIAL_MODELS: DayModel[] = [
  { id: 'model_1', name: 'Travel Day', color: '#C5A059', taskCount: 4 },
  { id: 'model_2', name: 'Study Retreat', color: '#7C3AED', taskCount: 6 },
];

const FREQUENCY_OPTIONS: { value: RoutineFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'specific_days', label: 'Specific Days' },
];

function matchesTaskForDay(task: RoutineTask, jsDay: number) {
  switch (task.frequency) {
    case 'weekdays':
      return jsDay >= 1 && jsDay <= 5;
    case 'weekends':
      return jsDay === 0 || jsDay === 6;
    case 'specific_days':
      return (task.selectedDays ?? []).includes(jsDay);
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

function arraysEqual(a?: number[], b?: number[]) {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
}

function overridesEqual(a?: DayOverride[], b?: DayOverride[]) {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
}

function hasScheduleChanged(original: RoutineTask, next: RoutineTask) {
  return (
    original.time !== next.time
    || original.frequency !== next.frequency
    || original.sameTimeEveryDay !== next.sameTimeEveryDay
    || original.notificationMode !== next.notificationMode
    || (original.reminderMinutes ?? 0) !== (next.reminderMinutes ?? 0)
    || !arraysEqual(original.selectedDays, next.selectedDays)
    || !overridesEqual(original.dayTimeOverrides, next.dayTimeOverrides)
  );
}

export default function MyRoutineView() {
  const router = useRouter();
  const { activeChallenges } = useChallenges();
  const [tasks, setTasks] = useState<RoutineTask[]>(INITIAL_TASKS);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [showSpiritualTypePicker, setShowSpiritualTypePicker] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorTask, setEditorTask] = useState<RoutineTask | null>(null);
  const [editorDefaultLevel, setEditorDefaultLevel] = useState<RoutineLevel | undefined>(undefined);
  const [editorDefaultType, setEditorDefaultType] = useState<SpiritualType | undefined>(undefined);
  const [pendingApplyTask, setPendingApplyTask] = useState<RoutineTask | null>(null);
  const [habitTab, setHabitTab] = useState<'active' | 'paused'>('active');
  const [habits, setHabits] = useState<HabitItem[]>(INITIAL_HABITS);
  const [expandedHabitId, setExpandedHabitId] = useState<string | null>(INITIAL_HABITS[0]?.id ?? null);
  const [dayModels, setDayModels] = useState<DayModel[]>(INITIAL_MODELS);
  const [modelEditorVisible, setModelEditorVisible] = useState(false);
  const [editingModel, setEditingModel] = useState<DayModel | null>(null);

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

  const handleTaskSave = (task: RoutineTask) => {
    if (editorTask && hasScheduleChanged(editorTask, task)) {
      setPendingApplyTask(task);
      return;
    }

    setTasks(current => {
      const exists = current.some(item => item.id === task.id);
      return exists
        ? current.map(item => item.id === task.id ? task : item)
        : [...current, task];
    });
    setEditorVisible(false);
    setEditorTask(null);
    setEditorDefaultLevel(undefined);
    setEditorDefaultType(undefined);
  };

  const applyPendingTask = () => {
    if (!pendingApplyTask) return;
    setTasks(current => current.map(item => item.id === pendingApplyTask.id ? pendingApplyTask : item));
    setPendingApplyTask(null);
    setEditorVisible(false);
    setEditorTask(null);
  };

  const handleTaskDelete = (taskId: string) => {
    setTasks(current => current.filter(item => item.id !== taskId));
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

  const openNewModel = () => {
    setEditingModel(null);
    setModelEditorVisible(true);
  };

  const openEditModel = (model: DayModel) => {
    setEditingModel(model);
    setModelEditorVisible(true);
  };

  const saveModel = (model: DayModel) => {
    setDayModels(current => {
      const exists = current.some(item => item.id === model.id);
      return exists
        ? current.map(item => item.id === model.id ? model : item)
        : [...current, model];
    });
    setModelEditorVisible(false);
    setEditingModel(null);
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

        <SectionDivider icon={<Target s={14} c="#D1D5DB" />} />

        <View>
          <View style={s.sectionBetween}>
            <View style={s.sectionHead}>
              <Target s={16} c={C.gold} />
              <Text style={s.sectionKicker}>Day Models</Text>
            </View>
            <TouchableOpacity onPress={openNewModel} activeOpacity={0.84} style={s.roundMiniBtn}>
              <Plus s={18} c={C.gold} />
            </TouchableOpacity>
          </View>
          <Text style={s.helperBody}>For travel, vacations, or shift days - keep alternate templates ready.</Text>

          <View style={s.modelGrid}>
            {dayModels.map(model => (
              <TouchableOpacity key={model.id} onPress={() => openEditModel(model)} activeOpacity={0.84} style={[s.modelCard, { borderLeftColor: model.color }]}>
                <Text style={s.modelTitle}>{model.name}</Text>
                <Text style={s.modelMeta}>{model.taskCount} tasks</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity onPress={openNewModel} activeOpacity={0.84} style={s.newModelCard}>
              <View style={s.newModelCircle}>
                <Plus s={16} c="#C5A059" />
              </View>
              <Text style={s.newModelText}>New Model</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <SpiritualTypePickerSheet
        visible={showSpiritualTypePicker}
        onClose={() => setShowSpiritualTypePicker(false)}
        onSelect={type => {
          setShowSpiritualTypePicker(false);
          setEditorTask(null);
          setEditorDefaultLevel(1);
          setEditorDefaultType(type);
          setEditorVisible(true);
        }}
      />

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

      <ApplyModeSheet
        visible={!!pendingApplyTask}
        onClose={() => setPendingApplyTask(null)}
        onSelect={() => applyPendingTask()}
      />

      <DayModelEditorSheet
        visible={modelEditorVisible}
        model={editingModel}
        onClose={() => {
          setModelEditorVisible(false);
          setEditingModel(null);
        }}
        onSave={saveModel}
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
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={s.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.sheetShell}>
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
        </View>
      </View>
    </Modal>
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
  const [icon, setIcon] = useState<RoutineIconName>('Sparkles');
  const [time, setTime] = useState('08:00');
  const [frequency, setFrequency] = useState<RoutineFrequency>('daily');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [sameTimeEveryDay, setSameTimeEveryDay] = useState(true);
  const [dayTimeOverrides, setDayTimeOverrides] = useState<DayOverride[]>([]);
  const [notificationMode, setNotificationMode] = useState<NotificationMode>('none');
  const [reminderMinutes, setReminderMinutes] = useState(15);

  useEffect(() => {
    if (!visible) return;
    if (task) {
      setTitle(task.title);
      setLevel(task.level);
      setType(task.type);
      setIcon(task.icon ?? 'Sparkles');
      setTime(task.time);
      setFrequency(task.frequency);
      setSelectedDays(task.selectedDays ?? []);
      setSameTimeEveryDay(task.sameTimeEveryDay);
      setDayTimeOverrides(task.dayTimeOverrides ?? []);
      setNotificationMode(task.notificationMode);
      setReminderMinutes(task.reminderMinutes ?? 15);
      return;
    }

    setTitle('');
    setLevel(defaultLevel ?? 1);
    setType(defaultType ?? 'prayer');
    setIcon('Sparkles');
    setTime('08:00');
    setFrequency('daily');
    setSelectedDays([]);
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
    sameTimeEveryDay,
    dayTimeOverrides: sameTimeEveryDay ? undefined : dayTimeOverrides,
    notificationMode,
    reminderMinutes: notificationMode === 'double' ? reminderMinutes : undefined,
  };

  const activeDays = getActiveDays(draftTask);

  const save = () => {
    if (!title.trim()) return;
    const normalizedOverrides = sameTimeEveryDay
      ? undefined
      : activeDays.map(day => ({
          jsDay: day.jsDay,
          time: dayTimeOverrides.find(item => item.jsDay === day.jsDay)?.time ?? time,
        }));
    onSave({
      ...draftTask,
      dayTimeOverrides: normalizedOverrides,
    });
  };

  if (!visible) return null;

  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose}>
      <View style={s.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.sheetShell}>
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
                  {ROUTINE_ICONS.map(item => {
                    const active = icon === item.id;
                    return (
                      <TouchableOpacity key={item.id} onPress={() => setIcon(item.id)} activeOpacity={0.84} style={[s.iconChip, active && s.iconChipActive]}>
                        <item.Icon s={18} c={active ? '#FFFFFF' : '#6B7280'} />
                        <Text style={[s.iconChipText, active && { color: '#FFFFFF' }]}>{item.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={s.editorBlock}>
              <Text style={s.mutedLabel}>Schedule</Text>

              <View style={s.scheduleCard}>
                <Text style={s.scheduleLabel}>Time</Text>
                <TextInput
                  value={time}
                  onChangeText={setTime}
                  placeholder="08:00"
                  placeholderTextColor="#D1D5DB"
                  style={s.timeInput}
                />

                <Text style={[s.scheduleLabel, { marginTop: 16 }]}>Frequency</Text>
                <View style={s.frequencyRow}>
                  {FREQUENCY_OPTIONS.map(option => {
                    const active = frequency === option.value;
                    return (
                      <TouchableOpacity key={option.value} onPress={() => setFrequency(option.value)} activeOpacity={0.84} style={[s.frequencyChip, active && { borderColor: accent, backgroundColor: `${accent}10` }]}>
                        <Text style={[s.frequencyChipText, active && { color: accent }]}>{option.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {frequency === 'specific_days' && (
                  <>
                    <Text style={[s.scheduleLabel, { marginTop: 16 }]}>Days</Text>
                    <View style={s.daysRow}>
                      {DAY_OPTIONS.map(day => {
                        const active = selectedDays.includes(day.key);
                        return (
                          <TouchableOpacity
                            key={day.key}
                            onPress={() => setSelectedDays(current => active ? current.filter(item => item !== day.key) : [...current, day.key])}
                            activeOpacity={0.84}
                            style={[s.dayChip, active && { borderColor: accent, backgroundColor: `${accent}12` }]}
                          >
                            <Text style={[s.dayChipText, active && { color: accent }]}>{day.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}

                <View style={s.sameTimeRow}>
                  <View>
                    <Text style={s.scheduleLabel}>Same time every day</Text>
                    <Text style={s.scheduleHint}>Turn off to place different times on different days.</Text>
                  </View>
                  <Switch value={sameTimeEveryDay} onValueChange={setSameTimeEveryDay} trackColor={{ true: `${accent}55`, false: '#E5E7EB' }} thumbColor={sameTimeEveryDay ? accent : '#FFFFFF'} />
                </View>

                {!sameTimeEveryDay && activeDays.length > 0 && (
                  <View style={s.overrideList}>
                    {activeDays.map(day => (
                      <View key={day.jsDay} style={s.overrideRow}>
                        <Text style={s.overrideLabel}>{day.label}</Text>
                        <TextInput
                          value={dayTimeOverrides.find(item => item.jsDay === day.jsDay)?.time ?? time}
                          onChangeText={value => setDayTimeOverrides(current => {
                            const existing = current.find(item => item.jsDay === day.jsDay);
                            if (existing) {
                              return current.map(item => item.jsDay === day.jsDay ? { ...item, time: value } : item);
                            }
                            return [...current, { jsDay: day.jsDay, time: value }];
                          })}
                          placeholder="08:00"
                          placeholderTextColor="#D1D5DB"
                          style={s.overrideInput}
                        />
                      </View>
                    ))}
                  </View>
                )}

                <Text style={[s.scheduleLabel, { marginTop: 16 }]}>Notifications</Text>
                <View style={s.notificationRow}>
                  {([
                    { key: 'none' as NotificationMode, label: 'None' },
                    { key: 'normal' as NotificationMode, label: 'At time' },
                    { key: 'double' as NotificationMode, label: 'Reminder' },
                  ]).map(option => {
                    const active = notificationMode === option.key;
                    return (
                      <TouchableOpacity key={option.key} onPress={() => setNotificationMode(option.key)} activeOpacity={0.84} style={[s.notificationChip, active && { borderColor: accent, backgroundColor: `${accent}10` }]}>
                        <Text style={[s.notificationChipText, active && { color: accent }]}>{option.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {notificationMode === 'double' && (
                  <View style={s.reminderRow}>
                    {[10, 15, 30].map(value => {
                      const active = reminderMinutes === value;
                      return (
                        <TouchableOpacity key={value} onPress={() => setReminderMinutes(value)} activeOpacity={0.84} style={[s.reminderChip, active && { backgroundColor: accent }]}>
                          <Text style={[s.reminderChipText, active && { color: '#FFFFFF' }]}>{value} min</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>

            {task && (
              <TouchableOpacity onPress={() => onDelete(task.id)} activeOpacity={0.84} style={s.deleteBtn}>
                <Trash2 s={16} c="#EF4444" />
                <Text style={s.deleteBtnText}>Delete Activity</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ApplyModeSheet({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (mode: 'today' | 'tomorrow') => void;
}) {
  if (!visible) return null;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.applyCard}>
          <Text style={s.applyTitle}>Apply schedule change</Text>
          <Text style={s.applyBody}>
            This activity is already part of your routine. Do you want the new timing to start today or from tomorrow?
          </Text>
          <View style={s.applyChoices}>
            <TouchableOpacity onPress={() => onSelect('today')} activeOpacity={0.84} style={s.applyChoice}>
              <Text style={s.applyChoiceTitle}>Today</Text>
              <Text style={s.applyChoiceBody}>Apply immediately.</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onSelect('tomorrow')} activeOpacity={0.84} style={s.applyChoice}>
              <Text style={s.applyChoiceTitle}>Tomorrow</Text>
              <Text style={s.applyChoiceBody}>Keep today unchanged.</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DayModelEditorSheet({
  visible,
  model,
  onClose,
  onSave,
}: {
  visible: boolean;
  model: DayModel | null;
  onClose: () => void;
  onSave: (model: DayModel) => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(MODEL_COLORS[0]);
  const [taskCount, setTaskCount] = useState('4');

  useEffect(() => {
    if (!visible) return;
    setName(model?.name ?? '');
    setColor(model?.color ?? MODEL_COLORS[0]);
    setTaskCount(String(model?.taskCount ?? 4));
  }, [model, visible]);

  if (!visible) return null;

  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose}>
      <View style={s.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.sheetShell}>
          <View style={s.sheetHandle} />
          <View style={s.editorHeader}>
            <TouchableOpacity onPress={onClose} activeOpacity={0.84} style={s.sheetHeaderIcon}>
              <X s={22} c="#9CA3AF" />
            </TouchableOpacity>
            <Text style={s.editorHeaderTitle}>{model ? 'Edit Day Model' : 'New Day Model'}</Text>
            <TouchableOpacity
              onPress={() => onSave({
                id: model?.id ?? `model_${Date.now()}`,
                name: name.trim() || 'Untitled Model',
                color,
                taskCount: Number.parseInt(taskCount || '0', 10) || 0,
              })}
              activeOpacity={0.84}
              style={[s.saveCircle, { backgroundColor: C.gold }]}
            >
              <CheckSmall s={18} c="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.editorContent} showsVerticalScrollIndicator={false}>
            <View style={s.editorBlock}>
              <Text style={[s.editorBlockLabel, { color: C.gold }]}>Model Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Travel Day"
                placeholderTextColor="#D1D5DB"
                style={s.titleInput}
              />
            </View>

            <View style={s.editorBlock}>
              <Text style={s.mutedLabel}>Accent</Text>
              <View style={s.colorRow}>
                {MODEL_COLORS.map(item => {
                  const active = color === item;
                  return (
                    <TouchableOpacity key={item} onPress={() => setColor(item)} activeOpacity={0.84} style={[s.colorDot, { backgroundColor: item }, active && s.colorDotActive]} />
                  );
                })}
              </View>
            </View>

            <View style={s.editorBlock}>
              <Text style={s.mutedLabel}>Tasks</Text>
              <TextInput
                value={taskCount}
                onChangeText={setTaskCount}
                keyboardType="number-pad"
                placeholder="4"
                placeholderTextColor="#D1D5DB"
                style={s.timeInput}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
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
  modelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 12 },
  modelCard: {
    width: '47%',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    borderLeftWidth: 4,
  },
  modelTitle: { fontFamily: F.serifMedium, fontSize: 16, color: '#111827' },
  modelMeta: { marginTop: 8, fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.4, color: '#D1D5DB', textTransform: 'uppercase' },
  newModelCard: {
    width: '47%',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#E9D6AF',
    borderStyle: 'dashed',
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 110,
    backgroundColor: '#FFFBEB',
    gap: 8,
  },
  newModelCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: '#E9D6AF', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  newModelText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.5, color: C.gold, textTransform: 'uppercase' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.34)' },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.36)' },
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
  applyCard: { width: '100%', maxWidth: 340, borderRadius: 28, backgroundColor: '#FFFFFF', padding: 22 },
  applyTitle: { fontFamily: F.serifMedium, fontSize: 24, color: '#111827', textAlign: 'center' },
  applyBody: { marginTop: 8, fontFamily: F.serif, fontSize: 15, lineHeight: 22, color: '#9CA3AF', textAlign: 'center' },
  applyChoices: { gap: 10, marginTop: 20 },
  applyChoice: { borderRadius: 20, borderWidth: 1, borderColor: '#F0EDE6', backgroundColor: '#FAFAFA', padding: 16 },
  applyChoiceTitle: { fontFamily: F.serifMedium, fontSize: 18, color: '#111827' },
  applyChoiceBody: { marginTop: 4, fontFamily: F.sans, fontSize: 12, color: '#9CA3AF' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotActive: { shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 3 },
});
