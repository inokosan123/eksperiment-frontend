import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { X } from '@/components/icons/Icons';
import { BellDouble, BellNone, BellSingle } from '@/components/icons/NotificationBells';
import { LinearGradient } from 'expo-linear-gradient';
import { C, F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import NotificationSettings from '@/components/shared/NotificationSettings';
import { TaskTypeBadge, taskCardSkin } from '@/components/shared/TaskCards';
import { resolveTaskVariant } from '@/components/tasks/taskAdapters';
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
 * WHAT IT IS: EACH TASK IS ITS OWN CARD AGAIN — but the card it
 * already is on Home, enlarged, rather than a decorated invention.
 *
 * ⚠ THE SKIN COMES FROM `taskCardSkin()` IN `TaskCards`, WHERE THE REAL
 * CARDS LIVE. Same gradient, same angle, same edge, same radius, and
 * the same two ornaments: challenge bound between its heavy gold rails,
 * reading carrying its book spine. So you know what a task is here the
 * same way you know it on Home — spiritual is cream and gold, a habit
 * wears its own colour, gratitude is rose, quick is green — and the two
 * screens cannot drift, because there is one recipe and both read it.
 *
 * ⚠ WHAT WAS TRIED FIRST AND WAS WRONG: flattening all of this into one
 * plate of rows with a 3pt colour rail each. It killed the very thing
 * that makes the list scannable — a task's category was a hairline
 * instead of the whole surface — and the sheet stopped looking like the
 * app it belongs to. The old sheet's fault was never that it had cards.
 * It was that the cards were DECORATED: two floating colour blobs per
 * row, a third behind the header, a solid gold disc. Those are gone;
 * the card is not.
 *
 * ⚠ AND THE CONTROL IS NO LONGER A COPY. This sheet used to carry its
 * own `AnimatedModeButton` and `ReminderButton`, duplicating
 * `NotificationSettings` — the component six other screens already
 * use, whose header comment says this sheet "would be odd to speak
 * differently". It now uses the real one.
 * ───────────────────────────────────────────────────────────── */

type Props = {
  visible: boolean;
  onClose: () => void;
  selectedDate: string;
};

const DEFAULT_REMINDER_MINUTES = 15;

/**
 * What a silenced task wears. Its ground stays its own — a spiritual card
 * that has been muted is still a spiritual card — but its edge, its ink and
 * its rails all drain, so a scan of the list separates on from off without
 * reading a word.
 */
const OFF_EDGE = 'rgba(120,113,108,0.20)';
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

/**
 * One task, as its own card.
 *
 * The skin is the real card's — see `taskCardSkin`. What is enlarged is the
 * TYPE: the title runs at 19 where the Home card sets it at about 15, because
 * here the card is the whole subject of the row rather than one line in a
 * list, and because the control below it needs a head heavy enough to sit
 * under.
 *
 * ⚠ MEMOISED, and it matters: tapping a mode on one task used to re-render
 * every other card on the sheet, each of which then rebuilt an eight-field
 * colour object through two rounds of hex arithmetic.
 */
const NotificationTaskCard = memo(function NotificationTaskCard({
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
  const variant = resolveTaskVariant(task);
  const skin = useMemo(
    () => taskCardSkin(variant, task.habitColor),
    [variant, task.habitColor],
  );
  const SummaryIcon = off ? BellNone : mode === 'double' ? BellDouble : BellSingle;
  const summaryInk = off ? OFF_INK : skin.accent;

  const handleMode = useCallback(
    (next: NotificationMode) => onModeChange(task, next),
    [onModeChange, task],
  );
  const handleReminder = useCallback(
    (minutes: number) => onReminderChange(task, minutes),
    [onReminderChange, task],
  );

  return (
    <LinearGradient
      colors={skin.colors}
      start={skin.start}
      end={skin.end}
      style={[
        s.card,
        {
          borderColor: off ? OFF_EDGE : skin.borderColor,
          borderRadius: skin.radius,
        },
        // Challenge is bound between two heavy gold rails on Home, and it
        // keeps them here — it is the mark that tells a challenge apart.
        skin.railed && {
          borderLeftWidth: 5,
          borderRightWidth: 5,
          borderLeftColor: off ? OFF_RAIL : skin.accent,
          borderRightColor: off ? OFF_RAIL : skin.accent,
        },
      ]}
    >
      {/* The lit hairline every raised surface in this app wears. */}
      <View pointerEvents="none" style={s.cardLit} />
      {/* Reading's book spine, tucked at the left edge and inset top and
          bottom so it reads as a closed-book sliver rather than a bar. */}
      {skin.spine && (
        <>
          <View pointerEvents="none" style={[s.spineOuter, { backgroundColor: off ? '#D6D3D1' : '#9C7C4F' }]} />
          <View pointerEvents="none" style={[s.spineInner, { backgroundColor: off ? '#E7E5E4' : C.gold }]} />
        </>
      )}

      <View style={[s.cardHead, skin.spine && s.cardHeadSpined]}>
        <View style={s.cardCopy}>
          <Text style={[s.cardTitle, off && s.cardTitleOff]} numberOfLines={2}>{task.title}</Text>
          <View style={s.cardMetaRow}>
            <Text style={[s.cardTime, { color: off ? OFF_INK : skin.accent }]}>
              {task.schedule.time || '--:--'}
            </Text>
            <View style={[s.metaDot, { backgroundColor: off ? OFF_FAINT : skin.accent }]} />
            <Text style={[s.cardMeta, off && s.cardMetaOff]} numberOfLines={1}>
              {sourceLabel(task)}{task.subtitle ? ` · ${task.subtitle}` : ''}
            </Text>
          </View>
        </View>
        {/* The card's own type mark, the one it wears on Home. */}
        <TaskTypeBadge
          variant={variant}
          type={task.type}
          habitColor={task.habitColor}
          habitIconName={task.icon}
        />
      </View>

      <View style={s.cardStatus}>
        <SummaryIcon s={13} c={summaryInk} w={2.1} />
        <Text style={[s.cardStatusText, { color: summaryInk }]} numberOfLines={1}>
          {formatModeLabel(mode, reminderMinutes)}
        </Text>
      </View>

      {/* The real control, not this sheet's copy of it. `label=""` drops its
          heading, because the card above already names the task. */}
      <NotificationSettings
        label=""
        mode={mode}
        accent={skin.accent}
        reminderMinutes={reminderMinutes}
        onModeChange={handleMode}
        onReminderChange={handleReminder}
        style={s.cardControl}
      />
    </LinearGradient>
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
          dayTasks.map(task => (
            <NotificationTaskCard
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

  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: 12 },

  /* The task's own card, enlarged. Ground, edge, radius and ornaments all
     come from `taskCardSkin` so this and Home cannot drift. */
  card: {
    borderWidth: 1,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 15,
    overflow: 'hidden',
    shadowColor: '#8C7A4F',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 2,
  },
  cardLit: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  spineOuter: {
    position: 'absolute',
    left: 0,
    top: 14,
    bottom: 14,
    width: 5,
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
  },
  spineInner: {
    position: 'absolute',
    left: 7,
    top: 18,
    bottom: 18,
    width: 2,
    borderRadius: 2,
    opacity: 0.92,
  },

  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  // Reading's spine takes the left edge, so its head steps clear of it.
  cardHeadSpined: { paddingLeft: 8 },
  cardCopy: { flex: 1, minWidth: 0 },
  /**
   * ⚠ 19, where the Home card sets its title at about 15. Here the card IS
   * the row rather than one line in a list, and it has a three-button
   * control sitting under it — a 16pt head cannot hold that up.
   */
  cardTitle: { fontFamily: F.serifMedium, fontSize: 19, lineHeight: 24, color: C.text },
  cardTitleOff: { color: OFF_INK },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 },
  cardTime: {
    fontFamily: F.sansBold,
    fontSize: 12,
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
  },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, opacity: 0.5 },
  cardMeta: { flex: 1, minWidth: 0, fontFamily: F.sans, fontSize: 11.5, color: C.textMuted },
  cardMetaOff: { color: OFF_FAINT },

  // The reading, on its own line under the head — it is what the control
  // below is about, so it belongs between them rather than in a corner.
  cardStatus: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 11 },
  cardStatusText: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  cardControl: { marginTop: 9 },

  emptyWrap: { alignItems: 'center', paddingVertical: 54, gap: 12 },
  emptyText: { fontFamily: F.serifItalic, fontSize: 14, color: C.textMuted },
});
