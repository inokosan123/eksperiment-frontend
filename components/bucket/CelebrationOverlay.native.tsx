import { StyleSheet, Text, View } from 'react-native';
import LottieView from 'lottie-react-native';
import { Sparkles } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';

const GOLD = '#C5A059';

export default function CelebrationOverlay() {
  return (
    <View style={s.wrap} pointerEvents="none">
      <View style={s.cardContainer}>
        <View style={s.card}>
          <View style={s.iconRing}>
            <Sparkles s={32} c={GOLD} w={1.6} />
          </View>
          <Text style={s.title}>Dream Achieved!</Text>
          <Text style={s.label}>CONGRATULATIONS</Text>
        </View>
      </View>
      <View style={s.lottieWrapper}>
        <LottieView
          source={require('@/assets/animations/task-complete.json')}
          autoPlay
          loop={false}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  cardContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottieWrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  card: {
    alignItems: 'center',
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.97)',
    paddingHorizontal: 40,
    paddingVertical: 30,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(197,160,89,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: F.serifMedium,
    fontSize: 22,
    color: C.text,
    marginTop: 12,
  },
  label: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 2.8,
    color: GOLD,
    marginTop: 6,
  },
});
