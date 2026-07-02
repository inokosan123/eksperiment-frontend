import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Flame, Globe } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import {
  endActiveSession,
  extendActiveSession,
  startQuickWatch,
  useFocusWatch,
} from './focusWatchStore';

const QUICK_OPTIONS = [
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 hour' },
  { minutes: 120, label: '2 hours' },
];

const PANEL_TRANSITION = LinearTransition.springify().damping(19).stiffness(190);

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function formatEndsAt(endsAt: number) {
  return new Date(endsAt)
    .toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    .toUpperCase();
}

// Slow "chapel lamp" breath shared by the quiet flame and the active dot.
function useBreath() {
  const breath = useSharedValue(0);

  useEffect(() => {
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.quad) })
      ),
      -1
    );
    return () => cancelAnimation(breath);
  }, [breath]);

  return breath;
}

function QuietLamp() {
  const breath = useBreath();

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.05 + breath.value * 0.07,
    transform: [{ scale: 0.94 + breath.value * 0.16 }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.1 + breath.value * 0.12,
    transform: [{ scale: 0.92 + breath.value * 0.14 }],
  }));
  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.06 }],
  }));

  return (
    <View style={s.lampWrap}>
      <Animated.View style={[s.lampHalo, haloStyle]} />
      <Animated.View style={[s.lampGlow, glowStyle]} />
      <View style={s.lampCircle}>
        <Animated.View style={flameStyle}>
          <Flame s={26} filled color={C.gold} />
        </Animated.View>
      </View>
    </View>
  );
}

function ActiveDot() {
  const breath = useBreath();
  const dotStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + breath.value * 0.55,
  }));
  return <Animated.View style={[s.activeDot, dotStyle]} />;
}

