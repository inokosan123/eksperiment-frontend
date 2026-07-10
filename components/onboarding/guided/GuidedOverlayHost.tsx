import React, { useEffect, useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  ZoomIn,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { ChevronLeft, ChevronRight } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { useGuidedOverlayState, useGuidedSetup } from './GuidedSetupContext';
import type { GuidedGestureHint } from './types';

const APP_LOGO = require('@/assets/images/anasta-logo.png');
const DIM = 'rgba(17,13,9,0.74)';
const DIM_LIGHT = 'rgba(17,13,9,0.30)';
const MOTION = { duration: 400, easing: Easing.bezier(0.26, 1, 0.32, 1) };
const SOFT_EASE = Easing.bezier(0.16, 1, 0.28, 1);
const CUTOUT_RADIUS = 22;
const RING_GOLD = 'rgba(240,209,143,0.95)';

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Bolds the highlight phrases inside the serif message.
function renderMessage(message: string, highlights?: string[]) {
  if (!highlights || highlights.length === 0) return message;
  const pattern = new RegExp(`(${highlights.map(escapeRegExp).join('|')})`, 'g');
  return message.split(pattern).map((part, index) =>
    highlights.includes(part)
      ? <Text key={`strong-${index}`} style={o.messageStrong}>{part}</Text>
      : part
  );
}

function DimPanel({ style }: { style: object }) {
  return (
    <Reanimated.View
      entering={FadeIn.duration(280)}
      exiting={FadeOut.duration(220)}
      style={[o.dimPanel, style]}
    >
      <Pressable style={StyleSheet.absoluteFill} />
    </Reanimated.View>
  );
}

// ─── Gesture hints ───────────────────────────────────────────────────────────
// Looping demonstrations rendered in the middle of the spotlight so the user
// sees the gesture, not just reads about it.

function TapHintGraphic() {
  const cycle = useSharedValue(0);

  useEffect(() => {
    cycle.value = 0;
    cycle.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(cycle);
  }, [cycle]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(cycle.value, [0, 0.07, 0.18, 1], [1, 0.78, 1, 1], Extrapolation.CLAMP) },
    ],
  }));
  const ringAStyle = useAnimatedStyle(() => {
    const p = interpolate(cycle.value, [0.07, 0.72], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: interpolate(p, [0, 0.12, 1], [0, 0.62, 0], Extrapolation.CLAMP),
      transform: [{ scale: 0.42 + p * 1.2 }],
    };
  });
  const ringBStyle = useAnimatedStyle(() => {
    const p = interpolate(cycle.value, [0.24, 0.92], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: interpolate(p, [0, 0.12, 1], [0, 0.4, 0], Extrapolation.CLAMP),
      transform: [{ scale: 0.42 + p * 1.2 }],
    };
  });

  return (
    <View style={o.hintBox}>
      <Reanimated.View style={[o.hintRing, ringAStyle]} />
      <Reanimated.View style={[o.hintRing, ringBStyle]} />
      <Reanimated.View style={[o.hintDot, dotStyle]} />
    </View>
  );
}

function LongPressHintGraphic() {
  const cycle = useSharedValue(0);

  useEffect(() => {
    cycle.value = 0;
    // Press (0→0.55 is the hold), pop (0.55→0.72), rest, repeat.
    cycle.value = withRepeat(
      withSequence(
        withTiming(0.55, { duration: 1050, easing: Easing.linear }),
        withTiming(0.72, { duration: 260, easing: Easing.out(Easing.cubic) }),
        withDelay(680, withTiming(0, { duration: 1 })),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(cycle);
  }, [cycle]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(cycle.value, [0, 0.06, 0.55, 0.64, 0.72], [1, 0.8, 0.8, 1.08, 1], Extrapolation.CLAMP) },
    ],
  }));
  const holdRingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(cycle.value, [0, 0.05, 0.55, 0.72], [0, 0.9, 0.96, 0], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(cycle.value, [0, 0.55, 0.72], [0.5, 1, 1.34], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <View style={o.hintBox}>
      <View style={o.hintBaseRing} />
      <Reanimated.View style={[o.hintHoldRing, holdRingStyle]} />
      <Reanimated.View style={[o.hintDot, dotStyle]} />
    </View>
  );
}

