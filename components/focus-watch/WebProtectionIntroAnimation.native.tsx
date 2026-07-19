import { useIsFocused } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import FocusWatchLottie from './FocusWatchLottie';

export default function WebProtectionIntroAnimation() {
  const isFocused = useIsFocused();
  const reduceMotion = useReducedMotion();

  // Removing the animation on blur makes the one-shot Lottie mount and play
  // again on every fresh visit, while its final frame remains still on screen.
  if (!isFocused || reduceMotion) return null;

  return (
    <View pointerEvents="none" style={s.stage}>
      <FocusWatchLottie
        name="website"
        mode="once"
        speed={1}
        style={s.animation}
      />
    </View>
  );
}

const s = StyleSheet.create({
  stage: {
    height: 152,
    marginTop: -2,
    marginBottom: -8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  animation: {
    width: 180,
    height: 180,
  },
});
