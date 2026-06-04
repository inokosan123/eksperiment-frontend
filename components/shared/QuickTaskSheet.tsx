import React, { useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, CheckSmall, ChevronDown, Plus, Sparkles, X } from '@/components/icons/Icons';
import { F } from '@/constants/tokens';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import TaskTimeEditor from '@/components/shared/TaskTimeEditor';
import NotificationSettings, { type NotificationMode } from '@/components/shared/NotificationSettings';
import { getLocalDateKey } from '@/components/tasks/taskScheduler';
import type { TaskDraft } from '@/components/tasks/taskTypes';
import { HapticTouchableOpacity as TouchableOpacity, HapticPressable as Pressable } from '@/components/shared/HapticTouch';
import {
  useGuidedSetup,
  useGuideTarget,
} from '@/components/onboarding/guided/GuidedSetupContext';
import { GuidedOverlayHost } from '@/components/onboarding/guided/GuidedOverlayHost';


// eslint-disable-next-line @typescript-eslint/no-require-imports
const DateTimePickerModule = Platform.OS === 'web' ? null : require('@react-native-community/datetimepicker');
const NativeDateTimePicker = DateTimePickerModule?.default ?? null;
const NativeDateTimePickerAndroid = DateTimePickerModule?.DateTimePickerAndroid ?? null;

type Props = {
  visible: boolean;
  guided?: boolean;
  defaultDate?: string;
  // Pre-fill the task title — used when this sheet is opened from a list
  // item the user already wrote (e.g. an Ideal Self action). Resets each
  // time the sheet becomes visible so the same sheet can host different
  // titles in the same session.
  defaultTitle?: string;
  onClose: () => void;
  onTaskDraft: (draft: TaskDraft) => void | Promise<unknown>;
};

export const QUICK_TASK_GUIDE_TARGETS = {
  title: 'quick-task.title',
  save: 'quick-task.save',
} as const;

const ACCENT = '#1C1917';
const SOFT_BG = '#FAFAF9';
const BORDER = '#E7E5E4';

function normalizeDate(dateKey: string | undefined) {
  const today = getLocalDateKey();
  if (!dateKey || dateKey < today) return today;
  return dateKey;
}

