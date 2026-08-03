import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Reanimated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { CheckSmall } from '@/components/icons/Icons';
import { CompletionFlourish } from '@/components/shared/taskAnimations';
import { playAchievementCompleteFeedback, playTaskUndoFeedback, preloadAchievementFeedbackSound } from '@/components/shared/taskFeedback';
import { F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';


const GOLD = '#C5A059';

// Keep an intention in place until its strikethrough and confetti have both
// had time to finish. Screens use this before committing the reordered list.
export const MONTHLY_GOAL_CELEBRATION_MS = 1650;

// Roman numerals for the intentions — shared by the goals screen and Home.
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];

export function toRoman(index: number) {
  return ROMAN[index] ?? String(index + 1);
}

type AnimatedGoalCheckProps = {
  done: boolean;
  onPress: () => void;
  size?: number;
  burstColor?: string;
};

// Reusable check circle that fires the same celebratory burst as task
// completion. Layered so the burst expands beyond the circle's bounds.
export function AnimatedGoalCheck({
  done,
  onPress,
  size = 22,
  burstColor = GOLD,
}: AnimatedGoalCheckProps) {
  const fill = useSharedValue(done ? 1 : 0);
  const previousDone = useRef(done);

  useEffect(() => {
    preloadAchievementFeedbackSound();
  }, []);

  useEffect(() => {
    const becameDone = !previousDone.current && done;
    const becameUndone = previousDone.current && !done;
    previousDone.current = done;

    if (becameDone) {
      fill.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    } else if (becameUndone) {
      fill.value = withTiming(0, { duration: 160 });
    }
  }, [done, fill]);

  const fillStyle = useAnimatedStyle(() => ({
    opacity: fill.value,
    transform: [{ scale: 0.6 + fill.value * 0.4 }],
  }));

  const tickStyle = useAnimatedStyle(() => ({
    opacity: fill.value < 0.5 ? 0 : (fill.value - 0.5) * 2,
    transform: [{ scale: 0.7 + fill.value * 0.3 }],
  }));

  const innerSize = size;
  const burstSize = size * 3.6;

  return (
    <View style={{ width: innerSize, height: innerSize, alignItems: 'center', justifyContent: 'center' }}>
      {/* Burst sits behind the button; pointerEvents: 'none' inside the
          flourish layer keeps it from intercepting taps. */}
      <CompletionFlourish
        done={done}
        color={burstColor}
        layerStyle={{
          width: burstSize,
          height: burstSize,
        }}
      />
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.78}
        hitSlop={8}
        style={[
          s.checkBtn,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
          },
        ]}
      >
        <Reanimated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 0, top: 0, right: 0, bottom: 0,
              borderRadius: innerSize / 2,
              backgroundColor: burstColor,
            },
            fillStyle,
          ]}
        />
        <Reanimated.View pointerEvents="none" style={tickStyle}>
          <CheckSmall s={Math.round(size * 0.55)} c="#FFFFFF" w={3} />
        </Reanimated.View>
      </TouchableOpacity>
    </View>
  );
}

type AnimatedStrikeTextProps = {
  text: string;
  done: boolean;
  textStyle?: StyleProp<TextStyle>;
  doneColor?: string;
  lineColor?: string;
  numberOfLines?: number;
};

