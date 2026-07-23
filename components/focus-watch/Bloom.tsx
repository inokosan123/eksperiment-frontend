import { useId } from 'react';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

// The soft radial light the Screen Time cards are lit by: gold behind the Goal
// trophy, slate behind the Tolerance shield, rose behind the Essentials lock.
// Fills its parent, so the caller decides where the light gathers.
export default function Bloom({ color, opacity = 0.5 }: { color: string; opacity?: number }) {
  const id = `bloom-${useId().replace(/:/g, '')}`;

  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
          <Stop offset="55%" stopColor={color} stopOpacity={opacity * 0.34} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx="50" cy="50" rx="50" ry="50" fill={`url(#${id})`} />
    </Svg>
  );
}
