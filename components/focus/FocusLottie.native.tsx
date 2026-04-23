import { StyleProp, ViewStyle } from 'react-native';
import LottieView from 'lottie-react-native';

type FocusAnimation = 'flame' | 'fire' | 'sandy';

const sources: Record<FocusAnimation, any> = {
  flame: require('@/assets/animations/flame.json'),
  fire: require('@/assets/animations/fire.json'),
  sandy: require('@/assets/animations/sandy-loading.json'),
};

export default function FocusLottie({
  name,
  style,
  loop = true,
  autoplay = true,
  speed = 1,
}: {
  name: FocusAnimation;
  style?: StyleProp<ViewStyle>;
  loop?: boolean;
  autoplay?: boolean;
  speed?: number;
}) {
  return (
    <LottieView
      source={sources[name]}
      autoPlay={autoplay}
      loop={loop}
      speed={speed}
      style={style}
    />
  );
}
