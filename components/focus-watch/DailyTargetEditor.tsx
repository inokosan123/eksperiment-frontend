import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';
import { ChevronRight, Shield } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import DayGauge from './DayGauge';
import HairlineWeave from './HairlineWeave';
import LimitSlider from './LimitSlider';
import GoldButton from './GoldButton';
import { formatMinutesShort } from './dayPlanStore';

// 1h → 8h30 in 15-min steps; anything past that is "No limit".
const TARGET_STOPS: (number | null)[] = [
  ...Array.from({ length: 31 }, (_, index) => 60 + index * 15),
  null,
];
const YEAR_DAYS = 365;
const SLEEP_DAYS = Math.round((8 / 24) * YEAR_DAYS);
// Fewer columns → chunkier beads you can't unsee. Each bead is one day of the
// year; the dark block of phone-days is the pain point, so it reads big.
// 29 columns: still 13 rows, but the year ends on a 17-bead row instead of a
// 5-bead stub — it reads finished now that the beads sit on a plate.
const WEEK_COLS = 29;
const BEAD_SIZE = 7.3;
const BEAD_ROW_H = 11;
const RING_SIZE = 12.6;
const SHINE_W = 86;
const TOLERANCE_SPAN = 180;
const DEFAULT_TOLERANCE = 120;
const GLIDE = { duration: 620, easing: Easing.out(Easing.cubic) };
const GOAL_COLOR = '#1B1C1E';
const TOLERANCE_COLOR = '#9EA4AB';
const ESSENTIALS_COLOR = '#E14B5A';
const PRODUCTIVE_COLOR = '#D3A33B';
const SLEEP_COLOR = '#BFB0E4';
const TROPHY_EMBLEM = require('@/assets/animations/challenge-trophy-preview.png');

export type TargetValues = {
  target: number | null;
  tolerable: number | null;
  essentialOnly: number | null;
};

function withAlpha(hex: string, alpha: number): string {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

function rangeStops(from: number, to: number): number[] {
  const stops: number[] = [];
  for (let value = from; value <= to; value += 15) stops.push(value);
  return stops;
}

// A soft radial bloom. Rose behind the cost figure, gold behind the title —
// the app already lights its wow moments this way (trophy rays, streak hearth).
function Bloom({ color, opacity = 0.5 }: { color: string; opacity?: number }) {
  const id = `bloom-${color.replace('#', '')}`;
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
          <Stop offset="55%" stopColor={color} stopOpacity={opacity * 0.34} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx="50" cy="50" rx="50" ry="50" fill={`url(#${id})`} />
    </Svg>
  );
}

// The cost figure doesn't snap to its new value — it runs there. An exponential
// chase, so dragging the slider keeps the digits alive without ever jumping,
// and the first appearance counts up from nothing.
function useChasedNumber(target: number, reduceMotion: boolean) {
  const [display, setDisplay] = useState(reduceMotion ? target : 0);
  const currentRef = useRef(reduceMotion ? target : 0);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    if (reduceMotion) {
      currentRef.current = target;
      setDisplay(target);
      return;
    }
    let frame = 0;
    let last = Date.now();
    // Only whole days ever reach state: the card re-renders a few dozen times
    // across a count, not once per frame.
    const publish = (value: number) => setDisplay(previous => (previous === value ? previous : value));
    const tick = () => {
      const now = Date.now();
      const dt = Math.min(64, now - last);
      last = now;
      const diff = targetRef.current - currentRef.current;
      if (Math.abs(diff) < 0.4) {
        currentRef.current = targetRef.current;
        publish(targetRef.current);
        return;
      }
      currentRef.current += diff * (1 - Math.exp(-dt / 110));
      publish(Math.round(currentRef.current));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduceMotion, target]);

  return display;
}

