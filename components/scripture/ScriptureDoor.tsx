import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, Path, RadialGradient, Stop } from 'react-native-svg';
import { toHsl } from '@/components/shared/tone';
import { ribbonCardRhythm, sparkPath } from '@/components/shared/ribbonCardGeometry';

/* ─────────────────────────────────────────────────────────────
 * THE READER'S DOORS — Favorites, Bible Notes, Checkpoints.
 *
 * These three sit at the head of Holy Scripture, and they have to
 * be a bridge: behind them are the section cards on Library, Home
 * and Inner, which now have real depth, a mark of their own and
 * light that moves; ahead of them are the rooms they open, which
 * are quiet parchment. Left as they were, they belonged to
 * neither — pale plates whose ornament was printed at eight per
 * cent and could not be seen at all.
 *
 * So they take the CARD'S CONSTRUCTION and keep SCRIPTURE'S VOICE:
 *
 * · The ground runs corner to corner rather than straight down,
 *   and reaches a foot with some colour in it, so the plate reads
 *   as an object under light instead of a tint.
 *
 * · ⚠ BUT NOT THE CARD'S SATURATION. The section cards hold their
 *   colour at 70%+ because the app's card palette is vivid.
 *   Scripture's is deliberately not: its sage is 18% saturated and
 *   its gold 48%. Run those through the cards' floor and the page
 *   turns into a highlighter — the liturgical register becomes the
 *   coin register, which is the one thing it must never do. Here
 *   the floor is 40, and mostly it is the tone's own saturation
 *   that survives.
 *
 * · The ornament that was already there — rays for Favorites,
 *   ruling for the notebooks — is simply drawn so it can be seen,
 *   large and anchored at the outer edge the way a manuscript
 *   carries its flourish.
 *
 * · The mark stands IN a pool of light rather than ON a white
 *   disc. An emblem bleeding off the corner was tried first and
 *   thrown out: at this size it repeats the very icon already in
 *   the seat, and the same symbol twice on a 64pt tile reads as a
 *   mistake.
 *
 * · A few sparks, on the cards' own clock and spacing, because
 *   that is the thing the eye recognises from the screen it just
 *   came from. Three, not eight; these are doors, not cards.
 * ───────────────────────────────────────────────────────────── */

/** Scripture's floor. Far below the cards' 70 — see the note above. */
const GROUND_FLOOR = 40;
const INK_FLOOR = 34;

/** The tone at a chosen lightness, holding at least a little saturation. */
export function doorLit(hex: string, lightness: number, satFloor = GROUND_FLOOR): string {
  const { h, s } = toHsl(hex);
  return `hsl(${Math.round(h)} ${Math.round(Math.max(s, satFloor))}% ${lightness}%)`;
}

export function doorInk(hex: string, lightness: number, satFloor = INK_FLOOR): string {
  const { h, s } = toHsl(hex);
  return `hsl(${Math.round(h)} ${Math.round(Math.max(s, satFloor))}% ${lightness}%)`;
}

export type DoorMotifKind = 'rays' | 'counter' | 'ruling';

/** Where the seal sits, so its pool of light can be drawn on the ground. */
const SEAL = { size: 38, ring: 46 };

type SparkSpec = {
  /** distance from the plate's right edge (before any reserved room) */
  rx: number;
  y: number;
  size: number;
  phase: number;
  peak: number;
  turn: number;
};

/* The label sits centred on the left, so the free ground on a door is its two
 * right-hand corners. Three sparks, spaced as the cards space theirs. */
const DOOR_SPARKS: SparkSpec[] = [
  { rx: 28, y: 7, size: 9, phase: 0.0, peak: 0.55, turn: 12 },
  { rx: 56, y: 47, size: 7, phase: 0.34, peak: 0.4, turn: -8 },
  { rx: 12, y: 40, size: 6, phase: 0.68, peak: 0.46, turn: 20 },
];

const SPARK_WINDOW = 0.42;
const SPARK_PERIOD = 10000;

const AnimatedPath = Animated.createAnimatedComponent(Path);

function Spark({
  d, peak, phase, clock, color, still,
}: {
  d: string;
  peak: number;
  phase: number;
  clock: SharedValue<number>;
  color: string;
  still: boolean;
}) {
  const animatedProps = useAnimatedProps(() => {
    if (still) return { opacity: peak * 0.5 };
    const p = (clock.value + phase) % 1;
    const on = p < SPARK_WINDOW ? Math.sin((p / SPARK_WINDOW) * Math.PI) : 0;
    return { opacity: on * peak };
  });
  return <AnimatedPath d={d} fill={color} animatedProps={animatedProps} />;
}

/**
 * Everything decorative on a door, in one surface: the pool of light under
 * the seal, the flourish along the outer edge, and the sparks.
 */