// Text with an animated strike-through line that draws left → right when
// `done` flips true (and retracts when undone). Mirrors TaskTitle's pattern:
// a hidden absolute Text gives intrinsic width; visible Text fills the
// flex slot; strike width = min(intrinsic, container).
export function AnimatedStrikeText({
  text,
  done,
  textStyle,
  doneColor = '#A8A29E',
  lineColor = 'rgba(28,25,23,0.42)',
  numberOfLines = 2,
}: AnimatedStrikeTextProps) {
  const progress = useSharedValue(done ? 1 : 0);
  const previousDone = useRef(done);
  const [naturalWidth, setNaturalWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const drawWidth = Math.min(naturalWidth, containerWidth);

  useEffect(() => {
    const becameDone = !previousDone.current && done;
    const becameUndone = previousDone.current && !done;
    previousDone.current = done;
    if (becameDone) {
      progress.value = 0;
      progress.value = withTiming(1, {
        duration: 1150,
        easing: Easing.out(Easing.cubic),
      });
    } else if (becameUndone) {
      progress.value = withTiming(0, { duration: 200 });
    }
  }, [done, progress]);

  const lineStyle = useAnimatedStyle(() => ({
    width: drawWidth * progress.value,
    opacity: progress.value < 0.05 ? 0 : 1,
  }));

  const colorStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value * 0.45,
  }));

  const handleNatural = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (Math.abs(w - naturalWidth) > 0.5) setNaturalWidth(w);
  };
  const handleContainer = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (Math.abs(w - containerWidth) > 0.5) setContainerWidth(w);
  };

  // Text style needs to account for both the active and "done" colour:
  // we keep the active colour stable and animate opacity instead, so the
  // colour transition feels smooth alongside the strike sweep.
  const flatStyle = StyleSheet.flatten(textStyle) || {};
  const baseFontSize = (flatStyle as TextStyle).fontSize;
  const lineHeight = (flatStyle as TextStyle).lineHeight ?? 20;
  const stableColor = done ? doneColor : (flatStyle as TextStyle).color ?? '#1A1714';

  return (
    <View
      onLayout={handleContainer}
      style={{ flex: 1, minWidth: 0, position: 'relative' }}
    >
      <Text
        allowFontScaling={false}
        maxFontSizeMultiplier={1}
        onLayout={handleNatural}
        style={{
          position: 'absolute',
          opacity: 0,
          ...((flatStyle as TextStyle).fontFamily ? { fontFamily: (flatStyle as TextStyle).fontFamily } : {}),
          ...(baseFontSize ? { fontSize: baseFontSize } : {}),
          lineHeight,
        }}
      >
        {text}
      </Text>
      <Reanimated.Text
        allowFontScaling={false}
        maxFontSizeMultiplier={1}
        numberOfLines={numberOfLines}
        ellipsizeMode="tail"
        style={[
          textStyle,
          { color: stableColor },
          colorStyle,
        ]}
      >
        {text}
      </Reanimated.Text>
      {drawWidth > 0 && (
        <Reanimated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 0,
              top: lineHeight / 2,
              height: 1.2,
              borderRadius: 1,
              backgroundColor: lineColor,
            },
            lineStyle,
          ]}
        />
      )}
    </View>
  );
}

// Monthly-goal achievements use their own sibling sound to task completion,
// while undo keeps the shared light tap.
export function fireGoalToggleHaptic(willComplete: boolean) {
  if (willComplete) {
    // Goals share the achievement chime, a touch under the default level.
    void playAchievementCompleteFeedback({ volume: 0.35 });
  } else {
    playTaskUndoFeedback();
  }
}

/* ── Confetti, struck in the app's own gold ───────────────── */
// Hand-built confetti: chunky flat pieces in the house palette, bursting
// sideways from the seal along the horizontal card — a low rise, a gentle
// fall, no tall vertical spray. One-shot Reanimated transforms on the UI
// thread; mounts for the burst (~1.2s) and unmounts.

type ConfettiShape = 'ribbon' | 'chip' | 'diamond' | 'petal' | 'dot' | 'glint';

type ConfettiPieceCfg = {
  id: number;
  dx: number;
  launchY: number;
  gravityY: number;
  drag: number;
  spin: number;
  delay: number;
  duration: number;
  w: number;
  h: number;
  r: number;
  color: string;
  highlight: string;
  shape: ConfettiShape;
  depth: number;
  sway: number;
  flutterTurns: number;
  flutterPhase: number;
  originX: number;
  originY: number;
};

const CONFETTI_PALETTE = [
  { color: '#F4D98F', highlight: '#FFF7DA' },
  { color: '#C98B35', highlight: '#F3CF83' },
  { color: '#E77870', highlight: '#FFD0C8' },
  { color: '#62AE82', highlight: '#C7E9D3' },
  { color: '#9785BF', highlight: '#DDD4F2' },
  { color: '#E8B65B', highlight: '#FFF0BD' },
];

const CONFETTI_SHAPES: ConfettiShape[] = ['ribbon', 'petal', 'chip', 'glint', 'diamond', 'dot'];

