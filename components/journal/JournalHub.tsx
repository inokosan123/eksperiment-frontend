import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Pressable,
  StyleSheet, Animated, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import {
  ArrowLeft, SlidersHorizontal, CalendarCheck, ChevronLeft, ChevronRight,
  Pencil, Feather, FileEdit, Star, ListChecks, BookMarked,
  Target, CalendarHeart, Grid3x3,
} from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG       = '#FAF7F0';
const GOLD     = '#C5A059';
const PURPLE   = '#7C6EAF';
const TEAL     = '#4A9E8F';
const CARD_BG  = '#FFFFFF';
const FLAME_P  = "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z";

type DotKind = 'journal' | 'morning' | 'free';
const DOT_COLORS: Record<DotKind, string> = {
  journal: GOLD, morning: PURPLE, free: TEAL,
};

// ─── Mock data ────────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

// April 2026: starts Wednesday (index 2 in MON-based grid)
const CAL_ROWS = [
  [null, null, 1,  2,  3,  4,  5 ],
  [6,   7,    8,  9,  10, 11, 12 ],
  [13,  14,   15, 16, 17, 18, 19 ],
  [20,  21,   22, 23, 24, 25, 26 ],
  [27,  28,   29, 30, null, null, null],
];
const TODAY_NUM = 22;

const DOTS: Record<number, DotKind[]> = {
  1:  ['journal','morning','free'],
  2:  ['journal','free'],
  4:  ['journal','morning'],
  5:  ['journal'],
  6:  ['journal','morning','free'],
  14: ['journal','free'],
  15: ['journal','morning','free'],
  20: ['journal','free'],
  22: ['journal'],
};

const STREAK = 3;
const LAST_7 = [
  { l:'T', active: false }, { l:'F', active: false },
  { l:'S', active: false }, { l:'S', active: false },
  { l:'M', active: true  }, { l:'T', active: true  },
  { l:'W', active: true  },
];

// ─── Flame SVG helper ─────────────────────────────────────────────────────────
function FlameSvg({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={FLAME_P} fill={color} />
    </Svg>
  );
}

// ─── Animated flame circle (pulse on active) ──────────────────────────────────
function StreakCircle({ active, label }: { active: boolean; label: string }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const glow  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0, duration: 900, useNativeDriver: false }),
      ])
    ).start();
  }, [active]);

  const shadowOpacity = glow.interpolate({ inputRange: [0,1], outputRange: [0.25, 0.55] });

  return (
    <View style={sc.col}>
      <Animated.View
        style={[
          sc.circle,
          active ? sc.circleActive : sc.circleInactive,
          active && {
            transform: [{ scale: pulse }],
            shadowOpacity,
            shadowColor: '#f97316',
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 0 },
            elevation: 5,
          },
        ]}
      >
        <FlameSvg size={18} color={active ? '#f97316' : '#d1cec8'} />
      </Animated.View>
      <Text style={[sc.label, { color: active ? GOLD : C.textMuted }]}>{label}</Text>
    </View>
  );
}

