import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Pressable,
  StyleSheet, Dimensions, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import LottieFlame from './LottieFlame';
import {
  ArrowLeft, SlidersHorizontal, CalendarCheck,
  ChevronLeft, ChevronRight,
  Pencil, Feather, FileEdit,
  Star, ListChecks, BookMarked, Target, CalendarHeart, Grid3x3,
} from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';

// ─── Constants ───────────────────────────────────────────────────────────────
const BG      = '#FAF7F0';
const GOLD    = '#C5A059';
const PURPLE  = '#7C6EAF';
const TEAL    = '#4A9E8F';
const W       = Dimensions.get('window').width;
// 2-column grid: screen - padding*2 - gap
const TOOL_W  = (W - 32 - 10) / 2;

const FLAME_PNG = require('@/assets/images/streak-flame.png');

type DotKind = 'journal' | 'morning' | 'free';
const DOT_COLORS: Record<DotKind, string> = {
  journal: GOLD, morning: PURPLE, free: TEAL,
};
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

// ─── Mock data ────────────────────────────────────────────────────────────────
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

// ─── Streak circle with PNG flame ─────────────────────────────────────────────
function StreakCircle({ active, label }: { active: boolean; label: string }) {
  return (
    <View style={sc.col}>
      <View style={[
        sc.circle,
        active ? sc.circleActive : sc.circleInactive,
      ]}>
        <Image
          source={FLAME_PNG}
          style={[sc.flameImg, { opacity: active ? 1 : 0.18 }]}
        />
      </View>
      <Text style={[sc.label, { color: active ? GOLD : C.textMuted }]}>{label}</Text>
    </View>
  );
}