// A slow glint of light that crosses the year every few seconds — the same
// polish the trophy card gets, laid over 365 beads so the plate feels alive.
function YearShine({
  width,
  height,
  reduceMotion,
}: {
  width: number;
  height: number;
  reduceMotion: boolean;
}) {
  const travel = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || width <= 0) return;
    travel.value = 0;
    travel.value = withRepeat(
      withSequence(
        withDelay(2600, withTiming(1, { duration: 1650, easing: Easing.inOut(Easing.quad) })),
        withTiming(0, { duration: 0 }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(travel);
  }, [reduceMotion, travel, width]);

  const style = useAnimatedStyle(() => ({
    opacity: travel.value > 0 && travel.value < 1 ? 1 : 0,
    transform: [
      { translateX: -SHINE_W + travel.value * (width + SHINE_W * 2) },
      { rotate: '14deg' },
    ],
  }));

  if (reduceMotion || width <= 0 || height <= 0) return null;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.shineClip]}>
      <Animated.View style={[s.shineBand, { height: height * 1.7, top: -height * 0.35 }, style]}>
        <LinearGradient
          colors={['rgba(255,247,224,0)', 'rgba(255,250,235,0.62)', 'rgba(255,247,224,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

// The last phone-day of the year, ringed in gold: a marker that travels bead by
// bead as you move the goal, so you watch the boundary of the loss move.
function FrontierRing({
  phoneEnd,
  cellWidth,
  visible,
  reduceMotion,
}: {
  phoneEnd: SharedValue<number>;
  cellWidth: number;
  visible: boolean;
  reduceMotion: boolean;
}) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || !visible) {
      pulse.value = 0.5;
      return;
    }
    pulse.value = 0;
    pulse.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion, visible]);

  // No scale — small ringed views pixelate on Android. Position and opacity only.
  const style = useAnimatedStyle(() => {
    const index = Math.max(0, Math.round(phoneEnd.value) - 1);
    const row = Math.floor(index / WEEK_COLS);
    const column = index % WEEK_COLS;
    return {
      opacity: 0.34 + pulse.value * 0.5,
      transform: [
        { translateX: column * cellWidth + cellWidth / 2 - RING_SIZE / 2 },
        { translateY: row * BEAD_ROW_H + BEAD_ROW_H / 2 - RING_SIZE / 2 },
      ],
    };
  });

  if (!visible || cellWidth <= 0) return null;
  return <Animated.View pointerEvents="none" style={[s.frontierRing, style]} />;
}

// ————— One year of days; the phone's share and its buffer glide in and out. —————
// Memoised: the row's props never change while the tally counts, so a re-render
// of the card doesn't reconcile hundreds of beads.
const YearDotRow = memo(function YearDotRow({
  row,
  cellWidth,
  phoneEnd,
  bufferEnd,
}: {
  row: number;
  cellWidth: number;
  phoneEnd: SharedValue<number>;
  bufferEnd: SharedValue<number>;
}) {
  const startIndex = row * WEEK_COLS;
  const count = Math.min(WEEK_COLS, YEAR_DAYS - startIndex);
  const overlayStart = Math.max(0, Math.min(count, SLEEP_DAYS - startIndex));

  // Buffer dots draw first (behind), the darker phone dots slide over them.
  const bufferStyle = useAnimatedStyle(() => {
    const end = Math.max(overlayStart, Math.min(count, bufferEnd.value - startIndex));
    return { width: (end - overlayStart) * cellWidth };
  });
  const phoneStyle = useAnimatedStyle(() => {
    const end = Math.max(overlayStart, Math.min(count, phoneEnd.value - startIndex));
    return { width: (end - overlayStart) * cellWidth };
  });

  return (
    <View style={{ flexDirection: 'row', height: BEAD_ROW_H }}>
      {Array.from({ length: count }).map((_, column) => (
        <View key={column} style={[s.dotCell, { width: cellWidth }]}>
          <View style={[s.yearDot, startIndex + column < SLEEP_DAYS ? s.dotSleep : s.dotAway]} />
        </View>
      ))}
      {overlayStart < count && (
        <>
          <Animated.View
            style={[
              { position: 'absolute', left: overlayStart * cellWidth, top: 0, bottom: 0, overflow: 'hidden', flexDirection: 'row' },
              bufferStyle,
            ]}
            pointerEvents="none"
          >
            {Array.from({ length: count - overlayStart }).map((_, column) => (
              <View key={column} style={[s.dotCell, { width: cellWidth }]}>
                <View style={[s.yearDot, s.dotBuffer]} />
              </View>
            ))}
          </Animated.View>
          <Animated.View
            style={[
              { position: 'absolute', left: overlayStart * cellWidth, top: 0, bottom: 0, overflow: 'hidden', flexDirection: 'row' },
              phoneStyle,
            ]}
            pointerEvents="none"
          >
            {Array.from({ length: count - overlayStart }).map((_, column) => (
              <View key={column} style={[s.dotCell, { width: cellWidth }]}>
                <View style={[s.yearDot, s.dotPhone]} />
              </View>
            ))}
          </Animated.View>
        </>
      )}
    </View>
  );
});

