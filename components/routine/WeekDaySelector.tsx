import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { C, F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';

// The week is one engraved plate, not seven loose chips: all seven days sit on
// a single parchment band (no horizontal scrolling), the chosen day wears the
// app's struck-gold plate, and that plate glides between days on the UI thread.

const PLATE_INSET = 5;
const PLATE_GAP = 2;
const CELL_HEIGHT = 50;

const GOLD_FACE = ['#E2BD75', '#C5A059', '#A87E33'] as const;
const GOLD_FACE_STOPS = [0, 0.55, 1] as const;

const IDLE_LABEL = '#8E877C';
const TODAY_LABEL = '#A9853B';
const ACTIVE_LABEL = '#FFFFFF';

// Matches the app's established spring tone (~25% overshoot).
const SLIDE_SPRING = { damping: 15, stiffness: 160, mass: 1 } as const;

export type WeekDayGeometry = { cellWidth: number; inset: number };

type WeekDaySelectorProps = {
  labels: string[];
  selectedIndex: number;
  todayIndex: number;
  onSelect: (index: number) => void;
  onGeometryChange?: (geometry: WeekDayGeometry) => void;
};

export default function WeekDaySelector({
  labels,
  selectedIndex,
  todayIndex,
  onSelect,
  onGeometryChange,
}: WeekDaySelectorProps) {
  const [plateWidth, setPlateWidth] = useState(0);
  const count = labels.length;
  const cellWidth = plateWidth > 0 ? (plateWidth - PLATE_INSET * 2) / count : 0;

  const slide = useSharedValue(0);
  const ready = useSharedValue(0);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    setPlateWidth(current => (Math.abs(current - nextWidth) < 0.5 ? current : nextWidth));
  }, []);

  useEffect(() => {
    if (cellWidth <= 0) return;
    onGeometryChange?.({ cellWidth, inset: PLATE_INSET });
  }, [cellWidth, onGeometryChange]);

  useEffect(() => {
    if (cellWidth <= 0) return;
    const target = PLATE_INSET + selectedIndex * cellWidth;
    if (ready.value === 0) {
      // First measured frame lands without motion, then the plate is live.
      slide.value = target;
      ready.value = withTiming(1, { duration: 140 });
      return;
    }
    slide.value = withSpring(target, SLIDE_SPRING);
  }, [cellWidth, ready, selectedIndex, slide]);

  const plateStyle = useAnimatedStyle(() => ({
    opacity: ready.value,
    transform: [{ translateX: slide.value + PLATE_GAP }],
  }));

  const separators = useMemo(
    () => Array.from({ length: Math.max(0, count - 1) }, (_, index) => index + 1),
    [count],
  );

  return (
    <View style={s.plate} onLayout={handleLayout}>
      <LinearGradient
        colors={['#FFFDF8', '#FBF5E8']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={s.plateRim} />

      {cellWidth > 0 && separators.map(index => (
        <View
          key={`rule-${index}`}
          pointerEvents="none"
          style={[s.cellRule, { left: PLATE_INSET + index * cellWidth }]}
        />
      ))}

      {cellWidth > 0 && (
        <Reanimated.View
          pointerEvents="none"
          style={[s.dayPlate, { width: Math.max(0, cellWidth - PLATE_GAP * 2) }, plateStyle]}
        >
          <LinearGradient
            colors={[...GOLD_FACE]}
            locations={[...GOLD_FACE_STOPS]}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={s.dayPlateSheen} />
          <View pointerEvents="none" style={s.dayPlateRim} />
        </Reanimated.View>
      )}

      <View style={s.cellRow}>
        {labels.map((label, index) => (
          <DayCell
            key={label + index}
            label={label}
            selected={index === selectedIndex}
            isToday={index === todayIndex}
            onPress={() => onSelect(index)}
          />
        ))}
      </View>
    </View>
  );
}