function SwipeHintGraphic({ direction }: { direction: 1 | -1 }) {
  const cycle = useSharedValue(0);

  useEffect(() => {
    cycle.value = 0;
    cycle.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1250, easing: Easing.inOut(Easing.cubic) }),
        withDelay(430, withTiming(0, { duration: 1 })),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(cycle);
  }, [cycle]);

  const cometStyle = useAnimatedStyle(() => ({
    opacity: interpolate(cycle.value, [0, 0.12, 0.8, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(cycle.value, [0, 1], [-52, 52], Extrapolation.CLAMP) * direction },
    ],
  }));

  return (
    <View style={o.hintBox}>
      <Reanimated.View
        style={[
          o.hintComet,
          { flexDirection: direction === 1 ? 'row' : 'row-reverse' },
          cometStyle,
        ]}
      >
        <View style={[o.hintTrailDot, { width: 5, height: 5, opacity: 0.18 }]} />
        <View style={[o.hintTrailDot, { width: 7, height: 7, opacity: 0.32 }]} />
        <View style={[o.hintTrailDot, { width: 10, height: 10, opacity: 0.5 }]} />
        <View style={o.hintCometHead}>
          {direction === 1
            ? <ChevronRight s={12} c="#FFFFFF" w={3} />
            : <ChevronLeft s={12} c="#FFFFFF" w={3} />}
        </View>
      </Reanimated.View>
    </View>
  );
}

function GestureHintLayer({
  hint,
  anchor = 'center',
  offset,
  x,
  y,
  width,
  height,
}: {
  hint: GuidedGestureHint;
  anchor?: 'center' | 'left' | 'right' | 'corner';
  offset?: { x?: number; y?: number };
  x: SharedValue<number>;
  y: SharedValue<number>;
  width: SharedValue<number>;
  height: SharedValue<number>;
}) {
  const rectStyle = useAnimatedStyle(() => ({
    left: x.value,
    top: y.value,
    width: width.value,
    height: height.value,
  }));

  const offsetStyle = offset
    ? { transform: [{ translateX: offset.x ?? 0 }, { translateY: offset.y ?? 0 }] }
    : null;

  const graphic = (
    <View style={offsetStyle}>
      {hint === 'tap' && <TapHintGraphic />}
      {hint === 'long-press' && <LongPressHintGraphic />}
      {hint === 'swipe-right' && <SwipeHintGraphic direction={1} />}
      {hint === 'swipe-left' && <SwipeHintGraphic direction={-1} />}
    </View>
  );

  return (
    <Reanimated.View
      pointerEvents="none"
      style={[
        o.hintLayer,
        anchor === 'left' && o.hintLayerLeft,
        anchor === 'right' && o.hintLayerRight,
        rectStyle,
      ]}
    >
      {anchor === 'corner' ? (
        // Small targets (a plus, a check circle): the pulse kisses the
        // bottom-left corner instead of sitting on top of the glyph, so the
        // button itself stays fully readable.
        <View style={o.hintCornerBox}>{graphic}</View>
      ) : (
        graphic
      )}
    </Reanimated.View>
  );
}

// ─── Coach bubble pieces ─────────────────────────────────────────────────────

function LogoPlate() {
  const breath = useSharedValue(0);

  useEffect(() => {
    breath.value = 0;
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(breath);
  }, [breath]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.24 + breath.value * 0.3,
    transform: [{ scale: 1 + breath.value * 0.09 }],
  }));

  return (
    <Reanimated.View
      entering={ZoomIn.delay(40).springify().damping(14).stiffness(190).mass(0.7)}
      style={o.logoWrap}
    >
      <Reanimated.View style={[o.logoHalo, haloStyle]} />
      <Image source={APP_LOGO} style={o.logo} resizeMode="cover" />
      <View pointerEvents="none" style={o.logoRing} />
    </Reanimated.View>
  );
}

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={o.dotsRow}>
      {Array.from({ length: total }, (_, index) => {
        const step = index + 1;
        return (
          <View
            key={`dot-${index}`}
            style={[
              o.dot,
              step < current && o.dotDone,
              step === current && o.dotActive,
            ]}
          />
        );
      })}
    </View>
  );
}

