import { StyleProp, ViewStyle } from 'react-native';
import LottieView from 'lottie-react-native';

export type FocusAnimation = 'flame' | 'fire' | 'sandy' | 'sandy-work' | 'meru-book' | 'target' | 'confetti';
type ColorFilter = { keypath: string; color: string };

const sources: Record<FocusAnimation, any> = {
  flame: require('@/assets/animations/flame.json'),
  fire: require('@/assets/animations/fire.json'),
  sandy: require('@/assets/animations/sandy-loading.json'),
  'sandy-work': require('@/assets/animations/sandy-work.json'),
  'meru-book': require('@/assets/animations/meru-book.json'),
  target: require('@/assets/animations/target.json'),
  confetti: require('@/assets/animations/onboarding-confetti.json'),
};

export default function FocusLottie({
  name,
  style,
  loop = true,
  autoplay = true,
  speed = 1,
  colorFilters,
}: {
  name: FocusAnimation;
  style?: StyleProp<ViewStyle>;
  loop?: boolean;
  autoplay?: boolean;
  speed?: number;
  colorFilters?: ColorFilter[];
}) {
  return (
    <LottieView
      source={sources[name]}
      autoPlay={autoplay}
      loop={loop}
      speed={speed}
      style={style}
      colorFilters={colorFilters}
    />
  );
}
