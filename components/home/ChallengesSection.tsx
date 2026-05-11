import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ChevronRight,
  Trophy,
} from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { useChallenges } from '@/components/challenges/ChallengesContext';
import ChallengeSummaryCard from '@/components/shared/ChallengeSummaryCard';

export default function ChallengesSection() {
  const router = useRouter();
  const { activeChallenges } = useChallenges();
  // Home shows only ACTIVE challenges, sorted by completion (closest to 100% first).
  const visibleChallenges = [...activeChallenges].sort((a, b) => {
    const pctA = a.progressTotal && a.progressTotal > 0
      ? (a.progressCurrent / a.progressTotal) * 100 : 0;
    const pctB = b.progressTotal && b.progressTotal > 0
      ? (b.progressCurrent / b.progressTotal) * 100 : 0;
    return pctB - pctA;
  });

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Text style={s.label}>CHALLENGES</Text>
        <TouchableOpacity
          style={s.headerLink}
          activeOpacity={0.8}
          onPress={() => router.push('/challenges')}
        >
          <Text style={s.activeLabel}>ACTIVE ({activeChallenges.length})</Text>
          <ChevronRight s={11} c={C.gold} w={2.2} />
        </TouchableOpacity>
      </View>

      {visibleChallenges.map(challenge => {
        return (
          <ChallengeSummaryCard
            key={challenge.id}
            challenge={challenge}
            style={s.challengeSummaryCard}
            onPress={() => router.push('/challenges')}
          />
        );
      })}

      <TouchableOpacity
        style={s.addBtn}
        activeOpacity={0.84}
        onPress={() => router.push('/challenges')}
      >
        <Trophy s={17} c={C.gold} w={1.9} />
        <Text style={s.addBtnTxt}>CHALLENGES</Text>
        <ChevronRight s={15} c={C.gold} w={2.2} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingTop: 20, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  headerLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: C.textMuted },
  activeLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: C.gold },
  challengeSummaryCard: { marginBottom: 4 },
  addBtn: {
    marginTop: 8,
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#EAD9B4',
    backgroundColor: '#FFFEFA',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#B6913D',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 2,
  },
  addBtnTxt: {
    fontFamily: F.sansBold,
    fontSize: 12.5,
    letterSpacing: 2.2,
    color: C.gold,
    textTransform: 'uppercase',
  },
});
