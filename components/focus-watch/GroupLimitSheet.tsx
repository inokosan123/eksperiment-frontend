import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { CheckSmall, ChevronRight, Clock, Lock, Plus, Trash2 } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import FocusSwitch from './FocusSwitch';
import LimitSlider from './LimitSlider';
import NativeActivitySelectionButton from './NativeActivitySelectionButton';
import FocusSheetHeader from './FocusSheetHeader';
import GroupSeal, { groupTint, withAlpha } from './GroupSeal';
import { CATEGORY_TINTS, type PreviewApp } from './focusContent';
import { isNativeFocusAvailable } from './focusNativeBridge';
import {
  allCoreEssentialIds,
  formatMinutesShort,
  removeAlwaysBlockedApp,
  RETURN_PRACTICES,
  saveAlwaysBlockedApp,
  useDayPlan,
  type AppRule,
  type GroupRule,
  type PracticeKind,
  type RuleMode,
  type Strength,
} from './dayPlanStore';

const LIMIT_STOPS: (number | null)[] = [
  ...Array.from({ length: 48 }, (_, index) => 15 + index * 15),
  null,
];
// Individual app allowances stay on a ruler too — no plus/minus steppers.
const APP_LIMIT_STOPS: (number | null)[] = Array.from({ length: 48 }, (_, index) => 15 + index * 15);

const ROSE = '#A24351';
const ROSE_BG = '#F8E7EA';
const ROSE_BORDER = '#E7C4CB';

function createAppRuleId() {
  return `app-rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function modeFor(rule: GroupRule | null): RuleMode {
  if (!rule) return 'noLimit';
  return rule.mode ?? (rule.dailyMinutes == null ? 'noLimit' : 'limit');
}

function modeLabel(mode: RuleMode) {
  if (mode === 'blocked') return 'Blocked';
  if (mode === 'limit') return 'Limit';
  return 'No limit';
}

// The three glyphs the mode picker wears — an open loop, a clock, a lock.
function InfinityGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// One of the three mode choices: an emblem, its name, tinted in the group's own
// colour when chosen (Blocked always answers in rose).
function ModeCard({
  mode,
  active,
  accent,
  onPress,
}: {
  mode: RuleMode;
  active: boolean;
  accent: string;
  onPress: () => void;
}) {
  const danger = mode === 'blocked';
  const tone = danger ? ROSE : accent;
  const glyphColor = active ? tone : '#9A948A';
  const size = mode === 'limit' ? 21 : 22;

  return (
    <TouchableOpacity
      style={[
        s.modeCard,
        active && { borderColor: withAlpha(tone, 0.5), backgroundColor: withAlpha(tone, 0.1) },
      ]}
      onPress={onPress}
      haptic="selection"
      activeOpacity={0.85}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${modeLabel(mode)} for this group`}
    >
      <View style={s.modeGlyph}>
        {mode === 'noLimit' && <InfinityGlyph size={22} color={glyphColor} />}
        {mode === 'limit' && <Clock s={size} c={glyphColor} w={2.1} />}
        {mode === 'blocked' && <Lock s={size} c={glyphColor} w={2.1} />}
      </View>
      <Text style={[s.modeName, active && { color: tone }]}>{modeLabel(mode)}</Text>
    </TouchableOpacity>
  );
}

