import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { F } from '@/constants/tokens';
import { formatMinutesShort } from './dayPlanStore';

const TROPHY_EMBLEM = require('@/assets/animations/challenge-trophy-preview.png');

// The Screen Time macro instrument: one bar that holds the whole day — the
// goal span, the tolerance span after it, and the essentials-only cap at the
// end. Each boundary is mapped above the bar: a tick with GOAL and a small
// trophy, a quiet tag over the tolerance zone, and a red "no entry" mark over
// the essentials cap. A single fill glides to "where today stands", colored
// like a calorie tracker: green inside the goal, amber in tolerance, red once
// only essentials remain.

export const GAUGE_UNDER_COLOR = '#327153';
export const GAUGE_TOLERANCE_COLOR = '#B07E23';
export const GAUGE_ESSENTIALS_COLOR = '#A24351';

export type DayGaugeStanding = 'unknown' | 'under' | 'tolerance' | 'essentials';

export function gaugeStanding(
  goalMinutes: number,
  toleranceEndMinutes: number | null,
  usedMinutes: number | null
): DayGaugeStanding {
  if (usedMinutes == null) return 'unknown';
  if (usedMinutes <= goalMinutes) return 'under';
  if (toleranceEndMinutes != null && usedMinutes <= toleranceEndMinutes) return 'tolerance';
  return 'essentials';
}

