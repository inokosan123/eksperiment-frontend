import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import ConfirmModal from '@/components/shared/ConfirmModal';
import {
  Book,
  ChevronDown,
  Cross,
  Feather,
  Flame,
  OpenBook,
  Plus,
  Trash2,
} from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import GoldButton from './GoldButton';
import TimeWheelSheet from './TimeWheelSheet';
import PlanWizardSheet from './PlanWizardSheet';
import ZoneTimeline, { zoneTint } from './ZoneTimeline';
import { GroupEditorSheet } from './AppPicker';
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
  ZONE_NAME_SUGGESTIONS,
  zonesOverlap,
  type GroupRule,
  type PlanZone,
  type PracticeKind,
  type Strength,
} from './dayPlanStore';

const enter = (delay: number) => FadeInDown.duration(420).delay(delay);
const SECTION_TRANSITION = SMOOTH_LAYOUT;

const MINUTE_OPTIONS: (number | null)[] = [null, 15, 30, 45, 60, 90, 120, 180];

const PRACTICE_ICONS: Record<PracticeKind, (color: string) => React.ReactNode> = {
  prayer: color => <Cross s={13} c={color} w={2} />,
  'jesus-prayer': color => <Flame s={14} filled color={color} />,
  psalm: color => <OpenBook s={14} c={color} w={2} />,
  chapter: color => <Book s={14} c={color} w={2} />,
  intention: color => <Feather s={14} c={color} w={2} />,
};

