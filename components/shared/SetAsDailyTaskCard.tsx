import { useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
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
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { ArrowUpRight, CalendarCheck } from '@/components/icons/Icons';
import { F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { sparkPath } from '@/components/shared/ribbonCardGeometry';

/* ─────────────────────────────────────────────────────────────
 * SET AS DAILY TASK — one element, four screens.
 *
 * It appears at the foot of Holy Scripture, Prayer Book, Journal
 * and Ideal Self, and it is the only thing in that position that
 * DOES something rather than going somewhere. It used to be drawn
 * in Scripture's own hand — parchment plate, double rule, haloed
 * icon, ghost chevron — so on Scripture it read as a fourth door in
 * a row of three, and on the other three screens it read as a piece
 * of Scripture that had wandered in.
 *
 * ⚠ IT IS NOT DARK. A near-black plate was built first and was
 * wrong: ink is already spoken for in this app — it is the Journal
 * streak room's language, and `ROUTINE_TASK_ACCENT` in the very sheet
 * this button opens. On four screens that are all light it read as a
 * hole rather than an action.
 *
 * What it is instead is the app's OWN action colour, which was there
 * all along: `PrimaryButton` in SetAsTaskSheet commits on a solid
 * `C.gold` fill under a gold glow. That is what this now wears —
 * C.gold as the middle stop of a plate lifted at the shoulder and
 * deepened at the foot, and the same gold glow beneath it. Against
 * the doors, which are pale gold at 87–98% lightness, a fill at 56%
 * is a different object entirely, not a louder door.
 *
 * The mark is an ivory seal rather than an icon in a nimbus: in this
 * app a task is minted — the sheet it opens is a mint, the streaks it
 * feeds are currency. And where a door offers a ghost chevron, this
 * offers a filled orb.
 *
 * ⚠ ONE LOOK, NO VARIANTS, and no tint borrowed from the host screen.
 * It was once split into 'soft' and 'scripture' and the same button
 * looked like two different buttons depending on where you met it.
 * Everything is drawn inside this file, so no caller can produce a
 * different card by forgetting an argument.
 * ───────────────────────────────────────────────────────────── */

/* The app's action gold, lifted at the shoulder and deepened at the foot.
 * `C.gold` itself is the middle stop — this is that colour under light, not
 * a new one. */
const PLATE = ['#D9BC7C', '#C5A059', '#AC8742'] as const;
const EDGE = 'rgba(140,108,45,0.38)';
/** The glow the app puts under every committing button. */
const GLOW = '#C5A059';
const COIN = 42;
/** Where the coin sits: the plate's left padding plus its own half. */
const COIN_CX = 14 + COIN / 2;

const TITLE = '#3F2B08';
const SUBTITLE = '#6B4E14';
const SPARK_TONE = '#FFF6DC';

/** Distance from the right edge, before the room held for the orb. */
const SPARKS = [
  { rx: 8, y: 12, size: 9, phase: 0.0, peak: 0.6, turn: 12 },
  { rx: 44, y: 44, size: 7, phase: 0.42, peak: 0.42, turn: -8 },
];
const WINDOW = 0.42;
const PERIOD = 11000;
/** The orb is opaque; nothing may be drawn behind it. */
const ORB_ROOM = 54;
/**
 * How far the copy can reach. The type does not scale with the plate — it
 * starts at 72 (padding, coin, gap) and the longest line the card carries
 * runs about 140pt at a fixed size — so on a narrow host a spark measured
 * from the right edge would walk backwards into the words. Measured from the
 * type instead, it simply drops out.
 */
const COPY_END = 216;

const AnimatedPath = Animated.createAnimatedComponent(Path);

function Spark({
  d, peak, phase, clock, still,
}: {
  d: string;
  peak: number;
  phase: number;
  clock: SharedValue<number>;
  still: boolean;
}) {
  const animatedProps = useAnimatedProps(() => {
    if (still) return { opacity: peak * 0.5 };
    const p = (clock.value + phase) % 1;
    const on = p < WINDOW ? Math.sin((p / WINDOW) * Math.PI) : 0;
    return { opacity: on * peak };
  });
  return <AnimatedPath d={d} fill={SPARK_TONE} animatedProps={animatedProps} />;
}

type Props = {
  onPress: () => void;
  title?: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
  textMaxFontSizeMultiplier?: number;
};

export default function SetAsDailyTaskCard({
  onPress,
  title = 'Set as Daily Task',
  subtitle = 'Add to your daily routine',
  style,
  textMaxFontSizeMultiplier = 1.08,
}: Props) {
  const reduceMotion = useReducedMotion();
  const clock = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    clock.value = 0;
    clock.value = withRepeat(withTiming(1, { duration: PERIOD, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(clock);
  }, [clock, reduceMotion]);

  const [plate, setPlate] = useState({ w: 0, h: 0 });
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setPlate(prev =>
      Math.abs(prev.w - width) < 0.5 && Math.abs(prev.h - height) < 0.5
        ? prev
        : { w: width, h: height });
  }, []);

  const { w, h } = plate;
  const measured = w > 0 && h > 0;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={style}>
      <LinearGradient
        colors={PLATE}
        locations={[0, 0.52, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.card}
        onLayout={onLayout}
      >
        {/* A warm pane on the shoulder — corner to corner, and transparent
            well before it ends, so it never rules a line across the plate. */}
        <LinearGradient
          colors={['rgba(255,255,255,0.42)', 'rgba(255,255,255,0)']}
          locations={[0, 0.56]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View pointerEvents="none" style={s.litEdge} />

        {measured && (
          <Svg pointerEvents="none" width={w} height={h} style={StyleSheet.absoluteFill}>
            <Defs>
              {/* The light the seal sits in. */}
              <RadialGradient id="task-glow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.34} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
              </RadialGradient>
              {/* The seal itself: ivory, lit from the upper left. */}
              <RadialGradient id="task-coin" cx="34%" cy="28%" r="76%">
                <Stop offset="0" stopColor="#FFFDF6" />
                <Stop offset="0.55" stopColor="#FBF2DE" />
                <Stop offset="1" stopColor="#EFE0BE" />
              </RadialGradient>
            </Defs>

            <Circle cx={COIN_CX} cy={h / 2} r={36} fill="url(#task-glow)" />
            <Circle cx={COIN_CX} cy={h / 2} r={COIN / 2} fill="url(#task-coin)" />

            {SPARKS.map((spark, i) => {
              const x = w - ORB_ROOM - spark.rx - spark.size;
              if (x < COPY_END) return null;
              return (
                <Spark
                  key={i}
                  d={sparkPath(x, spark.y, spark.size, spark.turn)}
                  peak={spark.peak}
                  phase={spark.phase}
                  clock={clock}
                  still={reduceMotion}
                />
              );
            })}
          </Svg>
        )}

        {/* The seal's face. Its disc is drawn on the plate above, so this
            only carries the mark and the hairline around its edge. */}
        <View style={s.coin} pointerEvents="none">
          <View style={s.coinLip} />
          <CalendarCheck s={19} c="#7A5A17" w={2.1} />
        </View>

        <View style={s.copy}>
          <Text
            style={s.title}
            allowFontScaling={false}
            maxFontSizeMultiplier={textMaxFontSizeMultiplier}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.82}
          >
            {title}
          </Text>
          <Text
            style={s.subtitle}
            allowFontScaling={false}
            numberOfLines={1}
            maxFontSizeMultiplier={textMaxFontSizeMultiplier}
            adjustsFontSizeToFit
            minimumFontScale={0.82}
          >
            {subtitle}
          </Text>
        </View>

        <LinearGradient
          colors={['#4A3410', '#2E1F06']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={s.orb}
        >
          <View style={s.orbTilt}>
            <ArrowUpRight s={15} c="#F5E9C8" w={2.6} />
          </View>
        </LinearGradient>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    // Taller than the doors' 64 on purpose: this is the one thing in the
    // column that acts, and it carries a little more weight than the things
    // that merely open.
    minHeight: 70,
    gap: 14,
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: EDGE,
    paddingHorizontal: 14,
    paddingVertical: 12,
    overflow: 'hidden',
    position: 'relative',
    // The gold glow the app puts under every committing button — this is the
    // signal that separates an action from a plate, and it is already the
    // app's own (see PrimaryButton in SetAsTaskSheet).
    shadowColor: GLOW,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.34,
    shadowRadius: 18,
    elevation: 4,
  },
  // On ink the top edge catches warm light, not white.
  litEdge: {
    position: 'absolute',
    top: 1,
    left: 14,
    right: 14,
    height: 1,
    backgroundColor: 'rgba(255,251,238,0.55)',
  },
  coin: {
    width: COIN,
    height: COIN,
    borderRadius: COIN / 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  // The struck rim: a bright hairline around the disc.
  coinLip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: COIN / 2,
    borderWidth: 1,
    borderColor: 'rgba(122,90,23,0.18)',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 2,
  },
  title: {
    fontFamily: F.serifMedium,
    fontSize: 17,
    lineHeight: 21,
    color: TITLE,
  },
  subtitle: {
    marginTop: 2,
    fontFamily: F.serif,
    fontSize: 12.5,
    lineHeight: 16,
    color: SUBTITLE,
  },
  orb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,246,220,0.26)',
  },
  orbTilt: { transform: [{ rotate: '-15deg' }] },
});
