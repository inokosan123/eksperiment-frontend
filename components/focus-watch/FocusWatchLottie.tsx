import { StyleProp, ViewStyle } from 'react-native';

export type FocusWatchAnimation = 'iphone' | 'check-shield' | 'website' | 'warning-shield';

// Web fallback: the Lottie centerpieces are native-only; screens keep their
// The web preview uses a lightweight static phone fallback, so this renders nothing.
export default function FocusWatchLottie(_props: {
  name: FocusWatchAnimation;
  style?: StyleProp<ViewStyle>;
  mode?: 'loop' | 'periodic' | 'once';
  restMs?: number;
  speed?: number;
  playing?: boolean;
}) {
  return null;
}
