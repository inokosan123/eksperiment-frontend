import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Activity, ArrowUpRight } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';

const WEEK_DAYS = [
  { l: 'M', pct: 100 }, { l: 'T', pct: 100 }, { l: 'W', pct: 66 },
  { l: 'T', pct: 100 }, { l: 'F', pct: 80 },  { l: 'S', pct: 50 },
  { l: 'S', pct: 33, isToday: true },
];

const FLAME_PATH = "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z";

// Simple opacity-based flame — works identically on web + native + iOS
function FlameMini({ pct }: { pct: number }) {
  const isFull = pct >= 100;
  const hasAny = pct > 0;

  const bgColor    = isFull ? '#FDF3D8' : hasAny ? '#fff'                    : '#f8f7f1';
  const borderColor = isFull ? C.gold   : hasAny ? 'rgba(197,160,89,0.5)'   : '#e7e5e0';
  const fillColor  = isFull ? '#f97316' : C.gold;
  // Opacity represents fill level: 30% at pct=1 → 100% at pct=100
  const colorOpacity = isFull ? 1 : 0.28 + (pct / 100) * 0.72;

  return (
    <View style={[
      s.flame,
      { backgroundColor: bgColor, borderColor },
      isFull && s.flameGlow,
    ]}>
      {/* Grey base — always shows the flame shape */}
      <View style={s.svgWrap}>
        <Svg width={13} height={13} viewBox="0 0 24 24">
          <Path d={FLAME_PATH} fill="#e0ddd5" />
        </Svg>
      </View>
      {/* Colored overlay — opacity maps to completion % */}
      {hasAny && (
        <View style={[s.svgWrap, { opacity: colorOpacity }]}>
          <Svg width={13} height={13} viewBox="0 0 24 24">
            <Path d={FLAME_PATH} fill={fillColor} />
          </Svg>
        </View>
      )}
    </View>
  );
}

export default function WeeklyRhythm() {
  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Activity s={15} c={C.gold} />
        <Text style={s.heading}>Your Progress</Text>
      </View>

      <TouchableOpacity style={s.card} activeOpacity={0.85}>
        <Text style={s.cardLabel}>WEEKLY RHYTHM</Text>
        <View style={s.daysRow}>
          {WEEK_DAYS.map((d, i) => (
            <View key={i} style={s.dayCol}>
              <Text style={[s.dayLetter, { color: d.isToday ? C.gold : C.textMuted }]}>{d.l}</Text>
              <FlameMini pct={d.pct} />
            </View>
          ))}
        </View>
      </TouchableOpacity>

      <LinearGradient
        colors={[C.gold, C.goldSoft]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={s.analyticsBtn}
      >
        <Text style={s.analyticsBtnTxt}>VIEW ANALYTICS</Text>
        <ArrowUpRight s={12} c="#fff" w={2.6} />
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingTop: 18, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  heading: { fontFamily: F.serifMedium, fontSize: 18, color: C.text },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f0efeb',
    borderRadius: 22,
    padding: 16,
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.2, color: C.textMuted, marginBottom: 12 },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayCol: { alignItems: 'center', gap: 6 },
  dayLetter: { fontFamily: F.sansBold, fontSize: 9.5 },
  flame: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameGlow: {
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  // Two SVGs stacked absolutely inside the flame circle
  svgWrap: {
    position: 'absolute',
    width: 13,
    height: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyticsBtn: {
    marginTop: 10,
    padding: 11,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  analyticsBtnTxt: { fontFamily: F.sansBold, fontSize: 10.5, letterSpacing: 2, color: '#fff' },
});
