import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Reanimated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

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

// Premium cartoon completion sparkle:
//   • Soft halo disc — wide gold-tinted glow that expands and fades.
//   • Outer + inner concentric rings — give depth, slightly staggered.
//   • 12 mixed-tone particles — varied sizes and distances, three warm
//     colours (accent / cream / light-gold) so the burst reads as a sparkle
//     rather than a flat dot field.
// Triggers on false → true transition; instantly clears on uncheck.
const PARTICLE_TINT = ['accent', 'cream', 'lightGold', 'deepGold'] as const;
const PARTICLE_SHAPES = ['ray', 'bead', 'glint', 'leaf'] as const;
type Tint = typeof PARTICLE_TINT[number];
type ParticleShape = typeof PARTICLE_SHAPES[number];
function deg(value: number) {
  return (value * Math.PI) / 180;
}

const PARTICLES: { angle: number; distance: number; size: number; tint: Tint; shape: ParticleShape; delay: number; spin: number }[] = [
  { angle: deg(-90), distance: 41, size: 8.6, tint: 'lightGold', shape: 'ray', delay: 0.00, spin: 0 },
  { angle: deg(-58), distance: 34, size: 5.2, tint: 'cream', shape: 'glint', delay: 0.08, spin: 12 },
  { angle: deg(-31), distance: 37, size: 7.8, tint: 'deepGold', shape: 'leaf', delay: 0.04, spin: 10 },
  { angle: deg(0), distance: 31, size: 3.9, tint: 'lightGold', shape: 'bead', delay: 0.13, spin: 0 },
  { angle: deg(31), distance: 37, size: 7.8, tint: 'deepGold', shape: 'leaf', delay: 0.04, spin: -10 },
  { angle: deg(58), distance: 34, size: 5.2, tint: 'cream', shape: 'glint', delay: 0.08, spin: -12 },
  { angle: deg(90), distance: 41, size: 8.6, tint: 'lightGold', shape: 'ray', delay: 0.00, spin: 0 },
  { angle: deg(128), distance: 33, size: 4.4, tint: 'accent', shape: 'bead', delay: 0.15, spin: 0 },
  { angle: deg(164), distance: 39, size: 7.2, tint: 'lightGold', shape: 'ray', delay: 0.07, spin: -8 },
  { angle: deg(202), distance: 33, size: 5.4, tint: 'cream', shape: 'glint', delay: 0.12, spin: 14 },
  { angle: deg(238), distance: 36, size: 7.8, tint: 'deepGold', shape: 'leaf', delay: 0.05, spin: -11 },
  { angle: deg(302), distance: 36, size: 7.8, tint: 'deepGold', shape: 'leaf', delay: 0.05, spin: 11 },
];

function ParticleGlyph({
  shape,
  color,
  accent,
}: {
  shape: ParticleShape;
  color: string;
  accent: string;
}) {
  if (shape === 'ray') {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 12 28">
        <Path d="M6 1.4 C8.1 7.8 8.1 20.2 6 26.6 C3.9 20.2 3.9 7.8 6 1.4 Z" fill={color} />
        <Path d="M6 4.2 C6.8 9.8 6.8 17.6 6 23.2" stroke={accent} strokeWidth={1.1} strokeLinecap="round" opacity={0.58} />
      </Svg>
    );
  }
  if (shape === 'glint') {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 18 18">
        <Path d="M9 1.4 C10.9 5.5 12.4 7.1 16.6 9 C12.4 10.9 10.9 12.5 9 16.6 C7.1 12.5 5.6 10.9 1.4 9 C5.6 7.1 7.1 5.5 9 1.4 Z" fill={color} />
        <Path d="M9 4.5 C10 6.7 11 7.8 13.2 8.9 C11 10 10 11.1 9 13.3 C8 11.1 7 10 4.8 8.9 C7 7.8 8 6.7 9 4.5 Z" fill={accent} opacity={0.66} />
      </Svg>
    );
  }
  if (shape === 'leaf') {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 16 22">
        <Path d="M8 1.8 C13.1 5.9 13.3 14.2 8 20.2 C2.7 14.2 2.9 5.9 8 1.8 Z" fill={color} />
        <Path d="M8 5.1 C9 8.6 8.9 13.3 8 17.1" stroke={accent} strokeWidth={1.05} strokeLinecap="round" opacity={0.54} />
      </Svg>
    );
  }
  return (
    <Svg width="100%" height="100%" viewBox="0 0 14 14">
      <Circle cx={7} cy={7} r={5.2} fill={color} />
      <Circle cx={5.2} cy={4.7} r={1.45} fill={accent} opacity={0.72} />
    </Svg>
  );
}

