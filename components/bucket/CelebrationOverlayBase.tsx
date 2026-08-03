import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import LottieView from 'lottie-react-native';
import Reanimated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Path, Pattern, Rect } from 'react-native-svg';
import { X } from '@/components/icons/Icons';
import { F } from '@/constants/tokens';
import { CHALLENGE_TROPHY_SOURCE } from '@/components/challenges/ChallengeTrophy';
import FallingConfetti, {
  GloryRays,
  ParticleGlyph,
  VeilBloom,
  type ParticleShape,
} from './CelebrationConfetti';

const GOLD = '#C5A059';
const DEEP_GOLD = '#A9782C';
const CREAM = '#FFF7DF';
const ROSE = '#EFB3A7';
const SKY = '#A9CFD3';
const CARD_VISUAL_HEIGHT = 254;
const CARD_ICON_CENTER_Y = 68;
const TROPHY_ARRIVAL_START_FRAME = 0;
const TROPHY_ARRIVAL_END_FRAME = 99;
const TROPHY_EXIT_START_FRAME = 100;
const TROPHY_EXIT_END_FRAME = 119;
const TROPHY_EXIT_DURATION_MS = 760;

type ParticleConfig = {
  angle: number;
  distance: number;
  size: number;
  delay: number;
  spin: number;
  color: string;
  shape: ParticleShape;
};

function deg(value: number) {
  return (value * Math.PI) / 180;
}

const PARTICLES: ParticleConfig[] = [
  { angle: deg(-94), distance: 154, size: 15, delay: 0.00, spin: -18, color: CREAM, shape: 'ray' },
  { angle: deg(-78), distance: 126, size: 9, delay: 0.04, spin: 28, color: GOLD, shape: 'diamond' },
  { angle: deg(-58), distance: 167, size: 12, delay: 0.02, spin: 34, color: ROSE, shape: 'leaf' },
  { angle: deg(-42), distance: 118, size: 7, delay: 0.12, spin: -20, color: CREAM, shape: 'dot' },
  { angle: deg(-26), distance: 163, size: 18, delay: 0.05, spin: 42, color: SKY, shape: 'ribbon' },
  { angle: deg(-10), distance: 126, size: 8, delay: 0.10, spin: -16, color: GOLD, shape: 'diamond' },
  { angle: deg(9), distance: 171, size: 12, delay: 0.03, spin: 22, color: CREAM, shape: 'ray' },
  { angle: deg(27), distance: 143, size: 10, delay: 0.08, spin: -32, color: DEEP_GOLD, shape: 'leaf' },
  { angle: deg(47), distance: 179, size: 16, delay: 0.02, spin: 36, color: ROSE, shape: 'ribbon' },
  { angle: deg(65), distance: 127, size: 7, delay: 0.15, spin: 18, color: GOLD, shape: 'dot' },
  { angle: deg(84), distance: 159, size: 12, delay: 0.05, spin: -24, color: CREAM, shape: 'diamond' },
  { angle: deg(103), distance: 133, size: 8, delay: 0.11, spin: 18, color: SKY, shape: 'dot' },
  { angle: deg(122), distance: 172, size: 15, delay: 0.04, spin: -34, color: GOLD, shape: 'ray' },
  { angle: deg(142), distance: 125, size: 10, delay: 0.09, spin: 28, color: ROSE, shape: 'leaf' },
  { angle: deg(163), distance: 165, size: 17, delay: 0.03, spin: -42, color: CREAM, shape: 'ribbon' },
  { angle: deg(184), distance: 134, size: 7, delay: 0.13, spin: 20, color: GOLD, shape: 'dot' },
  { angle: deg(204), distance: 174, size: 13, delay: 0.02, spin: -28, color: DEEP_GOLD, shape: 'diamond' },
  { angle: deg(225), distance: 123, size: 10, delay: 0.10, spin: 31, color: SKY, shape: 'leaf' },
  { angle: deg(244), distance: 164, size: 14, delay: 0.04, spin: -25, color: CREAM, shape: 'ray' },
  { angle: deg(263), distance: 132, size: 8, delay: 0.14, spin: 18, color: ROSE, shape: 'dot' },
  { angle: deg(282), distance: 176, size: 16, delay: 0.03, spin: 39, color: GOLD, shape: 'ribbon' },
  { angle: deg(303), distance: 121, size: 9, delay: 0.08, spin: -27, color: CREAM, shape: 'diamond' },
  { angle: deg(323), distance: 168, size: 12, delay: 0.01, spin: 30, color: SKY, shape: 'leaf' },
  { angle: deg(343), distance: 137, size: 8, delay: 0.12, spin: -18, color: DEEP_GOLD, shape: 'dot' },
];

