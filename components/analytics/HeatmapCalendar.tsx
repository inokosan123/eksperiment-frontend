import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import type { DailyAnalyticsSnapshot, SourceFilter } from '@/components/analytics/analyticsOverview';
import { F } from '@/constants/tokens';

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
const ACCENT = '#C5A059';

interface Props {
  snapshots: DailyAnalyticsSnapshot[];
  sourceFilter: SourceFilter;
  months?: number;
  accentColor?: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
    : { r: 197, g: 160, b: 89 };
}

function heatColor(pct: number, accent: string, scheduled = 1): string {
  if (scheduled === 0) return '#FAFAF9';
  if (pct === 0) return '#F5F1EA';
  const { r, g, b } = hexToRgb(accent);
  const t = Math.min(pct / 100, 1);
  const cr = Math.round(255 - (255 - r) * t);
  const cg = Math.round(255 - (255 - g) * t);
  const cb = Math.round(255 - (255 - b) * t);
  return `rgb(${cr}, ${cg}, ${cb})`;
}

export default function HeatmapCalendar({
  snapshots,
  sourceFilter,
  months = 3,
  accentColor = ACCENT,
}: Props) {
  const { cells, monthLabels, weekCount } = useMemo(() => {
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    const start = new Date(now.getFullYear(), now.getMonth() - months, now.getDate(), 12);
    // Align start to Sunday so each column == one week
    start.setDate(start.getDate() - start.getDay());

    const snapMap = new Map<string, DailyAnalyticsSnapshot>();
    for (const s of snapshots) snapMap.set(s.date, s);

    const cells: { date: string; pct: number; scheduled: number; dayOfWeek: number; weekIndex: number }[] = [];
    const monthLabels: { label: string; weekIndex: number }[] = [];
    const seenMonths = new Set<string>();

    let weekIndex = 0;
    const cursor = new Date(start);

    while (cursor <= now) {
      const dow = cursor.getDay();
      if (dow === 0 && cells.length > 0) weekIndex += 1;

      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      const dateKey = `${y}-${m}-${d}`;
      const monthKey = `${y}-${m}`;

      if (!seenMonths.has(monthKey)) {
        seenMonths.add(monthKey);
        const label = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(cursor);
        monthLabels.push({ label, weekIndex });
      }

      const snap = snapMap.get(dateKey);
      let pct = 0;
      let scheduled = 0;
      if (snap) {
        const bucket = sourceFilter === 'all' ? snap.overall : snap.source[sourceFilter];
        pct = bucket.pct;
        scheduled = bucket.scheduled;
      }

      cells.push({ date: dateKey, pct, scheduled, dayOfWeek: dow, weekIndex });
      cursor.setDate(cursor.getDate() + 1);
    }

    return { cells, monthLabels, weekCount: weekIndex + 1 };
  }, [snapshots, sourceFilter, months]);

  const cellSize = 12;
  const gap = 3;
  const labelWidth = 36; // wider — gives 3-letter day labels (Mon/Wed/Fri) breathing room
  const headerHeight = 22;
  const trailingPad = 26; // room for the last month label so "May" doesn't clip at right edge
  const svgWidth = labelWidth + weekCount * (cellSize + gap) + trailingPad;
  const svgHeight = headerHeight + 7 * (cellSize + gap);

  return (
    <View style={s.card}>
      <View style={s.head}>
        <View style={[s.swatch, { backgroundColor: accentColor }]} />
        <Text style={s.kicker}>ACTIVITY</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 4 }}>
        <Svg width={svgWidth} height={svgHeight}>
          {/* Month labels */}
          {monthLabels.map((m, i) => (
            <SvgText
              key={`month-${i}`}
              x={labelWidth + m.weekIndex * (cellSize + gap)}
              y={15}
              fill="#78716C"
              fontSize={11}
              fontFamily="System"
              fontWeight="bold"
            >
              {m.label}
            </SvgText>
          ))}

          {/* Day labels — centered vertically against each cell row */}
          {DAY_LABELS.map((label, i) =>
            label ? (
              <SvgText
                key={`day-${i}`}
                x={4}
                y={headerHeight + i * (cellSize + gap) + cellSize / 2 + 4}
                fill="#78716C"
                fontSize={11}
                fontFamily="System"
                fontWeight="600"
              >
                {label}
              </SvgText>
            ) : null,
          )}

          {/* Cells */}
          {cells.map((cell, i) => (
            <Rect
              key={i}
              x={labelWidth + cell.weekIndex * (cellSize + gap)}
              y={headerHeight + cell.dayOfWeek * (cellSize + gap)}
              width={cellSize}
              height={cellSize}
              rx={2.5}
              fill={heatColor(cell.pct, accentColor, cell.scheduled)}
              opacity={cell.scheduled > 0 ? 1 : 0.55}
            />
          ))}
        </Svg>
      </ScrollView>

      {/* Legend */}
      <View style={s.legend}>
        <Text style={s.legendText}>Less</Text>
        {[0, 25, 50, 75, 100].map(pct => (
          <View key={pct} style={s.legendItem}>
            <View
              style={[s.legendSwatch, { backgroundColor: heatColor(pct, accentColor, 1) }]}
            />
            <Text style={s.legendValue}>{pct}%</Text>
          </View>
        ))}
        <Text style={s.legendText}>More</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0EDE6',
    padding: 16,
    shadowColor: '#1C1917',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 7,
    elevation: 1,
  },
  head: { flexDirection: 'row', alignItems: 'center', columnGap: 8, marginBottom: 14 },
  swatch: { width: 11, height: 11, borderRadius: 3 },
  kicker: { fontFamily: F.sansBold, fontSize: 12, letterSpacing: 2.2, color: ACCENT },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 10,
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0EDE6',
  },
  legendItem: { alignItems: 'center', rowGap: 2 },
  legendSwatch: { width: 14, height: 14, borderRadius: 3 },
  legendValue: { fontFamily: F.sansBold, fontSize: 10, color: '#78716C', letterSpacing: 0.4 },
  legendText: { fontFamily: F.sans, fontSize: 11, color: '#A8A29E' },
});
