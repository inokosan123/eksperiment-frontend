import React, { useEffect, useRef } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import LottieView from 'lottie-react-native';

const MOOD_SOURCES = {
  'crying-face':    require('@/assets/noto/mood/crying-face.json'),
  'pensive-face':   require('@/assets/noto/mood/pensive-face.json'),
  'neutral-face':   require('@/assets/noto/mood/neutral-face.json'),
  'relieved-face':  require('@/assets/noto/mood/relieved-face.json'),
  'smiling-eyes':   require('@/assets/noto/mood/smiling-eyes.json'),
} as const;

const ENERGY_SOURCES = {
  'sleeping-face':  require('@/assets/noto/energy/sleeping-face.json'),
  'tired-face':     require('@/assets/noto/energy/tired-face.json'),
  'neutral-face':   require('@/assets/noto/energy/neutral-face.json'),
  'flexed-biceps':  require('@/assets/noto/energy/flexed-biceps.json'),
  'high-voltage':   require('@/assets/noto/energy/high-voltage.json'),
} as const;

export type MoodName = keyof typeof MOOD_SOURCES;
export type EnergyName = keyof typeof ENERGY_SOURCES;

export const MOOD_NAMES: MoodName[] = [
  'crying-face', 'pensive-face', 'neutral-face', 'relieved-face', 'smiling-eyes',
];
export const ENERGY_NAMES: EnergyName[] = [
  'sleeping-face', 'tired-face', 'neutral-face', 'flexed-biceps', 'high-voltage',
];

type Props =
  | { kind: 'mood'; name: MoodName; size?: number; selected?: boolean; style?: StyleProp<ViewStyle> }
  | { kind: 'energy'; name: EnergyName; size?: number; selected?: boolean; style?: StyleProp<ViewStyle> };

// Animated Noto emoji renderer. By default the emoji is static (paused at
// frame 0). When `selected` flips false → true, the animation plays through
// once. After it ends it stays at the final frame, so the chosen emoji
// reads as "settled" rather than mid-frame.
export function NotoLottie({ kind, name, size = 64, selected = false, style }: Props) {
  const lottieRef = useRef<LottieView>(null);
  const prevSelectedRef = useRef(selected);
  const source = kind === 'mood' ? MOOD_SOURCES[name as MoodName] : ENERGY_SOURCES[name as EnergyName];

  useEffect(() => {
    if (!lottieRef.current) return;
    if (selected && !prevSelectedRef.current) {
      lottieRef.current.reset();
      lottieRef.current.play();
    } else if (!selected && prevSelectedRef.current) {
      // Snap deselected emoji back to its static first frame so it doesn't
      // linger on the animation's end pose.
      lottieRef.current.reset();
    }
    prevSelectedRef.current = selected;
  }, [selected]);

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <LottieView
        ref={lottieRef}
        source={source}
        style={{ width: size, height: size }}
        resizeMode="contain"
        autoPlay={false}
        loop={false}
      />
    </View>
  );
}