// The year in dark beads. `embedded` drops the card chrome so it can live
// fused under the day bar, or inside the target sheet.
function YearPerspective({
  target,
  toleranceDuration,
  embedded = false,
}: {
  target: number | null;
  toleranceDuration: number | null;
  embedded?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [fieldWidth, setFieldWidth] = useState(0);
  const phoneDays = target == null ? 0 : Math.round((target / 1440) * YEAR_DAYS);
  const bufferDays = target == null || toleranceDuration == null
    ? 0
    : Math.round((toleranceDuration / 1440) * YEAR_DAYS);
  // Both start empty at the sleep boundary, so the first paint grows the cost
  // out of the year instead of stamping it there.
  const phoneEnd = useSharedValue(reduceMotion ? SLEEP_DAYS + phoneDays : SLEEP_DAYS);
  const bufferEnd = useSharedValue(reduceMotion ? SLEEP_DAYS + phoneDays + bufferDays : SLEEP_DAYS);

  useEffect(() => {
    const nextPhone = SLEEP_DAYS + phoneDays;
    const nextBuffer = nextPhone + bufferDays;
    phoneEnd.value = reduceMotion ? nextPhone : withTiming(nextPhone, GLIDE);
    bufferEnd.value = reduceMotion ? nextBuffer : withTiming(nextBuffer, GLIDE);
  }, [phoneDays, bufferDays, phoneEnd, bufferEnd, reduceMotion]);

  const rows = Math.ceil(YEAR_DAYS / WEEK_COLS);
  const cellWidth = fieldWidth > 0 ? fieldWidth / WEEK_COLS : 0;
  // Two chased figures drive every number on the card; Life falls out of them,
  // so the whole tally moves as one.
  const shownPhone = useChasedNumber(phoneDays, reduceMotion);
  const shownBuffer = useChasedNumber(bufferDays, reduceMotion);
  const shownAway = Math.max(0, YEAR_DAYS - SLEEP_DAYS - shownPhone - shownBuffer);

  // The ember behind the number: it breathes at rest and flares on every change,
  // so the cost feels like it's smouldering rather than printed.
  const breath = useSharedValue(0);
  const flare = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      breath.value = 0.5;
      return;
    }
    breath.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(breath);
  }, [breath, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;
    flare.value = withSequence(
      withTiming(1, { duration: 170, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 780, easing: Easing.out(Easing.cubic) }),
    );
  }, [flare, phoneDays, bufferDays, reduceMotion]);

  const emberStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + breath.value * 0.12 + flare.value * 0.44,
  }));

  return (
    <View style={embedded ? s.yearWrapEmbedded : s.yearWrap}>
      <Animated.View
        style={s.wasteHero}
        entering={reduceMotion ? undefined : FadeIn.duration(420).easing(Easing.out(Easing.cubic))}
      >
        <View style={s.wasteHeadingRow}>
          <View style={s.wasteHeadingRule} />
          <Text style={s.wasteHeading}>YOU WASTE</Text>
          <View style={s.wasteHeadingRule} />
        </View>
        <View style={s.wasteFigureRow}>
          <Animated.View pointerEvents="none" style={[s.wasteEmber, emberStyle]}>
            <Bloom color="#A8354A" opacity={0.46} />
          </Animated.View>
          {/* The cost number owns the centre line; the tolerance hangs off it as
              a slashed annotation, mirrored by a ghost so nothing shifts. */}
          {target != null && bufferDays > 0 && (
            <View style={[s.wasteAnnex, s.wasteAnnexGhost]} pointerEvents="none">
              <View style={s.wasteSlash} />
              <Text style={s.wastePlus}>+{shownBuffer}</Text>
            </View>
          )}
          <Text style={s.wasteNumber}>{target == null ? '—' : shownPhone}</Text>
          {target != null && bufferDays > 0 && (
            <View style={s.wasteAnnex}>
              <View style={s.wasteSlash} />
              <Text style={s.wastePlus}>+{shownBuffer}</Text>
            </View>
          )}
        </View>
        <Text style={s.wasteUnit}>
          {target == null ? 'set a goal to see the cost' : 'full days, in one year'}
        </Text>
      </Animated.View>
      <Animated.View
        style={s.dotField}
        onLayout={event => setFieldWidth(event.nativeEvent.layout.width)}
        entering={reduceMotion ? undefined : FadeIn.delay(110).duration(460).easing(Easing.out(Easing.cubic))}
      >
        {/* The plate the year is inlaid on. Absolute, so it costs no height —
            the beads stay tucked under the figure. */}
        <View pointerEvents="none" style={s.dotPlate} />
        {cellWidth > 0 &&
          Array.from({ length: rows }).map((_, row) => (
            <YearDotRow key={row} row={row} cellWidth={cellWidth} phoneEnd={phoneEnd} bufferEnd={bufferEnd} />
          ))}
        <FrontierRing
          phoneEnd={phoneEnd}
          cellWidth={cellWidth}
          visible={target != null && phoneDays > 0}
          reduceMotion={reduceMotion}
        />
        <YearShine width={fieldWidth} height={rows * BEAD_ROW_H} reduceMotion={reduceMotion} />
      </Animated.View>
      <Animated.View
        style={s.legendBand}
        entering={reduceMotion ? undefined : FadeIn.delay(200).duration(460).easing(Easing.out(Easing.cubic))}
      >
        <View style={s.legendRule} />
        <View style={s.legendRow}>
          <LegendItem color={GOAL_COLOR} label="Phone" value={`${shownPhone}`} emphasis first />
          {bufferDays > 0 && <LegendItem color={TOLERANCE_COLOR} label="Tolerance" value={`${shownBuffer}`} />}
          <LegendItem color={PRODUCTIVE_COLOR} label="Life" value={`${shownAway}`} />
          <LegendItem color={SLEEP_COLOR} label="Sleep" value={`${SLEEP_DAYS}`} />
        </View>
        <View style={s.legendRule} />
      </Animated.View>
    </View>
  );
}

