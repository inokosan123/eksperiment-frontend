import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { C, F } from '@/constants/tokens';
import type { FocusPlaceholderConfig } from './focusContent';

export default function FocusPlaceholderView({ config }: { config: FocusPlaceholderConfig }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenTitleBar title={config.barTitle} showBack />

      <Animated.View entering={FadeInDown.duration(420).delay(40)} style={s.body}>
        <View style={[s.iconCircle, { backgroundColor: config.tintBg }]}>{config.icon}</View>
        <Text style={[s.label, { color: config.tint }]}>{config.label}</Text>
        <Text style={s.title}>{config.title}</Text>
        <Text style={s.description}>{config.description}</Text>
        <Text style={s.footer}>THIS ROOM IS BEING PREPARED</Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 34,
    paddingBottom: 90,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 22,
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
  },
  title: {
    marginTop: 6,
    fontFamily: F.serifMedium,
    fontSize: 30,
    letterSpacing: -0.3,
    color: C.text,
    textAlign: 'center',
  },
  description: {
    marginTop: 10,
    fontFamily: F.serif,
    fontSize: 16.5,
    lineHeight: 24,
    color: C.textSecondary,
    textAlign: 'center',
  },
  footer: {
    marginTop: 26,
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 2.2,
    color: C.gold,
  },
});
