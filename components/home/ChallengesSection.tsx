import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Book, OpenBook, Plus, ChevronRight } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';

const FLAME_PATH = "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z";

function ChallengeCard({
  title, count, total, streak, Icon,
}: {
  title: string; count: number; total: number; streak: number;
  Icon: React.ComponentType<{ s: number; c: string }>;
}) {
  const pct = Math.round((count / total) * 100);
  return (
    <View style={s.card}>
      <View style={s.cardRow}>
        <View style={s.iconWrap}>
          <Icon s={16} c={C.gold} />
        </View>
        <View style={s.cardMid}>
          <Text style={s.cardTitle}>{title}</Text>
          <Text style={s.cardSub}>{count} of {total} chapters</Text>
        </View>
        {streak > 0 && (
          <View style={s.streak}>
            <Svg width={10} height={10} viewBox="0 0 24 24">
              <Path d={FLAME_PATH} fill="#f97316" />
            </Svg>
            <Text style={s.streakTxt}>{streak}</Text>
          </View>
        )}
      </View>
      <View style={s.bar}>
        <View style={[s.barFill, { width: `${pct}%` as any }]} />
      </View>
    </View>
  );
}

export default function ChallengesSection() {
  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Text style={s.label}>CHALLENGES</Text>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} activeOpacity={0.7}>
          <Text style={s.activeLabel}>ACTIVE (2)</Text>
          <ChevronRight s={11} c={C.gold} w={2.2} />
        </TouchableOpacity>
      </View>

      <ChallengeCard title="Read the Gospels" count={12} total={89} streak={7} Icon={Book} />
      <ChallengeCard title="40-Day Psalter" count={6} total={40} streak={6} Icon={OpenBook} />

      <TouchableOpacity style={s.addBtn} activeOpacity={0.8}>
        <Plus s={15} c={C.text} w={2.4} />
        <Text style={s.addBtnTxt}>CHALLENGES</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingTop: 20, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  label: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: C.textMuted },
  activeLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: C.gold },
  card: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderColor: C.gold,
    borderRadius: 22,
    backgroundColor: '#FFFDF6',
    padding: 14,
    marginBottom: 8,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: '#FDF3D8',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  cardMid: { flex: 1 },
  cardTitle: { fontFamily: F.serifMedium, fontSize: 16, color: C.text, lineHeight: 19 },
  cardSub: { fontFamily: F.sans, fontSize: 11, color: C.textSecondary, marginTop: 2 },
  streak: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 9999, backgroundColor: '#FDF3D8',
  },
  streakTxt: { fontFamily: F.sansBold, fontSize: 11, color: '#A9863F' },
  bar: { marginTop: 10, height: 3, borderRadius: 3, backgroundColor: '#f5f1e3', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: C.gold, borderRadius: 3 },
  addBtn: {
    marginTop: 6,
    padding: 12,
    borderWidth: 1.5,
    borderColor: C.text,
    backgroundColor: '#FCFAF6',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addBtnTxt: { fontFamily: F.sansBold, fontSize: 10.5, letterSpacing: 2, color: C.text },
});
