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
 * It now inverts the doors on every count. They are pale, ruled and
 * quiet; this is INK, and it carries a struck coin. In this app a
 * task is minted — the sheet it opens is a mint, and the streaks it
 * feeds are currency — so the mark here is a coin catching light,
 * not an icon in a nimbus. Where a door offers a ghost chevron,
 * this offers a filled orb.
 *
 * ⚠ ONE LOOK, NO VARIANTS, and no tint borrowed from the host
 * screen. It was once split into 'soft' and 'scripture' and the same
 * button looked like two different buttons depending on where you
 * met it. Ink is what lets a single treatment sit well on Scripture's
 * parchment, on the Prayer Book's page, on Journal's white and on
 * Ideal Self's gold: it belongs to none of them and argues with none
 * of them. Everything is drawn inside this file, so no caller can
 * produce a different card by forgetting an argument.
 * ───────────────────────────────────────────────────────────── */

const PLATE = ['#2A2318', '#1E1911', '#15110B'] as const;
const EDGE = '#4A3C22';
const COIN = 44;
/** Where the coin sits: the plate's left padding plus its own half. */
const COIN_CX = 14 + COIN / 2;

const TITLE = '#F3E6C9';
const SUBTITLE = '#B49F76';
const SPARK_TONE = '#E3C88A';

/** Distance from the right edge, before the room held for the orb. */
const SPARKS = [
  { rx: 8, y: 12, size: 9, phase: 0.0, peak: 0.62, turn: 12 },
  { rx: 40, y: 46, size: 7, phase: 0.34, peak: 0.44, turn: -8 },
  { rx: 66, y: 24, size: 6, phase: 0.68, peak: 0.5, turn: 20 },
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
          colors={['rgba(229,200,138,0.10)', 'rgba(229,200,138,0)']}
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
              {/* The light the coin sits in. */}
              <RadialGradient id="task-glow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={SPARK_TONE} stopOpacity={0.22} />
                <Stop offset="1" stopColor={SPARK_TONE} stopOpacity={0} />
              </RadialGradient>
              {/* And the light on its face: struck metal, lit from upper left. */}
              <RadialGradient id="task-coin" cx="34%" cy="30%" r="72%">
                <Stop offset="0" stopColor="#F2DFAE" />
                <Stop offset="0.46" stopColor="#C9A55C" />
                <Stop offset="1" stopColor="#95722E" />
              </RadialGradient>
            </Defs>

            <Circle cx={COIN_CX} cy={h / 2} r={38} fill="url(#task-glow)" />
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

        {/* The coin's face. Its disc is struck on the plate above, so this
            only carries the mark and the bright rim along its edge. */}
        <View style={s.coin} pointerEvents="none">
          <View style={s.coinLip} />
          <CalendarCheck s={19} c="#3B2E14" w={2.1} />
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
          colors={['#DCBC7C', '#AF8A3E']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={s.orb}
        >
          <View style={s.orbTilt}>
            <ArrowUpRight s={15} c="#211A0B" w={2.6} />
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
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 3,
  },
  // On ink the top edge catches warm light, not white.
  litEdge: {
    position: 'absolute',
    top: 1,
    left: 14,
    right: 14,
    height: 1,
    backgroundColor: 'rgba(240,220,168,0.34)',
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
    borderColor: 'rgba(255,244,214,0.45)',
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
    borderColor: 'rgba(255,248,225,0.32)',
  },
  orbTilt: { transform: [{ rotate: '-15deg' }] },
});
