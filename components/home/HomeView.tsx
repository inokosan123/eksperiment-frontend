import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Settings, Calendar, ChevronLeft, ChevronRight, Clock, Book, Sun, Moon, Feather, Plus, ArrowUpRight, CheckSmall, Skip } from '@/components/icons/Icons';
import DateStrip from './DateStrip';
import WeeklyRhythm from './WeeklyRhythm';
import ChallengesSection from './ChallengesSection';
import ExploreSection from './ExploreSection';
import { C, F } from '@/constants/tokens';

// ── Header ──────────────────────────────────────────────────────
function HomeHeader() {
  return (
    <>
      <View style={h.row}>
        <TouchableOpacity style={h.iconBtn} activeOpacity={0.7}>
          <Settings s={18} c={C.text} />
        </TouchableOpacity>
        <View style={h.monthWrap}>
          <ChevronLeft s={18} c={C.textMuted} />
          <View style={{ alignItems: 'center' }}>
            <Text style={h.month}>April</Text>
            <Text style={h.year}>2026</Text>
          </View>
          <ChevronRight s={18} c={C.textMuted} />
        </View>
        <TouchableOpacity style={h.iconBtn} activeOpacity={0.7}>
          <Calendar s={18} c={C.text} />
        </TouchableOpacity>
      </View>

      <DateStrip />

      <View style={h.quoteWrap}>
        <Text style={h.quote}>
          {'"Awake thou that sleepest, and '}
          <Text style={{ textDecorationLine: 'underline' }}>arise</Text>{' '}
          <Text style={{ color: C.gold }}>(anasta)</Text>
          {' from the dead, and Christ shall give thee light."'}
        </Text>
        <Text style={h.ref}>EPHESIANS 5:14</Text>
      </View>
    </>
  );
}

const h = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f5f4f0', alignItems: 'center', justifyContent: 'center' },
  monthWrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  month: { fontFamily: F.serifMedium, fontSize: 28, color: C.red, lineHeight: 32 },
  year: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2, color: C.textMuted, marginTop: 3 },
  quoteWrap: { paddingHorizontal: 26, paddingTop: 18, paddingBottom: 4, alignItems: 'center' },
  quote: { fontFamily: F.serifMediumItalic, fontSize: 14, color: C.textSecondary, lineHeight: 21, textAlign: 'center' },
  ref: { marginTop: 8, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: C.gold },
});

// ── Task row (Home screen simplified version) ────────────────────
const TASK_TYPES = {
  morning: { tint: '#FBF7EE', iconBg: '#F5ECD7', iconColor: C.gold,  labelLight: C.gold,  Icon: Sun    },
  gospel:  { tint: '#FBE6E9', iconBg: '#F5CDD3', iconColor: C.red,   labelLight: C.red,   Icon: Book   },
  journal: { tint: '#F2F1EC', iconBg: '#E7E5E0', iconColor: '#57534e', labelLight: '#57534e', Icon: Feather },
  evening: { tint: '#FBF7EE', iconBg: '#F5ECD7', iconColor: C.gold,  labelLight: C.gold,  Icon: Moon   },
};

type TaskRowProps = {
  title: string; time: string; subtitle: string;
  type: keyof typeof TASK_TYPES;
  state: 'active' | 'done' | 'skipped' | 'pending';
};

function TaskRow({ title, time, subtitle, type, state }: TaskRowProps) {
  const t = TASK_TYPES[type];
  const done = state === 'done';
  const skipped = state === 'skipped';
  const isActive = state === 'active';

  let leftIcon: React.ReactElement;
  if (done) {
    leftIcon = (
      <View style={[tr.circle, { backgroundColor: t.iconBg }]}>
        <View style={tr.checkMark}>
          <Text style={{ color: t.iconColor, fontSize: 14, fontWeight: '700' }}>✓</Text>
        </View>
      </View>
    );
  } else if (skipped) {
    leftIcon = <View style={[tr.circle, { backgroundColor: '#a8a29e' }]}><Text style={{ color: '#fff', fontSize: 12 }}>→</Text></View>;
  } else if (isActive) {
    leftIcon = (
      <View style={[tr.circle, { borderWidth: 1.8, borderColor: t.iconColor, backgroundColor: 'transparent' }]}>
        <View style={[tr.dot, { borderColor: t.iconColor }]} />
      </View>
    );
  } else {
    leftIcon = <View style={[tr.circle, { borderWidth: 1.8, borderColor: '#d6d3d1', backgroundColor: 'transparent' }]} />;
  }

  const titleColor = done || skipped ? C.textMuted : C.text;
  const metaColor = done || skipped ? C.textMuted : t.labelLight;

  return (
    <View style={[tr.row, { backgroundColor: isActive ? t.tint : '#FCFAF6', borderColor: isActive ? t.iconBg : '#f2efe5' }]}>
      {leftIcon}
      <View style={{ flex: 1 }}>
        <Text style={[tr.title, { color: titleColor, textDecorationLine: skipped ? 'line-through' : 'none', opacity: done ? 0.75 : 1 }]}>
          {title}
        </Text>
        <View style={tr.metaRow}>
          <Clock s={10} c={metaColor} />
          <Text style={[tr.meta, { color: metaColor }]}>{time}</Text>
          <Text style={[tr.meta, { color: metaColor, opacity: 0.5 }]}>•</Text>
          <Text style={[tr.meta, { color: metaColor }]}>{subtitle}</Text>
        </View>
      </View>
      <View style={[tr.badge, { backgroundColor: t.iconBg }]}>
        <t.Icon s={15} c={t.iconColor} />
      </View>
    </View>
  );
}