function DayCell({
  label,
  selected,
  isToday,
  onPress,
}: {
  label: string;
  selected: boolean;
  isToday: boolean;
  onPress: () => void;
}) {
  const progress = useSharedValue(selected ? 1 : 0);
  const idleColor = isToday ? TODAY_LABEL : IDLE_LABEL;

  useEffect(() => {
    progress.value = withTiming(selected ? 1 : 0, { duration: 170 });
  }, [progress, selected]);

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [idleColor, ACTIVE_LABEL]),
  }));

  const markStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [C.gold, 'rgba(255,255,255,0.9)'],
    ),
  }));

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.72}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={s.cell}
    >
      <Reanimated.Text style={[s.cellLabel, selected && s.cellLabelActive, labelStyle]}>
        {label}
      </Reanimated.Text>
      {isToday && <Reanimated.View style={[s.todayMark, markStyle]} />}
    </TouchableOpacity>
  );
}

// The opened day announces itself the way the almanac head does on Monthly
// Goals: a serif name between engraved rules, with the day's shape beneath it.
export function DayHead({ title, meta }: { title: string; meta: string }) {
  const settle = useSharedValue(1);

  useEffect(() => {
    settle.value = 0;
    settle.value = withTiming(1, { duration: 220 });
  }, [settle, title]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + settle.value * 0.65,
    transform: [{ translateY: (1 - settle.value) * 5 }],
  }));

  return (
    <Reanimated.View style={[s.head, style]}>
      <View style={s.headRow}>
        <View style={s.headWing}>
          <View style={s.headRule} />
          <View style={s.headDiamond} />
        </View>
        <Text style={s.headTitle} numberOfLines={1}>{title}</Text>
        <View style={s.headWing}>
          <View style={s.headDiamond} />
          <View style={s.headRule} />
        </View>
      </View>
      <Text style={s.headMeta} numberOfLines={1}>{meta}</Text>
    </Reanimated.View>
  );
}

const s = StyleSheet.create({
  plate: {
    position: 'relative',
    borderRadius: 22,
    padding: PLATE_INSET,
    overflow: 'hidden',
    shadowColor: '#8B6B2F',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  plateRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.24)',
  },
  cellRule: {
    position: 'absolute',
    top: PLATE_INSET + 15,
    width: 1,
    height: CELL_HEIGHT - 30,
    backgroundColor: 'rgba(160,132,74,0.16)',
  },
  dayPlate: {
    // Seated in the band rather than filling it: parchment breathes above and
    // below the struck plate, which keeps it a coin instead of a slab.
    position: 'absolute',
    left: 0,
    top: PLATE_INSET + 3,
    height: CELL_HEIGHT - 6,
    borderRadius: 15,
    overflow: 'hidden',
    zIndex: 2,
    elevation: 2,
    shadowColor: '#A87E33',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  dayPlateSheen: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    height: '46%',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  dayPlateRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(150,108,40,0.32)',
  },
  cellRow: {
    flexDirection: 'row',
    zIndex: 3,
    elevation: 3,
    backgroundColor: 'transparent',
  },
  cell: {
    flex: 1,
    height: CELL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  cellLabel: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  cellLabelActive: {
    letterSpacing: 1.5,
  },
  todayMark: {
    position: 'absolute',
    bottom: 10,
    width: 13,
    height: 1.5,
    borderRadius: 1,
  },
  head: {
    alignItems: 'center',
    paddingTop: 14,
    rowGap: 3,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    columnGap: 10,
    paddingHorizontal: 4,
  },
  headWing: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 7,
  },
  headTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 27,
    lineHeight: 31,
    letterSpacing: 0.3,
    color: C.text,
    textAlign: 'center',
    flexShrink: 1,
  },
  headRule: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(197,160,89,0.32)',
  },
  headDiamond: {
    width: 5,
    height: 5,
    borderRadius: 1,
    backgroundColor: 'rgba(197,160,89,0.72)',
    transform: [{ rotate: '45deg' }],
  },
  headMeta: {
    fontFamily: F.sansBold,
    fontSize: 8.5,
    lineHeight: 11,
    letterSpacing: 1.8,
    color: '#B89A5A',
    textAlign: 'center',
  },
});
