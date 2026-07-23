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
import { AlertTriangle, ChevronRight, Lock, Plus, Trash2 } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
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

      {mode === 'blocked' && <View style={s.closedEdge} />}

      <TouchableOpacity style={s.cardRow} onPress={onPress} activeOpacity={0.74} haptic="selection">
        <GroupSeal
          groupId={rule.groupId}
          name={name}
          size={46}
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
}: {
  appCount: number;
  appNames: string[];
  index: number;
}) {
  if (appCount <= 0) return null;
  const visibleNames = appNames.slice(0, 2);
  const remaining = Math.max(0, appCount - visibleNames.length);
  const summary = visibleNames.length > 0
    ? `${visibleNames.join(', ')}${remaining > 0 ? ` +${remaining}` : ''}`
    : `${appCount} private ${appCount === 1 ? 'app' : 'apps'}`;

  return (
    <Animated.View
      entering={FadeInDown.duration(360).delay(index * 55).easing(Easing.out(Easing.cubic))}
      layout={CARD_LAYOUT}
      style={[s.card, s.systemCard]}
      accessibilityRole="summary"
      accessibilityLabel={`Always Blocked, ${appCount} ${appCount === 1 ? 'app' : 'apps'}, no plan limit controls`}
    >
      <LinearGradient
        colors={['#F8E7EA', '#FFFAFB', '#FFFDFD']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <RuleWeave color={BLOCKED_COLOR} />

      <View style={s.closedEdge} />

      <View style={s.cardRow}>
        <View style={s.systemSeal}>
          <Lock s={21} c={BLOCKED_COLOR} w={2.3} />
        </View>
        <View style={s.cardBody}>
          <View style={s.cardTitleRow}>
            <Text style={s.cardName} numberOfLines={1}>Always Blocked</Text>
            <View style={s.systemBadge}><Text style={s.systemBadgeText}>SYSTEM</Text></View>
          </View>
          <View style={s.cardMetaRow}>
            <Text style={s.cardMeta} numberOfLines={1}>{summary}</Text>
          </View>
        </View>
        <View style={[s.valueChip, s.systemValueChip]}>
          <Text style={[s.valueChipText, s.systemValueText]}>Blocked</Text>
        </View>
      </View>
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

  const free = goalMinutes == null ? null : Math.max(0, goalMinutes - planned);
  const capacityLeft = capacity == null ? null : Math.max(0, capacity - planned);

  return (
    <View style={s.meterCard}>
      <LinearGradient
        colors={['#FFFDF8', '#FDF8EC', '#FFFDF7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <RuleWeave color="#8A6A2F" />

      <View style={s.meterHead}>
        <Text style={s.meterKicker}>PLANNING CAPACITY</Text>
        <Text style={s.meterTitle}>
          {capacity == null
            ? 'Set a Goal first.'
            : capacityLeft != null && capacityLeft > 0
              ? `${formatMinutesShort(capacityLeft)} left to divide`
              : 'Every minute is spoken for'}
        </Text>
        <Text style={s.meterBody}>Plan 80% of the Goal. The rest stays free for real life.</Text>
      </View>

      <View style={s.railBlock}>
        {goalMinutes != null && railWidth > 0 && (
          <View style={s.markerRow} pointerEvents="none">
            <View style={[s.marker, { left: Math.max(0, (goalMinutes * 0.8 / scale) * railWidth - 16) }]}>
              <Text style={s.markerText}>80%</Text>
              <View style={s.markerGem} />
            </View>
            <View style={[s.marker, { left: Math.min(railWidth - 32, Math.max(0, (goalMinutes / scale) * railWidth - 16)) }]}>
              <Text style={[s.markerText, s.markerTextGoal]}>GOAL</Text>
              <View style={[s.markerGem, s.markerGemGoal]} />
            </View>
          </View>
        )}
        <View style={s.rail} onLayout={event => setRailWidth(event.nativeEvent.layout.width)}>
          {/* Past the Goal the rail is Tolerance, not capacity — it gets the
              same grey the Your Day legend gives that time. */}
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

      {/* The tally, read between two gold hairlines — the same almanac band the
          Your Day card ends on. */}
      <View style={s.tallyBand}>
        <View style={s.tallyRule} />
        <View style={s.tallyRow}>
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
        <View style={s.tallyRule} />
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

// One column of the capacity tally: a coloured bead, the value in serif, the
// name beneath.
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
      <View style={s.tallyHalo}>
        <View style={[s.tallyHaloRing, { borderColor: color }, emphasis && s.tallyHaloRingEmphasis]} pointerEvents="none" />
        <View style={[s.tallyBead, { backgroundColor: color }]} />
      </View>
      <Text style={[s.tallyValue, emphasis && s.tallyValueEmphasis, { color }]}>{value}</Text>
      <Text style={s.tallyLabel}>{label}</Text>
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
    paddingTop: 15,
    paddingBottom: 14,
    gap: 14,
    boxShadow: '0 8px 24px rgba(45, 40, 33, 0.055)',
  },
  meterHead: { alignItems: 'center' },
  meterKicker: { fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 2.2, color: C.goldDark },
  meterTitle: { marginTop: 5, fontFamily: F.serifSemiBold, fontSize: 21.5, lineHeight: 25, letterSpacing: -0.25, textAlign: 'center', color: C.text },
  meterBody: { marginTop: 4, maxWidth: 290, fontFamily: F.serifMedium, fontSize: 14.5, lineHeight: 19, textAlign: 'center', color: '#6A625A' },

  railBlock: { position: 'relative', paddingTop: 20 },
  markerRow: { position: 'absolute', left: 0, right: 0, top: 0, height: 20, zIndex: 2 },
  marker: { position: 'absolute', top: 0, width: 32, alignItems: 'center' },
  markerText: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 0.9, color: C.goldDark },
  markerTextGoal: { color: '#2D2923' },
  markerGem: { width: 4.2, height: 4.2, marginTop: 3, backgroundColor: C.goldDark, opacity: 0.8, transform: [{ rotate: '45deg' }] },
  markerGemGoal: { backgroundColor: '#2D2923', opacity: 0.9 },
  rail: { position: 'relative', height: 20, borderRadius: 10, borderCurve: 'continuous', backgroundColor: '#F0EADC', overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(63, 52, 30, 0.07)' },
  railSegment: { position: 'absolute', top: 2.5, bottom: 2.5, borderRadius: 7, borderCurve: 'continuous' },
  toleranceZone: { position: 'absolute', top: 0, bottom: 0, right: 0, backgroundColor: 'rgba(158,164,171,0.16)' },
  railMarker: { position: 'absolute', top: 0, bottom: 0, width: 1.5, borderRadius: 1 },
  capacityMarker: { backgroundColor: C.goldDark, opacity: 0.55 },
  goalMarker: { width: 2, backgroundColor: '#2D2923' },
  hardMarker: { width: 3, backgroundColor: BLOCKED_COLOR },
  railBottomLabels: { marginTop: 7, flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  railBottomText: { fontFamily: F.sansMedium, fontSize: 10.5, color: C.textMuted, fontVariant: ['tabular-nums'] },

  // The capacity tally, read between two gold hairlines.
  tallyBand: { marginTop: 1 },
  tallyRule: { height: StyleSheet.hairlineWidth, backgroundColor: '#E4D7BB' },
  tallyRow: { flexDirection: 'row', alignItems: 'stretch', paddingVertical: 11 },
  tallyColumn: { flex: 1, alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  tallyDivider: { width: StyleSheet.hairlineWidth, marginVertical: 3, backgroundColor: '#EDE3CE' },
  tallyHalo: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  tallyHaloRing: { ...StyleSheet.absoluteFillObject, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth, opacity: 0.38 },
  tallyHaloRingEmphasis: { opacity: 0.72 },
  tallyBead: { width: 6, height: 6, borderRadius: 3 },
  tallyValue: { fontFamily: F.serifBold, fontSize: 18, lineHeight: 21, fontVariant: ['tabular-nums'] },
  tallyValueEmphasis: { fontSize: 20, lineHeight: 23 },
  tallyLabel: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.1, textTransform: 'uppercase', color: '#9C9081' },

  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 14, borderCurve: 'continuous', backgroundColor: '#FFF4DC', paddingHorizontal: 12, paddingVertical: 10 },
  warningStrong: { backgroundColor: '#F9E8EB' },
  warningText: { flex: 1, fontFamily: F.sansMedium, fontSize: 11.5, lineHeight: 16, color: '#8D5C1E' },
  warningTextStrong: { color: '#8F3443' },

  cardStack: { marginTop: 12, gap: 9 },
  systemCard: { borderColor: '#E7C4CB' },
  systemSeal: {
    flexShrink: 0,
    width: 46,
    height: 46,
    marginHorizontal: 5.5,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(162,67,81,0.3)',
    backgroundColor: '#FBE9EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  systemBadge: { borderRadius: 999, borderWidth: 1, borderColor: '#E7C4CB', backgroundColor: '#FFF7F8', paddingHorizontal: 7, paddingVertical: 3 },
  systemBadgeText: { fontFamily: F.sansBold, fontSize: 7.5, letterSpacing: 1.1, color: BLOCKED_COLOR },
  systemValueChip: { backgroundColor: BLOCKED_TINT, borderColor: '#E7C4CB' },
  systemValueText: { color: BLOCKED_COLOR },
  card: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 21,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    boxShadow: '0 6px 16px rgba(35, 40, 37, 0.055)',
  },
  // A closed group carries a rose edge down its left side — the same bar the
  // Essentials surface wears.
  closedEdge: { position: 'absolute', left: 0, top: 14, bottom: 14, width: 3.5, borderTopRightRadius: 3, borderBottomRightRadius: 3, backgroundColor: BLOCKED_COLOR, opacity: 0.85 },
  cardRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardBody: { flex: 1, minWidth: 0, paddingLeft: 3 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardName: { flexShrink: 1, fontFamily: F.serifSemiBold, fontSize: 18.5, lineHeight: 22, letterSpacing: -0.15, color: C.text },
  strengthMark: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  strengthDot: { width: 4.5, height: 4.5, borderRadius: 3 },
  strengthText: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 0.9 },
  cardMetaRow: { marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMeta: { flexShrink: 1, fontFamily: F.sans, fontSize: 11.5, lineHeight: 15.5, color: C.textSecondary },
  cardShare: { flexShrink: 0, fontFamily: F.sansSemiBold, fontSize: 11.5, lineHeight: 15.5, fontVariant: ['tabular-nums'] },
  cardClosed: { flexShrink: 0, fontFamily: F.sansSemiBold, fontSize: 11.5, lineHeight: 15.5, color: BLOCKED_COLOR },
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

  removeRow: { marginTop: 8 },
  removeRule: { height: StyleSheet.hairlineWidth, backgroundColor: '#E7E3DA' },
  removeButton: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    paddingBottom: 1,
    paddingHorizontal: 4,
  },
  removeText: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.1, color: C.textMuted },

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
