import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const TRACK_HEIGHT = 8;
const THUMB_SIZE = 26;

export default function LimitSlider({
  value,
  onChange,
  stops = LIMIT_STOPS,
  edgeLabels = { left: 'Off', right: '3h' },
  accent = C.gold,
  trackColor = '#EFECE4',
  bubbleText,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
  stops?: (number | null)[];
  edgeLabels?: { left: string; right: string };
  accent?: string;
  trackColor?: string;
  // When set, a small value chip rides above the thumb — the selection itself
  // announces the value, so headers don't need a second big number.
  bubbleText?: string;
}) {
  const trackWidth = useSharedValue(0);
  const thumbX = useSharedValue(0);
  const lastIndex = useSharedValue(Math.max(0, stops.indexOf(value)));
  const [layoutWidth, setLayoutWidth] = useState(0);
  const maxIndex = stops.length - 1;

  // The parent recreates `onChange` on every render (it writes state). If the
  // gesture captured it directly, each emitted change would rebuild the pan
  // handler mid-drag — a reliable crash. Refs keep the gesture stable.
  const onChangeRef = useRef(onChange);
  const stopsRef = useRef(stops);
  useEffect(() => {
    onChangeRef.current = onChange;
    stopsRef.current = stops;
  }, [onChange, stops]);

  const indexToX = useCallback(
    (index: number, width: number) => {
      if (width <= 0) return 0;
      return (Math.max(0, Math.min(maxIndex, index)) / maxIndex) * width;
    },
    [maxIndex]
  );

  const emitChange = useCallback((index: number) => {
    void Haptics.selectionAsync().catch(() => {});
    onChangeRef.current(stopsRef.current[index]);
  }, []);

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

  const pan = useMemo(
    () =>
      Gesture.Pan()
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
          const target = width <= 0 ? 0 : (Math.max(0, Math.min(maxIndex, index)) / maxIndex) * width;
          thumbX.value = withSpring(target, {
            damping: 18,
            stiffness: 220,
            mass: 0.6,
          });
        }),
    [emitChange, maxIndex, lastIndex, thumbX, trackWidth]
  );

  const fillStyle = useAnimatedStyle(() => ({
    width: thumbX.value + THUMB_SIZE / 2,
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.value - THUMB_SIZE / 2 }],
  }));

  const bubbleStyle = useAnimatedStyle(() => {
    const width = trackWidth.value;
    const clamped = width <= 0 ? 0 : Math.max(34, Math.min(width - 34, thumbX.value));
    return { transform: [{ translateX: clamped - 34 }] };
  });

  const activeIndex = Math.max(0, stops.indexOf(value));

  return (
    <View style={s.wrap}>
      {bubbleText != null && (
        <View style={s.bubbleRow} pointerEvents="none">
          <Animated.View style={[s.bubble, { backgroundColor: accent }, bubbleStyle]}>
            <Text style={s.bubbleText} numberOfLines={1}>{bubbleText}</Text>
            <View style={[s.bubbleCaret, { borderTopColor: accent }]} />
          </Animated.View>
        </View>
      )}
      <View style={s.edgeRow}>
        <Text style={[s.edgeText, value === stops[0] && s.edgeTextActive]}>{edgeLabels.left}</Text>
        <Text style={[s.edgeText, value === stops[stops.length - 1] && s.edgeTextActive]}>
          {edgeLabels.right}
        </Text>
      </View>
      <GestureDetector gesture={pan}>
        <View style={s.touchArea}>
          <View style={[s.track, { backgroundColor: trackColor }]} onLayout={onLayout}>
            <Animated.View style={[s.fill, { backgroundColor: accent }, fillStyle]} />
          </View>
          {/* Dense 15-minute scales show hourly landmarks; snapping remains 15 minutes. */}
          {layoutWidth > 0 &&
            stops.map((_, index) => (
              (stops.length <= 20 || index === 0 || index === stops.length - 1 || index % 4 === 0) ? (
              <View
                key={index}
                pointerEvents="none"
                style={[
                  s.notch,
                  { left: indexToX(index, layoutWidth) - 2 },
                  index <= activeIndex && index > 0 && { backgroundColor: accent },
                ]}
              />
              ) : null
            ))}
          <Animated.View
            pointerEvents="none"
            style={[
              s.thumb,
              { backgroundColor: accent, boxShadow: `0 3px 9px ${accent}55` },
              thumbStyle,
            ]}
          />
        </View>
      </GestureDetector>
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
  },
  notch: {
    position: 'absolute',
    top: (THUMB_SIZE + 12) / 2 - 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDD8CC',
  },
  thumb: {
    position: 'absolute',
    top: (THUMB_SIZE + 12) / 2 - THUMB_SIZE / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  edgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 1,
    marginBottom: -2,
  },
  edgeText: {
    fontFamily: F.sansSemiBold,
    fontSize: 12.5,
    color: C.textSecondary,
  },
  edgeTextActive: {
    color: C.goldDark,
  },
  bubbleRow: {
    height: 34,
    marginBottom: 2,
  },
  bubble: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 68,
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 6,
    boxShadow: '0 3px 9px rgba(35, 30, 20, 0.18)',
  },
  bubbleText: {
    fontFamily: F.sansBold,
    fontSize: 11.5,
    letterSpacing: 0.2,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  bubbleCaret: {
    position: 'absolute',
    bottom: -5,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
