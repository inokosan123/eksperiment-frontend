import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient as SvgLinearGradient,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown } from '@/components/icons/Icons';
import { F } from '@/constants/tokens';
import { HapticPressable as Pressable } from '@/components/shared/HapticTouch';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/* ─────────────────────────────────────────────────────────────
 * The screen's register, taken from the Your Progress card on
 * Home: warm parchment, one gold accent, and ink that is brown
 * rather than black. The four outcomes borrow the app's own
 * vocabulary — done is the fire, a skipped day is ash, a missed
 * one oxblood, and an unwritten one bare parchment.
 * ───────────────────────────────────────────────────────────── */

export const A = {
  bg: '#FAF7F0',
  surface: '#FFFFFF',
  line: '#EFE9DD',
  lineSoft: '#F5F1E8',
  /** Hairline rules and ornaments — always gold, never grey. */
  hair: 'rgba(169,134,63,0.34)',
  hairSoft: 'rgba(169,134,63,0.16)',

  gold: '#C5A059',
  goldSoft: '#E2BD75',
  goldPale: '#F0DFB8',
  goldDeep: '#A87E33',
  goldInk: '#8B6B2F',
  goldWash: '#FFFBEF',

  ink: '#2A2420',
  ink2: '#5A5148',
  /** The register every large serif number is struck in. */
  numberInk: '#4A3820',
  muted: '#7C756C',
  faint: '#A29B90',

  done: '#C5A059',
  doneInk: '#8B6B2F',
  doneWash: '#FDF7EA',
  skipped: '#9A9488',
  skippedInk: '#6E6960',
  skippedWash: '#F5F4F1',
  missed: '#A24351',
  missedInk: '#8E3A47',
  missedWash: '#FBF1F2',
  pending: '#DFD6C3',
  pendingInk: '#9A9182',
  pendingWash: '#FAF8F3',
} as const;

/** The card shell every section on the screen sits in. */
export const cardShell = {
  borderRadius: 22,
  borderCurve: 'continuous',
  backgroundColor: A.surface,
  borderWidth: 1,
  borderColor: A.line,
  shadowColor: '#8A7550',
  shadowOpacity: 0.07,
  shadowOffset: { width: 0, height: 6 },
  shadowRadius: 16,
  elevation: 2,
} as const;

export type IconComp = React.ComponentType<{ s?: number; c?: string; w?: number }>;

/* ─── Ornaments ─────────────────────────────────────────────── */

/** The struck diamond the app uses to punctuate a label. */
export function Diamond({ size = 4.5, color = A.hair }: { size?: number; color?: string }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 0.5,
        backgroundColor: color,
        transform: [{ rotate: '45deg' }],
      }}
    />
  );
}

/** A gold hairline that fades out as it runs. */
export function HairRule({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient
      colors={[A.hair, A.hairSoft, 'rgba(169,134,63,0)']}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={[{ height: 1, borderRadius: 1 }, style]}
    />
  );
}

/* ─── Section header ─────────────────────────────────────────
 * One grammar for every section: a gold icon chip, a dominant
 * serif title that always stays on one line, and a quiet serif
 * sentence underneath saying what the section shows.
 * ───────────────────────────────────────────────────────────── */

export function SectionHead({
  Icon,
  title,
  caption,
  right,
  tone = A.gold,
  wash = A.goldWash,
  style,
}: {
  Icon: IconComp;
  title: string;
  caption?: string;
  right?: React.ReactNode;
  tone?: string;
  wash?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[sh.wrap, style]}>
      <View style={sh.row}>
        <View style={[sh.chip, { backgroundColor: wash, borderColor: `${tone}33` }]}>
          <Icon s={15} c={tone} w={2} />
        </View>
        <Text style={sh.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
          {title}
        </Text>
        {right}
      </View>
      {!!caption && <Text style={sh.caption}>{caption}</Text>}
    </View>
  );
}

const sh = StyleSheet.create({
  wrap: { rowGap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', columnGap: 10 },
  chip: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontFamily: F.serifSemiBold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.3,
    color: A.ink,
  },
  caption: {
    fontFamily: F.serif,
    fontSize: 14.5,
    lineHeight: 19,
    color: A.muted,
  },
});

/* ─── Count-up ───────────────────────────────────────────────
 * Numbers climb to their value instead of snapping. One text
 * node per number, mount-only and on value change, so it never
 * touches a gesture or task-check path.
 * ───────────────────────────────────────────────────────────── */

