import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { C } from '@/constants/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// The Focus selection mark: checking pops with a small spring, fills gold,
// draws the check stroke, and releases one soft ring. Unchecking settles back
// without ceremony. All work runs on the UI thread.
export default function FocusCheck({
  checked,
  size = 22,
  disabled = false,
  accent = C.gold,
}: {
  checked: boolean;
  size?: number;
  disabled?: boolean;
  accent?: string;
}) {
  const reduceMotion = useReducedMotion();
  const fill = useSharedValue(checked ? 1 : 0);
  const stroke = useSharedValue(checked ? 1 : 0);
  const pop = useSharedValue(1);
  const ring = useSharedValue(checked ? 1 : 0);
  const mounted = useRef(false);

  useEffect(() => {
    // First render just reflects state; animation belongs to real toggles.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (reduceMotion) {
      fill.value = checked ? 1 : 0;
      stroke.value = checked ? 1 : 0;
      return;
    }
    if (checked) {
      fill.value = withTiming(1, { duration: 170, easing: Easing.out(Easing.cubic) });
      stroke.value = 0;
      stroke.value = withDelay(90, withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) }));
      pop.value = withSequence(
        withTiming(0.86, { duration: 90, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 11, stiffness: 320, mass: 0.7 })
      );
      ring.value = 0;
      ring.value = withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) });
    } else {
      fill.value = withTiming(0, { duration: 150, easing: Easing.out(Easing.cubic) });
      stroke.value = withTiming(0, { duration: 90, easing: Easing.out(Easing.quad) });
      pop.value = withSequence(
        withTiming(0.92, { duration: 80, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 14, stiffness: 300, mass: 0.7 })
      );
    }
  }, [checked, fill, stroke, pop, ring, reduceMotion]);

  const boxStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
    backgroundColor: interpolateColor(fill.value, [0, 1], ['#FFFFFF', accent]),
    borderColor: interpolateColor(fill.value, [0, 1], ['#D6D3D1', accent]),
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ring.value, [0, 0.15, 1], [0, 0.42, 0]),
    transform: [{ scale: interpolate(ring.value, [0, 1], [1, 2]) }],
  }));

  // The check path is ~19 units long in a 24-unit viewBox.
  const checkProps = useAnimatedProps(() => ({
    strokeDashoffset: 19 * (1 - stroke.value),
    opacity: stroke.value > 0.02 ? 1 : 0,
  }));

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.45 : 1 }}
      pointerEvents="none"
    >
      <Animated.View
        style={[
          { position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: accent },
          ringStyle,
        ]}
      />
      <Animated.View style={[s.box, { width: size, height: size, borderRadius: size / 2 }, boxStyle]}>
        <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
          <AnimatedPath
            d="M4.5 12.5l5 5L19.5 7"
            stroke="#FFFFFF"
            strokeWidth={3.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={19}
            animatedProps={checkProps}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
