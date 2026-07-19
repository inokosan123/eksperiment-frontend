import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { ChevronRight } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import DayGauge from './DayGauge';
import LimitSlider from './LimitSlider';
import GoldButton from './GoldButton';
import { formatMinutesShort } from './dayPlanStore';

const TARGET_STOPS: (number | null)[] = [
  ...Array.from({ length: 45 }, (_, index) => 60 + index * 15),
  null,
];
const YEAR_DAYS = 365;
const SLEEP_DAYS = Math.round((8 / 24) * YEAR_DAYS);
const WEEK_COLS = 52;
const TOLERANCE_SPAN = 180;
const DEFAULT_TOLERANCE = 120;
const GLIDE = { duration: 620, easing: Easing.out(Easing.cubic) };
const GOAL_COLOR = '#1B1C1E';
const TOLERANCE_COLOR = '#9EA4AB';
const ESSENTIALS_COLOR = '#E14B5A';
const PRODUCTIVE_COLOR = '#D3A33B';
const SLEEP_COLOR = '#BFB0E4';

export type TargetValues = {
  target: number | null;
  tolerable: number | null;
  essentialOnly: number | null;
};

function rangeStops(from: number, to: number): number[] {
  const stops: number[] = [];
  for (let value = from; value <= to; value += 15) stops.push(value);
  return stops;
}

// ————— One year of days; the phone's share and its buffer glide in and out. —————
function YearDotRow({
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
    <View style={{ flexDirection: 'row', height: 7.5 }}>
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
}

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
  const awayDays = Math.max(0, YEAR_DAYS - SLEEP_DAYS - phoneDays - bufferDays);
  const phoneEnd = useSharedValue(SLEEP_DAYS + phoneDays);
  const bufferEnd = useSharedValue(SLEEP_DAYS + phoneDays + bufferDays);

  useEffect(() => {
    const nextPhone = SLEEP_DAYS + phoneDays;
    const nextBuffer = nextPhone + bufferDays;
    phoneEnd.value = reduceMotion ? nextPhone : withTiming(nextPhone, GLIDE);
    bufferEnd.value = reduceMotion ? nextBuffer : withTiming(nextBuffer, GLIDE);
  }, [phoneDays, bufferDays, phoneEnd, bufferEnd, reduceMotion]);

  const rows = Math.ceil(YEAR_DAYS / WEEK_COLS);
  const cellWidth = fieldWidth > 0 ? fieldWidth / WEEK_COLS : 0;

  return (
    <View style={embedded ? s.yearWrapEmbedded : s.yearWrap}>
      <Text style={s.yearLabel}>ONE YEAR WITH THIS PLAN</Text>
      <View style={s.yearHeroRow}>
        <View style={s.yearBadge}>
          <Text style={s.yearNumber}>{target == null ? '—' : phoneDays}</Text>
          <Text style={s.yearNumberUnit}>
            {target == null ? 'NO GOAL' : phoneDays === 1 ? 'DAY' : 'DAYS'}
          </Text>
        </View>
        <View style={s.yearCopy}>
          <Text style={s.yearTitle}>
            {target == null ? 'Set a Goal to see what it costs.' : 'full days a year, spent on the phone'}
          </Text>
          {bufferDays > 0 && (
            <Text style={s.yearBufferLine}>+{bufferDays} more if you spend the tolerance</Text>
          )}
        </View>
      </View>
      <View style={s.dotField} onLayout={event => setFieldWidth(event.nativeEvent.layout.width)}>
        {cellWidth > 0 &&
          Array.from({ length: rows }).map((_, row) => (
            <YearDotRow key={row} row={row} cellWidth={cellWidth} phoneEnd={phoneEnd} bufferEnd={bufferEnd} />
          ))}
      </View>
      <View style={s.legendRow}>
        <LegendItem color={SLEEP_COLOR} label="Sleep" value={`${SLEEP_DAYS}`} />
        <LegendItem color={GOAL_COLOR} label="Phone" value={`${phoneDays}`} />
        {bufferDays > 0 && <LegendItem color={TOLERANCE_COLOR} label="Tolerance" value={`+${bufferDays}`} />}
        <LegendItem color={PRODUCTIVE_COLOR} label="Life" value={`${awayDays}`} />
      </View>
    </View>
  );
}

