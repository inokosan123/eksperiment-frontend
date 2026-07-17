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
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { CheckSmall } from '@/components/icons/Icons';
import { CompletionFlourish } from '@/components/shared/taskAnimations';
import { playAchievementCompleteFeedback, playTaskUndoFeedback, preloadAchievementFeedbackSound } from '@/components/shared/taskFeedback';
import { F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';


const GOLD = '#C5A059';

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
  const lineHeight = (flatStyle as TextStyle).lineHeight ?? 20;
  const stableColor = done ? doneColor : (flatStyle as TextStyle).color ?? '#1A1714';

  return (
    <View
      onLayout={handleContainer}
      style={{ flex: 1, minWidth: 0, position: 'relative' }}
    >
      <Text
        onLayout={handleNatural}
        style={{
          position: 'absolute',
          opacity: 0,
          ...((flatStyle as TextStyle).fontFamily ? { fontFamily: (flatStyle as TextStyle).fontFamily } : {}),
          ...((flatStyle as TextStyle).fontSize ? { fontSize: (flatStyle as TextStyle).fontSize } : {}),
          ...((flatStyle as TextStyle).lineHeight ? { lineHeight: (flatStyle as TextStyle).lineHeight } : {}),
        }}
      >
        {text}
      </Text>
      <Reanimated.Text
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
    // Goals share the achievement chime but at a gentler level — the full
    // 0.78 volume read as loud against the quiet page.
    void playAchievementCompleteFeedback({ volume: 0.42 });
  } else {
    playTaskUndoFeedback();
  }
}

/* ── Confetti, struck in the app's own gold ───────────────── */
// Hand-built confetti: chunky flat pieces in the house palette, bursting
// sideways from the seal along the horizontal card — a low rise, a gentle
// fall, no tall vertical spray. One-shot Reanimated transforms on the UI
// thread; mounts for the burst (~1.2s) and unmounts.

type ConfettiPieceCfg = {
  id: number;
  dx: number;
  rise: number;
  fall: number;
  spin: number;
  delay: number;
  duration: number;
  w: number;
  h: number;
  r: number;
  color: string;
  diamond: boolean;
  top: number;
};

const CONFETTI_COLORS = ['#F2D58D', '#C5A059', '#A87E33', '#EA5354', '#5FBF7E', '#FFF1CE'];

function makeConfetti(): ConfettiPieceCfg[] {
  return Array.from({ length: 16 }, (_, id) => {
    const rightward = id % 4 !== 3; // most pieces sweep toward the text
    const dx = rightward ? 26 + Math.random() * 128 : -(14 + Math.random() * 34);
    const kind = id % 3; // 0 chip, 1 diamond, 2 dot
    const w = kind === 0 ? 7 + Math.random() * 4 : kind === 1 ? 6.5 : 5;
    const h = kind === 0 ? 4 + Math.random() * 2 : kind === 1 ? 6.5 : 5;
    return {
      id,
      dx,
      rise: -(6 + Math.random() * 14),
      fall: 8 + Math.random() * 16,
      spin: (Math.random() > 0.5 ? 1 : -1) * (160 + Math.random() * 400),
      delay: Math.random() * 130,
      duration: 720 + Math.random() * 320,
      w,
      h,
      r: kind === 2 ? 2.5 : 2,
      color: CONFETTI_COLORS[id % CONFETTI_COLORS.length],
      diamond: kind === 1,
      top: -10 + Math.random() * 20,
    };
  });
}

function ConfettiPiece({ cfg }: { cfg: ConfettiPieceCfg }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(cfg.delay, withTiming(1, { duration: cfg.duration, easing: Easing.out(Easing.quad) }));
  }, [cfg.delay, cfg.duration, t]);

  const flight = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.06, 0.72, 1], [0, 1, 1, 0]),
    transform: [
      { translateX: t.value * cfg.dx },
      { translateY: interpolate(t.value, [0, 0.38, 1], [0, cfg.rise, cfg.fall]) },
      { rotate: `${t.value * cfg.spin}deg` },
    ],
  }));

  return (
    <Reanimated.View pointerEvents="none" style={[s.confettiPiece, { marginTop: cfg.top }, flight]}>
      <View
        style={{
          width: cfg.w,
          height: cfg.h,
          borderRadius: cfg.r,
          backgroundColor: cfg.color,
          transform: cfg.diamond ? [{ rotate: '45deg' }] : undefined,
        }}
      />
    </Reanimated.View>
  );
}

export function GoalCompletionConfetti({ done }: { done: boolean }) {
  const previousDone = useRef(done);
  const [pieces, setPieces] = useState<ConfettiPieceCfg[] | null>(null);

  useEffect(() => {
    const becameDone = !previousDone.current && done;
    previousDone.current = done;
    if (!becameDone) return;
    setPieces(makeConfetti());
    const timer = setTimeout(() => setPieces(null), 1250);
    return () => clearTimeout(timer);
  }, [done]);

  if (!pieces) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
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
    transform: [{ scale: 0.66 + fill.value * 0.34 }],
  }));

  const tickStyle = useAnimatedStyle(() => ({
    opacity: fill.value < 0.5 ? 0 : (fill.value - 0.5) * 2,
    transform: [{ scale: 0.75 + fill.value * 0.25 }],
  }));

  const numeralStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, fill.value * 1.7),
  }));

  const diamond = size * 0.72;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <CompletionFlourish
        done={done}
        color={burstColor}
        layerStyle={{ width: size * 3, height: size * 3 }}
      />
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
    left: 34,
    top: '50%',
  },
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
