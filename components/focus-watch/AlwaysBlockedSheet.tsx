import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, LinearTransition } from 'react-native-reanimated';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { Lock, Plus, Trash2 } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import { ESSENTIAL_APP_OPTIONS, PREVIEW_APPS } from './focusContent';
import NativeActivitySelectionButton from './NativeActivitySelectionButton';
import {
  RegisterGround,
  RegisterModeNote,
  RegisterSeal,
  RegisterStrengthControl,
  REGISTER_TONES,
} from './ProtectionRegister';
import FocusSheetHeader from './FocusSheetHeader';
import { isNativeFocusAvailable } from './focusNativeBridge';
import { refreshNativeActivitySelectionSummary } from './nativeSelectionSummaryStore';
import {
  allCoreEssentialIds,
  removeAlwaysBlockedApp,
  saveAlwaysBlockedApp,
  useDayPlanSelector,
  type DayPlanState,
  type Strength,
} from './dayPlanStore';

// The sheet speaks about the same standing boundary as the row that opened it,
// so its cards are cut from the register's cloth.
const ROSE = REGISTER_TONES.rose;
const selectAlwaysBlockedSheetState = (snapshot: DayPlanState) => snapshot;
const alwaysBlockedSheetStateEqual = (previous: DayPlanState, next: DayPlanState) => (
  previous.alwaysBlockedApps === next.alwaysBlockedApps
  && previous.optionalEssentialAppIds === next.optionalEssentialAppIds
  && previous.designatedCoreAppIds === next.designatedCoreAppIds
);

function nameFor(appId: string) {
  return PREVIEW_APPS.find(app => app.id === appId)?.name
    ?? ESSENTIAL_APP_OPTIONS.find(app => app.id === appId)?.name
    ?? appId;
}

