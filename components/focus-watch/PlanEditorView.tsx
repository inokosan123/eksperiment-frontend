import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import ConfirmModal from '@/components/shared/ConfirmModal';
import {
  Candle,
  ChevronDown,
  ChevronRight,
  Clock,
  Moon,
  Plus,
  Sun,
  Trash2,
} from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import GoldButton from './GoldButton';
import TimeWheelSheet from './TimeWheelSheet';
import GroupLimitSheet from './GroupLimitSheet';
import LimitSlider, { limitStopLabel } from './LimitSlider';
import ZoneClock from './ZoneClock';
import { zoneTint } from './ZoneTimeline';
import { GroupEditorSheet } from './AppPicker';
import { appsInCategory, CATEGORY_TINTS, MOCK_APPS, type MockApp } from './focusContent';
import { SMOOTH_LAYOUT, SOFT_IN, SOFT_OUT } from './focusMotion';
import {
  APP_CATEGORIES,
  deleteCustomGroup,
  deleteDayPlan,
  formatMinutesShort,
  formatTimeOfDay,
  getDayPlanState,
  groupName,
  RETURN_PRACTICES,
  saveDayPlan,
  useDayPlan,
  zoneDurationMinutes,
  zonesOverlap,
  type GroupRule,
  type PlanZone,
  type Strength,
} from './dayPlanStore';

const enter = (delay: number) => FadeInDown.duration(420).delay(delay);
const SECTION_TRANSITION = SMOOTH_LAYOUT;

// Fresh-zone presets — offered as one-tap chips under the timeline.
const ZONE_CANDIDATES: Omit<PlanZone, 'id'>[] = [
  { name: 'Morning', startMinutes: 360, endMinutes: 540, closedGroupIds: ['social', 'news'] },
  { name: 'Day', startMinutes: 720, endMinutes: 840, closedGroupIds: ['games', 'entertainment'] },
  { name: 'Evening', startMinutes: 1260, endMinutes: 1380, closedGroupIds: ['social', 'entertainment', 'games'] },
  { name: 'Night', startMinutes: 1380, endMinutes: 360, closedGroupIds: APP_CATEGORIES.map(c => c.id) },
];

const BUDGET_STOPS: number[] = Array.from({ length: 15 }, (_, i) => 60 + i * 30);

const ZONE_PRESET_ICONS: Record<string, (color: string) => React.ReactNode> = {
  Morning: color => <Sun s={13} c={color} w={2.1} />,
  Day: color => <Clock s={13} c={color} w={2.1} />,
  Evening: color => <Candle s={13} c={color} w={2.1} />,
  Night: color => <Moon s={13} c={color} w={2.1} />,
};

