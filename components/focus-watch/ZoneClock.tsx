import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Candle, Clock, Moon, Sun } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { zoneTint } from './ZoneTimeline';
import { formatMinutesShort, zoneDurationMinutes, type PlanZone } from './dayPlanStore';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// The day as a clock: one full turn = 24 hours, midnight at the top.
// Zones draw themselves in as colored arcs when the clock appears; each arc
// carries its zone's emblem in a floating badge at the arc's middle. The
// space between arcs is open time.

const ZONE_FACE_ICONS: Record<string, (color: string) => React.ReactNode> = {
  Morning: color => <Sun s={12} c={color} w={2.2} />,
  Day: color => <Clock s={12} c={color} w={2.2} />,
  Evening: color => <Candle s={12} c={color} w={2.2} />,
  Night: color => <Moon s={12} c={color} w={2.2} />,
};

type Arc = {
  key: string;
  color: string;
  length: number;
  offset: number;
};

function DrawnArc({
  arc,
  cx,
  r,
  stroke,
  circumference,
  progress,
}: {
  arc: Arc;
  cx: number;
  r: number;
  stroke: number;
  circumference: number;
  progress: SharedValue<number>;
}) {
  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: `${Math.max(arc.length * progress.value, 0.5)} ${circumference}`,
  }));
  return (
    <AnimatedCircle
      cx={cx}
      cy={cx}
      r={r}
      stroke={arc.color}
      strokeWidth={stroke}
      fill="none"
      strokeLinecap="butt"
      strokeDashoffset={-arc.offset}
      animatedProps={animatedProps}
      transform={`rotate(-90 ${cx} ${cx})`}
    />
  );
}

export default function ZoneClock({
  zones,
  size = 196,
  nowMinutes,
}: {
  zones: PlanZone[];
  size?: number;
  nowMinutes?: number;
}) {
  const stroke = 17;
  const r = (size - stroke) / 2 - 13;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 950, easing: Easing.out(Easing.cubic) });
    // Redraw the arcs whenever the zone picture changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones.map(zone => `${zone.startMinutes}-${zone.endMinutes}`).join('|')]);

  const guarded = zones.reduce((sum, zone) => sum + zoneDurationMinutes(zone), 0);

  const arcs: Arc[] = zones.flatMap((zone, index) => {
    const segments =
      zone.endMinutes > zone.startMinutes
        ? [[zone.startMinutes, zone.endMinutes]]
        : [
            [zone.startMinutes, 1440],
            [0, zone.endMinutes],
          ];
    return segments.map(([start, end], segIndex) => ({
      key: `${zone.id}-${segIndex}`,
      color: zoneTint(index).bar,
      length: ((end - start) / 1440) * circumference,
      offset: (start / 1440) * circumference,
    }));
  });

  // One emblem badge per zone, floating at the middle of its span.
  const badges = zones.map((zone, index) => {
    const duration = zoneDurationMinutes(zone);
    const mid = (zone.startMinutes + duration / 2) % 1440;
    const angle = (mid / 1440) * 2 * Math.PI - Math.PI / 2;
    return {
      key: zone.id,
      x: cx + Math.cos(angle) * r,
      y: cx + Math.sin(angle) * r,
      tint: zoneTint(index),
      icon: ZONE_FACE_ICONS[zone.name] ?? ZONE_FACE_ICONS.Day,
    };
  });

  const nowAngle = nowMinutes != null ? (nowMinutes / 1440) * 2 * Math.PI - Math.PI / 2 : null;

  // 24 quiet hour ticks around the face; the quarters sit slightly stronger.
  const ticks = Array.from({ length: 24 }, (_, hour) => {
    const angle = (hour / 24) * 2 * Math.PI - Math.PI / 2;
    const isQuarter = hour % 6 === 0;
    const outer = r + stroke / 2 + (isQuarter ? 8 : 6);
    const inner = r + stroke / 2 + 3.5;
    return {
      key: hour,
      x1: cx + Math.cos(angle) * inner,
      y1: cx + Math.sin(angle) * inner,
      x2: cx + Math.cos(angle) * outer,
      y2: cx + Math.sin(angle) * outer,
      strong: isQuarter,
    };
  });

  return (
    <View style={[s.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {ticks.map(tick => (
          <Line
            key={tick.key}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke={tick.strong ? '#C9C2B2' : '#E7E3D8'}
            strokeWidth={tick.strong ? 2 : 1.2}
            strokeLinecap="round"
          />
        ))}

        {/* the face: a soft double track the arcs live on */}
        <Circle cx={cx} cy={cx} r={r} stroke="#F1EFE8" strokeWidth={stroke} fill="none" />
        <Circle cx={cx} cy={cx} r={r - stroke / 2 - 2.5} stroke="#F7F5EF" strokeWidth={1} fill="none" />

        {arcs.map(arc => (
          <DrawnArc
            key={arc.key}
            arc={arc}
            cx={cx}
            r={r}
            stroke={stroke}
            circumference={circumference}
            progress={progress}
          />
        ))}

        {nowAngle != null && (
          <Circle
            cx={cx + Math.cos(nowAngle) * r}
            cy={cx + Math.sin(nowAngle) * r}
            r={5}
            fill="#57534E"
            stroke="#FFFFFF"
            strokeWidth={2.2}
          />
        )}
      </Svg>

      {/* zone emblems floating on their arcs */}
      {badges.map(badge => (
        <View
          key={badge.key}
          pointerEvents="none"
          style={[
            s.badge,
            {
              left: badge.x - 13,
              top: badge.y - 13,
              borderColor: badge.tint.bar,
            },
          ]}
        >
          {badge.icon(badge.tint.text)}
        </View>
      ))}

      {/* quarter labels */}
      <Text style={[s.tickLabel, { top: 1, alignSelf: 'center' }]}>0h</Text>
      <Text style={[s.tickLabel, { right: 0, top: size / 2 - 8 }]}>6h</Text>
      <Text style={[s.tickLabel, { bottom: 1, alignSelf: 'center' }]}>12h</Text>
      <Text style={[s.tickLabel, { left: 0, top: size / 2 - 8 }]}>18h</Text>

      <View style={s.center} pointerEvents="none">
        {guarded > 0 ? (
          <>
            <Text style={s.centerValue}>{formatMinutesShort(guarded)}</Text>
            <Text style={s.centerCaption}>GUARDED</Text>
            <View style={s.centerRule} />
            <Text style={s.centerSub}>{`${formatMinutesShort(1440 - guarded)} open`}</Text>
          </>
        ) : (
          <Text style={s.centerEmpty}>Open{'\n'}all day</Text>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
  },
  badge: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  tickLabel: {
    position: 'absolute',
    fontFamily: F.sansBold,
    fontSize: 10.5,
    letterSpacing: 0.5,
    color: C.textMuted,
    fontVariant: ['tabular-nums'],
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerValue: {
    fontFamily: F.serifSemiBold,
    fontSize: 30,
    lineHeight: 34,
    color: C.text,
    fontVariant: ['tabular-nums'],
  },
  centerCaption: {
    marginTop: 1,
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.2,
    color: C.goldDark,
  },
  centerRule: {
    marginTop: 6,
    width: 26,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: '#E8E4D8',
  },
  centerSub: {
    marginTop: 5,
    fontFamily: F.sansMedium,
    fontSize: 11,
    color: C.textMuted,
    fontVariant: ['tabular-nums'],
  },
  centerEmpty: {
    fontFamily: F.serifItalic,
    fontSize: 15.5,
    lineHeight: 21,
    color: C.textMuted,
    textAlign: 'center',
  },
});
