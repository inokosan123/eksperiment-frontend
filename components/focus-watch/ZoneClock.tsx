import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { C, F } from '@/constants/tokens';
import { zoneTint } from './ZoneTimeline';
import { formatMinutesShort, zoneDurationMinutes, type PlanZone } from './dayPlanStore';

// The day as a clock: one full turn = 24 hours, midnight at the top. Each
// zone is a colored arc; the pale ring between arcs is open time. Reads far
// more naturally than a straight line — a day is a circle.
export default function ZoneClock({
  zones,
  size = 172,
  nowMinutes,
}: {
  zones: PlanZone[];
  size?: number;
  nowMinutes?: number;
}) {
  const stroke = 15;
  const r = (size - stroke) / 2 - 8;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;

  const guarded = zones.reduce((sum, zone) => sum + zoneDurationMinutes(zone), 0);

  const arcs = zones.flatMap((zone, index) => {
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

  const nowAngle = nowMinutes != null ? (nowMinutes / 1440) * 2 * Math.PI - Math.PI / 2 : null;

  return (
    <View style={[s.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cx} r={r} stroke="#F0EEE8" strokeWidth={stroke} fill="none" />
        {arcs.map(arc => (
          <Circle
            key={arc.key}
            cx={cx}
            cy={cx}
            r={r}
            stroke={arc.color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="butt"
            strokeDasharray={`${Math.max(arc.length, 1)} ${circumference}`}
            strokeDashoffset={-arc.offset}
            transform={`rotate(-90 ${cx} ${cx})`}
          />
        ))}
        {nowAngle != null && (
          <Circle
            cx={cx + Math.cos(nowAngle) * r}
            cy={cx + Math.sin(nowAngle) * r}
            r={4.5}
            fill="#57534E"
            stroke="#FFFFFF"
            strokeWidth={2}
          />
        )}
      </Svg>

      {/* hour marks */}
      <Text style={[s.tick, { top: -1, alignSelf: 'center' }]}>0h</Text>
      <Text style={[s.tick, { right: -2, top: size / 2 - 7 }]}>6h</Text>
      <Text style={[s.tick, { bottom: -1, alignSelf: 'center' }]}>12h</Text>
      <Text style={[s.tick, { left: -2, top: size / 2 - 7 }]}>18h</Text>

      <View style={s.center} pointerEvents="none">
        {guarded > 0 ? (
          <>
            <Text style={s.centerValue}>{formatMinutesShort(guarded)}</Text>
            <Text style={s.centerCaption}>GUARDED</Text>
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
  tick: {
    position: 'absolute',
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 0.4,
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
    fontSize: 27,
    color: C.text,
    fontVariant: ['tabular-nums'],
  },
  centerCaption: {
    marginTop: 2,
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 2,
    color: C.textMuted,
  },
  centerEmpty: {
    fontFamily: F.serifItalic,
    fontSize: 15,
    lineHeight: 20,
    color: C.textMuted,
    textAlign: 'center',
  },
});
