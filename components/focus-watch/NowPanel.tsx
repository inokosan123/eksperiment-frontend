import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Clock, Globe, Shield } from '@/components/icons/Icons';
import StreakFlame from './StreakFlame';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import GoldButton from './GoldButton';
import GuardedPhone from './GuardedPhone';
import QuickWatchSheet from './QuickWatchSheet';
import {
  describeSelection,
  endActiveSession,
  extendActiveSession,
  getActiveScheduledWatches,
  useFocusWatch,
  type WatchStrength,
} from './focusWatchStore';
import { WEB_PACK_LAYER_NAMES } from './focusContent';
import { SMOOTH_LAYOUT } from './focusMotion';

const PANEL_TRANSITION = SMOOTH_LAYOUT;

type ActiveDescriptor = {
  kind: 'quick' | 'scheduled';
  name: string;
  startedAt: number;
  endsAt: number;
  totalMs: number;
  strength: WatchStrength;
  subLine: string;
  streak: number;
};

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

function ActiveDot() {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.quad) })
      ),
      -1
    );
    return () => cancelAnimation(pulse);
  }, [pulse]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + pulse.value * 0.55,
  }));
  return <Animated.View style={[s.activeDot, dotStyle]} />;
}

function QuietState({ onBegin }: { onBegin: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(320)} exiting={FadeOut.duration(140)}>
      <View style={s.lampWrap}>
        <GuardedPhone diameter={162} />
      </View>
      <Text style={s.quietTitle}>All is quiet.</Text>
      <Text style={s.quietSub}>No watch is active.</Text>

      <GoldButton
        label="Begin a watch"
        onPress={onBegin}
        height={50}
        style={{ marginTop: 16 }}
      />
    </Animated.View>
  );
}

