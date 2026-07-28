import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { Easing, FadeIn, useReducedMotion } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop, Line, Circle, Text as SvgText } from 'react-native-svg';
import { ChevronLeft, ChevronRight, Minus, TrendingDown, TrendingUp } from '@/components/icons/Icons';
import {
  aggregateByPeriod,
  computeTrend,
  getAvailableMonths,
  getMonthLabel,
  type AnalyticsCriteria,
  type AnalyticsPeriod,
  type ChartDataPoint,
  type DailyAnalyticsSnapshot,
  type SourceFilter,
} from '@/components/analytics/analyticsOverview';
import { A, cardShell, SectionHead, SegmentedRail } from '@/components/analytics/analyticsUi';
import { F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity, HapticPressable as Pressable } from '@/components/shared/HapticTouch';


const PERIODS: { key: AnalyticsPeriod; label: string }[] = [
  { key: '1m', label: 'Monthly' },
  { key: '3m', label: '3 Months' },
  { key: '6m', label: '6 Months' },
  { key: '1y', label: 'Year' },
];

const CRITERIA: { key: AnalyticsCriteria; label: string }[] = [
  { key: 'completed', label: 'Completed' },
  { key: 'skipped', label: 'Skipped' },
  { key: 'missed', label: 'Missed' },
  { key: 'successRate', label: 'Success Rate' },
];

const ACCENT = A.gold;
const CHART_HEIGHT = 238;
const CHART_PAD_LEFT = 42;
const CHART_PAD_RIGHT = 14;
const CHART_PAD_TOP = 24;
const CHART_PAD_BOTTOM = 28;
const AXIS_LABEL_COLOR = '#9A9287';
const AXIS_LABEL_SIZE = 11.5;

interface Props {
  snapshots: DailyAnalyticsSnapshot[];
  sourceFilter: SourceFilter;
  accentColor?: string;
}

