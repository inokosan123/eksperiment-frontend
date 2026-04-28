import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import ConfirmModal from '@/components/shared/ConfirmModal';
import NotificationSettings, { NotificationMode } from '@/components/shared/NotificationSettings';
import TaskFrequencyEditor, { TaskFrequency } from '@/components/shared/TaskFrequencyEditor';
import TaskTimeEditor, { TaskDayTimes } from '@/components/shared/TaskTimeEditor';
import { useTasks } from '@/components/tasks/TaskProvider';
import { buildInstanceId, getLocalDateKey } from '@/components/tasks/taskScheduler';
import type { TaskDraft } from '@/components/tasks/taskTypes';
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

type HabitFrequency = TaskFrequency;

type HabitStep = {
  id: string;
  title: string;
  time: string;
  frequency: HabitFrequency;
  selectedDays?: number[];
  monthlyDays?: number[];
  sameTimeEveryDay?: boolean;
  dayTimes?: TaskDayTimes;
  notificationMode?: NotificationMode;
  reminderMinutes?: number;
  completedToday: boolean;
  currentStreak: number;
  bestStreak: number;
  completionRate: number;
};

type HabitItem = {
  id: string;
  name: string;
  color: string;
  icon: string;
  active: boolean;
  steps: HabitStep[];
};

const HABIT_COLORS = ['#C5A059', '#16A34A', '#2563EB', '#DB2777', '#7C3AED', '#EA580C', '#0F766E'];
const HABIT_ICONS = ['🙏', '📖', '🕯️', '💧', '🏃', '☀️', '🌙', '🎵', '🧠', '🍎', '✍️', '❤️'];

const DAY_OPTIONS = [
  { key: 0, label: 'M' },
  { key: 1, label: 'T' },
  { key: 2, label: 'W' },
  { key: 3, label: 'T' },
  { key: 4, label: 'F' },
  { key: 5, label: 'S' },
  { key: 6, label: 'S' },
];

const INITIAL_HABITS: HabitItem[] = [
  {
    id: 'habit_1',
    name: 'Morning Rule',
    color: '#16A34A',
    icon: '🙏',
    active: true,
    steps: [
      { id: 'h1s1', title: 'Morning prayer', time: '07:00', frequency: 'daily', completedToday: true, currentStreak: 8, bestStreak: 17, completionRate: 86 },
      { id: 'h1s2', title: 'Read 1 chapter', time: '07:20', frequency: 'daily', completedToday: false, currentStreak: 4, bestStreak: 11, completionRate: 72 },
    ],
  },
  {
    id: 'habit_2',
    name: 'Evening Review',
    color: '#C5A059',
    icon: '🕯️',
    active: true,
    steps: [
      { id: 'h2s1', title: 'Examine the day', time: '22:00', frequency: 'daily', completedToday: false, currentStreak: 6, bestStreak: 14, completionRate: 80 },
      { id: 'h2s2', title: 'Write one correction', time: '22:10', frequency: 'weekdays', completedToday: false, currentStreak: 3, bestStreak: 8, completionRate: 61 },
    ],
  },
  {
    id: 'habit_3',
    name: 'Study Block',
    color: '#2563EB',
    icon: '📖',
    active: false,
    steps: [
      { id: 'h3s1', title: 'Read 20 minutes', time: '18:30', frequency: 'specific_days', selectedDays: [0, 2, 4], completedToday: false, currentStreak: 0, bestStreak: 10, completionRate: 54 },
    ],
  },
];

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

function habitStepTaskId(habitId: string, stepId: string) {
  return `habit_${habitId}_${stepId}`;
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
    icon: 'Heart',
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
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const done = new Set<string>();
  const skipped = new Set<string>();
  const missed = new Set<string>();

  for (let day = 1; day <= today.getDate(); day += 1) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const marker = (day + step.id.length) % 10;
    if (marker < 5) done.add(key);
    else if (marker === 5 || marker === 6) skipped.add(key);
    else if (marker < 9) missed.add(key);
  }

  return { done, skipped, missed };
}

