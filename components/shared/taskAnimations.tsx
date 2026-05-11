import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

// Shared task / habit completion animations. Ported from HomeView so that
// habit step rows feel identical to home task cards on tap.

export function AnimatedTaskRow({
  done,
  children,
}: {
  done: boolean;
  children: React.ReactNode;
}) {
  const opacity = useSharedValue(done ? 0.72 : 1);
  const scale = useSharedValue(1);
  const lift = useSharedValue(0);
  const previousDone = useRef(done);

  useEffect(() => {
    const becameDone = previousDone.current !== done && done;
    const becameUndone = previousDone.current !== done && !done;
    previousDone.current = done;

    if (becameDone) {
      // Hold the active opacity while the strikethrough is drawing across
      // the title and the celebratory burst is in full view; only then
      // transition to the dimmed "inactive" look.
      opacity.value = withDelay(1160, withTiming(0.72, { duration: 280 }));
      scale.value = withTiming(0.985, { duration: 95 }, () => {
        scale.value = withSpring(1, { damping: 18, stiffness: 245, mass: 0.7 });
      });
      lift.value = withTiming(-3, { duration: 95 }, () => {
        lift.value = withSpring(0, { damping: 18, stiffness: 245, mass: 0.7 });
      });
      return;
    }

    if (becameUndone) {
      opacity.value = withTiming(1, { duration: 115 });
      lift.value = withSpring(0, { damping: 20, stiffness: 260, mass: 0.75 });
      scale.value = withSpring(1.012, { damping: 16, stiffness: 255, mass: 0.72 }, () => {
        scale.value = withSpring(1, { damping: 18, stiffness: 245, mass: 0.72 });
      });
      return;
    }

    opacity.value = withTiming(done ? 0.72 : 1, { duration: 150 });
    scale.value = withSpring(1, { damping: 18, stiffness: 245, mass: 0.72 });
    lift.value = withSpring(0, { damping: 18, stiffness: 245, mass: 0.72 });
  }, [done, lift, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: lift.value },
      { scale: scale.value },
    ],
  }));

  return <Reanimated.View style={animatedStyle}>{children}</Reanimated.View>;
}

function rgba(hex: string, alpha: number) {
  const m = hex.replace('#', '');
  const r = parseInt(m.length === 3 ? m[0] + m[0] : m.slice(0, 2), 16);
  const g = parseInt(m.length === 3 ? m[1] + m[1] : m.slice(2, 4), 16);
  const b = parseInt(m.length === 3 ? m[2] + m[2] : m.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Premium "divine bloom" celebratory burst:
//   • Soft halo disc — wide gold-tinted glow that expands and fades.
//   • Outer + inner concentric rings — give depth, slightly staggered.
//   • 12 mixed-tone particles — varied sizes and distances, three warm
//     colours (accent / cream / light-gold) so the burst reads as a sparkle
//     rather than a flat dot field.
// Triggers on false → true transition; instantly clears on uncheck.
const TWO_PI = Math.PI * 2;
const PARTICLE_TINT = ['accent', 'cream', 'lightGold'] as const;
type Tint = typeof PARTICLE_TINT[number];
const PARTICLES: { angle: number; distance: number; size: number; tint: Tint }[] =
  Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * TWO_PI;
    // Asymmetric distances + sizes so the burst feels organic.
    const distance = 34 + ((i * 11) % 18);
    const size = 2.5 + ((i * 7) % 7) * 0.6;
    const tint = PARTICLE_TINT[i % PARTICLE_TINT.length];
    return { angle, distance, size, tint };
  });

