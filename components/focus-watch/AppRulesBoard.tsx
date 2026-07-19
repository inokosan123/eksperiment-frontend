import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';
import { AlertTriangle, ChevronRight, Plus, Trash2 } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { NotoEmoji } from '@/components/shared/NotoEmoji';
import { C, F } from '@/constants/tokens';
import { CATEGORY_TINTS } from './focusContent';
import { useNativeActivitySelectionSummary } from './nativeSelectionSummaryStore';
import { formatMinutesShort, type GroupRule } from './dayPlanStore';

// The app-rules board: the day's planning capacity on one instrument, then a
// card per group carrying its own share of that capacity. Built to travel —
// it takes plain values and callbacks, never the plan store itself, so other
// screens can mount the same board over their own data.

const GLIDE = { duration: 520, easing: Easing.out(Easing.cubic) };
const CARD_LAYOUT = LinearTransition.duration(260).easing(Easing.bezier(0.22, 1, 0.36, 1));

// Known categories wear their face; custom groups fall back to an initial.
const GROUP_EMOJI: Record<string, string> = {
  social: 'mobile-phone',
  entertainment: 'movie-camera',
  games: 'joker',
  news: 'newspaper',
  shopping: 'money-bag',
  dating: 'red-heart',
};

const BLOCKED_COLOR = '#A24351';
const BLOCKED_TINT = '#FBE9EC';

export type RuleMode = 'noLimit' | 'limit' | 'blocked';

export function ruleModeOf(rule: GroupRule): RuleMode {
  return (rule.mode ?? (rule.dailyMinutes == null ? 'noLimit' : 'limit')) as RuleMode;
}