export default function HabitsView() {
  const {
    createOrUpdateTask,
    remove: removeTask,
    pause: pauseTask,
    completeInstance,
    resetInstance,
  } = useTasks();
  const [habits, setHabits] = useState<HabitItem[]>(INITIAL_HABITS);
  const [tab, setTab] = useState<'active' | 'paused'>('active');
  const [expandedId, setExpandedId] = useState<string | null>(INITIAL_HABITS[0].id);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<HabitItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HabitItem | null>(null);
  const [pauseConfirmTarget, setPauseConfirmTarget] = useState<HabitItem | null>(null);
  const [analyticsTarget, setAnalyticsTarget] = useState<HabitItem | null>(null);
  const [taskDetail, setTaskDetail] = useState<{ habit: HabitItem; step: HabitStep } | null>(null);

  const activeHabits = useMemo(() => habits.filter(item => item.active), [habits]);
  const pausedHabits = useMemo(() => habits.filter(item => !item.active), [habits]);
  const visibleHabits = tab === 'active' ? activeHabits : pausedHabits;

  useEffect(() => {
    void Promise.all(INITIAL_HABITS.flatMap(habit =>
      habit.steps.map(step => createOrUpdateTask(habitStepToTaskDraft(habit, step))),
    ));
  }, [createOrUpdateTask]);

  const toggleStep = async (habitId: string, stepId: string) => {
    const habit = habits.find(item => item.id === habitId);
    const step = habit?.steps.find(item => item.id === stepId);
    if (!habit || !step) return;
    const nextCompleted = !step.completedToday;
    setHabits(current => current.map(habit => habit.id === habitId ? {
      ...habit,
      steps: habit.steps.map(step => step.id === stepId ? { ...step, completedToday: !step.completedToday } : step),
    } : habit));
    const instanceId = buildInstanceId(habitStepTaskId(habitId, stepId), getLocalDateKey());
    if (nextCompleted) await completeInstance(instanceId);
    else await resetInstance(instanceId);
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
    setHabits(current => {
      const exists = current.some(item => item.id === habit.id);
      return exists
        ? current.map(item => item.id === habit.id ? habit : item)
        : [habit, ...current];
    });
    setEditorOpen(false);
    setEditTarget(null);
    setExpandedId(habit.id);
  };

  const setHabitActiveState = async (habit: HabitItem, active: boolean) => {
    if (active) {
      const nextHabit = { ...habit, active: true };
      await Promise.all(nextHabit.steps.map(step => createOrUpdateTask(habitStepToTaskDraft(nextHabit, step))));
    } else {
      await Promise.all(habit.steps.map(step => pauseTask(habitStepTaskId(habit.id, step.id))));
    }

    setHabits(current => current.map(item => item.id === habit.id ? { ...item, active } : item));
    setTab(active ? 'active' : 'paused');
    setExpandedId(habit.id);
  };

  const progressFor = (habit: HabitItem) => {
    const total = habit.steps.length;
    const done = habit.steps.filter(step => step.completedToday).length;
    return { total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
  };

  return (
    <View style={s.screen}>
      <ScreenTitleBar
        title="HABITS"
        showBack
        rightElement={(
          <TouchableOpacity onPress={() => { setEditTarget(null); setEditorOpen(true); }} activeOpacity={0.76} style={s.headerBtn}>
            <Plus s={18} c={C.gold} />
          </TouchableOpacity>
        )}
      />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.tabBar}>
          {[
            { key: 'active' as const, label: `Active (${activeHabits.length})` },
            { key: 'paused' as const, label: `Paused (${pausedHabits.length})` },
          ].map(item => {
            const active = tab === item.key;
            return (
              <TouchableOpacity key={item.key} onPress={() => { setTab(item.key); setExpandedId(null); }} activeOpacity={0.82} style={[s.tab, active && s.tabActive]}>
                <Text style={[s.tabText, active && s.tabTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={s.helperText}>
          {tab === 'active'
            ? 'Active habits appear in your daily flow and can be checked off each day.'
            : 'Paused habits stay here so you can resume them whenever you want.'}
        </Text>

        <View style={s.habitList}>
          {visibleHabits.map(habit => {
            const progress = progressFor(habit);
            const expanded = expandedId === habit.id;
            return (
              <View key={habit.id} style={s.habitCard}>
                <TouchableOpacity onPress={() => setExpandedId(current => current === habit.id ? null : habit.id)} activeOpacity={0.85} style={s.habitHead}>
                  <View style={[s.iconCircle, { backgroundColor: hexToRgba(habit.color, 0.12) }]}>
                    <Text style={s.iconEmoji}>{habit.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={s.habitTitleRow}>
                      <Text style={s.habitTitle}>{habit.name}</Text>
                      <Text style={[s.progressText, { color: habit.color }]}>{progress.done}/{progress.total}</Text>
                    </View>
                    <Text style={s.habitMeta}>{habit.steps.length} {habit.steps.length === 1 ? 'step' : 'steps'} today</Text>
                    <View style={s.progressBar}>
                      <View style={[s.progressFill, { width: `${progress.pct}%`, backgroundColor: habit.color }]} />
                    </View>
                  </View>
                  <View style={[s.chevronWrap, expanded && s.chevronWrapExpanded]}>
                    <ChevronDown s={16} c="#D1D5DB" />
                  </View>
                </TouchableOpacity>

                {expanded && (
                  <View style={s.habitBody}>
                    {habit.steps.map(step => (
                      <TouchableOpacity
                        key={step.id}
                        onPress={() => habit.active && toggleStep(habit.id, step.id)}
                        activeOpacity={0.84}
                        style={[s.stepRow, !habit.active && s.stepRowDim]}
                      >
                        <View style={[s.stepCheck, step.completedToday && { backgroundColor: habit.color, borderColor: habit.color }]}>
                          {step.completedToday && <CheckSmall s={12} c="#FFFFFF" />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.stepTitle, step.completedToday && s.stepTitleDone]}>{step.title}</Text>
                          <View style={s.stepMetaRow}>
                            <Text style={s.stepMeta}>{getStepDisplayTime(step)}</Text>
                            <Text style={s.stepMetaSlash}>/</Text>
                            <Text style={s.stepMeta}>{getFreqLabel(step)}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}

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
            <Text style={s.emptyTitle}>{tab === 'active' ? 'All habits are paused' : 'No paused habits'}</Text>
            <Text style={s.emptyBody}>
              {tab === 'active'
                ? 'Switch to paused if you want to bring one back.'
                : 'Paused habits will appear here.'}
            </Text>
          </View>
        )}
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
            setHabits(current => current.filter(item => item.id !== deleteTarget.id));
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
  const [icon, setIcon] = useState(HABIT_ICONS[0]);
  const [steps, setSteps] = useState<HabitStep[]>([]);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editStep, setEditStep] = useState<HabitStep | null>(null);
  const [pendingDeleteStep, setPendingDeleteStep] = useState<HabitStep | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (editHabit) {
      setName(editHabit.name);
      setColor(editHabit.color);
      setIcon(editHabit.icon);
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

  return (
    <>
      <SmoothBottomSheet visible={visible} onClose={onClose} sheetStyle={s.sheet} keyboardAware>
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
                  <Text style={s.previewIcon}>{icon}</Text>
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
                        activeOpacity={0.84}
                        style={[s.colorDot, { backgroundColor: item }, active && s.colorDotActive]}
                      >
                        {active && <CheckSmall s={12} c="#FFFFFF" />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={s.sheetBlock}>
                <Text style={s.sheetBlockLabel}>Icon</Text>
                <View style={s.iconGrid}>
                  {HABIT_ICONS.map(item => {
                    const active = icon === item;
                    return (
                      <TouchableOpacity key={item} onPress={() => setIcon(item)} activeOpacity={0.84} style={[s.iconChip, active && { borderColor: color, backgroundColor: hexToRgba(color, 0.08) }]}>
                        <Text style={s.iconChipText}>{item}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={s.sheetBlock}>
                <View style={s.blockTitleRow}>
                  <Text style={s.sheetBlockLabel}>Steps</Text>
                  <TouchableOpacity onPress={() => { setEditStep(null); setTaskOpen(true); }} activeOpacity={0.84} style={s.addStepBtn}>
                    <Plus s={12} c={color} />
                    <Text style={[s.addStepText, { color }]}>Add Step</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.stepDraftList}>
                  {steps.map(step => (
                    <TouchableOpacity key={step.id} activeOpacity={0.84} onPress={() => { setEditStep(step); setTaskOpen(true); }} style={s.stepDraftCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.stepDraftTitle}>{step.title}</Text>
                        <Text style={s.stepDraftMeta}>{step.time} / {getFreqLabel(step)}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={event => {
                          event.stopPropagation();
                          setPendingDeleteStep(step);
                        }}
                        activeOpacity={0.8}
                        style={s.stepDraftDelete}
                      >
                        <Trash2 s={17} c="#EF4444" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
      </SmoothBottomSheet>

      <HabitTaskEditorSheet
        visible={taskOpen}
        step={editStep}
        accent={color}
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
}

function HabitTaskEditorSheet({
  visible,
  step,
  accent,
  onClose,
  onSave,
}: {
  visible: boolean;
  step: HabitStep | null;
  accent: string;
  onClose: () => void;
  onSave: (step: HabitStep) => void;
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
      currentStreak: step?.currentStreak ?? 0,
      bestStreak: step?.bestStreak ?? 0,
      completionRate: step?.completionRate ?? 70,
    });
  };

  if (!visible) return null;

  return (
    <SmoothBottomSheet visible={visible} onClose={onClose} sheetStyle={s.taskBottomSheet} keyboardAware>
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

  const overallPct = Math.round(habit.steps.reduce((sum, step) => sum + step.completionRate, 0) / Math.max(1, habit.steps.length));
  const bestStep = [...habit.steps].sort((a, b) => b.completionRate - a.completionRate)[0];
  const worstStep = [...habit.steps].sort((a, b) => a.completionRate - b.completionRate)[0];

  return (
    <SmoothBottomSheet visible={!!habit} onClose={onClose} sheetStyle={s.analyticsSheet}>
          <View style={s.sheetHandle} />
          <View style={s.analyticsHead}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[s.iconCircle, { backgroundColor: hexToRgba(habit.color, 0.12), width: 42, height: 42, borderRadius: 16 }]}>
                <Text style={s.iconEmoji}>{habit.icon}</Text>
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
              <AnalyticsStatCard label="This Week" value={`${Math.max(0, overallPct - 4)}%`} accent={habit.color} />
              <AnalyticsStatCard label="This Month" value={`${overallPct}%`} accent={habit.color} />
              <AnalyticsStatCard label="All Time" value={`${Math.min(100, overallPct + 5)}%`} accent={habit.color} />
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

  const cells: (number | null)[] = [];
  for (let index = 0; index < (firstDay === 0 ? 6 : firstDay - 1); index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);

  return (
    <SmoothBottomSheet visible={!!detail} onClose={onClose} sheetStyle={s.analyticsSheet}>
          <View style={s.sheetHandle} />
          <View style={s.analyticsHead}>
            <View style={{ flex: 1 }}>
              <Text style={s.analyticsTitle}>{step.title}</Text>
              <Text style={s.analyticsMeta}><Text style={{ color: habit.color }}>{habit.icon}</Text> {habit.name}</Text>
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
              <ConsistencyRow label="This Week" pct={Math.max(0, step.completionRate - 6)} color={habit.color} />
              <ConsistencyRow label="This Month" pct={step.completionRate} color={habit.color} />
              <ConsistencyRow label="Since Start" pct={Math.min(100, step.completionRate + 4)} color={habit.color} />
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
  tabBar: { flexDirection: 'row', borderRadius: 20, backgroundColor: '#F4F0E7', padding: 4, gap: 4 },
  tab: { flex: 1, minHeight: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 1 },
  tabText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.6, color: '#9CA3AF', textTransform: 'uppercase' },
  tabTextActive: { color: C.gold },
  helperText: { marginTop: 12, paddingHorizontal: 4, fontFamily: F.serif, fontSize: 14, lineHeight: 20, color: '#A8A29E' },
  habitList: { gap: 14, paddingTop: 14 },
  habitCard: { borderRadius: 28, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0EDE6', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 6 }, shadowRadius: 18, elevation: 2 },
  habitHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
  iconCircle: { width: 46, height: 46, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  iconEmoji: { fontSize: 22 },
  habitTitleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'center' },
  habitTitle: { flex: 1, fontFamily: F.serifMedium, fontSize: 21, color: '#111827' },
  progressText: { fontFamily: F.serifMedium, fontSize: 17 },
  habitMeta: { marginTop: 3, fontFamily: F.sans, fontSize: 11, color: '#9CA3AF' },
  progressBar: { marginTop: 10, height: 5, borderRadius: 999, backgroundColor: '#F3F4F6', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  chevronWrap: { marginTop: 2 },
  chevronWrapExpanded: { transform: [{ rotate: '180deg' }] },
  habitBody: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#F5F5F4' },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
  stepRowDim: { opacity: 0.45 },
  stepCheck: { width: 22, height: 22, borderRadius: 8, borderWidth: 1.5, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepTitle: { fontFamily: F.serif, fontSize: 20, lineHeight: 24, color: '#1F2937' },
  stepTitleDone: { color: '#A8A29E', textDecorationLine: 'line-through' },
  stepMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  stepMeta: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.3, color: '#A8A29E', textTransform: 'uppercase' },
  stepMetaSlash: { fontFamily: F.sansBold, fontSize: 9, color: '#D1D5DB' },
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
  sheetInput: { minHeight: 52, borderRadius: 20, backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#F2F1EC', paddingHorizontal: 16, fontFamily: F.serif, fontSize: 22, color: '#1F2937' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  colorDotActive: { shadowColor: '#000', shadowOpacity: 0.12, shadowOffset: { width: 0, height: 3 }, shadowRadius: 10, elevation: 2 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  iconChip: { width: 44, height: 44, borderRadius: 18, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  iconChipText: { fontSize: 20 },
  blockTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  addStepBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 28, borderRadius: 14, paddingHorizontal: 10, backgroundColor: '#F8F5ED' },
  addStepText: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.4, textTransform: 'uppercase' },
  stepDraftList: { gap: 10 },
  stepDraftCard: { borderRadius: 18, backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#F2F1EC', paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepDraftTitle: { fontFamily: F.serifMedium, fontSize: 18, color: '#111827' },
  stepDraftMeta: { marginTop: 3, fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.3, color: '#A8A29E', textTransform: 'uppercase' },
  stepDraftDelete: { width: 38, height: 38, borderRadius: 16, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
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
