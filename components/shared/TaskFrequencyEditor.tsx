import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Reanimated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { CalendarCheck } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';


export type TaskFrequency = 'daily' | 'weekdays' | 'weekends' | 'specific_days' | 'monthly';

type Props = {
  frequency: TaskFrequency;
  selectedDays: number[];
  monthlyDays: number[];
  onFrequencyChange: (frequency: TaskFrequency) => void;
  onSelectedDaysChange: (days: number[]) => void;
  onMonthlyDaysChange: (days: number[]) => void;
  accent?: string;
  label?: string;
};

const FREQUENCY_OPTIONS: { value: TaskFrequency; label: string; desc: string }[] = [
  { value: 'daily', label: 'Daily', desc: 'Every day' },
  { value: 'weekdays', label: 'Weekdays', desc: 'Mon - Fri' },
  { value: 'weekends', label: 'Weekends', desc: 'Sat - Sun' },
  { value: 'monthly', label: 'Monthly', desc: 'Days of month' },
  { value: 'specific_days', label: 'Specific Days', desc: 'Choose days' },
];

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function currentWeekdayIndex() {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

function ensureSelectedDays(days: number[]) {
  return days.length ? days : [currentWeekdayIndex()];
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

function useSelectionMotion(active: boolean) {
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

export default function TaskFrequencyEditor({
  frequency,
  selectedDays,
  monthlyDays,
  onFrequencyChange,
  onSelectedDaysChange,
  onMonthlyDaysChange,
  accent = C.gold,
  label = 'Frequency',
}: Props) {
  const [gridWidth, setGridWidth] = useState(0);
  const weekdayGap = gridWidth > 0 && gridWidth < 284 ? 6 : 8;
  const monthlyGap = gridWidth > 0 && gridWidth < 284 ? 4 : 6;
  const weekdaySize = gridWidth
    ? Math.max(30, Math.min(40, Math.floor((gridWidth - weekdayGap * 6) / 7)))
    : 36;
  const monthlyCellSize = gridWidth
    ? Math.max(30, Math.min(42, Math.floor((gridWidth - monthlyGap * 6) / 7)))
    : 36;
  const effectiveSelectedDays = frequency === 'specific_days' ? ensureSelectedDays(selectedDays) : selectedDays;

  useEffect(() => {
    if (frequency === 'specific_days' && selectedDays.length === 0) {
      onSelectedDaysChange(ensureSelectedDays(selectedDays));
    }
  }, [frequency, selectedDays, onSelectedDaysChange]);

  return (
    <View style={s.wrap}>
      <View style={s.labelRow}>
        <Text style={[s.label, { color: accent }]}>{label}</Text>
        <CalendarCheck s={14} c={accent} />
      </View>

      <View style={s.frequencyWrap}>
        {FREQUENCY_OPTIONS.map(option => (
          <FrequencyChoice
            key={option.value}
            option={option}
            active={frequency === option.value}
            accent={accent}
            onPress={() => {
              onFrequencyChange(option.value);
              if (option.value === 'specific_days' && selectedDays.length === 0) {
                onSelectedDaysChange(ensureSelectedDays(selectedDays));
              }
              if (option.value === 'monthly' && monthlyDays.length === 0) {
                onMonthlyDaysChange([1]);
              }
            }}
          />
        ))}
      </View>

      {frequency === 'specific_days' && (
        <View
          style={s.gridMeasure}
          onLayout={event => setGridWidth(Math.floor(event.nativeEvent.layout.width))}
        >
          <Text style={[s.subLabel, { color: accent }]}>Choose Days</Text>
          <View style={[s.dayChipRow, { columnGap: weekdayGap }]}>
            {WEEKDAY_LABELS.map((day, index) => {
              const active = effectiveSelectedDays.includes(index);
              return (
                <WeekdayChoice
                  key={`${day}-${index}`}
                  label={day}
                  active={active}
                  accent={accent}
                  size={weekdaySize}
                  onPress={() => {
                    if (active && effectiveSelectedDays.length === 1) return;
                    onSelectedDaysChange(active
                      ? effectiveSelectedDays.filter(item => item !== index)
                      : [...effectiveSelectedDays, index].sort((a, b) => a - b));
                  }}
                />
              );
            })}
          </View>
        </View>
      )}

      {frequency === 'monthly' && (
        <View
          style={s.monthlyWrap}
          onLayout={event => setGridWidth(Math.floor(event.nativeEvent.layout.width))}
        >
          <Text style={[s.subLabel, { color: accent }]}>Days of Month</Text>
          <Text style={s.monthlyHint}>Choose one or more dates for the monthly repeat.</Text>
          <View style={[s.monthlyGrid, { gap: monthlyGap }]}>
            {Array.from({ length: 31 }, (_, index) => index + 1).map(day => {
              const active = monthlyDays.includes(day);
              return (
                <MonthlyDayChoice
                  key={day}
                  day={day}
                  active={active}
                  accent={accent}
                  size={monthlyCellSize}
                  onPress={() => {
                    const next = active
                      ? monthlyDays.filter(item => item !== day)
                      : [...monthlyDays, day].sort((a, b) => a - b);
                    onMonthlyDaysChange(next.length ? next : [day]);
                  }}
                />
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

function FrequencyChoice({
  option,
  active,
  accent,
  onPress,
}: {
  option: { value: TaskFrequency; label: string; desc: string };
  active: boolean;
  accent: string;
  onPress: () => void;
}) {
  const progress = useSelectionMotion(active);
  const activeBg = withAlpha(accent, 0.055);
  const activeRingBorder = withAlpha(accent, 0.34);
  const motionStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['#FFFFFF', activeBg]),
    borderColor: interpolateColor(progress.value, [0, 1], ['#F0EDE6', accent]),
    shadowOpacity: 0.015 + progress.value * 0.085,
    transform: [{ scale: 1 + progress.value * 0.006 }],
  }), [accent, activeBg]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={s.frequencyTouch}>
      <Reanimated.View
        style={[
          s.frequencyChip,
          motionStyle,
          {
            shadowColor: accent,
          },
        ]}
      >
        <View style={s.frequencyCopy}>
          <Text style={[s.frequencyText, active && { color: accent }]} numberOfLines={1}>{option.label}</Text>
          <Text style={[s.frequencySub, active && { color: accent }]} numberOfLines={1}>{option.desc}</Text>
        </View>
        <View style={[s.frequencyDotRing, active && { borderColor: activeRingBorder, backgroundColor: '#FFFDF8' }]}>
          {active && <View style={[s.frequencyDot, { backgroundColor: accent }]} />}
        </View>
      </Reanimated.View>
    </TouchableOpacity>
  );
}

function WeekdayChoice({
  label,
  active,
  accent,
  size,
  onPress,
}: {
  label: string;
  active: boolean;
  accent: string;
  size: number;
  onPress: () => void;
}) {
  const progress = useSelectionMotion(active);
  const activeBg = withAlpha(accent, 0.075);
  const chipStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.value, [0, 1], ['#E5E7EB', accent]),
    backgroundColor: interpolateColor(progress.value, [0, 1], ['#FFFFFF', activeBg]),
    transform: [{ scale: 1 + progress.value * 0.055 }],
  }), [accent, activeBg]);
  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], ['#9CA3AF', accent]),
  }), [accent]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.86}>
      <Reanimated.View
        style={[
          s.dayChip,
          {
            width: size,
            height: size,
            borderRadius: Math.round(size / 2),
          },
          chipStyle,
        ]}
      >
        <Reanimated.Text style={[s.dayChipText, textStyle]}>{label}</Reanimated.Text>
      </Reanimated.View>
    </TouchableOpacity>
  );
}

