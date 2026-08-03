import { memo } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

export type FocusAnimation = 'flame' | 'fire' | 'sandy' | 'sandy-work' | 'meru-book' | 'target';

const sources: Record<FocusAnimation, any> = {
  flame: require('@/assets/animations/flame.json'),
  fire: require('@/assets/animations/fire.json'),
  sandy: require('@/assets/animations/sandy-loading.json'),
  'sandy-work': require('@/assets/animations/sandy-work.json'),
  'meru-book': require('@/assets/animations/meru-book.json'),
  target: require('@/assets/animations/target.json'),
};

type ColorFilter = { keypath: string; color: string };

function FocusLottie({
  name,
  style,
  loop = true,
  autoplay = true,
  playing = autoplay,
  speed = 1,
  colorFilters: _colorFilters,
}: {
  name: FocusAnimation;
  style?: StyleProp<ViewStyle>;
  loop?: boolean;
  autoplay?: boolean;
  playing?: boolean;
  speed?: number;
  colorFilters?: ColorFilter[];
}) {
  return (
    <View style={style} pointerEvents="none">
      <DotLottieReact
        data={sources[name]}
        loop={loop}
        autoplay={autoplay && playing}
        speed={playing ? speed : 0}
        renderConfig={{ autoResize: true }}
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  );
}

export default memo(FocusLottie);
