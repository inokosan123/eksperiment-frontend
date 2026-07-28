import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { CalendarCheck } from '@/components/icons/Icons';
import type { DailyAnalyticsSnapshot, SourceFilter } from '@/components/analytics/analyticsOverview';
import { A, cardShell, SectionHead } from '@/components/analytics/analyticsUi';
import { F } from '@/constants/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const ACCENT = A.gold;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Matched to the journal's Year in Pixels so the two screens read as one app.
const PIXEL_SIZE = 11.5;
const PIXEL_GAP = 2.5;

interface Props {
  snapshots: DailyAnalyticsSnapshot[];
  sourceFilter: SourceFilter;
  /** How many calendar months to paint, ending with the current one. */
  months?: number;
  accentColor?: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
    : { r: 197, g: 160, b: 89 };
}

/** The heat ramp: pale gold at a barely-written day, full gold at a full one. */
function heatColor(pct: number, accent: string): string {
  const { r, g, b } = hexToRgb(accent);
  // Floor the ramp so a 10% day still reads as painted rather than as blank.
  const t = 0.24 + Math.min(Math.max(pct, 0) / 100, 1) * 0.76;
  return `rgb(${Math.round(255 - (255 - r) * t)}, ${Math.round(255 - (255 - g) * t)}, ${Math.round(255 - (255 - b) * t)})`;
}

function dateKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Today's pixel breathes the same gold ring the journal's grid uses. */
function TodayPulse() {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      t.value = 0.25;
      return;
    }
    t.value = 0;
    t.value = withRepeat(withTiming(1, { duration: 2300, easing: Easing.out(Easing.quad) }), -1, false);
    return () => cancelAnimation(t);
  }, [reduceMotion, t]);

  const ringProps = useAnimatedProps(() => ({
    opacity: (1 - t.value) * 0.55,
    r: 6.5 + t.value * 6.5,
  }));

  return (
    <View pointerEvents="none" style={s.todayPulse}>
      <Svg width={30} height={30}>
        <AnimatedCircle cx={15} cy={15} fill="none" stroke={ACCENT} strokeWidth={1.3} animatedProps={ringProps} />
      </Svg>
    </View>
  );
}

