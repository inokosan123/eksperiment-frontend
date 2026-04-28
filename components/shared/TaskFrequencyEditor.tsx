import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';

import { CalendarCheck } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';

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

function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return `rgba(197,160,89,${alpha})`;
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

if (Platform.OS === 'android' && typeof UIManager.setLayoutAnimationEnabledExperimental === 'function') {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function animateLayout() {
  try {
    LayoutAnimation.configureNext({
      duration: 260,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
  } catch {
    // Native gets the drawer animation; web can safely ignore this.
  }
}

function useSelectionMotion(active: boolean) {
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
              animateLayout();
              onFrequencyChange(option.value);
            }}
          />
        ))}
      </View>

      {frequency === 'specific_days' && (
        <View style={s.gridMeasure} onLayout={event => setGridWidth(Math.floor(event.nativeEvent.layout.width))}>
          <Text style={[s.subLabel, { color: accent }]}>Choose Days</Text>
          <View style={[s.dayChipRow, { columnGap: weekdayGap }]}>
            {WEEKDAY_LABELS.map((day, index) => {
              const active = selectedDays.includes(index);
              return (
                <TouchableOpacity
                  key={`${day}-${index}`}
                  onPress={() => {
                    animateLayout();
                    onSelectedDaysChange(active
                      ? selectedDays.filter(item => item !== index)
                      : [...selectedDays, index].sort((a, b) => a - b));
                  }}
                  activeOpacity={0.84}
                  style={[
                    s.dayChip,
                    {
                      width: weekdaySize,
                      height: weekdaySize,
                      borderRadius: Math.round(weekdaySize / 2),
                    },
                    active && { borderColor: accent, backgroundColor: withAlpha(accent, 0.07) },
                  ]}
                >
                  <Text style={[s.dayChipText, active && { color: accent }]}>{day}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {frequency === 'monthly' && (
        <View style={s.monthlyWrap} onLayout={event => setGridWidth(Math.floor(event.nativeEvent.layout.width))}>
          <Text style={[s.subLabel, { color: accent }]}>Days of Month</Text>
          <Text style={s.monthlyHint}>Choose one or more dates for the monthly repeat.</Text>
          <View style={[s.monthlyGrid, { gap: monthlyGap }]}>
            {Array.from({ length: 31 }, (_, index) => index + 1).map(day => {
              const active = monthlyDays.includes(day);
              return (
                <TouchableOpacity
                  key={day}
                  onPress={() => {
                    animateLayout();
                    const next = active
                      ? monthlyDays.filter(item => item !== day)
                      : [...monthlyDays, day].sort((a, b) => a - b);
                    onMonthlyDaysChange(next.length ? next : [day]);
                  }}
                  activeOpacity={0.84}
                  style={[
                    s.monthlyCell,
                    {
                      width: monthlyCellSize,
                      minHeight: monthlyCellSize,
                    },
                    active && { borderColor: accent, backgroundColor: withAlpha(accent, 0.07) },
                  ]}
                >
                  <Text style={[s.monthlyText, active && { color: accent }]}>{day}</Text>
                </TouchableOpacity>
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
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.006] });
  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#FFFFFF', withAlpha(accent, 0.055)],
  });
  const borderColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#F0EDE6', accent],
  });
  const shadowOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.015, 0.10] });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={s.frequencyTouch}>
      <Animated.View
        style={[
          s.frequencyChip,
          {
            backgroundColor,
            borderColor,
            shadowColor: accent,
            shadowOpacity,
            transform: [{ scale }],
          },
        ]}
      >
        <View style={s.frequencyCopy}>
          <Text style={[s.frequencyText, active && { color: accent }]} numberOfLines={1}>{option.label}</Text>
          <Text style={[s.frequencySub, active && { color: accent }]} numberOfLines={1}>{option.desc}</Text>
        </View>
        <View style={[s.frequencyDotRing, active && { borderColor: withAlpha(accent, 0.34), backgroundColor: '#FFFDF8' }]}>
          {active && <View style={[s.frequencyDot, { backgroundColor: accent }]} />}
        </View>
      </Animated.View>
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
