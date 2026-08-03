import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { Clock, X } from '@/components/icons/Icons';
import { BellDouble, BellNone, BellSingle } from '@/components/icons/NotificationBells';
import { C, F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { resolveTaskVariant } from '@/components/tasks/taskAdapters';
import { useTasks } from './TaskProvider';
import type { NotificationMode } from '@/components/shared/NotificationSettings';
import type { TaskDefinition, TaskDraft } from './taskTypes';

type Props = {
  visible: boolean;
  onClose: () => void;
  selectedDate: string;
};

// The same three marks the shared `NotificationSettings` row wears — one bell,
// and the number of arcs off it is the setting. This sheet is the other place
// the choice is made, and it would be odd for it to speak differently.
const MODES: { mode: NotificationMode; label: string; Icon: typeof BellNone }[] = [
  { mode: 'none', label: 'Off', Icon: BellNone },
  { mode: 'single', label: 'Single', Icon: BellSingle },
  { mode: 'double', label: 'Double', Icon: BellDouble },
];

const REMINDER_OPTIONS = [5, 10, 15, 30, 60];
const DEFAULT_REMINDER_MINUTES = 15;

const SOURCE_ACCENTS: Record<TaskDefinition['source'], string> = {
  routine: '#7C756D',
  spiritual: C.gold,
  quick: '#16A34A',
  habit: '#14A8E1',
  challenge: C.gold,
  reading_book: '#8B5E34',
  gratitude: '#F43F5E',
};

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const safe = normalized.length === 3
    ? normalized.split('').map(char => `${char}${char}`).join('')
    : normalized;
  const value = Number.parseInt(safe, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mixHex(hex: string, target: string, amount: number) {
  const normalize = (value: string) => {
    const raw = value.replace('#', '');
    return raw.length === 3 ? raw.split('').map(char => `${char}${char}`).join('') : raw;
  };
  const from = Number.parseInt(normalize(hex), 16);
  const to = Number.parseInt(normalize(target), 16);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * amount);
  const r = mix((from >> 16) & 255, (to >> 16) & 255);
  const g = mix((from >> 8) & 255, (to >> 8) & 255);
  const b = mix(from & 255, to & 255);
  return `#${[r, g, b].map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
}

function accentForTask(task: TaskDefinition) {
  return task.habitColor || SOURCE_ACCENTS[task.source] || C.gold;
}

function notificationToneForTask(task: TaskDefinition, muted: boolean) {
  const variant = resolveTaskVariant(task);
  const taskAccent = accentForTask(task);
  const mutedStatus = '#8A8177';

  if (variant === 'habit') {
    return {
      variant,
      accent: taskAccent,
      statusColor: muted ? mutedStatus : taskAccent,
      colors: [
        mixHex(taskAccent, '#FFFFFF', muted ? 0.96 : 0.88),
        mixHex(taskAccent, '#FFFFFF', muted ? 0.98 : 0.95),
        '#FFFFFF',
      ],
      borderColor: hexToRgba(taskAccent, muted ? 0.16 : 0.24),
      glowColor: mixHex(taskAccent, '#FFFFFF', muted ? 0.92 : 0.82),
      leftGlowColor: mixHex(taskAccent, '#FFFFFF', muted ? 0.94 : 0.74),
      rowAccentColor: muted ? '#D1D5DB' : taskAccent,
      shadowColor: taskAccent,
      radius: 18,
    };
  }

  if (variant === 'gratitude') {
    const accent = '#F43F5E';
    return {
      variant,
      accent,
      statusColor: muted ? mutedStatus : accent,
      colors: ['#FFEDF2', '#FFF7F8', '#FFFFFF'],
      borderColor: hexToRgba(accent, muted ? 0.12 : 0.24),
      glowColor: hexToRgba(accent, muted ? 0.05 : 0.15),
      leftGlowColor: hexToRgba(accent, muted ? 0.05 : 0.11),
      rowAccentColor: muted ? '#D1D5DB' : accent,
      shadowColor: accent,
      radius: 18,
    };
  }

  if (variant === 'reading') {
    const accent = '#9C7C4F';
    return {
      variant,
      accent,
      statusColor: muted ? mutedStatus : accent,
      colors: ['#FFFFFF', '#F4EBDC', '#FFF9F1'],
      borderColor: muted ? 'rgba(120,113,108,0.18)' : 'rgba(146,116,82,0.30)',
      glowColor: muted ? 'rgba(156,124,79,0.04)' : 'rgba(156,124,79,0.13)',
      leftGlowColor: muted ? 'rgba(156,124,79,0.05)' : 'rgba(197,160,89,0.18)',
      rowAccentColor: muted ? '#D6D3D1' : accent,
      shadowColor: '#1C1917',
      radius: 18,
    };
  }

  if (variant === 'challenge') {
    return {
      variant,
      accent: C.gold,
      statusColor: muted ? mutedStatus : '#A8853C',
      colors: ['#FFFDF7', '#FFFFFF', '#FFF8EA'],
      borderColor: muted ? 'rgba(120,113,108,0.18)' : 'rgba(197,160,89,0.36)',
      glowColor: muted ? 'rgba(197,160,89,0.05)' : 'rgba(197,160,89,0.14)',
      leftGlowColor: muted ? 'rgba(197,160,89,0.05)' : 'rgba(197,160,89,0.13)',
      rowAccentColor: muted ? '#D6D3D1' : C.gold,
      shadowColor: C.gold,
      radius: 24,
    };
  }

  if (variant === 'spiritual') {
    return {
      variant,
      accent: C.gold,
      statusColor: muted ? mutedStatus : '#A8853C',
      colors: ['#FFFBEB', '#FFFFFF', '#FFF9EA'],
      borderColor: muted ? 'rgba(120,113,108,0.16)' : 'rgba(197,160,89,0.30)',
      glowColor: muted ? 'rgba(197,160,89,0.05)' : 'rgba(197,160,89,0.11)',
      leftGlowColor: muted ? 'rgba(197,160,89,0.04)' : 'rgba(197,160,89,0.10)',
      rowAccentColor: muted ? '#D6D3D1' : C.gold,
      shadowColor: C.gold,
      radius: 18,
    };
  }

  if (variant === 'quick') {
    const accent = '#16A34A';
    return {
      variant,
      accent,
      statusColor: muted ? mutedStatus : accent,
      colors: ['#FFFFFF', '#F0FDF4', '#FFFFFF'],
      borderColor: muted ? 'rgba(120,113,108,0.16)' : hexToRgba(accent, 0.22),
      glowColor: hexToRgba(accent, muted ? 0.04 : 0.12),
      leftGlowColor: hexToRgba(accent, muted ? 0.04 : 0.10),
      rowAccentColor: muted ? '#D1D5DB' : accent,
      shadowColor: accent,
      radius: 18,
    };
  }

  return {
    variant,
    accent: '#1C1917',
    statusColor: muted ? mutedStatus : '#1C1917',
    colors: ['#F2F1EF', '#FFFFFF', '#FAFAFA'],
    borderColor: muted ? 'rgba(120,113,108,0.16)' : 'rgba(28,25,23,0.18)',
    glowColor: muted ? 'rgba(28,25,23,0.03)' : 'rgba(28,25,23,0.08)',
    leftGlowColor: muted ? 'rgba(28,25,23,0.03)' : 'rgba(28,25,23,0.07)',
    rowAccentColor: muted ? '#D1D5DB' : '#1C1917',
    shadowColor: '#1C1917',
    radius: 18,
  };
}

function sourceLabel(task: TaskDefinition) {
  switch (task.source) {
    case 'reading_book':
      return 'Reading';
    case 'quick':
      return 'Quick';
    case 'gratitude':
      return 'Gratitude';
    default:
      return task.source.charAt(0).toUpperCase() + task.source.slice(1);
  }
}

function formatModeLabel(mode: NotificationMode, reminderMinutes: number) {
  if (mode === 'none') return 'Off';
  if (mode === 'single') return 'At time';
  return `${reminderMinutes}m + time`;
}

function buildDraftFromDefinition(
  task: TaskDefinition,
  mode: NotificationMode,
  reminderMinutes?: number,
): TaskDraft {
  const nextReminder = mode === 'double'
    ? reminderMinutes ?? task.reminderMinutes ?? DEFAULT_REMINDER_MINUTES
    : undefined;

  return {
    id: task.id,
    title: task.title,
    subtitle: task.subtitle,
    level: task.level,
    source: task.source,
    type: task.type,
    icon: task.icon,
    habitColor: task.habitColor,
    targetView: task.targetView,
    targetTab: task.targetTab,
    schedule: task.schedule,
    notificationMode: mode,
    reminderMinutes: nextReminder,
    status: task.status,
    createdAt: task.createdAt,
    activatedAt: task.activatedAt,
    pausedAt: task.pausedAt,
    removedAt: task.removedAt,
  };
}

function AnimatedModeButton({
  active,
  accent,
  mode,
  label,
  Icon,
  onPress,
}: {
  active: boolean;
  accent: string;
  mode: NotificationMode;
  label: string;
  Icon: typeof BellNone;
  onPress: () => void;
}) {
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(active ? 1 : 0, {
      damping: 18,
      stiffness: 210,
      mass: 0.8,
    });
  }, [active, progress]);

  // The same ladder the shared `NotificationSettings` row climbs: none is a
  // refusal and takes the one colour that is not the accent, single is the
  // accent lightly, double is the accent whole.
  const lit = mode === 'none'
    ? { plate: '#FFFFFF', edge: C.red, ink: C.red }
    : mode === 'single'
      ? { plate: hexToRgba(accent, 0.12), edge: accent, ink: accent }
      : { plate: accent, edge: accent, ink: '#FFFFFF' };

  // ⚠ Everything rides `progress`. This button used to animate its SCALE only
  // and swap plate, icon and label through `active && {...}` — so it grew
  // smoothly while its colours changed in one frame.
  const plateStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['rgba(255,255,255,0.72)', lit.plate]),
    borderColor: interpolateColor(progress.value, [0, 1], ['#EFEDE6', lit.edge]),
    transform: [{ scale: 1 + progress.value * 0.015 }],
  }), [lit.plate, lit.edge]);
  const litIcon = useAnimatedStyle(() => ({ opacity: progress.value }));
  const restIcon = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], ['#A8A29E', lit.ink]),
  }), [lit.ink]);

  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={s.modeTouch}>
      <Reanimated.View style={[s.modeBtn, plateStyle]}>
        <View style={s.modeBtnIcon}>
          <Reanimated.View style={restIcon}>
            <Icon s={21} c="#A8A29E" w={2.05} />
          </Reanimated.View>
          <Reanimated.View style={[s.modeBtnIconLit, litIcon]}>
            <Icon s={21} c={lit.ink} w={2.05} />
          </Reanimated.View>
        </View>
        <Reanimated.Text style={[s.modeBtnText, textStyle]}>{label}</Reanimated.Text>
      </Reanimated.View>
    </TouchableOpacity>
  );
}

function ReminderButton({
  minutes,
  active,
  accent,
  onPress,
}: {
  minutes: number;
  active: boolean;
  accent: string;
  onPress: () => void;
}) {
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(active ? 1 : 0, {
      damping: 18,
      stiffness: 220,
      mass: 0.75,
    });
  }, [active, progress]);

  const pillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['#F5F3EF', accent]),
    transform: [{ scale: 1 + progress.value * 0.025 }],
  }), [accent]);
  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [C.textSecondary, '#FFFFFF']),
  }));

  return (
    <TouchableOpacity activeOpacity={0.86} onPress={onPress} style={s.reminderTouch}>
      <Reanimated.View style={[s.reminderPill, pillStyle]}>
        <Reanimated.Text style={[s.reminderPillText, textStyle]}>{minutes}m</Reanimated.Text>
      </Reanimated.View>
    </TouchableOpacity>
  );
}

function NotificationTaskRow({
  task,
  mode,
  reminderMinutes,
  onModeChange,
  onReminderChange,
}: {
  task: TaskDefinition;
  mode: NotificationMode;
  reminderMinutes: number;
  onModeChange: (task: TaskDefinition, mode: NotificationMode) => void;
  onReminderChange: (task: TaskDefinition, minutes: number) => void;
}) {
  const muted = mode === 'none';
  const tone = notificationToneForTask(task, muted);
  const SummaryIcon = mode === 'none' ? BellNone : mode === 'double' ? BellDouble : BellSingle;

  return (
    <View>
      <LinearGradient
        colors={tone.colors as [string, string, string]}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.96, y: 1 }}
        style={[
          s.row,
          {
            borderColor: tone.borderColor,
            borderRadius: tone.radius,
            shadowColor: tone.shadowColor,
            opacity: muted ? 0.90 : 1,
          },
        ]}
      >
        {tone.variant === 'reading' ? (
          <>
            <View pointerEvents="none" style={[s.rowReadingSpineOuter, { backgroundColor: muted ? '#D6D3D1' : '#9C7C4F' }]} />
            <View pointerEvents="none" style={[s.rowReadingSpineInner, { backgroundColor: muted ? '#E7E5E4' : C.gold }]} />
          </>
        ) : (
          <View pointerEvents="none" style={[s.rowAccent, { backgroundColor: tone.rowAccentColor }]} />
        )}
        {tone.variant === 'challenge' ? <View pointerEvents="none" style={[s.rowChallengeAccent, { backgroundColor: tone.rowAccentColor }]} /> : null}
        <View pointerEvents="none" style={[s.rowLeftGlow, { backgroundColor: tone.leftGlowColor }]} />
        <View pointerEvents="none" style={[s.rowGlow, { backgroundColor: tone.glowColor }]} />
        {tone.variant === 'habit' ? <View pointerEvents="none" style={[s.rowHabitRibbon, { backgroundColor: tone.rowAccentColor }]} /> : null}

        <View style={s.rowHead}>
          <View style={[s.timeBadge, { borderColor: hexToRgba(tone.statusColor, muted ? 0.15 : 0.26) }]}>
            <Clock s={11} c={tone.statusColor} w={2.2} />
            <Text style={[s.timeText, { color: tone.statusColor }]}>{task.schedule.time || '--:--'}</Text>
          </View>

          <View style={s.titleBlock}>
            <Text style={s.rowTitle} numberOfLines={1}>{task.title}</Text>
            <Text style={s.rowMeta} numberOfLines={1}>
              {sourceLabel(task)} - {task.subtitle || task.type}
            </Text>
          </View>

          <View style={[s.summaryPill, { backgroundColor: hexToRgba(tone.statusColor, muted ? 0.10 : 0.13) }]}>
            <SummaryIcon s={12} c={tone.statusColor} w={2.1} />
            <Text style={[s.summaryPillText, { color: tone.statusColor }]}>{formatModeLabel(mode, reminderMinutes)}</Text>
          </View>
        </View>

        <View style={s.modeRow}>
          {MODES.map(({ mode: optionMode, label, Icon }) => (
            <AnimatedModeButton
              key={optionMode}
              active={mode === optionMode}
              accent={tone.accent}
              mode={optionMode}
              label={label}
              Icon={Icon}
              onPress={() => onModeChange(task, optionMode)}
            />
          ))}
        </View>

        {mode === 'double' && (
          <View style={s.reminderWrap}>
            <Text style={s.reminderLabel}>Remind before</Text>
            <View style={s.reminderRow}>
              {REMINDER_OPTIONS.map(minutes => (
                <ReminderButton
                  key={minutes}
                  minutes={minutes}
                  active={reminderMinutes === minutes}
                  accent={tone.accent}
                  onPress={() => onReminderChange(task, minutes)}
                />
              ))}
            </View>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

export default function NotificationsSheet({ visible, onClose, selectedDate }: Props) {
  const insets = useSafeAreaInsets();
  const { tasks, instances, createOrUpdateTask } = useTasks();
  const [optimisticMode, setOptimisticMode] = useState<Record<string, NotificationMode>>({});
  const [optimisticReminder, setOptimisticReminder] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!visible) {
      setOptimisticMode({});
      setOptimisticReminder({});
    }
  }, [visible]);

  const dayTasks = useMemo(() => {
    const taskIds = new Set(
      instances
        .filter(instance => instance.status !== 'not_applicable')
        .map(instance => instance.taskId),
    );
    return tasks.filter(task => taskIds.has(task.id) && task.status === 'active');
  }, [tasks, instances]);

  const resolveMode = (task: TaskDefinition): NotificationMode =>
    optimisticMode[task.id] ?? task.notificationMode;

  const resolveReminder = (task: TaskDefinition): number =>
    optimisticReminder[task.id] ?? task.reminderMinutes ?? DEFAULT_REMINDER_MINUTES;

  const activeCount = dayTasks.filter(task => resolveMode(task) !== 'none').length;
  const doubleCount = dayTasks.filter(task => resolveMode(task) === 'double').length;
  const offCount = Math.max(0, dayTasks.length - activeCount);

  const dateLabel = useMemo(() => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    return new Date(year, month - 1, day, 12).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }, [selectedDate]);

  const handleModeChange = (task: TaskDefinition, mode: NotificationMode) => {
    if (resolveMode(task) === mode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setOptimisticMode(prev => ({ ...prev, [task.id]: mode }));

    const draft = buildDraftFromDefinition(task, mode, optimisticReminder[task.id]);
    void createOrUpdateTask(draft).catch(() => {
      setOptimisticMode(prev => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
    });
  };

  const handleReminderChange = (task: TaskDefinition, minutes: number) => {
    if (resolveReminder(task) === minutes) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setOptimisticMode(prev => ({ ...prev, [task.id]: 'double' }));
    setOptimisticReminder(prev => ({ ...prev, [task.id]: minutes }));

    const draft = buildDraftFromDefinition(task, 'double', minutes);
    void createOrUpdateTask(draft).catch(() => {
      setOptimisticMode(prev => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
      setOptimisticReminder(prev => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
    });
  };

  return (
    <SmoothBottomSheet
      visible={visible}
      onClose={onClose}
      durationIn={320}
      durationOut={210}
      backdropOpacity={0.42}
      sheetStyle={[s.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}
    >
      <View style={s.handleWrap}>
        <View style={s.handle} />
      </View>

      <LinearGradient
        colors={['#FFFFFF', '#FFF9EC', '#FFF7E8']}
        locations={[0, 0.62, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.header}
      >
        <View pointerEvents="none" style={s.headerHalo} />
        <View style={s.headerIcon}>
          <BellDouble s={24} c="#FFFFFF" w={2.15} />
        </View>
        <View style={s.headerCopy}>
          <Text style={s.eyebrowText}>Notifications</Text>
          <Text style={s.title}>Daily reminders</Text>
          <Text style={s.subtitle}>{dateLabel}</Text>
        </View>
        <TouchableOpacity haptic="selection" activeOpacity={0.76} onPress={onClose} style={s.closeBtn}>
          <X s={18} c={C.textMuted} w={2.4} />
        </TouchableOpacity>
      </LinearGradient>

      <View style={s.metricsRow}>
        <View style={s.metricItem}>
          <Text style={s.metricValue}>{activeCount}</Text>
          <Text style={s.metricLabel}>On</Text>
        </View>
        <View style={s.metricDivider} />
        <View style={s.metricItem}>
          <Text style={s.metricValue}>{doubleCount}</Text>
          <Text style={s.metricLabel}>Double</Text>
        </View>
        <View style={s.metricDivider} />
        <View style={s.metricItem}>
          <Text style={s.metricValue}>{offCount}</Text>
          <Text style={s.metricLabel}>Off</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        {dayTasks.length === 0 ? (
          <View style={s.emptyWrap}>
            <View style={s.emptyIcon}>
              <BellNone s={27} c="#D6D3D1" w={2} />
            </View>
            <Text style={s.emptyText}>No active tasks for this day</Text>
          </View>
        ) : (
          dayTasks.map(task => (
            <NotificationTaskRow
              key={task.id}
              task={task}
              mode={resolveMode(task)}
              reminderMinutes={resolveReminder(task)}
              onModeChange={handleModeChange}
              onReminderChange={handleReminderChange}
            />
          ))
        )}
      </ScrollView>
    </SmoothBottomSheet>
  );
}

const s = StyleSheet.create({
  sheet: {
    backgroundColor: '#F8F7F3',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDD8CE',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 2,
    padding: 14,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.22)',
    overflow: 'hidden',
    shadowColor: '#C5A059',
    shadowOpacity: 0.10,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  headerHalo: {
    position: 'absolute',
    right: -28,
    top: -34,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(197,160,89,0.13)',
  },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.gold,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
  },
  eyebrowText: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 1.6,
    color: C.gold,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: F.serifMedium,
    fontSize: 24,
    color: C.text,
    marginTop: 2,
  },
  subtitle: {
    fontFamily: F.sans,
    fontSize: 12,
    color: C.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderWidth: 1,
    borderColor: '#EEEAE2',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.74)',
    borderWidth: 1,
    borderColor: '#EEEAE2',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
  },
  metricValue: {
    fontFamily: F.serifMedium,
    fontSize: 20,
    color: C.text,
  },
  metricLabel: {
    fontFamily: F.sansBold,
    fontSize: 8.5,
    letterSpacing: 1.2,
    color: C.textMuted,
    textTransform: 'uppercase',
    marginTop: 1,
  },
  metricDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#EEEAE2',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
    gap: 12,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 54,
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F0EEE9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyText: {
    fontFamily: F.serifItalic,
    fontSize: 14,
    color: C.textMuted,
  },
  row: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    overflow: 'hidden',
    shadowOpacity: 0.08,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  rowAccent: {
    position: 'absolute',
    left: 0,
    top: 16,
    bottom: 16,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    opacity: 0.76,
  },
  rowChallengeAccent: {
    position: 'absolute',
    right: 0,
    top: 16,
    bottom: 16,
    width: 4,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    opacity: 0.76,
  },
  rowReadingSpineOuter: {
    position: 'absolute',
    left: 0,
    top: 14,
    bottom: 14,
    width: 5,
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
  },
  rowReadingSpineInner: {
    position: 'absolute',
    left: 6,
    top: 18,
    bottom: 18,
    width: 2,
    borderRadius: 2,
    opacity: 0.92,
  },
  rowLeftGlow: {
    position: 'absolute',
    left: -22,
    top: -18,
    width: 82,
    height: 82,
    borderRadius: 41,
    opacity: 0.30,
  },
  rowGlow: {
    position: 'absolute',
    right: -30,
    top: -28,
    width: 128,
    height: 96,
    borderRadius: 64,
    opacity: 0.48,
  },
  rowHabitRibbon: {
    position: 'absolute',
    right: 14,
    top: 0,
    width: 22,
    height: 5,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
    opacity: 0.74,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  timeBadge: {
    minWidth: 68,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.70)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 9,
  },
  timeText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontFamily: F.serifMedium,
    fontSize: 16,
    color: C.text,
  },
  rowMeta: {
    fontFamily: F.sans,
    fontSize: 11,
    color: C.textMuted,
    marginTop: 2,
  },
  summaryPill: {
    minHeight: 30,
    maxWidth: 104,
    borderRadius: 15,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  summaryPillText: {
    fontFamily: F.sansBold,
    fontSize: 8.5,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeTouch: {
    flex: 1,
  },
  modeBtn: {
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFEDE6',
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  modeBtnIcon: { width: 21, height: 21, alignItems: 'center', justifyContent: 'center' },
  modeBtnIconLit: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  modeBtnText: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  reminderWrap: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(120,113,108,0.12)',
  },
  reminderLabel: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: C.textMuted,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  reminderRow: {
    flexDirection: 'row',
    gap: 7,
  },
  reminderTouch: {
    flex: 1,
  },
  reminderPill: {
    minHeight: 34,
    borderRadius: 17,
    backgroundColor: '#F5F3EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderPillText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 0.35,
    color: C.textSecondary,
  },
});
