import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { ChallengeTrophyAnimation } from '@/components/challenges/ChallengeTrophy';
import { C, F } from '@/constants/tokens';
import GoldButton from './GoldButton';

const MILESTONE_TITLES: Record<number, string> = {
  7: 'Seven days kept.',
  30: 'Thirty days kept.',
  100: 'A hundred days kept.',
};

// The loud moment we save for 7 / 30 / 100 — everyday trophies land silently
// in the calendar, but a milestone gets the full trophy and a word of blessing.
export default function MilestoneCongratsOverlay({
  milestone,
  onClose,
}: {
  milestone: number | null;
  onClose: () => void;
}) {
  return (
    <Modal visible={milestone !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <Animated.View entering={FadeInDown.duration(360)} style={s.card}>
          <View style={s.trophyWrap}>
            <ChallengeTrophyAnimation size={190} loop={false} />
          </View>

          <Animated.View entering={FadeIn.duration(420).delay(180)}>
            <Text style={s.label}>CONGRATULATIONS</Text>
            <Text style={s.title}>{milestone !== null ? MILESTONE_TITLES[milestone] ?? `${milestone} days kept.` : ''}</Text>
            <Text style={s.body}>
              {milestone !== null ? `A ${milestone}-day watch over your attention — kept with patience.` : ''}
            </Text>

            <Text style={s.verse}>{'"Well done, thou good and faithful servant."'}</Text>
            <Text style={s.verseRef}>MATTHEW 25:21</Text>
          </Animated.View>

          <GoldButton label="Continue" onPress={onClose} style={{ marginTop: 20, alignSelf: 'stretch' }} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(28,25,23,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: C.bg,
    borderRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 30,
    elevation: 12,
  },
  trophyWrap: {
    marginTop: 2,
    marginBottom: -8,
  },
  label: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.6,
    color: C.gold,
    textAlign: 'center',
  },
  title: {
    marginTop: 7,
    fontFamily: F.serifMedium,
    fontSize: 27,
    lineHeight: 32,
    letterSpacing: -0.3,
    color: C.text,
    textAlign: 'center',
  },
  body: {
    marginTop: 6,
    fontFamily: F.serif,
    fontSize: 15,
    lineHeight: 21,
    color: C.textSecondary,
    textAlign: 'center',
  },
  verse: {
    marginTop: 15,
    fontFamily: F.serifMediumItalic,
    fontSize: 16.5,
    lineHeight: 22,
    color: C.text,
    textAlign: 'center',
  },
  verseRef: {
    marginTop: 7,
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 2.2,
    color: C.gold,
    textAlign: 'center',
  },
});
