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
  playing = true,
}: {
  name: FocusWatchAnimation;
  style?: StyleProp<ViewStyle>;
  mode?: 'loop' | 'periodic' | 'once';
  restMs?: number;
  speed?: number;
  playing?: boolean;
}) {
  const ref = useRef<LottieView>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const started = useRef(playing);
  const resting = useRef(false);
  const playingRef = useRef(playing);

  useEffect(() => {
    playingRef.current = playing;

    if (!playing) {
      ref.current?.pause();
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      return;
    }

    if (!started.current || (mode === 'periodic' && resting.current)) {
      started.current = true;
      resting.current = false;
      ref.current?.play();
      return;
    }

    ref.current?.resume();
  }, [mode, playing]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <LottieView
      ref={ref}
      source={sources[name]}
      autoPlay={playing}
      loop={mode === 'loop'}
      speed={speed}
      style={style}
      renderMode="HARDWARE"
      cacheComposition
      onAnimationFinish={isCancelled => {
        if (mode !== 'periodic' || isCancelled) return;
        resting.current = true;
        if (!playingRef.current) return;
        timer.current = setTimeout(() => {
          timer.current = null;
          if (!playingRef.current) return;
          resting.current = false;
          ref.current?.play();
        }, restMs);
      }}
    />
  );
}
