import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { Lock, Plus, X } from '@/components/icons/Icons';
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

  const coreCandidates = useMemo(
    () => ESSENTIAL_APP_OPTIONS
      .filter(app => !coreIds.has(app.id) && !selectedIds.has(app.id))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [coreIds, selectedIds]
  );

  const closeSheet = () => {
    setQuery('');
    setCorePickerOpen(false);
    setPendingCoreId(null);
    onClose();
  };

  return (
    <SmoothBottomSheet
      visible={visible}
      onClose={closeSheet}
      sheetStyle={s.sheet}
      keyboardAware
      overlayChildren={(
        <ConfirmModal
          visible={pendingCoreId !== null}
          icon={<Lock s={21} c={C.goldDark} w={2.2} />}
          iconBg={C.goldLight}
          title="Make this app permanent?"
          body="Permanent Essentials cannot be switched off through ordinary settings. Use this only for banking, authentication, or account access."
          subject={pendingCoreId ? appLabel(pendingCoreId) : undefined}
          confirmLabel="MAKE PERMANENT"
          onCancel={() => setPendingCoreId(null)}
          onConfirm={() => {
            if (pendingCoreId) designateCoreEssentialApp(pendingCoreId);
            setPendingCoreId(null);
          }}
          embedded
        />
      )}
    >
      <FocusSheetHeader
        kicker="ALWAYS AVAILABLE"
        title="Essential Apps"
        subtitle="Choose the apps you must always be able to reach. They stay available after your tolerance ends, while their use still counts toward your Daily Target."
        onClose={closeSheet}
        large
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scrollContent}
      >
        <LinearGradient
          colors={['#FFF5D9', '#FFFDF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.coreCard}
        >
          <View pointerEvents="none" style={s.coreGlow} />
          <View style={s.coreCardHeader}>
            <View style={s.coreIcon}><Lock s={20} c={C.goldDark} w={2.2} /></View>
            <View style={s.coreCardCopy}>
              <Text style={s.coreEyebrow}>CORE ACCESS</Text>
              <Text style={s.coreTitle}>Always within reach</Text>
            </View>
            <View style={s.alwaysOnPill}><Text style={s.alwaysOnText}>ALWAYS ON</Text></View>
          </View>
          <Text style={s.coreBody}>
            Phone, Messages, FaceTime and Maps stay available for safety. iOS may also keep critical system tools reachable.
          </Text>
          <View style={s.coreGrid}>
            {coreApps.map(app => (
              <View key={app.id} style={s.coreChip}>
                <Text style={s.coreChipText}>{app.name}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <View style={s.permanentSection}>
          <Text style={s.permanentTitle}>Need another app always available?</Text>
          <Text style={s.permanentBody}>
            Reserve permanent access for banking, authentication, payments, or account recovery.
          </Text>
          {nativeAvailable ? (
            <NativeActivitySelectionButton
              selectionId="core.designated"
              title="Choose Permanent Essentials"
              label="Add a permanent essential"
              prominent
            />
          ) : (
            <TouchableOpacity
              style={s.permanentButton}
              activeOpacity={0.76}
              onPress={() => setCorePickerOpen(current => !current)}
            >
              <View style={s.plusIcon}><Plus s={15} c={C.goldDark} w={2.5} /></View>
              <Text style={s.permanentButtonText}>
                {corePickerOpen ? 'Hide permanent app choices' : 'Choose a permanent essential'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {!nativeAvailable && corePickerOpen && (
          <Animated.View entering={FadeIn.duration(200)} style={s.corePicker}>
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
                  <Text style={[s.coreCandidateAction, blocked && s.coreCandidateBlocked]}>
                    {blocked ? 'Always Blocked' : 'Make permanent'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        )}

        <View style={s.sectionDivider} />

        <View style={s.optionalIntro}>
          <Text style={s.sectionLabel}>YOUR ESSENTIALS</Text>
          <Text style={s.sectionTitle}>Choose what stays reachable</Text>
          <Text style={s.sectionBody}>
            Keep this list short: only apps you may genuinely need after the rest of the phone closes.
          </Text>
        </View>

        {nativeAvailable ? (
          <NativeActivitySelectionButton
            selectionId="global.essentials"
            title="Choose Essential Apps"
            label="Choose essential apps"
            prominent
          />
        ) : (
          <>
            <View style={s.searchSurface}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search apps"
                placeholderTextColor={C.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                style={s.searchInput}
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
                  <X s={16} c={C.textMuted} w={2.2} />
                </TouchableOpacity>
              )}
            </View>

            <View style={s.appList}>
              {optionalApps.map((app, index) => {
                const previous = optionalApps[index - 1];
                const showGroup = index === 0 || previous.group !== app.group;
                const selected = selectedIds.has(app.id);
                const blocked = blockedIds.has(app.id);
                return (
                  <Animated.View key={app.id} layout={LinearTransition.duration(180)}>
                    {showGroup && <Text style={s.groupLabel}>{app.group.toUpperCase()}</Text>}
                    <TouchableOpacity
                      style={[s.appRow, selected && s.appRowSelected, blocked && s.rowDisabled]}
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
                          <Lock s={10} c="#A24351" w={2.2} />
                          <Text style={s.blockedText}>Always Blocked</Text>
                        </View>
                      ) : (
                        <FocusCheck checked={selected} size={24} />
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SmoothBottomSheet>
  );
}

const s = StyleSheet.create({
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 18,
    paddingBottom: 24,
    maxHeight: '94%',
  },
  scrollContent: { paddingTop: 20, paddingBottom: 32, gap: 20 },
  coreCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E7D4A7',
    padding: 16,
    boxShadow: '0 9px 24px rgba(77, 61, 27, 0.09)',
  },
  coreGlow: {
    position: 'absolute',
    right: -44,
    top: -58,
    width: 172,
    height: 172,
    borderRadius: 86,
    backgroundColor: 'rgba(218, 174, 78, 0.15)',
  },
  coreCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  coreIcon: {
    flexShrink: 0,
    width: 44,
    height: 44,
    borderRadius: 15,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreCardCopy: { flex: 1, minWidth: 0 },
  coreEyebrow: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.8, color: C.goldDark },
  coreTitle: { marginTop: 2, fontFamily: F.serifSemiBold, fontSize: 20.5, lineHeight: 24, color: '#3D3322' },
  alwaysOnPill: { flexShrink: 0, borderRadius: 999, backgroundColor: C.gold, paddingHorizontal: 8, paddingVertical: 5 },
  alwaysOnText: { fontFamily: F.sansBold, fontSize: 7.5, letterSpacing: 1, color: '#FFFFFF' },
  coreBody: { marginTop: 13, fontFamily: F.sans, fontSize: 14, lineHeight: 20, color: '#675B45' },
  coreGrid: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  coreChip: { borderRadius: 999, borderWidth: 1, borderColor: 'rgba(180,142,60,0.24)', backgroundColor: 'rgba(255,255,255,0.68)', paddingHorizontal: 11, paddingVertical: 7 },
  coreChipText: { fontFamily: F.sansSemiBold, fontSize: 12, color: C.goldDark },
  permanentSection: { gap: 7, paddingHorizontal: 2 },
  permanentTitle: { fontFamily: F.serifSemiBold, fontSize: 18.5, lineHeight: 22, color: C.text },
  permanentBody: { fontFamily: F.sans, fontSize: 13.5, lineHeight: 19, color: C.textSecondary },
  permanentButton: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E5D7B7',
    backgroundColor: '#FFF9EB',
    paddingHorizontal: 12,
    marginTop: 4,
  },
  plusIcon: { width: 36, height: 36, borderRadius: 12, borderCurve: 'continuous', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  permanentButtonText: { flex: 1, fontFamily: F.serifSemiBold, fontSize: 16.5, color: C.text },
  corePicker: { overflow: 'hidden', borderRadius: 19, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E5D9BD', backgroundColor: '#FFFDF7', paddingHorizontal: 13 },
  coreCandidateRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  coreCandidateName: { flex: 1, fontFamily: F.serifMedium, fontSize: 15.5, color: C.text },
  coreCandidateAction: { fontFamily: F.sansSemiBold, fontSize: 11, color: C.goldDark },
  coreCandidateBlocked: { color: '#A24351' },
  sectionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginVertical: 2 },
  optionalIntro: { gap: 4, paddingHorizontal: 2 },
  sectionLabel: { fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 1.9, color: C.goldDark },
  sectionTitle: { fontFamily: F.serifSemiBold, fontSize: 22, lineHeight: 26, color: C.text },
  sectionBody: { fontFamily: F.sans, fontSize: 14, lineHeight: 20, color: C.textSecondary },
  searchSurface: { height: 50, flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontFamily: F.sansMedium, fontSize: 14, color: C.text },
  appList: { paddingBottom: 4 },
  groupLabel: { marginTop: 14, marginBottom: 7, paddingHorizontal: 4, fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 1.7, color: C.textMuted },
  appRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 17, borderCurve: 'continuous', borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, paddingHorizontal: 11, marginBottom: 7 },
  appRowSelected: { borderColor: '#D9BE7C', backgroundColor: '#FFF9EB' },
  rowDisabled: { opacity: 0.56 },
  monogram: { width: 38, height: 38, borderRadius: 13, borderCurve: 'continuous', backgroundColor: '#F0EFEB', alignItems: 'center', justifyContent: 'center' },
  monogramOn: { backgroundColor: '#F1E3BF' },
  monogramText: { fontFamily: F.sansBold, fontSize: 14, color: C.textMuted },
  monogramTextOn: { color: C.goldDark },
  appName: { flex: 1, fontFamily: F.serifMedium, fontSize: 16.5, color: C.text },
  blockedTag: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, backgroundColor: '#F8E7EA', paddingHorizontal: 8, paddingVertical: 6 },
  blockedText: { fontFamily: F.sansSemiBold, fontSize: 9.5, color: '#A24351' },
});