export default function AnalyticsChart({ snapshots, sourceFilter, accentColor = ACCENT }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  // Page padding (32) + card borders (2) + the chart well's own padding (8).
  // Sized to the pixel so the plot never bleeds past the card's rounded edge —
  // the card keeps its shadow, so it cannot clip its own contents.
  const chartWidth = Math.max(260, screenWidth - 42);
  const reduceMotion = useReducedMotion();

  const [period, setPeriod] = useState<AnalyticsPeriod>('1m');
  const [criteria, setCriteria] = useState<AnalyticsCriteria>('successRate');

  const availableMonths = useMemo(() => getAvailableMonths(snapshots), [snapshots]);
  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);

  const canGoPrev = period === '1m' && availableMonths.indexOf(selectedMonth) > 0;
  const canGoNext = period === '1m' && selectedMonth < currentMonthKey;

  const goPrev = () => {
    const idx = availableMonths.indexOf(selectedMonth);
    if (idx > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setSelectedMonth(availableMonths[idx - 1]);
    }
  };
  const goNext = () => {
    const idx = availableMonths.indexOf(selectedMonth);
    if (idx >= 0 && idx < availableMonths.length - 1 && availableMonths[idx + 1] <= currentMonthKey) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setSelectedMonth(availableMonths[idx + 1]);
    }
  };

  const chartData = useMemo(
    () => aggregateByPeriod(snapshots, period, sourceFilter, period === '1m' ? selectedMonth : undefined),
    [snapshots, period, sourceFilter, selectedMonth],
  );
  const visibleChartData = useMemo(
    () => (criteria === 'successRate'
      ? chartData.filter(point => point.scheduled > 0)
      : chartData),
    [chartData, criteria],
  );

  const trend = useMemo(
    () => computeTrend(
      snapshots,
      period,
      sourceFilter,
      period === '1m' ? selectedMonth : undefined,
      criteria,
    ),
    [snapshots, period, sourceFilter, selectedMonth, criteria],
  );

  const isPercentage = criteria === 'successRate';

  return (
    <View style={s.card}>
      {/* Header */}
      <View style={s.headerWrap}>
        <SectionHead
          Icon={TrendingUp}
          title="Trends"
          caption="Tap any point on the line to read its value."
        />

        {/* Period rail */}
        <SegmentedRail size="sm" gutter={0} items={PERIODS} value={period} onChange={setPeriod} />

        {/* Month selector — only Monthly */}
        {period === '1m' && (
          <View style={s.monthRow}>
            <TouchableOpacity
              onPress={goPrev}
              disabled={!canGoPrev}
              activeOpacity={0.7}
              style={[s.monthBtn, !canGoPrev && s.monthBtnDisabled]}
              hitSlop={8}
            >
              <ChevronLeft s={19} c={canGoPrev ? accentColor : '#D6D3D1'} />
            </TouchableOpacity>
            <Text style={s.monthLabel} numberOfLines={1}>{getMonthLabel(selectedMonth)}</Text>
            <TouchableOpacity
              onPress={goNext}
              disabled={!canGoNext}
              activeOpacity={0.7}
              style={[s.monthBtn, !canGoNext && s.monthBtnDisabled]}
              hitSlop={8}
            >
              <ChevronRight s={19} c={canGoNext ? accentColor : '#D6D3D1'} />
            </TouchableOpacity>
          </View>
        )}

        <View style={s.divider} />

        {/* Criteria rail — the ink register, so the two selectors never
            read as the same choice made twice. */}
        <SegmentedRail size="sm" gutter={0} variant="ink" items={CRITERIA} value={criteria} onChange={setCriteria} />

        {/* Trend badge */}
        <View style={s.trendRow}>
          <TrendBadge
            direction={trend.direction}
            value={trend.value}
            unit={trend.unit}
            criteria={criteria}
          />
        </View>
      </View>

      {/* Chart — re-drawn with a soft fade whenever the filters change */}
      <View style={[s.chartWrap, { height: CHART_HEIGHT }]}>
        {visibleChartData.length > 0 ? (
          <Animated.View
            key={`${period}-${criteria}-${selectedMonth}-${sourceFilter}`}
            entering={reduceMotion ? undefined : FadeIn.duration(300).easing(Easing.out(Easing.cubic))}
          >
            <ChartArea
              data={visibleChartData}
              criteria={criteria}
              isPercentage={isPercentage}
              color={accentColor}
              width={chartWidth}
            />
          </Animated.View>
        ) : (
          <View style={s.emptyChart}>
            <Text style={s.emptyText}>No data for this period</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function TrendBadge({
  direction,
  value,
  unit,
  criteria,
}: {
  direction: 'up' | 'down' | 'flat';
  value: number;
  unit: 'count' | 'pct';
  criteria: AnalyticsCriteria;
}) {
  const label = `${value}${unit === 'pct' ? '%' : ''} ${direction === 'down' ? 'less' : 'more'} than the period before`;
  const isMissed = criteria === 'missed';
  const isSkipped = criteria === 'skipped';
  const isPositive = isMissed ? direction === 'down' : direction === 'up';
  const tone = isSkipped
    ? { color: '#8A6720', bg: '#FBF4E4', border: 'rgba(154,116,38,0.22)' }
    : isPositive
      ? { color: '#2F6B3E', bg: '#F0F6F0', border: 'rgba(47,107,62,0.20)' }
      : { color: '#A0464A', bg: '#FBF0F0', border: 'rgba(160,70,74,0.20)' };

  if (direction === 'flat') {
    return (
      <View style={[s.badge, s.badgeFlat]}>
        <Minus s={13} c={A.faint} w={2.4} />
        <Text style={[s.badgeText, { color: A.muted }]} numberOfLines={1}>
          No change from the period before
        </Text>
      </View>
    );
  }

  const Arrow = direction === 'up' ? TrendingUp : TrendingDown;

  return (
    <View style={[s.badge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <Arrow s={13} c={tone.color} w={2.4} />
      <Text style={[s.badgeText, { color: tone.color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function ChartArea({
  data,
  criteria,
  isPercentage,
  color,
  width,
}: {
  data: ChartDataPoint[];
  criteria: AnalyticsCriteria;
  isPercentage: boolean;
  color: string;
  width: number;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const innerW = width - CHART_PAD_LEFT - CHART_PAD_RIGHT;
  const innerH = CHART_HEIGHT - CHART_PAD_TOP - CHART_PAD_BOTTOM;

  const values = data.map(d => d[criteria]);
  const maxVal = isPercentage ? 100 : Math.max(1, ...values);
  const yTicks = isPercentage
    ? [0, 25, 50, 75, 100]
    : Array.from(new Set([0, Math.round(maxVal / 2), maxVal]));

  const xStep = data.length > 1 ? innerW / (data.length - 1) : innerW;

  // Build Path d string. We use Catmull-Rom -> bezier conversion for a
  // smooth "monotone" feel close to recharts' type="monotone".
  const points = data.map((d, i) => ({
    x: CHART_PAD_LEFT + i * xStep,
    y: CHART_PAD_TOP + innerH * (1 - (d[criteria] / (maxVal || 1))),
  }));

  // Monotone cubic interpolation (Fritsch–Carlson tangents): guarantees the
  // curve does not overshoot local extrema, so peaks never poke above the
  // chart frame.
  const yMin = CHART_PAD_TOP;
  const yMax = CHART_PAD_TOP + innerH;
  const linePath = (() => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    const n = points.length;
    const dx: number[] = new Array(n - 1);
    const slopes: number[] = new Array(n - 1);
    for (let i = 0; i < n - 1; i++) {
      dx[i] = points[i + 1].x - points[i].x;
      slopes[i] = (points[i + 1].y - points[i].y) / dx[i];
    }
    const tan: number[] = new Array(n);
    tan[0] = slopes[0];
    tan[n - 1] = slopes[n - 2];
    for (let i = 1; i < n - 1; i++) {
      if (slopes[i - 1] * slopes[i] <= 0) {
        tan[i] = 0; // local extremum — flat tangent kills overshoot
      } else {
        const w1 = 2 * dx[i] + dx[i - 1];
        const w2 = dx[i] + 2 * dx[i - 1];
        tan[i] = (w1 + w2) / (w1 / slopes[i - 1] + w2 / slopes[i]);
      }
    }
    const clampY = (y: number) => Math.max(yMin, Math.min(yMax, y));
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < n - 1; i++) {
      const cp1x = points[i].x + dx[i] / 3;
      const cp1y = clampY(points[i].y + (tan[i] * dx[i]) / 3);
      const cp2x = points[i + 1].x - dx[i] / 3;
      const cp2y = clampY(points[i + 1].y - (tan[i + 1] * dx[i]) / 3);
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${points[i + 1].x} ${points[i + 1].y}`;
    }
    return d;
  })();

  const areaPath = (() => {
    if (points.length === 0) return '';
    const baseY = CHART_PAD_TOP + innerH;
    const last = points[points.length - 1];
    return `${linePath} L ${last.x} ${baseY} L ${points[0].x} ${baseY} Z`;
  })();

  // Guard against stale selectedIdx when underlying data length changes
  const safeSelected =
    selectedIdx !== null && selectedIdx >= 0 && selectedIdx < data.length ? selectedIdx : null;

  // Tooltip metrics — clamp to chart bounds so it never falls off the edge
  const TOOLTIP_W = 128;
  const TOOLTIP_H = 48;
  const tooltipLeft =
    safeSelected !== null
      ? Math.max(
          CHART_PAD_LEFT - 10,
          Math.min(width - TOOLTIP_W - 4, points[safeSelected].x - TOOLTIP_W / 2),
        )
      : 0;
  const tooltipTop =
    safeSelected !== null
      ? Math.max(0, points[safeSelected].y - TOOLTIP_H - 12)
      : 0;

  return (
    <View style={{ width, height: CHART_HEIGHT, position: 'relative' }}>
    <Svg width={width} height={CHART_HEIGHT}>
      <Defs>
        <SvgLinearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity={0.34} />
          <Stop offset="70%" stopColor={color} stopOpacity={0.08} />
          <Stop offset="100%" stopColor={color} stopOpacity={0.01} />
        </SvgLinearGradient>
      </Defs>

      {/* Y-axis grid + labels */}
      {yTicks.map(t => {
        const y = CHART_PAD_TOP + innerH * (1 - t / (maxVal || 1));
        return (
          <React.Fragment key={`grid-${t}`}>
            <Line
              x1={CHART_PAD_LEFT}
              x2={CHART_PAD_LEFT + innerW}
              y1={y}
              y2={y}
              stroke={t === 0 ? '#E6DFD2' : '#F0EDE6'}
              strokeWidth={1}
              strokeDasharray={t === 0 ? undefined : '3 5'}
            />
            <SvgText
              x={CHART_PAD_LEFT - 8}
              y={y + AXIS_LABEL_SIZE / 3}
              fontSize={AXIS_LABEL_SIZE}
              fill={AXIS_LABEL_COLOR}
              textAnchor="end"
              fontFamily="System"
              fontWeight="bold"
            >
              {isPercentage ? `${t}%` : String(t)}
            </SvgText>
          </React.Fragment>
        );
      })}

      {/* Guide line under the selected point */}
      {safeSelected !== null && (
        <Line
          x1={points[safeSelected].x}
          x2={points[safeSelected].x}
          y1={points[safeSelected].y}
          y2={CHART_PAD_TOP + innerH}
          stroke={color}
          strokeOpacity={0.4}
          strokeWidth={1.5}
          strokeDasharray="3 4"
        />
      )}

      {/* Area fill */}
      {areaPath !== '' && <Path d={areaPath} fill="url(#chartFill)" />}

      {/* Line */}
      {linePath !== '' && (
        <>
          <Path d={linePath} stroke={color} strokeOpacity={0.16} strokeWidth={6} fill="none" strokeLinecap="round" />
          <Path d={linePath} stroke={color} strokeWidth={2.8} fill="none" strokeLinecap="round" />
        </>
      )}

      {/* Dots only — values revealed on tap (tooltip rendered as RN overlay below) */}
      {points.map((p, i) => {
        const isLast = i === points.length - 1;
        const isSelected = i === safeSelected;
        return (
          <React.Fragment key={`pt-${i}`}>
            {(isSelected || isLast) && (
              <Circle cx={p.x} cy={p.y} r={isSelected ? 11 : 8} fill={color} opacity={isSelected ? 0.16 : 0.1} />
            )}
            <Circle
              cx={p.x}
              cy={p.y}
              r={isSelected ? 5.5 : isLast ? 4.5 : 2.8}
              fill={color}
              stroke="#FFFFFF"
              strokeWidth={isSelected ? 2.5 : isLast ? 2 : 1.5}
            />
          </React.Fragment>
        );
      })}

      {/* X-axis labels — adaptive density: dense data shows ~5 evenly spaced */}
      {(() => {
        if (data.length === 0) return null;
        const maxLabels = 5;
        let idxs: number[];
        if (data.length <= maxLabels) {
          idxs = data.map((_, i) => i);
        } else {
          idxs = Array.from({ length: maxLabels }, (_, k) =>
            Math.round((k * (data.length - 1)) / (maxLabels - 1)),
          );
        }
        const xAxisY = CHART_PAD_TOP + innerH + AXIS_LABEL_SIZE + 8;
        return idxs.map(i => (
          <SvgText
            key={`xlabel-${i}`}
            x={points[i].x}
            y={xAxisY}
            fontSize={AXIS_LABEL_SIZE}
            fill={i === safeSelected ? color : AXIS_LABEL_COLOR}
            textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
            fontFamily="System"
            fontWeight="bold"
          >
            {data[i].label}
          </SvgText>
        ));
      })()}
    </Svg>

      {/* Tap hit-zones — one per point, larger than visible dot for easy tap */}
      {points.map((p, i) => (
        <Pressable
          key={`tap-${i}`}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setSelectedIdx(prev => (prev === i ? null : i));
          }}
          hitSlop={6}
          style={{
            position: 'absolute',
            left: p.x - 17,
            top: p.y - 17,
            width: 34,
            height: 34,
          }}
        />
      ))}

      {/* Tooltip — shown only when a dot is selected */}
      {safeSelected !== null && (
        <Animated.View
          pointerEvents="none"
          entering={FadeIn.duration(160)}
          style={[
            s.tooltip,
            {
              left: tooltipLeft,
              top: tooltipTop,
              width: TOOLTIP_W,
              height: TOOLTIP_H,
              borderColor: `${color}55`,
            },
          ]}
        >
          <Text style={s.tooltipLabel} numberOfLines={1}>
            {data[safeSelected].label}
          </Text>
          <Text style={[s.tooltipValue, { color }]} numberOfLines={1}>
            {isPercentage ? `${data[safeSelected][criteria]}%` : data[safeSelected][criteria]}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { ...cardShell, paddingVertical: 18 },
  headerWrap: { paddingHorizontal: 18, rowGap: 12 },


  divider: { height: 1, backgroundColor: A.lineSoft, marginHorizontal: 2 },

  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 12,
  },
  monthBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FCFAF6',
    borderWidth: 1,
    borderColor: A.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthBtnDisabled: { opacity: 0.42 },
  monthLabel: {
    fontFamily: F.serifSemiBold,
    fontSize: 18,
    letterSpacing: -0.2,
    color: A.ink,
    minWidth: 140,
    textAlign: 'center',
  },

  trendRow: { flexDirection: 'row', alignItems: 'center' },
  badge: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  badgeFlat: { backgroundColor: '#F6F4F1', borderColor: A.line },
  badgeText: { flexShrink: 1, fontFamily: F.sansSemiBold, fontSize: 12.5, letterSpacing: 0.1 },

  chartWrap: { paddingTop: 16, paddingHorizontal: 4 },
  emptyChart: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: F.serifMediumItalic, fontSize: 16, color: A.faint },

  tooltip: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: 1,
    shadowColor: '#1C1917',
    shadowOpacity: 0.13,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 9,
    elevation: 4,
  },
  tooltipLabel: {
    fontFamily: F.sansSemiBold,
    fontSize: 11.5,
    letterSpacing: 0.2,
    color: A.muted,
  },
  tooltipValue: {
    fontFamily: F.serifSemiBold,
    fontSize: 20,
    lineHeight: 23,
    fontVariant: ['tabular-nums'],
  },
});
