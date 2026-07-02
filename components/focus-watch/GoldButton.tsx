import { Text, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';

// The Focus tab's primary action: warm gold gradient pill with a soft glow.
export default function GoldButton({
  label,
  onPress,
  disabled,
  height = 52,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  height?: number;
  style?: ViewStyle;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      haptic="medium"
      disabled={disabled}
      onPress={onPress}
      style={[s.wrap, { height, opacity: disabled ? 0.4 : 1 }, style]}
    >
      <LinearGradient
        colors={['#D8B672', C.gold, '#B8933F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1.4 }}
        style={[s.gradient, { height }]}
      >
        <Text style={s.label}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap: {
    borderRadius: 999,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.38,
    shadowRadius: 11,
    elevation: 5,
  },
  gradient: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  label: {
    fontFamily: F.sansSemiBold,
    fontSize: 15,
    letterSpacing: 0.2,
    color: '#fff',
  },
});
