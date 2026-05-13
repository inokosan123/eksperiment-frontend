import {
  useEffect,
  useMemo,
  useState } from 'react';
import { ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { Bell, BellOff, BellRing, X } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { useTasks } from './TaskProvider';
import type { NotificationMode } from '@/components/shared/NotificationSettings';
import type { TaskDefinition, TaskDraft } from './taskTypes';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';


type Props = {
  visible: boolean;
  onClose: () => void;
  selectedDate: string;
};

const MODES: { mode: NotificationMode; label: string; Icon: typeof Bell }[] = [
  { mode: 'none', label: 'OFF', Icon: BellOff },
  { mode: 'single', label: 'SINGLE', Icon: Bell },
  { mode: 'double', label: 'DOUBLE', Icon: BellRing },
];

const REMINDER_OPTIONS = [5, 10, 15, 30, 60];
const DEFAULT_REMINDER_MINUTES = 15;

function buildDraftFromDefinition(
  task: TaskDefinition,
  mode: NotificationMode,
  reminderMinutes?: number,
): TaskDraft {
  let nextReminder: number | undefined;
  if (mode === 'double') {
    nextReminder = reminderMinutes ?? task.reminderMinutes ?? DEFAULT_REMINDER_MINUTES;
  }
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

export default function NotificationsSheet({ visible, onClose, selectedDate }: Props) {
  const insets = useSafeAreaInsets();
  const { tasks, instances, createOrUpdateTask } = useTasks();
  const [optimisticMode, setOptimisticMode] = useState<Record<string, NotificationMode>>({});
  const [optimisticReminder, setOptimisticReminder] = useState<Record<string, number>>({});

  // Reset optimistic state when sheet closes so re-open reflects current DB.
  useEffect(() => {
    if (!visible) {
      setOptimisticMode({});
      setOptimisticReminder({});
    }
  }, [visible]);

  // Tasks scheduled for the selected date (any active instance, including pending/skipped/missed/completed)
  const dayTasks = useMemo(() => {
    const taskIds = new Set(
      instances
        .filter(inst => inst.status !== 'not_applicable')
        .map(inst => inst.taskId),
    );
    return tasks.filter(t => taskIds.has(t.id) && t.status === 'active');
  }, [tasks, instances]);

  const resolveMode = (task: TaskDefinition): NotificationMode =>
    optimisticMode[task.id] ?? task.notificationMode;
  const resolveReminder = (task: TaskDefinition): number =>
    optimisticReminder[task.id] ?? task.reminderMinutes ?? DEFAULT_REMINDER_MINUTES;

  const activeCount = dayTasks.filter(t => resolveMode(t) !== 'none').length;

  const dateLabel = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d, 12).toLocaleDateString('en-US', {
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
    setOptimisticReminder(prev => ({ ...prev, [task.id]: minutes }));
    const draft = buildDraftFromDefinition(task, 'double', minutes);
    void createOrUpdateTask(draft).catch(() => {
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
      sheetStyle={[s.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}
    >
      <View style={s.handleWrap}>
        <View style={s.handle} />
      </View>

      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <View style={s.eyebrow}>
            <BellRing s={15} c={C.gold} w={2.2} />
            <Text style={s.eyebrowText}>Notifications</Text>
          </View>
          <Text style={s.title}>Today&apos;s reminders</Text>
          <Text style={s.subtitle}>
            {dateLabel} · {activeCount}/{dayTasks.length} on
          </Text>
        </View>
        <TouchableOpacity activeOpacity={0.7} onPress={onClose} style={s.closeBtn}>
          <X s={18} c={C.textMuted} w={2.4} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        {dayTasks.length === 0 ? (
          <View style={s.emptyWrap}>
            <View style={s.emptyIcon}>
              <BellOff s={22} c="#D6D3D1" w={2} />
            </View>
            <Text style={s.emptyText}>No active tasks for this day</Text>
          </View>
        ) : (
          dayTasks.map(task => {
            const currentMode = resolveMode(task);
            const currentReminder = resolveReminder(task);
            return (
              <View key={task.id} style={s.row}>
                <View style={s.rowHead}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.rowTitle} numberOfLines={1}>{task.title}</Text>
                    <Text style={s.rowMeta} numberOfLines={1}>
                      {task.schedule.time || 'Any time'} · {task.subtitle || task.source}
                    </Text>
                  </View>
                  <View style={[s.statusPill, currentMode === 'none' ? s.statusPillOff : s.statusPillOn]}>
                    <Text style={[s.statusPillText, currentMode === 'none' ? s.statusPillTextOff : s.statusPillTextOn]}>
                      {currentMode === 'none' ? 'OFF' : currentMode.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={s.modeRow}>
                  {MODES.map(({ mode, label, Icon }) => {
                    const active = currentMode === mode;
                    return (
                      <TouchableOpacity
                        key={mode}
                        activeOpacity={0.82}
                        onPress={() => handleModeChange(task, mode)}
                        style={[s.modeBtn, active && s.modeBtnActive]}
                      >
                        <Icon s={16} c={active ? '#FFFFFF' : '#A8A29E'} w={2} />
                        <Text style={[s.modeBtnText, active && s.modeBtnTextActive]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {currentMode === 'double' && (
                  <View style={s.reminderWrap}>
                    <Text style={s.reminderLabel}>Remind before</Text>
                    <View style={s.reminderRow}>
                      {REMINDER_OPTIONS.map(minutes => {
                        const active = currentReminder === minutes;
                        return (
                          <TouchableOpacity
                            key={minutes}
                            activeOpacity={0.82}
                            onPress={() => handleReminderChange(task, minutes)}
                            style={[s.reminderPill, active && s.reminderPillActive]}
                          >
                            <Text style={[s.reminderPillText, active && s.reminderPillTextActive]}>
                              {minutes}m
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SmoothBottomSheet>
  );
}

const s = StyleSheet.create({
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '86%',
    overflow: 'hidden',
  },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E5E2' },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 22,
    paddingTop: 4,
    paddingBottom: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F1ED',
  },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  eyebrowText: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 1.7,
    color: C.gold,
    textTransform: 'uppercase',
  },
  title: { fontFamily: F.serifMedium, fontSize: 22, color: C.text, letterSpacing: -0.3 },
  subtitle: { fontFamily: F.sans, fontSize: 12, color: C.textMuted, marginTop: 4 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F4F4F2',
  },

  scrollContent: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24, gap: 12 },

  emptyWrap: { alignItems: 'center', paddingVertical: 56 },
  emptyIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#F4F4F2',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  emptyText: { fontFamily: F.serifItalic, fontSize: 14, color: C.textMuted },

  row: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 22,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.025,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 0,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  rowTitle: { fontFamily: F.serifMedium, fontSize: 15, color: C.text },
  rowMeta: {
    fontFamily: F.sans, fontSize: 11, color: C.textMuted, marginTop: 2,
  },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusPillOff: { backgroundColor: '#F4F4F2' },
  statusPillOn: { backgroundColor: 'rgba(197,160,89,0.12)' },
  statusPillText: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.3 },
  statusPillTextOff: { color: C.textMuted },
  statusPillTextOn: { color: '#9A7837' },

  modeRow: { flexDirection: 'row', gap: 8 },
  modeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8F7F2',
    borderWidth: 1,
    borderColor: '#EFEDE5',
  },
  modeBtnActive: {
    backgroundColor: C.gold,
    borderColor: C.gold,
    shadowColor: C.gold,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  modeBtnText: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 1.3,
    color: '#A8A29E',
  },
  modeBtnTextActive: { color: '#FFFFFF' },

  reminderWrap: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F2F1ED',
  },
  reminderLabel: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 1.6,
    color: C.textMuted,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  reminderRow: {
    flexDirection: 'row',
    gap: 6,
  },
  reminderPill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F4F4F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderPillActive: {
    backgroundColor: C.gold,
    shadowColor: C.gold,
    shadowOpacity: 0.22,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  reminderPillText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 0.4,
    color: C.textSecondary,
  },
  reminderPillTextActive: { color: '#FFFFFF' },
});
