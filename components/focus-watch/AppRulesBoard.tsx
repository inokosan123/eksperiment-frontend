import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  LinearTransition,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Path, Pattern, Rect } from 'react-native-svg';
import { AlertTriangle, ChevronRight, Lock, Plus, Trash2 } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import Bloom from './Bloom';
import ProtectionRegisterCard, { REGISTER_TONES } from './ProtectionRegister';
import GroupSeal, { groupTint, withAlpha } from './GroupSeal';
import { CATEGORY_TINTS } from './focusContent';
import { useNativeActivitySelectionSummary } from './nativeSelectionSummaryStore';
import { formatMinutesShort, type GroupRule } from './dayPlanStore';

// The app-rules board: the day's planning capacity on one instrument, then a
// card per group carrying its own share of that capacity. Built to travel —
// it takes plain values and callbacks, never the plan store itself, so other
// screens can mount the same board over their own data.

const GLIDE = { duration: 520, easing: Easing.out(Easing.cubic) };
const CARD_LAYOUT = LinearTransition.duration(260).easing(Easing.bezier(0.22, 1, 0.36, 1));
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const BLOCKED_COLOR = '#A24351';
const BLOCKED_TINT = '#FBE9EC';

export type RuleMode = 'noLimit' | 'limit' | 'blocked';