function BurstParticle({
  angle,
  distance,
  size,
  color,
  phase,
}: {
  angle: number;
  distance: number;
  size: number;
  color: string;
  phase: SharedValue<number>;
}) {
  const dx = Math.cos(angle) * distance;
  const dy = Math.sin(angle) * distance;

  const style = useAnimatedStyle(() => {
    const t = phase.value;
    // Quick punch-out at start, hold visible through the middle, then shrink.
    const popScale = t < 0.06 ? t / 0.06 : Math.max(0.45, 1 - (t - 0.06) * 0.55);
    // Stay fully opaque ~30% of the way out before fading; fade fully by end.
    const opacity = t <= 0.01
      ? 0
      : t < 0.3
        ? 1
        : Math.max(0, 1 - (t - 0.3) * 1.45);
    return {
      opacity,
      transform: [
        { translateX: dx * t },
        { translateY: dy * t },
        { scale: popScale },
      ],
    };
  });

  return (
    <Reanimated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

export function CompletionFlourish({
  done,
  color,
  layerStyle,
}: {
  done: boolean;
  color: string;
  layerStyle?: StyleProp<ViewStyle>;
}) {
  const phase = useSharedValue(0);
  const previousDone = useRef(done);

  useEffect(() => {
    const becameDone = previousDone.current !== done && done;
    previousDone.current = done;

    if (!becameDone) {
      if (!done) phase.value = withTiming(0, { duration: 90 });
      return;
    }

    phase.value = 0;
    phase.value = withTiming(1, {
      duration: 1000,
      easing: Easing.out(Easing.cubic),
    });
  }, [done, phase]);

  // Halo: large soft disc, no border. Holds opacity then slowly fades.
  const haloStyle = useAnimatedStyle(() => {
    const t = phase.value;
    const opacity = t === 0
      ? 0
      : t < 0.25
        ? Math.min(0.62, t * 2.5)
        : Math.max(0, 0.62 - (t - 0.25) * 0.85);
    return {
      opacity,
      transform: [{ scale: 0.4 + t * 1.55 }],
    };
  });

  // Inner ring close to the check — bright, holds full opacity briefly.
  const innerRingStyle = useAnimatedStyle(() => {
    const t = phase.value;
    const opacity = t === 0
      ? 0
      : t < 0.2
        ? 1
        : Math.max(0, 1 - (t - 0.2) * 1.3);
    return {
      opacity,
      transform: [{ scale: 0.5 + t * 1.05 }],
    };
  });

  // Outer ring travels further, slightly delayed for stagger.
  const outerRingStyle = useAnimatedStyle(() => {
    const t = phase.value;
    const tDelayed = Math.max(0, t - 0.06);
    const opacity = tDelayed === 0
      ? 0
      : tDelayed < 0.22
        ? Math.min(0.78, tDelayed * 4)
        : Math.max(0, 0.78 - (tDelayed - 0.22) * 1.0);
    return {
      opacity,
      transform: [{ scale: 0.4 + tDelayed * 1.2 }],
    };
  });

  return (
    <View pointerEvents="none" style={[s.flourishLayer, layerStyle]}>
      <Reanimated.View
        style={[s.halo, { backgroundColor: rgba(color, 0.34) }, haloStyle]}
      />
      <Reanimated.View
        style={[s.outerRing, { borderColor: rgba(color, 0.42) }, outerRingStyle]}
      />
      <Reanimated.View
        style={[s.innerRing, { borderColor: rgba(color, 0.65) }, innerRingStyle]}
      />
      {PARTICLES.map((p, i) => (
        <BurstParticle
          key={i}
          angle={p.angle}
          distance={p.distance}
          size={p.size}
          color={p.tint === 'accent' ? color : p.tint === 'cream' ? '#FFF6DD' : '#E2BD75'}
          phase={phase}
        />
      ))}
    </View>
  );
}

// Smoothly animates the fill width of a progress bar. Drop this in place of
// the old static fill <View>.
export function AnimatedProgressFill({
  percent,
  color,
  height = 6,
}: {
  percent: number;
  color: string;
  height?: number;
}) {
  const progress = useSharedValue(percent);

  useEffect(() => {
    progress.value = withSpring(percent, { damping: 20, stiffness: 110, mass: 0.85 });
  }, [percent, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(100, progress.value))}%`,
  }));

  return (
    <Reanimated.View
      style={[
        { height, borderRadius: height / 2, backgroundColor: color },
        fillStyle,
      ]}
    />
  );
}

const s = StyleSheet.create({
  flourishLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: 92,
    height: 92,
    borderRadius: 46,
  },
  outerRing: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
  },
  innerRing: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2.2,
  },
});