function QuietState() {
  return (
    <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(140)}>
      <QuietLamp />
      <Text style={s.quietTitle}>All is quiet.</Text>
      <Text style={s.quietSub}>No watch is active.</Text>

      <TouchableOpacity
        style={s.primaryBtn}
        activeOpacity={0.85}
        haptic="medium"
        onPress={() => startQuickWatch(60)}
      >
        <Text style={s.primaryBtnText}>Begin a watch</Text>
      </TouchableOpacity>

      <View style={s.chipRow}>
        {QUICK_OPTIONS.map(option => (
          <TouchableOpacity
            key={option.minutes}
            style={s.chip}
            activeOpacity={0.75}
            onPress={() => startQuickWatch(option.minutes)}
          >
            <Text style={s.chipText}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
}

function ActiveState() {
  const { activeSession, alwaysOn } = useFocusWatch();
  const [now, setNow] = useState(() => Date.now());
  const [trackWidth, setTrackWidth] = useState(0);
  const progress = useSharedValue(0);

  const endsAt = activeSession?.endsAt ?? 0;
  const totalMs = activeSession?.totalMs ?? 1;
  const remaining = Math.max(0, endsAt - now);

  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  // The mock session completes on its own when time runs out.
  useEffect(() => {
    if (activeSession && remaining <= 0) endActiveSession();
  }, [activeSession, remaining]);

  useEffect(() => {
    const elapsedFraction = Math.min(1, Math.max(0, 1 - remaining / totalMs));
    progress.value = withTiming(elapsedFraction, {
      duration: 980,
      easing: Easing.linear,
    });
  }, [remaining, totalMs, progress]);

  const fillStyle = useAnimatedStyle(
    () => ({ width: trackWidth * progress.value }),
    [trackWidth]
  );

  const endsLabel = useMemo(() => formatEndsAt(endsAt), [endsAt]);

  if (!activeSession) return null;

  return (
    <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(140)}>
      <Text style={s.sessionName}>{activeSession.name}</Text>
      <Text style={s.sessionSub}>Your distractions are held back.</Text>

      <View style={s.timerBlock}>
        <Text style={s.timerText}>{formatRemaining(remaining)}</Text>
        <Text style={s.timerCaption}>REMAINING · ENDS {endsLabel}</Text>
      </View>

      <View
        style={s.progressTrack}
        onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
      >
        <Animated.View style={[s.progressFill, fillStyle]} />
      </View>

      <View style={s.controlsRow}>
        <TouchableOpacity
          style={s.chip}
          activeOpacity={0.75}
          onPress={() => extendActiveSession(15)}
        >
          <Text style={s.chipText}>+15 min</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => endActiveSession()}
        >
          <Text style={s.endEarlyText}>End early</Text>
        </TouchableOpacity>
      </View>

      {alwaysOn.length > 0 && (
        <View style={s.alsoActiveBlock}>
          <Text style={s.alsoActiveLabel}>ALSO ACTIVE</Text>
          {alwaysOn.map(layer => (
            <View key={layer.id} style={s.alsoActiveRow}>
              <Globe s={13} c={C.textMuted} w={2} />
              <Text style={s.alsoActiveText}>{layer.name}</Text>
              <Text style={s.alsoActiveAlways}>always</Text>
            </View>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

export default function NowPanel() {
  const { activeSession } = useFocusWatch();
  const isActive = !!activeSession;

  return (
    <Animated.View style={s.card} layout={PANEL_TRANSITION}>
      <View style={s.headerRow}>
        <Text style={s.headerLabel}>NOW</Text>
        {isActive && (
          <View style={s.headerActive}>
            <ActiveDot />
            <Text style={s.headerActiveText}>ACTIVE</Text>
          </View>
        )}
      </View>

      {isActive ? <ActiveState key="active" /> : <QuietState key="quiet" />}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 18,
    paddingTop: 15,
    paddingBottom: 18,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 4,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLabel: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: C.textMuted,
  },
  headerActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.gold,
  },
  headerActiveText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: C.gold,
  },

  // Quiet state
  lampWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    height: 84,
  },
  lampHalo: {
    position: 'absolute',
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: C.gold,
  },
  lampGlow: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: C.gold,
  },
  lampCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: C.goldBg,
    borderWidth: 1,
    borderColor: C.goldLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quietTitle: {
    marginTop: 14,
    fontFamily: F.serifMedium,
    fontSize: 23,
    letterSpacing: -0.2,
    color: C.text,
    textAlign: 'center',
  },
  quietSub: {
    marginTop: 3,
    fontFamily: F.serif,
    fontSize: 15.5,
    color: C.textSecondary,
    textAlign: 'center',
  },
  primaryBtn: {
    marginTop: 16,
    height: 50,
    borderRadius: 999,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryBtnText: {
    fontFamily: F.sansSemiBold,
    fontSize: 15,
    letterSpacing: 0.2,
    color: '#fff',
  },
  chipRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  chipText: {
    fontFamily: F.sansMedium,
    fontSize: 12.5,
    color: C.textSecondary,
  },

  // Active state
  sessionName: {
    marginTop: 10,
    fontFamily: F.serifMedium,
    fontSize: 23,
    letterSpacing: -0.2,
    color: C.text,
  },
  sessionSub: {
    marginTop: 2,
    fontFamily: F.serif,
    fontSize: 15,
    color: C.textSecondary,
  },
  timerBlock: {
    marginTop: 14,
    alignItems: 'center',
  },
  timerText: {
    fontFamily: F.sansSemiBold,
    fontSize: 38,
    letterSpacing: 0.5,
    color: C.text,
    fontVariant: ['tabular-nums'],
  },
  timerCaption: {
    marginTop: 4,
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 2,
    color: C.textMuted,
  },
  progressTrack: {
    marginTop: 12,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.goldLight,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: C.gold,
  },
  controlsRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  endEarlyText: {
    fontFamily: F.sansSemiBold,
    fontSize: 13,
    color: C.red,
  },
  alsoActiveBlock: {
    marginTop: 15,
    paddingTop: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  alsoActiveLabel: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 2,
    color: C.textMuted,
  },
  alsoActiveRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alsoActiveText: {
    flex: 1,
    fontFamily: F.serifMedium,
    fontSize: 15.5,
    color: C.text,
  },
  alsoActiveAlways: {
    fontFamily: F.sansMedium,
    fontSize: 11.5,
    color: C.textMuted,
  },
});
