import React, { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { F } from '@/constants/tokens';

const TRACK_HEIGHT = 6;
const THUMB_SIZE = 22;

type Props = {
  value: number;
  onChange: (v: number) => void;
  color: string;
  min?: number;
  max?: number;
  edgeLabels?: { left: string; right: string };
};

export default function AnimatedSlider({
  value,
  onChange,
  color,
  min = 1,
  max = 10,
  edgeLabels,
}: Props) {
  const trackWidth = useSharedValue(0);
  const thumbX = useSharedValue(0);
  const lastTickValue = useSharedValue(value);

  const valueToX = useCallback((v: number, w: number) => {
    const range = max - min;
    if (w <= 0 || range <= 0) return 0;
    const safeValue = Math.max(min, Math.min(max, v));
    return ((safeValue - min) / range) * w;
  }, [min, max]);

  const emitChange = useCallback((nextValue: number) => {
    void Haptics.selectionAsync().catch(() => {});
    onChange(nextValue);
  }, [onChange]);

  useEffect(() => {
    lastTickValue.value = value;
    if (trackWidth.value > 0) {
      thumbX.value = withSpring(valueToX(value, trackWidth.value), {
        damping: 18,
        stiffness: 220,
        mass: 0.6,
      });
    }
  }, [value, valueToX, thumbX, trackWidth, lastTickValue]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    trackWidth.value = w;
    thumbX.value = valueToX(value, w);
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin(e => {
      const width = trackWidth.value;
      const range = max - min;
      const x = Math.max(0, Math.min(width, e.x));
      thumbX.value = x;
      const raw = width <= 0 || range <= 0 ? min : (x / width) * range + min;
      const v = Math.max(min, Math.min(max, Math.round(raw)));
      if (v !== lastTickValue.value) {
        lastTickValue.value = v;
        runOnJS(emitChange)(v);
      }
    })
    .onUpdate(e => {
      const width = trackWidth.value;
      const range = max - min;
      const x = Math.max(0, Math.min(width, e.x));
      thumbX.value = x;
      const raw = width <= 0 || range <= 0 ? min : (x / width) * range + min;
      const v = Math.max(min, Math.min(max, Math.round(raw)));
      if (v !== lastTickValue.value) {
        lastTickValue.value = v;
        runOnJS(emitChange)(v);
      }
    })
    .onEnd(() => {
      const width = trackWidth.value;
      const range = max - min;
      const raw = width <= 0 || range <= 0 ? min : (thumbX.value / width) * range + min;
      const v = Math.max(min, Math.min(max, Math.round(raw)));
      const targetX = width <= 0 || range <= 0 ? 0 : ((v - min) / range) * width;
      thumbX.value = withSpring(targetX, {
        damping: 18,
        stiffness: 220,
        mass: 0.6,
      });
    });

  const fillStyle = useAnimatedStyle(() => ({
    width: thumbX.value + THUMB_SIZE / 2,
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.value - THUMB_SIZE / 2 }],
  }));

  return (
    <View style={s.wrap}>
      <GestureDetector gesture={pan}>
        <View style={s.touchArea}>
          <View style={s.track} onLayout={onLayout}>
            <Animated.View style={[s.fill, { backgroundColor: color }, fillStyle]} />
          </View>
          <Animated.View
            pointerEvents="none"
            style={[s.thumb, { backgroundColor: color, shadowColor: color }, thumbStyle]}
          />
        </View>
      </GestureDetector>

      {edgeLabels && (
        <View style={s.edgeRow}>
          <Text style={s.edgeText}>{edgeLabels.left}</Text>
          <Text style={s.edgeText}>{edgeLabels.right}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingVertical: 4 },
  touchArea: { height: THUMB_SIZE + 14, justifyContent: 'center' },
  track: {
    height: TRACK_HEIGHT,
    backgroundColor: '#EDE9E0',
    borderRadius: TRACK_HEIGHT / 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumb: {
    position: 'absolute',
    top: (THUMB_SIZE + 14) / 2 - THUMB_SIZE / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  edgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
    paddingHorizontal: 2,
  },
  edgeText: {
    fontFamily: F.serifMediumItalic,
    fontSize: 13,
    lineHeight: 16,
    color: '#B8AC97',
  },
});
