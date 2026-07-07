import { useEffect, useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import LottieView from 'lottie-react-native';

export type FocusWatchAnimation = 'iphone' | 'check-shield' | 'website' | 'warning-shield';

const sources: Record<FocusWatchAnimation, any> = {
  iphone: require('@/assets/animations/focus-watch/iphone.json'),
  'check-shield': require('@/assets/animations/focus-watch/check-shield.json'),
  website: require('@/assets/animations/focus-watch/website.json'),
  'warning-shield': require('@/assets/animations/focus-watch/warning-shield.json'),
};

// mode 'loop' plays forever; 'periodic' plays once, rests, then plays again;
// 'once' plays a single time and freezes until the screen is entered again.
export default function FocusWatchLottie({
  name,
  style,
  mode = 'loop',
  restMs = 4500,
  speed = 1,
}: {
  name: FocusWatchAnimation;
  style?: StyleProp<ViewStyle>;
  mode?: 'loop' | 'periodic' | 'once';
  restMs?: number;
  speed?: number;
}) {
  const ref = useRef<LottieView>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <LottieView
      ref={ref}
      source={sources[name]}
      autoPlay
      loop={mode === 'loop'}
      speed={speed}
      style={style}
      onAnimationFinish={isCancelled => {
        if (mode !== 'periodic' || isCancelled) return;
        timer.current = setTimeout(() => ref.current?.play(), restMs);
      }}
    />
  );
}