// The traffic-light color of a standing; `fallback` is used while usage is unknown.
export function gaugeStateColor(standing: DayGaugeStanding, fallback: string) {
  if (standing === 'under') return GAUGE_UNDER_COLOR;
  if (standing === 'tolerance') return GAUGE_TOLERANCE_COLOR;
  if (standing === 'essentials') return GAUGE_ESSENTIALS_COLOR;
  return fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function DayGauge({
  goalMinutes,
  toleranceEndMinutes,
  usedMinutes,
  accent,
  labelColor,
  goalTrackColor = 'rgba(255,255,255,0.62)',
  height = 12,
  markers = 'full',
  style,
}: {
  goalMinutes: number;
  toleranceEndMinutes: number | null; // absolute end of tolerance (goal + tolerance)
  usedMinutes: number | null;         // null = usage not synced (structure only)
  accent: string;                      // plan accent — ticks and labels
  labelColor: string;                  // text color for marker labels
  goalTrackColor?: string;             // goal-zone track (white cards need a solid tint)
  height?: number;
  markers?: 'full' | 'none';
  style?: ViewStyle;
}) {
  const reduceMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const fillX = useSharedValue(0);

  const capWidth = Math.max(10, height);
  const gap = 2.5;
  const toleranceSpan = toleranceEndMinutes != null
    ? Math.max(0, toleranceEndMinutes - goalMinutes)
    : 0;
  const plannedTotal = Math.max(goalMinutes + toleranceSpan, 1);
  const standing = gaugeStanding(goalMinutes, toleranceEndMinutes, usedMinutes);
  const fillColor = gaugeStateColor(standing, accent);

  // Pixels available to the goal + tolerance spans (the cap is fixed).
  const flexWidth = Math.max(0, trackWidth - capWidth - gap - (toleranceSpan > 0 ? gap : 0));
  const fraction = usedMinutes == null
    ? 0
    : Math.min(1, Math.max(0, usedMinutes / plannedTotal));
  const targetPx = standing === 'essentials' ? trackWidth : fraction * flexWidth;

  const goalPx = (goalMinutes / plannedTotal) * flexWidth;
  const toleranceCenterPx = toleranceSpan > 0
    ? goalPx + gap + ((flexWidth - goalPx) / 2)
    : goalPx;

  // Anchor points for the floating labels, kept inside the card. The goal
  // anchor carries the trophy's center axis, so it sits exactly on the tick.
  const goalAnchor = clamp(goalPx, 12, Math.max(12, trackWidth - 64));
  const toleranceAnchor = clamp(
    Math.max(toleranceCenterPx, goalAnchor + 58),
    30,
    Math.max(30, trackWidth - 34)
  );

  useEffect(() => {
    if (trackWidth <= 0) return;
    if (reduceMotion) {
      fillX.value = targetPx;
      return;
    }
    fillX.value = withTiming(targetPx, { duration: 680, easing: Easing.out(Easing.cubic) });
  }, [targetPx, trackWidth, reduceMotion, fillX]);

  const fillStyle = useAnimatedStyle(() => ({ width: fillX.value }));

  return (
    <View style={style}>
      {markers === 'full' && trackWidth > 0 && (
        <View style={s.markerLayer}>
          <View style={[s.goalTick, { left: goalPx - 0.75, backgroundColor: accent }]} />
          <View style={[s.markerAnchor, { left: goalAnchor }]}>
            <Image source={TROPHY_EMBLEM} style={s.goalTrophy} resizeMode="contain" />
            <Text style={[s.goalLabelText, { color: labelColor }]}>GOAL</Text>
          </View>
          {toleranceSpan > 0 && (
            <View style={[s.markerAnchor, { left: toleranceAnchor }]}>
              <Text style={s.toleranceText}>+{formatMinutesShort(toleranceSpan)}</Text>
            </View>
          )}
          <View style={[s.markerAnchor, { left: trackWidth - capWidth / 2 }]}>
            <View style={s.essentialsMark}>
              <View style={s.essentialsSlash} />
            </View>
          </View>
        </View>
      )}
      <View
        style={[s.track, { height, gap }]}
        onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
      >
        {/* Translucent while the day is untouched; firm once real usage fills it. */}
        <View style={[s.zone, { flex: goalMinutes, borderRadius: height / 2, backgroundColor: usedMinutes != null ? '#FFFFFF' : goalTrackColor }]} />
        {toleranceSpan > 0 && (
          <View style={[s.zone, { flex: toleranceSpan, borderRadius: height / 2, backgroundColor: usedMinutes != null ? '#F1E8D7' : 'rgba(176,126,35,0.18)' }]} />
        )}
        <View style={[
          s.zone,
          {
            width: capWidth,
            borderRadius: height / 2,
            backgroundColor: standing === 'essentials'
              ? GAUGE_ESSENTIALS_COLOR
              : usedMinutes != null ? '#E3C7CB' : 'rgba(162,67,81,0.30)',
          },
        ]} />
        <Animated.View
          pointerEvents="none"
          style={[s.fill, { height, borderRadius: height / 2, backgroundColor: fillColor }, fillStyle]}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  markerLayer: {
    position: 'relative',
    height: 22,
    marginBottom: 6,
  },
  goalTick: {
    position: 'absolute',
    bottom: -5,
    width: 1.5,
    height: 9,
    borderRadius: 1,
    opacity: 0.9,
  },
  // A zero-width anchor: its centered child floats exactly over the point.
  markerAnchor: {
    position: 'absolute',
    top: 0,
    bottom: 4,
    width: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The trophy is the anchor's centered child — its axis lands on the tick;
  // GOAL floats to its right without pulling the group off-center.
  goalTrophy: {
    width: 15,
    height: 15,
  },
  goalLabelText: {
    position: 'absolute',
    left: 10.5,
    top: 4,
    fontFamily: F.sansBold,
    fontSize: 8,
    letterSpacing: 1.1,
  },
  toleranceText: {
    fontFamily: F.sansBold,
    fontSize: 8.5,
    letterSpacing: 0.4,
    color: GAUGE_TOLERANCE_COLOR,
    fontVariant: ['tabular-nums'],
  },
  essentialsMark: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.6,
    borderColor: GAUGE_ESSENTIALS_COLOR,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  essentialsSlash: {
    width: 9,
    height: 1.6,
    borderRadius: 1,
    backgroundColor: GAUGE_ESSENTIALS_COLOR,
    transform: [{ rotate: '-45deg' }],
  },
  track: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  zone: {
    borderCurve: 'continuous',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