// Journal opens this overlay immediately after a feature-heavy editor has
// unmounted. Ten well-spaced particles preserve the celebration silhouette
// while avoiding a burst of 24 animated SVG mounts during that handoff.
const LIGHT_PARTICLES = PARTICLES.filter((_, index) => (
  [0, 2, 4, 7, 9, 12, 15, 18, 21, 23].includes(index)
));

// The burst's job is the pop at zero. Now that paper falls across the whole
// screen for the whole visit, the duration is carried there — so the ring keeps
// its silhouette on fourteen pieces instead of twenty-four, and the two systems
// together cost less than the old one did alone.
const BURST_PARTICLES = PARTICLES.filter((_, index) => (
  [0, 2, 3, 5, 6, 8, 10, 12, 14, 16, 18, 20, 21, 23].includes(index)
));

function clamp01(value: number) {
  'worklet';
  return Math.max(0, Math.min(1, value));
}

function ConfettiParticle({
  config,
  phase,
}: {
  config: ParticleConfig;
  phase: SharedValue<number>;
}) {
  const width = config.shape === 'ribbon' ? config.size * 2.35 : config.shape === 'ray' ? config.size * 0.72 : config.size;
  const height = config.shape === 'ribbon' ? config.size : config.shape === 'ray' ? config.size * 2.05 : config.shape === 'leaf' ? config.size * 1.48 : config.size;
  const baseRotation = config.shape === 'ray' || config.shape === 'leaf'
    ? (config.angle * 180) / Math.PI + 90
    : config.shape === 'ribbon'
      ? (config.angle * 180) / Math.PI * 0.22
      : 0;

  const particleStyle = useAnimatedStyle(() => {
    const t = clamp01((phase.value - config.delay) / (1 - config.delay));
    const easeOut = 1 - Math.pow(1 - t, 3.1);
    const hang = t < 0.72 ? 0 : (t - 0.72) / 0.28;
    const opacity = t <= 0.01
      ? 0
      : t < 0.18
        ? t / 0.18
        : t < 0.72
          ? 1
          : Math.max(0, 1 - hang);
    const scale = t < 0.12 ? 0.35 + t * 5.5 : Math.max(0.42, 1 - hang * 0.36);

    return {
      opacity,
      transform: [
        { translateX: Math.cos(config.angle) * config.distance * easeOut },
        { translateY: Math.sin(config.angle) * config.distance * easeOut + hang * 18 },
        { rotate: `${baseRotation + config.spin * t}deg` },
        { scale },
      ],
    };
  });

  return (
    <Reanimated.View
      pointerEvents="none"
      style={[
        s.particle,
        {
          width,
          height,
          marginLeft: -width / 2,
          marginTop: -height / 2,
        },
        particleStyle,
      ]}
    >
      <ParticleGlyph shape={config.shape} color={config.color} />
    </Reanimated.View>
  );
}

// The card's ground is parchment, not paper: the same faint diagonal weave the
// lit cards across the app wear, so the celebration is cut from the app's own
// material instead of arriving as a white box.
function CardWeave() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="celebration-weave" width={30} height={30} patternUnits="userSpaceOnUse">
            <Path d="M 0 30 L 30 0" stroke={DEEP_GOLD} strokeOpacity={0.05} strokeWidth={1} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#celebration-weave)" />
      </Svg>
    </View>
  );
}

// A band of light crossing the card once, the moment it lands. It is what makes
// a struck surface read as struck rather than printed.
function CardSheen({ phase }: { phase: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const t = phase.value;
    return {
      opacity: t < 0.08 ? 0 : t < 0.3 ? (t - 0.08) / 0.22 : Math.max(0, 1 - (t - 0.3) / 0.5),
      transform: [
        { rotate: '-18deg' },
        { translateX: -240 + t * 620 },
      ],
    };
  });

  return (
    <Reanimated.View pointerEvents="none" style={[s.sheen, style]}>
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,252,238,0.86)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Reanimated.View>
  );
}