function makeConfetti(): ConfettiPieceCfg[] {
  const count = 24;
  return Array.from({ length: count }, (_, id) => {
    const direction = id % 2 === 0 ? -1 : 1;
    const dx = direction * (18 + Math.random() * 48);
    const launchY = 118 + Math.random() * 72;
    const landingY = 16 + Math.random() * 34;
    const shape = CONFETTI_SHAPES[id % CONFETTI_SHAPES.length];
    const palette = CONFETTI_PALETTE[id % CONFETTI_PALETTE.length];
    const dimensions: Record<ConfettiShape, { w: number; h: number; r: number }> = {
      ribbon: { w: 5 + Math.random() * 1.5, h: 15 + Math.random() * 6, r: 2.5 },
      chip: { w: 9 + Math.random() * 4, h: 5 + Math.random() * 2, r: 2.5 },
      diamond: { w: 7 + Math.random() * 2, h: 7 + Math.random() * 2, r: 2 },
      petal: { w: 9 + Math.random() * 2, h: 13 + Math.random() * 3, r: 5 },
      dot: { w: 7 + Math.random() * 2, h: 7 + Math.random() * 2, r: 99 },
      glint: { w: 11 + Math.random() * 3, h: 11 + Math.random() * 3, r: 0 },
    };
    const size = dimensions[shape];
    return {
      id,
      dx,
      launchY,
      gravityY: launchY + landingY,
      drag: 1.35 + Math.random() * 1.25,
      spin: (Math.random() > 0.5 ? 1 : -1) * (90 + Math.random() * 190),
      delay: Math.random() * 125,
      duration: 940 + Math.random() * 280,
      w: size.w,
      h: size.h,
      r: size.r,
      color: palette.color,
      highlight: palette.highlight,
      shape,
      depth: 0.78 + (id % 4) * 0.08,
      sway: 2.5 + Math.random() * 4.5,
      flutterTurns: 2.2 + Math.random() * 1.8,
      flutterPhase: Math.random() * Math.PI * 2,
      originX: 7 + (id / (count - 1)) * 86 + ((id % 3) - 1) * 1.8,
      originY: 34 + (id % 3) * 16,
    };
  });
}

function ConfettiGlyph({ cfg }: { cfg: ConfettiPieceCfg }) {
  if (cfg.shape === 'petal') {
    return (
      <Svg width={cfg.w} height={cfg.h} viewBox="0 0 10 14">
        <Path d="M5 0.7C8.6 2.5 10 6.2 8.5 9.8C7.5 12.1 5.4 13.5 3.4 12.6C1.2 11.6 0.5 8.6 1.7 5.8C2.4 4 3.5 2.3 5 0.7Z" fill={cfg.color} />
        <Path d="M4.9 2.6C5.5 6.1 4.8 9.1 3.4 11.6" fill="none" stroke={cfg.highlight} strokeWidth="0.8" strokeLinecap="round" opacity="0.82" />
      </Svg>
    );
  }

  if (cfg.shape === 'dot') {
    return (
      <Svg width={cfg.w} height={cfg.h} viewBox="0 0 8 8">
        <Circle cx="4" cy="4" r="3.6" fill={cfg.color} />
        <Circle cx="2.9" cy="2.7" r="1.1" fill={cfg.highlight} opacity="0.88" />
      </Svg>
    );
  }

  if (cfg.shape === 'glint') {
    return (
      <Svg width={cfg.w} height={cfg.h} viewBox="0 0 14 14">
        <Path d="M7 0.5C7.6 4.8 9.2 6.4 13.5 7C9.2 7.6 7.6 9.2 7 13.5C6.4 9.2 4.8 7.6 0.5 7C4.8 6.4 6.4 4.8 7 0.5Z" fill={cfg.color} />
        <Circle cx="7" cy="7" r="1.45" fill={cfg.highlight} opacity="0.9" />
      </Svg>
    );
  }

  const isDiamond = cfg.shape === 'diamond';
  const isRibbon = cfg.shape === 'ribbon';
  return (
    <View
      style={{
        width: cfg.w,
        height: cfg.h,
        borderRadius: cfg.r,
        backgroundColor: cfg.color,
        overflow: 'hidden',
        transform: isDiamond ? [{ rotate: '45deg' }] : undefined,
        borderWidth: 0.7,
        borderColor: 'rgba(111,72,24,0.14)',
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: isRibbon ? 1 : 0.7,
          left: isRibbon ? 1 : 1.2,
          width: isRibbon ? 1.2 : Math.max(2, cfg.w * 0.42),
          height: isRibbon ? Math.max(5, cfg.h * 0.5) : 1.2,
          borderRadius: 99,
          backgroundColor: cfg.highlight,
          opacity: 0.72,
        }}
      />
    </View>
  );
}

