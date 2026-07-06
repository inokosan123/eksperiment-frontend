import { StyleSheet, Text, View } from 'react-native';
import { C, F } from '@/constants/tokens';
import type { PlanZone } from './dayPlanStore';

// Warm, muted tints — one per zone slot. Order is stable so a plan's first
// zone is always gold-toned across the hub, the editor and the cards.
export const ZONE_TINTS = [
  { bar: '#D9B96B', soft: '#FBF3DE', text: '#8A6A24' },
  { bar: '#93BFAE', soft: '#E1F1EC', text: '#2A6E5F' },
  { bar: '#A99BC9', soft: '#EEEAF5', text: '#5F4E8C' },
  { bar: '#D99AA5', soft: '#FBE6E9', text: '#A34C5C' },
] as const;

export function zoneTint(index: number) {
  return ZONE_TINTS[index % ZONE_TINTS.length];
}

function segments(zone: PlanZone): [number, number][] {
  if (zone.endMinutes > zone.startMinutes) return [[zone.startMinutes, zone.endMinutes]];
  return [
    [zone.startMinutes, 1440],
    [0, zone.endMinutes],
  ];
}

// The day as a single quiet bar: colored spans are guarded zones, the pale
// track between them is open time. 0h on the left, midnight on the right.
export default function ZoneTimeline({
  zones,
  height = 10,
  showTicks = false,
}: {
  zones: PlanZone[];
  height?: number;
  showTicks?: boolean;
}) {
  return (
    <View>
      <View style={[s.track, { height, borderRadius: height / 2 }]}>
        {zones.map((zone, index) =>
          segments(zone).map(([start, end], segIndex) => (
            <View
              key={`${zone.id}-${segIndex}`}
              style={{
                position: 'absolute',
                left: `${(start / 1440) * 100}%`,
                width: `${Math.max(((end - start) / 1440) * 100, 1)}%`,
                top: 0,
                bottom: 0,
                borderRadius: height / 2,
                backgroundColor: zoneTint(index).bar,
              }}
            />
          ))
        )}
      </View>
      {showTicks && (
        <View style={s.tickRow}>
          {['0h', '6h', '12h', '18h', '24h'].map(label => (
            <Text key={label} style={s.tickText}>
              {label}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  track: {
    backgroundColor: '#F0EEE8',
    overflow: 'hidden',
  },
  tickRow: {
    marginTop: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tickText: {
    fontFamily: F.sansMedium,
    fontSize: 9,
    letterSpacing: 0.4,
    color: C.textMuted,
    fontVariant: ['tabular-nums'],
  },
});
