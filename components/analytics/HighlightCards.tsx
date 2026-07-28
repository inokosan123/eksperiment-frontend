import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import {
  Activity,
  CalendarCheck,
  Crown,
  Sparkles,
  Trophy,
} from '@/components/icons/Icons';
import type { StreakLeader } from '@/components/analytics/analyticsOverview';
import {
  A,
  cardShell,
  Diamond,
  HairRule,
  MarqueeText,
  SectionHead,
  type IconComp,
} from '@/components/analytics/analyticsUi';
import { F } from '@/constants/tokens';

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

/**
 * Every highlight is one half of a pair — a best against a worst, a
 * strongest against a weakest. Six separate chips hid that; a group
 * holding two facing readings across a ruled spine shows it, and gives
 * each name the full half-width it needs.
 */
interface Reading {
  caption: string;
  value: string;
  unit?: string;
  name: string;
}

interface PairGroup {
  key: string;
  eyebrow: string;
  Icon: IconComp;
  left: Reading;
  right: Reading;
  /** A weak side reads in oxblood; two neutral readings both stay gold. */
  contrast?: boolean;
}

function PairSide({ reading, tone }: { reading: Reading; tone: 'high' | 'low' }) {
  const ink = tone === 'low' ? A.missedInk : A.numberInk;
  const capColor = tone === 'low' ? 'rgba(142,58,71,0.78)' : 'rgba(121,89,30,0.78)';
  const dot = tone === 'low' ? A.missed : A.gold;
  const known = reading.value !== '—';

  return (
    <View style={s.side}>
      <View style={s.sideCap}>
        <Diamond size={4} color={known ? dot : A.line} />
        <Text style={[s.caption, { color: known ? capColor : A.faint }]} numberOfLines={1}>
          {reading.caption}
        </Text>
      </View>

      <View style={s.valueRow}>
        <Text
          style={[s.value, { color: known ? ink : '#C4BDB2' }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.66}
        >
          {reading.value}
        </Text>
        {known && !!reading.unit && <Text style={s.unit}>{reading.unit}</Text>}
      </View>

      <MarqueeText
        text={reading.name}
        style={[s.name, !known && { color: '#C4BDB2' }]}
        fadeColor="#FCFAF5"
      />
    </View>
  );
}

function PairGroupBlock({ group, index }: { group: PairGroup; index: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View
      entering={
        reduceMotion
          ? undefined
          : FadeInDown.duration(380).delay(70 + index * 80).easing(Easing.out(Easing.cubic))
      }
      style={s.group}
    >
      <View style={s.groupHead}>
        <group.Icon s={13} c={A.gold} w={2.1} />
        <Text style={s.groupEyebrow} numberOfLines={1}>
          {group.eyebrow}
        </Text>
        <HairRule style={s.groupRule} />
      </View>

      <View style={s.groupBody}>
        <PairSide reading={group.left} tone="high" />
        <View style={s.spine} />
        <PairSide reading={group.right} tone={group.contrast === false ? 'high' : 'low'} />
      </View>
    </Animated.View>
  );
}

function HighlightSection({ groups, caption }: { groups: PairGroup[]; caption: string }) {
  return (
    <View style={s.card}>
      <SectionHead Icon={Trophy} title="Highlights" caption={caption} />
      <View style={s.groups}>
        {groups.map((g, i) => (
          <PairGroupBlock key={g.key} group={g} index={i} />
        ))}
      </View>
    </View>
  );
}

const days = (n: number | undefined) => (n === 1 ? 'day' : 'days');
const tasks = (n: number | undefined) => (n === 1 ? 'task' : 'tasks');

export default function HighlightCards({
  bestStreakEver,
  worstStreakEver,
  currentBestStreak,
  currentWorstStreak,
  mostConsistent,
  leastConsistent,
}: HighlightCardsProps) {
  const groups: PairGroup[] = [
    {
      key: 'ever',
      eyebrow: 'LONGEST RUN EVER',
      Icon: Trophy,
      left: {
        caption: 'BEST',
        value: bestStreakEver ? String(bestStreakEver.bestStreak) : '—',
        unit: days(bestStreakEver?.bestStreak),
        name: bestStreakEver?.name ?? 'Nothing tracked yet',
      },
      right: {
        caption: 'WEAKEST',
        value: worstStreakEver ? String(worstStreakEver.bestStreak) : '—',
        unit: days(worstStreakEver?.bestStreak),
        name: worstStreakEver?.name ?? 'Nothing tracked yet',
      },
    },
    {
      key: 'now',
      eyebrow: 'RUNNING RIGHT NOW',
      Icon: Activity,
      left: {
        caption: 'BEST',
        value: currentBestStreak ? String(currentBestStreak.currentStreak) : '—',
        unit: days(currentBestStreak?.currentStreak),
        name: currentBestStreak?.name ?? 'No streak running',
      },
      right: {
        caption: 'WEAKEST',
        value: currentWorstStreak ? String(currentWorstStreak.currentStreak) : '—',
        unit: days(currentWorstStreak?.currentStreak),
        name: currentWorstStreak?.name ?? 'Nothing slipping',
      },
    },
    {
      key: 'consistency',
      eyebrow: 'CONSISTENCY',
      Icon: Crown,
      left: {
        caption: 'MOST',
        value: mostConsistent ? String(mostConsistent.pct) : '—',
        unit: '%',
        name: mostConsistent?.name ?? 'Nothing tracked yet',
      },
      right: {
        caption: 'LEAST',
        value: leastConsistent ? String(leastConsistent.pct) : '—',
        unit: '%',
        name: leastConsistent?.name ?? 'Nothing tracked yet',
      },
    },
  ];

  return <HighlightSection groups={groups} caption="Your strongest and weakest runs, side by side." />;
}

function formatDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return dateKey;
  const date = new Date(y, m - 1, d, 12);
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(date);
}