function StrengthControl({
  value,
  onChange,
  sessionScoped,
}: {
  value: Strength;
  onChange: (value: Strength) => void;
  sessionScoped: boolean;
}) {
  return (
    <View style={s.strengthRow}>
      <TouchableOpacity
        style={[s.strengthOption, value === 'loose' && s.looseOptionOn]}
        onPress={() => onChange('loose')}
        haptic="selection"
        activeOpacity={0.85}
      >
        <View style={s.strengthHead}>
          <View style={[s.strengthDot, { backgroundColor: value === 'loose' ? '#B98A2E' : '#CFC9BB' }]} />
          <Text style={[s.strengthName, value === 'loose' && s.looseText]}>Loose</Text>
        </View>
        <Text style={s.strengthDetail}>A deliberate 15-minute continuation stays open.</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[s.strengthOption, value === 'strict' && s.strictOptionOn]}
        onPress={() => onChange('strict')}
        haptic="selection"
        activeOpacity={0.85}
      >
        <View style={s.strengthHead}>
          <View style={[s.strengthDot, { backgroundColor: value === 'strict' ? ROSE : '#CFC9BB' }]} />
          <Text style={[s.strengthName, value === 'strict' && s.strictText]}>Strict</Text>
        </View>
        <Text style={s.strengthDetail}>{sessionScoped ? 'Closed until the next Session.' : 'Closed for the rest of the day.'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function AppRuleEditor({
  app,
  rule,
  inheritedStrength,
  sessionScoped,
  accent,
  onChange,
  onRemove,
  nativeSelectionId,
}: {
  app: PreviewApp;
  rule: AppRule | null;
  inheritedStrength: Strength;
  sessionScoped: boolean;
  accent: string;
  onChange: (rule: AppRule) => void;
  onRemove: () => void;
  nativeSelectionId: string;
}) {
  const current: AppRule = rule ?? {
    appId: app.id,
    mode: 'limit',
    minutes: 30,
    strength: inheritedStrength,
    practice: 'prayer',
    checkInMinutes: 15,
  };
  const setMode = (mode: 'limit' | 'blocked') => onChange({
    ...current,
    mode,
    minutes: mode === 'blocked' ? null : (current.minutes ?? 30),
  });

  return (
    <Animated.View entering={FadeIn.duration(180)} style={[s.appEditor, { borderLeftColor: withAlpha(accent, 0.4) }]}>
      <View style={s.appModeRow}>
        <TouchableOpacity
          style={[s.appMode, current.mode === 'limit' && { borderColor: withAlpha(accent, 0.5), backgroundColor: withAlpha(accent, 0.1) }]}
          onPress={() => setMode('limit')}
          haptic="selection"
        >
          <Text style={[s.appModeText, current.mode === 'limit' && { color: accent }]}>Limit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.appMode, current.mode === 'blocked' && s.appModeBlocked]} onPress={() => setMode('blocked')} haptic="selection">
          <Text style={[s.appModeText, current.mode === 'blocked' && s.appModeBlockedText]}>Blocked</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.removeAppRule} onPress={onRemove} hitSlop={8}>
          <Trash2 s={13} c={C.textMuted} w={2} />
        </TouchableOpacity>
      </View>

      <NativeActivitySelectionButton
        selectionId={nativeSelectionId}
        title={`Choose ${app.name}`}
        label="Choose this app on iPhone"
      />

      {current.mode === 'limit' && (
        <View>
          <View style={s.appMinutesRow}>
            <Text style={s.appEditorLabel}>ALLOWANCE</Text>
            <Text style={[s.appMinutesValue, { color: accent }]}>{formatMinutesShort(current.minutes ?? 30)}</Text>
          </View>
          <LimitSlider
            value={current.minutes ?? 30}
            onChange={value => {
              if (value == null) return;
              onChange({ ...current, minutes: value });
            }}
            stops={APP_LIMIT_STOPS}
            edgeLabels={{ left: '15m', right: '12h' }}
            accent={accent}
          />
        </View>
      )}

      <StrengthControl value={current.strength} onChange={strength => onChange({ ...current, strength })} sessionScoped={sessionScoped} />

      {current.mode === 'limit' && (
        <View style={s.checkInRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.checkInTitle}>15-minute check-ins</Text>
            <Text style={s.checkInBody}>A soft pause before the final limit.</Text>
          </View>
          <FocusSwitch value={current.checkInMinutes === 15} onToggle={() => onChange({ ...current, checkInMinutes: current.checkInMinutes === 15 ? null : 15 })} />
        </View>
      )}
    </Animated.View>
  );
}