function ConfettiPiece({ cfg }: { cfg: ConfettiPieceCfg }) {
  const t = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    t.value = 0;
    t.value = withDelay(
      reduceMotion ? 0 : cfg.delay,
      withTiming(1, { duration: reduceMotion ? 420 : cfg.duration, easing: Easing.linear }),
    );
  }, [cfg.delay, cfg.duration, reduceMotion, t]);

  const flight = useAnimatedStyle(() => {
    const progress = t.value;
    const motionScale = reduceMotion ? 0.25 : 1;
    const dragProgress =
      (1 - Math.exp(-cfg.drag * progress)) /
      (1 - Math.exp(-cfg.drag));
    const airDrift =
      (Math.sin(progress * Math.PI * cfg.flutterTurns + cfg.flutterPhase) -
        Math.sin(cfg.flutterPhase)) *
      cfg.sway *
      progress *
      (1 - progress * 0.32);
    const ballisticY = -cfg.launchY * progress + cfg.gravityY * progress * progress;
    const angularProgress = 1 - Math.pow(1 - progress, 1.55);

    return {
      opacity: interpolate(progress, [0, 0.06, 0.7, 1], [0, 0.92 * cfg.depth, 0.82 * cfg.depth, 0]),
      transform: [
        { translateX: (cfg.dx * dragProgress + airDrift) * motionScale },
        { translateY: ballisticY * motionScale },
        { rotate: `${angularProgress * cfg.spin}deg` },
        { scale: interpolate(progress, [0, 0.1, 0.78, 1], [0.52, cfg.depth, cfg.depth * 0.86, 0.34]) },
        {
          scaleX: reduceMotion
            ? 1
            : 0.62 + Math.abs(Math.cos(progress * Math.PI * cfg.flutterTurns + cfg.flutterPhase)) * 0.38,
        },
      ],
    };
  });

  return (
    <Reanimated.View
      pointerEvents="none"
      style={[s.confettiPiece, { left: `${cfg.originX}%`, top: `${cfg.originY}%` }, flight]}
    >
      <ConfettiGlyph cfg={cfg} />
    </Reanimated.View>
  );
}

export function GoalCompletionConfetti({
  done = false,
  burstId,
  containerStyle,
}: {
  done?: boolean;
  burstId?: number;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const previousDone = useRef(done);
  const previousBurstId = useRef(burstId);
  const [pieces, setPieces] = useState<ConfettiPieceCfg[] | null>(null);

  useEffect(() => {
    const becameDone = !previousDone.current && done;
    const burstRequested = burstId !== undefined && burstId !== previousBurstId.current;
    previousDone.current = done;
    previousBurstId.current = burstId;
    if (!becameDone && !burstRequested) return;
    setPieces(makeConfetti());
    const timer = setTimeout(() => setPieces(null), MONTHLY_GOAL_CELEBRATION_MS - 10);
    return () => clearTimeout(timer);
  }, [burstId, done]);

  if (!pieces) return null;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, containerStyle]}>
      {pieces.map(cfg => (
        <ConfettiPiece key={cfg.id} cfg={cfg} />
      ))}
    </View>
  );
}

/* ── The intention's seal ─────────────────────────────────── */
// A diamond lozenge bearing the goal's roman numeral. Tapping it strikes
// the seal: the diamond fills gold, the numeral gives way to a check, and
// the celebratory burst fires behind it.

type AnimatedSealCheckProps = {
  done: boolean;
  numeral: string;
  onPress: () => void;
  size?: number;
  burstColor?: string;
};