function ActionPulseDot() {
  const cycle = useSharedValue(0);

  useEffect(() => {
    cycle.value = 0;
    cycle.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(cycle);
  }, [cycle]);

  const ringStyle = useAnimatedStyle(() => {
    const p = interpolate(cycle.value, [0.08, 0.8], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: interpolate(p, [0, 0.15, 1], [0, 0.55, 0], Extrapolation.CLAMP),
      transform: [{ scale: 0.5 + p * 0.85 }],
    };
  });
  const dotStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(cycle.value, [0, 0.08, 0.2, 1], [1, 0.78, 1, 1], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <View style={o.actionPulseBox}>
      <Reanimated.View style={[o.actionPulseRing, ringStyle]} />
      <Reanimated.View style={[o.actionPulseDot, dotStyle]} />
    </View>
  );
}

// ─── Celebration ─────────────────────────────────────────────────────────────
// A struck gold medal: expanding waves, a hand-drawn check stroke, and a
// scatter of gold diamonds — the ornament language of the rest of the app.

const AnimatedPath = Reanimated.createAnimatedComponent(Path);
const CHECK_PATH = 'M9 22 L18 31 L34 12';
const CHECK_PATH_LENGTH = 37;

const SPARK_JITTER = [4, -7, 3, -3, 6, -5, 2, -6, 5, -2];
const SPARKS = Array.from({ length: 10 }, (_, index) => {
  const angle = (Math.PI * 2 * index) / 10 - Math.PI / 2 + (SPARK_JITTER[index] * Math.PI) / 180;
  return {
    dx: Math.cos(angle),
    dy: Math.sin(angle),
    far: index % 2 === 0 ? 68 : 52,
    size: index % 2 === 0 ? 7 : 5,
  };
});

function CelebrationSpark({
  dx,
  dy,
  far,
  size,
  burst,
}: {
  dx: number;
  dy: number;
  far: number;
  size: number;
  burst: SharedValue<number>;
}) {
  const sparkStyle = useAnimatedStyle(() => {
    const radius = interpolate(burst.value, [0, 1], [12, far], Extrapolation.CLAMP);
    return {
      opacity: interpolate(burst.value, [0, 0.14, 0.78, 1], [0, 1, 0.85, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: dx * radius },
        { translateY: dy * radius },
        { rotate: '45deg' },
        { scale: interpolate(burst.value, [0, 1], [1, 0.25], Extrapolation.CLAMP) },
      ],
    };
  });
  return <Reanimated.View style={[o.successSpark, { width: size, height: size }, sparkStyle]} />;
}