function BurstParticle({
  angle,
  distance,
  size,
  color,
  shape,
  delay,
  spin,
  phase,
}: {
  angle: number;
  distance: number;
  size: number;
  color: string;
  shape: ParticleShape;
  delay: number;
  spin: number;
  phase: SharedValue<number>;
}) {
  const dx = Math.cos(angle) * distance;
  const dy = Math.sin(angle) * distance;
  const baseRotation = shape === 'ray' || shape === 'leaf' ? (angle * 180) / Math.PI + 90 : shape === 'glint' ? 45 : 0;

  const style = useAnimatedStyle(() => {
    const t = Math.max(0, Math.min(1, (phase.value - delay) / (1 - delay)));
    const eased = 1 - Math.pow(1 - t, 2.55);
    const opacity = t <= 0.01
      ? 0
      : t < 0.46
        ? 0.92
        : Math.max(0, 0.92 * (1 - (t - 0.46) / 0.54));
    const popScale = t < 0.14 ? t / 0.14 : Math.max(0.12, 1 - (t - 0.14) * 0.64);
    return {
      opacity,
      transform: [
        { translateX: dx * eased },
        { translateY: dy * eased },
        { rotate: `${baseRotation + spin * t}deg` },
        { scale: popScale },
      ],
    };
  });

  const glyphStyle = shape === 'ray'
    ? {
      width: size * 0.78,
      height: size * 2.1,
    }
    : shape === 'leaf'
      ? {
        width: size * 1.08,
        height: size * 1.55,
      }
    : {
      width: size,
      height: size,
    };

  return (
    <Reanimated.View
      style={[
        {
          position: 'absolute',
        },
        glyphStyle,
        style,
      ]}
    >
      <ParticleGlyph shape={shape} color={color} accent="#FFF7D8" />
    </Reanimated.View>
  );
}

function BurstRibbon({
  phase,
  color,
  side,
}: {
  phase: SharedValue<number>;
  color: string;
  side: 'left' | 'right';
}) {
  const ribbonStyle = useAnimatedStyle(() => {
    const t = Math.max(0, Math.min(1, (phase.value - 0.04) / 0.78));
    const opacity = t === 0
      ? 0
      : t < 0.3
        ? Math.min(0.74, t * 2.7)
        : Math.max(0, 0.74 - (t - 0.3) * 1.25);
    return {
      opacity,
      transform: [
        { rotate: side === 'left' ? `${-22 - t * 18}deg` : `${20 + t * 16}deg` },
        { scale: 0.72 + t * 0.38 },
      ],
    };
  });

  return (
    <Reanimated.View style={[s.ribbon, side === 'left' ? s.ribbonLeft : s.ribbonRight, ribbonStyle]}>
      <Svg width="100%" height="100%" viewBox="0 0 64 42">
        <Path
          d={side === 'left'
            ? 'M54 13 C37 2 17 9 9 27'
            : 'M10 13 C27 2 47 9 55 27'}
          fill="none"
          stroke={rgba(color, 0.62)}
          strokeWidth={3.1}
          strokeLinecap="round"
        />
        <Path
          d={side === 'left'
            ? 'M50 18 C35 11 21 15 14 29'
            : 'M14 18 C29 11 43 15 50 29'}
          fill="none"
          stroke="#FFF7D8"
          strokeWidth={1.35}
          strokeLinecap="round"
          opacity={0.78}
        />
      </Svg>
    </Reanimated.View>
  );
}

export function CompletionFlourish({
  done,
  color,
  layerStyle,
  unmountWhenSettled = false,
}: {
  done: boolean;
  color: string;
  layerStyle?: StyleProp<ViewStyle>;
  unmountWhenSettled?: boolean;
}) {
  if (!unmountWhenSettled) {
    return <CompletionFlourishAnimation done={done} color={color} layerStyle={layerStyle} />;
  }

  return <TransientCompletionFlourish done={done} color={color} layerStyle={layerStyle} />;
}

function TransientCompletionFlourish({
  done,
  color,
  layerStyle,
}: {
  done: boolean;
  color: string;
  layerStyle?: StyleProp<ViewStyle>;
}) {
  const [visual, setVisual] = useState(() => ({
    observedDone: done,
    run: 0,
    visible: false,
  }));

  // React's prop-derived state pattern lets the first completion frame mount
  // the visual immediately, while an initially completed task stays static.
  if (visual.observedDone !== done) {
    setVisual({
      observedDone: done,
      run: done ? visual.run + 1 : visual.run,
      visible: done,
    });
  }

  useEffect(() => {
    if (!visual.visible) return;
    const run = visual.run;
    const hideTimer = setTimeout(() => {
      setVisual(current => current.run === run
        ? { ...current, visible: false }
        : current);
    }, 1100);
    return () => clearTimeout(hideTimer);
  }, [visual.run, visual.visible]);

  // Once the pixels are transparent, keeping the SVG/worklet subtree mounted
  // only adds scroll compositing work to every settled task row.
  if (!visual.visible) return null;

  return <CompletionFlourishAnimation key={visual.run} color={color} layerStyle={layerStyle} />;
}

