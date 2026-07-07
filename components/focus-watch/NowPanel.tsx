import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
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
import { ArrowUpRight, ChevronRight, Shield, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import GoldButton from './GoldButton';
import GuardedPhone from './GuardedPhone';
import QuietHourSheet from './QuietHourSheet';
import ZoneTimeline, { zoneTint } from './ZoneTimeline';
import { SMOOTH_LAYOUT } from './focusMotion';
import {
  activeZone,
  closeDoor,
  dateKey,
  dayFraction,
  endQuietHour,
  extendQuietHour,
  formatClockMs,
  formatEndsAt,
  formatTimeOfDay,
  getEffectivePlan,
  getLiveDayStatus,
  groupName,
  nextZoneStart,
  tickDayPlanStore,
  useDayPlan,
  type DayPlanState,
  type DayRecord,
} from './dayPlanStore';

const PANEL_TRANSITION = SMOOTH_LAYOUT;
const PHONE_SIZE = 174;
const BROKEN_RING = '#E4C3CA';
const GUARD_GREEN = '#4C9A68';
const TROPHY_PNG = require('@/assets/animations/challenge-trophy-preview.png');

const TILE_SIZE = 30;
// Indexed by Date.getDay() — Sun=0 … Sat=6 (same as the Home rhythm strip).
const STRIP_DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// ---------------------------------------------------------------------------

function PulsingDot({ color }: { color: string }) {
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
  return <Animated.View style={[s.pulsingDot, { backgroundColor: color }, style]} />;
}

function namesList(state: DayPlanState, ids: string[], max = 3) {
  const names = ids.map(id => groupName(state, id));
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max - 1).join(', ')} +${names.length - max + 1}`;
}

// ---------------------------------------------------------------------------
// The week of trophies — same grammar as the Home flame strip: a letter row
// and small round tiles; a kept day carries the trophy emblem and a glow.
// ---------------------------------------------------------------------------

type StripCell = {
  letter: string;
  state: 'kept' | 'broken' | 'off' | 'today-kept' | 'today-broken' | 'today-off';
};

function buildStrip(state: DayPlanState, now: Date): StripCell[] {
  const todayKey = dateKey(now);
  const liveStatus = getLiveDayStatus(state, now);
  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (6 - index));
    const key = dateKey(date);
    const letter = STRIP_DAY_LETTERS[date.getDay()];
    if (key === todayKey) {
      return {
        letter,
        state:
          liveStatus === 'broken' ? 'today-broken' : liveStatus === 'kept' ? 'today-kept' : 'today-off',
      } as StripCell;
    }
    const record: DayRecord | undefined = state.days[key];
    const cell: StripCell['state'] =
      record?.status === 'kept' ? 'kept' : record?.status === 'broken' ? 'broken' : 'off';
    return { letter, state: cell };
  });
}

// The gold ring that breathes around today's tile while the day is alive.
function TodayPulseRing() {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1700, easing: Easing.inOut(Easing.quad) })
      ),
      -1
    );
    return () => cancelAnimation(pulse);
  }, [pulse]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.2 + pulse.value * 0.6,
  }));
  return <Animated.View pointerEvents="none" style={[s.todayPulseRing, style]} />;
}

function TrophyTile({ cell }: { cell: StripCell }) {
  const isToday = cell.state.startsWith('today');
  if (cell.state === 'kept' || cell.state === 'today-kept') {
    return (
      <View style={s.tileHolder}>
        <View
          style={[s.tile, s.tileKept, cell.state === 'kept' && s.tileGlow, isToday && s.tileToday]}
        >
          <Image
            source={TROPHY_PNG}
            style={[s.tileTrophy, cell.state === 'today-kept' && { opacity: 0.45 }]}
            resizeMode="contain"
          />
        </View>
        {cell.state === 'today-kept' && <TodayPulseRing />}
      </View>
    );
  }
  if (cell.state === 'broken' || cell.state === 'today-broken') {
    return (
      <View style={[s.tile, s.tileBroken, isToday && s.tileToday]}>
        <X s={12} c={C.text} w={2.8} />
      </View>
    );
  }
  return <View style={[s.tile, s.tileEmpty, isToday && s.tileToday]} />;
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
  const door = state.door;

  // Seconds matter while a Quiet Hour or an open door runs.
  useEffect(() => {
    const interval = setInterval(
      () => {
        const ms = Date.now();
        tickDayPlanStore(ms);
        setNowMs(ms);
      },
      quiet || door ? 1000 : 30_000
    );
    return () => clearInterval(interval);
  }, [quiet, door]);

  const now = useMemo(() => new Date(nowMs), [nowMs]);
  const plan = getEffectivePlan(state, now);
  const liveStatus = getLiveDayStatus(state, now);
  const zone = activeZone(plan, now);
  const zoneIndex = zone && plan ? plan.zones.findIndex(entry => entry.id === zone.id) : -1;
  const nextZone = nextZoneStart(plan, now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const limitedRules = useMemo(
    () => (plan ? plan.rules.filter(rule => rule.dailyMinutes != null) : []),
    [plan]
  );

  const packsOn = state.purity.packs.filter(pack => pack.mode !== 'off').length;
  const sitesGuarded = state.purity.customDomains.length;
  const purityOn = packsOn > 0 || sitesGuarded > 0;

  // Protection is standing when a plan guards the day, a Quiet Hour runs,
  // or Clean Sight is on — the aura turns green and the emblem stands guard.
  const isProtected = !!plan || !!quiet || purityOn;
  const aura = isProtected ? GUARD_GREEN : C.gold;
  // The shield and the living phone take turns on the hour while guarded.
  const face: 'shield' | 'phone' = !isProtected
    ? 'phone'
    : Math.floor(nowMs / 3_600_000) % 2 === 0
      ? 'shield'
      : 'phone';

  // The ring of time: the quiet countdown when one runs, otherwise the day.
  useEffect(() => {
    if (quiet) {
      const elapsed = Math.min(1, Math.max(0, 1 - (quiet.endsAt - nowMs) / quiet.totalMs));
      ringProgress.value = withTiming(elapsed, { duration: 980, easing: Easing.linear });
      return;
    }
    ringProgress.value = withTiming(dayFraction(now), { duration: 900, easing: Easing.linear });
  }, [quiet, nowMs, now, ringProgress]);

  useEffect(() => {
    if (isProtected && !wasProtected.current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    wasProtected.current = isProtected;
  }, [isProtected]);

  const strip = useMemo(() => buildStrip(state, now), [state, now]);

  // --- copy: always say WHICH part of the plan is speaking -----------------
  let dayTitle = 'A day of rest.';
  let daySub = 'Nothing is held back today.';
  if (plan && liveStatus === 'broken') {
    dayTitle = 'Today broke.';
    daySub = 'Tomorrow is a new page — finish today in peace.';
  } else if (plan && zone) {
    dayTitle = zone.name || 'Guarded hours';
    daySub =
      zone.closedGroupIds.length > 0
        ? `${namesList(state, zone.closedGroupIds)} closed · until ${formatTimeOfDay(zone.endMinutes)}`
        : `Nothing closed here — limits stand · until ${formatTimeOfDay(zone.endMinutes)}`;
  } else if (plan && nextZone) {
    dayTitle = 'Free time';
    daySub = `${nextZone.name} begins at ${formatTimeOfDay(nextZone.startMinutes)} — daily limits stand.`;
  } else if (plan) {
    dayTitle = 'Free time';
    daySub =
      limitedRules.length > 0
        ? 'Only your daily limits stand today.'
        : 'This plan holds nothing back today.';
  } else if (purityOn) {
    daySub = 'Only Clean Sight stands guard today.';
  }

  const planMeta = zone
    ? `${zone.name} · until ${formatTimeOfDay(zone.endMinutes)}`
    : nextZone
      ? `Next: ${nextZone.name} ${formatTimeOfDay(nextZone.startMinutes)}`
      : 'No zones today';

  return (
    <Animated.View style={s.card} layout={PANEL_TRANSITION}>
      {quiet ? (
        <Animated.View key="quiet" entering={FadeIn.duration(320)} exiting={FadeOut.duration(140)}>
          <View style={s.phoneWrap}>
            <GuardedPhone
              diameter={PHONE_SIZE}
              sealed
              progress={ringProgress}
              aura={GUARD_GREEN}
              face={face}
            />
          </View>
          <View style={s.timerBlock}>
            <Text style={s.timerText}>{formatClockMs(quiet.endsAt - nowMs)}</Text>
            <Text style={s.timerCaption}>QUIET HOUR · ENDS {formatEndsAt(quiet.endsAt)}</Text>
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
      ) : (
        <Animated.View key="day" entering={FadeIn.duration(320)} exiting={FadeOut.duration(140)}>
          <View style={s.phoneWrap}>
            <GuardedPhone
              diameter={plan ? PHONE_SIZE : 164}
              sealed={isProtected && liveStatus !== 'broken'}
              progress={plan ? ringProgress : undefined}
              progressColor={liveStatus === 'broken' ? BROKEN_RING : C.gold}
              aura={aura}
              face={face}
            />
            {liveStatus === 'broken' && (
              <Animated.View entering={FadeIn.duration(280)} style={s.brokenBadge}>
                <X s={13} c="#fff" w={3} />
              </Animated.View>
            )}
          </View>

          <Text style={s.bigTitle} numberOfLines={1}>
            {dayTitle}
          </Text>
          <Text style={s.bigSub} numberOfLines={2}>
            {daySub}
          </Text>

          {plan && (
            <TouchableOpacity
              activeOpacity={0.84}
              onPress={() => router.push(`/day-plan?planId=${plan.id}` as any)}
              style={s.planCardWrap}
            >
              <LinearGradient
                colors={['#FFFDF6', '#FBF3DE']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.planCard}
              >
                <View style={s.planCardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.planCardLabel}>TODAY&apos;S PLAN</Text>
                    <Text style={s.planCardName} numberOfLines={1}>
                      {plan.name}
                    </Text>
                  </View>
                  <View style={s.planCardArrow}>
                    <ArrowUpRight s={13} c="#fff" w={2.5} />
                  </View>
                </View>

                <View style={{ marginTop: 10 }}>
                  <ZoneTimeline zones={plan.zones} height={9} nowMinutes={nowMinutes} />
                </View>

                {plan.zones.length > 0 && (
                  <View style={s.zoneLozengeRow}>
                    {plan.zones.map((entry, index) => {
                      const tint = zoneTint(index);
                      const active = zone?.id === entry.id;
                      return (
                        <View
                          key={entry.id}
                          style={[
                            s.zoneLozenge,
                            { backgroundColor: active ? tint.bar : tint.soft },
                          ]}
                        >
                          <Text
                            style={[s.zoneLozengeText, { color: active ? '#fff' : tint.text }]}
                            numberOfLines={1}
                          >
                            {entry.name}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                <View style={s.planCardMetaRow}>
                  {zone && zoneIndex >= 0 && (
                    <View style={[s.planZoneDot, { backgroundColor: zoneTint(zoneIndex).bar }]} />
                  )}
                  <Text style={s.planCardMeta} numberOfLines={1}>
                    {planMeta}
                  </Text>
                  <Text style={s.planCardMetaRight}>
                    {limitedRules.length > 0
                      ? `${limitedRules.length} ${limitedRules.length === 1 ? 'limit' : 'limits'}`
                      : 'no limits'}
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {!plan && (
            <TouchableOpacity
              style={s.planLink}
              activeOpacity={0.7}
              onPress={() => router.push('/day-plans' as any)}
            >
              <Text style={s.planLinkText}>Plan your week →</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      {purityOn && (
        <TouchableOpacity
          style={s.purityRow}
          activeOpacity={0.75}
          onPress={() => router.push('/clean-sight' as any)}
        >
          <View style={s.purityIcon}>
            <Shield s={14} c="#15803D" w={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.purityTitle}>Clean Sight</Text>
            <Text style={s.puritySub} numberOfLines={1}>
              {[
                packsOn > 0 ? `${packsOn} ${packsOn === 1 ? 'pack' : 'packs'}` : null,
                sitesGuarded > 0 ? `${sitesGuarded} ${sitesGuarded === 1 ? 'site' : 'sites'}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              {' guarded'}
              {state.purity.locks.enabled ? ' · locks on' : ''}
            </Text>
          </View>
          <PulsingDot color="#15803D" />
          <ChevronRight s={15} c={C.textMuted} />
        </TouchableOpacity>
      )}

      {door && !quiet && (
        <View style={s.doorRow}>
          <PulsingDot color={C.gold} />
          <Text style={s.doorText} numberOfLines={1}>
            {`Door open — ${groupName(state, door.groupId)} · ${formatClockMs(door.endsAt - nowMs)}`}
          </Text>
          <TouchableOpacity activeOpacity={0.75} onPress={() => closeDoor()}>
            <Text style={s.doorClose}>Close now</Text>
          </TouchableOpacity>
        </View>
      )}

      {!quiet && (
        <GoldButton
          label="Quiet Hour"
          onPress={() => setSheetMode('create')}
          height={48}
          style={{ marginTop: 14 }}
        />
      )}

      <TouchableOpacity
        style={s.strip}
        activeOpacity={onOpenTrophies ? 0.75 : 1}
        onPress={onOpenTrophies}
        disabled={!onOpenTrophies}
      >
        <View style={s.stripRow}>
          {strip.map((cell, index) => {
            const isToday = cell.state.startsWith('today');
            return (
              <Animated.View
                key={index}
                entering={FadeIn.duration(320).delay(50 * index)}
                style={s.stripCol}
              >
                <Text style={[s.stripLetter, isToday && { color: C.goldDark }]}>{cell.letter}</Text>
                <TrophyTile cell={cell} />
              </Animated.View>
            );
          })}
        </View>
        <View style={s.stripCaptionRow}>
          <Text style={s.stripCaption}>
            {`${state.streak.trophies} ${state.streak.trophies === 1 ? 'trophy' : 'trophies'} · ${
              state.streak.current > 0
                ? `${state.streak.current}-day streak`
                : 'the streak starts today'
            }`}
          </Text>
          {onOpenTrophies && <ChevronRight s={13} c={C.textMuted} />}
        </View>
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
    paddingTop: 10,
    paddingBottom: 12,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 4,
    overflow: 'hidden',
  },

  phoneWrap: {
    alignItems: 'center',
    marginTop: 0,
    marginBottom: -2,
  },
  brokenBadge: {
    position: 'absolute',
    top: 16,
    right: '27%',
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
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.2,
    color: C.text,
    textAlign: 'center',
  },
  bigSub: {
    marginTop: 3,
    paddingHorizontal: 8,
    fontFamily: F.serif,
    fontSize: 14.5,
    lineHeight: 19,
    color: C.textSecondary,
    textAlign: 'center',
  },

  planCardWrap: {
    marginTop: 13,
    borderRadius: 20,
    shadowColor: '#8A5A1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2,
  },
  planCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F0E3B8',
    paddingHorizontal: 15,
    paddingTop: 11,
    paddingBottom: 12,
    overflow: 'hidden',
  },
  planCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  planCardLabel: {
    fontFamily: F.sansBold,
    fontSize: 8.5,
    letterSpacing: 2,
    color: '#A9863F',
  },
  planCardName: {
    marginTop: 2,
    fontFamily: F.serifMedium,
    fontSize: 19,
    letterSpacing: -0.2,
    color: '#6D4F13',
  },
  planCardArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#8A5A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planCardMetaRow: {
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  planZoneDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  planCardMeta: {
    flex: 1,
    fontFamily: F.sansMedium,
    fontSize: 11,
    color: '#8A6A24',
    fontVariant: ['tabular-nums'],
  },
  planCardMetaRight: {
    fontFamily: F.sansSemiBold,
    fontSize: 10.5,
    color: '#A9863F',
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

  purityRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(21,128,61,0.14)',
    backgroundColor: '#F5FBF7',
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  purityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8F7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  purityTitle: {
    fontFamily: F.sansSemiBold,
    fontSize: 13,
    color: C.text,
  },
  puritySub: {
    marginTop: 1,
    fontFamily: F.sans,
    fontSize: 11,
    color: '#3D8273',
  },
  pulsingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
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
    marginTop: 2,
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

  strip: {
    marginTop: 14,
    marginHorizontal: -18,
    paddingHorizontal: 16,
    paddingTop: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  stripRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stripCol: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  stripLetter: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 0.6,
    color: C.textMuted,
  },
  tileHolder: {
    width: TILE_SIZE,
    height: TILE_SIZE,
  },
  todayPulseRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: (TILE_SIZE + 8) / 2,
    borderWidth: 1.5,
    borderColor: C.gold,
  },
  zoneLozengeRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  zoneLozenge: {
    maxWidth: 110,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  zoneLozengeText: {
    fontFamily: F.sansSemiBold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: TILE_SIZE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileKept: {
    backgroundColor: '#FFF3D8',
    borderColor: C.gold,
  },
  tileGlow: {
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  tileBroken: {
    backgroundColor: '#F6F4EE',
    borderColor: '#E5E1D6',
  },
  tileEmpty: {
    backgroundColor: '#FAFAF7',
    borderColor: '#EDEAE0',
    borderStyle: 'dashed',
  },
  tileToday: {
    borderColor: C.gold,
    borderStyle: 'solid',
  },
  tileTrophy: {
    width: 20,
    height: 20,
  },
  stripCaptionRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  stripCaption: {
    fontFamily: F.sansMedium,
    fontSize: 11.5,
    color: C.textSecondary,
    fontVariant: ['tabular-nums'],
  },
});