export default function GroupLimitSheet({
  rule,
  groupLabel,
  apps,
  planStrength,
  onChange,
  onClose,
  sessionName,
  nativeSelectionBaseId,
}: {
  rule: GroupRule | null;
  groupLabel: string;
  apps: PreviewApp[];
  planStrength: Strength;
  onChange: (partial: Partial<GroupRule>) => void;
  onClose: () => void;
  sessionName?: string;
  nativeSelectionBaseId: string;
}) {
  const state = useDayPlan();
  const nativeAvailable = isNativeFocusAvailable();
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);
  const [pendingAlwaysBlock, setPendingAlwaysBlock] = useState<string | null>(null);
  const [newAppLabel, setNewAppLabel] = useState('');
  const mode = modeFor(rule);
  const alwaysBlockedIds = useMemo(() => new Set(state.alwaysBlockedApps.map(entry => entry.appId)), [state.alwaysBlockedApps]);
  const essentialIds = useMemo(() => new Set([...allCoreEssentialIds(state), ...state.optionalEssentialAppIds]), [state]);
  const appRules = rule?.appRules ?? [];

  // The sheet wears the group's own colour, the same one its seal and card wear
  // on the board — so it reads as this group's own room.
  const tint = groupTint(rule?.groupId ?? 'custom');
  const accent = tint.color;

  const setMode = (next: RuleMode) => {
    if (!rule) return;
    onChange({
      mode: next,
      dailyMinutes: next === 'limit' ? (rule.dailyMinutes ?? 45) : null,
      strength: rule.strength ?? planStrength,
    });
  };

  const updateAppRule = (next: AppRule) => {
    onChange({ appRules: [...appRules.filter(entry => entry.appId !== next.appId), next] });
  };

  const addNativeAppRule = () => {
    const label = newAppLabel.trim();
    if (!label) return;
    const appId = createAppRuleId();
    updateAppRule({
      appId,
      label,
      mode: 'limit',
      minutes: 30,
      strength: rule?.strength ?? planStrength,
      practice: 'prayer',
      checkInMinutes: 15,
    });
    setNewAppLabel('');
    setExpandedAppId(appId);
  };

  return (
    <>
      <SmoothBottomSheet visible={rule !== null} onClose={onClose} sheetStyle={s.sheet}>
        <GestureHandlerRootView style={s.gestureRoot}>
          <FocusSheetHeader
            kicker={sessionName ? `${sessionName.toUpperCase()} SESSION` : 'GROUP RULE'}
            title={groupLabel}
            onClose={onClose}
          />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
            {/* The apps this rule governs, and where you widen the selection. */}
            <View style={s.card}>
              <View style={s.cardHeadRow}>
                <GroupSeal groupId={rule?.groupId ?? 'custom'} name={groupLabel} size={38} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.cardTitle} numberOfLines={1}>{groupLabel}</Text>
                  <Text style={s.cardMeta} numberOfLines={1}>
                    {apps.length > 0 ? `${apps.length} ${apps.length === 1 ? 'app' : 'apps'} in this group` : 'Apps chosen on iPhone'}
                  </Text>
                </View>
              </View>
              <NativeActivitySelectionButton
                selectionId={`${nativeSelectionBaseId}.group.${rule?.groupId ?? 'group'}`}
                title={`Choose apps for ${groupLabel}`}
                label="Choose this group on iPhone"
              />
            </View>

            {/* The one decision the whole sheet turns on. */}
            <Text style={[s.sectionLabel, { color: accent }]}>THE RULE</Text>
            <View style={s.modeRow} accessibilityRole="radiogroup">
              {(['noLimit', 'limit', 'blocked'] as RuleMode[]).map(option => (
                <ModeCard
                  key={option}
                  mode={option}
                  active={mode === option}
                  accent={accent}
                  onPress={() => setMode(option)}
                />
              ))}
            </View>

            {mode === 'noLimit' && (
              <View style={s.calmCard}>
                <Text style={s.calmTitle}>No limit for this group</Text>
                <Text style={s.calmBody}>Usage still counts toward your Daily Target, and higher protection layers still apply.</Text>
              </View>
            )}

            {mode === 'limit' && rule && (
              <View style={s.card}>
                <View style={s.allowanceHead}>
                  <Text style={s.allowanceLabel}>ALLOWANCE</Text>
                  <Text style={s.allowanceScope}>{sessionName ? 'THIS SESSION' : 'THIS DAY'}</Text>
                </View>
                <Text style={[s.allowanceValue, { color: accent }]}>{formatMinutesShort(rule.dailyMinutes ?? 45)}</Text>
                <LimitSlider
                  value={rule.dailyMinutes}
                  onChange={value => value == null ? setMode('noLimit') : onChange({ mode: 'limit', dailyMinutes: value })}
                  stops={LIMIT_STOPS}
                  edgeLabels={{ left: '15m', right: 'No limit' }}
                  accent={accent}
                />
                <View style={[s.checkInRow, s.checkInInset]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.checkInTitle}>15-minute check-ins</Text>
                    <Text style={s.checkInBody}>A calm nudge as the time adds up.</Text>
                  </View>
                  <FocusSwitch value={rule.checkInMinutes === 15} onToggle={() => onChange({ checkInMinutes: rule.checkInMinutes === 15 ? null : 15 })} />
                </View>
              </View>
            )}

            {mode !== 'noLimit' && rule && (
              <View style={s.card}>
                <Text style={s.cardSectionLabel}>{mode === 'blocked' ? 'WHEN IT OPENS' : 'WHEN THE LIMIT ENDS'}</Text>
                <StrengthControl value={rule.strength} onChange={strength => onChange({ strength })} sessionScoped={!!sessionName} />

                {rule.strength === 'loose' && (
                  <>
                    <Text style={[s.cardSectionLabel, s.cardSectionLabelSpaced]}>RETURN PRACTICE</Text>
                    <View style={s.practiceWrap}>
                      {RETURN_PRACTICES.map(practice => {
                        const selected = rule.practice === practice.id;
                        return (
                          <TouchableOpacity
                            key={practice.id}
                            style={[s.practiceChip, selected && s.practiceChipOn]}
                            onPress={() => onChange({ practice: practice.id as PracticeKind })}
                            haptic="selection"
                          >
                            {selected && <CheckSmall s={10} c={C.goldDark} w={2.8} />}
                            <Text style={[s.practiceText, selected && s.practiceTextOn]}>{practice.name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}
              </View>
            )}

            {nativeAvailable && (
              <>
                <View style={s.appSectionHeader}>
                  <Text style={[s.sectionLabel, { color: accent }]}>INDIVIDUAL APP RULES</Text>
                  <Text style={s.appSectionNote}>Name a rule, then pick one app already in this group. It never adds to the group rule — the stricter one wins.</Text>
                </View>

                {appRules.length === 0 ? (
                  <View style={s.calmCard}>
                    <Text style={s.calmTitle}>No exceptions yet</Text>
                    <Text style={s.calmBody}>The group rule applies evenly until you add a more specific app boundary.</Text>
                  </View>
                ) : (
                  <View style={s.appsCard}>
                    {appRules.map((appRule, index) => {
                      const label = appRule.label?.trim()
                        || apps.find(app => app.id === appRule.appId)?.name
                        || 'Individual app';
                      const app: PreviewApp = {
                        id: appRule.appId,
                        name: label,
                        categoryId: rule?.groupId ?? 'custom',
                      };
                      const appTint = CATEGORY_TINTS[app.categoryId] ?? { bg: C.goldLight, color: C.goldDark };
                      const expanded = expandedAppId === appRule.appId;
                      return (
                        <Animated.View key={appRule.appId} layout={LinearTransition.duration(180)}>
                          {index > 0 && <View style={s.separator} />}
                          <TouchableOpacity
                            style={s.appRow}
                            onPress={() => setExpandedAppId(expanded ? null : appRule.appId)}
                            activeOpacity={0.72}
                          >
                            <View style={[s.appAvatar, { backgroundColor: appTint.bg, borderColor: withAlpha(appTint.color, 0.22) }]}>
                              <Text style={[s.appAvatarText, { color: appTint.color }]}>{label[0]?.toUpperCase()}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={s.appName}>{label}</Text>
                              <Text style={s.appMeta}>
                                {`${modeLabel(appRule.mode)}${appRule.minutes ? ` · ${formatMinutesShort(appRule.minutes)}` : ''}`}
                              </Text>
                            </View>
                            <ChevronRight s={15} c={C.textMuted} w={2} />
                          </TouchableOpacity>

                          {expanded && (
                            <View style={s.expandedWrap}>
                              <AppRuleEditor
                                app={app}
                                rule={appRule}
                                inheritedStrength={rule?.strength ?? planStrength}
                                sessionScoped={!!sessionName}
                                accent={accent}
                                nativeSelectionId={`${nativeSelectionBaseId}.group.${rule?.groupId ?? 'group'}.app.${appRule.appId}`}
                                onChange={updateAppRule}
                                onRemove={() => {
                                  onChange({ appRules: appRules.filter(entry => entry.appId !== appRule.appId) });
                                  setExpandedAppId(null);
                                }}
                              />
                            </View>
                          )}
                        </Animated.View>
                      );
                    })}
                  </View>
                )}

                <View style={s.newNativeRuleRow}>
                  <TextInput
                    value={newAppLabel}
                    onChangeText={setNewAppLabel}
                    onSubmitEditing={addNativeAppRule}
                    placeholder="Rule name, e.g. Instagram"
                    placeholderTextColor={C.textMuted}
                    maxLength={28}
                    style={s.newNativeRuleInput}
                  />
                  <TouchableOpacity
                    style={[s.newNativeRuleButton, { backgroundColor: newAppLabel.trim() ? withAlpha(accent, 0.14) : '#F0EFEB' }]}
                    disabled={!newAppLabel.trim()}
                    onPress={addNativeAppRule}
                    haptic="selection"
                  >
                    <Plus s={15} c={newAppLabel.trim() ? accent : C.textMuted} w={2.5} />
                  </TouchableOpacity>
                </View>
              </>
            )}

            {!nativeAvailable && apps.length > 0 && (
              <>
                <View style={s.appSectionHeader}>
                  <Text style={[s.sectionLabel, { color: accent }]}>INDIVIDUAL APPS</Text>
                  <Text style={s.appSectionNote}>An app rule and its group rule never add together. The stricter boundary wins.</Text>
                </View>
                <View style={s.appsCard}>
                  {apps.map((app, index) => {
                    const appTint = CATEGORY_TINTS[app.categoryId] ?? { bg: C.goldLight, color: C.goldDark };
                    const appRule = appRules.find(entry => entry.appId === app.id) ?? null;
                    const expanded = expandedAppId === app.id;
                    const alwaysBlocked = alwaysBlockedIds.has(app.id);
                    const essential = essentialIds.has(app.id);
                    return (
                      <Animated.View key={app.id} layout={LinearTransition.duration(180)}>
                        {index > 0 && <View style={s.separator} />}
                        <TouchableOpacity
                          style={s.appRow}
                          onPress={() => setExpandedAppId(expanded ? null : app.id)}
                          activeOpacity={0.72}
                        >
                          <View style={[s.appAvatar, { backgroundColor: appTint.bg, borderColor: withAlpha(appTint.color, 0.22) }]}>
                            <Text style={[s.appAvatarText, { color: appTint.color }]}>{app.name[0]}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.appName}>{app.name}</Text>
                            <Text style={s.appMeta}>
                              {alwaysBlocked ? 'Always Blocked' : appRule ? `${modeLabel(appRule.mode)}${appRule.minutes ? ` · ${formatMinutesShort(appRule.minutes)}` : ''}` : 'Uses the group rule'}
                            </Text>
                          </View>
                          {alwaysBlocked ? (
                            <View style={s.alwaysTag}><Lock s={9} c={ROSE} w={2.2} /><Text style={s.alwaysTagText}>ALWAYS</Text></View>
                          ) : (
                            <ChevronRight s={15} c={C.textMuted} w={2} />
                          )}
                        </TouchableOpacity>

                        {expanded && (
                          <View style={s.expandedWrap}>
                            {!alwaysBlocked && (
                              <AppRuleEditor
                                app={app}
                                rule={appRule}
                                inheritedStrength={rule?.strength ?? planStrength}
                                sessionScoped={!!sessionName}
                                accent={accent}
                                nativeSelectionId={`${nativeSelectionBaseId}.group.${rule?.groupId ?? 'group'}.app.${app.id}`}
                                onChange={updateAppRule}
                                onRemove={() => {
                                  onChange({ appRules: appRules.filter(entry => entry.appId !== app.id) });
                                  setExpandedAppId(null);
                                }}
                              />
                            )}
                            <TouchableOpacity
                              style={[s.alwaysAction, essential && s.alwaysActionDisabled]}
                              disabled={essential}
                              onPress={() => alwaysBlocked ? removeAlwaysBlockedApp(app.id) : setPendingAlwaysBlock(app.id)}
                            >
                              <Lock s={12} c={essential ? C.textMuted : ROSE} w={2.2} />
                              <Text style={[s.alwaysActionText, essential && { color: C.textMuted }]}>
                                {essential ? 'Remove from Essentials before Always Blocked' : alwaysBlocked ? 'Remove Always Blocked' : 'Make Always Blocked'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </Animated.View>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>
        </GestureHandlerRootView>
      </SmoothBottomSheet>

      <ConfirmModal
        visible={pendingAlwaysBlock !== null}
        icon={<Lock s={21} c={ROSE} w={2.2} />}
        iconBg={ROSE_BG}
        title="Always block this app?"
        body="It will stay outside Quiet Hour Essentials and ordinary plan allowances. Loose offers a deliberate 15-minute gateway; Strict keeps it closed."
        subject={apps.find(app => app.id === pendingAlwaysBlock)?.name}
        confirmLabel="ALWAYS BLOCK"
        confirmColor={ROSE}
        onCancel={() => setPendingAlwaysBlock(null)}
        onConfirm={() => {
          if (pendingAlwaysBlock) saveAlwaysBlockedApp({ appId: pendingAlwaysBlock, strength: 'strict', practice: 'prayer' });
          setPendingAlwaysBlock(null);
        }}
      />
    </>
  );
}

const s = StyleSheet.create({
  gestureRoot: { flexGrow: 0, flexShrink: 1, width: '100%' },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 24, maxHeight: '93%' },
  scrollContent: { paddingTop: 16, paddingBottom: 30, gap: 13 },

  // Every setting lives inside a calm rounded card — the grammar the rest of the
  // plan sheet uses, so this one finally belongs with it.
  card: {
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#EAE5DA',
    backgroundColor: '#FFFEFB',
    padding: 14,
    gap: 12,
    boxShadow: '0 6px 18px rgba(45, 40, 33, 0.05)',
  },
  cardHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  cardTitle: { fontFamily: F.serifSemiBold, fontSize: 18, lineHeight: 22, letterSpacing: -0.2, color: C.text },
  cardMeta: { marginTop: 1, fontFamily: F.sans, fontSize: 11.5, lineHeight: 15, color: C.textSecondary },

  sectionLabel: { marginTop: 3, marginBottom: -3, marginLeft: 2, fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 2 },
  cardSectionLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.8, color: C.textMuted },
  cardSectionLabelSpaced: { marginTop: 4 },

  // The three-choice hero: No limit · Limit · Blocked.
  modeRow: { flexDirection: 'row', gap: 8 },
  modeCard: {
    flex: 1,
    minHeight: 74,
    borderRadius: 17,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E7E2D6',
    backgroundColor: '#FFFEFB',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
  },
  modeGlyph: { height: 24, alignItems: 'center', justifyContent: 'center' },
  modeName: { fontFamily: F.sansSemiBold, fontSize: 12, letterSpacing: 0.1, color: C.textSecondary },

  calmCard: { borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: '#ECEAE3', backgroundColor: '#F5F3EE', padding: 13 },
  calmTitle: { fontFamily: F.serifSemiBold, fontSize: 15.5, lineHeight: 19, color: C.text },
  calmBody: { marginTop: 3, fontFamily: F.sans, fontSize: 11.5, lineHeight: 16, color: C.textSecondary },

  allowanceHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  allowanceLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.8, color: C.textMuted },
  allowanceScope: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.3, color: C.textMuted },
  allowanceValue: { marginTop: -4, marginBottom: 2, fontFamily: F.serifBold, fontSize: 33, lineHeight: 38, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },

  strengthRow: { flexDirection: 'row', gap: 9 },
  strengthOption: { flex: 1, minHeight: 78, borderRadius: 15, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E7E2D6', backgroundColor: '#FFFEFB', padding: 11 },
  looseOptionOn: { borderColor: '#E0C88A', backgroundColor: '#FFF8E6' },
  strictOptionOn: { borderColor: ROSE_BORDER, backgroundColor: '#FCEFF1' },
  strengthHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  strengthDot: { width: 6, height: 6, borderRadius: 3 },
  strengthName: { fontFamily: F.serifSemiBold, fontSize: 16.5, color: C.text },
  looseText: { color: '#93651E' },
  strictText: { color: ROSE },
  strengthDetail: { marginTop: 5, fontFamily: F.sans, fontSize: 10, lineHeight: 14, color: C.textSecondary },

  checkInRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkInInset: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#ECE7DC', paddingTop: 4, marginTop: 1 },
  checkInTitle: { fontFamily: F.serifSemiBold, fontSize: 15, lineHeight: 18, color: C.text },
  checkInBody: { marginTop: 2, fontFamily: F.sans, fontSize: 10.5, lineHeight: 14.5, color: C.textSecondary },

  practiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  practiceChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, paddingHorizontal: 11, paddingVertical: 7 },
  practiceChipOn: { borderColor: C.gold, backgroundColor: C.goldLight },
  practiceText: { fontFamily: F.sansMedium, fontSize: 10.5, color: C.textSecondary },
  practiceTextOn: { fontFamily: F.sansSemiBold, color: C.goldDark },

  appSectionHeader: { marginTop: 4, gap: 5 },
  appSectionNote: { maxWidth: 320, fontFamily: F.sans, fontSize: 10.5, lineHeight: 15, color: C.textMuted },

  appsCard: { borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, borderColor: '#EAE5DA', backgroundColor: '#FFFEFB', paddingHorizontal: 12, overflow: 'hidden', boxShadow: '0 6px 18px rgba(45, 40, 33, 0.05)' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#EDE8DD', marginLeft: 44 },
  appRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 11 },
  appAvatar: { width: 34, height: 34, borderRadius: 11, borderCurve: 'continuous', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  appAvatarText: { fontFamily: F.serifSemiBold, fontSize: 14 },
  appName: { fontFamily: F.serifSemiBold, fontSize: 15.5, color: C.text },
  appMeta: { marginTop: 1.5, fontFamily: F.sans, fontSize: 10.5, color: C.textMuted },
  alwaysTag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, backgroundColor: ROSE_BG, paddingHorizontal: 8, paddingVertical: 5 },
  alwaysTagText: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 0.9, color: ROSE },

  expandedWrap: { marginLeft: 45, marginBottom: 12, gap: 8 },
  appEditor: { borderLeftWidth: 2, paddingLeft: 11, gap: 9 },
  appModeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  appMode: { borderRadius: 999, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 6 },
  appModeBlocked: { borderColor: ROSE_BORDER, backgroundColor: ROSE_BG },
  appModeText: { fontFamily: F.sansSemiBold, fontSize: 10.5, color: C.textSecondary },
  appModeBlockedText: { color: ROSE },
  removeAppRule: { marginLeft: 'auto', width: 28, height: 28, borderRadius: 14, backgroundColor: '#F0EFEB', alignItems: 'center', justifyContent: 'center' },
  appMinutesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  appEditorLabel: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.4, color: C.textMuted },
  appMinutesValue: { fontFamily: F.serifSemiBold, fontSize: 16, fontVariant: ['tabular-nums'] },

  newNativeRuleRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 15, borderCurve: 'continuous', borderWidth: 1, borderColor: '#EAE5DA', backgroundColor: '#FFFEFB', paddingLeft: 14, paddingRight: 7 },
  newNativeRuleInput: { flex: 1, minHeight: 46, fontFamily: F.sansMedium, fontSize: 12.5, color: C.text },
  newNativeRuleButton: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  alwaysAction: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 12, borderCurve: 'continuous', backgroundColor: ROSE_BG, paddingHorizontal: 11 },
  alwaysActionDisabled: { backgroundColor: '#F1F0EC' },
  alwaysActionText: { fontFamily: F.sansSemiBold, fontSize: 9.5, color: ROSE },
});
