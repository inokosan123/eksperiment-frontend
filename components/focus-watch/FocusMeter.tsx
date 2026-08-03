import { useEffect, useState } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { C } from '@/constants/tokens';
import { useFocusMainMotion } from './focus-main-motion';
import {
  continuousPhase,
  easeInOutQuad,
} from '@/components/shared/use-continuous-animation-clock';
import { useAmbientMotion } from '@/components/shared/ambient-motion';

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
  const mainMotionEnabled = useFocusMainMotion();
  const [width, setWidth] = useState(0);
  const clamped = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
  const fillX = useSharedValue(0);
  const sheenRuntime = useAmbientMotion(live && mainMotionEnabled && width > 0);
  const sheenEnabled = sheenRuntime.enabled;
  const sheenClock = sheenRuntime.clock;

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

  const fillStyle = useAnimatedStyle(() => ({ width: fillX.value }));
  const sheenStyle = useAnimatedStyle(() => {
    const phase = sheenEnabled
      ? easeInOutQuad(continuousPhase(sheenClock.value, 3600))
      : 0;
    return {
      opacity: interpolate(phase, [0, 0.06, 0.4, 0.52, 1], [0, 0.85, 0.85, 0, 0]),
      transform: [
        { translateX: interpolate(phase, [0, 0.5, 1], [-72, width + 16, width + 16]) },
      ],
    };
  });

  return (
    <View
      style={[{ height }, style]}
      onLayout={event => {
        const nextWidth = event.nativeEvent.layout.width;
        setWidth(current => current === nextWidth ? current : nextWidth);
      }}
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
  const mainMotionEnabled = useFocusMainMotion();
  const runtime = useAmbientMotion(pulse && mainMotionEnabled);
  const animate = runtime.enabled;
  const clock = runtime.clock;

  const ringStyle = useAnimatedStyle(() => {
    const linear = animate ? continuousPhase(clock.value, 1900) : 0;
    const phase = 1 - Math.pow(1 - linear, 2);
    return {
      opacity: animate ? 0.5 * (1 - phase) : 0,
      transform: [{ scale: 1 + phase * 1.8 }],
    };
  });

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