// The divider under the title. A solid gold bar was the one blunt thing on the
// card; this is the app's own rule — two lines fading outward from a struck
// diamond, the way an engraved page separates a title from its text.
function TitleRule() {
  return (
    <View style={s.rule} pointerEvents="none">
      <LinearGradient
        colors={['rgba(197,160,89,0)', 'rgba(197,160,89,0.85)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.ruleLine}
      />
      <Svg width={13} height={13} viewBox="0 0 13 13">
        <Path d="M6.5 0.6 L12.4 6.5 L6.5 12.4 L0.6 6.5 Z" fill={GOLD} />
        <Path d="M6.5 3.1 L9.9 6.5 L6.5 9.9 L3.1 6.5 Z" fill="#FFF6DC" />
      </Svg>
      <LinearGradient
        colors={['rgba(197,160,89,0.85)', 'rgba(197,160,89,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.ruleLine}
      />
    </View>
  );
}

function CelebrationRings({ phase }: { phase: SharedValue<number> }) {
  const haloStyle = useAnimatedStyle(() => {
    const t = phase.value;
    return {
      opacity: t < 0.72 ? Math.max(0, 0.3 - t * 0.22) : 0,
      transform: [{ scale: 0.58 + t * 1.05 }],
    };
  });

  const ringStyle = useAnimatedStyle(() => {
    const t = phase.value;
    const opacity = t < 0.55 ? Math.min(0.48, t * 1.55) : Math.max(0, 0.48 - (t - 0.55) * 1.1);
    return {
      opacity,
      transform: [{ scale: 0.68 + t * 1.34 }],
    };
  });

  const innerStyle = useAnimatedStyle(() => {
    const t = phase.value;
    const opacity = t < 0.48 ? Math.min(0.58, t * 1.9) : Math.max(0, 0.58 - (t - 0.48) * 1.25);
    return {
      opacity,
      transform: [{ scale: 0.52 + t * 0.82 }],
    };
  });

  return (
    <>
      <Reanimated.View style={[s.halo, haloStyle]} />
      <Reanimated.View style={[s.outerRing, ringStyle]} />
      <Reanimated.View style={[s.innerRing, innerStyle]} />
    </>
  );
}

function CenterSpark({ phase }: { phase: SharedValue<number> }) {
  const sparkStyle = useAnimatedStyle(() => {
    const t = phase.value;
    const opacity = t < 0.18
      ? t / 0.18
      : t < 0.64
        ? 1
        : Math.max(0, 1 - (t - 0.64) / 0.36);

    return {
      opacity,
      transform: [
        { rotate: `${-8 + t * 18}deg` },
        { scale: t < 0.2 ? 0.54 + t * 2.8 : Math.max(0.5, 1.1 - (t - 0.2) * 0.5) },
      ],
    };
  });

  return (
    <Reanimated.View pointerEvents="none" style={[s.centerSpark, sparkStyle]}>
      <Svg width="100%" height="100%" viewBox="0 0 58 58">
        <Circle cx={29} cy={29} r={20.5} fill="#FFF6DC" opacity={0.92} />
        <Circle cx={29} cy={29} r={17.8} fill="none" stroke={GOLD} strokeWidth={1.7} opacity={0.58} />
        <Path
          d="M29 5.5 L33.6 20.4 L49.2 18.1 L38.5 29.4 L47.7 42.4 L32.7 37.4 L29 52.5 L25.3 37.4 L10.3 42.4 L19.5 29.4 L8.8 18.1 L24.4 20.4 Z"
          fill={GOLD}
          opacity={0.86}
        />
        <Path
          d="M29 12 L31.9 22.5 L42.2 24.1 L34.5 31 L36.7 41.4 L29 36 L21.3 41.4 L23.5 31 L15.8 24.1 L26.1 22.5 Z"
          fill="#FFF3BF"
          opacity={0.9}
        />
      </Svg>
    </Reanimated.View>
  );
}

export default function CelebrationOverlayBase({
  onClose,
  title = 'Congratulations!',
  subtitleStrong = 'Dream achieved!',
  subtitle = 'Keep building your bucket list and chasing your dreams!',
  visual,
  motionProfile = 'full',
}: {
  onClose: () => void;
  // Optional copy overrides so other features (e.g. Focus milestones) can
  // reuse this exact celebration without touching the bucket-list defaults.
  title?: string;
  subtitleStrong?: string;
  subtitle?: string;
  visual?: React.ReactNode;
  motionProfile?: 'full' | 'light';
}) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const lottieRef = useRef<LottieView>(null);
  // The one render this overlay does after mounting: it tells the falling
  // field to fade out rather than blink off with the card.
  const [dismissing, setDismissing] = useState(false);
  const closingRef = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const veil = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const cardLift = useSharedValue(12);
  const cardScale = useSharedValue(0.96);
  const burst = useSharedValue(0);
  const iconPhase = useSharedValue(0);
  const lightMotion = motionProfile === 'light';
  const particles = lightMotion ? LIGHT_PARTICLES : BURST_PARTICLES;

  useEffect(() => {
    closingRef.current = false;
    if (lightMotion) {
      veil.value = withTiming(1, {
        duration: 150,
        easing: Easing.out(Easing.quad),
      });
      cardOpacity.value = withDelay(16, withTiming(1, {
        duration: 190,
        easing: Easing.out(Easing.cubic),
      }));
      cardLift.value = withTiming(0, {
        duration: 360,
        easing: Easing.bezier(0.16, 1, 0.28, 1),
      });
      cardScale.value = withTiming(1, {
        duration: 360,
        easing: Easing.bezier(0.16, 1, 0.28, 1),
      });
      iconPhase.value = withDelay(52, withTiming(1, {
        duration: 520,
        easing: Easing.out(Easing.cubic),
      }));
      burst.value = withDelay(48, withTiming(1, {
        duration: 1120,
        easing: Easing.out(Easing.cubic),
      }));
    } else {
    veil.value = withTiming(1, {
      duration: 120,
      easing: Easing.out(Easing.quad),
    });
    cardOpacity.value = withTiming(1, {
      duration: 135,
      easing: Easing.out(Easing.quad),
    });
    cardLift.value = withSpring(0, {
      damping: 17,
      stiffness: 245,
      mass: 0.72,
    });
    cardScale.value = withSpring(1, {
      damping: 16,
      stiffness: 230,
      mass: 0.7,
    });
    iconPhase.value = withDelay(45, withTiming(1, {
      duration: 680,
      easing: Easing.out(Easing.cubic),
    }));
    burst.value = withDelay(35, withTiming(1, {
      duration: 1560,
      easing: Easing.out(Easing.cubic),
    }));
    }

    const playTimer = setTimeout(() => {
      lottieRef.current?.reset();
      lottieRef.current?.play(TROPHY_ARRIVAL_START_FRAME, TROPHY_ARRIVAL_END_FRAME);
    }, 45);

    return () => {
      clearTimeout(playTimer);
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [burst, cardLift, cardOpacity, cardScale, iconPhase, lightMotion, veil]);

  const handleDismiss = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setDismissing(true);

    if (lightMotion) {
      cancelAnimation(burst);
      cancelAnimation(iconPhase);
      burst.value = withTiming(1, {
        duration: 160,
        easing: Easing.out(Easing.quad),
      });
      iconPhase.value = withTiming(0, {
        duration: 180,
        easing: Easing.in(Easing.quad),
      });
      cardLift.value = withTiming(-8, {
        duration: 260,
        easing: Easing.inOut(Easing.cubic),
      });
      cardScale.value = withTiming(0.985, {
        duration: 240,
        easing: Easing.in(Easing.quad),
      });
      cardOpacity.value = withDelay(28, withTiming(0, {
        duration: 190,
        easing: Easing.in(Easing.quad),
      }));
      veil.value = withDelay(44, withTiming(0, {
        duration: 220,
        easing: Easing.in(Easing.quad),
      }, finished => {
        if (finished) runOnJS(onClose)();
      }));
      return;
    }

    lottieRef.current?.play(TROPHY_EXIT_START_FRAME, TROPHY_EXIT_END_FRAME);
    cardLift.value = withTiming(-4, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
    cardScale.value = withDelay(180, withTiming(0.96, {
      duration: 210,
      easing: Easing.in(Easing.quad),
    }));
    cardOpacity.value = withDelay(210, withTiming(0, {
      duration: 190,
      easing: Easing.in(Easing.quad),
    }));
    veil.value = withDelay(250, withTiming(0, {
      duration: 210,
      easing: Easing.in(Easing.quad),
    }));

    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      onClose();
    }, TROPHY_EXIT_DURATION_MS);
  }, [burst, cardLift, cardOpacity, cardScale, iconPhase, lightMotion, onClose, veil]);

  const veilStyle = useAnimatedStyle(() => ({
    opacity: veil.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [
      { translateY: cardLift.value },
      { scale: cardScale.value },
    ],
  }));

  const iconStyle = useAnimatedStyle(() => {
    const t = iconPhase.value;
    return {
      opacity: t,
      transform: [
        { translateY: (1 - t) * 5 },
        { scale: 0.86 + t * 0.14 },
      ],
    };
  });

  const burstSize = Math.min(Math.max(width * 1.08, 380), 460);
  const burstCenterY = height / 2 - CARD_VISUAL_HEIGHT / 2 + CARD_ICON_CENTER_Y;
  const burstTop = Math.max(8, Math.min(height - burstSize - 8, burstCenterY - burstSize / 2));

  return (
    <View pointerEvents="box-none" style={s.wrap}>
      {/* The veil is a lit room, not a wash: a flat warm base, then a pool of
          light gathered exactly where the trophy stands. */}
      <Reanimated.View pointerEvents="none" style={[s.veilLayer, veilStyle]}>
        <View style={s.veil} />
        <VeilBloom width={width} height={height} centerY={burstCenterY} />
      </Reanimated.View>

      <View pointerEvents="none" style={s.stage}>
        <View
          style={[
            s.burstField,
            {
              width: burstSize,
              height: burstSize,
              top: burstTop,
              left: (width - burstSize) / 2,
            },
          ]}
        >
          <CelebrationRings phase={burst} />
          <CenterSpark phase={burst} />
          {particles.map((particle, index) => (
            <ConfettiParticle key={`${particle.angle}-${index}`} config={particle} phase={burst} />
          ))}
        </View>

        <Reanimated.View style={[s.card, cardStyle]}>
          <LinearGradient
            colors={['#FFFDF6', '#FFFFFF', '#FFFBF0']}
            locations={[0, 0.52, 1]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <CardWeave />
          <CardSheen phase={burst} />

          <View style={s.closeHint}>
            <X s={13} c="#A8A29E" w={2.5} />
          </View>

          <Reanimated.View style={[s.trophyStage, iconStyle]}>
            {/* Light radiating from behind what was earned. */}
            {!lightMotion && <GloryRays size={150} phase={iconPhase} reduceMotion={reduceMotion} />}
            <View style={s.trophyAura} />
            <View style={s.trophyCircle}>
              {visual ?? (
              <LottieView
                ref={lottieRef}
                source={CHALLENGE_TROPHY_SOURCE}
                autoPlay={false}
                loop={false}
                speed={1.02}
                style={s.trophyLottie}
                resizeMode="contain"
                renderMode="HARDWARE"
              />
              )}
            </View>
          </Reanimated.View>

          <Text style={s.title}>{title}</Text>
          <TitleRule />
          <Text style={s.subtitle}>
            {subtitleStrong ? <Text style={s.subtitleStrong}>{subtitleStrong} </Text> : null}
            {subtitle}
          </Text>
        </Reanimated.View>
      </View>

      {/* Paper falling across the whole screen for as long as you look. It sits
          above the card, because confetti that stops at the card's edge is a
          decoration rather than weather. */}
      {!lightMotion && (
        <FallingConfetti
          width={width}
          height={height}
          active={!dismissing}
          reduceMotion={reduceMotion}
        />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close celebration"
        onPress={handleDismiss}
        style={s.dismissHit}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5000,
    elevation: 5000,
  },
  veilLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  veil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(253,248,238,0.72)',
  },
  dismissHit: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    elevation: 30,
  },
  stage: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 12,
    elevation: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burstField: {
    position: 'absolute',
    zIndex: 20,
    elevation: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
    left: '50%',
    top: '50%',
  },
  halo: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(197,160,89,0.14)',
  },
  outerRing: {
    position: 'absolute',
    width: 164,
    height: 164,
    borderRadius: 82,
    borderWidth: 1.5,
    borderColor: 'rgba(197,160,89,0.46)',
  },
  innerRing: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 1.2,
    borderColor: 'rgba(255,247,223,0.92)',
    backgroundColor: 'rgba(197,160,89,0.08)',
  },
  centerSpark: {
    position: 'absolute',
    width: 56,
    height: 56,
  },
  card: {
    zIndex: 24,
    elevation: 24,
    width: '82%',
    maxWidth: 322,
    borderRadius: 30,
    borderCurve: 'continuous',
    // The ground is drawn, not filled — see the gradient inside. The colour
    // here only backs it while the gradient rasterises.
    backgroundColor: '#FFFDF7',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.3)',
    overflow: 'hidden',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 25,
    alignItems: 'center',
    shadowColor: '#8B7354',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.2,
    shadowRadius: 36,
  },
  sheen: {
    position: 'absolute',
    top: -90,
    bottom: -90,
    left: 0,
    width: 96,
  },
  closeHint: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: '#F7F4EF',
    borderWidth: 1,
    borderColor: 'rgba(168,162,158,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyStage: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 13,
  },
  trophyAura: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,247,222,0.9)',
  },
  trophyCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#FFF7DE',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trophyLottie: {
    width: 104,
    height: 104,
  },
  title: {
    fontFamily: F.serifMedium,
    fontSize: 28,
    lineHeight: 34,
    color: '#17130E',
    textAlign: 'center',
  },
  rule: {
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ruleLine: { width: 56, height: 1 },
  subtitle: {
    marginTop: 13,
    fontFamily: F.serif,
    fontSize: 16,
    lineHeight: 23,
    color: '#5F5850',
    textAlign: 'center',
  },
  subtitleStrong: {
    fontFamily: F.serifMedium,
    color: '#1C1917',
  },
});
