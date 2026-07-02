import { Easing, FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

// Focus-tab motion language: calm, no overshoot. Layout changes glide with an
// ease-out curve instead of bouncing springs.
export const SMOOTH_LAYOUT = LinearTransition.duration(230).easing(Easing.out(Easing.cubic));

export const SOFT_IN = FadeIn.duration(200);
export const SOFT_OUT = FadeOut.duration(130);