function LegendItem({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={s.legendItem}>
      <View style={[s.legendDot, { backgroundColor: color }]} />
      <Text style={s.legendLabel}>{label}</Text>
      <Text style={s.legendValue}>{value}</Text>
    </View>
  );
}

// A drawn swash under the card's title: two tapering curves meeting at a
// gold gem, beads at the tips — the app's rule—◆—rule ornament, given a curve.
function TitleFlourish() {
  return (
    <Svg width={138} height={13} viewBox="0 0 138 13" style={s.flourish}>
      <Path
        d="M7 5 C 22 11.4, 42 11.4, 59 6.6"
        stroke={C.gold}
        strokeWidth={1.25}
        strokeLinecap="round"
        fill="none"
        opacity={0.85}
      />
      <Path
        d="M79 6.6 C 96 11.4, 116 11.4, 131 5"
        stroke={C.gold}
        strokeWidth={1.25}
        strokeLinecap="round"
        fill="none"
        opacity={0.85}
      />
      <Path d="M69 1.9 L 73.6 6.5 L 69 11.1 L 64.4 6.5 Z" fill={C.goldDark} />
      <Circle cx={7} cy={5} r={1.35} fill={C.gold} opacity={0.7} />
      <Circle cx={131} cy={5} r={1.35} fill={C.gold} opacity={0.7} />
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

      <View style={s.barCaptionRow}>
        <View>
          <Text style={s.captionLabel}>GOAL</Text>
          <Text style={s.captionValue}>{formatMinutesShort(target)}</Text>
        </View>
        <View style={s.captionRight}>
          <Text style={[s.captionLabel, s.captionLabelLock]}>
            {essentialsOnly ? 'LOCKED' : 'PHONE LOCKS AT'}
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
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.sheetHandle} />
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>{title}</Text>
            <View style={[s.sheetTitleRule, { backgroundColor: accent }]} />
          </View>
          {children}
          <GoldButton label="Done" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

function TargetRow({
  label,
  value,
  hint,
  accent,
  onPress,
  delayEnter,
}: {
  label: string;
  value: string;
  hint: string;
  accent: string;
  onPress: () => void;
  delayEnter?: boolean;
}) {
  return (
    <TouchableOpacity style={s.targetRow} onPress={onPress} activeOpacity={0.85} haptic="selection">
      <View style={[s.targetRowDot, { backgroundColor: accent }]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.targetRowLabel}>{label}</Text>
        <Text style={s.targetRowHint}>{hint}</Text>
      </View>
      <Text style={s.targetRowValue}>{value}</Text>
      <ChevronRight s={16} c={C.textMuted} w={2.2} />
    </TouchableOpacity>
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
        <Text style={s.kicker}>DAILY TARGET</Text>
        <Text style={s.editorTitle}>
          {essentialsOnly ? 'Lock the day. Keep the score.' : 'How much of today does the phone get?'}
        </Text>
      </View>

      <TargetRow
        label="GOAL"
        value={values.target == null ? 'No limit' : formatMinutesShort(values.target)}
        hint={essentialsOnly
          ? 'Stay under this and the day earns its trophy.'
          : 'Stay under this and the day is won.'}
        accent={GOAL_COLOR}
        onPress={() => setOpenSheet('goal')}
      />

      {values.target != null && toleranceEnd != null && (
        <TargetRow
          label="TOLERANCE"
          value={`+${formatMinutesShort(toleranceDuration ?? 0)}`}
          hint={essentialsOnly
            ? 'Overflow past the Goal, recorded but tolerated.'
            : 'Overflow past the Goal. When it runs out, the phone locks.'}
          accent={TOLERANCE_COLOR}
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
          <View style={s.dayCardHead}>
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
          edgeLabels={{ left: '1h', right: essentialsOnly ? '12h' : 'No limit' }}
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
  surface: { gap: 12 },
  editorIntro: { paddingHorizontal: 4, paddingBottom: 2 },
  kicker: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.2, color: C.goldDark },
  editorTitle: { marginTop: 5, fontFamily: F.serifSemiBold, fontSize: 24, lineHeight: 28, letterSpacing: -0.3, color: C.text },

  // The set rows: quiet cards holding the current value; tap to open the sheet.
  targetRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E1DDD4',
    backgroundColor: '#FFFDF9',
    paddingHorizontal: 15,
    paddingVertical: 12,
    boxShadow: '0 6px 18px rgba(45, 40, 33, 0.05)',
  },
  targetRowDot: { flexShrink: 0, width: 9, height: 9, borderRadius: 5 },
  targetRowLabel: { fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 1.8, color: C.textMuted },
  targetRowHint: { marginTop: 3, fontFamily: F.sans, fontSize: 11.5, lineHeight: 15.5, color: C.textSecondary },
  targetRowValue: { fontFamily: F.serifSemiBold, fontSize: 21, color: C.text, fontVariant: ['tabular-nums'] },

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
  dayCardHead: { alignItems: 'center', marginBottom: 22 },
  dayCardTitle: { fontFamily: F.serifSemiBold, fontSize: 24, lineHeight: 28, letterSpacing: -0.3, color: C.text },
  flourish: { marginTop: 8 },
  dayCardDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E7DCC6', marginVertical: 18 },

  barCaptionRow: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  captionRight: { alignItems: 'flex-end' },
  captionLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.5, color: C.textMuted },
  captionLabelLock: { color: '#A63A4B' },
  captionValue: { marginTop: 3, fontFamily: F.serifSemiBold, fontSize: 18, lineHeight: 22, color: C.text, fontVariant: ['tabular-nums'] },
  captionValueLock: { color: '#A63A4B' },
  alwaysProtectedBand: { marginTop: 12, minHeight: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 10, borderCurve: 'continuous', backgroundColor: '#F9E4E7', paddingHorizontal: 10 },
  alwaysProtectedDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: ESSENTIALS_COLOR, boxShadow: '0 2px 6px rgba(225,75,90,0.28)' },
  alwaysProtectedText: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.05, color: '#A63A4B' },

  // Target sheet.
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,24,40,0.3)' },
  sheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: '#FFFEFB', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 26, gap: 18 },
  sheetHandle: { width: 42, height: 4, borderRadius: 999, backgroundColor: '#D6D3D1', alignSelf: 'center' },
  sheetHead: { alignItems: 'center', paddingTop: 2 },
  sheetTitle: { fontFamily: F.serifSemiBold, fontSize: 22, lineHeight: 27, color: C.text, textAlign: 'center' },
  sheetTitleRule: { width: 38, height: 2, borderRadius: 999, marginTop: 7, opacity: 0.7 },

  yearWrap: { borderRadius: 24, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E1D7C3', backgroundColor: '#FFFCF4', padding: 16, boxShadow: '0 8px 24px rgba(67, 53, 31, 0.05)' },
  yearWrapEmbedded: {},
  yearLabel: { fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 1.9, color: C.goldDark },
  yearHeroRow: { marginTop: 11, flexDirection: 'row', alignItems: 'center', gap: 14 },
  yearBadge: {
    minWidth: 74,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#EAD9B0',
    backgroundColor: '#FFF8E6',
    paddingVertical: 9,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  yearNumber: { fontFamily: F.serifSemiBold, fontSize: 34, lineHeight: 37, color: C.goldDark, fontVariant: ['tabular-nums'] },
  yearNumberUnit: { marginTop: 1, fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.4, color: '#A9863F' },
  yearCopy: { flex: 1, minWidth: 0 },
  yearTitle: { fontFamily: F.serifSemiBold, fontSize: 19, lineHeight: 24, letterSpacing: -0.2, color: C.text },
  yearBufferLine: { marginTop: 5, fontFamily: F.sansSemiBold, fontSize: 11.5, lineHeight: 15.5, color: TOLERANCE_COLOR },
  dotField: { marginTop: 16 },
  dotCell: { height: 7.5, alignItems: 'center', justifyContent: 'center' },
  yearDot: { width: 5.2, height: 5.2, borderRadius: 3 },
  dotSleep: { backgroundColor: SLEEP_COLOR },
  dotPhone: { backgroundColor: GOAL_COLOR },
  dotBuffer: { backgroundColor: TOLERANCE_COLOR },
  dotAway: { backgroundColor: PRODUCTIVE_COLOR },
  legendRow: { marginTop: 15, flexDirection: 'row', flexWrap: 'wrap', columnGap: 15, rowGap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontFamily: F.sansSemiBold, fontSize: 11, color: C.textSecondary },
  legendValue: { fontFamily: F.sansBold, fontSize: 11.5, color: C.text, fontVariant: ['tabular-nums'] },

});