export function DoorGround({
  tint, motif, index = 0, reserveRight = 0, sealLeft = 12, active = true,
}: {
  tint: string;
  motif: DoorMotifKind;
  /** its place in the row, so the three doors do not twinkle in unison */
  index?: number;
  /** room held for a trailing control, so no spark hides behind it */
  reserveRight?: number;
  sealLeft?: number;
  active?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const running = active && !reduceMotion;
  const rhythm = ribbonCardRhythm(index);
  const clock = useSharedValue(0);
  const duration = SPARK_PERIOD * rhythm.stretch;

  useEffect(() => {
    if (!running) {
      cancelAnimation(clock);
      return;
    }
    clock.value = 0;
    clock.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(clock);
  }, [clock, duration, running]);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = useCallback((e: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width, height } = e.nativeEvent.layout;
    setSize(prev =>
      Math.abs(prev.w - width) < 0.5 && Math.abs(prev.h - height) < 0.5 ? prev : { w: width, h: height });
  }, []);

  const { w, h } = size;
  const ready = w > 0 && h > 0;
  const glowId = `door-glow-${motif}-${Math.round(w)}-${index}`;

  const ornament = doorInk(tint, 46);
  const sparkColor = doorInk(tint, 50);
  const cx = sealLeft + SEAL.size / 2;
  const cy = h / 2;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      <LinearGradient
        colors={[doorLit(tint, 98), doorLit(tint, 93), doorLit(tint, 87, 44)]}
        locations={[0, 0.46, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.ground}
      />

      {ready && (
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id={glowId} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
              <Stop offset="0.46" stopColor={doorLit(tint, 93, 44)} stopOpacity={0.8} />
              <Stop offset="1" stopColor={doorLit(tint, 90, 44)} stopOpacity={0} />
            </RadialGradient>
          </Defs>

          {/* The pool the mark stands in. */}
          <Circle cx={cx} cy={cy} r={31} fill={`url(#${glowId})`} />

          {/* The flourish, along the far edge, drawn to be seen.
           *
           * ⚠ Ruling is for the WIDE door only. Horizontal rules running
           * behind horizontal type read as a mis-registered second setting of
           * the text — the same fault the Old Testament book cards hit, and
           * the same answer: on a narrow door the lines lean instead, and
           * lean the other way from Favorites so the two are never confused. */}
          {motif !== 'ruling'
            ? Array.from({ length: 7 }).map((_, i) => {
              const lean = motif === 'rays' ? -42 : 42;
              const x = motif === 'rays' ? w + 8 - i * 17 : w - 50 + i * 17;
              return (
                <Line
                  key={i}
                  x1={x} y1={-8} x2={x + lean} y2={h + 8}
                  stroke={ornament} strokeOpacity={0.2 - i * 0.022} strokeWidth={1.1}
                />
              );
            })
            : (
              <>
                {Array.from({ length: 5 }).map((_, i) => {
                  const y = 9 + i * 13;
                  return (
                    <Line
                      key={i}
                      x1={w - 104} y1={y} x2={w - 6} y2={y}
                      stroke={ornament} strokeOpacity={0.2 - i * 0.03} strokeWidth={1.1}
                    />
                  );
                })}
                <Line
                  x1={w - 110} y1={4} x2={w - 110} y2={h - 4}
                  stroke={ornament} strokeOpacity={0.16} strokeWidth={1.1}
                />
              </>
            )}

          {DOOR_SPARKS.map((spark, i) => {
            const x = w - reserveRight - spark.rx - spark.size;
            if (x < cx + 24) return null;
            return (
              <Spark
                key={i}
                d={sparkPath(x, spark.y, spark.size, spark.turn)}
                peak={spark.peak}
                phase={spark.phase + rhythm.offset}
                clock={clock}
                color={sparkColor}
                still={!running}
              />
            );
          })}
        </Svg>
      )}

      {/* The pane of light on the shoulder — corner to corner, transparent
          well before it ends, so it never rules a line across the plate. */}
      <LinearGradient
        colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']}
        locations={[0, 0.58]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.ground}
      />

      {/* The manuscript's double rule. */}
      <View style={[s.rule, { borderColor: doorLit(tint, 78, 40) }]} />
      <View style={[s.ruleInner, { borderColor: doorLit(tint, 86, 36) }]} />
      <View style={s.litEdge} />
    </View>
  );
}

/**
 * The seal: two rings and the mark standing inside them.
 *
 * There is no white disc behind it — the pool of light on the ground is what
 * carries it. A mark ON a disc is a sticker; the same mark IN light is
 * illuminated, and that difference is most of what this screen is.
 */
export function DoorSeal({
  tint, Icon, size = 17, width = 2.1,
}: {
  tint: string;
  Icon: React.ComponentType<{ s?: number; c?: string; w?: number }>;
  size?: number;
  width?: number;
}) {
  return (
    <View style={s.seal}>
      <View pointerEvents="none" style={[s.sealHalo, { borderColor: doorLit(tint, 82, 36) }]} />
      <View pointerEvents="none" style={[s.sealRing, { borderColor: doorInk(tint, 58) }]} />
      <Icon s={size} c={doorInk(tint, 34)} w={width} />
    </View>
  );
}

const s = StyleSheet.create({
  ground: { position: 'absolute', top: 1, left: 1, right: 1, bottom: 1, borderRadius: 18 },
  rule: {
    position: 'absolute', top: 5, left: 5, right: 5, bottom: 5,
    borderRadius: 14, borderWidth: 1,
  },
  ruleInner: {
    position: 'absolute', top: 8, left: 8, right: 8, bottom: 8,
    borderRadius: 11, borderWidth: 1,
  },
  litEdge: {
    position: 'absolute', top: 1, left: 12, right: 12, height: 1,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  seal: {
    width: SEAL.size,
    height: SEAL.size,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sealHalo: {
    position: 'absolute',
    width: SEAL.ring,
    height: SEAL.ring,
    borderRadius: SEAL.ring / 2,
    borderWidth: 1,
  },
  sealRing: {
    position: 'absolute',
    width: SEAL.size,
    height: SEAL.size,
    borderRadius: SEAL.size / 2,
    borderWidth: 1,
  },
});