function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return `rgba(169,134,63,${alpha})`;
  const value = Number.parseInt(normalized, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

// The faint diagonal weave every lit focus card wears.
function RuleWeave({ color }: { color: string }) {
  const patternId = `rule-weave-${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id={patternId} width={30} height={30} patternUnits="userSpaceOnUse">
            <Path d="M 0 30 L 30 0" stroke={color} strokeOpacity={0.05} strokeWidth={1} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </Svg>
    </View>
  );
}

// A group's slice of the goal, gliding to its width whenever the rule changes.
function ShareBar({ share, color }: { share: number; color: string }) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(Math.max(0, Math.min(1, share)), GLIDE);
  }, [share, width]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return (
    <View style={[s.shareTrack, { backgroundColor: withAlpha(color, 0.14) }]}>
      <Animated.View style={[s.shareFill, { backgroundColor: color }, fillStyle]} />
    </View>
  );
}

function GroupMeta({
  nativeAvailable,
  selectionId,
  previewCount,
  individualCount,
}: {
  nativeAvailable: boolean;
  selectionId: string;
  previewCount: number;
  individualCount: number;
}) {
  const summary = useNativeActivitySelectionSummary(selectionId);
  const groupPart = nativeAvailable
    ? summary
      ? summary.applicationCount > 0
        ? `${summary.applicationCount} ${summary.applicationCount === 1 ? 'app' : 'apps'}`
        : 'Choose apps'
      : 'Loading selection'
    : `${previewCount} apps`;
  const rulesPart = individualCount > 0
    ? ` · ${individualCount} app ${individualCount === 1 ? 'rule' : 'rules'}`
    : '';
  return <Text style={s.cardMeta} numberOfLines={1}>{groupPart}{rulesPart}</Text>;
}

function GroupRuleCard({
  rule,
  name,
  index,
  goalMinutes,
  custom,
  nativeAvailable,
  selectionId,
  previewCount,
  onPress,
  onRemove,
}: {
  rule: GroupRule;
  name: string;
  index: number;
  goalMinutes: number | null;
  custom: boolean;
  nativeAvailable: boolean;
  selectionId: string;
  previewCount: number;
  onPress: () => void;
  onRemove: () => void;
}) {
  const mode = ruleModeOf(rule);
  const tint = CATEGORY_TINTS[rule.groupId] ?? { bg: C.goldLight, color: C.goldDark };
  const emoji = GROUP_EMOJI[rule.groupId];
  const accent = mode === 'blocked' ? BLOCKED_COLOR : tint.color;
  const lit = mode !== 'noLimit';
  const share = mode === 'limit' && goalMinutes != null && rule.dailyMinutes != null
    ? rule.dailyMinutes / goalMinutes
    : 0;
  const sharePercent = Math.round(Math.min(1, share) * 100);

  return (
    <Animated.View
      entering={FadeInDown.duration(360).delay(index * 55).easing(Easing.out(Easing.cubic))}
      layout={CARD_LAYOUT}
      style={[
        s.card,
        lit && { borderColor: withAlpha(accent, 0.34) },
      ]}
    >
      {lit && (
        <>
          <LinearGradient
            colors={mode === 'blocked'
              ? [BLOCKED_TINT, '#FFFAFB', '#FFFDFD']
              : [withAlpha(accent, 0.13), '#FFFDFA', '#FFFEFC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <RuleWeave color={accent} />
        </>
      )}

      <TouchableOpacity style={s.cardRow} onPress={onPress} activeOpacity={0.74} haptic="selection">
        <View style={[s.cardIcon, { backgroundColor: tint.bg, borderColor: withAlpha(tint.color, 0.24) }]}>
          {emoji
            ? <NotoEmoji name={emoji} size={26} />
            : <Text style={[s.cardIconLetter, { color: tint.color }]}>{name.charAt(0).toUpperCase()}</Text>}
        </View>

        <View style={s.cardBody}>
          <View style={s.cardTitleRow}>
            <Text style={s.cardName} numberOfLines={1}>{name}</Text>
            {lit && (
              <Animated.View
                entering={FadeIn.duration(200)}
                style={[
                  s.strengthChip,
                  rule.strength === 'strict'
                    ? { backgroundColor: '#F8E7EA', borderColor: '#E7C4CB' }
                    : { backgroundColor: '#FFF6DF', borderColor: '#EAD7A8' },
                ]}
              >
                <Text style={[s.strengthChipText, { color: rule.strength === 'strict' ? BLOCKED_COLOR : '#95681F' }]}>
                  {rule.strength === 'strict' ? 'STRICT' : 'LOOSE'}
                </Text>
              </Animated.View>
            )}
          </View>

          <View style={s.cardMetaRow}>
            <View style={[s.cardDot, { backgroundColor: lit ? accent : '#CFC9BB' }]} />
            <GroupMeta
              nativeAvailable={nativeAvailable}
              selectionId={selectionId}
              previewCount={previewCount}
              individualCount={(rule.appRules ?? []).length}
            />
          </View>
        </View>

        <View style={s.cardTail}>
          <View style={[
            s.valueChip,
            mode === 'blocked' && { backgroundColor: BLOCKED_TINT, borderColor: '#E7C4CB' },
            mode === 'limit' && { backgroundColor: withAlpha(accent, 0.1), borderColor: withAlpha(accent, 0.3) },
          ]}>
            <Text
              style={[
                s.valueChipText,
                mode === 'blocked' && { color: BLOCKED_COLOR },
                mode === 'limit' && { color: accent },
              ]}
              numberOfLines={1}
            >
              {mode === 'blocked'
                ? 'Blocked'
                : mode === 'limit' && rule.dailyMinutes != null
                  ? formatMinutesShort(rule.dailyMinutes)
                  : 'No limit'}
            </Text>
          </View>
          <ChevronRight s={16} c={C.textMuted} w={2} />
        </View>
      </TouchableOpacity>

      {mode === 'limit' && goalMinutes != null && (
        <Animated.View entering={FadeIn.duration(240)} layout={CARD_LAYOUT} style={s.shareBlock}>
          <ShareBar share={share} color={accent} />
          <Text style={s.shareCaption}>{sharePercent}% of your goal</Text>
        </Animated.View>
      )}

      {mode === 'blocked' && (
        <Animated.View entering={FadeIn.duration(240)} layout={CARD_LAYOUT} style={s.blockedBand}>
          <Text style={s.blockedBandText}>CLOSED ALL DAY</Text>
        </Animated.View>
      )}

      {custom && (
        <TouchableOpacity style={s.removeButton} onPress={onRemove} hitSlop={8} haptic="selection">
          <Trash2 s={13} c={C.textMuted} w={2} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// The projection rail: each planned group takes its colored span of the goal.
function RailSegment({ left, width, color }: { left: number; width: number; color: string }) {
  const l = useSharedValue(left);
  const w = useSharedValue(width);

  useEffect(() => {
    l.value = withTiming(left, GLIDE);
    w.value = withTiming(width, GLIDE);
  }, [left, width, l, w]);

  const style = useAnimatedStyle(() => ({ left: l.value, width: w.value }));
  return <Animated.View style={[s.railSegment, { backgroundColor: color }, style]} />;
}

function CapacityMeter({
  goalMinutes,
  lockAtMinutes,
  plannedByGroup,
}: {
  goalMinutes: number | null;
  lockAtMinutes: number | null;
  plannedByGroup: Record<string, number>;
}) {
  const [railWidth, setRailWidth] = useState(0);
  const groups = Object.entries(plannedByGroup).filter(([, minutes]) => minutes > 0);
  const planned = groups.reduce((sum, [, minutes]) => sum + minutes, 0);
  const scale = lockAtMinutes ?? goalMinutes ?? Math.max(60, planned);
  const capacity = goalMinutes == null ? null : Math.round(goalMinutes * 0.8);
  const overCapacity = goalMinutes != null && planned > goalMinutes * 0.9;
  const full = goalMinutes != null && planned >= goalMinutes;

  const segments = useMemo(() => {
    let consumed = 0;
    return groups.map(([groupId, minutes]) => {
      const left = consumed / scale;
      consumed += minutes;
      return { groupId, left, width: Math.max(0, Math.min(1 - left, minutes / scale)) };
    });
  }, [groups, scale]);

  return (
    <View style={s.meterCard}>
      <View style={s.meterHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.meterKicker}>PLANNING CAPACITY</Text>
          <Text style={s.meterTitle}>
            {capacity == null ? 'Set a Goal first.' : `${formatMinutesShort(capacity)} to divide`}
          </Text>
          <Text style={s.meterBody}>Plan 80% of the Goal. The rest stays free for real life.</Text>
        </View>
        <View style={[s.plannedPill, full && s.plannedPillFull]}>
          <Text style={[s.plannedPillLabel, full && s.plannedPillLabelFull]}>PLANNED</Text>
          <Text style={[s.plannedPillValue, full && s.plannedPillValueFull]}>{formatMinutesShort(planned)}</Text>
        </View>
      </View>

      <View style={s.railBlock}>
        {goalMinutes != null && railWidth > 0 && (
          <>
            <View style={[s.markerChip, { left: Math.max(0, (goalMinutes * 0.8 / scale) * railWidth - 17) }]}>
              <Text style={s.markerChipText}>80%</Text>
            </View>
            <View style={[s.markerChip, s.goalChip, { left: Math.min(railWidth - 40, Math.max(0, (goalMinutes / scale) * railWidth - 20)) }]}>
              <Text style={[s.markerChipText, s.goalChipText]}>GOAL</Text>
            </View>
          </>
        )}
        <View style={s.rail} onLayout={event => setRailWidth(event.nativeEvent.layout.width)}>
          {railWidth > 0 && segments.map(segment => (
            <RailSegment
              key={segment.groupId}
              left={segment.left * railWidth}
              width={segment.width * railWidth}
              color={(CATEGORY_TINTS[segment.groupId] ?? { color: C.goldDark }).color}
            />
          ))}
          {goalMinutes != null && railWidth > 0 && (
            <>
              <View style={[s.railMarker, s.capacityMarker, { left: (goalMinutes * 0.8 / scale) * railWidth }]} />
              <View style={[s.railMarker, s.goalMarker, { left: (goalMinutes / scale) * railWidth }]} />
            </>
          )}
          {lockAtMinutes != null && railWidth > 0 && (
            <View style={[s.railMarker, s.hardMarker, { left: railWidth - 3 }]} />
          )}
        </View>
        <View style={s.railBottomLabels}>
          <Text style={s.railBottomText}>0</Text>
          <Text style={s.railBottomText}>
            {lockAtMinutes == null ? 'No daily boundary' : `Locked from ${formatMinutesShort(lockAtMinutes)}`}
          </Text>
        </View>
      </View>

      {overCapacity && (
        <Animated.View entering={FadeIn.duration(240)} style={[s.warning, full && s.warningStrong]}>
          <AlertTriangle s={14} c={full ? BLOCKED_COLOR : '#A36F2B'} w={2.2} />
          <Text style={[s.warningText, full && s.warningTextStrong]}>
            {full
              ? 'Your rules use the whole Goal. Nothing is left for real life.'
              : 'Very little room left for messages, maps, and real life.'}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

export default function AppRulesBoard({
  goalMinutes,
  lockAtMinutes,
  rules,
  groupIds,
  customGroupIds,
  groupAppCounts,
  resolveGroupName,
  nativeAvailable,
  selectionIdForGroup,
  onOpenRule,
  onRemoveGroup,
  onAddGroup,
}: {
  goalMinutes: number | null;
  lockAtMinutes: number | null;
  rules: GroupRule[];
  groupIds: string[];
  customGroupIds: string[];
  groupAppCounts: Record<string, number>;
  resolveGroupName: (groupId: string) => string;
  nativeAvailable: boolean;
  selectionIdForGroup: (groupId: string) => string;
  onOpenRule: (groupId: string) => void;
  onRemoveGroup: (groupId: string) => void;
  onAddGroup: () => void;
}) {
  const plannedByGroup = useMemo(() => {
    const result: Record<string, number> = {};
    for (const rule of rules) {
      if (ruleModeOf(rule) !== 'limit' || rule.dailyMinutes == null) continue;
      result[rule.groupId] = (result[rule.groupId] ?? 0) + rule.dailyMinutes;
    }
    return result;
  }, [rules]);

  return (
    <View>
      <View style={s.header}>
        <Text style={s.headerKicker}>APP RULES</Text>
        <Text style={s.headerTitle}>Divide the day</Text>
        <Text style={s.headerBody}>Give each group its share of your goal — or close it entirely.</Text>
      </View>

      <CapacityMeter goalMinutes={goalMinutes} lockAtMinutes={lockAtMinutes} plannedByGroup={plannedByGroup} />

      <View style={s.cardStack}>
        {groupIds.map((groupId, index) => {
          const rule = rules.find(entry => entry.groupId === groupId);
          if (!rule) return null;
          return (
            <GroupRuleCard
              key={groupId}
              rule={rule}
              name={resolveGroupName(groupId)}
              index={index}
              goalMinutes={goalMinutes}
              custom={customGroupIds.includes(groupId)}
              nativeAvailable={nativeAvailable}
              selectionId={selectionIdForGroup(groupId)}
              previewCount={groupAppCounts[groupId] ?? 0}
              onPress={() => onOpenRule(groupId)}
              onRemove={() => onRemoveGroup(groupId)}
            />
          );
        })}
      </View>

      <TouchableOpacity style={s.addRow} onPress={onAddGroup} activeOpacity={0.76} haptic="selection">
        <View style={s.addIcon}><Plus s={14} c={C.goldDark} w={2.5} /></View>
        <Text style={s.addText}>Add or reuse a group</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 4, marginBottom: 12 },
  headerKicker: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: C.goldDark },
  headerTitle: { marginTop: 5, fontFamily: F.serifSemiBold, fontSize: 23, lineHeight: 27, letterSpacing: -0.3, color: C.text },
  headerBody: { marginTop: 4, maxWidth: 320, fontFamily: F.sans, fontSize: 12.5, lineHeight: 17.5, color: C.textSecondary },

  meterCard: {
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#DFDBD3',
    backgroundColor: '#FFFDF9',
    padding: 16,
    gap: 12,
    boxShadow: '0 8px 24px rgba(45, 40, 33, 0.055)',
  },
  meterHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  meterKicker: { fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 1.9, color: C.textMuted },
  meterTitle: { marginTop: 4, fontFamily: F.serifSemiBold, fontSize: 21, lineHeight: 25, letterSpacing: -0.25, color: C.text },
  meterBody: { marginTop: 4, fontFamily: F.sans, fontSize: 12.5, lineHeight: 17, color: C.textSecondary },
  plannedPill: {
    flexShrink: 0,
    minWidth: 76,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E7E2D6',
    backgroundColor: '#F6F4EE',
    paddingHorizontal: 11,
    paddingVertical: 9,
    alignItems: 'center',
  },
  plannedPillFull: { borderColor: '#E7C4CB', backgroundColor: BLOCKED_TINT },
  plannedPillLabel: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.2, color: C.textMuted },
  plannedPillLabelFull: { color: BLOCKED_COLOR },
  plannedPillValue: { marginTop: 3, fontFamily: F.serifSemiBold, fontSize: 19, lineHeight: 23, color: C.text, fontVariant: ['tabular-nums'] },
  plannedPillValueFull: { color: BLOCKED_COLOR },

  railBlock: { position: 'relative', paddingTop: 22 },
  markerChip: {
    position: 'absolute',
    top: 0,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#EAD9B7',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 7,
    paddingVertical: 3,
    zIndex: 2,
  },
  goalChip: { borderColor: '#D9CBB2', backgroundColor: '#F4EFE4' },
  markerChipText: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 0.7, color: C.goldDark },
  goalChipText: { color: '#2D2923' },
  rail: { position: 'relative', height: 20, borderRadius: 10, borderCurve: 'continuous', backgroundColor: '#ECE9E1', overflow: 'hidden' },
  railSegment: { position: 'absolute', top: 2.5, bottom: 2.5, borderRadius: 7, borderCurve: 'continuous' },
  railMarker: { position: 'absolute', top: 0, bottom: 0, width: 1.5, borderRadius: 1 },
  capacityMarker: { backgroundColor: C.goldDark, opacity: 0.55 },
  goalMarker: { width: 2, backgroundColor: '#2D2923' },
  hardMarker: { width: 3, backgroundColor: BLOCKED_COLOR },
  railBottomLabels: { marginTop: 7, flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  railBottomText: { fontFamily: F.sansMedium, fontSize: 10.5, color: C.textMuted, fontVariant: ['tabular-nums'] },

  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 14, borderCurve: 'continuous', backgroundColor: '#FFF4DC', paddingHorizontal: 12, paddingVertical: 10 },
  warningStrong: { backgroundColor: '#F9E8EB' },
  warningText: { flex: 1, fontFamily: F.sansMedium, fontSize: 11.5, lineHeight: 16, color: '#8D5C1E' },
  warningTextStrong: { color: '#8F3443' },

  cardStack: { marginTop: 12, gap: 9 },
  card: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 21,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    paddingVertical: 11,
    boxShadow: '0 6px 16px rgba(35, 40, 37, 0.055)',
  },
  cardRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 11 },
  cardIcon: {
    flexShrink: 0,
    width: 48,
    height: 48,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconLetter: { fontFamily: F.serifSemiBold, fontSize: 20 },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  cardName: { flexShrink: 1, fontFamily: F.serifSemiBold, fontSize: 18, lineHeight: 22, color: C.text },
  strengthChip: { flexShrink: 0, borderRadius: 999, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2.5 },
  strengthChipText: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 0.8 },
  cardMetaRow: { marginTop: 3.5, flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardDot: { flexShrink: 0, width: 5, height: 5, borderRadius: 3 },
  cardMeta: { flexShrink: 1, fontFamily: F.sans, fontSize: 12, lineHeight: 16, color: C.textSecondary },
  cardTail: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  valueChip: {
    minWidth: 62,
    borderRadius: 13,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E7E2D6',
    backgroundColor: '#F6F4EE',
    paddingHorizontal: 9,
    paddingVertical: 7,
    alignItems: 'center',
  },
  valueChipText: { fontFamily: F.serifSemiBold, fontSize: 15.5, lineHeight: 19, color: C.textSecondary, fontVariant: ['tabular-nums'] },

  shareBlock: { marginTop: 11, paddingLeft: 59, paddingRight: 2 },
  shareTrack: { height: 7, borderRadius: 4, overflow: 'hidden' },
  shareFill: { height: '100%', borderRadius: 4 },
  shareCaption: { marginTop: 5, fontFamily: F.sansSemiBold, fontSize: 10.5, color: C.textMuted, fontVariant: ['tabular-nums'] },

  blockedBand: {
    marginTop: 11,
    marginLeft: 59,
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderCurve: 'continuous',
    backgroundColor: BLOCKED_TINT,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  blockedBandText: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.1, color: BLOCKED_COLOR },

  removeButton: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 28,
    height: 28,
    borderRadius: 10,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(245,242,236,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  addRow: {
    marginTop: 11,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 19,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D7C398',
    backgroundColor: '#FFF9EC',
  },
  addIcon: { width: 32, height: 32, borderRadius: 11, borderCurve: 'continuous', backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
  addText: { fontFamily: F.serifSemiBold, fontSize: 16.5, color: C.goldDark },
});
