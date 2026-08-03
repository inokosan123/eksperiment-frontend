import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Gesture,
  GestureDetector,
  Pressable,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { C, F } from '@/constants/tokens';
import type { FocusAnalyticsPeriod } from './focusAnalyticsDates';

const PERIODS: { key: FocusAnalyticsPeriod; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];

const SPRING = { damping: 18, stiffness: 260, mass: 0.7 } as const;

export default function FocusAnalyticsPeriodControl({
  value,
  onChange,
}: {
  value: FocusAnalyticsPeriod;
  onChange: (value: FocusAnalyticsPeriod) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = PERIODS.findIndex(period => period.key === value);
  const indexValue = useSharedValue(index);
  const trackWidth = useSharedValue(0);
  const dragProgress = useSharedValue(0);

  useEffect(() => {
    indexValue.value = reduceMotion
      ? withTiming(index, { duration: 80 })
      : withSpring(index, SPRING);
  }, [index, indexValue, reduceMotion]);

  const commit = useCallback((nextIndex: number) => {
    const next = PERIODS[Math.max(0, Math.min(PERIODS.length - 1, nextIndex))];
    if (!next || next.key === value) return;
    void Haptics.selectionAsync();
    onChange(next.key);
  }, [onChange, value]);

  const gesture = useMemo(
    () => Gesture.Pan()
      .activeOffsetX([-8, 8])
      .onUpdate(event => {
        const segmentWidth = trackWidth.value / PERIODS.length;
        if (segmentWidth <= 0) return;
        const minimum = -indexValue.value;
        const maximum = PERIODS.length - 1 - indexValue.value;
        dragProgress.value = Math.max(
          minimum,
          Math.min(maximum, event.translationX / segmentWidth),
        );
      })
      .onEnd(event => {
        const segmentWidth = trackWidth.value / PERIODS.length;
        const moved = segmentWidth > 0
          ? Math.round(event.translationX / segmentWidth)
          : 0;
        const velocityStep = Math.abs(event.velocityX) > 520
          ? event.velocityX > 0 ? 1 : -1
          : 0;
        const step = moved === 0 ? velocityStep : moved;
        if (step !== 0) {
          runOnJS(commit)(Math.round(indexValue.value) + step);
        }
      })
      .onFinalize(() => {
        dragProgress.value = reduceMotion
          ? withTiming(0, { duration: 80 })
          : withSpring(0, SPRING);
      }),
    [commit, dragProgress, indexValue, reduceMotion, trackWidth],
  );

  const thumbStyle = useAnimatedStyle(() => {
    const segmentWidth = trackWidth.value / PERIODS.length;
    return {
      width: Math.max(0, segmentWidth - 6),
      transform: [{
        translateX: (indexValue.value + dragProgress.value) * segmentWidth + 3,
      }],
    };
  });

  const onLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    setWidth(nextWidth);
    trackWidth.value = nextWidth;
  };

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={styles.outer}
        accessibilityRole="tablist"
        accessibilityLabel="Analytics period"
      >
        <View style={styles.track} onLayout={onLayout}>
          {width > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[styles.thumb, thumbStyle]}
            />
          )}
          {PERIODS.map(period => {
            const selected = period.key === value;
            return (
              <Pressable
                key={period.key}
                onPress={() => commit(PERIODS.findIndex(item => item.key === period.key))}
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.buttonPressed,
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                hitSlop={3}
              >
                <Text style={[styles.label, selected && styles.labelSelected]}>
                  {period.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  outer: {
    minHeight: 50,
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: C.bg,
  },
  track: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: '#E8E1D3',
    borderRadius: 15,
    borderCurve: 'continuous',
    backgroundColor: '#F3F0E9',
    paddingVertical: 2,
    overflow: 'hidden',
  },
  thumb: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: C.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E6D6B5',
    shadowColor: '#49391F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09,
    shadowRadius: 5,
    elevation: 2,
  },
  button: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  buttonPressed: {
    opacity: 0.64,
  },
  label: {
    fontFamily: F.sansSemiBold,
    fontSize: 10.5,
    letterSpacing: 0.45,
    color: C.textMuted,
  },
  labelSelected: {
    color: C.goldDark,
  },
});
