import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Reanimated, {
  FadeIn,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { ChevronDown, Clock, X } from '@/components/icons/Icons';
import { F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity, HapticPressable as Pressable } from '@/components/shared/HapticTouch';


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

function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return `rgba(197,160,89,${alpha})`;
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function useToggleMotion(active: boolean) {
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(active ? 1 : 0, {
      damping: 18,
      stiffness: 235,
      mass: 0.72,
    });
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
        <Clock s={14} c={accent} />
      </View>

      {sameTimeEveryDay && (
        <TimePickerButton
          value={time}
          onChangeText={onTimeChange}
          accent={accent}
          softBg={softBg}
          borderColor={borderColor}
          sublabel={allowPerDayTimes ? 'Same time every day' : 'Scheduled time'}
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
        <Reanimated.View
          entering={FadeIn.duration(220)}
          style={[s.dayTimeCard, { borderColor, backgroundColor: softBg }]}
        >
          {activeDayIndexes.map((index, position) => (
            <View key={WEEKDAY_LABELS[index]}>
              {position > 0 && <View style={[s.dayDivider, { backgroundColor: borderColor }]} />}
              <TimePickerButton
                value={dayTimes[index] || time}
                onChangeText={nextTime => onDayTimesChange({ ...dayTimes, [index]: nextTime })}
                accent={accent}
                softBg={softBg}
                borderColor={borderColor}
                dayLabel={WEEKDAY_LABELS[index]}
              />
            </View>
          ))}
        </Reanimated.View>
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
  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['#E7E2D6', accent]),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 16 }],
  }));

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.84} style={s.toggleRow}>
      <Text style={[s.toggleText, { color: mutedColor }]}>{label}</Text>
      <Reanimated.View style={[s.toggleTrack, trackStyle]}>
        <Reanimated.View style={[s.toggleThumb, thumbStyle]} />
      </Reanimated.View>
    </TouchableOpacity>
  );
}

function TimePickerButton({
  value,
  onChangeText,
  accent,
  softBg,
  borderColor,
  sublabel,
  dayLabel,
}: {
  value: string;
  onChangeText: (text: string) => void;
  accent: string;
  softBg: string;
  borderColor: string;
  sublabel?: string;
  dayLabel?: string;
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
      {dayLabel ? (
        // One row of the per-day schedule: the whole row is the button.
        <TouchableOpacity onPress={openPicker} activeOpacity={0.84} style={s.dayRow}>
          <View style={[s.dayChip, { backgroundColor: withAlpha(accent, 0.1) }]}>
            <Text style={[s.dayChipText, { color: accent }]}>{dayLabel}</Text>
          </View>
          <Text style={s.dayTimeValue}>
            {formatTimeValue(normalized.hour, normalized.minute)}
          </Text>
          <ChevronDown s={15} c={accent} />
        </TouchableOpacity>
      ) : (
        // The hero row — same grammar as the sheet's date button: icon seat,
        // serif value with a quiet sub-line, chevron affordance.
        <TouchableOpacity
          onPress={openPicker}
          activeOpacity={0.88}
          style={[s.timeButton, { backgroundColor: softBg, borderColor }]}
        >
          <View style={[s.timeIconSeat, { borderColor }]}>
            <Clock s={17} c={accent} />
          </View>
          <View style={s.timeCopy}>
            <Text style={s.timeValue}>
              {formatTimeValue(normalized.hour, normalized.minute)}
            </Text>
            {sublabel ? <Text style={s.timeSub}>{sublabel}</Text> : null}
          </View>
          <ChevronDown s={16} c={accent} />
        </TouchableOpacity>
      )}

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
    minHeight: 62,
    borderRadius: 19,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeIconSeat: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeCopy: {
    flex: 1,
    minWidth: 0,
  },
  timeValue: {
    fontFamily: F.serifMedium,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: 0.3,
    color: '#1C1917',
  },
  timeSub: {
    marginTop: 1,
    fontFamily: F.sans,
    fontSize: 12,
    lineHeight: 16,
    color: '#8A8177',
  },
  toggleRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleText: { flex: 1, fontFamily: F.sans, fontSize: 12.5 },
  toggleTrack: {
    width: 40,
    height: 24,
    borderRadius: 12,
    padding: 2,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.14,
    shadowRadius: 2,
    elevation: 1,
  },
  dayTimeCard: {
    borderRadius: 19,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dayDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 68,
    marginRight: 12,
    opacity: 0.8,
  },
  dayRow: {
    minHeight: 50,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dayChip: {
    minWidth: 44,
    height: 28,
    borderRadius: 9,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  dayTimeValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: F.serifMedium,
    fontSize: 18.5,
    letterSpacing: 0.3,
    color: '#1C1917',
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
