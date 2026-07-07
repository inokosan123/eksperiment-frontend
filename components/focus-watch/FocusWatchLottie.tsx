import { StyleProp, ViewStyle } from 'react-native';

export type FocusWatchAnimation = 'iphone' | 'check-shield' | 'website' | 'warning-shield';

// Web fallback: the Lottie centerpieces are native-only; screens keep their
// SVG stand-ins on web (see GuardedPhone), so here we render nothing.
export default function FocusWatchLottie(_props: {
  name: FocusWatchAnimation;
  style?: StyleProp<ViewStyle>;
  mode?: 'loop' | 'periodic' | 'once';
  restMs?: number;
  speed?: number;
}) {
  return null;
}
