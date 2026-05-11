import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  AlertTriangle,
  Crown,
  Target,
  TrendingDown,
  Trophy,
} from '@/components/icons/Icons';
import type { StreakLeader } from '@/components/analytics/analyticsOverview';
import { F } from '@/constants/tokens';

const ACCENT = '#C5A059';

interface HighlightCardsProps {
  bestStreakEver: StreakLeader | null;
  worstStreakEver: StreakLeader | null;
  currentBestStreak: StreakLeader | null;
  currentWorstStreak: StreakLeader | null;
  mostConsistent: { name: string; pct: number } | null;
  leastConsistent: { name: string; pct: number } | null;
}

interface QuickTaskHighlightCardsProps {
  totalDone: number;
  avgPerDay: number;
  bestDay: { date: string; count: number } | null;
  worstDay: { date: string; count: number } | null;
  thisWeekCount: number;
  thisMonthCount: number;
}

type IconComp = React.ComponentType<{ s?: number; c?: string; w?: number }>;

function HighlightCard({
  Icon,
  label,
  value,
  detail,
}: {
  Icon: IconComp;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <View style={s.tile}>
      <View style={s.tileHead}>
        <Icon s={11} c={ACCENT} w={2.2} />
        <Text style={s.tileLabel} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={s.tileValue} numberOfLines={1}>{value}</Text>
      {detail ? <Text style={s.tileDetail} numberOfLines={1}>{detail}</Text> : null}
    </View>
  );
}

function HighlightSection({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.card}>
      <View style={s.head}>
        <Trophy s={14} c={ACCENT} w={2} />
        <Text style={s.kicker}>HIGHLIGHTS</Text>
      </View>
      <View style={s.grid}>{children}</View>
    </View>
  );
}

export default function HighlightCards({
  bestStreakEver,
  worstStreakEver,
  currentBestStreak,
  currentWorstStreak,
  mostConsistent,
  leastConsistent,
}: HighlightCardsProps) {
  return (
    <HighlightSection>
      <HighlightCard
        Icon={Trophy}
        label="Best Streak"
        value={bestStreakEver ? `${bestStreakEver.bestStreak} days` : '--'}
        detail={bestStreakEver?.name}
      />
      <HighlightCard
        Icon={TrendingDown}
        label="Worst Streak"
        value={worstStreakEver ? `${worstStreakEver.bestStreak} days` : '--'}
        detail={worstStreakEver?.name}
      />
      <HighlightCard
        Icon={Trophy}
        label="Current Best"
        value={currentBestStreak ? `${currentBestStreak.currentStreak} days` : '--'}
        detail={currentBestStreak?.name}
      />
      <HighlightCard
        Icon={AlertTriangle}
        label="Current Worst"
        value={currentWorstStreak ? `${currentWorstStreak.currentStreak} days` : '--'}
        detail={currentWorstStreak?.name}
      />
      <HighlightCard
        Icon={Crown}
        label="Most Consistent"
        value={mostConsistent ? `${mostConsistent.pct}%` : '--'}
        detail={mostConsistent?.name}
      />
      <HighlightCard
        Icon={Target}
        label="Least Consistent"
        value={leastConsistent ? `${leastConsistent.pct}%` : '--'}
        detail={leastConsistent?.name}
      />
    </HighlightSection>
  );
}

export function QuickTaskHighlightCards({
  totalDone,
  avgPerDay,
  bestDay,
  worstDay,
  thisWeekCount,
  thisMonthCount,
}: QuickTaskHighlightCardsProps) {
  return (
    <HighlightSection>
      <HighlightCard Icon={Target} label="Total Done" value={String(totalDone)} />
      <HighlightCard Icon={TrendingDown} label="Avg / Day" value={String(avgPerDay)} />
      <HighlightCard
        Icon={Trophy}
        label="Best Day"
        value={bestDay ? String(bestDay.count) : '--'}
        detail={bestDay?.date}
      />
      <HighlightCard
        Icon={AlertTriangle}
        label="Worst Day"
        value={worstDay ? String(worstDay.count) : '--'}
        detail={worstDay?.date}
      />
      <HighlightCard Icon={Trophy} label="This Week" value={String(thisWeekCount)} />
      <HighlightCard Icon={Crown} label="This Month" value={String(thisMonthCount)} />
    </HighlightSection>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0EDE6',
    padding: 14,
    shadowColor: '#1C1917',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 7,
    elevation: 1,
  },
  head: { flexDirection: 'row', alignItems: 'center', columnGap: 6, marginBottom: 12 },
  kicker: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.2, color: ACCENT },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 8 },
  tile: {
    width: '48%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    backgroundColor: '#FAFAF9',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tileHead: { flexDirection: 'row', alignItems: 'center', columnGap: 6 },
  tileLabel: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: '#A8A29E',
    flexShrink: 1,
  },
  tileValue: {
    marginTop: 6,
    fontFamily: F.serifMedium,
    fontSize: 17,
    lineHeight: 19,
    color: '#1A1714',
  },
  tileDetail: {
    marginTop: 2,
    fontFamily: F.sans,
    fontSize: 10,
    color: '#A8A29E',
  },
});
