import { Image, StyleSheet, Text, View } from 'react-native';
import { F } from '@/constants/tokens';

const STREAK_FLAME_PNG = require('@/assets/images/streak-flame.png');

// The app's standard streak pill — same recipe as ChallengeSummaryCard.
export default function StreakFlame({ count, big = false }: { count: number; big?: boolean }) {
  return (
    <View style={[s.pill, big && s.pillBig]}>
      <Text style={[s.text, big && s.textBig]}>{count}</Text>
      <View style={[s.icon, big && s.iconBig]}>
        <Image
          source={STREAK_FLAME_PNG}
          style={big ? s.imageBig : s.image}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFF5E7',
    borderWidth: 1,
    borderColor: '#FBE0BE',
    paddingLeft: 7,
    paddingRight: 5,
    gap: 1,
  },
  pillBig: {
    height: 32,
    borderRadius: 16,
    paddingLeft: 10,
    paddingRight: 8,
    gap: 2,
  },
  text: {
    fontFamily: F.sansBold,
    fontSize: 11,
    color: '#C46A19',
    minWidth: 8,
    textAlign: 'right',
    includeFontPadding: false,
    textAlignVertical: 'center',
    lineHeight: 13,
  },
  textBig: {
    fontSize: 14,
    lineHeight: 16,
    minWidth: 9,
  },
  icon: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: '#FFF1D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBig: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  image: {
    width: 12,
    height: 12,
  },
  imageBig: {
    width: 16,
    height: 16,
  },
});