const sc = StyleSheet.create({
  col:           { alignItems: 'center', gap: 6 },
  circle:        { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  circleActive:  { borderColor: '#f97316', backgroundColor: '#FFF7ED' },
  circleInactive:{ borderColor: '#e5e2db', backgroundColor: '#F5F3EF' },
  label:         { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1 },
});

// ─── Month calendar ───────────────────────────────────────────────────────────
function MonthCalendar({ month, year }: { month: number; year: number }) {
  const HEADERS = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
  const today = new Date();
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

  return (
    <View style={cal.card}>
      {/* Day-of-week headers */}
      <View style={cal.headerRow}>
        {HEADERS.map(h => (
          <Text key={h} style={cal.headerTxt}>{h}</Text>
        ))}
      </View>

      {/* Day grid */}
      {CAL_ROWS.map((row, ri) => (
        <View key={ri} style={cal.row}>
          {row.map((d, ci) => {
            if (d === null) return <View key={ci} style={cal.cell} />;
            const isToday  = d === TODAY_NUM && isCurrentMonth;
            const isFuture = d > TODAY_NUM && isCurrentMonth;
            const dots     = DOTS[d] || [];

            return (
              <Pressable
                key={ci}
                style={({ pressed }) => [cal.cell, pressed && { opacity: 0.65 }]}
                onPress={() => {
                  if (isFuture) return;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <View style={[cal.dayCircle, isToday && cal.todayCircle]}>
                  <Text style={[
                    cal.dayNum,
                    isToday  && { color: GOLD, fontFamily: F.serifSemiBold },
                    isFuture && { color: C.textMuted, opacity: 0.4 },
                    !isToday && !isFuture && { color: C.text },
                  ]}>
                    {d}
                  </Text>
                </View>
                {/* Colored dots */}
                <View style={cal.dotRow}>
                  {dots.map((kind, j) => (
                    <View key={j} style={[cal.dot, { backgroundColor: DOT_COLORS[kind] }]} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}

      {/* Legend */}
      <View style={cal.legend}>
        {(['journal','morning','free'] as DotKind[]).map(kind => (
          <View key={kind} style={cal.legendItem}>
            <View style={[cal.legendDot, { backgroundColor: DOT_COLORS[kind] }]} />
            <Text style={cal.legendTxt}>
              {kind === 'journal' ? 'Daily Journal' : kind === 'morning' ? 'Morning Pages' : 'Free Writing'}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const cal = StyleSheet.create({
  card:       { marginHorizontal: 16, marginTop: 14, backgroundColor: CARD_BG, borderRadius: 24, borderWidth: 1, borderColor: '#EDE9E0', padding: 18, shadowColor: '#000', shadowOffset: {width:0,height:2}, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  headerRow:  { flexDirection: 'row', marginBottom: 6 },
  headerTxt:  { flex: 1, textAlign: 'center', fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 1, color: C.textMuted },
  row:        { flexDirection: 'row', marginBottom: 4 },
  cell:       { flex: 1, alignItems: 'center', paddingVertical: 4 },
  dayCircle:  { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  todayCircle:{ borderColor: GOLD },
  dayNum:     { fontFamily: F.serifMedium, fontSize: 15 },
  dotRow:     { flexDirection: 'row', gap: 2, marginTop: 2, height: 5 },
  dot:        { width: 5, height: 5, borderRadius: 2.5 },
  legend:     { flexDirection: 'row', justifyContent: 'space-around', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F0EDE6' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 7, height: 7, borderRadius: 3.5 },
  legendTxt:  { fontFamily: F.sans, fontSize: 11, color: C.textSecondary },
});

// ─── Set as Daily Task banner ─────────────────────────────────────────────────
function DailyTaskBanner() {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={dtb.wrap}
      onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
    >
      <LinearGradient
        colors={['#FFFBF2', '#FFF8E7']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={dtb.inner}
      >
        <View style={dtb.iconWrap}>
          <CalendarCheck s={20} c={C.goldDark} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={dtb.title}>Set as Daily Task</Text>
          <Text style={dtb.sub}>Add to your daily routine</Text>
        </View>
        <ChevronRight s={18} c={C.textMuted} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

const dtb = StyleSheet.create({
  wrap:    { marginHorizontal: 16, marginTop: 14 },
  inner:   { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(232,220,196,0.7)' },
  iconWrap:{ width: 40, height: 40, borderRadius: 11, backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
  title:   { fontFamily: F.sansBold, fontSize: 15, color: C.text },
  sub:     { fontFamily: F.sans, fontSize: 12, color: C.textSecondary, marginTop: 2 },
});

// ─── Mode cards ───────────────────────────────────────────────────────────────
type Mode = {
  Icon: React.ComponentType<any>;
  label: string;
  status: string;
  iconBg: string;
  iconFg: string;
  route: string;
  statusColor?: string;
};

const MODES: Mode[] = [
  { Icon: Pencil,   label: 'Daily\nJournal',   status: 'Done',  iconBg: '#F5ECD7', iconFg: GOLD,   route: '/journal-daily',   statusColor: C.textMuted },
  { Icon: Feather,  label: 'Morning\nPages',   status: 'Start', iconBg: '#ECE8F5', iconFg: PURPLE, route: '/journal-morning', statusColor: PURPLE },
  { Icon: FileEdit, label: 'Free\nWriting',    status: 'Start', iconBg: '#DFF1EC', iconFg: TEAL,   route: '/journal-free',    statusColor: TEAL },
];

function ModeCards({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <View style={mc.row}>
      {MODES.map((mode, i) => (
        <Pressable
          key={i}
          style={({ pressed }) => [mc.card, pressed && mc.cardPressed]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(mode.route as any);
          }}
        >
          <View style={[mc.iconBox, { backgroundColor: mode.iconBg }]}>
            <mode.Icon s={22} c={mode.iconFg} w={1.8} />
          </View>
          <Text style={mc.label}>{mode.label}</Text>
          <Text style={[mc.status, { color: mode.statusColor || C.textMuted }]}>{mode.status}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const mc = StyleSheet.create({
  row:         { flexDirection: 'row', marginHorizontal: 16, marginTop: 14, gap: 10 },
  card:        { flex: 1, backgroundColor: CARD_BG, borderRadius: 20, borderWidth: 1, borderColor: '#EDE9E0', paddingVertical: 16, paddingHorizontal: 8, alignItems: 'center', gap: 8, shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.04, shadowRadius:4, elevation:1 },
  cardPressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  iconBox:     { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  label:       { fontFamily: F.serifMedium, fontSize: 13, color: C.text, textAlign: 'center', lineHeight: 18 },
  status:      { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 0.5 },
});

// ─── Streak section ───────────────────────────────────────────────────────────
function StreakSection() {
  return (
    <View style={st.card}>
      {/* Headline */}
      <View style={st.headline}>
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Path d={FLAME_P} fill="#f97316" />
        </Svg>
        <Text style={st.number}>{STREAK}</Text>
        <Text style={st.label}>day streak</Text>
      </View>

      {/* 7-day row */}
      <View style={st.dayRow}>
        {LAST_7.map((d, i) => (
          <StreakCircle key={i} active={d.active} label={d.l} />
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card:     { marginHorizontal: 16, marginTop: 14, backgroundColor: CARD_BG, borderRadius: 24, borderWidth: 1, borderColor: '#EDE9E0', padding: 18, shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.04, shadowRadius:6, elevation:1 },
  headline: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  number:   { fontFamily: F.serifSemiBold, fontSize: 32, color: GOLD, lineHeight: 36 },
  label:    { fontFamily: F.serifMedium, fontSize: 17, color: C.textSecondary },
  dayRow:   { flexDirection: 'row', justifyContent: 'space-between' },
});

// ─── Tool card ────────────────────────────────────────────────────────────────
type ToolItem = {
  Icon: React.ComponentType<any>;
  label: string;
  status: string;
  iconBg: string;
  iconFg: string;
  wide?: boolean;
  route?: string;
};

const TOOLS: ToolItem[] = [
  { Icon: Star,         label: 'Ideal Self',      status: '5 daily goals', iconBg: '#FBF3DE', iconFg: GOLD,       route: '/journal-idealself'    },
  { Icon: ListChecks,   label: 'Habits',          status: '4 active',      iconBg: '#E4EFE4', iconFg: '#4E7F52'                                   },
  { Icon: BookMarked,   label: 'Reading List',    status: 'Add books',     iconBg: '#E8EAF4', iconFg: '#4E5394'                                   },
  { Icon: Target,       label: 'Bucket List',     status: '1 remaining',   iconBg: '#FBE6E9', iconFg: '#BE123C'                                   },
  { Icon: Target,       label: 'Monthly Goals',   status: '2 active',      iconBg: '#FBF3DE', iconFg: '#A9863F',  route: '/journal-goals'        },
  { Icon: CalendarHeart,label: 'Big Events',      status: '1 upcoming',    iconBg: '#FBE6E9', iconFg: '#B54155',  route: '/journal-events'       },
  { Icon: Grid3x3,      label: 'Year in Pixels',  status: '13 entries',    iconBg: '#EEEAF5', iconFg: '#6D5AAE',  route: '/journal-pixels', wide: true },
];

function ToolCard({ tool, router }: { tool: ToolItem; router: ReturnType<typeof useRouter> }) {
  return (
    <Pressable
      style={({ pressed }) => [
        tc.card,
        tool.wide && tc.cardWide,
        pressed && tc.cardPressed,
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (tool.route) router.push(tool.route as any);
      }}
    >
      {/* Faded background decor icon */}
      <View style={tc.decorWrap} pointerEvents="none">
        <tool.Icon s={52} c={tool.iconFg} w={1.3} />
      </View>

      {/* Main icon box */}
      <View style={[tc.iconBox, { backgroundColor: tool.iconBg }]}>
        <tool.Icon s={22} c={tool.iconFg} w={1.8} />
      </View>

      <Text style={tc.label}>{tool.label}</Text>
      <Text style={tc.status}>{tool.status}</Text>
    </Pressable>
  );
}

const tc = StyleSheet.create({
  card:        { flex: 1, backgroundColor: CARD_BG, borderRadius: 22, borderWidth: 1, borderColor: '#EDE9E0', padding: 16, paddingTop: 14, minHeight: 130, overflow: 'hidden', shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.04, shadowRadius:4, elevation:1 },
  cardWide:    { flex: 0, flexBasis: '100%' },
  cardPressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  decorWrap:   { position: 'absolute', right: 8, top: 8, opacity: 0.1 },
  iconBox:     { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  label:       { fontFamily: F.serifMedium, fontSize: 15, color: C.text, lineHeight: 19 },
  status:      { fontFamily: F.sans, fontSize: 12, color: C.textMuted, marginTop: 3 },
});

function ToolsSection({ router }: { router: ReturnType<typeof useRouter> }) {
  const pairs = TOOLS.filter(t => !t.wide);
  const wide  = TOOLS.filter(t =>  t.wide);

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
      <Text style={tols.heading}>TOOLS</Text>
      <View style={tols.grid}>
        {pairs.map((tool, i) => (
          <ToolCard key={i} tool={tool} router={router} />
        ))}
      </View>
      {wide.map((tool, i) => (
        <View key={i} style={{ marginTop: 10 }}>
          <ToolCard tool={tool} router={router} />
        </View>
      ))}
    </View>
  );
}

const tols = StyleSheet.create({
  heading: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: C.textMuted, marginBottom: 12 },
  grid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function JournalHub() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [month] = useState(3);   // April (0-indexed)
  const [year]  = useState(2026);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Header */}
      <View style={[hd.wrap, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          style={hd.backBtn}
          activeOpacity={0.7}
        >
          <ArrowLeft s={22} c={C.textMuted} />
        </TouchableOpacity>
        <Text style={hd.title}>JOURNAL</Text>
        <TouchableOpacity
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          style={hd.rightBtn}
          activeOpacity={0.7}
        >
          <SlidersHorizontal s={18} c={C.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Month nav */}
      <View style={mn.row}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
          <ChevronLeft s={20} c={GOLD} />
        </TouchableOpacity>
        <Text style={mn.title}>{MONTH_NAMES[month]} {year}</Text>
        <TouchableOpacity activeOpacity={0.7} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
          <ChevronRight s={20} c={GOLD} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        <MonthCalendar month={month} year={year} />
        <DailyTaskBanner />
        <ModeCards router={router} />
        <StreakSection />
        <ToolsSection router={router} />
      </ScrollView>
    </View>
  );
}

const hd = StyleSheet.create({
  wrap:    { backgroundColor: BG, paddingBottom: 4, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:   { fontFamily: F.serifMedium, fontSize: 20, letterSpacing: 4, color: C.text },
  rightBtn:{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});

const mn = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, paddingVertical: 10, backgroundColor: BG },
  title: { fontFamily: F.serifMedium, fontSize: 20, color: C.text, minWidth: 160, textAlign: 'center' },
});
