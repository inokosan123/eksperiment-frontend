import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { CheckSmall, Lock, Plus, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import { ESSENTIAL_APP_OPTIONS, type EssentialAppOption } from './focusContent';
import FocusCheck from './FocusCheck';
import NativeActivitySelectionButton from './NativeActivitySelectionButton';
import FocusSheetHeader from './FocusSheetHeader';
import { isNativeFocusAvailable } from './focusNativeBridge';
import {
  allCoreEssentialIds,
  designateCoreEssentialApp,
  saveOptionalEssentialApps,
  useDayPlan,
} from './dayPlanStore';

const GROUP_ORDER: EssentialAppOption['group'][] = [
  'Communication',
  'Planning',
  'Navigation',
  'Health & Safety',
  'System',
  'Other apps',
];

function appLabel(appId: string) {
  return ESSENTIAL_APP_OPTIONS.find(app => app.id === appId)?.name ?? appId;
}

export default function EssentialAppsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const state = useDayPlan();
  const nativeAvailable = isNativeFocusAvailable();
  const [query, setQuery] = useState('');
  const [corePickerOpen, setCorePickerOpen] = useState(false);
  const [pendingCoreId, setPendingCoreId] = useState<string | null>(null);
  const coreIds = useMemo(() => new Set(allCoreEssentialIds(state)), [state]);
  const selectedIds = useMemo(() => new Set(state.optionalEssentialAppIds), [state.optionalEssentialAppIds]);
  const blockedIds = useMemo(
    () => new Set(state.alwaysBlockedApps.map(entry => entry.appId)),
    [state.alwaysBlockedApps]
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();

  const coreApps = useMemo(
    () => Array.from(coreIds).map(id => ({ id, name: appLabel(id) })).sort((a, b) => a.name.localeCompare(b.name)),
    [coreIds]
  );
  const optionalApps = useMemo(
    () => ESSENTIAL_APP_OPTIONS
      .filter(app => !coreIds.has(app.id))
      .filter(app => !normalizedQuery || app.name.toLocaleLowerCase().includes(normalizedQuery))
      .sort((a, b) => {
        const groupDiff = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
        return groupDiff || a.name.localeCompare(b.name);
      }),
    [coreIds, normalizedQuery]
  );

  const toggleOptional = (appId: string) => {
    if (coreIds.has(appId) || blockedIds.has(appId)) return;
    saveOptionalEssentialApps(
      selectedIds.has(appId)
        ? state.optionalEssentialAppIds.filter(id => id !== appId)
        : [...state.optionalEssentialAppIds, appId]
    );
  };

  const coreCandidates = optionalApps.filter(app => !selectedIds.has(app.id));

  return (
    <>
      <SmoothBottomSheet visible={visible} onClose={onClose} sheetStyle={s.sheet} keyboardAware>
        <FocusSheetHeader
          kicker="GLOBAL SAFETY ALLOWLIST"
          title="Essential Apps"
          subtitle="Essentials stay available through ordinary plan limits. Their use still counts toward your Daily Target."
          onClose={onClose}
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.scrollContent}
        >
          <View style={s.sectionHeader}>
            <View>
              <Text style={s.sectionLabel}>CORE ESSENTIALS</Text>
              <Text style={s.sectionNote}>Critical iPhone access stays available and locked.</Text>
            </View>
            <Lock s={15} c={C.goldDark} w={2.2} />
          </View>
          <View style={s.coreGrid}>
            {coreApps.map(app => (
              <View key={app.id} style={s.coreChip}>
                <Lock s={10} c={C.goldDark} w={2.2} />
                <Text style={s.coreChipText}>{app.name}</Text>
              </View>
            ))}
          </View>
          <Text style={s.systemAccessNote}>
            iOS also keeps certain system tools available by design. They may remain reachable even when they are not selected in Anasta.
          </Text>

          {nativeAvailable ? (
            <NativeActivitySelectionButton
              selectionId="core.designated"
              title="Add Permanent Core Apps"
              label="Add Camera, Wallet, financial, or access apps"
            />
          ) : <TouchableOpacity
            style={s.financialRow}
            activeOpacity={0.76}
            onPress={() => setCorePickerOpen(current => !current)}
          >
            <View style={s.plusIcon}><Plus s={13} c={C.goldDark} w={2.5} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.financialTitle}>Add a financial or access app</Text>
              <Text style={s.financialBody}>Banking, payments, authenticators, or password managers.</Text>
            </View>
          </TouchableOpacity>}

          {!nativeAvailable && corePickerOpen && (
            <Animated.View entering={FadeIn.duration(200)} style={s.corePicker}>
              <Text style={s.coreWarning}>Core status is permanent in ordinary settings. Choose only an app you need for money or account access.</Text>
              {coreCandidates.slice(0, 12).map(app => {
                const blocked = blockedIds.has(app.id);
                return (
                  <TouchableOpacity
                    key={app.id}
                    style={[s.coreCandidateRow, blocked && s.rowDisabled]}
                    disabled={blocked}
                    onPress={() => setPendingCoreId(app.id)}
                    activeOpacity={0.72}
                  >
                    <Text style={s.coreCandidateName}>{app.name}</Text>
                    <Text style={s.coreCandidateAction}>{blocked ? 'Always Blocked' : 'Make Core'}</Text>
                  </TouchableOpacity>
                );
              })}
            </Animated.View>
          )}

          <View style={s.sectionHeader}>
            <View>
              <Text style={s.sectionLabel}>OPTIONAL ESSENTIALS</Text>
              <Text style={s.sectionNote}>
                {nativeAvailable ? 'Choose your starter set privately in Apple\'s picker.' : `${selectedIds.size} currently available.`}
              </Text>
            </View>
          </View>

          <NativeActivitySelectionButton
            selectionId="global.essentials"
            title="Choose Optional Essentials"
            label="Choose Optional Essentials on iPhone"
          />

          {!nativeAvailable && selectedIds.size > 0 && (
            <View style={s.selectedWrap}>
              {state.optionalEssentialAppIds.map(appId => (
                <TouchableOpacity
                  key={appId}
                  style={s.selectedChip}
                  onPress={() => toggleOptional(appId)}
                  haptic="selection"
                >
                  <CheckSmall s={11} c="#fff" w={2.8} />
                  <Text style={s.selectedChipText}>{appLabel(appId)}</Text>
                  <X s={10} c="rgba(255,255,255,0.8)" w={2.2} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {!nativeAvailable && <View style={s.searchSurface}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Find an app"
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={s.searchInput}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
                <X s={14} c={C.textMuted} w={2.2} />
              </TouchableOpacity>
            )}
          </View>}

          {!nativeAvailable && <View style={s.appList}>
            {optionalApps.map((app, index) => {
              const previous = optionalApps[index - 1];
              const showGroup = index === 0 || previous.group !== app.group;
              const selected = selectedIds.has(app.id);
              const blocked = blockedIds.has(app.id);
              return (
                <Animated.View key={app.id} layout={LinearTransition.duration(180)}>
                  {showGroup && <Text style={s.groupLabel}>{app.group.toUpperCase()}</Text>}
                  <TouchableOpacity
                    style={[s.appRow, blocked && s.rowDisabled]}
                    onPress={() => toggleOptional(app.id)}
                    disabled={blocked}
                    haptic="selection"
                    activeOpacity={0.72}
                  >
                    <View style={[s.monogram, selected && s.monogramOn]}>
                      <Text style={[s.monogramText, selected && s.monogramTextOn]}>{app.name[0]}</Text>
                    </View>
                    <Text style={s.appName}>{app.name}</Text>
                    {blocked ? (
                      <View style={s.blockedTag}>
                        <Lock s={9} c="#A24351" w={2.2} />
                        <Text style={s.blockedText}>Always Blocked</Text>
                      </View>
                    ) : (
                      <FocusCheck checked={selected} />
                    )}
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>}
        </ScrollView>
      </SmoothBottomSheet>

      <ConfirmModal
        visible={pendingCoreId !== null}
        icon={<Lock s={21} c={C.goldDark} w={2.2} />}
        iconBg={C.goldLight}
        title="Make this app Core?"
        body="Core Essentials cannot be switched off through ordinary settings. Use this only for money, authentication, or account access."
        subject={pendingCoreId ? appLabel(pendingCoreId) : undefined}
        confirmLabel="MAKE CORE"
        onCancel={() => setPendingCoreId(null)}
        onConfirm={() => {
          if (pendingCoreId) designateCoreEssentialApp(pendingCoreId);
          setPendingCoreId(null);
        }}
      />
    </>
  );
}

const s = StyleSheet.create({
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 24, maxHeight: '94%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E0DA', marginTop: 10 },
  headerRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  eyebrow: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: C.gold },
  title: { marginTop: 3, fontFamily: F.serifMedium, fontSize: 27, color: C.text },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0EFEA', alignItems: 'center', justifyContent: 'center' },
  subtitle: { marginTop: 5, fontFamily: F.serifItalic, fontSize: 14.5, lineHeight: 20, color: C.textSecondary },
  scrollContent: { paddingTop: 18, paddingBottom: 28, gap: 14 },
  sectionHeader: { marginTop: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 3 },
  sectionLabel: { fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 2, color: C.textMuted },
  sectionNote: { marginTop: 2, fontFamily: F.sans, fontSize: 10, color: C.textMuted },
  coreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  coreChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1, borderColor: '#E6D7B5', backgroundColor: '#FFF9EB', paddingHorizontal: 9, paddingVertical: 6 },
  coreChipText: { fontFamily: F.sansSemiBold, fontSize: 9.5, color: C.goldDark },
  systemAccessNote: { fontFamily: F.sans, fontSize: 9.5, lineHeight: 14, color: C.textMuted, paddingHorizontal: 3 },
  financialRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 11, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, paddingHorizontal: 3 },
  plusIcon: { width: 31, height: 31, borderRadius: 11, borderCurve: 'continuous', backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
  financialTitle: { fontFamily: F.serifMedium, fontSize: 15.5, color: C.text },
  financialBody: { marginTop: 2, fontFamily: F.sans, fontSize: 10, color: C.textSecondary },
  corePicker: { borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E5D9BD', backgroundColor: '#FFFDF7', padding: 11 },
  coreWarning: { marginBottom: 7, fontFamily: F.sans, fontSize: 9.5, lineHeight: 14, color: C.textSecondary },
  coreCandidateRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  coreCandidateName: { flex: 1, fontFamily: F.sansMedium, fontSize: 11, color: C.text },
  coreCandidateAction: { fontFamily: F.sansSemiBold, fontSize: 9, color: C.goldDark },
  selectedWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  selectedChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, backgroundColor: C.gold, paddingHorizontal: 9, paddingVertical: 6 },
  selectedChipText: { fontFamily: F.sansSemiBold, fontSize: 9.5, color: '#fff' },
  searchSurface: { height: 44, flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderCurve: 'continuous', borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, paddingHorizontal: 13 },
  searchInput: { flex: 1, fontFamily: F.sansMedium, fontSize: 12.5, color: C.text },
  appList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  groupLabel: { marginTop: 13, marginBottom: 3, paddingHorizontal: 3, fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.7, color: C.textMuted },
  appRow: { minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, paddingHorizontal: 3 },
  rowDisabled: { opacity: 0.52 },
  monogram: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#F0EFEB', alignItems: 'center', justifyContent: 'center' },
  monogramOn: { backgroundColor: C.goldLight },
  monogramText: { fontFamily: F.sansBold, fontSize: 12, color: C.textMuted },
  monogramTextOn: { color: C.goldDark },
  appName: { flex: 1, fontFamily: F.serifMedium, fontSize: 15, color: C.text },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#D6D3D1', alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface },
  checkboxOn: { borderColor: C.gold, backgroundColor: C.gold },
  blockedTag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, backgroundColor: '#F8E7EA', paddingHorizontal: 7, paddingVertical: 5 },
  blockedText: { fontFamily: F.sansSemiBold, fontSize: 8, color: '#A24351' },
});