const sc = StyleSheet.create({
  col:            { alignItems: 'center', gap: 7 },
  circle:         { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  circleActive:   { borderColor: '#f97316', backgroundColor: '#FFF7ED' },
  circleInactive: { borderColor: '#e5e2db', backgroundColor: '#F5F3EF' },
  flameImg:       { width: 26, height: 26, resizeMode: 'contain' },
  label:          { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1 },
});

// ─── Month calendar ───────────────────────────────────────────────────────────
function MonthCalendar({ month, year }: { month: number; year: number }) {
  const HEADERS = ['MON','TUE','WED','THU','FRI','SAT','SUN'];

  return (
    <View style={cal.card}>
      <View style={cal.headerRow}>
        {HEADERS.map(h => (
          <Text key={h} style={cal.headerTxt}>{h}</Text>
        ))}
      </View>

      {CAL_ROWS.map((row, ri) => (
        <View key={ri} style={cal.row}>
          {row.map((d, ci) => {
            if (d === null) return <View key={ci} style={cal.cell} />;
            const isToday  = d === TODAY_NUM;
            const isFuture = d > TODAY_NUM;
            const dots     = DOTS[d] || [];

            return (
              <Pressable
                key={ci}
                style={({ pressed }) => [cal.cell, pressed && { opacity: 0.6 }]}
                onPress={() => {
                  if (isFuture) return;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <View style={[cal.dayCircle, isToday && cal.todayCircle]}>
                  <Text style={[
                    cal.dayNum,
                    isToday  && cal.dayNumToday,
                    isFuture && cal.dayNumFuture,
                  ]}>
                    {d}
                  </Text>
                </View>
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
  card:          { marginHorizontal: 16, marginTop: 14, backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: '#EDE9E0', padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  headerRow:     { flexDirection: 'row', marginBottom: 6 },
  headerTxt:     { flex: 1, textAlign: 'center', fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 1, color: C.textMuted },
  row:           { flexDirection: 'row', marginBottom: 4 },
  cell:          { flex: 1, alignItems: 'center', paddingVertical: 4 },
  dayCircle:     { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  todayCircle:   { borderColor: GOLD },
  dayNum:        { fontFamily: F.serifMedium, fontSize: 15, color: C.text },
  dayNumToday:   { color: GOLD, fontFamily: F.serifSemiBold },
  dayNumFuture:  { color: C.textMuted, opacity: 0.35 },
  dotRow:        { flexDirection: 'row', gap: 2, marginTop: 2, height: 5 },
  dot:           { width: 5, height: 5, borderRadius: 2.5 },
  legend:        { flexDirection: 'row', justifyContent: 'space-around', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F0EDE6' },
  legendItem:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:     { width: 7, height: 7, borderRadius: 3.5 },
  legendTxt:     { fontFamily: F.sans, fontSize: 11, color: C.textSecondary },
});

// ─── Daily Task banner ────────────────────────────────────────────────────────
function DailyTaskBanner() {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={dtb.wrap}
      onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
    >
      <LinearGradient colors={['#FFFBF2','#FFF8E7']} start={{ x:0, y:0 }} end={{ x:1, y:0 }} style={dtb.inner}>
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
  wrap:     { marginHorizontal: 16, marginTop: 14 },
  inner:    { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(232,220,196,0.7)' },
  iconWrap: { width: 40, height: 40, borderRadius: 11, backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
  title:    { fontFamily: F.sansBold, fontSize: 15, color: C.text },
  sub:      { fontFamily: F.sans, fontSize: 12, color: C.textSecondary, marginTop: 2 },
});

// ─── Mode cards ───────────────────────────────────────────────────────────────
const MODES = [
  { Icon: Pencil,   label: 'Daily\nJournal',  status: 'Done',  iconBg: '#F5ECD7', iconFg: GOLD,   route: '/journal-daily'   },
  { Icon: Feather,  label: 'Morning\nPages',  status: 'Start', iconBg: '#ECE8F5', iconFg: PURPLE, route: '/journal-morning'  },
  { Icon: FileEdit, label: 'Free\nWriting',   status: 'Start', iconBg: '#DFF1EC', iconFg: TEAL,   route: '/journal-free'    },
];

function ModeCards({ onNav }: { onNav: (r: string) => void }) {
  return (
    <View style={mc.row}>
      {MODES.map((m, i) => (
        <Pressable
          key={i}
          style={({ pressed }) => [mc.card, pressed && mc.pressed]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onNav(m.route); }}
        >
          <View style={[mc.iconBox, { backgroundColor: m.iconBg }]}>
            <m.Icon s={22} c={m.iconFg} w={1.8} />
          </View>
          <Text style={mc.label}>{m.label}</Text>
          <Text style={[mc.status, { color: m.status === 'Done' ? C.textMuted : m.iconFg }]}>{m.status}</Text>
        </Pressable>
      ))}
    </View>
  );
}
const mc = StyleSheet.create({
  row:     { flexDirection: 'row', marginHorizontal: 16, marginTop: 14, gap: 10 },
  card:    { flex: 1, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#EDE9E0', paddingVertical: 18, paddingHorizontal: 8, alignItems: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  iconBox: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  label:   { fontFamily: F.serifMedium, fontSize: 13, color: C.text, textAlign: 'center', lineHeight: 18 },
  status:  { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 0.5 },
});

// ─── Streak section with Lottie flame ────────────────────────────────────────
function StreakSection() {
  return (
    <View style={st.card}>
      <View style={st.headline}>
        <LottieFlame size={36} />
        <Text style={st.number}>{STREAK}</Text>
        <Text style={st.label}>day streak</Text>
      </View>

      <View style={st.dayRow}>
        {LAST_7.map((d, i) => (
          <StreakCircle key={i} active={d.active} label={d.l} />
        ))}
      </View>
    </View>
  );
}
const st = StyleSheet.create({
  card:     { marginHorizontal: 16, marginTop: 14, backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: '#EDE9E0', padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  headline: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18 },
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
  { Icon: Star,          label: 'Ideal Self',    status: '5 daily goals', iconBg: '#FBF3DE', iconFg: GOLD       },
  { Icon: ListChecks,    label: 'Habits',         status: '4 active',     iconBg: '#E4EFE4', iconFg: '#4E7F52'  },
  { Icon: BookMarked,    label: 'Reading List',   status: 'Add books',    iconBg: '#E8EAF4', iconFg: '#4E5394'  },
  { Icon: Target,        label: 'Bucket List',    status: '1 remaining',  iconBg: '#FBE6E9', iconFg: '#BE123C'  },
  { Icon: Target,        label: 'Monthly Goals',  status: '2 active',     iconBg: '#FBF3DE', iconFg: '#A9863F'  },
  { Icon: CalendarHeart, label: 'Big Events',     status: '1 upcoming',   iconBg: '#FBE6E9', iconFg: '#B54155'  },
  { Icon: Grid3x3,       label: 'Year in Pixels', status: '13 entries',   iconBg: '#EEEAF5', iconFg: '#6D5AAE', wide: true },
];

function ToolCard({ tool, onPress }: { tool: ToolItem; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        tc.card,
        tool.wide ? { width: '100%' } : { width: TOOL_W },
        pressed && tc.pressed,
      ]}
    >
      {/* Faded background decor */}
      <View style={tc.decorWrap} pointerEvents="none">
        <tool.Icon s={56} c={tool.iconFg} w={1.2} />
      </View>
      {/* Icon box */}
      <View style={[tc.iconBox, { backgroundColor: tool.iconBg }]}>
        <tool.Icon s={22} c={tool.iconFg} w={1.9} />
      </View>
      <Text style={tc.label}>{tool.label}</Text>
      <Text style={tc.status}>{tool.status}</Text>
    </Pressable>
  );
}
const tc = StyleSheet.create({
  card:      { backgroundColor: '#fff', borderRadius: 22, borderWidth: 1, borderColor: '#EDE9E0', padding: 16, paddingTop: 14, minHeight: 130, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  pressed:   { opacity: 0.72, transform: [{ scale: 0.97 }] },
  decorWrap: { position: 'absolute', right: 8, top: 8, opacity: 0.1 },
  iconBox:   { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  label:     { fontFamily: F.serifMedium, fontSize: 15, color: C.text, lineHeight: 19 },
  status:    { fontFamily: F.sans, fontSize: 12, color: C.textMuted, marginTop: 3 },
});

function ToolsSection({ onNav }: { onNav: (r: string) => void }) {
  const regular = TOOLS.filter(t => !t.wide);
  const wide    = TOOLS.filter(t =>  t.wide);

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
      <Text style={tls.heading}>TOOLS</Text>

      {/* 2-column grid — explicit widths, no flex issues */}
      <View style={tls.grid}>
        {regular.map((tool, i) => (
          <ToolCard
            key={i}
            tool={tool}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); if (tool.route) onNav(tool.route); }}
          />
        ))}
      </View>

      {/* Year in Pixels — full width */}
      {wide.map((tool, i) => (
        <View key={i} style={{ marginTop: 10 }}>
          <ToolCard
            tool={tool}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); if (tool.route) onNav(tool.route); }}
          />
        </View>
      ))}
    </View>
  );
}
const tls = StyleSheet.create({
  heading: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: C.textMuted, marginBottom: 12 },
  grid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function JournalHub() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const nav = (route: string) => router.push(route as any);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Header */}
      <View style={[hd.wrap, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} style={hd.btn} activeOpacity={0.7}>
          <ArrowLeft s={22} c={C.textMuted} />
        </TouchableOpacity>
        <Text style={hd.title}>JOURNAL</Text>
        <TouchableOpacity onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)} style={hd.btn} activeOpacity={0.7}>
          <SlidersHorizontal s={18} c={C.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Month navigation */}
      <View style={mn.row}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
          <ChevronLeft s={20} c={GOLD} />
        </TouchableOpacity>
        <Text style={mn.title}>April 2026</Text>
        <TouchableOpacity activeOpacity={0.7} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
          <ChevronRight s={20} c={GOLD} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        <MonthCalendar month={3} year={2026} />
        <DailyTaskBanner />
        <ModeCards onNav={nav} />
        <StreakSection />
        <ToolsSection onNav={nav} />
      </ScrollView>
    </View>
  );
}

const hd = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 4, backgroundColor: BG },
  btn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: F.serifMedium, fontSize: 20, letterSpacing: 4, color: C.text },
});
const mn = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, paddingVertical: 10, backgroundColor: BG },
  title: { fontFamily: F.serifMedium, fontSize: 20, color: C.text, minWidth: 160, textAlign: 'center' },
});