// A legend column: a haloed bead of the same colour it names, the count in
// serif, the name beneath — four of them read between two gold hairlines,
// like a line in an almanac rather than a boxed-in widget.
function LegendItem({
  color,
  label,
  value,
  emphasis = false,
  first = false,
}: {
  color: string;
  label: string;
  value: string;
  emphasis?: boolean;
  first?: boolean;
}) {
  return (
    <>
      {!first && <View style={s.legendDivider} />}
      <View style={s.legendItem}>
        <View style={s.legendHalo}>
          <View
            style={[s.legendHaloRing, { borderColor: color }, emphasis && s.legendHaloRingEmphasis]}
            pointerEvents="none"
          />
          <View
            style={[
              s.legendBead,
              { backgroundColor: color, boxShadow: `0 1px 6px ${withAlpha(color, emphasis ? 0.55 : 0.4)}` },
            ]}
          />
        </View>
        <Text style={[s.legendValue, emphasis && s.legendValueEmphasis]}>{value}</Text>
        <Text style={[s.legendLabel, emphasis && s.legendLabelEmphasis]}>{label}</Text>
      </View>
    </>
  );
}

// The hairline that parts GOAL from ESSENTIALS ONLY under the day bar, and the
// one that parts the legend columns: a rule broken by a small gold lozenge.
function GemDivider({ height = 34 }: { height?: number }) {
  return (
    <View style={[s.gemDivider, { height }]}>
      <View style={s.gemDividerLine} />
      <View style={s.gemDividerGem} />
      <View style={s.gemDividerLine} />
    </View>
  );
}

// A drawn swash under the card's title: two tapering curves meeting at a
// haloed gold gem, flanking beads and tip beads — the app's rule—◆—rule
// ornament, given a curve and a little more jewellery.
function TitleFlourish() {
  return (
    <Svg width={152} height={15} viewBox="0 0 152 15" style={s.flourish}>
      <Circle cx={76} cy={7.4} r={6.4} fill={C.gold} opacity={0.13} />
      <Path
        d="M9 6 C 25 12.6, 47 12.6, 65 7.8"
        stroke={C.gold}
        strokeWidth={1.3}
        strokeLinecap="round"
        fill="none"
        opacity={0.85}
      />
      <Path
        d="M87 7.8 C 105 12.6, 127 12.6, 143 6"
        stroke={C.gold}
        strokeWidth={1.3}
        strokeLinecap="round"
        fill="none"
        opacity={0.85}
      />
      <Path d="M76 1.6 L 81.4 7.4 L 76 13.2 L 70.6 7.4 Z" fill={C.goldDark} />
      <Path d="M76 3.5 L 78.6 7.4 L 76 8.6 L 73.4 7.4 Z" fill={C.goldSoft} opacity={0.9} />
      <Circle cx={65} cy={7.6} r={1.55} fill={C.gold} />
      <Circle cx={87} cy={7.6} r={1.55} fill={C.gold} />
      <Circle cx={9} cy={6} r={1.4} fill={C.gold} opacity={0.6} />
      <Circle cx={143} cy={6} r={1.4} fill={C.gold} opacity={0.6} />
    </Svg>
  );
}

