import LottieView from 'lottie-react-native';

export default function LottieFlame({ size = 36 }: { size?: number }) {
  return (
    <LottieView
      source={require('@/assets/animations/flame.json')}
      autoPlay
      loop
      style={{ width: size, height: size }}
    />
  );
}
