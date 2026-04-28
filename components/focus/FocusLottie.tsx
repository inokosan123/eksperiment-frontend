import { StyleProp, View, ViewStyle } from 'react-native';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

export type FocusAnimation = 'flame' | 'fire' | 'sandy' | 'sandy-work' | 'meru-book';

const sources: Record<FocusAnimation, any> = {
  flame: require('@/assets/animations/flame.json'),
  fire: require('@/assets/animations/fire.json'),
  sandy: require('@/assets/animations/sandy-loading.json'),
  'sandy-work': require('@/assets/animations/sandy-work.json'),
  'meru-book': require('@/assets/animations/meru-book.json'),
};

type ColorFilter = { keypath: string; color: string };

export default function FocusLottie({
  name,
  style,
  loop = true,
  autoplay = true,
  speed = 1,
  colorFilters: _colorFilters,
}: {
  name: FocusAnimation;
  style?: StyleProp<ViewStyle>;
  loop?: boolean;
  autoplay?: boolean;
  speed?: number;
  colorFilters?: ColorFilter[];
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
