import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

// The allowance, drawn as the instrument that measures it.
//
// This is the Limit emblem from `FocusRuleSwitch` grown up, and it is the same
// object at two scales: small on the rule's plate, large in the sheet that sets
// it. Choosing a limit and reading it back are then the same act, not two
// screens that happen to mention the same number.
//
// It is also the ring the group seal and the capacity seal already wear, so an
// arc reading "this much of the day" needs no learning anywhere in Focus.
//
// Whatever the caller puts inside sits centred in the ring — a percentage on
// the plate, the duration itself in the sheet.

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function AllowanceDial({
  size,
  fraction,
  accent,
  strokeWidth,
  children,
}: {
  size: number;
  /** The share of its parent this allowance takes, 0–1. */
  fraction: number;
  accent: string;
  strokeWidth: number;
  children?: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const radius = size / 2 - strokeWidth / 2 - 1;
  const circumference = 2 * Math.PI * radius;
  const target = Math.max(0, Math.min(1, fraction));
  const progress = useSharedValue(reduceMotion ? target : 0);

  useEffect(() => {
    progress.value = reduceMotion
      ? target
      : withTiming(target, { duration: 460, easing: Easing.out(Easing.cubic) });
  }, [progress, reduceMotion, target]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={[s.wrap, { width: size, height: size }]}>
      <Svg pointerEvents="none" width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={accent}
          strokeOpacity={0.16}
          strokeWidth={strokeWidth}
        />
        <AnimatedCircle
          animatedProps={arcProps}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={accent}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
});
