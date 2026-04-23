import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  Book,
  BookMarked,
  ChevronRight,
  Cross,
  Flame,
  Sun,
  Trophy,
} from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { useChallenges } from '@/components/challenges/ChallengesContext';

function SectionChallengeIcon({
  kind,
  color,
}: {
  kind: 'book' | 'bookMarked' | 'cross' | 'sun';
  color: string;
}) {
  switch (kind) {
    case 'bookMarked':
      return <BookMarked s={16} c={color} />;
    case 'cross':
      return <Cross s={16} c={color} />;
    case 'sun':
      return <Sun s={16} c={color} />;
    case 'book':
    default:
      return <Book s={16} c={color} />;
  }
}

function ChallengeCard({
  title,
  headline,
  time,
  scheduleLabel,
  paceLabel,
  streak,
  progressPct,
  icon,
  onPress,
}: {
  title: string;
  headline: string;
  time?: string;
  scheduleLabel?: string;
  paceLabel?: string;
  streak: number;
  progressPct: number;
  icon: 'book' | 'bookMarked' | 'cross' | 'sun';
  onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress}>
      <LinearGradient
        colors={['#FFFDF6', '#FFFFFF']}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={s.card}
      >
        <View style={s.cardRow}>
          <View style={s.iconWrap}>
            <SectionChallengeIcon kind={icon} color={C.gold} />
          </View>

          <View style={s.cardMid}>
            <Text style={s.cardTitle}>{title}</Text>
            <Text style={s.cardSub}>{headline}</Text>
          </View>

          <View style={s.cardRight}>
            <View style={s.streak}>
              <Flame s={10} filled color="#F97316" />
              <Text style={s.streakTxt}>{streak}</Text>
            </View>
            <ChevronRight s={13} c={C.gold} w={2.2} />
          </View>
        </View>

        <View style={s.metaRow}>
          <Text style={s.metaText}>
            {time ? `${time} | ${scheduleLabel || 'DAILY'}` : (scheduleLabel || 'DAILY')}
          </Text>
          {paceLabel ? <Text style={s.metaText}>{paceLabel.toUpperCase()}</Text> : null}
        </View>

        <View style={s.bar}>
          <View style={[s.barFill, { width: `${progressPct}%` }]} />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function ChallengesSection() {
  const router = useRouter();
  const { activeChallenges, pausedChallenges } = useChallenges();
  const visibleChallenges = [...activeChallenges, ...pausedChallenges].slice(0, 2);

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Text style={s.label}>CHALLENGES</Text>
        <TouchableOpacity
          style={s.headerLink}
          activeOpacity={0.8}
          onPress={() => router.push('/challenges')}
        >
          <Text style={s.activeLabel}>ACTIVE ({activeChallenges.length + pausedChallenges.length})</Text>
          <ChevronRight s={11} c={C.gold} w={2.2} />
        </TouchableOpacity>
      </View>

      {visibleChallenges.map(challenge => {
        const pct = challenge.progressTotal && challenge.progressTotal > 0
          ? Math.max(6, Math.round((challenge.progressCurrent / challenge.progressTotal) * 100))
          : 14;
        const icon = challenge.groupKey === 'psalter'
          ? 'bookMarked'
          : challenge.groupKey === 'church'
            ? 'cross'
            : challenge.groupKey === 'prayer'
              ? 'sun'
              : 'book';

        return (
          <ChallengeCard
            key={challenge.id}
            title={challenge.title}
            headline={challenge.headline}
            time={challenge.time}
            scheduleLabel={challenge.scheduleLabel}
            paceLabel={challenge.paceLabel}
            streak={challenge.streak}
            progressPct={pct}
            icon={icon}
            onPress={() => router.push('/challenges')}
          />
        );
      })}

      <TouchableOpacity
        style={s.addBtn}
        activeOpacity={0.84}
        onPress={() => router.push('/challenges')}
      >
        <Trophy s={14} c={C.gold} w={1.9} />
        <Text style={s.addBtnTxt}>CHALLENGES</Text>
        <ChevronRight s={14} c={C.gold} w={2.2} />
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
  card: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderColor: C.gold,
    borderRadius: 22,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#B6913D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.11,
    shadowRadius: 16,
    elevation: 3,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#FDF3D8',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardMid: { flex: 1, minWidth: 0 },
  cardTitle: { fontFamily: F.serifMedium, fontSize: 16, color: C.text, lineHeight: 19 },
  cardSub: { fontFamily: F.sans, fontSize: 11, color: C.textSecondary, marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: 8 },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FDF3D8',
  },
  streakTxt: { fontFamily: F.sansBold, fontSize: 11, color: '#A9863F' },
  metaRow: {
    marginTop: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metaText: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: '#A9863F',
    textTransform: 'uppercase',
  },
  bar: { height: 3, borderRadius: 3, backgroundColor: '#F5F1E3', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: C.gold, borderRadius: 3 },
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
    fontSize: 10.5,
    letterSpacing: 2,
    color: C.gold,
    textTransform: 'uppercase',
  },
});
