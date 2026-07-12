import { useEffect, useState } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { C } from '@/constants/tokens';

// The Focus tab's animated progress language: fills glide to their value with
// the tab's calm ease-out (no bounce), and a live meter carries a slow light
// sweep — quiet high-tech, never confetti.

export type MeterMarker = {
  at: number; // 0..1 along the track
  color: string;
  strong?: boolean;
};

export function FocusMeter({
  fraction,
  height = 10,
  fill = C.gold,
  track = '#EFECE4',
  markers,
  live = false,
  style,
}: {
  fraction: number;
  height?: number;
  fill?: string;
  track?: string;
  markers?: MeterMarker[];
  live?: boolean;
  style?: ViewStyle;
}) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const clamped = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
  const fillX = useSharedValue(0);
  const sheen = useSharedValue(0);

  useEffect(() => {
    if (width <= 0) return;
    if (reduceMotion) {
      fillX.value = clamped * width;
      return;
    }
    fillX.value = withTiming(clamped * width, {
      duration: 680,
      easing: Easing.out(Easing.cubic),
    });
  }, [clamped, width, reduceMotion, fillX]);

  useEffect(() => {
    if (live && width > 0 && !reduceMotion) {
      sheen.value = 0;
      sheen.value = withRepeat(
        withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.quad) }),
        -1,
        false
      );
    } else {
      cancelAnimation(sheen);
      sheen.value = 0;
    }
    return () => cancelAnimation(sheen);
  }, [live, width, reduceMotion, sheen]);

  const fillStyle = useAnimatedStyle(() => ({ width: fillX.value }));
  const sheenStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheen.value, [0, 0.06, 0.4, 0.52, 1], [0, 0.85, 0.85, 0, 0]),
    transform: [
      { translateX: interpolate(sheen.value, [0, 0.5, 1], [-72, width + 16, width + 16]) },
    ],
  }));

  return (
    <View
      style={[{ height }, style]}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
    >
      <View style={[s.track, { borderRadius: height / 2, backgroundColor: track }]}>
        <Animated.View
          style={[s.fill, { borderRadius: height / 2, backgroundColor: fill }, fillStyle]}
        />
        {live && (
          <Animated.View pointerEvents="none" style={[s.sheen, sheenStyle]}>
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
        )}
      </View>
      {width > 0 &&
        markers?.map((marker, index) => (
          <View
            key={index}
            pointerEvents="none"
            style={[
              s.marker,
              {
                left: Math.min(width - 2, Math.max(0, marker.at * width - 1)),
                width: marker.strong ? 2.5 : 1.5,
                height: height + 8,
                backgroundColor: marker.color,
              },
            ]}
          />
        ))}
    </View>
  );
}

// A small status dot that breathes a soft ring outward — the tab's "this is
// alive right now" signal (protection badge, session marker, web ON chip).
export function PulseDot({
  color,
  size = 6,
  pulse = true,
}: {
  color: string;
  size?: number;
  pulse?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);
  const animate = pulse && !reduceMotion;

  useEffect(() => {
    if (animate) {
      t.value = 0;
      t.value = withRepeat(
        withTiming(1, { duration: 1900, easing: Easing.out(Easing.quad) }),
        -1,
        false
      );
    } else {
      cancelAnimation(t);
      t.value = 0;
    }
    return () => cancelAnimation(t);
  }, [animate, t]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: animate ? 0.5 * (1 - t.value) : 0,
    transform: [{ scale: 1 + t.value * 1.8 }],
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color },
          ringStyle,
        ]}
      />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

const s = StyleSheet.create({
  track: {
    flex: 1,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  sheen: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 56,
  },
  marker: {
    position: 'absolute',
    top: -4,
    borderRadius: 1,
  },
});
