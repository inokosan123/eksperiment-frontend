import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop, Line, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
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
import { F } from '@/constants/tokens';

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

const ACCENT = '#C5A059';
const CHART_HEIGHT = 200;
const CHART_PAD_LEFT = 30;
const CHART_PAD_RIGHT = 12;
const CHART_PAD_TOP = 8;
const CHART_PAD_BOTTOM = 22;

interface Props {
  snapshots: DailyAnalyticsSnapshot[];
  sourceFilter: SourceFilter;
  accentColor?: string;
}

export default function AnalyticsChart({ snapshots, sourceFilter, accentColor = ACCENT }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = Math.max(280, screenWidth - 32 /* page padding */ - 4 /* card edge */);

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
        <View style={s.headerRow}>
          <TrendingUp s={14} c={accentColor} w={2} />
          <Text style={s.headerKicker}>TRENDS</Text>
        </View>

        {/* Period pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillsRow}>
          {PERIODS.map(p => (
            <PeriodPill
              key={p.key}
              label={p.label}
              active={period === p.key}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setPeriod(p.key);
              }}
            />
          ))}
        </ScrollView>

        {/* Month selector — only Monthly */}
        {period === '1m' && (
          <View style={s.monthRow}>
            <TouchableOpacity
              onPress={goPrev}
              disabled={!canGoPrev}
              activeOpacity={0.7}
              style={[s.monthBtn, !canGoPrev && s.monthBtnDisabled]}
            >
              <ChevronLeft s={18} c={canGoPrev ? accentColor : '#D6D3D1'} />
            </TouchableOpacity>
            <Text style={s.monthLabel}>{getMonthLabel(selectedMonth)}</Text>
            <TouchableOpacity
              onPress={goNext}
              disabled={!canGoNext}
              activeOpacity={0.7}
              style={[s.monthBtn, !canGoNext && s.monthBtnDisabled]}
            >
              <ChevronRight s={18} c={canGoNext ? accentColor : '#D6D3D1'} />
            </TouchableOpacity>
          </View>
        )}

        {/* Criteria pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillsRow}>
          {CRITERIA.map(c => (
            <CriteriaPill
              key={c.key}
              label={c.label}
              active={criteria === c.key}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setCriteria(c.key);
              }}
            />
          ))}
        </ScrollView>

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

      {/* Chart */}
      <View style={[s.chartWrap, { height: CHART_HEIGHT }]}>
        {visibleChartData.length > 0 ? (
          <ChartArea
            data={visibleChartData}
            criteria={criteria}
            isPercentage={isPercentage}
            color={accentColor}
            width={chartWidth}
          />
        ) : (
          <View style={s.emptyChart}>
            <Text style={s.emptyText}>No data for this period</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function PeriodPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  if (active) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.84}>
        <LinearGradient
          colors={['#E2BD75', '#C5A059', '#A87E33']}
          locations={[0, 0.55, 1]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={[s.pill, s.pillActive]}
        >
          <Text style={[s.pillLabel, s.pillLabelActive]}>{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.84} style={s.pill}>
      <Text style={s.pillLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function CriteriaPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.84}
      style={[s.pill, active && s.pillCriteriaActive]}
    >
      <Text style={[s.pillLabel, active && s.pillLabelInk]}>{label}</Text>
    </TouchableOpacity>
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
  const label = `${value}${unit === 'pct' ? '%' : ''} ${direction === 'down' ? 'less' : 'more'} vs prev`;
  const isMissed = criteria === 'missed';
  const isSkipped = criteria === 'skipped';
  const isPositive = isMissed ? direction === 'down' : direction === 'up';
  const tone = isSkipped
    ? { color: '#9A7426', bg: '#FEF3C7' }
    : isPositive
      ? { color: '#15803D', bg: '#DCFCE7' }
      : { color: '#B91C1C', bg: '#FEE2E2' };

  if (direction === 'up') {
    return (
      <View style={[s.badge, { backgroundColor: tone.bg }]}>
        <TrendingUp s={12} c={tone.color} w={2.4} />
        <Text style={[s.badgeText, { color: tone.color }]}>{label}</Text>
      </View>
    );
  }
  if (direction === 'down') {
    return (
      <View style={[s.badge, { backgroundColor: tone.bg }]}>
        <TrendingDown s={12} c={tone.color} w={2.4} />
        <Text style={[s.badgeText, { color: tone.color }]}>{label}</Text>
      </View>
    );
  }
  return (
    <View style={[s.badge, s.badgeFlat]}>
      <Minus s={12} c="#A8A29E" w={2.4} />
      <Text style={[s.badgeText, { color: '#78716C' }]}>No change</Text>
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

  const linePath = (() => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] ?? points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] ?? p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  })();

  const areaPath = (() => {
    if (points.length === 0) return '';
    const baseY = CHART_PAD_TOP + innerH;
    const last = points[points.length - 1];
    return `${linePath} L ${last.x} ${baseY} L ${points[0].x} ${baseY} Z`;
  })();

  // X labels — show every Nth depending on density
  return (
    <Svg width={width} height={CHART_HEIGHT}>
      <Defs>
        <SvgLinearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity={0.32} />
          <Stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </SvgLinearGradient>
      </Defs>

      {/* Y-axis grid */}
      {yTicks.map(t => {
        const y = CHART_PAD_TOP + innerH * (1 - t / (maxVal || 1));
        return (
          <React.Fragment key={`grid-${t}`}>
            <Line
              x1={CHART_PAD_LEFT}
              x2={CHART_PAD_LEFT + innerW}
              y1={y}
              y2={y}
              stroke="#F0EDE6"
              strokeWidth={1}
              strokeDasharray={t === 0 ? undefined : '3 4'}
            />
          </React.Fragment>
        );
      })}

      {/* Area fill */}
      {areaPath !== '' && <Path d={areaPath} fill="url(#chartFill)" />}

      {/* Line */}
      {linePath !== '' && <Path d={linePath} stroke={color} strokeWidth={2.5} fill="none" />}

      {/* Last data point dot */}
      {points.length > 0 && (
        <Circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={4}
          fill={color}
          stroke="#FFFFFF"
          strokeWidth={2}
        />
      )}

      {/* Y-axis labels (left) — react-native-svg supports Text but importing
          it conflicts with rn Text. We render labels via View/Text overlay
          for sharper rendering across iOS/Android. */}
    </Svg>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0EDE6',
    paddingVertical: 16,
    overflow: 'hidden',
    shadowColor: '#1C1917',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 7,
    elevation: 1,
  },
  headerWrap: { paddingHorizontal: 16, rowGap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', columnGap: 6 },
  headerKicker: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.2, color: ACCENT },

  pillsRow: { columnGap: 6, paddingRight: 4, paddingBottom: 2 },
  pill: {
    minHeight: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F4',
    borderWidth: 1,
    borderColor: '#F0EDE6',
  },
  pillActive: {
    borderWidth: 0,
    shadowColor: '#A87E33',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 9,
    elevation: 2,
  },
  pillCriteriaActive: {
    backgroundColor: '#1C1917',
    borderColor: '#1C1917',
  },
  pillLabel: { fontFamily: F.sansBold, fontSize: 10.5, letterSpacing: 0.6, color: '#78716C' },
  pillLabelActive: { color: '#FFFFFF', letterSpacing: 0.8 },
  pillLabelInk: { color: '#FFFFFF' },

  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 10,
    paddingTop: 2,
  },
  monthBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FAFAF9',
    borderWidth: 1,
    borderColor: '#F0EDE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthBtnDisabled: { opacity: 0.45 },
  monthLabel: {
    fontFamily: F.serifMedium,
    fontSize: 14,
    color: '#1A1714',
    minWidth: 130,
    textAlign: 'center',
  },

  trendRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 2 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeFlat: { backgroundColor: '#F5F5F4' },
  badgeText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 0.4 },

  chartWrap: { paddingTop: 14, paddingHorizontal: 4 },
  emptyChart: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: F.serifMediumItalic, fontSize: 14, color: '#A8A29E' },
});