export default function HeatmapCalendar({
  snapshots,
  sourceFilter,
  months = 12,
  accentColor = ACCENT,
}: Props) {
  const reduceMotion = useReducedMotion();

  const { rows, perfectDays, trackedDays, spanLabel } = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

    const snapMap = new Map<string, DailyAnalyticsSnapshot>();
    for (const snap of snapshots) snapMap.set(snap.date, snap);

    let perfectDays = 0;
    let trackedDays = 0;

    // One row per calendar month, oldest first — the journal's structure.
    const rows: {
      key: string;
      name: string;
      year: number;
      showYear: boolean;
      days: { key: string; pct: number; scheduled: number; isToday: boolean; isFuture: boolean }[];
    }[] = [];

    for (let back = months - 1; back >= 0; back--) {
      const cursor = new Date(today.getFullYear(), today.getMonth() - back, 1, 12);
      const y = cursor.getFullYear();
      const m = cursor.getMonth();
      const daysInMonth = new Date(y, m + 1, 0).getDate();

      const days = Array.from({ length: daysInMonth }, (_, i) => {
        const key = dateKey(y, m, i + 1);
        const snap = snapMap.get(key);
        const bucket = snap ? (sourceFilter === 'all' ? snap.overall : snap.source[sourceFilter]) : null;
        const pct = bucket?.pct ?? 0;
        const scheduled = bucket?.scheduled ?? 0;
        if (scheduled > 0) {
          trackedDays += 1;
          if (pct >= 100) perfectDays += 1;
        }
        return { key, pct, scheduled, isToday: key === todayKey, isFuture: key > todayKey };
      });

      rows.push({
        key: `${y}-${m}`,
        name: MONTH_NAMES[m],
        year: y,
        // January carries its year so a rolling window never reads ambiguously.
        showYear: m === 0 || back === months - 1,
        days,
      });
    }

    const first = rows[0];
    const last = rows[rows.length - 1];
    const spanLabel = first && last
      ? first.year === last.year
        ? `${first.name} – ${last.name} ${last.year}`
        : `${first.name} ${first.year} – ${last.name} ${last.year}`
      : '';

    return { rows, perfectDays, trackedDays, spanLabel };
  }, [snapshots, sourceFilter, months]);

  return (
    <Animated.View style={s.card} entering={reduceMotion ? undefined : FadeIn.duration(300)}>
      <SectionHead
        Icon={CalendarCheck}
        title="Activity"
        caption="Every day you tracked — the deeper the gold, the more of it you finished."
        right={
          <View style={[s.statTile, perfectDays > 0 && s.statTileOn]}>
            <Text style={[s.statValue, perfectDays > 0 && s.statValueOn]}>{perfectDays}</Text>
            <Text style={[s.statCaption, perfectDays > 0 && s.statCaptionOn]}>FULL DAYS</Text>
          </View>
        }
      />

      {/* The placard, then the year hung inside its gold fillet frame. */}
      <View style={s.plaqueRow}>
        <Text style={s.plaqueTitle} numberOfLines={1}>{spanLabel}</Text>
        <Text style={s.plaqueCount}>
          {trackedDays} {trackedDays === 1 ? 'day' : 'days'} painted
        </Text>
      </View>

      <View style={s.frame}>
        <View pointerEvents="none" style={[s.frameNail, { top: 5, left: 5 }]} />
        <View pointerEvents="none" style={[s.frameNail, { top: 5, right: 5 }]} />
        <View pointerEvents="none" style={[s.frameNail, { bottom: 5, left: 5 }]} />
        <View pointerEvents="none" style={[s.frameNail, { bottom: 5, right: 5 }]} />

        {rows.map((row, rowIndex) => (
          <Animated.View
            key={row.key}
            entering={reduceMotion ? undefined : FadeInDown.delay(rowIndex * 26).duration(300)}
            style={s.monthRow}
          >
            <Text style={s.monthLabel} numberOfLines={1}>
              {row.name}
              {row.showYear ? <Text style={s.monthYear}>{` ’${String(row.year).slice(2)}`}</Text> : null}
            </Text>
            <View style={s.monthDays}>
              {row.days.map(day =>
                day.isToday ? (
                  <View key={day.key} style={s.todayWrap}>
                    <TodayPulse />
                    <View
                      style={[
                        s.pixelFill,
                        day.scheduled > 0
                          ? { backgroundColor: heatColor(day.pct, accentColor) }
                          : s.pixelToday,
                        s.pixelTodayRing,
                      ]}
                    />
                  </View>
                ) : (
                  // A day with tasks is a full gem; a day with none recedes to
                  // a pale tile, so the shape of the months stays readable.
                  <View key={day.key} style={s.pixelCell}>
                    {day.scheduled > 0 ? (
                      <View style={[s.pixelFill, { backgroundColor: heatColor(day.pct, accentColor) }]} />
                    ) : (
                      <View style={[s.pixelDot, day.isFuture && s.pixelDotFuture]} />
                    )}
                  </View>
                ),
              )}
            </View>
          </Animated.View>
        ))}
      </View>

      <View style={s.placardDivider} />

      <View style={s.legendRow}>
        {[0, 25, 50, 75, 100].map(pct => (
          <View key={pct} style={s.legendItem}>
            <View style={[s.legendSwatch, s.legendSwatchShadow, { backgroundColor: heatColor(pct, accentColor) }]}>
              <View style={s.gemSheen} />
            </View>
            <Text style={s.legendLabel}>{pct}%</Text>
          </View>
        ))}
        <View style={s.legendItem}>
          <View style={[s.legendSwatch, s.legendSwatchEmpty]} />
          <Text style={s.legendLabelMuted}>None</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: { ...cardShell, padding: 18 },

  statTile: {
    flexShrink: 0,
    minWidth: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: A.line,
    backgroundColor: '#F8F6F1',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statTileOn: { borderColor: 'rgba(197,160,89,0.34)', backgroundColor: A.goldWash },
  statValue: {
    fontFamily: F.serifBold,
    fontSize: 21,
    lineHeight: 24,
    color: '#A8A29E',
    fontVariant: ['lining-nums', 'tabular-nums'],
  },
  statValueOn: { color: A.goldDeep },
  statCaption: { marginTop: 1, fontFamily: F.sansBold, fontSize: 8, letterSpacing: 0.7, color: '#B3ADA3' },
  statCaptionOn: { color: A.gold },

  plaqueRow: {
    marginTop: 16,
    marginBottom: 10,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: 10,
  },
  plaqueTitle: {
    flexShrink: 1,
    fontFamily: F.serifSemiBold,
    fontSize: 17,
    lineHeight: 21,
    letterSpacing: -0.1,
    color: A.ink,
  },
  plaqueCount: {
    flexShrink: 0,
    fontFamily: F.serifItalic,
    fontSize: 13.5,
    color: '#A6997D',
  },

  // The gold fillet with nail heads — lifted from Year in Pixels so the two
  // grids are recognisably the same instrument.
  frame: {
    position: 'relative',
    marginHorizontal: -8,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,160,89,0.5)',
    backgroundColor: '#FFFEFB',
    paddingHorizontal: 9,
    paddingVertical: 11,
    rowGap: 8,
  },
  frameNail: {
    position: 'absolute',
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: 'rgba(154,107,30,0.5)',
  },

  monthRow: { flexDirection: 'row', alignItems: 'flex-start', columnGap: 7 },
  monthLabel: {
    // 44 fits the widest label ("Aug ’25") and costs no pixel columns.
    width: 44,
    paddingTop: 1.5,
    fontFamily: F.serifMedium,
    fontSize: 12.5,
    letterSpacing: 0.5,
    color: '#7E7768',
    textAlign: 'left',
  },
  monthYear: { fontFamily: F.serifMedium, fontSize: 10, color: '#A8A096' },
  monthDays: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: PIXEL_GAP,
    rowGap: PIXEL_GAP,
  },
  pixelCell: {
    width: PIXEL_SIZE,
    height: PIXEL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pixelFill: { width: PIXEL_SIZE, height: PIXEL_SIZE, borderRadius: 3.5 },
  pixelDot: { width: PIXEL_SIZE, height: PIXEL_SIZE, borderRadius: 3.5, backgroundColor: '#F1EDE4' },
  pixelDotFuture: { backgroundColor: 'rgba(197,160,89,0.07)' },
  pixelToday: { backgroundColor: 'rgba(197,160,89,0.2)' },
  pixelTodayRing: { borderWidth: 1.2, borderColor: ACCENT },
  todayWrap: { width: PIXEL_SIZE, height: PIXEL_SIZE, position: 'relative' },
  todayPulse: { position: 'absolute', left: -9.25, top: -9.25, width: 30, height: 30 },

  placardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#EDE7DA',
    marginTop: 14,
    marginBottom: 13,
  },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  legendItem: { alignItems: 'center', rowGap: 6 },
  legendSwatch: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderCurve: 'continuous',
    overflow: 'hidden',
    position: 'relative',
  },
  legendSwatchEmpty: { backgroundColor: '#F1EDE4', borderWidth: 1, borderColor: '#E9E4D8' },
  legendSwatchShadow: {
    shadowColor: '#1C1917',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  gemSheen: {
    position: 'absolute',
    top: 1.5,
    left: 3,
    right: 3,
    height: '42%',
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  legendLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 0.6, color: '#78716C' },
  legendLabelMuted: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 0.6, color: '#A8A29E' },
});
