import { useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { C, F } from '@/constants/tokens';
import { formatMinutesShort } from './dayPlanStore';

// The daily-limit scale: discrete stops from "Off" to 3h, chosen by touch or
// drag. Same gesture mechanics as the journal's AnimatedSlider (the app's
// proven pattern), snapped to stops with a tick of haptics at each notch.
export const LIMIT_STOPS: (number | null)[] = [null, 15, 30, 45, 60, 90, 120, 180];

export function limitStopLabel(value: number | null) {
  return value === null ? 'Off' : formatMinutesShort(value);
}

const TRACK_HEIGHT = 6;
const THUMB_SIZE = 22;

export default function LimitSlider({
  value,
  onChange,
  stops = LIMIT_STOPS,
  edgeLabels = { left: 'Off', right: '3h' },
}: {
  value: number | null;
  onChange: (next: number | null) => void;
  stops?: (number | null)[];
  edgeLabels?: { left: string; right: string };
}) {
  const trackWidth = useSharedValue(0);
  const thumbX = useSharedValue(0);
  const lastIndex = useSharedValue(Math.max(0, stops.indexOf(value)));
  const [layoutWidth, setLayoutWidth] = useState(0);
  const maxIndex = stops.length - 1;

  const indexToX = useCallback(
    (index: number, width: number) => {
      if (width <= 0) return 0;
      return (Math.max(0, Math.min(maxIndex, index)) / maxIndex) * width;
    },
    [maxIndex]
  );

  const emitChange = useCallback(
    (index: number) => {
      void Haptics.selectionAsync().catch(() => {});
      onChange(stops[index]);
    },
    [onChange, stops]
  );

  useEffect(() => {
    const index = Math.max(0, stops.indexOf(value));
    lastIndex.value = index;
    if (trackWidth.value > 0) {
      thumbX.value = withSpring(indexToX(index, trackWidth.value), {
        damping: 18,
        stiffness: 220,
        mass: 0.6,
      });
    }
  }, [value, stops, indexToX, thumbX, trackWidth, lastIndex]);

  const onLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    trackWidth.value = width;
    setLayoutWidth(width);
    thumbX.value = indexToX(Math.max(0, stops.indexOf(value)), width);
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin(e => {
      const width = trackWidth.value;
      if (width <= 0) return;
      const x = Math.max(0, Math.min(width, e.x));
      thumbX.value = x;
      const index = Math.round((x / width) * maxIndex);
      if (index !== lastIndex.value) {
        lastIndex.value = index;
        runOnJS(emitChange)(index);
      }
    })
    .onUpdate(e => {
      const width = trackWidth.value;
      if (width <= 0) return;
      const x = Math.max(0, Math.min(width, e.x));
      thumbX.value = x;
      const index = Math.round((x / width) * maxIndex);
      if (index !== lastIndex.value) {
        lastIndex.value = index;
        runOnJS(emitChange)(index);
      }
    })
    .onEnd(() => {
      const width = trackWidth.value;
      if (width <= 0) return;
      const index = Math.round((thumbX.value / width) * maxIndex);
      thumbX.value = withSpring(indexToX(index, width), {
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

  const activeIndex = Math.max(0, stops.indexOf(value));

  return (
    <View style={s.wrap}>
      <GestureDetector gesture={pan}>
        <View style={s.touchArea}>
          <View style={s.track} onLayout={onLayout}>
            <Animated.View style={[s.fill, fillStyle]} />
          </View>
          {/* Notches — one quiet dot per stop, brightened once passed. */}
          {layoutWidth > 0 &&
            stops.map((_, index) => (
              <View
                key={index}
                pointerEvents="none"
                style={[
                  s.notch,
                  { left: indexToX(index, layoutWidth) - 2 },
                  index <= activeIndex && index > 0 && s.notchPassed,
                ]}
              />
            ))}
          <Animated.View pointerEvents="none" style={[s.thumb, thumbStyle]} />
        </View>
      </GestureDetector>
      <View style={s.edgeRow}>
        <Text style={[s.edgeText, value === null && s.edgeTextActive]}>{edgeLabels.left}</Text>
        <Text style={s.edgeText}>{edgeLabels.right}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingTop: 2,
  },
  touchArea: {
    height: THUMB_SIZE + 12,
    justifyContent: 'center',
  },
  track: {
    height: TRACK_HEIGHT,
    backgroundColor: '#EFECE4',
    borderRadius: TRACK_HEIGHT / 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: C.gold,
  },
  notch: {
    position: 'absolute',
    top: (THUMB_SIZE + 12) / 2 - 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDD8CC',
  },
  notchPassed: {
    backgroundColor: '#B8933F',
  },
  thumb: {
    position: 'absolute',
    top: (THUMB_SIZE + 12) / 2 - THUMB_SIZE / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: C.gold,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  edgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  edgeText: {
    fontFamily: F.sansMedium,
    fontSize: 10.5,
    color: C.textMuted,
  },
  edgeTextActive: {
    fontFamily: F.sansSemiBold,
    color: C.goldDark,
  },
});
