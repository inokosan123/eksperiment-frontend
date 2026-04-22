// Web fallback — PNG with pulse animation (Lottie is native-only)
import { useRef, useEffect } from 'react';
import { Animated, Image } from 'react-native';

export default function LottieFlame({ size = 36 }: { size?: number }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.18, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.92, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,    duration: 400, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Image
        source={require('@/assets/images/streak-flame.png')}
        style={{ width: size, height: size, resizeMode: 'contain' }}
      />
    </Animated.View>
  );
}
