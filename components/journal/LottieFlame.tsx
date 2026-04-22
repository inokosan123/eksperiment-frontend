import { Image } from 'react-native';

export default function LottieFlame({ size = 36 }: { size?: number }) {
  return (
    <Image
      source={require('@/assets/images/streak-flame.png')}
      style={{ width: size, height: size, resizeMode: 'contain' }}
    />
  );
}
