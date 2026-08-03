import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import Reanimated, {
  useAnimatedStyle,
} from 'react-native-reanimated';
import {
  continuousPhase,
} from '@/components/shared/use-continuous-animation-clock';
import { useAmbientMotion } from '@/components/shared/ambient-motion';

const SPARKLE_PATH =
  'M12 0 C13.2 7.4 16.6 10.8 24 12 C16.6 13.2 13.2 16.6 12 24 C10.8 16.6 7.4 13.2 0 12 C7.4 10.8 10.8 7.4 12 0 Z';

/**
 * Home's lightweight version of the living "today" marker.
 *
 * The shared marker used elsewhere builds its bloom from several native
 * views and runs separate breath/orbit timelines. Here the same halo, two
 * rings and orbiting spark are drawn on one SVG surface and moved by one
 * UI-thread clock. That matters because this marker lives inside the most
 * render-heavy Home card and can remain visible throughout a long scroll.
 */
export default function HomeTodayPulse({
  size,
  color = '#C5A059',
  active = true,
}: {
  size: number;
  color?: string;
  active?: boolean;
}) {
  const runtime = useAmbientMotion(active);
  const running = runtime.enabled;
  const clock = runtime.clock;

  const livingStyle = useAnimatedStyle(() => {
    // Two quiet breaths during one orbit preserve the old cadence closely,
    // while the full 360° loop keeps both opacity and rotation continuous.
    const phase = running ? continuousPhase(clock.value, 4600) : 0;
    const breath = running ? 0.5 - 0.5 * Math.cos(phase * Math.PI * 4) : 0;
    return {
      opacity: 0.78 + breath * 0.22,
      transform: [{ rotate: `${phase * 360}deg` }],
    };
  });

  const field = size + 15;
  const center = field / 2;
  const outerRing = (size + 10) / 2;
  const innerRing = (size + 5) / 2;
  const sparkleSize = Math.max(6, size * 0.18);
  const sparkleScale = sparkleSize / 24;
  const sparkleX = center - sparkleSize / 2;
  const sparkleY = center - innerRing - sparkleSize / 2;

  return (
    <View pointerEvents="none" style={styles.center}>
      <Reanimated.View style={[{ width: field, height: field }, livingStyle]}>
        <Svg width={field} height={field} viewBox={`0 0 ${field} ${field}`}>
          <Defs>
            <RadialGradient id="homeTodayGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#F6E09E" stopOpacity={0.2} />
              <Stop offset="0.46" stopColor="#E4C276" stopOpacity={0.15} />
              <Stop offset="1" stopColor="#C5A059" stopOpacity={0.08} />
            </RadialGradient>
          </Defs>
          <Circle cx={center} cy={center} r={field / 2} fill="url(#homeTodayGlow)" />
          <Circle
            cx={center}
            cy={center}
            r={outerRing}
            fill="none"
            stroke={color}
            strokeOpacity={0.27}
            strokeWidth={1}
          />
          <Circle
            cx={center}
            cy={center}
            r={innerRing}
            fill="none"
            stroke={color}
            strokeOpacity={0.72}
            strokeWidth={1.75}
          />
          <Path
            d={SPARKLE_PATH}
            fill="#FFF3CF"
            transform={`translate(${sparkleX} ${sparkleY}) scale(${sparkleScale})`}
          />
        </Svg>
      </Reanimated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
