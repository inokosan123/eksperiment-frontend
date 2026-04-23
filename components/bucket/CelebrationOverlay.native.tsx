import { View, Text, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import { PartyPopper } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';

export default function CelebrationOverlay() {
  return (
    <View style={s.wrap} pointerEvents="none">
      <View style={s.card}>
        <PartyPopper s={40} c={C.gold} />
        <Text style={s.title}>Dream Achieved!</Text>
        <Text style={s.label}>CONGRATULATIONS</Text>
      </View>
      <LottieView
        source={require('@/assets/animations/task-complete.json')}
        autoPlay
        loop={false}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    zIndex: 2,
    alignItems: 'center',
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 32,
    paddingVertical: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  title: {
    fontFamily: F.serifMedium,
    fontSize: 21,
    color: C.text,
    marginTop: 8,
  },
  label: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: C.textMuted,
    marginTop: 4,
  },
});