function CelebrationBurst({ top }: { top: number }) {
  const burst = useSharedValue(0);
  const draw = useSharedValue(0);

  useEffect(() => {
    burst.value = 0;
    draw.value = 0;
    burst.value = withDelay(140, withTiming(1, { duration: 920, easing: Easing.out(Easing.cubic) }));
    draw.value = withDelay(300, withTiming(1, { duration: 440, easing: Easing.bezier(0.3, 0, 0.2, 1) }));
    return () => {
      cancelAnimation(burst);
      cancelAnimation(draw);
    };
  }, [burst, draw]);

  const checkProps = useAnimatedProps(() => ({
    strokeDashoffset: CHECK_PATH_LENGTH * (1 - draw.value),
  }));

  const waveAStyle = useAnimatedStyle(() => {
    const p = interpolate(burst.value, [0, 0.75], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: (1 - p) * 0.5,
      transform: [{ scale: 0.6 + p * 1.55 }],
    };
  });
  const waveBStyle = useAnimatedStyle(() => {
    const p = interpolate(burst.value, [0.18, 1], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: (1 - p) * 0.36,
      transform: [{ scale: 0.6 + p * 1.55 }],
    };
  });

  return (
    <View pointerEvents="none" style={[o.successWrap, { top }]}>
      <Reanimated.View style={[o.successWave, waveAStyle]} />
      <Reanimated.View style={[o.successWave, waveBStyle]} />
      {SPARKS.map((spark, index) => (
        <CelebrationSpark
          key={`spark-${index}`}
          dx={spark.dx}
          dy={spark.dy}
          far={spark.far}
          size={spark.size}
          burst={burst}
        />
      ))}
      <Reanimated.View entering={FadeIn.delay(60).duration(420)} style={o.successHalo} />
      <Reanimated.View
        entering={ZoomIn.delay(120).springify().damping(15).stiffness(170).mass(0.9)}
        style={o.successOuterRing}
      />
      <Reanimated.View
        entering={ZoomIn.delay(80).springify().damping(12).stiffness(185).mass(0.75)}
        style={o.successMedal}
      >
        <LinearGradient
          colors={['#EBCA82', '#C5A059', '#9E7A38']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={o.successMedalSheen} />
        <Svg width={44} height={44} viewBox="0 0 44 44">
          <AnimatedPath
            d={CHECK_PATH}
            stroke="#FFFFFF"
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={`${CHECK_PATH_LENGTH}`}
            animatedProps={checkProps}
          />
        </Svg>
      </Reanimated.View>
    </View>
  );
}

// ─── Host ────────────────────────────────────────────────────────────────────

export function GuidedOverlayHost() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { session } = useGuidedSetup();
  const { presentation, targetLayouts } = useGuidedOverlayState();
  const target = presentation?.targetId ? targetLayouts[presentation.targetId] : undefined;
  const padding = presentation?.cutoutPadding ?? 8;
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const breath = useSharedValue(0);
  const sonar = useSharedValue(0);
  const presentationKey = presentation?.key ?? null;

  useEffect(() => {
    if (!target) return;
    const nextX = Math.max(0, target.x - padding);
    const nextY = Math.max(0, target.y - padding);
    x.value = withTiming(nextX, MOTION);
    y.value = withTiming(nextY, MOTION);
    width.value = withTiming(Math.max(0, Math.min(screenWidth - nextX, target.width + padding * 2)), MOTION);
    height.value = withTiming(Math.max(0, Math.min(screenHeight - nextY, target.height + padding * 2)), MOTION);
  }, [height, padding, screenHeight, screenWidth, target, width, x, y]);

  // The spotlight breathes and sends out a quiet sonar ring — the eye is drawn
  // to the live part of the screen without a single written word.
  useEffect(() => {
    if (!presentationKey) return;
    breath.value = 0;
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    sonar.value = 0;
    sonar.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }),
        withDelay(650, withTiming(0, { duration: 1 })),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(breath);
      cancelAnimation(sonar);
    };
  }, [breath, presentationKey, sonar]);

  const topStyle = useAnimatedStyle(() => ({
    left: 0,
    right: 0,
    top: 0,
    height: y.value,
  }));
  const leftStyle = useAnimatedStyle(() => ({
    left: 0,
    top: y.value,
    width: x.value,
    height: height.value,
  }));
  const rightStyle = useAnimatedStyle(() => ({
    left: x.value + width.value,
    right: 0,
    top: y.value,
    height: height.value,
  }));
  const bottomStyle = useAnimatedStyle(() => ({
    left: 0,
    right: 0,
    top: y.value + height.value,
    bottom: 0,
  }));
  const cutoutStyle = useAnimatedStyle(() => ({
    left: x.value,
    top: y.value,
    width: width.value,
    height: height.value,
  }));
  const ringStyle = useAnimatedStyle(() => ({
    left: x.value,
    top: y.value,
    width: width.value,
    height: height.value,
    borderRadius: Math.min(CUTOUT_RADIUS, width.value / 2, height.value / 2),
    opacity: 0.55 + breath.value * 0.45,
  }));
  const sonarStyle = useAnimatedStyle(() => ({
    left: x.value,
    top: y.value,
    width: width.value,
    height: height.value,
    borderRadius: Math.min(CUTOUT_RADIUS, width.value / 2, height.value / 2) + 2,
    opacity: interpolate(sonar.value, [0, 0.1, 1], [0, 0.5, 0], Extrapolation.CLAMP),
    transform: [{ scale: 1 + sonar.value * 0.06 }],
  }));

  // Rounded cutout corners. Each corner is a small clipped patch holding a
  // transparent-core "donut": the ring's inner hole traces the exact corner
  // arc, so the dim fills only the sliver OUTSIDE the arc — never a dark
  // quarter-disc poking into the light area.
  const topLeftCornerStyle = useAnimatedStyle(() => {
    const r = Math.min(CUTOUT_RADIUS, width.value / 2, height.value / 2);
    return { left: x.value, top: y.value, width: r, height: r };
  });
  const topLeftDonutStyle = useAnimatedStyle(() => {
    const r = Math.min(CUTOUT_RADIUS, width.value / 2, height.value / 2);
    const t = r * 0.5 + 2;
    return { left: -t, top: -t, width: (r + t) * 2, height: (r + t) * 2, borderRadius: r + t, borderWidth: t };
  });
  const topRightCornerStyle = useAnimatedStyle(() => {
    const r = Math.min(CUTOUT_RADIUS, width.value / 2, height.value / 2);
    return { left: x.value + width.value - r, top: y.value, width: r, height: r };
  });
  const topRightDonutStyle = useAnimatedStyle(() => {
    const r = Math.min(CUTOUT_RADIUS, width.value / 2, height.value / 2);
    const t = r * 0.5 + 2;
    return { left: -(r + t), top: -t, width: (r + t) * 2, height: (r + t) * 2, borderRadius: r + t, borderWidth: t };
  });
  const bottomLeftCornerStyle = useAnimatedStyle(() => {
    const r = Math.min(CUTOUT_RADIUS, width.value / 2, height.value / 2);
    return { left: x.value, top: y.value + height.value - r, width: r, height: r };
  });
  const bottomLeftDonutStyle = useAnimatedStyle(() => {
    const r = Math.min(CUTOUT_RADIUS, width.value / 2, height.value / 2);
    const t = r * 0.5 + 2;
    return { left: -t, top: -(r + t), width: (r + t) * 2, height: (r + t) * 2, borderRadius: r + t, borderWidth: t };
  });
  const bottomRightCornerStyle = useAnimatedStyle(() => {
    const r = Math.min(CUTOUT_RADIUS, width.value / 2, height.value / 2);
    return { left: x.value + width.value - r, top: y.value + height.value - r, width: r, height: r };
  });
  const bottomRightDonutStyle = useAnimatedStyle(() => {
    const r = Math.min(CUTOUT_RADIUS, width.value / 2, height.value / 2);
    const t = r * 0.5 + 2;
    return { left: -(r + t), top: -(r + t), width: (r + t) * 2, height: (r + t) * 2, borderRadius: r + t, borderWidth: t };
  });

  const hasCta = Boolean(presentation?.ctaLabel && presentation?.onCta);
  const celebrateTop = Math.max(insets.top + 76, screenHeight * 0.22);

  // Small square-ish targets (a plus, a check circle) get the tap pulse on
  // their bottom-left corner so the glyph itself stays fully visible; an
  // explicit hintAnchor always wins.
  const hintAnchor: 'center' | 'left' | 'right' | 'corner' = useMemo(() => {
    if (presentation?.hintAnchor) return presentation.hintAnchor;
    if (
      presentation?.hint === 'tap' &&
      target &&
      target.width + padding * 2 < 100 &&
      target.height + padding * 2 < 100
    ) {
      return 'corner';
    }
    return 'center';
  }, [padding, presentation?.hint, presentation?.hintAnchor, target]);

  const bubbleStyle = useMemo(() => {
    if (presentation?.celebrate) {
      return { top: Math.max(celebrateTop + 168, screenHeight * 0.46) };
    }
    if (presentation?.placement === 'bottom') {
      return { bottom: insets.bottom + (hasCta ? 118 : 44) };
    }
    if (!target || presentation?.placement === 'center') {
      return { top: Math.max(insets.top + 72, screenHeight * 0.26) };
    }
    if (presentation?.placement === 'above') {
      return { bottom: Math.max(insets.bottom + 24, screenHeight - target.y + 24) };
    }
    return {
      top: Math.min(
        screenHeight - (hasCta ? 264 : 216),
        target.y + target.height + padding + 18,
      ),
    };
  }, [celebrateTop, hasCta, insets.bottom, insets.top, padding, presentation?.celebrate, presentation?.placement, screenHeight, target]);

  const coachEntering = useMemo(() => (
    presentation?.placement === 'above' || presentation?.placement === 'bottom'
      ? FadeInUp.springify().damping(17).stiffness(210).mass(0.8)
      : FadeInDown.springify().damping(17).stiffness(210).mass(0.8)
  ), [presentation?.placement]);

  if (!session?.active || !presentation) return null;

  const chips = presentation.chips ?? [];
  const showHeader = Boolean(presentation.eyebrow || presentation.progress);

  return (
    <View pointerEvents="box-none" style={o.layer}>
      {target ? (
        <>
          <DimPanel style={topStyle} />
          <DimPanel style={leftStyle} />
          <DimPanel style={rightStyle} />
          <DimPanel style={bottomStyle} />
          <Reanimated.View pointerEvents="none" entering={FadeIn.duration(280)} exiting={FadeOut.duration(220)} style={[o.cornerPatch, topLeftCornerStyle]}>
            <Reanimated.View style={[o.cornerDonut, topLeftDonutStyle]} />
          </Reanimated.View>
          <Reanimated.View pointerEvents="none" entering={FadeIn.duration(280)} exiting={FadeOut.duration(220)} style={[o.cornerPatch, topRightCornerStyle]}>
            <Reanimated.View style={[o.cornerDonut, topRightDonutStyle]} />
          </Reanimated.View>
          <Reanimated.View pointerEvents="none" entering={FadeIn.duration(280)} exiting={FadeOut.duration(220)} style={[o.cornerPatch, bottomLeftCornerStyle]}>
            <Reanimated.View style={[o.cornerDonut, bottomLeftDonutStyle]} />
          </Reanimated.View>
          <Reanimated.View pointerEvents="none" entering={FadeIn.duration(280)} exiting={FadeOut.duration(220)} style={[o.cornerPatch, bottomRightCornerStyle]}>
            <Reanimated.View style={[o.cornerDonut, bottomRightDonutStyle]} />
          </Reanimated.View>
          <Reanimated.View
            pointerEvents="none"
            entering={FadeIn.duration(320)}
            exiting={FadeOut.duration(200)}
            style={[o.sonarRing, sonarStyle]}
          />
          <Reanimated.View
            pointerEvents="none"
            entering={FadeIn.duration(320)}
            exiting={FadeOut.duration(200)}
            style={[o.cutoutRing, ringStyle]}
          />
          {presentation.allowTargetInteraction === false && (
            <Reanimated.View style={[o.cutoutBlocker, cutoutStyle]}>
              <Pressable style={StyleSheet.absoluteFill} />
            </Reanimated.View>
          )}
          {presentation.hint ? (
            <GestureHintLayer
              key={`${presentation.key}-hint`}
              hint={presentation.hint}
              anchor={hintAnchor}
              offset={presentation.hintOffset}
              x={x}
              y={y}
              width={width}
              height={height}
            />
          ) : null}
        </>
      ) : (
        <Reanimated.View
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(220)}
          style={[o.fullDim, presentation.lightScrim && o.fullDimLight]}
        >
          <Pressable style={StyleSheet.absoluteFill} />
        </Reanimated.View>
      )}

      {presentation.celebrate && (
        <CelebrationBurst key={`${presentation.key}-success`} top={celebrateTop} />
      )}

      <Reanimated.View
        key={presentation.key}
        entering={coachEntering}
        exiting={FadeOut.duration(220)}
        style={[o.coach, bubbleStyle]}
      >
        <LogoPlate />
        <View style={o.bubble}>
          {showHeader && (
            <Reanimated.View entering={FadeIn.delay(140).duration(320)} style={o.bubbleHeader}>
              <Text style={o.eyebrow}>{presentation.eyebrow ?? 'ANASTA'}</Text>
              {presentation.progress ? (
                <ProgressDots current={presentation.progress.current} total={presentation.progress.total} />
              ) : null}
            </Reanimated.View>
          )}
          <Reanimated.View entering={FadeIn.delay(200).duration(360)}>
            <Text style={o.message}>{renderMessage(presentation.message, presentation.highlights)}</Text>
          </Reanimated.View>
          {chips.length > 0 && (
            <View style={o.chipRow}>
              {chips.map((chip, index) => (
                <Reanimated.View
                  key={chip}
                  entering={FadeInDown.delay(300 + index * 75).duration(320).easing(SOFT_EASE)}
                  style={o.chip}
                >
                  <View style={o.chipDot} />
                  <Text style={o.chipText}>{chip}</Text>
                </Reanimated.View>
              ))}
            </View>
          )}
          {presentation.action ? (
            <Reanimated.View
              entering={FadeIn.delay(chips.length > 0 ? 460 : 300).duration(340)}
              style={o.actionRow}
            >
              <ActionPulseDot />
              <Text style={o.actionText}>{presentation.action}</Text>
            </Reanimated.View>
          ) : null}
        </View>
      </Reanimated.View>

      {hasCta && (
        <Reanimated.View
          entering={FadeInUp.delay(340).duration(430).easing(SOFT_EASE)}
          style={[o.ctaWrap, { bottom: insets.bottom + 20 }]}
        >
          {/* Same frosted island the rest of onboarding wraps its buttons in. */}
          <View style={o.ctaIsland}>
            <TouchableOpacity activeOpacity={0.9} haptic="medium" onPress={presentation.onCta} style={o.cta}>
              <Text style={o.ctaText}>{presentation.ctaLabel}</Text>
              <ChevronRight s={19} c="rgba(255,255,255,0.92)" w={2.5} />
            </TouchableOpacity>
            {presentation.secondaryCtaLabel && presentation.onSecondaryCta && (
              <TouchableOpacity
                activeOpacity={0.84}
                haptic="light"
                onPress={presentation.onSecondaryCta}
                style={o.secondaryCta}
              >
                <Text style={o.secondaryCtaText}>{presentation.secondaryCtaLabel}</Text>
              </TouchableOpacity>
            )}
          </View>
        </Reanimated.View>
      )}
    </View>
  );
}