// Fresh-zone defaults, tried in order until one fits the free time.
const ZONE_CANDIDATES: Omit<PlanZone, 'id'>[] = [
  { name: 'Morning', startMinutes: 360, endMinutes: 540, closedGroupIds: ['social', 'news'] },
  { name: 'Evening', startMinutes: 1260, endMinutes: 1380, closedGroupIds: ['social', 'entertainment', 'games'] },
  { name: 'Night', startMinutes: 1380, endMinutes: 360, closedGroupIds: APP_CATEGORIES.map(c => c.id) },
  { name: 'Day', startMinutes: 720, endMinutes: 840, closedGroupIds: ['games', 'entertainment'] },
];

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
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [timeTarget, setTimeTarget] = useState<{ zoneId: string; field: 'start' | 'end' } | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
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

  const addZone = () => {
    if (zones.length >= 4) return;
    const candidate =
      ZONE_CANDIDATES.find(entry => !zonesOverlap([...zones, entry as PlanZone])) ??
      ZONE_CANDIDATES[0];
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

  const applyWizard = (minutesByGroup: Record<string, number>) => {
    setRules(current =>
      current.map(rule =>
        minutesByGroup[rule.groupId] != null
          ? { ...rule, dailyMinutes: minutesByGroup[rule.groupId] }
          : rule
      )
    );
  };

  const save = () => {
    saveDayPlan({ id: existing?.id, name: trimmedName, zones, rules });
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

          {/* ---------------- ZONES ---------------- */}
          <Animated.View entering={enter(60)} layout={SECTION_TRANSITION}>
            <Text style={s.sectionLabel}>ZONES OF THE DAY</Text>

            <View style={s.timelineCard}>
              <ZoneTimeline zones={zones} height={12} showTicks />
              {zones.length === 0 && (
                <Text style={s.timelineEmpty}>
                  No zones yet — the whole day stays open, only daily limits stand.
                </Text>
              )}
            </View>

            <Animated.View style={s.groupCard} layout={SECTION_TRANSITION}>
              {zones.map((zone, index) => {
                const tint = zoneTint(index);
                const isOpen = expandedZone === zone.id;
                const zoneInvalid = zone.startMinutes === zone.endMinutes;
                return (
                  <Animated.View key={zone.id} layout={SECTION_TRANSITION}>
                    {index > 0 && <View style={s.separator} />}
                    <TouchableOpacity
                      style={s.zoneRow}
                      activeOpacity={0.75}
                      onPress={() => setExpandedZone(isOpen ? null : zone.id)}
                    >
                      <View style={[s.zoneDot, { backgroundColor: tint.bar }]} />
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
                        <View style={s.suggestionRow}>
                          {ZONE_NAME_SUGGESTIONS.map(suggestion => (
                            <TouchableOpacity
                              key={suggestion}
                              style={[
                                s.suggestionChip,
                                zone.name === suggestion && s.suggestionChipOn,
                              ]}
                              activeOpacity={0.8}
                              haptic="selection"
                              onPress={() => updateZone(zone.id, { name: suggestion })}
                            >
                              <Text
                                style={[
                                  s.suggestionText,
                                  zone.name === suggestion && s.suggestionTextOn,
                                ]}
                              >
                                {suggestion}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>

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
                        {zone.endMinutes <= zone.startMinutes && !zoneInvalid && (
                          <Text style={s.zoneHint}>Crosses midnight — ends the next morning.</Text>
                        )}
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

              {zones.length < 4 && (
                <>
                  {zones.length > 0 && <View style={s.separator} />}
                  <TouchableOpacity style={s.addZoneRow} activeOpacity={0.75} onPress={addZone}>
                    <View style={s.addZoneIcon}>
                      <Plus s={13} c={C.goldDark} w={2.6} />
                    </View>
                    <Text style={s.addZoneText}>Add a zone</Text>
                    <Text style={s.addZoneCount}>{zones.length}/4</Text>
                  </TouchableOpacity>
                </>
              )}
            </Animated.View>
            {overlap && <Text style={s.zoneError}>Two zones overlap — adjust their hours.</Text>}
          </Animated.View>

          {/* ---------------- DAILY LIMITS ---------------- */}
          <Animated.View entering={enter(120)} layout={SECTION_TRANSITION}>
            <View style={s.limitsHeader}>
              <Text style={[s.sectionLabel, { marginTop: 0, marginBottom: 0 }]}>DAILY LIMITS</Text>
              <TouchableOpacity activeOpacity={0.7} onPress={() => setWizardOpen(true)}>
                <Text style={s.wizardLink}>Help me plan →</Text>
              </TouchableOpacity>
            </View>

            <Animated.View style={s.groupCard} layout={SECTION_TRANSITION}>
              {rules.map((rule, index) => {
                const isOpen = expandedRule === rule.groupId;
                const custom = state.customGroups.some(group => group.id === rule.groupId);
                const limited = rule.dailyMinutes != null;
                return (
                  <Animated.View key={rule.groupId} layout={SECTION_TRANSITION}>
                    {index > 0 && <View style={s.separator} />}
                    <TouchableOpacity
                      style={s.ruleRow}
                      activeOpacity={0.75}
                      onPress={() => setExpandedRule(isOpen ? null : rule.groupId)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.ruleName} numberOfLines={1}>
                          {groupName(state, rule.groupId)}
                        </Text>
                        {limited && (
                          <Text style={s.ruleMeta} numberOfLines={1}>
                            {`${rule.strength === 'strict' ? 'Strict' : 'Loose'} · ${
                              RETURN_PRACTICES.find(entry => entry.id === rule.practice)?.name ?? ''
                            }`}
                          </Text>
                        )}
                      </View>
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
                        <Text style={[s.limitTagText, limited ? s.limitTagTextOn : s.limitTagTextOff]}>
                          {limited ? formatMinutesShort(rule.dailyMinutes!) : 'No limit'}
                        </Text>
                      </View>
                      <View style={[s.chevron, isOpen && s.chevronOpen]}>
                        <ChevronDown s={15} c={C.textMuted} />
                      </View>
                    </TouchableOpacity>

                    {isOpen && (
                      <Animated.View entering={SOFT_IN} exiting={SOFT_OUT} style={s.ruleBody}>
                        <View style={s.minuteWrap}>
                          {MINUTE_OPTIONS.map(option => {
                            const selected = rule.dailyMinutes === option;
                            return (
                              <TouchableOpacity
                                key={String(option)}
                                style={[s.minuteChip, selected && s.minuteChipOn]}
                                activeOpacity={0.8}
                                haptic="selection"
                                onPress={() => updateRule(rule.groupId, { dailyMinutes: option })}
                              >
                                <Text style={[s.minuteChipText, selected && s.minuteChipTextOn]}>
                                  {option === null ? 'No limit' : formatMinutesShort(option)}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        {limited && (
                          <Animated.View entering={SOFT_IN}>
                            <View style={s.strengthRow}>
                              {(['loose', 'strict'] as Strength[]).map(option => {
                                const selected = rule.strength === option;
                                return (
                                  <TouchableOpacity
                                    key={option}
                                    style={[s.strengthCell, selected && s.strengthCellOn]}
                                    activeOpacity={0.85}
                                    haptic="selection"
                                    onPress={() => updateRule(rule.groupId, { strength: option })}
                                  >
                                    <Text style={[s.strengthCellTitle, selected && s.strengthCellTitleOn]}>
                                      {option === 'loose' ? 'Loose' : 'Strict'}
                                    </Text>
                                    <Text style={s.strengthCellDesc}>
                                      {option === 'loose'
                                        ? 'Practice opens the door — costs the trophy.'
                                        : 'Held shut until tomorrow.'}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>

                            <Text style={s.zoneSubLabel}>RETURN PRACTICE</Text>
                            <View style={s.practiceWrap}>
                              {RETURN_PRACTICES.map(practice => {
                                const selected = rule.practice === practice.id;
                                const color = selected ? C.goldDark : C.textSecondary;
                                return (
                                  <TouchableOpacity
                                    key={practice.id}
                                    style={[s.practiceChip, selected && s.practiceChipOn]}
                                    activeOpacity={0.8}
                                    haptic="selection"
                                    onPress={() => updateRule(rule.groupId, { practice: practice.id })}
                                  >
                                    {PRACTICE_ICONS[practice.id](color)}
                                    <Text style={[s.practiceChipText, selected && s.practiceChipTextOn]}>
                                      {practice.name}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </Animated.View>
                        )}
                      </Animated.View>
                    )}
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

      <PlanWizardSheet
        visible={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onApply={applyWizard}
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
    paddingVertical: 14,
    fontFamily: F.serifMedium,
    fontSize: 18,
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
  zoneDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  zoneName: {
    fontFamily: F.serifMedium,
    fontSize: 17,
    color: C.text,
  },
  zoneMeta: {
    marginTop: 2,
    fontFamily: F.sansMedium,
    fontSize: 11,
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#FDFDFB',
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontFamily: F.serifMedium,
    fontSize: 16,
    color: C.text,
  },
  suggestionRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  suggestionChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  suggestionChipOn: {
    borderColor: C.gold,
    backgroundColor: C.goldBg,
  },
  suggestionText: {
    fontFamily: F.sansMedium,
    fontSize: 11.5,
    color: C.textSecondary,
  },
  suggestionTextOn: {
    fontFamily: F.sansSemiBold,
    color: C.goldDark,
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
    fontSize: 8.5,
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
    fontSize: 9,
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
    fontSize: 11.5,
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

  limitsHeader: {
    marginTop: 18,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 10,
  },
  wizardLink: {
    fontFamily: F.sansSemiBold,
    fontSize: 12,
    color: C.gold,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ruleName: {
    fontFamily: F.serifMedium,
    fontSize: 16.5,
    color: C.text,
  },
  ruleMeta: {
    marginTop: 2,
    fontFamily: F.sans,
    fontSize: 11,
    color: C.textSecondary,
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
  ruleBody: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  minuteWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  minuteChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  minuteChipOn: {
    borderColor: C.gold,
    backgroundColor: C.goldBg,
  },
  minuteChipText: {
    fontFamily: F.sansMedium,
    fontSize: 12,
    color: C.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  minuteChipTextOn: {
    fontFamily: F.sansSemiBold,
    color: C.goldDark,
  },
  strengthRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  strengthCell: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  strengthCellOn: {
    borderColor: C.gold,
    backgroundColor: C.goldBg,
  },
  strengthCellTitle: {
    fontFamily: F.serifMedium,
    fontSize: 15.5,
    color: C.text,
  },
  strengthCellTitleOn: {
    color: '#6D4F13',
  },
  strengthCellDesc: {
    marginTop: 2,
    fontFamily: F.sans,
    fontSize: 10.5,
    lineHeight: 14,
    color: C.textSecondary,
  },
  practiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  practiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  practiceChipOn: {
    borderColor: C.gold,
    backgroundColor: C.goldBg,
  },
  practiceChipText: {
    fontFamily: F.sansMedium,
    fontSize: 11.5,
    color: C.textSecondary,
  },
  practiceChipTextOn: {
    fontFamily: F.sansSemiBold,
    color: C.goldDark,
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