// The day, drawn on the app's own Screen Time instrument — the same gauge the
// trophy-streak card wears: trophy on the goal tick, the tolerance span tagged,
// a red barred circle where the phone closes. Usage is null here: this is the
// plan's shape, not a lived day, so no fill creeps across it.
function DayShape({
  target,
  toleranceEnd,
  essentialsOnly = false,
}: {
  target: number;
  toleranceEnd: number;
  essentialsOnly?: boolean;
}) {
  return (
    <View>
      <DayGauge
        goalMinutes={target}
        toleranceEndMinutes={toleranceEnd}
        usedMinutes={null}
        accent={C.goldDark}
        labelColor="#8A6A2F"
        goalTrackColor="#F1E7D2"
        height={14}
      />

      {/* Two halves of the same statement, each centred in its own column and
          parted by a gold-gemmed hairline. */}
      <View style={s.barCaptionRow}>
        <View style={s.captionCell}>
          <Text style={s.captionLabel}>GOAL</Text>
          <Text style={s.captionValue}>{formatMinutesShort(target)}</Text>
        </View>
        <GemDivider height={40} />
        <View style={s.captionCell}>
          <Text style={[s.captionLabel, s.captionLabelLock]}>
            {essentialsOnly ? 'ESSENTIALS ONLY' : 'ESSENTIALS ONLY AT'}
          </Text>
          <Text style={[s.captionValue, s.captionValueLock]}>
            {essentialsOnly ? 'All day' : formatMinutesShort(toleranceEnd)}
          </Text>
        </View>
      </View>

      {essentialsOnly && (
        <View style={s.alwaysProtectedBand}>
          <View style={s.alwaysProtectedDot} />
          <Text style={s.alwaysProtectedText}>ONLY YOUR ESSENTIALS OPEN — ALL DAY</Text>
        </View>
      )}
    </View>
  );
}

