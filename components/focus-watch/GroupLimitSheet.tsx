import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { CheckSmall, ChevronRight, Lock, Plus, Trash2 } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import FocusSegments from './FocusSegments';
import FocusSwitch from './FocusSwitch';
import LimitSlider from './LimitSlider';
import NativeActivitySelectionButton from './NativeActivitySelectionButton';
import FocusSheetHeader from './FocusSheetHeader';
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
      >
        <Text style={[s.strengthName, value === 'loose' && s.looseText]}>Loose</Text>
        <Text style={s.strengthDetail}>A deliberate 15-minute continuation remains available.</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[s.strengthOption, value === 'strict' && s.strictOptionOn]}
        onPress={() => onChange('strict')}
        haptic="selection"
      >
        <Text style={[s.strengthName, value === 'strict' && s.strictText]}>Strict</Text>
        <Text style={s.strengthDetail}>{sessionScoped ? 'Closed until the next Session begins.' : 'Closed for the rest of the day.'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function AppRuleEditor({
  app,
  rule,
  inheritedStrength,
  sessionScoped,
  onChange,
  onRemove,
  nativeSelectionId,
}: {
  app: PreviewApp;
  rule: AppRule | null;
  inheritedStrength: Strength;
  sessionScoped: boolean;
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
    <Animated.View entering={FadeIn.duration(180)} style={s.appEditor}>
      <View style={s.appModeRow}>
        <TouchableOpacity style={[s.appMode, current.mode === 'limit' && s.appModeOn]} onPress={() => setMode('limit')} haptic="selection">
          <Text style={[s.appModeText, current.mode === 'limit' && s.appModeTextOn]}>Limit</Text>
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
            <Text style={s.appMinutesValue}>{formatMinutesShort(current.minutes ?? 30)}</Text>
          </View>
          <LimitSlider
            value={current.minutes ?? 30}
            onChange={value => {
              if (value == null) return;
              onChange({ ...current, minutes: value });
            }}
            stops={APP_LIMIT_STOPS}
            edgeLabels={{ left: '15m', right: '12h' }}
          />
        </View>
      )}

      <StrengthControl value={current.strength} onChange={strength => onChange({ ...current, strength })} sessionScoped={sessionScoped} />

      {current.mode === 'limit' && (
        <View style={s.checkInRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.checkInTitle}>15-minute check-ins</Text>
            <Text style={s.checkInBody}>A soft pause that restores awareness before the final limit.</Text>
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
            kicker={sessionName ? `${sessionName.toUpperCase()} SESSION` : 'DAILY RULE'}
            title={groupLabel}
            onClose={onClose}
          />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
            <NativeActivitySelectionButton
              selectionId={`${nativeSelectionBaseId}.group.${rule?.groupId ?? 'group'}`}
              title={`Choose apps for ${groupLabel}`}
              label="Choose this group on iPhone"
            />

            <FocusSegments
              options={(['noLimit', 'limit', 'blocked'] as RuleMode[]).map(option => ({
                key: option,
                label: modeLabel(option),
                tone: option === 'blocked' ? ('danger' as const) : ('default' as const),
              }))}
              value={mode}
              onChange={key => setMode(key as RuleMode)}
            />

            {mode === 'noLimit' && (
              <View style={s.noLimitNote}>
                <Text style={s.noLimitTitle}>No local boundary</Text>
                <Text style={s.noLimitBody}>Usage still counts toward the Daily Target, and higher protection layers still apply.</Text>
              </View>
            )}

            {mode === 'limit' && rule && (
              <>
                <View style={s.limitValueRow}>
                  <View>
                    <Text style={s.limitLabel}>GROUP ALLOWANCE</Text>
                    <Text style={s.limitValue}>{formatMinutesShort(rule.dailyMinutes ?? 45)}</Text>
                  </View>
                  <Text style={s.limitScope}>{sessionName ? 'THIS SESSION' : 'THIS DAY'}</Text>
                </View>
                <LimitSlider
                  value={rule.dailyMinutes}
                  onChange={value => value == null ? setMode('noLimit') : onChange({ mode: 'limit', dailyMinutes: value })}
                  stops={LIMIT_STOPS}
                  edgeLabels={{ left: '15m', right: 'No limit' }}
                />
                <View style={s.checkInRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.checkInTitle}>15-minute check-ins</Text>
                    <Text style={s.checkInBody}>A calm reminder during accumulated use, not per opening.</Text>
                  </View>
                  <FocusSwitch value={rule.checkInMinutes === 15} onToggle={() => onChange({ checkInMinutes: rule.checkInMinutes === 15 ? null : 15 })} />
                </View>
              </>
            )}

            {mode !== 'noLimit' && rule && (
              <>
                <Text style={s.sectionLabel}>FINAL PROTECTION</Text>
                <StrengthControl value={rule.strength} onChange={strength => onChange({ strength })} sessionScoped={!!sessionName} />

                {rule.strength === 'loose' && (
                  <>
                    <Text style={s.sectionLabel}>RETURN PRACTICE</Text>
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
              </>
            )}

            {nativeAvailable && (
              <>
                <View style={s.appSectionHeader}>
                  <View>
                    <Text style={s.sectionLabelNoMargin}>INDIVIDUAL APP RULES</Text>
                    <Text style={s.appSectionNote}>Name the rule, then choose exactly one app that already belongs to this group.</Text>
                  </View>
                </View>

                {appRules.length === 0 ? (
                  <View style={s.nativeRuleEmpty}>
                    <Text style={s.nativeRuleEmptyTitle}>No individual exceptions yet.</Text>
                    <Text style={s.nativeRuleEmptyBody}>The group rule applies evenly until you add a more specific app boundary.</Text>
                  </View>
                ) : (
                  <View style={s.appsList}>
                    {appRules.map((appRule, index) => {
                      const label = appRule.label?.trim()
                        || apps.find(app => app.id === appRule.appId)?.name
                        || 'Individual app';
                      const app: PreviewApp = {
                        id: appRule.appId,
                        name: label,
                        categoryId: rule?.groupId ?? 'custom',
                      };
                      const tint = CATEGORY_TINTS[app.categoryId] ?? { bg: C.goldLight, color: C.goldDark };
                      const expanded = expandedAppId === appRule.appId;
                      return (
                        <Animated.View key={appRule.appId} layout={LinearTransition.duration(180)}>
                          {index > 0 && <View style={s.separator} />}
                          <TouchableOpacity
                            style={s.appRow}
                            onPress={() => setExpandedAppId(expanded ? null : appRule.appId)}
                            activeOpacity={0.72}
                          >
                            <View style={[s.appAvatar, { backgroundColor: tint.bg }]}>
                              <Text style={[s.appAvatarText, { color: tint.color }]}>{label[0]?.toUpperCase()}</Text>
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
                    style={[s.newNativeRuleButton, !newAppLabel.trim() && s.newNativeRuleButtonDisabled]}
                    disabled={!newAppLabel.trim()}
                    onPress={addNativeAppRule}
                    haptic="selection"
                  >
                    <Plus s={15} c={newAppLabel.trim() ? C.goldDark : C.textMuted} w={2.5} />
                  </TouchableOpacity>
                </View>
              </>
            )}

            {!nativeAvailable && apps.length > 0 && (
              <>
                <View style={s.appSectionHeader}>
                  <View>
                    <Text style={s.sectionLabelNoMargin}>INDIVIDUAL APPS</Text>
                    <Text style={s.appSectionNote}>An app rule and its group rule never add together. The stricter boundary wins.</Text>
                  </View>
                </View>
                <View style={s.appsList}>
                  {apps.map((app, index) => {
                    const tint = CATEGORY_TINTS[app.categoryId] ?? { bg: C.goldLight, color: C.goldDark };
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
                          <View style={[s.appAvatar, { backgroundColor: tint.bg }]}>
                            <Text style={[s.appAvatarText, { color: tint.color }]}>{app.name[0]}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.appName}>{app.name}</Text>
                            <Text style={s.appMeta}>
                              {alwaysBlocked ? 'Always Blocked' : appRule ? `${modeLabel(appRule.mode)}${appRule.minutes ? ` · ${formatMinutesShort(appRule.minutes)}` : ''}` : 'Uses the group rule'}
                            </Text>
                          </View>
                          {alwaysBlocked ? (
                            <View style={s.alwaysTag}><Lock s={9} c="#A24351" w={2.2} /><Text style={s.alwaysTagText}>ALWAYS</Text></View>
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
                              <Lock s={12} c={essential ? C.textMuted : '#A24351'} w={2.2} />
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
        icon={<Lock s={21} c="#A24351" w={2.2} />}
        iconBg="#F8E7EA"
        title="Always block this app?"
        body="It will stay outside Quiet Hour Essentials and ordinary plan allowances. Loose offers a deliberate 15-minute gateway; Strict keeps it closed."
        subject={apps.find(app => app.id === pendingAlwaysBlock)?.name}
        confirmLabel="ALWAYS BLOCK"
        confirmColor="#A24351"
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
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E0DA', marginTop: 10 },
  headerRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  kicker: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: C.gold },
  title: { marginTop: 3, fontFamily: F.serifMedium, fontSize: 27, color: C.text },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0EFEA', alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingTop: 17, paddingBottom: 30, gap: 12 },
  modeRow: { flexDirection: 'row', gap: 7 },
  modeOption: { flex: 1, height: 39, borderRadius: 12, borderCurve: 'continuous', borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  modeOptionOn: { borderColor: C.gold, backgroundColor: '#FFF8E8' },
  modeOptionBlocked: { borderColor: '#D99AA6', backgroundColor: '#F8E7EA' },
  modeText: { fontFamily: F.sansSemiBold, fontSize: 11.5, color: C.textSecondary },
  modeTextOn: { color: C.goldDark },
  modeTextBlocked: { color: '#A24351' },
  noLimitNote: { borderRadius: 14, backgroundColor: '#F1F0EC', padding: 12 },
  noLimitTitle: { fontFamily: F.serifMedium, fontSize: 15.5, color: C.text },
  noLimitBody: { marginTop: 3, fontFamily: F.sans, fontSize: 10.5, lineHeight: 15, color: C.textSecondary },
  limitValueRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  limitLabel: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.6, color: C.textMuted },
  limitValue: { marginTop: 2, fontFamily: F.serifMedium, fontSize: 31, color: C.text, fontVariant: ['tabular-nums'] },
  limitScope: { marginBottom: 5, fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.3, color: C.goldDark },
  sectionLabel: { marginTop: 4, fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.8, color: C.textMuted },
  sectionLabelNoMargin: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.8, color: C.textMuted },
  strengthRow: { flexDirection: 'row', gap: 8 },
  strengthOption: { flex: 1, minHeight: 82, borderRadius: 15, borderCurve: 'continuous', borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, padding: 11 },
  looseOptionOn: { borderColor: '#D9BA70', backgroundColor: '#FFF4D8' },
  strictOptionOn: { borderColor: '#D99AA6', backgroundColor: '#F8E7EA' },
  strengthName: { fontFamily: F.serifMedium, fontSize: 17, color: C.text },
  looseText: { color: '#93651E' },
  strictText: { color: '#A24351' },
  strengthDetail: { marginTop: 3, fontFamily: F.sans, fontSize: 9.5, lineHeight: 13.5, color: C.textSecondary },
  checkInRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, paddingHorizontal: 2 },
  checkInTitle: { fontFamily: F.serifMedium, fontSize: 15.5, color: C.text },
  checkInBody: { marginTop: 2, fontFamily: F.sans, fontSize: 9.5, lineHeight: 13.5, color: C.textSecondary },
  practiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  practiceChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, paddingHorizontal: 11, paddingVertical: 7 },
  practiceChipOn: { borderColor: C.gold, backgroundColor: C.goldLight },
  practiceText: { fontFamily: F.sansMedium, fontSize: 10.5, color: C.textSecondary },
  practiceTextOn: { fontFamily: F.sansSemiBold, color: C.goldDark },
  appSectionHeader: { marginTop: 5 },
  appSectionNote: { marginTop: 3, maxWidth: 300, fontFamily: F.sans, fontSize: 9.5, lineHeight: 14, color: C.textMuted },
  nativeRuleEmpty: { borderRadius: 14, backgroundColor: '#F1F0EC', padding: 12 },
  nativeRuleEmptyTitle: { fontFamily: F.serifMedium, fontSize: 15, color: C.text },
  nativeRuleEmptyBody: { marginTop: 3, fontFamily: F.sans, fontSize: 9.5, lineHeight: 14, color: C.textSecondary },
  newNativeRuleRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderCurve: 'continuous', borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, paddingLeft: 12, paddingRight: 6 },
  newNativeRuleInput: { flex: 1, minHeight: 44, fontFamily: F.sansMedium, fontSize: 12, color: C.text },
  newNativeRuleButton: { width: 35, height: 35, borderRadius: 11, backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
  newNativeRuleButtonDisabled: { backgroundColor: '#F0EFEB' },
  appsList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: 42 },
  appRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 2 },
  appAvatar: { width: 33, height: 33, borderRadius: 11, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  appAvatarText: { fontFamily: F.serifSemiBold, fontSize: 14 },
  appName: { fontFamily: F.serifMedium, fontSize: 15.5, color: C.text },
  appMeta: { marginTop: 2, fontFamily: F.sans, fontSize: 9.5, color: C.textMuted },
  alwaysTag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, backgroundColor: '#F8E7EA', paddingHorizontal: 8, paddingVertical: 5 },
  alwaysTagText: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 0.9, color: '#A24351' },
  expandedWrap: { marginLeft: 41, marginBottom: 12, gap: 8 },
  appEditor: { borderLeftWidth: 2, borderLeftColor: '#E5D9BD', paddingLeft: 10, gap: 9 },
  appModeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  appMode: { borderRadius: 999, borderWidth: 1, borderColor: C.border, paddingHorizontal: 10, paddingVertical: 6 },
  appModeOn: { borderColor: C.gold, backgroundColor: C.goldLight },
  appModeBlocked: { borderColor: '#D99AA6', backgroundColor: '#F8E7EA' },
  appModeText: { fontFamily: F.sansSemiBold, fontSize: 10, color: C.textSecondary },
  appModeTextOn: { color: C.goldDark },
  appModeBlockedText: { color: '#A24351' },
  removeAppRule: { marginLeft: 'auto', width: 28, height: 28, borderRadius: 14, backgroundColor: '#F0EFEB', alignItems: 'center', justifyContent: 'center' },
  appMinutesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  appEditorLabel: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.4, color: C.textMuted },
  appMinutesValue: { fontFamily: F.serifMedium, fontSize: 16, color: C.text, fontVariant: ['tabular-nums'] },
  alwaysAction: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 12, borderCurve: 'continuous', backgroundColor: '#F8E7EA', paddingHorizontal: 11 },
  alwaysActionDisabled: { backgroundColor: '#F1F0EC' },
  alwaysActionText: { fontFamily: F.sansSemiBold, fontSize: 9.5, color: '#A24351' },
});