function ActiveState({
  session,
  onExpired,
}: {
  session: ActiveDescriptor;
  onExpired: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const progress = useSharedValue(0);

  const remaining = Math.max(0, session.endsAt - now);
  const isStrict = session.strength === 'strict';

  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [session.endsAt]);

  // The watch completes on its own when time runs out.
  useEffect(() => {
    if (remaining <= 0) {
      if (session.kind === 'quick') endActiveSession();
      onExpired();
    }
  }, [remaining, session.kind, onExpired]);

  useEffect(() => {
    const elapsedFraction = Math.min(
      1,
      Math.max(0, 1 - remaining / Math.max(1, session.totalMs))
    );
    progress.value = withTiming(elapsedFraction, {
      duration: 980,
      easing: Easing.linear,
    });
  }, [remaining, session.totalMs, progress]);

  const endsLabel = useMemo(() => formatEndsAt(session.endsAt), [session.endsAt]);

  return (
    <Animated.View entering={FadeIn.duration(320)} exiting={FadeOut.duration(140)}>
      <Text style={s.sessionName}>{session.name}</Text>
      <Text style={s.sessionSub}>{session.subLine}</Text>

      <View style={s.lampWrap}>
        <GuardedPhone diameter={178} sealed progress={progress} />
      </View>

      <View style={s.timerBlock}>
        <Text style={s.timerText}>{formatRemaining(remaining)}</Text>
        <Text style={s.timerCaption}>REMAINING · ENDS {endsLabel}</Text>
      </View>

      {session.kind === 'quick' ? (
        <View style={s.controlsRow}>
          <TouchableOpacity
            style={s.chip}
            activeOpacity={0.75}
            onPress={() => extendActiveSession(15)}
          >
            <Text style={s.chipText}>+15 min</Text>
          </TouchableOpacity>
          {isStrict ? (
            <View style={s.lockNote}>
              <Shield s={12} c={C.textMuted} w={2.2} />
              <Text style={s.lockNoteText}>Held until it ends</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={s.endChip}
              activeOpacity={0.75}
              onPress={() => endActiveSession()}
            >
              <Text style={s.endChipText}>End early</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={s.scheduledRow}>
          {session.streak > 0 && <StreakFlame count={session.streak} />}
          <Text style={s.scheduledText}>
            {session.streak > 0
              ? 'days unbroken — hold the line'
              : 'Scheduled watch — hold the line'}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

export default function NowPanel() {
  const {
    activeSession,
    plans,
    webPacks,
    customDomains,
    neverPacks,
    allowlistMode,
  } = useFocusWatch();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const wasActive = useRef(false);

  // A slow tick so scheduled watches appear/disappear on their own.
  useEffect(() => {
    const interval = setInterval(() => setClock(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const scheduled = useMemo(
    () => getActiveScheduledWatches(plans, new Date(clock)),
    [plans, clock]
  );

  const primary: ActiveDescriptor | null = useMemo(() => {
    if (activeSession) {
      return {
        kind: 'quick',
        name: activeSession.name,
        startedAt: activeSession.startedAt,
        endsAt: activeSession.endsAt,
        totalMs: activeSession.totalMs,
        strength: activeSession.strength,
        streak: 0,
        subLine: `${describeSelection(activeSession)} held back · ${activeSession.strength === 'strict' ? 'Strict' : 'Loose'}`,
      };
    }
    const first = scheduled[0];
    if (!first) return null;
    return {
      kind: 'scheduled',
      name: first.plan.name,
      startedAt: first.startedAt,
      endsAt: first.endsAt,
      totalMs: first.endsAt - first.startedAt,
      strength: first.plan.strength,
      streak: first.plan.streak,
      subLine: `${describeSelection(first.plan)} · ${first.plan.strength === 'strict' ? 'Strict' : 'Loose'}`,
    };
  }, [activeSession, scheduled]);

  const isActive = !!primary;

  // A gentle success pulse the moment protection rises.
  useEffect(() => {
    if (isActive && !wasActive.current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    wasActive.current = isActive;
  }, [isActive]);

  const alsoWatches = useMemo(() => {
    if (!primary) return [];
    return primary.kind === 'quick' ? scheduled : scheduled.slice(1);
  }, [scheduled, primary]);

  const layers = useMemo(() => {
    const result: { id: string; name: string; kind: 'web' | 'allowlist'; badge: string }[] = [];
    for (const pack of neverPacks) {
      if (pack.enabled) {
        result.push({
          id: `never-${pack.id}`,
          name: WEB_PACK_LAYER_NAMES[pack.id],
          kind: 'web',
          badge: 'never',
        });
      }
    }
    for (const pack of webPacks) {
      if (pack.enabled && !result.some(layer => layer.id === `never-${pack.id}`)) {
        result.push({ id: pack.id, name: WEB_PACK_LAYER_NAMES[pack.id], kind: 'web', badge: 'always' });
      }
    }
    if (customDomains.length > 0) {
      result.push({
        id: 'custom-domains',
        name: customDomains.length === 1 ? '1 custom site' : `${customDomains.length} custom sites`,
        kind: 'web',
        badge: 'always',
      });
    }
    if (allowlistMode) {
      result.push({ id: 'allowlist', name: 'Simple phone', kind: 'allowlist', badge: 'on' });
    }
    return result;
  }, [webPacks, customDomains, neverPacks, allowlistMode]);

  const hasAlsoBlock = layers.length > 0 || alsoWatches.length > 0;

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

      {primary ? (
        <ActiveState
          key={`${primary.kind}-${primary.name}`}
          session={primary}
          onExpired={() => setClock(Date.now())}
        />
      ) : (
        <QuietState key="quiet" onBegin={() => setSheetVisible(true)} />
      )}

      <QuickWatchSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} />

      {hasAlsoBlock && (
        <View style={s.alsoActiveBlock}>
          <Text style={s.alsoActiveLabel}>{isActive ? 'ALSO ACTIVE' : 'ALWAYS ON'}</Text>
          {alsoWatches.map(entry => (
            <View key={entry.plan.id} style={s.alsoActiveRow}>
              <Clock s={13} c={C.textMuted} w={2.2} />
              <Text style={s.alsoActiveText}>{entry.plan.name}</Text>
              <Text style={s.alsoActiveAlways}>until {formatEndsAt(entry.endsAt)}</Text>
            </View>
          ))}
          {layers.map(layer => (
            <View key={layer.id} style={s.alsoActiveRow}>
              {layer.kind === 'allowlist' ? (
                <Shield s={13} c={C.textMuted} w={2.2} />
              ) : (
                <Globe s={13} c={C.textMuted} w={2} />
              )}
              <Text style={s.alsoActiveText}>{layer.name}</Text>
              <Text style={s.alsoActiveAlways}>{layer.badge}</Text>
            </View>
          ))}
        </View>
      )}
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
  // Green like the check shield standing guard.
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#15803D',
  },
  headerActiveText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: '#15803D',
  },

  lampWrap: {
    alignItems: 'center',
    marginTop: 6,
  },

  // Quiet state
  quietTitle: {
    marginTop: 6,
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
    fontSize: 22,
    letterSpacing: -0.2,
    color: C.text,
    textAlign: 'center',
  },
  sessionSub: {
    marginTop: 2,
    fontFamily: F.serif,
    fontSize: 14.5,
    color: C.textSecondary,
    textAlign: 'center',
  },
  timerBlock: {
    marginTop: 8,
    alignItems: 'center',
  },
  // Same numerals as the app's other timers (Pomodoro): bold serif, tabular.
  timerText: {
    fontFamily: F.serifBold,
    fontSize: 42,
    lineHeight: 46,
    letterSpacing: -1,
    color: C.text,
    fontVariant: ['tabular-nums'],
  },
  timerCaption: {
    marginTop: 3,
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 2,
    color: C.textMuted,
  },
  controlsRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  endChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#F2D4DA',
    backgroundColor: '#FEF7F8',
  },
  endChipText: {
    fontFamily: F.sansSemiBold,
    fontSize: 12.5,
    color: C.red,
  },
  lockNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lockNoteText: {
    fontFamily: F.sansMedium,
    fontSize: 12.5,
    color: C.textMuted,
  },
  scheduledRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  scheduledText: {
    fontFamily: F.sansMedium,
    fontSize: 12.5,
    color: C.textSecondary,
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