function MonthlyDayChoice({
  day,
  active,
  accent,
  size,
  onPress,
}: {
  day: number;
  active: boolean;
  accent: string;
  size: number;
  onPress: () => void;
}) {
  const progress = useSelectionMotion(active);
  const activeBg = withAlpha(accent, 0.075);
  const cellStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.value, [0, 1], ['rgba(232,216,186,0.46)', accent]),
    backgroundColor: interpolateColor(progress.value, [0, 1], ['rgba(255,255,255,0.86)', activeBg]),
    transform: [{ scale: 1 + progress.value * 0.035 }],
  }), [accent, activeBg]);
  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], ['#8A8177', accent]),
  }), [accent]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.86}>
      <Reanimated.View
        style={[
          s.monthlyCell,
          {
            width: size,
            minHeight: size,
          },
          cellStyle,
        ]}
      >
        <Reanimated.Text style={[s.monthlyText, textStyle]}>{day}</Reanimated.Text>
      </Reanimated.View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 13 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
  frequencyWrap: { gap: 8 },
  frequencyTouch: { width: '100%' },
  frequencyChip: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    paddingLeft: 15,
    paddingRight: 12,
    paddingVertical: 9,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 1,
  },
  frequencyDotRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#E8E2D7',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  frequencyDot: { width: 8, height: 8, borderRadius: 4 },
  frequencyCopy: { minWidth: 0, flex: 1 },
  frequencyText: { fontFamily: F.serifMedium, fontSize: 17, lineHeight: 21, color: '#364152' },
  frequencySub: { marginTop: 1, fontFamily: F.sans, fontSize: 11, lineHeight: 15, color: '#9CA3AF' },
  gridMeasure: { width: '100%', gap: 10 },
  subLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.7, textTransform: 'uppercase' },
  dayChipRow: { flexDirection: 'row', flexWrap: 'nowrap', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  dayChip: { flexShrink: 0, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  dayChipText: { fontFamily: F.sansBold, fontSize: 11, color: '#A8A29E' },
  monthlyWrap: { width: '100%', gap: 8 },
  monthlyHint: { fontFamily: F.sans, fontSize: 12, lineHeight: 18, color: '#8B909A' },
  monthlyGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  monthlyCell: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthlyText: { fontFamily: F.serifMedium, fontSize: 14, color: '#6B7280' },
});
