import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ChevronDown, Clock, X } from '@/components/icons/Icons';
import { F } from '@/constants/tokens';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const DateTimePickerModule = Platform.OS === 'web' ? null : require('@react-native-community/datetimepicker');
const NativeDateTimePicker = DateTimePickerModule?.default ?? null;
const NativeDateTimePickerAndroid = DateTimePickerModule?.DateTimePickerAndroid ?? null;

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export type TaskDayTimes = Record<number, string>;

type Props = {
  time: string;
  sameTimeEveryDay: boolean;
  dayTimes: TaskDayTimes;
  onTimeChange: (time: string) => void;
  onSameTimeEveryDayChange: (sameTimeEveryDay: boolean) => void;
  onDayTimesChange: (dayTimes: TaskDayTimes) => void;
  activeDayIndexes?: number[];
  accent?: string;
  softBg?: string;
  borderColor?: string;
  mutedColor?: string;
  label?: string;
  allowPerDayTimes?: boolean;
};

function parseTimeParts(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  const hour = match ? Math.min(23, Math.max(0, Number(match[1]))) : 8;
  const minute = match ? Math.min(59, Math.max(0, Number(match[2]))) : 0;

  return {
    hour: String(hour).padStart(2, '0'),
    minute: String(minute).padStart(2, '0'),
  };
}

function formatTimeValue(hour: string, minute: string) {
  return `${hour}:${minute}`;
}

function formatTimeFromDate(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function useToggleMotion(active: boolean) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: active ? 1 : 0,
      friction: 15,
      tension: 145,
      useNativeDriver: false,
    }).start();
  }, [active, progress]);

  return progress;
}

export default function TaskTimeEditor({
  time,
  sameTimeEveryDay,
  dayTimes,
  onTimeChange,
  onSameTimeEveryDayChange,
  onDayTimesChange,
  activeDayIndexes = [0, 1, 2, 3, 4, 5, 6],
  accent = '#C5A059',
  softBg = '#FFFBEB',
  borderColor = '#E9DEC9',
  mutedColor = '#9CA3AF',
  label = 'Time',
  allowPerDayTimes = true,
}: Props) {
  return (
    <View style={s.stack}>
      <View style={s.labelRow}>
        <Text style={[s.label, { color: accent }]}>{label}</Text>
        <Clock s={14} c={mutedColor} />
      </View>

      {sameTimeEveryDay && (
        <TimePickerButton
          value={time}
          onChangeText={onTimeChange}
          accent={accent}
          softBg={softBg}
          borderColor={borderColor}
        />
      )}

      {allowPerDayTimes && (
        <ToggleRow
          label="Different time per day"
          active={!sameTimeEveryDay}
          accent={accent}
          mutedColor={mutedColor}
          onPress={() => onSameTimeEveryDayChange(!sameTimeEveryDay)}
        />
      )}

      {allowPerDayTimes && !sameTimeEveryDay && (
        <View style={s.dayTimeStack}>
          {activeDayIndexes.map(index => (
            <View key={WEEKDAY_LABELS[index]} style={[s.dayTimeRow, { borderColor, backgroundColor: softBg }]}>
              <Text style={s.dayTimeLabel}>{WEEKDAY_LABELS[index]}</Text>
              <TimePickerButton
                value={dayTimes[index] || time}
                onChangeText={nextTime => onDayTimesChange({ ...dayTimes, [index]: nextTime })}
                accent={accent}
                softBg="#FFFFFF"
                borderColor={borderColor}
                compact
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function ToggleRow({
  label,
  active,
  accent,
  mutedColor,
  onPress,
}: {
  label: string;
  active: boolean;
  accent: string;
  mutedColor: string;
  onPress: () => void;
}) {
  const progress = useToggleMotion(active);
  const trackColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E5E7EB', accent],
  });
  const thumbTranslateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 16],
  });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.84} style={s.toggleRow}>
      <Text style={[s.toggleText, { color: mutedColor }]}>{label}</Text>
      <Animated.View style={[s.toggleTrack, { backgroundColor: trackColor }]}>
        <Animated.View style={[s.toggleThumb, { transform: [{ translateX: thumbTranslateX }] }]} />
      </Animated.View>
    </TouchableOpacity>
  );
}

