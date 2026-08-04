import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { X } from '@/components/icons/Icons';
import { BellDouble, BellNone, BellSingle } from '@/components/icons/NotificationBells';
import { C, F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import NotificationSettings from '@/components/shared/NotificationSettings';
import { useTasks } from './TaskProvider';
import type { NotificationMode } from '@/components/shared/NotificationSettings';
import type { TaskDefinition, TaskDraft } from './taskTypes';

/* ─────────────────────────────────────────────────────────────
 * THE DAY'S REMINDERS.
 *
 * WHAT IT WAS, and why it had to go: every task sat on its own
 * gradient card carrying TWO COLOUR BLOBS — an 82pt circle off the
 * top-left at 30% and a 128×96 lozenge off the top-right at 48% —
 * plus an accent rail, and depending on the task a habit ribbon, a
 * second rail, or a pair of book spines. The header wore a third
 * blob, a 130pt gold circle, behind a 46pt solid gold disc. Eight
 * decorative layers before a single word was read.
 *
 * That is the app's old voice. Nothing else in Anasta is built that
 * way now, and a stack of six such cards is what made this sheet look
 * like a different application.
 *
 * WHAT IT IS: ONE PLATE, and the tasks are rows on it, divided by the
 * app's own fold — a gold hairline fading at both ends with white
 * caught under it. Mobbin's notification screens all land in the same
 * place (Alan, BeReal, Google Photos, Phantom): a settings list is
 * rows on a surface, never a deck of illustrated cards.
 *
 * ⚠ COLOUR NOW ARRIVES THROUGH ONE MEMBER. Each task keeps its own
 * accent — gold for spiritual, the habit's own colour, brown for
 * reading — but it is carried by a 3pt rail at the row's edge and by
 * the lit mode button, and nowhere else. Six accents on six grounds
 * is a fruit salad; six accents on six rails is an index.
 *
 * ⚠ AND THE CONTROL IS NO LONGER A COPY. This sheet used to carry its
 * own `AnimatedModeButton` and `ReminderButton`, duplicating
 * `NotificationSettings` — the component six other screens already
 * use, whose header comment says this sheet "would be odd to speak
 * differently". It now uses the real one. Two implementations of one
 * choice cannot stay in step, and this deletes about a hundred and
 * forty lines of the second.
 * ───────────────────────────────────────────────────────────── */

type Props = {
  visible: boolean;
  onClose: () => void;
  selectedDate: string;
};

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

function accentForTask(task: TaskDefinition) {
  return task.habitColor || SOURCE_ACCENTS[task.source] || C.gold;
}

/** The one colour a silenced row is allowed. */
const OFF_RAIL = '#D8D5D0';
const OFF_INK = '#A8A29E';
const OFF_FAINT = '#C4C0BB';

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

/* The fold that divides one row from the next: a gold hairline fading at
 * both ends with white caught under it. The app divides a plate with its
 * rules, never by seating a second plate on it. */
const RowFold = memo(function RowFold() {
  return (
    <View pointerEvents="none" style={s.fold}>
      <View style={s.foldCut} />
      <View style={s.foldLit} />
    </View>
  );
});

/**
 * One task on the plate.
 *
 * ⚠ MEMOISED, and it matters here: tapping a mode on one task used to
 * re-render every other row on the sheet, each of which then rebuilt an
 * eight-field colour object through two rounds of hex arithmetic. The row
 * now re-renders only when its own mode or minutes change.
 */
const NotificationTaskRow = memo(function NotificationTaskRow({
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
  const off = mode === 'none';
  const accent = accentForTask(task);
  const SummaryIcon = off ? BellNone : mode === 'double' ? BellDouble : BellSingle;

  const handleMode = useCallback(
    (next: NotificationMode) => onModeChange(task, next),
    [onModeChange, task],
  );
  const handleReminder = useCallback(
    (minutes: number) => onReminderChange(task, minutes),
    [onReminderChange, task],
  );

  return (
    <View style={s.row}>
      {/* The task's own colour, and the only place on the row it appears
          besides the lit button. Ash when the task is silenced — this is
          what makes an off row readable from across the list. */}
      <View pointerEvents="none" style={[s.rowRail, { backgroundColor: off ? OFF_RAIL : accent }]} />

      <View style={s.rowHead}>
        <Text style={[s.rowTime, { color: off ? OFF_INK : accent }]}>
          {task.schedule.time || '--:--'}
        </Text>
        <View style={s.rowCopy}>
          <Text style={[s.rowTitle, off && s.rowTitleOff]} numberOfLines={1}>{task.title}</Text>
          <Text style={[s.rowMeta, off && s.rowMetaOff]} numberOfLines={1}>
            {sourceLabel(task)} · {task.subtitle || task.type}
          </Text>
        </View>
        <View style={s.rowSummary}>
          <SummaryIcon s={12} c={off ? OFF_INK : accent} w={2.1} />
          <Text style={[s.rowSummaryText, { color: off ? OFF_INK : accent }]} numberOfLines={1}>
            {formatModeLabel(mode, reminderMinutes)}
          </Text>
        </View>
      </View>

      {/* The real control, not this sheet's copy of it. `label=""` drops its
          heading, because the row above already names the task. */}
      <NotificationSettings
        label=""
        mode={mode}
        accent={accent}
        reminderMinutes={reminderMinutes}
        onModeChange={handleMode}
        onReminderChange={handleReminder}
        style={s.rowControl}
      />
    </View>
  );
});


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

  /**
   * ⚠ ONE LINE, NOT A STAT STRIP. This was three big numerals in a bordered
   * bar — On, Double, Off — and none of them did anything: not a filter, not
   * a control, three figures a reader can also get by looking at the list
   * directly under them. It is a sentence now, and it sits with the date.
   */
  const activeCount = dayTasks.filter(task => resolveMode(task) !== 'none').length;
  const offCount = Math.max(0, dayTasks.length - activeCount);
  const tally = dayTasks.length === 0
    ? ''
    : offCount === 0
      ? `${activeCount} on`
      : activeCount === 0
        ? `${offCount} off`
        : `${activeCount} on, ${offCount} off`;

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

      {/* No plate, no halo, no gold disc — the sheet's own surface is the
          ground, and the head is type on it. */}
      <View style={s.header}>
        <View style={s.headerCopy}>
          <Text style={s.eyebrowText}>Notifications</Text>
          <Text style={s.title}>Daily reminders</Text>
          <Text style={s.subtitle} numberOfLines={1}>
            {tally ? `${dateLabel} · ${tally}` : dateLabel}
          </Text>
        </View>
        <TouchableOpacity haptic="selection" activeOpacity={0.76} onPress={onClose} style={s.closeBtn}>
          <X s={18} c={C.textMuted} w={2.4} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        {dayTasks.length === 0 ? (
          <View style={s.emptyWrap}>
            <BellNone s={30} c="#D6D3D1" w={1.9} />
            <Text style={s.emptyText}>No active tasks for this day</Text>
          </View>
        ) : (
          <View style={s.plate}>
            <View pointerEvents="none" style={s.plateLit} />
            {dayTasks.map((task, index) => (
              <React.Fragment key={task.id}>
                {index > 0 && <RowFold />}
                <NotificationTaskRow
                  task={task}
                  mode={resolveMode(task)}
                  reminderMinutes={resolveReminder(task)}
                  onModeChange={handleModeChange}
                  onReminderChange={handleReminderChange}
                />
              </React.Fragment>
            ))}
          </View>
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
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#DDD8CE' },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 4,
    gap: 12,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrowText: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 1.8,
    color: C.gold,
    textTransform: 'uppercase',
  },
  title: { fontFamily: F.serifMedium, fontSize: 26, lineHeight: 31, color: C.text, marginTop: 3 },
  subtitle: { fontFamily: F.sans, fontSize: 12, color: C.textSecondary, marginTop: 2 },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#EEEAE2',
  },

  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },

  /* One plate; the tasks are rows on it. */
  plate: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.26)',
    overflow: 'hidden',
    shadowColor: '#C5A059',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 2,
  },
  plateLit: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },

  fold: { marginHorizontal: 16, height: 2 },
  foldCut: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(197,160,89,0.30)' },
  foldLit: { height: 1, backgroundColor: 'rgba(255,255,255,0.85)' },

  row: { paddingLeft: 16, paddingRight: 16, paddingVertical: 14 },
  // The task's colour, and the row's whole claim to it.
  rowRail: {
    position: 'absolute',
    left: 0,
    top: 15,
    bottom: 15,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowTime: {
    fontFamily: F.sansBold,
    fontSize: 11.5,
    letterSpacing: 0.4,
    minWidth: 40,
    fontVariant: ['tabular-nums'],
  },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: F.serifMedium, fontSize: 16.5, lineHeight: 20, color: C.text },
  rowTitleOff: { color: OFF_INK },
  rowMeta: { fontFamily: F.sans, fontSize: 10.5, lineHeight: 14, color: C.textMuted, marginTop: 1 },
  rowMetaOff: { color: OFF_FAINT },
  rowSummary: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowSummaryText: {
    fontFamily: F.sansBold,
    fontSize: 8.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  rowControl: { marginTop: 12 },

  emptyWrap: { alignItems: 'center', paddingVertical: 54, gap: 12 },
  emptyText: { fontFamily: F.serifItalic, fontSize: 14, color: C.textMuted },
});