export default function AlwaysBlockedSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const state = useDayPlanSelector(selectAlwaysBlockedSheetState, alwaysBlockedSheetStateEqual);
  const nativeAvailable = isNativeFocusAvailable();
  const [adding, setAdding] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const essentialIds = useMemo(
    () => new Set([...allCoreEssentialIds(state), ...state.optionalEssentialAppIds]),
    [state]
  );
  const blockedIds = useMemo(() => new Set(state.alwaysBlockedApps.map(rule => rule.appId)), [state.alwaysBlockedApps]);
  const available = useMemo(
    () => PREVIEW_APPS.filter(app => !blockedIds.has(app.id)).sort((a, b) => a.name.localeCompare(b.name)),
    [blockedIds]
  );
  const blockedRules = useMemo(
    () => [...state.alwaysBlockedApps].sort((a, b) => nameFor(a.appId).localeCompare(nameFor(b.appId))),
    [state.alwaysBlockedApps]
  );

  const updateStrength = (appId: string, strength: Strength) => {
    const current = state.alwaysBlockedApps.find(rule => rule.appId === appId);
    if (!current) return;
    saveAlwaysBlockedApp({ ...current, strength });
  };

  const closeSheet = () => {
    setAdding(false);
    setPendingRemove(null);
    onClose();
  };

  const removeConfirm = (
    <ConfirmModal
      embedded
      visible={pendingRemove !== null}
      icon={<Trash2 s={22} c={C.red} w={2.1} />}
      iconBg="#FEE2E2"
      title="Remove from Always Blocked?"
      body="The app will leave this system group and return to its previous app group and ordinary plan rules."
      subject={pendingRemove ? nameFor(pendingRemove) : undefined}
      confirmLabel="REMOVE"
      confirmColor={C.red}
      onCancel={() => setPendingRemove(null)}
      onConfirm={() => {
        if (pendingRemove) removeAlwaysBlockedApp(pendingRemove);
        setPendingRemove(null);
      }}
    />
  );

  return (
    <SmoothBottomSheet
      visible={visible}
      onClose={closeSheet}
      sheetStyle={s.sheet}
      overlayChildren={removeConfirm}
    >
        <FocusSheetHeader
          title="Always Blocked"
          onClose={closeSheet}
          centered
        />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
          <Text style={s.description}>
            These apps stay outside ordinary plans and Quiet Hour Essentials —
            closed by a decision you made once, for good.
          </Text>
          {nativeAvailable ? (
            <View style={s.nativeBuckets}>
              <View style={s.nativeBucketCopy}>
                <Text style={s.nativeBucketTitle}>Strict Always Blocked</Text>
                <Text style={s.nativeBucketBody}>These apps cannot open through the shield.</Text>
              </View>
              <NativeActivitySelectionButton
                selectionId="always.strict"
                title="Choose Strict Always Blocked Apps"
                label="Choose Strict apps"
                onSelected={() => { void refreshNativeActivitySelectionSummary('always.loose'); }}
              />
              <View style={s.nativeBucketDivider} />
              <View style={s.nativeBucketCopy}>
                <Text style={s.nativeBucketTitle}>Loose Always Blocked</Text>
                <Text style={s.nativeBucketBody}>These apps open only through an intentional 15-minute gateway.</Text>
              </View>
              <NativeActivitySelectionButton
                selectionId="always.loose"
                title="Choose Loose Always Blocked Apps"
                label="Choose Loose apps"
                onSelected={() => { void refreshNativeActivitySelectionSummary('always.strict'); }}
              />
            </View>
          ) : state.alwaysBlockedApps.length === 0 ? (
            <View style={s.empty}>
              <RegisterSeal tone={ROSE} size={46}><Lock s={20} c={ROSE.accent} w={2} /></RegisterSeal>
              <Text style={s.emptyTitle}>Nothing is permanently closed.</Text>
              <Text style={s.emptyBody}>Use Always Blocked for an app you want to enter only through a deliberate Loose gateway, or never through a Strict shield.</Text>
            </View>
          ) : (
            <View style={s.blockedCards}>
              {blockedRules.map((rule, index) => (
                <Animated.View
                  key={rule.appId}
                  entering={FadeInDown.duration(220).delay(Math.min(index, 5) * 35)}
                  exiting={FadeOutUp.duration(180)}
                  layout={LinearTransition.duration(220)}
                  style={s.appCard}
                >
                  <RegisterGround tone={ROSE} tall />
                  <View style={s.cardHeader}>
                    <View style={s.appIdentity}>
                      <RegisterSeal tone={ROSE} size={46} style={s.appSeal}>
                        <Text style={s.appIconPreviewText}>{nameFor(rule.appId)[0]}</Text>
                      </RegisterSeal>
                      <View style={s.appTitleWrap}>
                        <Text style={s.appName} numberOfLines={1}>{nameFor(rule.appId)}</Text>
                        <Text style={s.appSystemLabel}>IPHONE APP</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={s.removeButton}
                      onPress={() => setPendingRemove(rule.appId)}
                      haptic="medium"
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${nameFor(rule.appId)} from Always Blocked`}
                    >
                      <Trash2 s={18} c={C.red} w={2.1} />
                    </TouchableOpacity>
                  </View>

                  <View style={s.strengthSection}>
                    <Text style={s.strengthLabel}>BLOCKING MODE</Text>
                    <RegisterStrengthControl
                      value={rule.strength}
                      onChange={strength => updateStrength(rule.appId, strength)}
                    />
                    <RegisterModeNote
                      strength={rule.strength}
                      text={rule.strength === 'strict'
                        ? 'This app stays closed with no continuation option.'
                        : 'Opening it requires a deliberate 15-minute gateway.'}
                    />
                  </View>
                </Animated.View>
              ))}
            </View>
          )}

          {!nativeAvailable && <TouchableOpacity style={s.addButton} onPress={() => setAdding(current => !current)}>
            <View style={s.plusIcon}><Plus s={13} c={C.goldDark} w={2.5} /></View>
            <Text style={s.addText}>Add an app</Text>
          </TouchableOpacity>}

          {!nativeAvailable && adding && (
            <View style={s.availableList}>
              <Text style={s.listLabel}>AVAILABLE APPS</Text>
              {available.map(app => {
                const essential = essentialIds.has(app.id);
                return (
                  <TouchableOpacity
                    key={app.id}
                    style={[s.availableRow, essential && s.disabled]}
                    disabled={essential}
                    onPress={() => saveAlwaysBlockedApp({ appId: app.id, strength: 'strict', practice: 'prayer' })}
                    haptic="selection"
                  >
                    <Text style={s.availableName}>{app.name}</Text>
                    {essential ? <Text style={s.essentialTag}>Remove from Essentials first</Text> : <Plus s={14} c={C.goldDark} w={2.4} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
    </SmoothBottomSheet>
  );
}

const s = StyleSheet.create({
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 34, borderTopRightRadius: 34, paddingHorizontal: 18, paddingBottom: 24, maxHeight: '92%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E0DA', marginTop: 10 },
  headerRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  eyebrow: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: '#A24351' },
  title: { marginTop: 3, fontFamily: F.serifMedium, fontSize: 27, color: C.text },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0EFEA', alignItems: 'center', justifyContent: 'center' },
  subtitle: { marginTop: 5, fontFamily: F.serifItalic, fontSize: 14.5, lineHeight: 20, color: C.textSecondary },
  content: { paddingTop: 15, paddingBottom: 28, gap: 15 },
  description: { paddingRight: 10, fontFamily: F.serif, fontSize: 16, lineHeight: 22.5, color: C.textSecondary },
  empty: { minHeight: 160, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, paddingHorizontal: 24 },
  emptyTitle: { marginTop: 10, fontFamily: F.serifMedium, fontSize: 18, color: C.text },
  emptyBody: { marginTop: 4, fontFamily: F.serif, fontSize: 12.5, lineHeight: 17, color: C.textSecondary, textAlign: 'center' },
  blockedCards: { gap: 12 },
  // Same ground as the register row on the Focus screen: white, lit by the
  // accent rather than painted with it.
  appCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E7C4CB',
    backgroundColor: C.surface,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 13,
    boxShadow: '0 7px 20px rgba(111, 45, 60, 0.07)',
  },
  cardHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  appIdentity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 11 },
  appSeal: { marginHorizontal: 0 },
  appIconPreviewText: { fontFamily: F.serifSemiBold, fontSize: 19, color: '#A24351' },
  appTitleWrap: { flex: 1, minWidth: 0, paddingTop: 3 },
  appName: { fontFamily: F.serifSemiBold, fontSize: 19, lineHeight: 23, color: C.text },
  appSystemLabel: { marginTop: 3, fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.45, color: '#AA7A84' },
  strengthSection: { gap: 7 },
  strengthLabel: { paddingLeft: 2, fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.7, color: C.textMuted },
  removeButton: { width: 42, height: 42, borderRadius: 13, borderCurve: 'continuous', borderWidth: 1, borderColor: '#F3C7C7', backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  addButton: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 15, borderCurve: 'continuous', borderWidth: 1, borderStyle: 'dashed', borderColor: '#DDCEAD', backgroundColor: '#FFFDF7' },
  plusIcon: { width: 26, height: 26, borderRadius: 9, backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
  addText: { fontFamily: F.serifSemiBold, fontSize: 15, color: C.goldDark },
  availableList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  listLabel: { marginTop: 10, marginBottom: 4, fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 1.8, color: C.textMuted },
  availableRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  disabled: { opacity: 0.5 },
  availableName: { flex: 1, fontFamily: F.serifMedium, fontSize: 16, color: C.text },
  essentialTag: { fontFamily: F.sansSemiBold, fontSize: 9.5, color: C.textMuted },
  nativeBuckets: { gap: 11 },
  nativeBucketCopy: { paddingHorizontal: 3 },
  nativeBucketTitle: { fontFamily: F.serifMedium, fontSize: 18.5, color: C.text },
  nativeBucketBody: { marginTop: 3, fontFamily: F.serif, fontSize: 13, lineHeight: 17.5, color: C.textSecondary },
  nativeBucketDivider: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginVertical: 4 },
});