function TimePickerButton({
  value,
  onChangeText,
  accent,
  softBg,
  borderColor,
  compact = false,
}: {
  value: string;
  onChangeText: (text: string) => void;
  accent: string;
  softBg: string;
  borderColor: string;
  compact?: boolean;
}) {
  const normalized = parseTimeParts(value);
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState(formatTimeValue(normalized.hour, normalized.minute));
  const nativeDate = useMemo(() => {
    const parsed = parseTimeParts(draft);
    const next = new Date();
    next.setHours(Number(parsed.hour), Number(parsed.minute), 0, 0);
    return next;
  }, [draft]);

  const openPicker = () => {
    const parsed = parseTimeParts(value);
    const nextValue = formatTimeValue(parsed.hour, parsed.minute);
    setDraft(nextValue);

    if (Platform.OS === 'android' && NativeDateTimePickerAndroid) {
      const seed = new Date();
      seed.setHours(Number(parsed.hour), Number(parsed.minute), 0, 0);
      NativeDateTimePickerAndroid.open({
        value: seed,
        mode: 'time',
        is24Hour: true,
        display: 'spinner',
        minuteInterval: 5,
        positiveButton: { label: 'Save', textColor: accent },
        negativeButton: { label: 'Cancel', textColor: '#9CA3AF' },
        onChange: (event: { type?: string }, selectedDate?: Date) => {
          if (event?.type !== 'set' || !selectedDate) return;
          onChangeText(formatTimeFromDate(selectedDate));
        },
      });
      return;
    }

    setVisible(true);
  };

  const applyValue = () => {
    const parsed = parseTimeParts(draft);
    onChangeText(formatTimeValue(parsed.hour, parsed.minute));
    setVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        onPress={openPicker}
        activeOpacity={0.86}
        style={[
          s.timeButton,
          compact && s.timeButtonCompact,
          { backgroundColor: softBg, borderColor },
        ]}
      >
        <Text style={[s.timeValue, compact && s.timeValueCompact, { color: compact ? '#2F3440' : '#1F2937' }]}>
          {formatTimeValue(normalized.hour, normalized.minute)}
        </Text>
        <ChevronDown s={compact ? 14 : 16} c={accent} />
      </TouchableOpacity>

      <Modal transparent visible={visible} animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={s.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setVisible(false)} />
          <View style={s.modalSheet}>
            <View style={s.handle} />
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Select Time</Text>
              <TouchableOpacity onPress={() => setVisible(false)} activeOpacity={0.84} style={s.modalClose}>
                <X s={18} c="#A8A29E" />
              </TouchableOpacity>
            </View>

            {Platform.OS === 'ios' && NativeDateTimePicker ? (
              <View style={[s.nativeWrap, { borderColor, backgroundColor: softBg }]}>
                <NativeDateTimePicker
                  value={nativeDate}
                  mode="time"
                  display="spinner"
                  minuteInterval={5}
                  is24Hour
                  themeVariant="light"
                  textColor="#2F3440"
                  onChange={(_event: unknown, selectedDate?: Date) => {
                    if (!selectedDate) return;
                    setDraft(formatTimeFromDate(selectedDate));
                  }}
                  style={s.nativePicker}
                />
              </View>
            ) : (
              <View style={[s.fallbackWrap, { borderColor, backgroundColor: softBg }]}>
                <Text style={[s.fallbackLabel, { color: accent }]}>Time</Text>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  keyboardType="numbers-and-punctuation"
                  placeholder="08:00"
                  placeholderTextColor="#D1D5DB"
                  style={[s.fallbackInput, { color: accent }]}
                />
              </View>
            )}

            <TouchableOpacity onPress={applyValue} activeOpacity={0.88} style={[s.modalSave, { backgroundColor: accent, shadowColor: accent }]}>
              <Text style={s.modalSaveText}>SAVE TIME</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  stack: { gap: 12 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
  timeButton: {
    minHeight: 56,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  timeButtonCompact: {
    minHeight: 44,
    minWidth: 108,
    borderRadius: 16,
    paddingHorizontal: 14,
    marginLeft: 'auto',
  },
  timeValue: { fontFamily: F.serifMedium, fontSize: 24, letterSpacing: 0.2 },
  timeValueCompact: { fontSize: 18 },
  toggleRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleText: { flex: 1, fontFamily: F.sans, fontSize: 12 },
  toggleTrack: {
    width: 38,
    height: 22,
    borderRadius: 11,
    padding: 2,
  },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
  },
  dayTimeStack: { gap: 8, overflow: 'hidden' },
  dayTimeRow: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dayTimeLabel: {
    flex: 1,
    fontFamily: F.sansBold,
    fontSize: 14,
    letterSpacing: 0.15,
    color: '#5B616C',
  },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,24,40,0.28)' },
  modalSheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: '#FFFEFB', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 24, gap: 16 },
  handle: { width: 42, height: 4, borderRadius: 999, backgroundColor: '#D6D3D1', alignSelf: 'center' },
  modalHead: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontFamily: F.serifMedium, fontSize: 22, color: '#1F2937' },
  modalClose: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F2EC' },
  nativeWrap: { borderRadius: 26, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  nativePicker: { width: '100%', height: 210 },
  fallbackWrap: { borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center' },
  fallbackLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.7, textTransform: 'uppercase' },
  fallbackInput: { textAlign: 'center', fontFamily: F.serifMedium, fontSize: 34, lineHeight: 42, paddingVertical: 4, minWidth: 120 },
  modalSave: { minHeight: 56, borderRadius: 22, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  modalSaveText: { fontFamily: F.sansBold, fontSize: 12, letterSpacing: 2, color: '#fff' },
});
