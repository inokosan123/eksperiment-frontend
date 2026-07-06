import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { ChevronRight, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import GoldButton from './GoldButton';
import GuardedPhone from './GuardedPhone';
import QuietHourSheet from './QuietHourSheet';
import TrophyMark from './TrophyMark';
import { SMOOTH_LAYOUT } from './focusMotion';
import {
  activeZone,
  closeDoor,
  dayFraction,
  endQuietHour,
  extendQuietHour,
  formatClockMs,
  formatEndsAt,
  formatMinutesShort,
  formatTimeOfDay,
  getEffectivePlan,
  getLiveDayStatus,
  groupName,
  nextZoneStart,
  tickDayPlanStore,
  useDayPlan,
  type DayPlanState,
} from './dayPlanStore';

const PANEL_TRANSITION = SMOOTH_LAYOUT;
const PHONE_SIZE = 172;
const BROKEN_RING = '#E4C3CA';

// ---------------------------------------------------------------------------

function StatusDot({ color }: { color: string }) {
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

  const style = useAnimatedStyle(() => ({
    opacity: 0.45 + pulse.value * 0.55,
  }));
  return <Animated.View style={[s.statusDot, { backgroundColor: color }, style]} />;
}

function namesList(state: DayPlanState, ids: string[], max = 3) {
  const names = ids.map(id => groupName(state, id));
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max - 1).join(', ')} +${names.length - max + 1}`;
}

// ---------------------------------------------------------------------------

export default function NowPanel({ onOpenTrophies }: { onOpenTrophies?: () => void }) {
  const state = useDayPlan();
  const router = useRouter();
  const [sheetMode, setSheetMode] = useState<'create' | 'edit' | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const ringProgress = useSharedValue(0);
  const wasProtected = useRef(false);

  const quiet = state.quiet;

  // Seconds matter while a Quiet Hour runs; otherwise a slow pulse is enough.
  useEffect(() => {
    const interval = setInterval(
      () => {
        const ms = Date.now();
        tickDayPlanStore(ms);
        setNowMs(ms);
      },
      quiet ? 1000 : 30_000
    );
    return () => clearInterval(interval);
  }, [quiet]);

  const now = useMemo(() => new Date(nowMs), [nowMs]);
  const plan = getEffectivePlan(state, now);
  const liveStatus = getLiveDayStatus(state, now);
  const zone = activeZone(plan, now);
  const nextZone = nextZoneStart(plan, now);
  const door = state.door;

  const limitedRules = useMemo(
    () => (plan ? plan.rules.filter(rule => rule.dailyMinutes != null) : []),
    [plan]
  );

  // The ring of time: the quiet countdown when one runs, otherwise the day.
  useEffect(() => {
    if (quiet) {
      const elapsed = Math.min(1, Math.max(0, 1 - (quiet.endsAt - nowMs) / quiet.totalMs));
      ringProgress.value = withTiming(elapsed, { duration: 980, easing: Easing.linear });
      return;
    }
    ringProgress.value = withTiming(dayFraction(now), { duration: 900, easing: Easing.linear });
  }, [quiet, nowMs, now, ringProgress]);

  const isProtected = liveStatus !== 'off' || !!quiet;
  useEffect(() => {
    if (isProtected && !wasProtected.current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    wasProtected.current = isProtected;
  }, [isProtected]);

  const headerLabel = plan ? `TODAY · ${plan.name.toUpperCase()}` : 'TODAY';

  const statusTag = quiet
    ? { color: C.goldDark, text: 'QUIET HOUR', dot: true }
    : liveStatus === 'kept' && plan
      ? { color: '#15803D', text: 'KEPT', dot: true }
      : liveStatus === 'broken'
        ? { color: '#B54155', text: 'BROKEN', dot: false }
        : { color: C.textMuted, text: 'REST DAY', dot: false };

  const zoneTitle = zone ? zone.name : 'Open hours';
  const zoneSub = zone
    ? `${namesList(state, zone.closedGroupIds)} closed until ${formatTimeOfDay(zone.endMinutes)}`
    : nextZone
      ? `Daily limits stand · ${nextZone.name} at ${formatTimeOfDay(nextZone.startMinutes)}`
      : 'Daily limits stand today.';

  return (
    <Animated.View style={s.card} layout={PANEL_TRANSITION}>
      <View style={s.headerRow}>
        <Text style={s.headerLabel} numberOfLines={1}>
          {headerLabel}
        </Text>
        <View style={s.headerStatus}>
          {statusTag.dot ? (
            <StatusDot color={statusTag.color} />
          ) : liveStatus === 'broken' && !quiet ? (
            <X s={11} c={statusTag.color} w={3} />
          ) : null}
          <Text style={[s.headerStatusText, { color: statusTag.color }]}>{statusTag.text}</Text>
        </View>
      </View>

      {quiet ? (
        <Animated.View key="quiet" entering={FadeIn.duration(320)} exiting={FadeOut.duration(140)}>
          <View style={s.phoneWrap}>
            <GuardedPhone diameter={PHONE_SIZE} sealed progress={ringProgress} />
          </View>
          <View style={s.timerBlock}>
            <Text style={s.timerText}>{formatClockMs(quiet.endsAt - nowMs)}</Text>
            <Text style={s.timerCaption}>REMAINING · ENDS {formatEndsAt(quiet.endsAt)}</Text>
          </View>
          <Text style={s.quietSub}>Everything loud is held back.</Text>

          <View style={s.controlsRow}>
            <TouchableOpacity
              style={s.chipBtn}
              activeOpacity={0.75}
              onPress={() => extendQuietHour(15)}
            >
              <Text style={s.chipBtnText}>+15 min</Text>
            </TouchableOpacity>
            {quiet.strength === 'strict' ? (
              <Text style={s.heldNote}>Held until it ends</Text>
            ) : (
              <View style={s.looseControls}>
                <TouchableOpacity
                  style={s.chipBtn}
                  activeOpacity={0.75}
                  onPress={() => setSheetMode('edit')}
                >
                  <Text style={s.chipBtnText}>Adjust</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.endChip}
                  activeOpacity={0.75}
                  onPress={() => endQuietHour()}
                >
                  <Text style={s.endChipText}>End early</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Animated.View>
      ) : liveStatus === 'off' ? (
        <Animated.View key="off" entering={FadeIn.duration(320)} exiting={FadeOut.duration(140)}>
          <View style={s.phoneWrap}>
            <GuardedPhone diameter={162} />
          </View>
          <Text style={s.bigTitle}>A day of rest.</Text>
          <Text style={s.bigSub}>Nothing is held back today.</Text>

          <GoldButton
            label="Quiet Hour"
            onPress={() => setSheetMode('create')}
            height={50}
            style={{ marginTop: 16 }}
          />
          <TouchableOpacity
            style={s.planLink}
            activeOpacity={0.7}
            onPress={() => router.push('/day-plans' as any)}
          >
            <Text style={s.planLinkText}>Plan your week →</Text>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <Animated.View key="day" entering={FadeIn.duration(320)} exiting={FadeOut.duration(140)}>
          <View style={s.phoneWrap}>
            <GuardedPhone
              diameter={PHONE_SIZE}
              sealed={liveStatus === 'kept'}
              progress={ringProgress}
              progressColor={liveStatus === 'broken' ? BROKEN_RING : C.gold}
            />
            {liveStatus === 'broken' && (
              <Animated.View entering={FadeIn.duration(280)} style={s.brokenBadge}>
                <X s={13} c="#fff" w={3} />
              </Animated.View>
            )}
          </View>

          {liveStatus === 'kept' ? (
            <>
              <Text style={s.bigTitle}>{zoneTitle}</Text>
              <Text style={s.bigSub}>{zoneSub}</Text>
            </>
          ) : (
            <>
              <Text style={s.bigTitle}>Today broke.</Text>
              <Text style={s.bigSub}>Tomorrow is a new page — finish today in peace.</Text>
            </>
          )}

          {limitedRules.length > 0 && (
            <Text style={s.limitsLine} numberOfLines={2}>
              {'Limits · '}
              {limitedRules
                .map(rule => `${groupName(state, rule.groupId)} ${formatMinutesShort(rule.dailyMinutes!)}`)
                .join(' · ')}
            </Text>
          )}

          {door && (
            <View style={s.doorRow}>
              <View style={s.doorPulse} />
              <Text style={s.doorText} numberOfLines={1}>
                {`Door open — ${groupName(state, door.groupId)} · ${formatClockMs(door.endsAt - nowMs)}`}
              </Text>
              <TouchableOpacity activeOpacity={0.75} onPress={() => closeDoor()}>
                <Text style={s.doorClose}>Close now</Text>
              </TouchableOpacity>
            </View>
          )}

          <GoldButton
            label="Quiet Hour"
            onPress={() => setSheetMode('create')}
            height={48}
            style={{ marginTop: 14 }}
          />
        </Animated.View>
      )}

      <TouchableOpacity
        style={s.trophyStrip}
        activeOpacity={onOpenTrophies ? 0.7 : 1}
        onPress={onOpenTrophies}
        disabled={!onOpenTrophies}
      >
        <TrophyMark size={17} />
        <Text style={s.trophyCount}>{state.streak.trophies}</Text>
        <Text style={s.trophyLabel}>
          {state.streak.trophies === 1 ? 'trophy' : 'trophies'}
        </Text>
        <View style={s.trophyDotSep} />
        <Text style={s.trophyStreak}>
          {state.streak.current > 0
            ? `${state.streak.current}-day streak`
            : 'the streak starts today'}
        </Text>
        <View style={{ flex: 1 }} />
        {onOpenTrophies && <ChevronRight s={16} c={C.textMuted} />}
      </TouchableOpacity>

      <QuietHourSheet
        visible={sheetMode !== null}
        editingSession={sheetMode === 'edit' ? quiet : null}
        onClose={() => setSheetMode(null)}
      />
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
    paddingBottom: 12,
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
    gap: 10,
  },
  headerLabel: {
    flexShrink: 1,
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: C.textMuted,
  },
  headerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headerStatusText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
  },

  phoneWrap: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: -2,
  },
  brokenBadge: {
    position: 'absolute',
    top: 14,
    right: '28%',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#B54155',
    borderWidth: 2,
    borderColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bigTitle: {
    fontFamily: F.serifMedium,
    fontSize: 23,
    lineHeight: 27,
    letterSpacing: -0.2,
    color: C.text,
    textAlign: 'center',
  },
  bigSub: {
    marginTop: 3,
    paddingHorizontal: 10,
    fontFamily: F.serif,
    fontSize: 14.5,
    lineHeight: 19,
    color: C.textSecondary,
    textAlign: 'center',
  },
  limitsLine: {
    marginTop: 10,
    paddingHorizontal: 6,
    fontFamily: F.sansMedium,
    fontSize: 11.5,
    lineHeight: 16,
    color: C.textMuted,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },

  doorRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0E3B8',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  doorPulse: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: C.gold,
  },
  doorText: {
    flex: 1,
    fontFamily: F.sansMedium,
    fontSize: 12,
    color: '#6D4F13',
    fontVariant: ['tabular-nums'],
  },
  doorClose: {
    fontFamily: F.sansSemiBold,
    fontSize: 12,
    color: C.goldDark,
  },

  timerBlock: {
    marginTop: 4,
    alignItems: 'center',
  },
  timerText: {
    fontFamily: F.serifBold,
    fontSize: 38,
    lineHeight: 42,
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
  quietSub: {
    marginTop: 5,
    fontFamily: F.serif,
    fontSize: 14.5,
    color: C.textSecondary,
    textAlign: 'center',
  },
  controlsRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  looseControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  chipBtnText: {
    fontFamily: F.sansMedium,
    fontSize: 12.5,
    color: C.textSecondary,
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
  heldNote: {
    fontFamily: F.sansMedium,
    fontSize: 12.5,
    color: C.textMuted,
  },

  bigSubSpacer: {
    height: 2,
  },

  planLink: {
    alignSelf: 'center',
    marginTop: 11,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  planLinkText: {
    fontFamily: F.sansMedium,
    fontSize: 12.5,
    color: C.gold,
  },

  trophyStrip: {
    marginTop: 13,
    marginHorizontal: -18,
    paddingHorizontal: 18,
    paddingTop: 11,
    paddingBottom: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trophyCount: {
    fontFamily: F.sansBold,
    fontSize: 13.5,
    color: C.text,
    fontVariant: ['tabular-nums'],
  },
  trophyLabel: {
    fontFamily: F.sansMedium,
    fontSize: 12,
    color: C.textSecondary,
  },
  trophyDotSep: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#D6D3D1',
    marginHorizontal: 3,
  },
  trophyStreak: {
    fontFamily: F.sansMedium,
    fontSize: 12,
    color: C.textSecondary,
  },
});
