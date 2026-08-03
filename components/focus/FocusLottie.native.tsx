import { memo, useEffect, useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import LottieView from 'lottie-react-native';

export type FocusAnimation = 'flame' | 'fire' | 'sandy' | 'sandy-work' | 'meru-book' | 'target';
type ColorFilter = { keypath: string; color: string };

const sources: Record<FocusAnimation, any> = {
  flame: require('@/assets/animations/flame.json'),
  fire: require('@/assets/animations/fire.json'),
  sandy: require('@/assets/animations/sandy-loading.json'),
  'sandy-work': require('@/assets/animations/sandy-work.json'),
  'meru-book': require('@/assets/animations/meru-book.json'),
  target: require('@/assets/animations/target.json'),
};

function FocusLottie({
  name,
  style,
  loop = true,
  autoplay = true,
  playing = autoplay,
  speed = 1,
  colorFilters,
}: {
  name: FocusAnimation;
  style?: StyleProp<ViewStyle>;
  loop?: boolean;
  autoplay?: boolean;
  playing?: boolean;
  speed?: number;
  colorFilters?: ColorFilter[];
}) {
  const animationRef = useRef<LottieView>(null);
  const hasStartedRef = useRef(autoplay && playing);

  useEffect(() => {
    const animation = animationRef.current;
    if (!animation) return;
    if (!playing) {
      animation.pause();
      return;
    }
    if (hasStartedRef.current) {
      animation.resume();
      return;
    }
    hasStartedRef.current = true;
    animation.play();
  }, [playing]);

  return (
    <LottieView
      ref={animationRef}
      source={sources[name]}
      autoPlay={autoplay && playing}
      loop={loop}
      speed={speed}
      style={style}
      colorFilters={colorFilters}
    />
  );
}

export default memo(FocusLottie);