// ————— The tap-to-set sheet: slider on top, the year beads living below it. —————
function TargetSheet({
  visible,
  title,
  accent,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  accent: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  useEffect(() => {
    if (!mounted) return;

    if (visible) {
      progress.value = 0;
      progress.value = withTiming(1, {
        duration: reducedMotion ? 1 : 260,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    progress.value = withTiming(0, {
      duration: reducedMotion ? 1 : 210,
      easing: Easing.in(Easing.cubic),
    }, finished => {
      if (finished) runOnJS(setMounted)(false);
    });
  }, [mounted, progress, reducedMotion, visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 86 }],
  }));

  if (!mounted) return null;

  return (
    <Modal
      transparent
      visible
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={s.sheetOverlay}>
        <Animated.View style={[s.sheetBackdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close time picker" />
        </Animated.View>
        <Animated.View style={[s.sheet, panelStyle]}>
          <View style={s.sheetHandle} />
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>{title}</Text>
            <View style={[s.sheetTitleRule, { backgroundColor: accent }]} />
          </View>
          {children}
          <GoldButton label="Done" onPress={onClose} />
        </Animated.View>
      </View>
    </Modal>
  );
}

function TargetRow({
  label,
  value,
  hint,
  tone,
  onPress,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'goal' | 'tolerance';
  onPress: () => void;
}) {
  const pressScale = useSharedValue(1);
  const isGoal = tone === 'goal';
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <Animated.View style={pressStyle}>
      <TouchableOpacity
        style={[s.targetCard, isGoal ? s.goalCard : s.toleranceCard]}
        onPress={onPress}
        onPressIn={() => {
          pressScale.value = withTiming(0.988, { duration: 90, easing: Easing.out(Easing.quad) });
        }}
        onPressOut={() => {
          pressScale.value = withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic) });
        }}
        activeOpacity={1}
        haptic="selection"
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value}`}
      >
        <LinearGradient
          colors={isGoal ? ['#17191A', '#292C2D', '#1D1F20'] : ['#E3E5E5', '#F3F4F2', '#E7E9E8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <HairlineWeave color={isGoal ? '#FFFFFF' : '#242729'} opacity={isGoal ? 0.075 : 0.045} />

        <View style={s.targetCardHead}>
          <View style={s.targetCardTitleGroup}>
            <View style={[s.targetCardIcon, isGoal ? s.goalIcon : s.toleranceIcon]}>
              {isGoal
                ? <Image source={TROPHY_EMBLEM} style={s.goalTrophyImage} resizeMode="contain" />
                : <Shield s={20} c="#656B70" w={2} />}
            </View>
            <Text style={[s.targetCardTitle, isGoal && s.targetCardTitleDark]}>{label}</Text>
          </View>

          <View style={[s.targetTimePill, isGoal ? s.goalTimePill : s.toleranceTimePill]}>
            <Text style={[s.targetTimeValue, isGoal && s.targetTimeValueDark]}>{value}</Text>
            <ChevronRight s={14} c={isGoal ? '#D8AD53' : '#656B70'} w={2.3} />
          </View>
        </View>

        <View style={[s.targetCardDivider, isGoal && s.targetCardDividerDark]} />
        <Text style={[s.targetCardHint, isGoal && s.targetCardHintDark]}>{hint}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function DailyTargetEditor({
  values,
  onChange,
  essentialsOnly = false,
}: {
  values: TargetValues;
  onChange: (values: TargetValues) => void;
  essentialsOnly?: boolean;
}) {
  const [openSheet, setOpenSheet] = useState<null | 'goal' | 'tolerance'>(null);

  const setTarget = (target: number | null) => {
    if (target == null) {
      onChange({ target: null, tolerable: null, essentialOnly: null });
      return;
    }
    const previousEnd = values.essentialOnly ?? values.tolerable;
    const previousSpan = values.target != null && previousEnd != null
      ? Math.max(0, previousEnd - values.target)
      : DEFAULT_TOLERANCE;
    const toleranceEnd = target + previousSpan;
    onChange({ target, tolerable: toleranceEnd, essentialOnly: toleranceEnd });
  };

  const toleranceStops = useMemo(() => {
    if (values.target == null) return [];
    const end = values.essentialOnly ?? values.tolerable ?? values.target;
    const max = Math.max(values.target + TOLERANCE_SPAN, end);
    return rangeStops(values.target, max);
  }, [values.target, values.tolerable, values.essentialOnly]);

  const toleranceEnd = values.essentialOnly ?? values.tolerable;
  const toleranceDuration = values.target != null && toleranceEnd != null
    ? Math.max(0, toleranceEnd - values.target)
    : null;

  return (
    <View style={s.surface}>
      <View style={s.editorIntro}>
        <Text style={s.editorTitle}>Daily target</Text>
      </View>

      <TargetRow
        label="Goal"
        value={values.target == null ? 'No limit' : formatMinutesShort(values.target)}
        hint={essentialsOnly
          ? 'The screen-time boundary for this day. Stay within it to earn today\'s trophy while only Essentials remain available.'
          : 'The screen-time boundary for this day. Stay within it to keep the day on track and earn today\'s trophy.'}
        tone="goal"
        onPress={() => setOpenSheet('goal')}
      />

      {values.target != null && toleranceEnd != null && (
        <TargetRow
          label="Tolerance"
          value={`+${formatMinutesShort(toleranceDuration ?? 0)}`}
          hint={essentialsOnly
            ? 'Extra time after the Goal. It records the overflow without opening any other apps.'
            : 'Extra time after the Goal. When it ends, the phone locks and only your Essentials stay open.'}
          tone="tolerance"
          onPress={() => setOpenSheet('tolerance')}
        />
      )}

      {values.target != null && toleranceEnd != null && (
        <View style={s.dayCard}>
          <LinearGradient
            colors={['#FFFDF7', '#FEF8E9', '#FFFCF3']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <HairlineWeave color="#8A6A2F" opacity={0.045} />
          <View style={s.dayCardHead}>
            <View pointerEvents="none" style={s.dayCardHalo}>
              <Bloom color={C.gold} opacity={0.2} />
            </View>
            <Text style={s.dayCardTitle}>Your day</Text>
            <TitleFlourish />
          </View>
          <DayShape target={values.target} toleranceEnd={toleranceEnd} essentialsOnly={essentialsOnly} />
          <View style={s.dayCardDivider} />
          <YearPerspective target={values.target} toleranceDuration={toleranceDuration} embedded />
        </View>
      )}

      <TargetSheet
        visible={openSheet === 'goal'}
        title="Set your Goal"
        accent={C.gold}
        onClose={() => setOpenSheet(null)}
      >
        <LimitSlider
          value={values.target}
          onChange={setTarget}
          stops={essentialsOnly ? TARGET_STOPS.filter((value): value is number => value != null) : TARGET_STOPS}
          edgeLabels={{ left: '1h', right: essentialsOnly ? '8h 30m' : 'No limit' }}
          accent={GOAL_COLOR}
          trackColor="#E5E3DE"
          bubbleText={values.target == null ? 'No limit' : formatMinutesShort(values.target)}
        />
        <YearPerspective target={values.target} toleranceDuration={toleranceDuration} />
      </TargetSheet>

      <TargetSheet
        visible={openSheet === 'tolerance'}
        title="Set your Tolerance"
        accent={TOLERANCE_COLOR}
        onClose={() => setOpenSheet(null)}
      >
        <LimitSlider
          value={toleranceEnd}
          onChange={next => {
            if (next == null) return;
            const nextEnd = Math.max(values.target!, next);
            onChange({ ...values, tolerable: nextEnd, essentialOnly: nextEnd });
          }}
          stops={toleranceStops}
          edgeLabels={{ left: 'No buffer', right: `+${TOLERANCE_SPAN / 60}h` }}
          accent={TOLERANCE_COLOR}
          trackColor="#E5E7E9"
          bubbleText={`+${formatMinutesShort(toleranceDuration ?? 0)}`}
        />
        <YearPerspective target={values.target} toleranceDuration={toleranceDuration} />
      </TargetSheet>
    </View>
  );
}

const s = StyleSheet.create({
  surface: { gap: 14 },
  editorIntro: { paddingHorizontal: 4, paddingBottom: 1 },
  editorTitle: { fontFamily: F.serifSemiBold, fontSize: 25, lineHeight: 30, letterSpacing: -0.35, color: C.text },

  // Goal and Tolerance are full settings cards: boundary above, meaning below.
  targetCard: {
    position: 'relative',
    overflow: 'hidden',
    minHeight: 128,
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: 15,
  },
  goalCard: {
    borderColor: '#353838',
    backgroundColor: '#1D1F20',
    boxShadow: '0 12px 28px rgba(25, 27, 28, 0.18)',
  },
  toleranceCard: {
    borderColor: '#D0D3D3',
    backgroundColor: '#EAEBEA',
    boxShadow: '0 8px 22px rgba(49, 54, 55, 0.08)',
  },
  targetCardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  targetCardTitleGroup: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 11 },
  targetCardIcon: { flexShrink: 0, width: 40, height: 40, borderRadius: 13, borderCurve: 'continuous', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  goalIcon: { borderColor: 'rgba(216,173,83,0.32)', backgroundColor: 'rgba(216,173,83,0.13)' },
  goalTrophyImage: { width: 31, height: 31 },
  toleranceIcon: { borderColor: '#CFD2D2', backgroundColor: 'rgba(255,255,255,0.66)' },
  targetCardTitle: { fontFamily: F.serifSemiBold, fontSize: 21, lineHeight: 25, letterSpacing: -0.2, color: '#2E3233' },
  targetCardTitleDark: { color: '#F8F7F2' },
  targetTimePill: { flexShrink: 0, minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 13, borderCurve: 'continuous', borderWidth: 1, paddingHorizontal: 11 },
  goalTimePill: { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.075)' },
  toleranceTimePill: { borderColor: '#D0D3D3', backgroundColor: 'rgba(255,255,255,0.72)' },
  targetTimeValue: { fontFamily: F.serifSemiBold, fontSize: 19, lineHeight: 23, color: '#303435', fontVariant: ['tabular-nums'] },
  targetTimeValueDark: { color: '#FFFFFF' },
  targetCardDivider: { height: StyleSheet.hairlineWidth, marginVertical: 13, backgroundColor: '#C9CDCD' },
  targetCardDividerDark: { backgroundColor: 'rgba(255,255,255,0.13)' },
  targetCardHint: { fontFamily: F.sans, fontSize: 13.5, lineHeight: 19, color: '#5E6466' },
  targetCardHintDark: { color: '#C7C9C8' },

  // One fused surface: the title, the day gauge, the year beads below it.
  dayCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 26,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E7D7B4',
    padding: 18,
    boxShadow: '0 10px 28px rgba(67, 53, 31, 0.07)',
  },
  dayCardHead: { alignItems: 'center', marginBottom: 20 },
  // A gold breath of light behind the title — the card lights itself.
  dayCardHalo: { position: 'absolute', top: -34, left: -20, right: -20, height: 108 },
  dayCardTitle: { fontFamily: F.serifSemiBold, fontSize: 25.5, lineHeight: 29, letterSpacing: -0.4, color: C.text },
  flourish: { marginTop: 2 },
  dayCardDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E7DCC6', marginVertical: 18 },

  barCaptionRow: { marginTop: 15, flexDirection: 'row', alignItems: 'center' },
  captionCell: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 6 },
  captionLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.5, color: C.textMuted, textAlign: 'center' },
  captionLabelLock: { color: '#A24351' },
  captionValue: { marginTop: 4, fontFamily: F.serifSemiBold, fontSize: 18, lineHeight: 22, color: C.text, textAlign: 'center', fontVariant: ['tabular-nums'] },
  captionValueLock: { color: '#A24351' },

  // A rule broken by a small gold lozenge — the app's ornament, stood upright.
  gemDivider: { width: 9, alignItems: 'center', justifyContent: 'center' },
  gemDividerLine: { flex: 1, width: StyleSheet.hairlineWidth, backgroundColor: '#E0D2B2' },
  gemDividerGem: {
    width: 4.6,
    height: 4.6,
    marginVertical: 4,
    backgroundColor: C.goldDark,
    opacity: 0.78,
    boxShadow: '0 0 6px rgba(201, 162, 39, 0.5)',
    transform: [{ rotate: '45deg' }],
  },
  alwaysProtectedBand: { marginTop: 12, minHeight: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 10, borderCurve: 'continuous', backgroundColor: '#F9E4E7', paddingHorizontal: 10 },
  alwaysProtectedDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: ESSENTIALS_COLOR, boxShadow: '0 2px 6px rgba(225,75,90,0.28)' },
  alwaysProtectedText: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.05, color: '#A63A4B' },

  // Target sheet.
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 19, 23, 0.36)' },
  sheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1, borderBottomWidth: 0, borderColor: '#E2DED6', backgroundColor: '#FFFEFB', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 26, gap: 18, boxShadow: '0 -12px 36px rgba(19, 22, 24, 0.14)' },
  sheetHandle: { width: 42, height: 4, borderRadius: 999, backgroundColor: '#D6D3D1', alignSelf: 'center' },
  sheetHead: { alignItems: 'center', paddingTop: 2 },
  sheetTitle: { fontFamily: F.serifSemiBold, fontSize: 22, lineHeight: 27, color: C.text, textAlign: 'center' },
  sheetTitleRule: { width: 38, height: 2, borderRadius: 999, marginTop: 7, opacity: 0.7 },

  yearWrap: { borderRadius: 24, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E1D7C3', backgroundColor: '#FFFCF4', padding: 16, boxShadow: '0 8px 24px rgba(67, 53, 31, 0.05)' },
  yearWrapEmbedded: {},
  // "You waste — N — full days, in one year": a centred cost statement,
  // the tolerance rolled in as a grey +N. Echoes the onboarding YOU WASTE beat.
  wasteHero: { alignItems: 'center' },
  wasteHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  wasteHeadingRule: { width: 22, height: 1, borderRadius: 1, backgroundColor: 'rgba(162,67,81,0.34)' },
  wasteHeading: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 3, color: '#A24351' },
  wasteFigureRow: { marginTop: 7, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
  wasteEmber: { position: 'absolute', top: -20, left: -58, right: -58, bottom: -22 },
  wasteNumber: { fontFamily: F.serifBold, fontSize: 52, lineHeight: 55, letterSpacing: -0.9, color: '#1A1B1D', fontVariant: ['tabular-nums'] },
  // The tolerance, hung off the cost as a fraction-like aside: slash, then the
  // grey +N sitting a touch lower than the big number's baseline.
  wasteAnnex: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginLeft: 7 },
  wasteAnnexGhost: { opacity: 0, marginLeft: 0, marginRight: 7 },
  wasteSlash: { width: 1.4, height: 23, borderRadius: 1, marginBottom: 1, backgroundColor: '#C2C7CC', transform: [{ rotate: '18deg' }] },
  wastePlus: { marginBottom: -4, fontFamily: F.serifSemiBold, fontSize: 23, lineHeight: 25, color: '#9EA4AB', fontVariant: ['tabular-nums'] },
  wasteUnit: { marginTop: 3, fontFamily: F.serifMedium, fontSize: 16.5, lineHeight: 20, letterSpacing: 0.1, color: '#5E5751' },
  dotField: { marginTop: 15 },
  dotCell: { height: BEAD_ROW_H, alignItems: 'center', justifyContent: 'center' },
  dotPlate: {
    position: 'absolute',
    top: -9,
    left: -9,
    right: -9,
    bottom: -9,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,162,39,0.16)',
    backgroundColor: 'rgba(255,254,248,0.7)',
  },
  shineClip: { overflow: 'hidden' },
  shineBand: { position: 'absolute', left: 0, width: SHINE_W },
  // The travelling frontier: where the phone's days end in the year.
  frontierRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.3,
    borderColor: C.gold,
    boxShadow: '0 0 7px rgba(201, 162, 39, 0.55)',
  },
  yearDot: { width: BEAD_SIZE, height: BEAD_SIZE, borderRadius: BEAD_SIZE / 2 },
  dotSleep: { backgroundColor: SLEEP_COLOR },
  dotPhone: { backgroundColor: GOAL_COLOR },
  dotBuffer: { backgroundColor: TOLERANCE_COLOR },
  dotAway: { backgroundColor: PRODUCTIVE_COLOR },
  // The legend reads as a line in an almanac: two gold hairlines, four columns
  // parted by fainter rules, each led by a haloed bead of its own colour.
  legendBand: { marginTop: 23 },
  legendRule: { height: StyleSheet.hairlineWidth, backgroundColor: '#E4D7BB' },
  legendRow: { flexDirection: 'row', alignItems: 'stretch', paddingVertical: 12 },
  legendItem: { flex: 1, alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  legendDivider: { width: StyleSheet.hairlineWidth, marginVertical: 3, backgroundColor: '#EDE3CE' },
  legendHalo: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  legendHaloRing: { ...StyleSheet.absoluteFillObject, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth, opacity: 0.38 },
  legendHaloRingEmphasis: { opacity: 0.72 },
  legendBead: { width: 6, height: 6, borderRadius: 3 },
  legendValue: { fontFamily: F.serifBold, fontSize: 19, lineHeight: 21, color: '#4A4239', fontVariant: ['tabular-nums'] },
  legendValueEmphasis: { fontSize: 21, lineHeight: 23, color: '#1A1B1D' },
  legendLabel: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.1, textTransform: 'uppercase', color: '#9C9081' },
  legendLabelEmphasis: { color: '#6E6355' },

});