const o = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  dimPanel: {
    position: 'absolute',
    backgroundColor: DIM,
  },
  fullDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: DIM,
  },
  fullDimLight: {
    backgroundColor: DIM_LIGHT,
  },
  cutoutRing: {
    position: 'absolute',
    borderRadius: CUTOUT_RADIUS,
    borderWidth: 1.6,
    borderColor: RING_GOLD,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
  },
  sonarRing: {
    position: 'absolute',
    borderRadius: CUTOUT_RADIUS + 2,
    borderWidth: 1.5,
    borderColor: 'rgba(240,209,143,0.8)',
  },
  cutoutBlocker: {
    position: 'absolute',
    borderRadius: CUTOUT_RADIUS,
  },
  cornerPatch: {
    position: 'absolute',
    overflow: 'hidden',
  },
  cornerDonut: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderColor: DIM,
  },

  // Gesture hints
  hintLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintLayerLeft: {
    alignItems: 'flex-start',
  },
  hintLayerRight: {
    alignItems: 'flex-end',
  },
  hintCornerBox: {
    position: 'absolute',
    left: -36,
    bottom: -36,
  },
  hintBox: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintRing: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(240,209,143,0.92)',
  },
  hintBaseRing: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: 'rgba(240,209,143,0.3)',
  },
  hintHoldRing: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2.5,
    borderColor: 'rgba(240,209,143,0.95)',
  },
  hintDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.gold,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 4,
  },
  hintComet: {
    alignItems: 'center',
    columnGap: 4,
  },
  hintTrailDot: {
    borderRadius: 6,
    backgroundColor: '#F0D18F',
  },
  hintCometHead: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.gold,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 4,
  },

  // Celebration
  successWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successWave: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1.5,
    borderColor: 'rgba(240,209,143,0.9)',
  },
  successSpark: {
    position: 'absolute',
    borderRadius: 1.5,
    backgroundColor: '#E9C87E',
  },
  successHalo: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: 'rgba(197,160,89,0.13)',
  },
  successOuterRing: {
    position: 'absolute',
    width: 106,
    height: 106,
    borderRadius: 53,
    borderWidth: 1.2,
    borderColor: 'rgba(240,209,143,0.6)',
  },
  successMedal: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#FFF6DE',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.38,
    shadowRadius: 22,
    elevation: 8,
  },
  successMedalSheen: {
    position: 'absolute',
    top: 7,
    left: 18,
    right: 18,
    height: 15,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.26)',
  },

  // Coach
  coach: {
    position: 'absolute',
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: 10,
  },
  logoWrap: {
    width: 56,
    height: 56,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 4,
  },
  logoHalo: {
    position: 'absolute',
    width: 74,
    height: 74,
    borderRadius: 26,
    backgroundColor: 'rgba(197,160,89,0.2)',
  },
  // The mark is a full-bleed app icon: never pad it inside a plate.
  logo: {
    width: 56,
    height: 56,
    borderRadius: 19,
  },
  logoRing: {
    position: 'absolute',
    left: -3.5,
    right: -3.5,
    top: -3.5,
    bottom: -3.5,
    borderRadius: 22.5,
    borderWidth: 1.5,
    borderColor: 'rgba(240,209,143,0.75)',
  },
  bubble: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: '#FFFDF7',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.32)',
    shadowColor: '#3E2F14',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 6,
  },
  bubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  eyebrow: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 2,
    color: '#9C7B3C',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 5,
  },
  dot: {
    width: 5.5,
    height: 5.5,
    borderRadius: 3,
    backgroundColor: 'rgba(25,23,20,0.14)',
  },
  dotDone: {
    backgroundColor: 'rgba(197,160,89,0.55)',
  },
  dotActive: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: C.gold,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  message: {
    fontFamily: F.serifMedium,
    fontSize: 17.5,
    lineHeight: 23.5,
    textAlign: 'left',
    color: '#3E382F',
  },
  messageStrong: {
    fontFamily: F.serifSemiBold,
    color: '#15120F',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    minHeight: 26,
    borderRadius: 999,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(197,160,89,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.24)',
  },
  chipDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.gold,
  },
  chipText: {
    fontFamily: F.sansSemiBold,
    fontSize: 11,
    color: '#5E5342',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(197,160,89,0.22)',
  },
  actionPulseBox: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPulseRing: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: C.gold,
  },
  actionPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.gold,
  },
  actionText: {
    flex: 1,
    fontFamily: F.sansSemiBold,
    fontSize: 12.5,
    lineHeight: 17,
    letterSpacing: 0.2,
    color: '#15120F',
  },

  // CTAs
  ctaWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
  ctaIsland: {
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
    alignItems: 'stretch',
    padding: 5,
    gap: 5,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.54)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 4,
  },
  cta: {
    minHeight: 53,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
    borderRadius: 18,
    backgroundColor: '#15120F',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.96)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 5,
  },
  ctaText: {
    fontFamily: F.serifSemiBold,
    fontSize: 16.5,
    lineHeight: 20,
    color: '#FFFFFF',
  },
  secondaryCta: {
    minHeight: 51,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255,252,246,0.97)',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.4)',
  },
  secondaryCtaText: {
    fontFamily: F.serifSemiBold,
    fontSize: 16,
    color: '#3E382F',
  },
});
