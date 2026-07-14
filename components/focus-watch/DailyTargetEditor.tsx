import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { AlertTriangle } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import LimitSlider from './LimitSlider';
import { CATEGORY_TINTS } from './focusContent';
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

// ————— The day's shape at a glance: target → grace → closed, animated. —————
function ZoneBar({
  target,
  toleranceEnd,
}: {
  target: number;
  toleranceEnd: number;
}) {
  const [width, setWidth] = useState(0);
  const targetW = useSharedValue(0);
  const toleranceW = useSharedValue(0);

  useEffect(() => {
    if (width <= 0 || toleranceEnd <= 0) return;
    const hasTolerance = toleranceEnd > target;
    const availableWidth = Math.max(0, width - (hasTolerance ? 4 : 0));
    targetW.value = withTiming((target / toleranceEnd) * availableWidth, GLIDE);
    toleranceW.value = withTiming(((toleranceEnd - target) / toleranceEnd) * availableWidth, GLIDE);
  }, [target, toleranceEnd, width, targetW, toleranceW]);

  const targetStyle = useAnimatedStyle(() => ({ width: targetW.value }));
  const toleranceStyle = useAnimatedStyle(() => ({ width: toleranceW.value }));
  const toleranceDuration = Math.max(0, toleranceEnd - target);

  return (
    <View style={s.zoneMap}>
      <View style={s.zoneBar}>
        <View style={s.zoneScale} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
          <Animated.View style={[s.zoneTarget, targetStyle]} />
          {toleranceDuration > 0 && <Animated.View style={[s.zoneTolerance, toleranceStyle]} />}
        </View>
        <View style={s.zoneEssentialsCap} />
      </View>
      <View style={s.zoneLegend}>
        <View style={s.zoneLegendItem}>
          <View style={[s.zoneLegendDot, { backgroundColor: GOAL_COLOR }]} />
          <View>
            <Text style={s.zoneLegendLabel}>GOAL</Text>
            <Text style={s.zoneLegendValue}>{formatMinutesShort(target)}</Text>
            <Text style={s.zoneLegendMeta}>trophy line</Text>
          </View>
        </View>
        <View style={s.zoneLegendItem}>
          <View style={[s.zoneLegendDot, { backgroundColor: TOLERANCE_COLOR }]} />
          <View>
            <Text style={s.zoneLegendLabel}>TOLERANCE</Text>
            <Text style={s.zoneLegendValue}>+{formatMinutesShort(toleranceDuration)}</Text>
            <Text style={s.zoneLegendMeta}>recovery room</Text>
          </View>
        </View>
        <View style={s.zoneLegendItem}>
          <View style={[s.zoneLegendDot, { backgroundColor: ESSENTIALS_COLOR }]} />
          <View>
            <Text style={s.zoneLegendLabel}>ESSENTIALS</Text>
            <Text style={s.zoneLegendValue}>From {formatMinutesShort(toleranceEnd)}</Text>
            <Text style={s.zoneLegendMeta}>protection starts</Text>
          </View>
        </View>
      </View>
    </View>
  );
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

function YearPerspective({
  target,
  toleranceDuration,
}: {
  target: number | null;
  toleranceDuration: number | null;
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
    <View style={s.yearWrap}>
      <View style={s.yearCopyRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.yearLabel}>ONE YEAR IN VIEW</Text>
          <Text style={s.yearTitle}>
            {target == null ? 'Set a Goal to see its weight over a year.' : `${phoneDays} full days a year on the phone`}
          </Text>
        </View>
        <View style={s.yearNumberWrap}>
          {bufferDays > 0 && <Text style={s.yearNumberBuffer}>+{bufferDays} buffer</Text>}
          <Text style={s.yearNumber}>{target == null ? '—' : phoneDays}</Text>
          <Text style={s.yearNumberUnit}>{target == null ? 'NO GOAL' : 'DAYS'}</Text>
        </View>
      </View>
      <View style={s.dotField} onLayout={event => setFieldWidth(event.nativeEvent.layout.width)}>
        {cellWidth > 0 &&
          Array.from({ length: rows }).map((_, row) => (
            <YearDotRow key={row} row={row} cellWidth={cellWidth} phoneEnd={phoneEnd} bufferEnd={bufferEnd} />
          ))}
      </View>
      <View style={s.legendRow}>
        <View style={s.legendItem}><View style={[s.legendDot, s.dotSleep]} /><Text style={s.legendText}>Sleep {SLEEP_DAYS}</Text></View>
        <View style={s.legendItem}><View style={[s.legendDot, s.dotPhone]} /><Text style={s.legendText}>Phone {phoneDays}</Text></View>
        {bufferDays > 0 && (
          <View style={s.legendItem}><View style={[s.legendDot, s.dotBuffer]} /><Text style={s.legendText}>Buffer +{bufferDays}</Text></View>
        )}
        <View style={s.legendItem}><View style={[s.legendDot, s.dotAway]} /><Text style={s.legendText}>Life {awayDays}</Text></View>
      </View>
    </View>
  );
}

// ————— The projection rail: colored group segments glide to their share. —————
function RailSegment({ left, width, color }: { left: number; width: number; color: string }) {
  const l = useSharedValue(left);
  const w = useSharedValue(width);

  useEffect(() => {
    l.value = withTiming(left, GLIDE);
    w.value = withTiming(width, GLIDE);
  }, [left, width, l, w]);

  const style = useAnimatedStyle(() => ({ left: l.value, width: w.value }));
  return <Animated.View style={[s.railSegment, { backgroundColor: color }, style]} />;
}

export function PlanningRail({
  values,
  plannedByGroup,
  embedded = false,
}: {
  values: TargetValues;
  plannedByGroup: Record<string, number>;
  // Embedded skips the card chrome so the rail can live inside another surface
  // (the app-rules card) — the projection and the rules it feeds stay together.
  embedded?: boolean;
}) {
  const [railWidth, setRailWidth] = useState(0);
  const groups = Object.entries(plannedByGroup).filter(([, minutes]) => minutes > 0);
  const planned = groups.reduce((sum, [, minutes]) => sum + minutes, 0);
  const scale = values.essentialOnly ?? values.target ?? Math.max(60, planned);
  const capacity = values.target == null ? null : Math.round(values.target * 0.8);
  const warning = values.target != null && planned > values.target * 0.9;

  const segments = useMemo(() => {
    let consumed = 0;
    return groups.map(([groupId, minutes]) => {
      const left = consumed / scale;
      consumed += minutes;
      const width = Math.min(1 - left, minutes / scale);
      return { groupId, left, width: Math.max(0, width) };
    });
  }, [groups, scale]);

  return (
    <View style={[s.planningWrap, embedded && s.planningWrapEmbedded]}>
      <View style={s.planningHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.planningLabel}>DAILY PLANNING CAPACITY</Text>
          <Text style={s.planningTitle}>
            {capacity == null ? 'Set a Goal before dividing app time.' : `${formatMinutesShort(capacity)} available for app rules`}
          </Text>
          <Text style={s.planningBody}>Plan 80% of the Goal. The remaining 20% stays free for calls, maps, messages, and real life.</Text>
        </View>
        <View style={s.plannedPill}>
          <Text style={s.plannedPillLabel}>PLANNED</Text>
          <Text style={s.plannedPillValue}>{formatMinutesShort(planned)}</Text>
        </View>
      </View>

      <View style={s.railBlock}>
        {values.target != null && railWidth > 0 && (
          <>
            <View style={[s.markerChip, { left: Math.max(0, (values.target * 0.8 / scale) * railWidth - 15) }]}>
              <Text style={s.markerChipText}>80%</Text>
            </View>
            <View style={[s.markerChip, s.goalChip, { left: Math.min(railWidth - 36, Math.max(0, (values.target / scale) * railWidth - 18)) }]}>
              <Text style={[s.markerChipText, s.goalChipText]}>GOAL</Text>
            </View>
          </>
        )}
        <View style={s.rail} onLayout={event => setRailWidth(event.nativeEvent.layout.width)}>
          {railWidth > 0 && segments.map(segment => (
            <RailSegment
              key={segment.groupId}
              left={segment.left * railWidth}
              width={segment.width * railWidth}
              color={(CATEGORY_TINTS[segment.groupId] ?? { color: C.goldDark }).color}
            />
          ))}
          {values.target != null && railWidth > 0 && (
            <>
              <View style={[s.railMarker, s.capacityMarker, { left: (values.target * 0.8 / scale) * railWidth }]} />
              <View style={[s.railMarker, s.goalMarker, { left: (values.target / scale) * railWidth }]} />
            </>
          )}
          {values.essentialOnly != null && railWidth > 0 && (
            <View style={[s.railMarker, s.hardMarker, { left: railWidth - 3 }]} />
          )}
        </View>
        <View style={s.railBottomLabels}>
          <Text style={s.railBottomText}>0</Text>
          <Text style={s.railBottomText}>
            {values.essentialOnly == null ? 'No daily boundary' : `Essentials from ${formatMinutesShort(values.essentialOnly)}`}
          </Text>
        </View>
      </View>

      {warning && (
        <View style={[s.warning, planned >= (values.target ?? Infinity) && s.warningStrong]}>
          <AlertTriangle s={14} c={planned >= (values.target ?? Infinity) ? '#A24351' : '#A36F2B'} w={2.2} />
          <Text style={[s.warningText, planned >= (values.target ?? Infinity) && s.warningTextStrong]}>
            {planned >= (values.target ?? Infinity)
              ? 'Your app rules use the full Goal. The plan can be saved, but no reserve remains.'
              : 'Your app rules leave very little room for messages, maps, and unplanned use.'}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function DailyTargetEditor({
  values,
  onChange,
}: {
  values: TargetValues;
  onChange: (values: TargetValues) => void;
}) {
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
    const toleranceEnd = values.essentialOnly ?? values.tolerable ?? values.target;
    const max = Math.max(values.target + TOLERANCE_SPAN, toleranceEnd);
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
        <Text style={s.editorTitle}>Draw the line before the day begins.</Text>
        <Text style={s.editorBody}>The goal is not a trophy — it is a saved day: time spent with God and the people you love, not thrown at a screen.</Text>
      </View>

      <View style={s.limitBlock}>
        <View style={s.controlLabelRow}>
          <View style={[s.controlDot, { backgroundColor: GOAL_COLOR }]} />
          <Text style={s.controlLabel}>SET A GOAL</Text>
        </View>
        <Text style={s.targetTitle}>How much of today may the phone have?</Text>
        <Text style={s.controlHint}>The value you want to stay under. Within it, your blocking works exactly as you set it below.</Text>
        <LimitSlider
          value={values.target}
          onChange={setTarget}
          stops={TARGET_STOPS}
          edgeLabels={{ left: '1h', right: 'No limit' }}
          accent={GOAL_COLOR}
          trackColor="#E5E3DE"
          bubbleText={values.target == null ? 'No limit' : formatMinutesShort(values.target)}
        />
      </View>

      {values.target != null && toleranceEnd != null && (
        <>
          <View style={s.limitBlock}>
            <View style={s.controlLabelRow}>
              <View style={[s.controlDot, { backgroundColor: TOLERANCE_COLOR }]} />
              <Text style={s.controlLabel}>SET A TOLERANCE</Text>
            </View>
            <Text style={s.targetTitle}>How much overflow can you tolerate before the phone closes?</Text>
            <Text style={s.controlHint}>Time past the goal that is not with your people — tolerated, not planned. When it is spent, only Essentials stay open.</Text>
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
          </View>

          <View style={s.zonesBlock}>
            <Text style={s.zonesTitle}>YOUR DAY IN THREE STATES</Text>
            <ZoneBar target={values.target} toleranceEnd={toleranceEnd} />
          </View>
        </>
      )}

      <YearPerspective target={values.target} toleranceDuration={toleranceDuration} />
    </View>
  );
}

const s = StyleSheet.create({
  surface: { gap: 12 },
  editorIntro: { paddingHorizontal: 4, paddingBottom: 2 },
  kicker: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.2, color: C.goldDark },
  editorTitle: { marginTop: 5, fontFamily: F.serifSemiBold, fontSize: 24, lineHeight: 28, letterSpacing: -0.3, color: C.text },
  editorBody: { marginTop: 6, fontFamily: F.serif, fontSize: 14, lineHeight: 19.5, color: C.textSecondary },
  limitBlock: { borderRadius: 24, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E1DDD4', backgroundColor: '#FFFDF9', paddingHorizontal: 15, paddingTop: 13, paddingBottom: 15, boxShadow: '0 8px 24px rgba(45, 40, 33, 0.055)' },
  controlLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  controlDot: { width: 7, height: 7, borderRadius: 4 },
  controlLabel: { fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 1.8, color: C.textMuted },
  targetTitle: { marginTop: 6, fontFamily: F.serifMedium, fontSize: 19, lineHeight: 23, letterSpacing: -0.2, color: C.text },
  controlHint: { marginTop: 4, marginBottom: 10, fontFamily: F.sans, fontSize: 12, lineHeight: 16.5, color: C.textSecondary },

  zonesBlock: { borderRadius: 24, borderCurve: 'continuous', borderWidth: 1, borderColor: '#DDD9D1', backgroundColor: '#F6F4EF', padding: 16, gap: 2 },
  zonesTitle: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.8, color: C.textMuted },
  zoneMap: { marginTop: 8 },
  zoneBar: { height: 22, flexDirection: 'row', gap: 5 },
  zoneScale: { flex: 1, flexDirection: 'row', gap: 4 },
  zoneTarget: { height: '100%', borderRadius: 7, borderCurve: 'continuous', backgroundColor: GOAL_COLOR },
  zoneTolerance: { height: '100%', borderRadius: 7, borderCurve: 'continuous', backgroundColor: TOLERANCE_COLOR },
  zoneEssentialsCap: { width: 22, height: '100%', borderRadius: 7, borderCurve: 'continuous', backgroundColor: ESSENTIALS_COLOR, boxShadow: '0 3px 9px rgba(225,75,90,0.24)' },
  zoneLegend: { marginTop: 12, flexDirection: 'row', gap: 7 },
  zoneLegendItem: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  zoneLegendDot: { flexShrink: 0, width: 8, height: 8, marginTop: 2, borderRadius: 4 },
  zoneLegendLabel: { fontFamily: F.sansBold, fontSize: 7.5, letterSpacing: 0.9, color: C.textMuted },
  zoneLegendValue: { marginTop: 2, fontFamily: F.serifSemiBold, fontSize: 13.5, lineHeight: 16, color: C.text, fontVariant: ['tabular-nums'] },
  zoneLegendMeta: { marginTop: 1, fontFamily: F.sansMedium, fontSize: 8.5, lineHeight: 11, color: C.textMuted },

  yearWrap: { borderRadius: 24, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E1D7C3', backgroundColor: '#FFFCF4', padding: 16, boxShadow: '0 8px 24px rgba(67, 53, 31, 0.05)' },
  yearCopyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  yearLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.65, color: C.goldDark },
  yearTitle: { marginTop: 3, fontFamily: F.serifSemiBold, fontSize: 18, lineHeight: 22, color: C.text },
  yearNumberWrap: { minWidth: 55, alignItems: 'center' },
  yearNumberBuffer: { marginBottom: 1, fontFamily: F.sansSemiBold, fontSize: 9.5, color: TOLERANCE_COLOR, fontVariant: ['tabular-nums'] },
  yearNumber: { fontFamily: F.serifSemiBold, fontSize: 35, lineHeight: 38, color: C.goldDark, fontVariant: ['tabular-nums'] },
  yearNumberUnit: { marginTop: -1, fontFamily: F.sansBold, fontSize: 7.5, letterSpacing: 1.2, color: C.goldDark },
  dotField: { marginTop: 14 },
  dotCell: { height: 7.5, alignItems: 'center', justifyContent: 'center' },
  yearDot: { width: 5.2, height: 5.2, borderRadius: 3 },
  dotSleep: { backgroundColor: SLEEP_COLOR },
  dotPhone: { backgroundColor: GOAL_COLOR },
  dotBuffer: { backgroundColor: TOLERANCE_COLOR },
  dotAway: { backgroundColor: PRODUCTIVE_COLOR },
  legendRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: F.sansSemiBold, fontSize: 10, color: C.textSecondary, fontVariant: ['tabular-nums'] },

  planningWrap: { borderRadius: 24, borderCurve: 'continuous', borderWidth: 1, borderColor: '#DFDBD3', backgroundColor: '#FFFDF9', padding: 16, gap: 11, boxShadow: '0 8px 24px rgba(45, 40, 33, 0.055)' },
  planningWrapEmbedded: { borderWidth: 0, backgroundColor: 'transparent', padding: 0, paddingTop: 12, paddingBottom: 14, boxShadow: 'none' },
  planningHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  planningLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.65, color: C.textMuted },
  planningTitle: { marginTop: 3, fontFamily: F.serifSemiBold, fontSize: 18, lineHeight: 22, color: C.text },
  planningBody: { marginTop: 4, fontFamily: F.sans, fontSize: 11, lineHeight: 15.5, color: C.textSecondary },
  plannedPill: { flexShrink: 0, minWidth: 68, borderRadius: 15, borderCurve: 'continuous', backgroundColor: '#F0EEE8', paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center' },
  plannedPillLabel: { fontFamily: F.sansBold, fontSize: 7.5, letterSpacing: 1.1, color: C.textMuted },
  plannedPillValue: { marginTop: 2, fontFamily: F.serifSemiBold, fontSize: 17, color: C.text, fontVariant: ['tabular-nums'] },
  railBlock: { position: 'relative', paddingTop: 20 },
  markerChip: {
    position: 'absolute',
    top: 0,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#EAD9B7',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    zIndex: 2,
  },
  goalChip: { borderColor: '#D9CBB2', backgroundColor: '#F4EFE4' },
  markerChipText: { fontFamily: F.sansBold, fontSize: 7.5, letterSpacing: 0.6, color: C.goldDark },
  goalChipText: { color: '#2D2923' },
  rail: { position: 'relative', height: 16, borderRadius: 8, backgroundColor: '#ECE9E1' },
  railSegment: { position: 'absolute', top: 2, bottom: 2, borderRadius: 5 },
  railMarker: { position: 'absolute', top: -4, width: 1.5, height: 22, borderRadius: 1 },
  capacityMarker: { backgroundColor: C.goldDark },
  goalMarker: { width: 2, backgroundColor: '#2D2923' },
  hardMarker: { width: 3, backgroundColor: ESSENTIALS_COLOR },
  railBottomLabels: { marginTop: 5, flexDirection: 'row', justifyContent: 'space-between' },
  railBottomText: { fontFamily: F.sansMedium, fontSize: 9.5, color: C.textMuted, fontVariant: ['tabular-nums'] },
  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 14, backgroundColor: '#FFF4DC', paddingHorizontal: 12, paddingVertical: 10 },
  warningStrong: { backgroundColor: '#F9E8EB' },
  warningText: { flex: 1, fontFamily: F.sansMedium, fontSize: 11, lineHeight: 15.5, color: '#8D5C1E' },
  warningTextStrong: { color: '#8F3443' },
});
