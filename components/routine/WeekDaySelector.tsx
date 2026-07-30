import React, { useCallback, useEffect, useState } from 'react';
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
import Bloom from '@/components/focus-watch/Bloom';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';

// The week is one recessed track, not seven loose chips: all seven days sit in
// a single warm band (no horizontal scrolling), the chosen day stands lit in
// it, and that light glides between days on the UI thread.

const PLATE_INSET = 5;
const PLATE_GAP = 2;
const CELL_HEIGHT = 52;

// The chosen day is not a struck bronze slab — it is an ivory cartouche
// standing in a pool of warm light, the way a seal sits lit on the Scripture
// screens. Light carries the selection; the gold is only its frame.
const FACE_FILL = ['#FFFFFF', '#FFF8E9'] as const;
const BLOOM_COLOR = '#E6C074';

/** One tracking for both states — see `cellLabel`. */
const LABEL_TRACKING = 1.4;

const IDLE_LABEL = '#8E877C';
const TODAY_LABEL = '#A9853B';
const ACTIVE_LABEL = '#8B6B2F';

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
    // Yoga rounds each cell onto the pixel grid; the plate is placed from the
    // raw fraction, so round it the same way rather than landing a half point
    // off the seat it is meant to fill.
    const target = Math.round(PLATE_INSET + selectedIndex * cellWidth);
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

  return (
    <View style={s.plate} onLayout={handleLayout}>
      <View pointerEvents="none" style={s.plateRim} />

      {cellWidth > 0 && (
        <Reanimated.View
          pointerEvents="none"
          style={[s.dayPlateLayer, { width: Math.max(0, cellWidth - PLATE_GAP * 2) }, plateStyle]}
        >
          <View pointerEvents="none" style={s.dayPlateBloom}>
            <Bloom color={BLOOM_COLOR} opacity={0.62} />
          </View>
          <View pointerEvents="none" style={s.dayPlateFace}>
            <LinearGradient
              colors={[...FACE_FILL]}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View pointerEvents="none" style={s.dayPlateSheen} />
            <View pointerEvents="none" style={s.dayPlateRim} />
            <View pointerEvents="none" style={s.dayPlateChase} />
          </View>
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
    // The lit face is ivory, so today's mark deepens rather than turning white.
    backgroundColor: interpolateColor(progress.value, [0, 1], [C.gold, '#8B6B2F']),
  }));

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.72}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={s.cell}
    >
      <Reanimated.Text style={[s.cellLabel, labelStyle]}>
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
    // A recessed warm track. Solid fill, so the band needs no clipping and the
    // chosen day's light may spill a little past its edge.
    //
    // ⚠ The inset is carried by the CELL ROW'S MARGIN, not by padding here.
    // Yoga and the web disagree about whether a parent's padding also offsets
    // its absolutely positioned children, and the gliding plate is exactly
    // such a child: routed through padding it lands PLATE_INSET off centre on
    // one of the two. With a margin there is nothing to disagree about.
    position: 'relative',
    borderRadius: 21,
    backgroundColor: '#F5F0E4',
  },
  plateRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(160,132,74,0.10)',
  },
  dayPlateLayer: {
    position: 'absolute',
    left: 0,
    top: PLATE_INSET + 3,
    height: CELL_HEIGHT - 6,
    zIndex: 2,
    elevation: 2,
  },
  dayPlateBloom: {
    position: 'absolute',
    left: -10,
    right: -10,
    top: -7,
    bottom: -7,
  },
  dayPlateFace: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#A87E33',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 11,
  },
  dayPlateSheen: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    height: '44%',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.62)',
  },
  dayPlateRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.44)',
  },
  dayPlateChase: {
    // The chased inner frame: the craft you only notice up close.
    position: 'absolute',
    top: 3.5,
    left: 3.5,
    right: 3.5,
    bottom: 3.5,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.20)',
  },
  cellRow: {
    margin: PLATE_INSET,
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
    letterSpacing: LABEL_TRACKING,
    textTransform: 'uppercase',
    // Tracking is added after the final letter as well, so the glyphs sit
    // LABEL_TRACKING/2 left of the box's centre. A transform nudges them back
    // without touching layout. Held equal in both states on purpose: retracking
    // the chosen day re-centred the word under a plate that had not moved.
    transform: [{ translateX: LABEL_TRACKING / 2 }],
  },
  todayMark: {
    position: 'absolute',
    bottom: 9,
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
