import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { F } from '@/constants/tokens';
import { FocusMedallionMark } from '@/components/focus-watch/FocusMedallion';
import { formatMinutesShort } from './dayPlanStore';

// The Screen Time macro instrument: one bar that holds the whole day — the
// goal span, the tolerance span after it, and the essentials-only cap at the
// end. Each boundary is mapped above the bar: a tick with GOAL and a small
// medallion, a quiet tag over the tolerance zone, and a red "no entry" mark over
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

  // The essentials cap is a SEGMENT of the day, not a bullet at the end of it:
  // at the bar's own height it came out exactly round, and a lone pink dot
  // floating past the track read as a stray mark rather than as the last stretch
  // of the day. It keeps a segment's proportions at every bar height.
  const capWidth = Math.max(16, height * 1.7);
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
  // anchor carries the mark's centre axis, so it sits on the tick — except
  // where the card's edge, or the tolerance reading, will not allow it.
  //
  // The goal mark is a medallion with GOAL set to its right, and the tolerance
  // reading floats after that: three things on one line. Clamping each to the
  // card's edge INDEPENDENTLY is what let them collide — a plan whose goal
  // sits near the end of its span pushed both labels against the same right
  // margin and printed "GOAL+30m". So the goal anchor gives way first: it is
  // held far enough left that the tolerance label always has its own room,
  // which is the correct trade, since the tick still marks the true position
  // and the label is only naming it.
  const LABEL_GAP = 74;
  const goalCeiling = toleranceSpan > 0
    ? trackWidth - 34 - LABEL_GAP
    : trackWidth - 64;
  const goalAnchor = clamp(goalPx, 12, Math.max(12, goalCeiling));
  const toleranceAnchor = clamp(
    Math.max(toleranceCenterPx, goalAnchor + LABEL_GAP),
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
            {/* THE GOAL MARK — the one place on the bar where the day's prize
                is named, so it has to be a mark you can actually read.

                It is the medallion's DISC: rim, struck rings and numeral, with
                the ribbons left off — the same simplified cut the streak sheet
                wears in its hero and its counters, so the prize is drawn the
                same way wherever it is being counted rather than being claimed.
                (The whole medallion with its tails belongs to the two places
                that AWARD it: the card's hero and the plaque's seal.)

                It was the full medallion at 15pt, where the tails collapse into
                mud; then the plain coin, which reads as currency rather than as
                the medal itself. It is 19 now, seated in a faint pool so it
                stands off whatever it crosses. */}
            <View style={s.goalMark}>
              <View style={s.goalMarkPool} />
              <FocusMedallionMark size={19} />
            </View>
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
        onLayout={event => {
          const width = event.nativeEvent.layout.width;
          setTrackWidth(current => current === width ? current : width);
        }}
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
        >
          {/* The reading is struck, not printed: a light face over a deeper
              ground, with a sheen caught along the top the way every other
              filled surface in the app catches one. */}
          <LinearGradient
            colors={['rgba(255,255,255,0.34)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.10)']}
            locations={[0, 0.55, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: height / 2 }]}
          />
          <View style={[s.fillSheen, { top: Math.max(1, height * 0.16), height: Math.max(1.5, height * 0.16) }]} />
        </Animated.View>
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
  goalMark: { alignItems: 'center', justifyContent: 'center' },
  // The coin's own ground. Kept just wider than the coin and nearly clear —
  // a bigger, whiter disc reads as a white ring drawn round the mark rather
  // than as the mark standing off its background.
  goalMarkPool: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,252,242,0.5)',
  },
  goalLabelText: {
    position: 'absolute',
    left: 13,
    top: 3.5,
    fontFamily: F.sansBold,
    fontSize: 8.5,
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
  // A groove cut into the card takes its shade along the top inside edge —
  // the inverse of the white hairline a raised surface catches. Without it the
  // empty track reads as a white pill laid on the card rather than a channel
  // the reading runs in.
  zone: {
    borderCurve: 'continuous',
    borderTopWidth: 1,
    borderTopColor: 'rgba(120,96,46,0.10)',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'hidden',
  },
  fillSheen: {
    position: 'absolute',
    left: 5,
    right: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
});