export function ruleModeOf(rule: GroupRule): RuleMode {
  return (rule.mode ?? (rule.dailyMinutes == null ? 'noLimit' : 'limit')) as RuleMode;
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
  // The row is narrow — the share percent shares this line, so "app rules"
  // abbreviates rather than pushing the meta into a second line.
  const rulesPart = individualCount > 0 ? ` · ${individualCount} ${individualCount === 1 ? 'rule' : 'rules'}` : '';
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
  const accent = mode === 'blocked' ? BLOCKED_COLOR : groupTint(rule.groupId).color;
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
      {/* The colour never meets a hard edge with white. The card body is a warm
          near-white; the group's colour is a soft radial pool behind the seal
          that fades out on its own, so a ruled card reads coloured-on-the-left
          without any seam. Inactive is plain warm cream. */}
      <LinearGradient
        colors={lit ? ['#FFFEFC', '#FFFDFB', '#FFFEFD'] : ['#FEFCF6', '#FFFEFB', '#FDFBF5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.9 }}
        style={StyleSheet.absoluteFill}
      />
      <RuleWeave color={lit ? accent : '#8A6A2F'} />
      {lit && (
        <>
          <View pointerEvents="none" style={s.cardWashBloom}>
            <Bloom color={accent} opacity={mode === 'blocked' ? 0.16 : 0.19} />
          </View>
          <View pointerEvents="none" style={s.cardSealBloom}>
            <Bloom color={accent} opacity={mode === 'blocked' ? 0.24 : 0.28} />
          </View>
        </>
      )}

      {mode === 'blocked' && <View style={s.closedEdge} />}

      <TouchableOpacity style={s.cardRow} onPress={onPress} activeOpacity={0.74} haptic="selection">
        <GroupSeal
          groupId={rule.groupId}
          name={name}
          size={42}
          share={mode === 'limit' && goalMinutes != null ? share : 0}
          blocked={mode === 'blocked'}
          dim={!lit}
        />

        <View style={s.cardBody}>
          <View style={s.cardTitleRow}>
            <Text style={s.cardName} numberOfLines={1}>{name}</Text>
            {lit && (
              <Animated.View entering={FadeIn.duration(200)} style={s.strengthMark}>
                <View style={[s.strengthDot, { backgroundColor: rule.strength === 'strict' ? BLOCKED_COLOR : '#B98A2E' }]} />
                <Text style={[s.strengthText, { color: rule.strength === 'strict' ? BLOCKED_COLOR : '#95681F' }]}>
                  {rule.strength === 'strict' ? 'STRICT' : 'LOOSE'}
                </Text>
              </Animated.View>
            )}
          </View>

          <View style={s.cardMetaRow}>
            <GroupMeta
              nativeAvailable={nativeAvailable}
              selectionId={selectionId}
              previewCount={previewCount}
              individualCount={(rule.appRules ?? []).length}
            />
            {/* The share used to need its own bar under the card; the seal's
                ring carries it now, so this is just the number. */}
            {mode === 'limit' && goalMinutes != null && (
              <Text style={[s.cardShare, { color: accent }]} numberOfLines={1}>· {sharePercent}%</Text>
            )}
            {mode === 'blocked' && <Text style={s.cardClosed} numberOfLines={1}>· closed all day</Text>}
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

      {/* Custom groups can be taken off the plan. It used to be a floating bin
          over the card's corner, a tap away from opening the rule by mistake. */}
      {custom && (
        <View style={s.removeRow}>
          <View style={s.removeRule} />
          <TouchableOpacity style={s.removeButton} onPress={onRemove} hitSlop={6} haptic="selection" activeOpacity={0.7}>
            <Trash2 s={12} c={C.textMuted} w={2} />
            <Text style={s.removeText}>REMOVE GROUP</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

function AlwaysBlockedGroupCard({
  appCount,
  appNames,
  index,
  onPress,
}: {
  appCount: number;
  appNames: string[];
  index: number;
  onPress: () => void;
}) {
  if (appCount <= 0) return null;
  const visibleNames = appNames.slice(0, 2);
  const remaining = Math.max(0, appCount - visibleNames.length);
  const summary = visibleNames.length > 0
    ? `${visibleNames.join(', ')}${remaining > 0 ? ` +${remaining}` : ''}`
    : `${appCount} private ${appCount === 1 ? 'app' : 'apps'}`;

  // The same register the Focus screen's rows and the Always Blocked sheet are
  // cut from — one recognisable object wherever a standing boundary is named.
  return (
    <Animated.View layout={CARD_LAYOUT}>
      <ProtectionRegisterCard
        tone={REGISTER_TONES.rose}
        icon={<Lock s={19} c={BLOCKED_COLOR} w={2.3} />}
        title="Always Blocked"
        detail={summary}
        chipLabel="Blocked"
        index={index}
        onPress={onPress}
        accessibilityLabel={`Always Blocked, ${appCount} ${appCount === 1 ? 'app' : 'apps'}. Opens the Always Blocked settings.`}
      />
    </Animated.View>
  );
}

// The section's own seal, built like a group's: a disc ringed by how much of
// the goal is already spoken for. The board reads as one family — every row,
// including this one, is a face in a ring.
function CapacitySeal({ fraction, full }: { fraction: number; full: boolean }) {
  const reduceMotion = useReducedMotion();
  const size = 52;
  const ringSize = size + 11;
  const radius = (ringSize - 3) / 2;
  const circumference = 2 * Math.PI * radius;
  const accent = full ? BLOCKED_COLOR : C.goldDark;
  const target = Math.max(0, Math.min(1, fraction));
  const progress = useSharedValue(reduceMotion ? target : 0);

  useEffect(() => {
    progress.value = reduceMotion ? target : withTiming(target, GLIDE);
  }, [progress, reduceMotion, target]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={{ width: ringSize, height: ringSize, alignItems: 'center', justifyContent: 'center' }}>
      <Svg pointerEvents="none" width={ringSize} height={ringSize} style={StyleSheet.absoluteFill}>
        <Circle
          cx={ringSize / 2}
          cy={ringSize / 2}
          r={radius}
          stroke={accent}
          strokeOpacity={0.16}
          strokeWidth={2.6}
          fill="none"
        />
        <AnimatedCircle
          animatedProps={arcProps}
          cx={ringSize / 2}
          cy={ringSize / 2}
          r={radius}
          stroke={accent}
          strokeWidth={2.6}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
        />
      </Svg>
      <View style={[s.capacityDisc, { width: size, height: size, borderRadius: size / 2, borderColor: withAlpha(accent, 0.28) }]}>
        {/* One text block so the number and its unit share a baseline and center
            as a whole; the small optical nudge left balances the wider '%'. */}
        <Text style={[s.capacityDiscValue, { color: accent }]} numberOfLines={1}>
          {Math.round(target * 100)}<Text style={s.capacityDiscUnit}>%</Text>
        </Text>
      </View>
    </View>
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
  // 80% is a recommendation, not a ceiling. Everything the card states is
  // measured against the whole Goal — the buffer is shown, never subtracted, so
  // "still free" and the almanac's "Free" are always the same number.
  const recommended = goalMinutes == null ? null : Math.round(goalMinutes * 0.8);
  const free = goalMinutes == null ? null : Math.max(0, goalMinutes - planned);
  const pastBuffer = recommended != null && planned > recommended;
  const full = goalMinutes != null && planned >= goalMinutes;

  const segments = useMemo(() => {
    let consumed = 0;
    return groups.map(([groupId, minutes]) => {
      const left = consumed / scale;
      consumed += minutes;
      return { groupId, left, width: Math.max(0, Math.min(1 - left, minutes / scale)) };
    });
  }, [groups, scale]);

  const plannedFraction = goalMinutes == null || goalMinutes === 0 ? 0 : planned / goalMinutes;

  return (
    <View style={s.meterCard}>
      <LinearGradient
        colors={['#FFFDF8', '#FDF8EC', '#FFFDF7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <RuleWeave color="#8A6A2F" />

      {/* The head reads like a group row: a seal on the left carrying the % of
          the goal spoken for, the copy beside it. */}
      <View style={s.meterHead}>
        <CapacitySeal fraction={plannedFraction} full={full} />
        <View style={s.meterHeadCopy}>
          <Text style={s.meterKicker}>PLANNING CAPACITY</Text>
          <Text style={s.meterTitle}>
            {goalMinutes == null
              ? 'Set a Goal first.'
              : free != null && free > 0
                ? `${formatMinutesShort(free)} still free`
                : 'Every minute is planned'}
          </Text>
          {/* The advice first, then one short line of why: rules only govern
              their own groups, so the minutes outside them land on the Goal
              uncounted. */}
          <Text style={s.meterBody}>Leave 20% unplanned. Essentials and overruns take time no rule covers.</Text>
        </View>
      </View>

      {/* Just the bar now: each group's colour filling toward the Goal tick,
          Tolerance shaded past it. The 80%/GOAL chips and the 0…locked axis are
          gone — the almanac below names every number, so the rail only has to
          show the shape. */}
      <View style={s.rail} onLayout={event => setRailWidth(event.nativeEvent.layout.width)}>
        {/* The recommended buffer (last fifth of the Goal) is shaded warm gold,
            the overflow past the Goal grey — you can see the fifth to leave free
            instead of being told a number that fights the almanac. */}
        {goalMinutes != null && recommended != null && railWidth > 0 && (
          <View style={[s.bufferZone, {
            left: (recommended / scale) * railWidth,
            width: Math.max(0, ((goalMinutes - recommended) / scale) * railWidth),
          }]} />
        )}
        {goalMinutes != null && lockAtMinutes != null && railWidth > 0 && lockAtMinutes > goalMinutes && (
          <View style={[s.toleranceZone, { left: (goalMinutes / scale) * railWidth }]} />
        )}
        {railWidth > 0 && segments.map(segment => (
          <RailSegment
            key={segment.groupId}
            left={segment.left * railWidth}
            width={segment.width * railWidth}
            color={(CATEGORY_TINTS[segment.groupId] ?? { color: C.goldDark }).color}
          />
        ))}
        {/* A glass sheen across the whole bar for a little depth. */}
        <LinearGradient
          colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0)']}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={s.railSheen}
          pointerEvents="none"
        />
        {goalMinutes != null && railWidth > 0 && (
          /* The Goal boundary: a haloed tick so it reads on any segment. */
          <View style={[s.goalMarker, { left: (goalMinutes / scale) * railWidth - 1.25 }]} />
        )}
      </View>

      {pastBuffer && (
        <Animated.View entering={FadeIn.duration(240)} style={[s.warning, full && s.warningStrong]}>
          <AlertTriangle s={14} c={full ? BLOCKED_COLOR : '#A36F2B'} w={2.2} />
          <Text style={[s.warningText, full && s.warningTextStrong]}>
            {full
              ? 'Every minute is planned. Leave a little free, or a long day breaks the streak.'
              : 'You’re into the last fifth. Leaving it free makes the Goal easier to keep.'}
          </Text>
        </Animated.View>
      )}

      {/* The tally is the card's footer: a solid parchment band, full bleed to
          the card's edges, each figure set under its name. Keep it last — it
          swallows the card's bottom padding. */}
      <View style={s.tallyBand}>
        <TallyColumn
          label="Planned"
          value={formatMinutesShort(planned)}
          color={full ? BLOCKED_COLOR : C.goldDark}
          emphasis
        />
        <View style={s.tallyDivider} />
        <TallyColumn
          label="Free"
          value={free == null ? '—' : formatMinutesShort(free)}
          color={full ? BLOCKED_COLOR : '#5C7A63'}
        />
        <View style={s.tallyDivider} />
        <TallyColumn
          label="Goal"
          value={goalMinutes == null ? '—' : formatMinutesShort(goalMinutes)}
          color="#2D2923"
        />
      </View>
    </View>
  );
}

// One entry of the capacity tally: the name in small caps, its figure beneath.
// No beads — the solid band carries the register on its own.
function TallyColumn({
  label,
  value,
  color,
  emphasis = false,
}: {
  label: string;
  value: string;
  color: string;
  emphasis?: boolean;
}) {
  return (
    <View style={s.tallyColumn}>
      <Text style={s.tallyLabel} numberOfLines={1}>{label}</Text>
      <Text style={[s.tallyValue, emphasis && s.tallyValueEmphasis, { color }]} numberOfLines={1}>{value}</Text>
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
  alwaysBlockedAppCount,
  alwaysBlockedAppNames,
  resolveGroupName,
  nativeAvailable,
  selectionIdForGroup,
  onOpenRule,
  onRemoveGroup,
  onAddGroup,
  onOpenAlwaysBlocked,
}: {
  goalMinutes: number | null;
  lockAtMinutes: number | null;
  rules: GroupRule[];
  groupIds: string[];
  customGroupIds: string[];
  groupAppCounts: Record<string, number>;
  alwaysBlockedAppCount: number;
  alwaysBlockedAppNames: string[];
  resolveGroupName: (groupId: string) => string;
  nativeAvailable: boolean;
  selectionIdForGroup: (groupId: string) => string;
  onOpenRule: (groupId: string) => void;
  onRemoveGroup: (groupId: string) => void;
  onAddGroup: () => void;
  onOpenAlwaysBlocked: () => void;
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
        <Text style={s.headerBody}>Plan app usage</Text>
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
        <AlwaysBlockedGroupCard
          appCount={alwaysBlockedAppCount}
          appNames={alwaysBlockedAppNames}
          index={groupIds.length}
          onPress={onOpenAlwaysBlocked}
        />
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
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E7D9B9',
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 11,
    gap: 12,
    boxShadow: '0 8px 24px rgba(45, 40, 33, 0.055)',
  },
  meterHead: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  meterHeadCopy: { flex: 1, minWidth: 0 },
  meterKicker: { fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 2.2, color: C.goldDark },
  meterTitle: { marginTop: 4, fontFamily: F.serifSemiBold, fontSize: 21, lineHeight: 24, letterSpacing: -0.3, color: C.text },
  meterBody: { marginTop: 3, fontFamily: F.serifMedium, fontSize: 14, lineHeight: 18, color: '#6A625A' },
  capacityDisc: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, backgroundColor: 'rgba(255,253,247,0.7)' },
  capacityDiscValue: { paddingLeft: 3, fontFamily: F.serifBold, fontSize: 19, lineHeight: 21, textAlign: 'center', textAlignVertical: 'center', includeFontPadding: false, fontVariant: ['tabular-nums'] },
  capacityDiscUnit: { fontFamily: F.serifSemiBold, fontSize: 10.5 },

  rail: { position: 'relative', height: 18, borderRadius: 9, borderCurve: 'continuous', backgroundColor: '#EFE8D8', overflow: 'hidden', boxShadow: 'inset 0 1px 2.5px rgba(63, 52, 30, 0.09)' },
  railSegment: { position: 'absolute', top: 2.5, bottom: 2.5, borderRadius: 6, borderCurve: 'continuous' },
  railSheen: { position: 'absolute', left: 0, right: 0, top: 0, height: 11 },
  // The recommended buffer (80% → Goal) reads warm gold; the overflow past the
  // Goal reads grey, the same grey the Your Day legend gives Tolerance.
  bufferZone: { position: 'absolute', top: 0, bottom: 0, backgroundColor: 'rgba(201,162,39,0.12)' },
  toleranceZone: { position: 'absolute', top: 0, bottom: 0, right: 0, backgroundColor: 'rgba(158,164,171,0.18)' },
  goalMarker: { position: 'absolute', top: 1.5, bottom: 1.5, width: 2.5, borderRadius: 1.5, backgroundColor: '#2D2923', boxShadow: '0 0 0 1.5px rgba(255,255,255,0.55)' },
  railBottomLabels: { marginTop: 7, flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  railBottomText: { fontFamily: F.sansMedium, fontSize: 10.5, color: C.textMuted, fontVariant: ['tabular-nums'] },

  // The tally footer: a solid parchment strip, full bleed to the card's edges —
  // clearly its own ground against the gradient body above it.
  tallyBand: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 0,
    marginHorizontal: -16,
    marginBottom: -11,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F4EBD2',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2D2AC',
  },
  tallyColumn: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  tallyDivider: { width: StyleSheet.hairlineWidth, marginVertical: 4, backgroundColor: 'rgba(139,107,47,0.24)' },
  tallyValue: { fontFamily: F.serifBold, fontSize: 17.5, lineHeight: 21, fontVariant: ['tabular-nums'] },
  tallyValueEmphasis: { fontSize: 18.5, lineHeight: 22 },
  tallyLabel: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.3, textTransform: 'uppercase', color: '#8F8060' },

  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 14, borderCurve: 'continuous', backgroundColor: '#FFF4DC', paddingHorizontal: 12, paddingVertical: 10 },
  warningStrong: { backgroundColor: '#F9E8EB' },
  warningText: { flex: 1, fontFamily: F.sansMedium, fontSize: 11.5, lineHeight: 16, color: '#8D5C1E' },
  warningTextStrong: { color: '#8F3443' },

  cardStack: { marginTop: 12, gap: 7 },
  // The Always Blocked card's own styles moved to ProtectionRegister, which
  // now draws it here, on Home, and inside its sheet.
  card: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
    boxShadow: '0 6px 16px rgba(35, 40, 37, 0.055)',
  },
  // A closed group carries a rose edge down its left side — the same bar the
  // Essentials surface wears.
  closedEdge: { position: 'absolute', left: 0, top: 14, bottom: 14, width: 3.5, borderTopRightRadius: 3, borderBottomRightRadius: 3, backgroundColor: BLOCKED_COLOR, opacity: 0.85 },
  // Two blooms so the colour never hits a seam: a wide, faint wash spanning the
  // whole card that fades to nothing before the right edge, and a tighter,
  // brighter pool centred on the seal.
  cardWashBloom: { position: 'absolute', left: -90, top: -46, width: 440, height: 170 },
  cardSealBloom: { position: 'absolute', left: -36, top: -44, width: 152, height: 164 },
  cardRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardBody: { flex: 1, minWidth: 0, paddingLeft: 3 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardName: { flexShrink: 1, fontFamily: F.serifSemiBold, fontSize: 17, lineHeight: 20, letterSpacing: -0.15, color: C.text },
  strengthMark: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  strengthDot: { width: 4.5, height: 4.5, borderRadius: 3 },
  strengthText: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 0.9 },
  cardMetaRow: { marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMeta: { flexShrink: 1, fontFamily: F.sans, fontSize: 11.5, lineHeight: 15.5, color: C.textSecondary },
  cardShare: { flexShrink: 0, fontFamily: F.sansSemiBold, fontSize: 11.5, lineHeight: 15.5, fontVariant: ['tabular-nums'] },
  cardClosed: { flexShrink: 0, fontFamily: F.sansSemiBold, fontSize: 11.5, lineHeight: 15.5, color: BLOCKED_COLOR },
  cardTail: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  valueChip: {
    minWidth: 56,
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E7E2D6',
    backgroundColor: '#F6F4EE',
    paddingHorizontal: 8,
    paddingVertical: 5.5,
    alignItems: 'center',
  },
  valueChipText: { fontFamily: F.serifSemiBold, fontSize: 14, lineHeight: 17, color: C.textSecondary, fontVariant: ['tabular-nums'] },

  removeRow: { marginTop: 6 },
  removeRule: { height: StyleSheet.hairlineWidth, backgroundColor: '#E7E3DA' },
  removeButton: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 7,
    paddingBottom: 1,
    paddingHorizontal: 4,
  },
  removeText: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.1, color: C.textMuted },

  addRow: {
    marginTop: 9,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 17,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D7C398',
    backgroundColor: '#FFF9EC',
  },
  addIcon: { width: 28, height: 28, borderRadius: 10, borderCurve: 'continuous', backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
  addText: { fontFamily: F.serifSemiBold, fontSize: 15.5, color: C.goldDark },
});