export function QuickTaskHighlightCards({
  totalDone,
  avgPerDay,
  bestDay,
  worstDay,
  thisWeekCount,
  thisMonthCount,
}: QuickTaskHighlightCardsProps) {
  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date());

  const groups: PairGroup[] = [
    {
      key: 'volume',
      eyebrow: 'ALL TIME',
      Icon: Sparkles,
      contrast: false,
      left: {
        caption: 'TOTAL',
        value: String(totalDone),
        unit: tasks(totalDone),
        name: 'Since you started',
      },
      right: {
        caption: 'AVERAGE',
        value: String(avgPerDay),
        unit: 'a day',
        name: 'On days with quick tasks',
      },
    },
    {
      key: 'single-day',
      eyebrow: 'SINGLE DAY',
      Icon: Trophy,
      left: {
        caption: 'BEST',
        value: bestDay ? String(bestDay.count) : '—',
        unit: tasks(bestDay?.count),
        name: bestDay ? formatDayLabel(bestDay.date) : 'Nothing tracked yet',
      },
      right: {
        caption: 'WEAKEST',
        value: worstDay ? String(worstDay.count) : '—',
        unit: tasks(worstDay?.count),
        name: worstDay ? formatDayLabel(worstDay.date) : 'Nothing tracked yet',
      },
    },
    {
      key: 'recent',
      eyebrow: 'RECENTLY',
      Icon: CalendarCheck,
      contrast: false,
      left: {
        caption: 'THIS WEEK',
        value: String(thisWeekCount),
        unit: tasks(thisWeekCount),
        name: 'So far',
      },
      right: {
        caption: 'THIS MONTH',
        value: String(thisMonthCount),
        unit: tasks(thisMonthCount),
        name: monthName,
      },
    },
  ];

  return <HighlightSection groups={groups} caption="How your quick tasks have been adding up." />;
}

const s = StyleSheet.create({
  card: { ...cardShell, padding: 18 },
  groups: { marginTop: 16, rowGap: 10 },

  group: {
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: A.line,
    backgroundColor: '#FCFAF5',
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 13,
  },
  groupHead: { flexDirection: 'row', alignItems: 'center', columnGap: 7 },
  groupEyebrow: {
    fontFamily: F.sansBold,
    fontSize: 8.4,
    letterSpacing: 1.3,
    color: 'rgba(121,89,30,0.72)',
  },
  groupRule: { flex: 1, marginLeft: 2 },

  groupBody: { marginTop: 11, flexDirection: 'row', alignItems: 'flex-start' },
  // The ruled spine the two readings face across.
  spine: { width: 1, alignSelf: 'stretch', marginHorizontal: 13, backgroundColor: A.lineSoft },

  side: { flex: 1, minWidth: 0 },
  sideCap: { flexDirection: 'row', alignItems: 'center', columnGap: 5 },
  caption: { fontFamily: F.sansBold, fontSize: 8.6, letterSpacing: 1.05 },

  valueRow: { marginTop: 5, flexDirection: 'row', alignItems: 'baseline', columnGap: 4 },
  value: {
    flexShrink: 1,
    fontFamily: F.serifSemiBold,
    fontSize: 27,
    lineHeight: 30,
    letterSpacing: -0.5,
    includeFontPadding: false,
    fontVariant: ['lining-nums', 'tabular-nums'],
  },
  unit: { fontFamily: F.serifItalic, fontSize: 13.5, color: A.faint },

  name: {
    marginTop: 4,
    fontFamily: F.serif,
    fontSize: 14,
    lineHeight: 18,
    color: A.muted,
  },
});
