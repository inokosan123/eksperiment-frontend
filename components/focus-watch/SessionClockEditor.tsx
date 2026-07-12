import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { C, F } from '@/constants/tokens';
import {
  formatTimeOfDay,
  moveSessionBoundary,
  zoneContains,
  zoneDurationMinutes,
  type PlanZone,
} from './dayPlanStore';

export const SESSION_COLORS = ['#C49A43', '#5E9279', '#7B75AA', '#B86570'];
const CLOCK_SIZE = 286;
const CENTER = CLOCK_SIZE / 2;
const RADIUS = 103;
const MIN_SESSION_MINUTES = 30;
const AnimatedPath = Animated.createAnimatedComponent(Path);

function minutePoint(minutes: number, radius = RADIUS) {
  'worklet';
  const angle = (minutes / 1440) * Math.PI * 2 - Math.PI / 2;
  return {
    x: CENTER + Math.cos(angle) * radius,
    y: CENTER + Math.sin(angle) * radius,
  };
}

function minuteFromPoint(x: number, y: number, size: number) {
  'worklet';
  const center = size / 2;
  const angle = Math.atan2(y - center, x - center) + Math.PI / 2;
  const normalized = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return Math.round((normalized / (Math.PI * 2)) * 1440) % 1440;
}

function arcPath(startMinutes: number, endMinutes: number) {
  'worklet';
  const start = minutePoint(startMinutes);
  const end = minutePoint(endMinutes);
  const duration = zoneDurationMinutes({ startMinutes, endMinutes });
  const large = duration > 720 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${end.x} ${end.y}`;
}

function circularDistance(a: number, b: number) {
  'worklet';
  const delta = Math.abs(a - b);
  return Math.min(delta, 1440 - delta);
}

function circularSpan(start: number, end: number) {
  'worklet';
  return (end - start + 1440) % 1440;
}

function AnimatedSessionArc({
  index,
  count,
  starts,
  color,
  selected,
}: {
  index: number;
  count: number;
  starts: SharedValue<number[]>;
  color: string;
  selected: boolean;
}) {
  const animatedProps = useAnimatedProps(() => ({
    d: arcPath(starts.value[index] ?? 0, starts.value[(index + 1) % count] ?? 0),
  }));
  return (
    <AnimatedPath
      animatedProps={animatedProps}
      fill="none"
      stroke={color}
      strokeWidth={selected ? 27 : 23}
      strokeLinecap="butt"
      opacity={selected ? 1 : 0.68}
    />
  );
}

function AnimatedBoundaryHandle({
  index,
  starts,
  layoutSize,
  color,
  selected,
}: {
  index: number;
  starts: SharedValue<number[]>;
  layoutSize: SharedValue<number>;
  color: string;
  selected: boolean;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const size = selected ? 22 : 18;
    const canvas = layoutSize.value || CLOCK_SIZE;
    const center = canvas / 2;
    const radius = canvas * (RADIUS / CLOCK_SIZE);
    const minute = starts.value[index] ?? 0;
    const angle = (minute / 1440) * Math.PI * 2 - Math.PI / 2;
    return {
      transform: [
        { translateX: center + Math.cos(angle) * radius - size / 2 },
        { translateY: center + Math.sin(angle) * radius - size / 2 },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.handle,
        { borderColor: color },
        selected && s.handleSelected,
        animatedStyle,
      ]}
    />
  );
}

export default function SessionClockEditor({
  sessions,
  selectedId,
  onSelect,
  onChange,
}: {
  sessions: PlanZone[];
  selectedId: string;
  onSelect: (sessionId: string) => void;
  onChange: (sessions: PlanZone[]) => void;
}) {
  const [layoutSize, setLayoutSize] = useState(CLOCK_SIZE);
  const layoutSizeShared = useSharedValue(CLOCK_SIZE);
  const starts = useSharedValue(sessions.map(session => session.startMinutes));
  const activeBoundary = useSharedValue(-1);
  const sessionsRef = useRef(sessions);
  const onChangeRef = useRef(onChange);
  const onSelectRef = useRef(onSelect);
  const boundaryKey = sessions.map(session => session.id).join('|');
  const boundaryIds = useMemo(() => boundaryKey.split('|').filter(Boolean), [boundaryKey]);

  useEffect(() => {
    sessionsRef.current = sessions;
    starts.value = sessions.map(session => session.startMinutes);
  }, [sessions, starts]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  const commitBoundary = useCallback((sessionId: string, minute: number) => {
    const next = moveSessionBoundary(sessionsRef.current, sessionId, minute);
    if (next === sessionsRef.current) {
      starts.value = sessionsRef.current.map(session => session.startMinutes);
      return;
    }
    sessionsRef.current = next;
    onChangeRef.current(next);
  }, [starts]);

  const selectAtMinute = useCallback((minute: number) => {
    const hit = sessionsRef.current.find(session => zoneContains(session, minute));
    if (hit) onSelectRef.current(hit.id);
  }, []);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(4)
      .onBegin(event => {
        const minute = minuteFromPoint(event.x, event.y, layoutSize);
        let closest = 0;
        let distance = 1441;
        for (let index = 0; index < starts.value.length; index += 1) {
          const candidate = circularDistance(starts.value[index], minute);
          if (candidate < distance) {
            closest = index;
            distance = candidate;
          }
        }
        activeBoundary.value = closest;
      })
      .onUpdate(event => {
        const index = activeBoundary.value;
        if (index < 0 || index >= boundaryIds.length) return;
        const minute = Math.round(minuteFromPoint(event.x, event.y, layoutSize) / 5) * 5 % 1440;
        const count = starts.value.length;
        const previous = starts.value[(index - 1 + count) % count] ?? 0;
        const following = starts.value[(index + 1) % count] ?? 0;
        if (
          circularSpan(previous, minute) < MIN_SESSION_MINUTES
          || circularSpan(minute, following) < MIN_SESSION_MINUTES
        ) return;
        starts.value = starts.value.map((value, itemIndex) => itemIndex === index ? minute : value);
      })
      .onFinalize(() => {
        const index = activeBoundary.value;
        if (index >= 0 && index < boundaryIds.length) {
          runOnJS(commitBoundary)(boundaryIds[index], starts.value[index] ?? 0);
        }
        activeBoundary.value = -1;
      });

    const tap = Gesture.Tap().maxDuration(260).onEnd(event => {
      runOnJS(selectAtMinute)(minuteFromPoint(event.x, event.y, layoutSize));
    });
    return Gesture.Race(pan, tap);
    // Start values live in a SharedValue; rebuilding only when the structural
    // set of Session ids changes keeps a drag stable while React rerenders.
  }, [activeBoundary, boundaryIds, commitBoundary, layoutSize, selectAtMinute, starts]);

  const selected = sessions.find(session => session.id === selectedId) ?? sessions[0];
  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    layoutSizeShared.value = next;
    setLayoutSize(next);
  };

  return (
    <View style={s.wrap}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={s.clock} onLayout={onLayout}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${CLOCK_SIZE} ${CLOCK_SIZE}`}>
            <Circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="#EEEAE1" strokeWidth={25} />
            {sessions.map((session, index) => {
              const color = SESSION_COLORS[index % SESSION_COLORS.length];
              const fullDay = sessions.length === 1;
              const selectedSegment = session.id === selected?.id;
              return fullDay ? (
                <Circle
                  key={session.id}
                  cx={CENTER}
                  cy={CENTER}
                  r={RADIUS}
                  fill="none"
                  stroke={color}
                  strokeWidth={selectedSegment ? 27 : 23}
                  opacity={selectedSegment ? 1 : 0.68}
                />
              ) : (
                <AnimatedSessionArc
                  key={session.id}
                  index={index}
                  count={sessions.length}
                  starts={starts}
                  color={color}
                  selected={selectedSegment}
                />
              );
            })}
            <Circle cx={CENTER} cy={CENTER} r={76} fill="#FFFDF8" stroke="#ECE6D9" strokeWidth={1} />
          </Svg>

          {sessions.length > 1 && sessions.map((session, index) => (
            <AnimatedBoundaryHandle
              key={session.id}
              index={index}
              starts={starts}
              layoutSize={layoutSizeShared}
              color={SESSION_COLORS[index % SESSION_COLORS.length]}
              selected={session.id === selected?.id}
            />
          ))}

          <Text style={[s.clockLabel, s.label00]}>00</Text>
          <Text style={[s.clockLabel, s.label06]}>06</Text>
          <Text style={[s.clockLabel, s.label12]}>12</Text>
          <Text style={[s.clockLabel, s.label18]}>18</Text>

          {selected && (
            <View style={s.centerCopy} pointerEvents="none">
              <Text style={s.centerKicker}>SELECTED SESSION</Text>
              <Text style={s.centerTitle} numberOfLines={1}>{selected.name}</Text>
              <Text style={s.centerTime}>
                {sessions.length === 1
                  ? 'All day'
                  : `${formatTimeOfDay(selected.startMinutes)} - ${formatTimeOfDay(selected.endMinutes)}`}
              </Text>
            </View>
          )}
        </Animated.View>
      </GestureDetector>
      <View style={s.legend}>
        {sessions.map((session, index) => (
          <View key={session.id} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: SESSION_COLORS[index % SESSION_COLORS.length] }]} />
            <Text style={[s.legendText, session.id === selected?.id && s.legendTextSelected]} numberOfLines={1}>
              {session.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center' },
  clock: { width: '100%', maxWidth: CLOCK_SIZE, aspectRatio: 1, alignSelf: 'center' },
  handle: { position: 'absolute', left: 0, top: 0, width: 18, height: 18, borderRadius: 9, borderWidth: 4, backgroundColor: '#fff', shadowColor: '#1C1917', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 4, elevation: 3 },
  handleSelected: { width: 22, height: 22, borderRadius: 11 },
  clockLabel: { position: 'absolute', fontFamily: F.sansBold, fontSize: 8, color: C.textMuted, fontVariant: ['tabular-nums'] },
  label00: { top: 3, left: '50%', transform: [{ translateX: -7 }] },
  label06: { right: 3, top: '50%', transform: [{ translateY: -5 }] },
  label12: { bottom: 3, left: '50%', transform: [{ translateX: -7 }] },
  label18: { left: 3, top: '50%', transform: [{ translateY: -5 }] },
  centerCopy: { position: 'absolute', left: '25%', right: '25%', top: '35%', bottom: '35%', alignItems: 'center', justifyContent: 'center' },
  centerKicker: { fontFamily: F.sansBold, fontSize: 6.5, letterSpacing: 1.1, color: C.textMuted },
  centerTitle: { marginTop: 3, maxWidth: 120, fontFamily: F.serifMedium, fontSize: 18, color: C.text, textAlign: 'center' },
  centerTime: { marginTop: 2, fontFamily: F.sansSemiBold, fontSize: 8.5, color: C.goldDark, fontVariant: ['tabular-nums'] },
  legend: { marginTop: 9, width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  legendItem: { maxWidth: '46%', flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontFamily: F.sansMedium, fontSize: 9, color: C.textMuted },
  legendTextSelected: { fontFamily: F.sansSemiBold, color: C.text },
});