function dateFromKey(dateKey: string) {
  const [year, month, day] = normalizeDate(dateKey).split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function minimumQuickDate() {
  const [year, month, day] = getLocalDateKey().split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function defaultQuickTime(dateKey: string) {
  const today = getLocalDateKey();
  if (dateKey !== today) return '08:00';

  const now = new Date();
  const totalMinutes = now.getHours() * 60 + now.getMinutes();
  const rounded = Math.min(23 * 60 + 55, Math.ceil(totalMinutes / 5) * 5);
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function formatDateLabel(dateKey: string) {
  return dateFromKey(dateKey).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateSub(dateKey: string) {
  return dateFromKey(dateKey).toLocaleDateString('en-US', {
    weekday: 'short',
  });
}

export default function QuickTaskSheet({
  visible,
  guided = false,
  defaultDate,
  defaultTitle,
  onClose,
  onTaskDraft,
}: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const seedDate = normalizeDate(defaultDate);
  const [title, setTitle] = useState(defaultTitle ?? '');
  const [date, setDate] = useState(seedDate);
  const [time, setTime] = useState(defaultQuickTime(seedDate));
  const [notificationMode, setNotificationMode] = useState<NotificationMode>('none');
  const [reminderMinutes, setReminderMinutes] = useState(15);
  const [saving, setSaving] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);
  const { session, patchSession } = useGuidedSetup();
  const isGuided = guided && session?.active === true && session.activeStep === 'buildMyRoutine';
  const guidePhase = isGuided ? session.phase : '';
  const titleTarget = useGuideTarget(QUICK_TASK_GUIDE_TARGETS.title, isGuided);
  const saveTarget = useGuideTarget(QUICK_TASK_GUIDE_TARGETS.save, isGuided);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      e => setKbHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKbHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const nextDate = normalizeDate(defaultDate);
    setTitle(defaultTitle ?? '');
    setDate(nextDate);
    setTime(defaultQuickTime(nextDate));
    setNotificationMode('none');
    setReminderMinutes(15);
    setSaving(false);
  }, [defaultDate, defaultTitle, visible]);

  useEffect(() => {
    if (!isGuided || !visible) return;
    const timer = setTimeout(() => {
      titleTarget.measure();
      saveTarget.measure();
    }, 360);
    return () => clearTimeout(timer);
  }, [guidePhase, isGuided, saveTarget, titleTarget, visible]);

  const selectedDateLabel = useMemo(() => formatDateLabel(date), [date]);
  const selectedDateSub = useMemo(() => formatDateSub(date), [date]);

  const canSave = title.trim().length > 0 && !saving;

  const changeDate = (nextDate: string) => {
    const normalized = normalizeDate(nextDate);
    setDate(normalized);
    setTime(defaultQuickTime(normalized));
  };

  const save = async () => {
    if (!canSave) return;
    Keyboard.dismiss();
    setSaving(true);
    const trimmedTitle = title.trim();
    const taskId = `quick_${Date.now()}`;
    const draft: TaskDraft = {
      id: taskId,
      title: trimmedTitle,
      subtitle: undefined,
      level: 4,
      source: 'quick',
      type: 'custom',
      icon: 'Sparkles',
      status: 'active',
      schedule: {
        frequency: 'daily',
        selectedDays: [],
        monthlyDays: [1],
        time,
        sameTimeEveryDay: true,
        dayTimes: {},
      },
      notificationMode,
      reminderMinutes: notificationMode === 'double' ? reminderMinutes : undefined,
      quickConfig: {
        date,
        note: undefined,
      },
    };

    try {
      await onTaskDraft(draft);
      onClose();
    } catch (error) {
      console.warn('Quick task save failed:', error);
      setSaving(false);
    }
  };

  const baseSheetHeight = Math.min(height * 0.92, 720);
  const sheetHeight = kbHeight > 0
    ? Math.max(360, Math.min(baseSheetHeight, height - kbHeight - insets.top - 24))
    : baseSheetHeight;

  return (
    <SmoothBottomSheet
      visible={visible}
      onClose={onClose}
      keyboardAware
      sheetStyle={[
        s.sheet,
        {
          // Use a definite height (not maxHeight) so the inner ScrollView's
          // flex:1 has a real parent dimension to fill. iOS Yoga collapses
          // flex:1 children inside a content-sized + maxHeight-capped parent;
          // web RNW handles it but iOS native does not — symptom is a sheet
          // that only renders the header, with the body invisibly clipped.
          height: sheetHeight,
          paddingBottom: Math.max(insets.bottom, 10) + 12,
        },
      ]}
      backdropOpacity={0.34}
      overlayChildren={isGuided ? <GuidedOverlayHost /> : undefined}
    >
      <View style={s.handle} />
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} activeOpacity={0.82} style={s.closeBtn}>
          <X s={19} c="#A8A29E" />
        </TouchableOpacity>
        <View style={s.headerCopy}>
          <Text style={s.eyebrow}>Quick Task</Text>
          <Text style={s.title}>Add a Task</Text>
        </View>
        <TouchableOpacity
          {...saveTarget}
          onPress={save}
          disabled={!canSave}
          activeOpacity={0.86}
          style={[s.doneBtn, !canSave && s.doneBtnDisabled]}
        >
          <CheckSmall s={19} c="#FFFFFF" w={3} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient
          colors={['#FFFFFF', '#F8F7F4']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <View style={s.heroIcon}>
            <Sparkles s={19} c="#1C1917" />
          </View>
          <View style={s.heroCopy}>
            <Text style={s.heroTitle}>One-time task</Text>
            <Text style={s.heroBody}>Saved only for the date you choose.</Text>
          </View>
        </LinearGradient>

        <View style={s.card}>
          <View style={s.labelRow}>
            <Text style={s.label}>Date</Text>
            <Calendar s={14} c="#1C1917" />
          </View>
          <DatePickerButton
            date={date}
            label={selectedDateLabel}
            sublabel={selectedDateSub}
            onDateChange={changeDate}
          />
        </View>

        <View style={s.card}>
          <Text style={s.label}>Name Activity</Text>
          <TextInput
            {...titleTarget}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter task name..."
            placeholderTextColor="#C9C5BD"
            style={s.titleInput}
            returnKeyType="done"
            onSubmitEditing={() => {
              if (isGuided && title.trim()) patchSession({ phase: 'quickSave' });
            }}
          />
        </View>

        <View style={s.card}>
          <TaskTimeEditor
            time={time}
            sameTimeEveryDay
            dayTimes={{}}
            onTimeChange={setTime}
            onSameTimeEveryDayChange={() => undefined}
            onDayTimesChange={() => undefined}
            allowPerDayTimes={false}
            accent={ACCENT}
            softBg={SOFT_BG}
            borderColor={BORDER}
            mutedColor="#8A8177"
          />
        </View>

        <View style={s.card}>
          <NotificationSettings
            mode={notificationMode}
            reminderMinutes={reminderMinutes}
            onModeChange={setNotificationMode}
            onReminderChange={setReminderMinutes}
            accent={ACCENT}
          />
        </View>

        <TouchableOpacity
          onPress={save}
          disabled={!canSave}
          activeOpacity={0.9}
          style={[s.saveBtn, !canSave && s.saveBtnDisabled]}
        >
          <Plus s={15} c="#FFFFFF" w={2.5} />
          <Text style={s.saveText}>{saving ? 'SAVING...' : 'CREATE QUICK TASK'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SmoothBottomSheet>
  );
}

function DatePickerButton({
  date,
  label,
  sublabel,
  onDateChange,
}: {
  date: string;
  label: string;
  sublabel: string;
  onDateChange: (date: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [draftDate, setDraftDate] = useState(date);

  useEffect(() => {
    if (visible) setDraftDate(date);
  }, [date, visible]);

  const openPicker = () => {
    const safeDate = normalizeDate(date);
    setDraftDate(safeDate);

    if (Platform.OS === 'android' && NativeDateTimePickerAndroid) {
      NativeDateTimePickerAndroid.open({
        value: dateFromKey(safeDate),
        minimumDate: minimumQuickDate(),
        mode: 'date',
        display: 'calendar',
        positiveButton: { label: 'Save', textColor: ACCENT },
        negativeButton: { label: 'Cancel', textColor: '#9CA3AF' },
        onChange: (event: { type?: string }, selectedDate?: Date) => {
          if (event?.type !== 'set' || !selectedDate) return;
          onDateChange(getLocalDateKey(selectedDate));
        },
      });
      return;
    }

    setVisible(true);
  };

  const applyDate = () => {
    onDateChange(draftDate);
    setVisible(false);
  };

  return (
    <>
      <TouchableOpacity onPress={openPicker} activeOpacity={0.88} style={s.dateButton}>
        <View style={s.dateButtonIcon}>
          <Calendar s={17} c={ACCENT} />
        </View>
        <View style={s.dateButtonCopy}>
          <Text style={s.dateMain}>{label}</Text>
          <Text style={s.dateSub}>{sublabel}</Text>
        </View>
        <ChevronDown s={16} c={ACCENT} />
      </TouchableOpacity>

      <Modal transparent visible={visible} animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={s.dateModalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setVisible(false)} />
          <View style={s.dateModalSheet}>
            <View style={s.handle} />
            <View style={s.dateModalHead}>
              <Text style={s.dateModalTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => setVisible(false)} activeOpacity={0.84} style={s.dateModalClose}>
                <X s={18} c="#A8A29E" />
              </TouchableOpacity>
            </View>

            {Platform.OS === 'ios' && NativeDateTimePicker ? (
              <View style={s.dateNativeWrap}>
                <NativeDateTimePicker
                  value={dateFromKey(draftDate)}
                  minimumDate={minimumQuickDate()}
                  mode="date"
                  display="inline"
                  themeVariant="light"
                  accentColor={ACCENT}
                  onChange={(_event: unknown, selectedDate?: Date) => {
                    if (!selectedDate) return;
                    setDraftDate(normalizeDate(getLocalDateKey(selectedDate)));
                  }}
                  style={s.dateNativePicker}
                />
              </View>
            ) : (
              <View style={s.dateFallback}>
                <Text style={s.dateMain}>{formatDateLabel(draftDate)}</Text>
                <Text style={s.dateSub}>{formatDateSub(draftDate)}</Text>
              </View>
            )}

            <TouchableOpacity onPress={applyDate} activeOpacity={0.88} style={s.dateModalSave}>
              <Text style={s.dateModalSaveText}>SAVE DATE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: '#FFFEFB',
    overflow: 'hidden',
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#D6D3D1',
    alignSelf: 'center',
    marginTop: 10,
  },
  header: {
    minHeight: 70,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDE8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F7F5F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    alignItems: 'center',
    flex: 1,
  },
  eyebrow: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 2,
    color: '#A8A29E',
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 2,
    fontFamily: F.serifMedium,
    fontSize: 22,
    color: '#1C1917',
  },
  doneBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1C1917',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
  doneBtnDisabled: {
    backgroundColor: '#D6D3D1',
    shadowOpacity: 0,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 18,
    gap: 14,
  },
  hero: {
    minHeight: 76,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E5E4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    flex: 1,
  },
  heroTitle: {
    fontFamily: F.serifMedium,
    fontSize: 20,
    lineHeight: 24,
    color: '#1C1917',
  },
  heroBody: {
    marginTop: 3,
    fontFamily: F.sans,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#8A8177',
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2,
    color: '#1C1917',
    textTransform: 'uppercase',
  },
  titleInput: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F2F1EC',
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 16,
    fontFamily: F.serif,
    fontSize: 22,
    color: '#111827',
  },
  dateButton: {
    minHeight: 62,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    backgroundColor: '#FAFAF9',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateButtonIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E5E4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateButtonCopy: {
    flex: 1,
    minWidth: 0,
  },
  dateModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(16,24,40,0.28)',
  },
  dateModalSheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: '#FFFEFB',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 16,
  },
  dateModalHead: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateModalTitle: {
    fontFamily: F.serifMedium,
    fontSize: 22,
    color: '#1F2937',
  },
  dateModalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F2EC',
  },
  dateNativeWrap: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    backgroundColor: '#FAFAF9',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  dateNativePicker: {
    width: '100%',
  },
  dateFallback: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    backgroundColor: '#FAFAF9',
    paddingHorizontal: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  dateModalSave: {
    minHeight: 56,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    shadowColor: ACCENT,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  dateModalSaveText: {
    fontFamily: F.sansBold,
    fontSize: 12,
    letterSpacing: 2,
    color: '#fff',
  },
  dateMain: {
    fontFamily: F.serifMedium,
    fontSize: 21,
    lineHeight: 25,
    color: '#1C1917',
  },
  dateSub: {
    marginTop: 2,
    fontFamily: F.sans,
    fontSize: 12,
    lineHeight: 16,
    color: '#8A8177',
  },
  saveBtn: {
    minHeight: 56,
    borderRadius: 22,
    backgroundColor: '#1C1917',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 4,
  },
  saveBtnDisabled: {
    backgroundColor: '#D6D3D1',
    shadowOpacity: 0,
  },
  saveText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 2,
    color: '#FFFFFF',
  },
});