export function AnimatedSealCheck({
  done,
  numeral,
  onPress,
  size = 36,
  burstColor = GOLD,
}: AnimatedSealCheckProps) {
  const fill = useSharedValue(done ? 1 : 0);
  const stamp = useSharedValue(0);
  const glow = useSharedValue(0);
  const previousDone = useRef(done);

  useEffect(() => {
    preloadAchievementFeedbackSound();
  }, []);

  useEffect(() => {
    const becameDone = !previousDone.current && done;
    const becameUndone = previousDone.current && !done;
    previousDone.current = done;

    if (becameDone) {
      fill.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
      stamp.value = 0;
      stamp.value = withSequence(
        withTiming(1, { duration: 115, easing: Easing.out(Easing.cubic) }),
        withSpring(0, { damping: 13, stiffness: 260, mass: 0.48 }),
      );
      glow.value = 0;
      glow.value = withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) });
    } else if (becameUndone) {
      fill.value = withTiming(0, { duration: 160 });
      stamp.value = withTiming(0, { duration: 120 });
      glow.value = withTiming(0, { duration: 100 });
    }
  }, [done, fill, glow, stamp]);

  const fillStyle = useAnimatedStyle(() => ({
    opacity: fill.value,
    transform: [{ scale: 0.66 + fill.value * 0.34 }],
  }));

  const tickStyle = useAnimatedStyle(() => ({
    opacity: fill.value < 0.5 ? 0 : (fill.value - 0.5) * 2,
    transform: [{ scale: 0.75 + fill.value * 0.25 }],
  }));

  const numeralStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, fill.value * 1.7),
  }));

  const stampStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 + stamp.value * 0.16 },
      { rotate: `${stamp.value * 3.5}deg` },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 0.18, 1], [0, 0.42, 0]),
    transform: [{ scale: 0.72 + glow.value * 1.05 }],
  }));

  const diamond = size * 0.72;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Reanimated.View
        pointerEvents="none"
        style={[s.sealGlow, { width: size * 1.05, height: size * 1.05, borderRadius: size }, glowStyle]}
      />
      <CompletionFlourish
        done={done}
        color={burstColor}
        layerStyle={{ width: size * 3, height: size * 3 }}
      />
      <Reanimated.View style={stampStyle}>
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.78}
          hitSlop={9}
          style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={[s.sealDiamond, { width: diamond, height: diamond, borderRadius: size * 0.16 }]}>
            <Reanimated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFillObject, { backgroundColor: burstColor }, fillStyle]}
            />
          </View>
          <View pointerEvents="none" style={s.sealContent}>
            <Reanimated.Text style={[s.sealNumeral, numeralStyle]}>{numeral}</Reanimated.Text>
            <Reanimated.View style={[s.sealTick, tickStyle]}>
              <CheckSmall s={Math.round(size * 0.4)} c="#FFFFFF" w={3} />
            </Reanimated.View>
          </View>
        </TouchableOpacity>
      </Reanimated.View>
    </View>
  );
}

// Read-only twin for archived months — the seal without the strike.
export function StaticSealCheck({
  done,
  numeral,
  size = 36,
}: {
  done: boolean;
  numeral: string;
  size?: number;
}) {
  const diamond = size * 0.72;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={[
          s.sealDiamond,
          s.sealDiamondArchived,
          done && s.sealDiamondArchivedDone,
          { width: diamond, height: diamond, borderRadius: size * 0.16 },
        ]}
      />
      <View pointerEvents="none" style={s.sealContent}>
        {done ? (
          <CheckSmall s={Math.round(size * 0.4)} c="#FFFFFF" w={3} />
        ) : (
          <Text style={[s.sealNumeral, s.sealNumeralArchived]}>{numeral}</Text>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  checkBtn: {
    borderWidth: 2,
    borderColor: '#D6D3D1',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  confettiPiece: {
    position: 'absolute',
  },
  sealGlow: { position: 'absolute', backgroundColor: 'rgba(197,160,89,0.18)', borderWidth: 1, borderColor: 'rgba(197,160,89,0.38)' },
  sealDiamond: {
    transform: [{ rotate: '45deg' }],
    borderWidth: 1.3,
    borderColor: 'rgba(197,160,89,0.55)',
    backgroundColor: '#FFFEFB',
    overflow: 'hidden',
  },
  sealDiamondArchived: {
    borderColor: '#CFC7BB',
    backgroundColor: '#F8F5EF',
  },
  sealDiamondArchivedDone: {
    borderColor: '#A79B88',
    backgroundColor: '#A79B88',
  },
  sealContent: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealNumeral: {
    fontFamily: F.serifMediumItalic,
    fontSize: 12.5,
    color: '#8B6B2F',
  },
  sealNumeralArchived: {
    color: '#B3A996',
  },
  sealTick: {
    position: 'absolute',
  },
});
