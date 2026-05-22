import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { Sparkles, X } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';

const GOLD = '#C5A059';
const DEEP_GOLD = '#A9782C';
const CREAM = '#FFF7DF';
const ROSE = '#EFB3A7';
const SKY = '#A9CFD3';
const CARD_VISUAL_HEIGHT = 193;
const CARD_ICON_CENTER_Y = 57;

type ParticleShape = 'diamond' | 'leaf' | 'dot' | 'ray' | 'ribbon';

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

function clamp01(value: number) {
  'worklet';
  return Math.max(0, Math.min(1, value));
}

function ParticleGlyph({ shape, color }: { shape: ParticleShape; color: string }) {
  if (shape === 'ray') {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 12 34">
        <Path d="M6 1.5 C8.4 9.8 8.2 23.9 6 32.5 C3.8 23.9 3.6 9.8 6 1.5 Z" fill={color} />
        <Path d="M6 5.5 C6.8 12.2 6.8 22 6 28.4" stroke="#FFFDF2" strokeWidth={1.2} strokeLinecap="round" opacity={0.62} />
      </Svg>
    );
  }

  if (shape === 'leaf') {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 18 24">
        <Path d="M9 2 C15 6.8 15.2 16.3 9 22 C2.8 16.3 3 6.8 9 2 Z" fill={color} />
        <Path d="M9 5.7 C10 10.1 9.9 15.3 9 19" stroke="#FFF9E6" strokeWidth={1.1} strokeLinecap="round" opacity={0.58} />
      </Svg>
    );
  }

  if (shape === 'ribbon') {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 34 14">
        <Path d="M2 8 C9 0 17 16 32 5" fill="none" stroke={color} strokeWidth={4.2} strokeLinecap="round" />
        <Path d="M4 7.5 C10 2.8 17 12.6 29 5.5" fill="none" stroke="#FFF8E2" strokeWidth={1.3} strokeLinecap="round" opacity={0.72} />
      </Svg>
    );
  }

  if (shape === 'diamond') {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 18 18">
        <Path d="M9 1.5 L16.5 9 L9 16.5 L1.5 9 Z" fill={color} />
        <Path d="M9 4.3 L13.7 9 L9 13.7 L4.3 9 Z" fill="#FFF9E9" opacity={0.62} />
      </Svg>
    );
  }

  return (
    <Svg width="100%" height="100%" viewBox="0 0 14 14">
      <Circle cx={7} cy={7} r={5.2} fill={color} />
      <Circle cx={5.1} cy={4.7} r={1.35} fill="#FFFDF2" opacity={0.8} />
    </Svg>
  );
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

export default function CelebrationOverlayBase({ onClose }: { onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const veil = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const cardLift = useSharedValue(12);
  const cardScale = useSharedValue(0.96);
  const burst = useSharedValue(0);
  const iconPhase = useSharedValue(0);

  useEffect(() => {
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
  }, [burst, cardLift, cardOpacity, cardScale, iconPhase, veil]);

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
      <Reanimated.View pointerEvents="none" style={[s.veil, veilStyle]} />

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
          {PARTICLES.map((particle, index) => (
            <ConfettiParticle key={`${particle.angle}-${index}`} config={particle} phase={burst} />
          ))}
        </View>

        <Reanimated.View style={[s.card, cardStyle]}>
          <View style={s.closeHint}>
            <X s={13} c="#A8A29E" w={2.5} />
          </View>
          <Reanimated.View style={[s.iconRing, iconStyle]}>
            <Sparkles s={30} c={GOLD} w={1.8} />
          </Reanimated.View>
          <Text style={s.kicker}>CONGRATULATIONS</Text>
          <Text style={s.title}>Dream achieved</Text>
          <Text style={s.subtitle}>A promise became real.</Text>
        </Reanimated.View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close celebration"
        onPress={onClose}
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
  veil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,252,246,0.62)',
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
    zIndex: 10,
    elevation: 10,
    minWidth: 236,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.24)',
    paddingHorizontal: 27,
    paddingTop: 23,
    paddingBottom: 21,
    alignItems: 'center',
    shadowColor: '#8B7354',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
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
  iconRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(197,160,89,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.26)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  kicker: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 2.5,
    color: GOLD,
  },
  title: {
    marginTop: 6,
    fontFamily: F.serifMedium,
    fontSize: 23,
    lineHeight: 28,
    color: C.text,
  },
  subtitle: {
    marginTop: 5,
    fontFamily: F.serifItalic,
    fontSize: 14,
    lineHeight: 19,
    color: '#8F8A81',
  },
});