export function useCountUp(target: number, duration = 780, delay = 120): number {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(() => (reduceMotion ? target : 0));
  const shownRef = useRef(reduceMotion ? target : 0);

  useEffect(() => {
    if (reduceMotion) {
      shownRef.current = target;
      setDisplay(target);
      return;
    }
    const from = shownRef.current;
    if (from === target) return;

    let raf: number | null = null;
    let started: number | null = null;

    const step = (ts: number) => {
      if (started === null) started = ts;
      const t = Math.min(1, (ts - started) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(from + (target - from) * eased);
      shownRef.current = value;
      setDisplay(value);
      if (t < 1) raf = requestAnimationFrame(step);
    };

    const timer = setTimeout(() => {
      raf = requestAnimationFrame(step);
    }, delay);

    return () => {
      clearTimeout(timer);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [target, duration, delay, reduceMotion]);

  return display;
}

/* ─── Gauge dial ─────────────────────────────────────────────
 * The screen's headline reading, struck in the same language as
 * the Home medallion: a soft bloom of light under the face, a
 * pale track, a gold arc that fills, and hairline rims inside
 * and out so the whole thing reads as minted rather than drawn.
 * ───────────────────────────────────────────────────────────── */

let gaugeSeq = 0;

export function GaugeDial({
  pct,
  size = 116,
  stroke = 8,
  delay = 160,
  children,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  delay?: number;
  children?: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  // Gradient ids must be unique per mounted dial — two dials sharing an id
  // would both paint whichever definition rendered last.
  const [seq] = useState(() => (gaugeSeq += 1));
  const arcId = `gaugeArc${seq}`;
  const bloomId = `gaugeBloom${seq}`;

  // The bloom needs room to fall away, so the canvas is wider than the dial.
  const canvas = size * 1.34;
  const c = canvas / 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const target = Math.max(0, Math.min(1, pct / 100));

  const progress = useSharedValue(reduceMotion ? target : 0);
  useEffect(() => {
    progress.value = reduceMotion
      ? target
      : withDelay(delay, withTiming(target, { duration: 1020, easing: Easing.out(Easing.cubic) }));
  }, [progress, reduceMotion, target, delay]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg
        pointerEvents="none"
        width={canvas}
        height={canvas}
        style={{ position: 'absolute', left: (size - canvas) / 2, top: (size - canvas) / 2 }}
      >
        <Defs>
          <RadialGradient id={bloomId} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFDF6" stopOpacity={1} />
            <Stop offset="0.46" stopColor="#FFF6E2" stopOpacity={0.92} />
            <Stop offset="0.74" stopColor="#F8EACB" stopOpacity={0.52} />
            <Stop offset="1" stopColor="#F3E3BB" stopOpacity={0} />
          </RadialGradient>
          <SvgLinearGradient id={arcId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={A.goldSoft} />
            <Stop offset="55%" stopColor={A.gold} />
            <Stop offset="100%" stopColor={A.goldDeep} />
          </SvgLinearGradient>
        </Defs>

        {/* Layered bloom — the light the reading sits in */}
        <Ellipse cx={c} cy={c} rx={canvas * 0.44} ry={canvas * 0.42} fill="#EFDCAF" opacity={0.3} />
        <Ellipse cx={c} cy={c} rx={canvas * 0.38} ry={canvas * 0.37} fill={`url(#${bloomId})`} />

        {/* Outer hairline rim */}
        <Circle
          cx={c}
          cy={c}
          r={radius + stroke / 2 + 3.5}
          stroke={A.gold}
          strokeOpacity={0.24}
          strokeWidth={1}
          fill="none"
        />
        {/* Track */}
        <Circle cx={c} cy={c} r={radius} stroke="#F1EADB" strokeWidth={stroke} fill="none" />
        {/* The reading */}
        <AnimatedCircle
          animatedProps={arcProps}
          cx={c}
          cy={c}
          r={radius}
          stroke={`url(#${arcId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          transform={`rotate(-90 ${c} ${c})`}
        />
        {/* Inner hairline rim */}
        <Circle
          cx={c}
          cy={c}
          r={radius - stroke / 2 - 3.5}
          stroke={A.gold}
          strokeOpacity={0.16}
          strokeWidth={1}
          fill="none"
        />
      </Svg>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>{children}</View>
    </View>
  );
}

/* ─── Progress bar ──────────────────────────────────────────── */

export function ProgressBar({
  pct,
  color = A.gold,
  height = 8,
  delay = 0,
  trackColor = '#F2EDE2',
  style,
}: {
  pct: number;
  color?: string;
  height?: number;
  delay?: number;
  trackColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotion();
  const target = Math.max(0, Math.min(100, pct));
  const width = useSharedValue(reduceMotion ? target : 0);

  useEffect(() => {
    width.value = reduceMotion
      ? target
      : withDelay(delay, withTiming(target, { duration: 820, easing: Easing.out(Easing.cubic) }));
  }, [width, reduceMotion, target, delay]);

  const fill = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <View
      style={[
        { height, borderRadius: height / 2, backgroundColor: trackColor, overflow: 'hidden' },
        style,
      ]}
    >
      <Animated.View
        style={[{ height: '100%', borderRadius: height / 2, backgroundColor: color }, fill]}
      />
    </View>
  );
}

/* ─── Expand chevron ────────────────────────────────────────── */

export function ExpandChevron({
  expanded,
  color = A.faint,
  size = 18,
}: {
  expanded: boolean;
  color?: string;
  size?: number;
}) {
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    turn.value = reduceMotion
      ? expanded
        ? 1
        : 0
      : withTiming(expanded ? 1 : 0, { duration: 240, easing: Easing.out(Easing.cubic) });
  }, [turn, expanded, reduceMotion]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));

  return (
    <Animated.View style={style}>
      <ChevronDown s={size} c={color} />
    </Animated.View>
  );
}

/* ─── Marquee ────────────────────────────────────────────────
 * A name too long for its column travels along to show its tail,
 * waits, and returns — instead of being cut off. The clipping
 * box is a locked horizontal ScrollView because that is the one
 * container in RN that lays its content out at natural width
 * rather than squeezing it to the parent.
 * ───────────────────────────────────────────────────────────── */

export function MarqueeText({
  text,
  style,
  fadeColor = A.surface,
  /** points per second the text travels */
  speed = 32,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  fadeColor?: string;
  speed?: number;
}) {
  const reduceMotion = useReducedMotion();
  const [boxW, setBoxW] = useState(0);
  const [textW, setTextW] = useState(0);
  const x = useSharedValue(0);

  const overflow = boxW > 0 && textW > 0 ? Math.max(0, textW - boxW) : 0;
  const scrolls = overflow > 1 && !reduceMotion;

  useEffect(() => {
    cancelAnimation(x);
    x.value = 0;
    if (!scrolls) return;

    const travel = Math.max(900, Math.round((overflow / speed) * 1000));
    x.value = withRepeat(
      withSequence(
        withDelay(1500, withTiming(-overflow, { duration: travel, easing: Easing.inOut(Easing.quad) })),
        withDelay(1100, withTiming(0, { duration: travel, easing: Easing.inOut(Easing.quad) })),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(x);
      x.value = 0;
    };
  }, [scrolls, overflow, speed, x]);

  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  // The leading fade only exists once the text has actually moved off its mark.
  const leadFade = useAnimatedStyle(() => ({
    opacity: interpolate(-x.value, [0, 10], [0, 1], 'clamp'),
  }));

  const onBox = useCallback((e: LayoutChangeEvent) => setBoxW(e.nativeEvent.layout.width), []);
  const onText = useCallback((e: LayoutChangeEvent) => setTextW(e.nativeEvent.layout.width), []);

  return (
    <View style={mq.box} onLayout={onBox}>
      <ScrollView
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={mq.content}
      >
        <Animated.View style={slide}>
          <Text style={style} numberOfLines={1} onLayout={onText}>
            {text}
          </Text>
        </Animated.View>
      </ScrollView>

      {scrolls && (
        <>
          <Animated.View style={[mq.fade, mq.fadeLeft, leadFade]} pointerEvents="none">
            <LinearGradient
              colors={[fadeColor, `${fadeColor}00`]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <View style={[mq.fade, mq.fadeRight]} pointerEvents="none">
            <LinearGradient
              colors={[`${fadeColor}00`, fadeColor]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
        </>
      )}
    </View>
  );
}

const mq = StyleSheet.create({
  box: { width: '100%', overflow: 'hidden' },
  content: { alignItems: 'center' },
  fade: { position: 'absolute', top: 0, bottom: 0, width: 16 },
  fadeLeft: { left: 0 },
  fadeRight: { right: 0 },
});

/* ─── Segmented rail ─────────────────────────────────────────
 * The screen's one selector. A single engraved track holds every
 * option and a struck gold plate slides between them, so there
 * is no per-pill drop shadow to be sliced off by the scroller's
 * bounds — the old strip's glow was cut flat top and bottom
 * exactly because each pill cast its own shadow past the edge.
 * The plate's soft light now lives inside the rail, and the
 * scroller carries enough vertical room for the rest.
 * ───────────────────────────────────────────────────────────── */

const RAIL_SPRING = { damping: 20, stiffness: 190, mass: 0.7 } as const;

export interface RailItem<K extends string = string> {
  key: K;
  label: string;
}

export function SegmentedRail<K extends string>({
  items,
  value,
  onChange,
  variant = 'gold',
  size = 'md',
  /** Side inset of the track — match the container's own content margin. */
  gutter = 16,
  fadeColor = A.surface,
}: {
  items: RailItem<K>[];
  value: K;
  onChange: (key: K) => void;
  variant?: 'gold' | 'ink';
  size?: 'sm' | 'md';
  gutter?: number;
  /** What the rail sits on, so its ends can dissolve into it. */
  fadeColor?: string;
}) {
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  const layouts = useRef<Record<string, { x: number; w: number }>>({});
  const viewportW = useRef(0);
  const scrollX = useRef(0);

  const plateX = useSharedValue(0);
  const plateW = useSharedValue(0);
  const shown = useSharedValue(0);
  // Drives the end fades: a rail with more options than fit should dissolve
  // at the edge it can still travel towards, not stop at a flat cut.
  const offset = useSharedValue(0);
  const maxOffset = useSharedValue(0);

  const small = size === 'sm';
  const height = small ? 32 : 38;
  const radius = height / 2;

  // Move the plate, and bring the chosen option into view when it sits
  // outside the window — a jump from a category row can target a segment
  // far off the right edge.
  const settle = useCallback(
    (key: K, animate: boolean) => {
      const l = layouts.current[key];
      if (!l) return;

      if (animate && !reduceMotion) {
        plateX.value = withSpring(l.x, RAIL_SPRING);
        plateW.value = withSpring(l.w, RAIL_SPRING);
      } else {
        plateX.value = l.x;
        plateW.value = l.w;
      }
      shown.value = withTiming(1, { duration: 180 });

      const vw = viewportW.current;
      if (vw > 0) {
        const left = l.x - scrollX.current;
        const right = left + l.w;
        if (left < 12 || right > vw - 12) {
          scrollRef.current?.scrollTo({
            x: Math.max(0, l.x - (vw - l.w) / 2),
            animated: !reduceMotion,
          });
        }
      }
    },
    [plateW, plateX, reduceMotion, shown],
  );

  useEffect(() => {
    settle(value, true);
  }, [value, settle]);

  const plate = useAnimatedStyle(() => ({
    transform: [{ translateX: plateX.value }],
    width: plateW.value,
    opacity: shown.value,
  }));
  const fadeLeft = useAnimatedStyle(() => ({
    opacity: interpolate(offset.value, [0, 14], [0, 1], 'clamp'),
  }));
  const fadeRight = useAnimatedStyle(() => ({
    opacity: interpolate(maxOffset.value - offset.value, [0, 14], [0, 1], 'clamp'),
  }));

  return (
    <View style={rail.wrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={e => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          scrollX.current = contentOffset.x;
          offset.value = contentOffset.x;
          maxOffset.value = Math.max(0, contentSize.width - layoutMeasurement.width);
        }}
        onContentSizeChange={w => {
          maxOffset.value = Math.max(0, w - viewportW.current);
        }}
        onLayout={e => {
          viewportW.current = e.nativeEvent.layout.width;
          // Segments lay out before their scroller does, so the very first
          // settle ran without a viewport to measure against. Re-run it now
          // that we have one, or a chosen segment sitting past the right
          // edge — Success Rate, say — never shows itself on first paint.
          settle(value, false);
        }}
        contentContainerStyle={[rail.scroller, { paddingHorizontal: gutter }]}
      >
        <View style={[rail.track, { borderRadius: radius + 3, minHeight: height + 6 }]}>
          {/* The plate and the segments must share one coordinate space, or
              the plate lands offset from the label it is meant to sit under.
              This inner box carries no border and no padding, so a segment's
              measured x and the plate's absolute origin agree exactly. */}
          <View style={rail.trackInner}>
          <Animated.View style={[rail.plate, { height, borderRadius: radius }, plate]}>
            <LinearGradient
              colors={
                variant === 'gold'
                  ? ['#EBCB90', '#C5A059', '#A87E33']
                  : ['#4A423A', '#2F2823', '#1C1714']
              }
              locations={[0, 0.55, 1]}
              start={{ x: 0.12, y: 0 }}
              end={{ x: 0.88, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
            />
            {/* The struck face: a light catch across the top third */}
            <LinearGradient
              colors={['rgba(255,252,240,0.42)', 'rgba(255,252,240,0)']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
            />
            <View
              style={[
                StyleSheet.absoluteFill,
                rail.plateRim,
                {
                  borderRadius: radius,
                  borderColor:
                    variant === 'gold' ? 'rgba(255,244,214,0.55)' : 'rgba(255,255,255,0.14)',
                },
              ]}
            />
          </Animated.View>

          {items.map(item => (
            <RailSegment
              key={item.key}
              label={item.label}
              active={item.key === value}
              height={height}
              small={small}
              onLayout={e => {
                const { x, width } = e.nativeEvent.layout;
                layouts.current[item.key] = { x, w: width };
                if (item.key === value) settle(item.key, false);
              }}
              onPress={() => onChange(item.key)}
            />
          ))}
          </View>
        </View>
      </ScrollView>

      <Animated.View style={[rail.fade, rail.fadeLeft, { width: gutter + 16 }, fadeLeft]} pointerEvents="none">
        <LinearGradient
          colors={[fadeColor, `${fadeColor}00`]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View style={[rail.fade, rail.fadeRight, { width: gutter + 16 }, fadeRight]} pointerEvents="none">
        <LinearGradient
          colors={[`${fadeColor}00`, fadeColor]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

function RailSegment({
  label,
  active,
  height,
  small,
  onPress,
  onLayout,
}: {
  label: string;
  active: boolean;
  height: number;
  small: boolean;
  onPress: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
}) {
  const reduceMotion = useReducedMotion();
  const on = useSharedValue(active ? 1 : 0);
  const press = useSharedValue(0);

  useEffect(() => {
    on.value = reduceMotion
      ? active
        ? 1
        : 0
      : withTiming(active ? 1 : 0, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [on, active, reduceMotion]);

  const body = useAnimatedStyle(() => ({ transform: [{ scale: 1 - press.value * 0.04 }] }));
  const label$ = useAnimatedStyle(() => ({
    color: interpolateColor(on.value, [0, 1], [A.muted, '#FFFDF6']),
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        press.value = withTiming(1, { duration: 90 });
      }}
      onPressOut={() => {
        press.value = withTiming(0, { duration: 170 });
      }}
      onLayout={onLayout}
    >
      <Animated.View
        style={[rail.segment, { height, paddingHorizontal: small ? 14 : 17 }, body]}
      >
        <Animated.Text style={[small ? rail.labelSm : rail.label, label$]} numberOfLines={1}>
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const rail = StyleSheet.create({
  // The scroller carries 12pt of vertical room so the plate's glow lands
  // inside the clip bounds and fades out instead of being sliced flat; the
  // negative margin hands most of that room back to the page's rhythm.
  wrap: { marginVertical: -10 },
  scroller: { paddingVertical: 12 },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    backgroundColor: '#F7F3EA',
    borderWidth: 1,
    borderColor: '#EBE4D5',
    borderCurve: 'continuous',
  },
  trackInner: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  plate: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderCurve: 'continuous',
    shadowColor: '#8A6520',
    shadowOpacity: 0.34,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 9,
    elevation: 3,
  },
  plateRim: { borderWidth: 1, borderCurve: 'continuous' },
  fade: { position: 'absolute', top: 12, bottom: 12 },
  fadeLeft: { left: 0 },
  fadeRight: { right: 0 },
  segment: { alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: F.sansSemiBold, fontSize: 13.5, letterSpacing: 0.2 },
  labelSm: { fontFamily: F.sansSemiBold, fontSize: 12.5, letterSpacing: 0.2 },
});
