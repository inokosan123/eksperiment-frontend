import { StyleProp, View, ViewStyle } from 'react-native';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

type FocusAnimation = 'flame' | 'fire' | 'sandy';

const sources: Record<FocusAnimation, Record<string, unknown>> = {
  // These JSON files are extracted from the original .lottie animations copied from Daily-Christian.
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
    <View style={style} pointerEvents="none">
      <DotLottieReact
        data={sources[name]}
        loop={loop}
        autoplay={autoplay}
        speed={speed}
        renderConfig={{ autoResize: true }}
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  );
}