function makeZoneId() {
  return `zone-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function ensureRules(rules: GroupRule[], groupIds: string[]): GroupRule[] {
  const existing = new Map(rules.map(rule => [rule.groupId, rule]));
  return groupIds.map(
    id =>
      existing.get(id) ?? ({ groupId: id, dailyMinutes: null, strength: 'loose', practice: 'prayer' } as GroupRule)
  );
}

// ---------------------------------------------------------------------------

export default function PlanEditorView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { planId } = useLocalSearchParams<{ planId?: string }>();
  const state = useDayPlan();

  const existing = useMemo(
    () => (planId ? getDayPlanState().plans.find(plan => plan.id === planId) : undefined),
    [planId]
  );

  const groupIds = useMemo(
    () => [...APP_CATEGORIES.map(category => category.id), ...state.customGroups.map(group => group.id)],
    [state.customGroups]
  );

  const [name, setName] = useState(existing?.name ?? '');
  const [zones, setZones] = useState<PlanZone[]>(existing?.zones ?? []);
  const [rules, setRules] = useState<GroupRule[]>(() =>
    ensureRules(existing?.rules ?? [], groupIds)
  );
  const [expandedZone, setExpandedZone] = useState<string | null>(null);
  const [timeTarget, setTimeTarget] = useState<{ zoneId: string; field: 'start' | 'end' } | null>(null);
  const [budget, setBudget] = useState<number>(existing?.budgetMinutes ?? 240);
  const [planStrength, setPlanStrength] = useState<Strength>(existing?.strength ?? 'loose');
  const [sheetGroupId, setSheetGroupId] = useState<string | null>(null);
  const [groupSheet, setGroupSheet] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Keep the rule list complete when custom groups appear or vanish.
  useEffect(() => {
    setRules(current => ensureRules(current, groupIds));
    setZones(current =>
      current.map(zone => ({
        ...zone,
        closedGroupIds: zone.closedGroupIds.filter(id => groupIds.includes(id)),
      }))
    );
  }, [groupIds]);

  const trimmedName = name.trim();
  const hasName = trimmedName.length > 0;
  const overlap = zonesOverlap(zones);
  const zeroZone = zones.some(zone => zone.startMinutes === zone.endMinutes);
  const canSave = hasName && !overlap && !zeroZone;

  const allocated = rules.reduce((sum, rule) => sum + (rule.dailyMinutes ?? 0), 0);
  const overBudget = budget != null && allocated > budget;
  const sortedRules = useMemo(
    () =>
      [...rules].sort(
        (a, b) => Number(b.dailyMinutes != null) - Number(a.dailyMinutes != null)
      ),
    [rules]
  );
  const sheetApps: MockApp[] = useMemo(() => {
    if (!sheetGroupId) return [];
    if (APP_CATEGORIES.some(category => category.id === sheetGroupId)) {
      return appsInCategory(sheetGroupId);
    }
    const group = state.customGroups.find(entry => entry.id === sheetGroupId);
    return (group?.appIds ?? [])
      .map(id => MOCK_APPS.find(app => app.id === id))
      .filter(Boolean) as MockApp[];
  }, [sheetGroupId, state.customGroups]);

  const addZone = () => {
    if (zones.length >= 4) return;
    const candidate =
      ZONE_CANDIDATES.find(entry => !zonesOverlap([...zones, entry as PlanZone])) ??
      ZONE_CANDIDATES[1];
    const zone: PlanZone = { ...candidate, id: makeZoneId(), closedGroupIds: [...candidate.closedGroupIds] };
    setZones(current => [...current, zone]);
    setExpandedZone(zone.id);
  };

  const updateZone = (zoneId: string, partial: Partial<PlanZone>) =>
    setZones(current =>
      current.map(zone => (zone.id === zoneId ? { ...zone, ...partial } : zone))
    );

  const removeZone = (zoneId: string) => {
    setZones(current => current.filter(zone => zone.id !== zoneId));
    if (expandedZone === zoneId) setExpandedZone(null);
  };

  const updateRule = (groupId: string, partial: Partial<GroupRule>) =>
    setRules(current =>
      current.map(rule => (rule.groupId === groupId ? { ...rule, ...partial } : rule))
    );

  const save = () => {
    saveDayPlan({
      id: existing?.id,
      name: trimmedName,
      budgetMinutes: budget,
      strength: planStrength,
      zones,
      rules,
    });
    router.back();
  };

  const timeZone = timeTarget ? zones.find(zone => zone.id === timeTarget.zoneId) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 190 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenTitleBar title={existing ? 'EDIT PLAN' : 'NEW PLAN'} showBack />

        <View style={{ paddingHorizontal: 16 }}>
          <Animated.View entering={enter(0)}>
            <Text style={s.sectionLabel}>NAME</Text>
            <View style={s.groupCard}>
              <TextInput
                style={s.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="Name this plan"
                placeholderTextColor={C.textMuted}
                maxLength={28}
                returnKeyType="done"
              />
            </View>
            {!hasName && <Text style={s.requiredText}>Name is required.</Text>}
          </Animated.View>

          <Animated.View entering={enter(40)}>
            <Text style={s.sectionLabel}>TIME BUDGET</Text>
            <View style={s.budgetCard}>
              <Text style={s.budgetValue}>{formatMinutesShort(budget)}</Text>
              <Text style={s.budgetCaption}>GIVEN TO THE PHONE · A DAY WITH THIS PLAN</Text>
              <LimitSlider
                value={budget}
                onChange={minutes => setBudget(minutes ?? 60)}
                stops={BUDGET_STOPS}
                edgeLabels={{ left: '1h', right: '8h' }}
              />

              <View style={s.strengthMiniRow}>
                {(['loose', 'strict'] as Strength[]).map(option => {
                  const selected = planStrength === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[s.miniPill, selected && s.miniPillOn]}
                      activeOpacity={0.85}
                      haptic="selection"
                      onPress={() => setPlanStrength(option)}
                    >
                      <Text style={[s.miniPillText, selected && s.miniPillTextOn]}>
                        {option === 'loose' ? 'Loose' : 'Strict'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <Text style={s.strengthCaption} numberOfLines={2}>
                  {planStrength === 'loose'
                    ? 'Doors may open through prayer — it costs the trophy.'
                    : 'What is closed stays closed.'}
                </Text>
              </View>

              {budget != null && (
                <>
                  <View style={s.allocBar}>
                    {sortedRules
                      .filter(rule => rule.dailyMinutes != null)
                      .map(rule => (
                        <View
                          key={rule.groupId}
                          style={{
                            width: `${Math.min(100, ((rule.dailyMinutes ?? 0) / budget) * 100)}%`,
                            backgroundColor: CATEGORY_TINTS[rule.groupId]?.color ?? C.gold,
                            opacity: 0.85,
                          }}
                        />
                      ))}
                  </View>
                  <Text style={[s.allocCaption, overBudget && { color: '#B54155' }]}>
                    {overBudget
                      ? `${formatMinutesShort(allocated - budget)} over the budget — take some back`
                      : allocated > 0
                        ? `${formatMinutesShort(allocated)} of ${formatMinutesShort(budget)} given · ${formatMinutesShort(budget - allocated)} still free`
                        : 'Nothing given yet — distribute it below.'}
                  </Text>
                </>
              )}
            </View>
          </Animated.View>

          {/* ---------------- ZONES ---------------- */}
          <Animated.View entering={enter(60)} layout={SECTION_TRANSITION}>
            <Text style={s.sectionLabel}>ZONES OF THE DAY</Text>

            <View style={s.timelineCard}>
              <ZoneClock zones={zones} />
              {zones.length === 0 && (
                <Text style={s.timelineEmpty}>
                  No zones yet — the whole day stays open, only daily limits stand.
                </Text>
              )}
            </View>

            {zones.length < 4 && (
              <TouchableOpacity style={s.addZoneCard} activeOpacity={0.75} onPress={() => addZone()}>
                <View style={s.addZoneIcon}>
                  <Plus s={14} c={C.goldDark} w={2.5} />
                </View>
                <Text style={s.addZoneText}>Add a zone</Text>
                <Text style={s.addZoneCount}>{zones.length}/4</Text>
              </TouchableOpacity>
            )}

            <Animated.View
              style={[s.groupCard, zones.length === 0 && { display: 'none' }]}
              layout={SECTION_TRANSITION}
            >
              {zones.map((zone, index) => {
                const tint = zoneTint(index);
                const isOpen = expandedZone === zone.id;
                const zoneInvalid = zone.startMinutes === zone.endMinutes;
                return (
                  <Animated.View key={zone.id} layout={SECTION_TRANSITION}>
                    {index > 0 && <View style={s.separator} />}
                    <TouchableOpacity
                      style={[s.zoneRow, isOpen && { backgroundColor: tint.soft }]}
                      activeOpacity={0.75}
                      onPress={() => setExpandedZone(isOpen ? null : zone.id)}
                    >
                      <View style={[s.zoneEdge, { backgroundColor: tint.bar }]} />
                      <View style={s.zoneIconBadge}>
                        {ZONE_PRESET_ICONS[zone.name]?.(tint.text) ?? (
                          <Clock s={13} c={tint.text} w={2.1} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.zoneName} numberOfLines={1}>
                          {zone.name || 'Unnamed zone'}
                        </Text>
                        <Text style={s.zoneMeta} numberOfLines={1}>
                          {`${formatTimeOfDay(zone.startMinutes)} – ${formatTimeOfDay(zone.endMinutes)} · ${
                            zone.closedGroupIds.length === 0
                              ? 'nothing closed'
                              : `${zone.closedGroupIds.length} closed`
                          }`}
                        </Text>
                      </View>
                      <View style={[s.chevron, isOpen && s.chevronOpen]}>
                        <ChevronDown s={16} c={C.textMuted} />
                      </View>
                    </TouchableOpacity>

                    {isOpen && (
                      <Animated.View entering={SOFT_IN} exiting={SOFT_OUT} style={s.zoneBody}>
                        <TextInput
                          style={s.zoneNameInput}
                          value={zone.name}
                          onChangeText={text => updateZone(zone.id, { name: text })}
                          placeholder="Zone name"
                          placeholderTextColor={C.textMuted}
                          maxLength={16}
                        />
                        <View style={s.timeRow}>
                          <TouchableOpacity
                            style={s.timeCell}
                            activeOpacity={0.8}
                            onPress={() => setTimeTarget({ zoneId: zone.id, field: 'start' })}
                          >
                            <Text style={s.timeCellLabel}>STARTS</Text>
                            <Text style={s.timeCellValue}>{formatTimeOfDay(zone.startMinutes)}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={s.timeCell}
                            activeOpacity={0.8}
                            onPress={() => setTimeTarget({ zoneId: zone.id, field: 'end' })}
                          >
                            <Text style={s.timeCellLabel}>ENDS</Text>
                            <Text style={s.timeCellValue}>{formatTimeOfDay(zone.endMinutes)}</Text>
                          </TouchableOpacity>
                        </View>
                        {!zoneInvalid && (
                          <Text style={s.zoneHint}>
                            {`Lasts ${formatMinutesShort(zoneDurationMinutes(zone))}`}
                            {zone.endMinutes <= zone.startMinutes
                              ? ' · crosses midnight, ends the next morning'
                              : ''}
                          </Text>
                        )}
                        {(() => {
                          const clash = zones.find(
                            other => other.id !== zone.id && zonesOverlap([zone, other])
                          );
                          return clash ? (
                            <Text style={s.zoneError}>
                              {`Overlaps ${clash.name || 'another zone'} — move the hours apart.`}
                            </Text>
                          ) : null;
                        })()}
                        {zoneInvalid && (
                          <Text style={s.zoneError}>
                            A zone cannot start and end at the same minute.
                          </Text>
                        )}

                        <Text style={s.zoneSubLabel}>CLOSED DURING THIS ZONE</Text>
                        <View style={s.closedWrap}>
                          {groupIds.map(groupId => {
                            const closed = zone.closedGroupIds.includes(groupId);
                            return (
                              <TouchableOpacity
                                key={groupId}
                                style={[s.closedChip, closed && s.closedChipOn]}
                                activeOpacity={0.8}
                                haptic="selection"
                                onPress={() =>
                                  updateZone(zone.id, {
                                    closedGroupIds: closed
                                      ? zone.closedGroupIds.filter(id => id !== groupId)
                                      : [...zone.closedGroupIds, groupId],
                                  })
                                }
                              >
                                <Text style={[s.closedChipText, closed && s.closedChipTextOn]}>
                                  {groupName(state, groupId)}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        <TouchableOpacity
                          style={s.removeZoneBtn}
                          activeOpacity={0.7}
                          onPress={() => removeZone(zone.id)}
                        >
                          <Text style={s.removeZoneText}>Remove this zone</Text>
                        </TouchableOpacity>
                      </Animated.View>
                    )}
                  </Animated.View>
                );
              })}

            </Animated.View>
            {overlap && <Text style={s.zoneError}>Two zones overlap — adjust their hours.</Text>}
          </Animated.View>

          {/* ---------------- DAILY LIMITS ---------------- */}
          <Animated.View entering={enter(120)} layout={SECTION_TRANSITION}>
            <Text style={s.sectionLabel}>DISTRIBUTE THE TIME</Text>

            <Animated.View style={s.groupCard} layout={SECTION_TRANSITION}>
              {sortedRules.map((rule, index) => {
                const custom = state.customGroups.some(group => group.id === rule.groupId);
                const limited = rule.dailyMinutes != null;
                const sliceCount = Object.keys(rule.appSplits ?? {}).length;
                const tint = CATEGORY_TINTS[rule.groupId] ?? { bg: C.goldLight, color: C.goldDark };
                const label = groupName(state, rule.groupId);
                const firstOff = !limited && (index === 0 || sortedRules[index - 1].dailyMinutes != null);
                return (
                  <Animated.View key={rule.groupId} layout={SECTION_TRANSITION}>
                    {firstOff ? (
                      <View style={s.offBand}>
                        <View style={s.offBandLine} />
                        <Text style={s.offBandText}>NOT LIMITED YET</Text>
                        <View style={s.offBandLine} />
                      </View>
                    ) : (
                      index > 0 && <View style={s.separator} />
                    )}
                    <TouchableOpacity
                      style={[s.limitRow, !limited && s.limitRowOff]}
                      activeOpacity={0.75}
                      onPress={() => setSheetGroupId(rule.groupId)}
                    >
                      <View
                        style={[
                          s.groupAvatar,
                          { backgroundColor: limited ? tint.bg : '#F4F3EE' },
                        ]}
                      >
                        <Text
                          style={[s.groupAvatarText, { color: limited ? tint.color : C.textMuted }]}
                        >
                          {label[0]}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={s.limitTitleRow}>
                          <Text
                            style={[s.ruleName, !limited && { color: C.textSecondary }]}
                            numberOfLines={1}
                          >
                            {label}
                          </Text>
                          {custom && (
                            <TouchableOpacity
                              activeOpacity={0.7}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              onPress={() => setGroupToDelete(rule.groupId)}
                            >
                              <Trash2 s={14} c={C.textMuted} w={2} />
                            </TouchableOpacity>
                          )}
                          <View style={[s.limitTag, limited ? s.limitTagOn : s.limitTagOff]}>
                            <Text
                              style={[
                                s.limitTagText,
                                limited ? s.limitTagTextOn : s.limitTagTextOff,
                              ]}
                            >
                              {limited ? `${limitStopLabel(rule.dailyMinutes)}/day` : 'Off'}
                            </Text>
                          </View>
                          <ChevronRight s={15} c={C.textMuted} />
                        </View>
                        {limited && (
                          <>
                            <View style={s.shareTrack}>
                              <View
                                style={[
                                  s.shareFill,
                                  {
                                    backgroundColor: tint.color,
                                    width: `${Math.min(100, ((rule.dailyMinutes ?? 0) / budget) * 100)}%`,
                                  },
                                ]}
                              />
                            </View>
                            <Text style={s.limitSub} numberOfLines={1}>
                              {`${Math.round(((rule.dailyMinutes ?? 0) / budget) * 100)}% of the budget · ${
                                rule.strength === 'strict' ? 'Strict' : 'Loose'
                              } · ${
                                RETURN_PRACTICES.find(entry => entry.id === rule.practice)?.name ?? ''
                              }${
                                sliceCount > 0
                                  ? ` · ${sliceCount} ${sliceCount === 1 ? 'app sliced' : 'apps sliced'}`
                                  : ''
                              }`}
                            </Text>
                          </>
                        )}
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}

              <View style={s.separator} />
              <TouchableOpacity
                style={s.addZoneRow}
                activeOpacity={0.75}
                onPress={() => setGroupSheet(true)}
              >
                <View style={s.addZoneIcon}>
                  <Plus s={13} c={C.goldDark} w={2.6} />
                </View>
                <Text style={s.addZoneText}>New app group</Text>
              </TouchableOpacity>
            </Animated.View>
            <Text style={s.helperText}>
              Apps outside these groups are never touched — mail, calls and messages stay free.
            </Text>
          </Animated.View>
        </View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 10) + 10 }]}>
        <GoldButton
          label={existing ? 'Save changes' : 'Set the plan'}
          disabled={!canSave}
          onPress={save}
        />
        {existing && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setConfirmDelete(true)}
            style={s.removeBtn}
          >
            <Text style={s.removeText}>Remove this plan</Text>
          </TouchableOpacity>
        )}
      </View>

      <GroupLimitSheet
        rule={rules.find(rule => rule.groupId === sheetGroupId) ?? null}
        groupLabel={sheetGroupId ? groupName(state, sheetGroupId) : ''}
        apps={sheetApps}
        planStrength={planStrength}
        onChange={partial => {
          if (sheetGroupId) updateRule(sheetGroupId, partial);
        }}
        onClose={() => setSheetGroupId(null)}
      />

      <TimeWheelSheet
        visible={timeTarget !== null}
        title={timeTarget?.field === 'start' ? 'Starts at' : 'Ends at'}
        minutes={
          timeTarget && timeZone
            ? timeTarget.field === 'start'
              ? timeZone.startMinutes
              : timeZone.endMinutes
            : 0
        }
        onClose={() => setTimeTarget(null)}
        onSave={minutes => {
          if (!timeTarget) return;
          updateZone(
            timeTarget.zoneId,
            timeTarget.field === 'start' ? { startMinutes: minutes } : { endMinutes: minutes }
          );
        }}
      />

      <GroupEditorSheet visible={groupSheet} onClose={() => setGroupSheet(false)} />

      <ConfirmModal
        visible={groupToDelete !== null}
        icon={<Trash2 s={22} c={C.red} w={2} />}
        title="Delete this group?"
        body="Plans using it will simply stop including it."
        subject={state.customGroups.find(group => group.id === groupToDelete)?.name}
        confirmLabel="DELETE"
        onCancel={() => setGroupToDelete(null)}
        onConfirm={() => {
          if (groupToDelete) deleteCustomGroup(groupToDelete);
          setGroupToDelete(null);
        }}
      />

      <ConfirmModal
        visible={confirmDelete}
        icon={<Trash2 s={22} c={C.red} w={2} />}
        title="Remove this plan?"
        body="Its zones and limits will be gone. Days it guarded stay in your history."
        subject={existing?.name}
        confirmLabel="REMOVE"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          if (existing) {
            deleteDayPlan(existing.id);
            router.back();
          }
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  sectionLabel: {
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 10,
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: C.textMuted,
  },
  groupCard: {
    backgroundColor: C.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
    marginLeft: 16,
  },
  nameInput: {
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontFamily: F.serifMedium,
    fontSize: 22,
    color: C.text,
  },
  requiredText: {
    marginTop: 7,
    marginHorizontal: 10,
    fontFamily: F.sansMedium,
    fontSize: 11,
    color: C.red,
  },
  helperText: {
    marginTop: 9,
    marginHorizontal: 10,
    fontFamily: F.sans,
    fontSize: 11,
    lineHeight: 16,
    color: C.textMuted,
  },

  timelineCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  timelineEmpty: {
    marginTop: 8,
    fontFamily: F.sans,
    fontSize: 11,
    lineHeight: 15,
    color: C.textMuted,
    textAlign: 'center',
  },

  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  zoneEdge: {
    position: 'absolute',
    left: 0,
    top: 7,
    bottom: 7,
    width: 4,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  zoneIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(28,25,23,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneName: {
    fontFamily: F.serifMedium,
    fontSize: 18,
    color: C.text,
  },
  zoneMeta: {
    marginTop: 2,
    fontFamily: F.sansMedium,
    fontSize: 12,
    color: C.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  chevron: {
    transform: [{ rotate: '0deg' }],
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  zoneBody: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  zoneNameInput: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#FDFDFB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: F.serifMedium,
    fontSize: 19,
    color: C.text,
  },
  timeRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  timeCell: {
    flex: 1,
    backgroundColor: '#FDFDFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 11,
    alignItems: 'center',
  },
  timeCellLabel: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 1.8,
    color: C.textMuted,
  },
  timeCellValue: {
    marginTop: 5,
    fontFamily: F.serifSemiBold,
    fontSize: 24,
    color: C.text,
    fontVariant: ['tabular-nums'],
  },
  zoneHint: {
    marginTop: 8,
    fontFamily: F.sans,
    fontSize: 10.5,
    color: C.textMuted,
  },
  zoneError: {
    marginTop: 8,
    marginHorizontal: 10,
    fontFamily: F.sansMedium,
    fontSize: 11,
    color: C.red,
  },
  zoneSubLabel: {
    marginTop: 13,
    marginBottom: 7,
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.8,
    color: C.textMuted,
  },
  closedWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  closedChip: {
    paddingHorizontal: 11,
    paddingVertical: 6.5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  closedChipOn: {
    borderColor: '#EFC4CC',
    backgroundColor: '#FBE6E9',
  },
  closedChipText: {
    fontFamily: F.sansMedium,
    fontSize: 12.5,
    color: C.textSecondary,
  },
  closedChipTextOn: {
    fontFamily: F.sansSemiBold,
    color: '#B54155',
  },
  removeZoneBtn: {
    alignSelf: 'center',
    marginTop: 13,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  removeZoneText: {
    fontFamily: F.sansMedium,
    fontSize: 12,
    color: C.red,
  },
  addZoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 20,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: '#E6D9B8',
    backgroundColor: '#FFFDF6',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  addZoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  addZoneIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.goldLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addZoneText: {
    flex: 1,
    fontFamily: F.serifMedium,
    fontSize: 15.5,
    color: C.textSecondary,
  },
  addZoneCount: {
    fontFamily: F.sansMedium,
    fontSize: 11,
    color: C.textMuted,
    fontVariant: ['tabular-nums'],
  },

  budgetCard: {
    backgroundColor: C.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingTop: 13,
    paddingBottom: 11,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  budgetValue: {
    fontFamily: F.serifSemiBold,
    fontSize: 38,
    lineHeight: 42,
    color: C.goldDark,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  budgetCaption: {
    marginTop: 2,
    marginBottom: 4,
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 1.9,
    color: C.textMuted,
    textAlign: 'center',
  },
  allocBar: {
    marginTop: 10,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#F0EEE8',
    overflow: 'hidden',
    flexDirection: 'row',
  },
  allocCaption: {
    marginTop: 6,
    fontFamily: F.sansMedium,
    fontSize: 11.5,
    color: C.textSecondary,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  limitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  limitRowOff: {
    paddingVertical: 10,
  },
  limitTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  groupAvatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupAvatarText: {
    fontFamily: F.sansBold,
    fontSize: 14.5,
  },
  shareTrack: {
    marginTop: 7,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#F0EEE8',
    overflow: 'hidden',
  },
  shareFill: {
    height: '100%',
    borderRadius: 2.5,
    opacity: 0.8,
  },
  limitSub: {
    marginTop: 5,
    fontFamily: F.sans,
    fontSize: 11.5,
    color: C.textMuted,
    fontVariant: ['tabular-nums'],
  },
  offBand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#FBFAF7',
  },
  offBandLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E2DA',
  },
  offBandText: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 1.8,
    color: C.textMuted,
  },
  ruleName: {
    flex: 1,
    fontFamily: F.serifMedium,
    fontSize: 17.5,
    color: C.text,
  },
  limitTag: {
    minWidth: 56,
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  limitTagOn: {
    backgroundColor: C.goldLight,
  },
  limitTagOff: {
    backgroundColor: '#F4F3EE',
  },
  limitTagText: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
  },
  limitTagTextOn: {
    color: C.goldDark,
  },
  limitTagTextOff: {
    color: C.textMuted,
  },
  strengthMiniRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1.2,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  miniPillOn: {
    borderColor: C.gold,
    backgroundColor: C.goldBg,
  },
  miniPillText: {
    fontFamily: F.sansSemiBold,
    fontSize: 12,
    color: C.textSecondary,
  },
  miniPillTextOn: {
    color: C.goldDark,
  },
  strengthCaption: {
    flex: 1,
    marginLeft: 4,
    fontFamily: F.sans,
    fontSize: 10,
    lineHeight: 13,
    color: C.textMuted,
  },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: 'rgba(252,252,252,0.96)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  removeBtn: {
    marginTop: 11,
    alignItems: 'center',
  },
  removeText: {
    fontFamily: F.sansSemiBold,
    fontSize: 13,
    color: C.red,
  },
});