function CompletionFlourishAnimation({
  done,
  color,
  layerStyle,
}: {
  done?: boolean;
  color: string;
  layerStyle?: StyleProp<ViewStyle>;
}) {
  const phase = useSharedValue(0);
  const previousDone = useRef(done ?? false);

  useEffect(() => {
    if (done !== undefined) {
      const becameDone = previousDone.current !== done && done;
      previousDone.current = done;

      if (!becameDone) {
        if (!done) phase.value = withTiming(0, { duration: 90 });
        return;
      }
    }

    phase.value = 0;
    phase.value = withTiming(1, {
      duration: 980,
      easing: Easing.out(Easing.cubic),
    });

    return () => cancelAnimation(phase);
  }, [done, phase]);

  // Small central pop, brief and soft so the sparks stay visually dominant.
  const popStyle = useAnimatedStyle(() => {
    const t = phase.value;
    const opacity = t === 0
      ? 0
      : t < 0.22
        ? Math.min(0.42, t * 2.2)
        : Math.max(0, 0.42 - (t - 0.22) * 1.3);
    return {
      opacity,
      transform: [{ scale: 0.5 + t * 1.22 }],
    };
  });

  // Inner ring close to the check — bright, holds full opacity briefly.
  const tinyRingStyle = useAnimatedStyle(() => {
    const t = phase.value;
    const opacity = t === 0
      ? 0
      : t < 0.24
        ? Math.min(0.54, t * 2.6)
        : Math.max(0, 0.54 - (t - 0.24) * 1.65);
    return {
      opacity,
      transform: [{ scale: 0.58 + t * 0.86 }],
    };
  });

  const centerSparkStyle = useAnimatedStyle(() => {
    const t = phase.value;
    const opacity = t === 0
      ? 0
      : t < 0.2
        ? Math.min(0.82, t * 4.4)
        : Math.max(0, 0.82 - (t - 0.2) * 1.75);
    return {
      opacity,
      transform: [
        { rotate: `${-6 + t * 14}deg` },
        { scale: t < 0.2 ? 0.48 + t * 3.2 : Math.max(0.42, 1.05 - (t - 0.2) * 0.52) },
      ],
    };
  });

  return (
    <View pointerEvents="none" style={[s.flourishLayer, layerStyle]}>
      <Reanimated.View
        style={[s.popCore, { backgroundColor: rgba(color, 0.18), borderColor: rgba(color, 0.26) }, popStyle]}
      />
      <Reanimated.View
        style={[s.tinyRing, { borderColor: rgba(color, 0.58) }, tinyRingStyle]}
      />
      <BurstRibbon phase={phase} color={color} side="left" />
      <BurstRibbon phase={phase} color={color} side="right" />
      <Reanimated.View style={[s.centerSpark, centerSparkStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 48 48">
          <Circle cx={24} cy={24} r={17.5} fill="#FFF6DA" opacity={0.82} />
          <Circle cx={24} cy={24} r={15.2} fill="none" stroke={color} strokeWidth={1.4} opacity={0.58} />
          <Path
            d="M24 6.2 L28.1 17.8 L40.3 15.9 L31.9 24.9 L39 35 L27.3 31.2 L24 43 L20.7 31.2 L9 35 L16.1 24.9 L7.7 15.9 L19.9 17.8 Z"
            fill={color}
            opacity={0.78}
          />
          <Path
            d="M24 11.2 L26.4 19.8 L35 21.1 L28.5 26.7 L30.2 35.2 L24 30.8 L17.8 35.2 L19.5 26.7 L13 21.1 L21.6 19.8 Z"
            fill="#FFF2BC"
            opacity={0.88}
          />
          <Circle cx={24} cy={24} r={3.1} fill={color} opacity={0.9} />
          <Path d="M18.3 17.3 C21.7 15.6 27.1 15.9 30.4 17.9" fill="none" stroke="#FFF9DF" strokeWidth={2.1} strokeLinecap="round" opacity={0.68} />
        </Svg>
      </Reanimated.View>
      {PARTICLES.map((p, i) => (
        <BurstParticle
          key={i}
          angle={p.angle}
          distance={p.distance}
          size={p.size}
          color={p.tint === 'accent'
            ? color
            : p.tint === 'cream'
              ? '#FFF6DD'
              : p.tint === 'lightGold'
                ? '#F1C96D'
                : '#B9852F'}
          shape={p.shape}
          delay={p.delay}
          spin={p.spin}
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
  popCore: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
  },
  tinyRing: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
  },
  ribbon: {
    position: 'absolute',
    width: 64,
    height: 42,
  },
  ribbonLeft: {
    left: -24,
    top: -23,
  },
  ribbonRight: {
    right: -24,
    top: -23,
  },
  centerSpark: {
    position: 'absolute',
    width: 34,
    height: 34,
  },
});