const tr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, marginBottom: 8 },
  circle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.8 },
  checkMark: { alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: F.serifMedium, fontSize: 18, lineHeight: 22 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  meta: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' },
  badge: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});

// ── My Routine card ──────────────────────────────────────────────
function MyRoutineCard() {
  return (
    <LinearGradient
      colors={['#FBF0D9', '#F6E7C6']}
      start={{ x: 0.135, y: 0 }}
      end={{ x: 0.865, y: 1 }}
      style={mc.card}
    >
      <View style={mc.row}>
        <View style={{ flex: 1, paddingRight: 16 }}>
          <Text style={mc.label}>FOUNDATION</Text>
          <Text style={mc.title}>My Routine</Text>
          <Text style={mc.sub}>Establish your rhythm</Text>
        </View>
        <TouchableOpacity style={mc.btn} activeOpacity={0.8}>
          <ArrowUpRight s={16} c="#fff" w={2.6} />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const mc = StyleSheet.create({
  card: { marginTop: 10, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: '#EAD9A8' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.2, color: '#A57F3D' },
  title: { fontFamily: F.serifMedium, fontSize: 22, color: '#8B6B2F', marginTop: 5, lineHeight: 26 },
  sub: { fontFamily: F.sans, fontSize: 12, color: '#A57F3D', marginTop: 3 },
  btn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', flexShrink: 0, shadowColor: C.gold, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
});

// ── Progress bar ─────────────────────────────────────────────────
function ProgressBar({ pct }: { pct: number }) {
  return (
    <View style={{ width: 110, height: 3, borderRadius: 3, backgroundColor: '#ece9de', overflow: 'hidden' }}>
      <View style={{ width: `${pct}%` as any, height: '100%', backgroundColor: C.gold, borderRadius: 3 }} />
    </View>
  );
}

// ── Sample tasks ─────────────────────────────────────────────────
const SAMPLE_TASKS: TaskRowProps[] = [
  { title: 'Morning Prayer', time: '06:00', subtitle: '6:00 AM',         type: 'morning', state: 'done'    },
  { title: 'Daily Gospel',   time: '07:00', subtitle: 'MORNING READING', type: 'gospel',  state: 'skipped' },
  { title: 'Journaling',     time: '20:00', subtitle: 'EVENING',         type: 'journal', state: 'active'  },
  { title: 'Evening Prayer', time: '21:00', subtitle: '9:00 PM',         type: 'evening', state: 'pending' },
];

// ── Main ─────────────────────────────────────────────────────────
export default function HomeView() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 24 : insets.top) + 4, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <HomeHeader />

      <View style={{ paddingHorizontal: 20, paddingTop: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontFamily: F.serifMedium, fontSize: 22, color: C.text }}>{"Today's Tasks"}</Text>
            <Text style={{ fontFamily: F.sans, fontSize: 12, color: C.textMuted, marginTop: 4 }}>33% Completed</Text>
          </View>
          <View style={{ marginTop: 8 }}><ProgressBar pct={33} /></View>
        </View>

        <View style={{ marginTop: 14 }}>
          {SAMPLE_TASKS.map((t, i) => <TaskRow key={i} {...t} />)}
        </View>

        <TouchableOpacity style={add.btn} activeOpacity={0.8}>
          <Plus s={15} c={C.text} w={2.4} />
          <Text style={add.txt}>ADD QUICK TASK</Text>
        </TouchableOpacity>

        <MyRoutineCard />
      </View>

      <WeeklyRhythm />
      <ChallengesSection />
      <ExploreSection />
    </ScrollView>
  );
}

const add = StyleSheet.create({
  btn: { marginTop: 10, padding: 13, borderRadius: 16, borderWidth: 1.5, borderColor: C.text, backgroundColor: '#FCFAF6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  txt: { fontFamily: F.sansBold, fontSize: 10.5, letterSpacing: 2, color: C.text, textTransform: 'uppercase' },
});
