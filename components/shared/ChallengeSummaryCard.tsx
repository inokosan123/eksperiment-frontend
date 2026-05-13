import {
  Image,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown, ChevronRight } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import type { ChallengeRecord } from '@/components/challenges/challengeData';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';


const STREAK_FLAME_PNG = require('@/assets/images/streak-flame.png');

function challengeTone(category: ChallengeRecord['category']) {
  switch (category) {
    case 'prayer':
      return {
        badgeBg: '#FFF6E8',
        badgeText: '#B7791F',
      };
    case 'journal':
      return {
        badgeBg: '#F4EEFF',
        badgeText: '#7C3AED',
      };
    case 'church':
      return {
        badgeBg: '#EAF8F1',
        badgeText: '#17603F',
      };
    case 'scripture':
    default:
      return {
        badgeBg: '#EDF7FF',
        badgeText: '#2C9AEF',
      };
  }
}

function ChallengeStreakPill({ count, paused }: { count: number; paused: boolean }) {
  if (paused) {
    return (
      <View style={s.pausedPill}>
        <Text style={s.pausedText}>PAUSED</Text>
      </View>
    );
  }

  return (
    <View style={s.flamePill}>
      <Text style={s.flameText}>{count}</Text>
      <View style={s.flameIcon}>
        <Image source={STREAK_FLAME_PNG} style={s.flameImage} resizeMode="contain" />
      </View>
    </View>
  );
}

export default function ChallengeSummaryCard({
  challenge,
  onPress,
  style,
  chevron = 'right',
}: {
  challenge: ChallengeRecord;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  chevron?: 'right' | 'down';
}) {
  const paused = challenge.status === 'paused';
  const tone = challengeTone(challenge.category);
  const progress = challenge.progressTotal && challenge.progressTotal > 0
    ? Math.min(100, Math.round((challenge.progressCurrent / challenge.progressTotal) * 100))
    : 0;
  const meta = [challenge.time || '--:--', challenge.paceLabel || challenge.scheduleLabel]
    .filter(Boolean)
    .join('  \u00B7  ');
  const Chevron = chevron === 'down' ? ChevronDown : ChevronRight;

  return (
    <TouchableOpacity activeOpacity={0.86} onPress={onPress} style={[s.shell, paused && s.shellPaused, style]}>
      <View style={[s.card, paused && s.cardPaused]}>
        <View style={s.top}>
          <View style={[paused ? s.badgeMuted : s.badge, { backgroundColor: tone.badgeBg }]}>
            <Text style={[paused ? s.badgeMutedText : s.badgeText, { color: tone.badgeText }]}>
              {challenge.category.toUpperCase()}
            </Text>
          </View>
          <ChallengeStreakPill count={challenge.streak} paused={paused} />
        </View>

        <View style={s.titleRow}>
          <Text style={[s.title, paused && s.titlePaused]} numberOfLines={2}>{challenge.title}</Text>
          <Chevron s={14} c={paused ? '#BEB6A8' : '#C9B18A'} w={2.2} />
        </View>

        <Text style={[s.meta, paused && s.metaPaused]} numberOfLines={1}>
          {meta}
        </Text>

        <View style={[s.progressTrack, paused && s.progressTrackPaused]}>
          {paused ? (
            <View
              style={[
                s.progressFillPaused,
                { width: challenge.showBar && challenge.progressTotal ? `${progress}%` : '0%' },
              ]}
            />
          ) : (
            <LinearGradient
              colors={['#E0B770', C.gold, '#B6913D']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[
                s.progressFill,
                { width: challenge.showBar && challenge.progressTotal ? `${progress}%` : '0%' },
              ]}
            />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  shell: {
    borderRadius: 24,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderColor: 'rgba(197,160,89,0.34)',
    borderTopColor: 'rgba(197,160,89,0.40)',
    borderBottomColor: 'rgba(197,160,89,0.40)',
    borderLeftColor: C.gold,
    borderRightColor: C.gold,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#1C1917',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  shellPaused: {
    borderColor: '#E9E3D8',
    borderLeftColor: '#D8C49A',
    borderRightColor: '#D8C49A',
    backgroundColor: '#FBFAF7',
    shadowColor: '#A8A29E',
    shadowOpacity: 0.035,
  },
  card: {
    paddingHorizontal: 16,
    paddingTop: 9,
    paddingBottom: 11,
  },
  cardPaused: {
    backgroundColor: '#FBFAF7',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 1,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
  },
  badgeText: {
    fontFamily: F.sansBold,
    fontSize: 8.5,
    lineHeight: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  badgeMuted: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeMutedText: {
    fontFamily: F.sansBold,
    fontSize: 8,
    lineHeight: 10,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  flamePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFF5E7',
    borderWidth: 1,
    borderColor: '#FBE0BE',
    paddingLeft: 10,
    paddingRight: 4,
  },
  flameIcon: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: '#FFF1D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameImage: {
    width: 12,
    height: 12,
  },
  flameText: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    color: '#C46A19',
    minWidth: 10,
    textAlign: 'right',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  pausedPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pausedText: {
    fontFamily: F.sansBold,
    fontSize: 8,
    lineHeight: 10,
    letterSpacing: 1.4,
    color: '#A8A29E',
    textTransform: 'uppercase',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
    fontFamily: F.serifMedium,
    fontSize: 19,
    lineHeight: 24,
    color: '#1A1714',
  },
  titlePaused: {
    color: '#4B5563',
  },
  meta: {
    marginTop: 9,
    marginBottom: 1,
    fontFamily: F.sansBold,
    fontSize: 10.5,
    letterSpacing: 1.1,
    color: '#B49B67',
  },
  metaPaused: {
    color: '#A8A29E',
  },
  progressTrack: {
    marginTop: 0,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(197,160,89,0.13)',
    overflow: 'hidden',
  },
  progressTrackPaused: {
    backgroundColor: '#EEEAE2',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressFillPaused: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#D6D3D1',
  },
});
