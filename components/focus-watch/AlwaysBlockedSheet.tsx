import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { Lock, Plus, Trash2, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import { ESSENTIAL_APP_OPTIONS, PREVIEW_APPS } from './focusContent';
import NativeActivitySelectionButton from './NativeActivitySelectionButton';
import { isNativeFocusAvailable } from './focusNativeBridge';
import { refreshNativeActivitySelectionSummary } from './nativeSelectionSummaryStore';
import {
  allCoreEssentialIds,
  removeAlwaysBlockedApp,
  saveAlwaysBlockedApp,
  useDayPlan,
  type Strength,
} from './dayPlanStore';

function nameFor(appId: string) {
  return PREVIEW_APPS.find(app => app.id === appId)?.name
    ?? ESSENTIAL_APP_OPTIONS.find(app => app.id === appId)?.name
    ?? appId;
}

export default function AlwaysBlockedSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const state = useDayPlan();
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

  const updateStrength = (appId: string, strength: Strength) => {
    const current = state.alwaysBlockedApps.find(rule => rule.appId === appId);
    if (!current) return;
    saveAlwaysBlockedApp({ ...current, strength });
  };

  return (
    <>
      <SmoothBottomSheet visible={visible} onClose={onClose} sheetStyle={s.sheet}>
        <View style={s.handle} />
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>PERMANENT INTENT</Text>
            <Text style={s.title}>Always Blocked</Text>
          </View>
          <TouchableOpacity style={s.closeBtn} onPress={onClose} hitSlop={10}><X s={17} c={C.textMuted} w={2.2} /></TouchableOpacity>
        </View>
        <Text style={s.subtitle}>These apps stay outside ordinary plans and Quiet Hour Essentials.</Text>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
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
              <View style={s.emptyIcon}><Lock s={20} c={C.goldDark} w={2} /></View>
              <Text style={s.emptyTitle}>Nothing is permanently closed.</Text>
              <Text style={s.emptyBody}>Use Always Blocked for an app you want to enter only through a deliberate Loose gateway, or never through a Strict shield.</Text>
            </View>
          ) : (
            <View style={s.blockedList}>
              {state.alwaysBlockedApps.map((rule, index) => (
                <View key={rule.appId}>
                  {index > 0 && <View style={s.separator} />}
                  <View style={s.blockedRow}>
                    <View style={s.appMark}><Text style={s.appMarkText}>{nameFor(rule.appId)[0]}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.appName}>{nameFor(rule.appId)}</Text>
                      <Text style={s.appMeta}>{rule.strength === 'strict' ? 'No continuation' : '15-minute intentional gateway'}</Text>
                    </View>
                    <View style={s.strengthControl}>
                      {(['loose', 'strict'] as Strength[]).map(strength => (
                        <TouchableOpacity
                          key={strength}
                          style={[
                            s.strengthOption,
                            rule.strength === strength && (strength === 'strict' ? s.strictOn : s.looseOn),
                          ]}
                          onPress={() => updateStrength(rule.appId, strength)}
                          haptic="selection"
                        >
                          <Text style={[
                            s.strengthText,
                            rule.strength === strength && (strength === 'strict' ? s.strictText : s.looseText),
                          ]}>{strength === 'strict' ? 'S' : 'L'}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TouchableOpacity onPress={() => setPendingRemove(rule.appId)} hitSlop={8}><Trash2 s={14} c={C.textMuted} w={2} /></TouchableOpacity>
                  </View>
                </View>
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

      <ConfirmModal
        visible={pendingRemove !== null}
        icon={<Lock s={20} c="#A24351" w={2.2} />}
        iconBg="#F8E7EA"
        title="Remove Always Blocked?"
        body="The app will return to ordinary Daily or Session rules. This does not make it Essential."
        subject={pendingRemove ? nameFor(pendingRemove) : undefined}
        confirmLabel="REMOVE"
        confirmColor="#A24351"
        onCancel={() => setPendingRemove(null)}
        onConfirm={() => { if (pendingRemove) removeAlwaysBlockedApp(pendingRemove); setPendingRemove(null); }}
      />
    </>
  );
}

const s = StyleSheet.create({
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 24, maxHeight: '92%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E0DA', marginTop: 10 },
  headerRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  eyebrow: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: '#A24351' },
  title: { marginTop: 3, fontFamily: F.serifMedium, fontSize: 27, color: C.text },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0EFEA', alignItems: 'center', justifyContent: 'center' },
  subtitle: { marginTop: 5, fontFamily: F.serifItalic, fontSize: 14.5, lineHeight: 20, color: C.textSecondary },
  content: { paddingTop: 17, paddingBottom: 28, gap: 13 },
  empty: { minHeight: 160, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, paddingHorizontal: 24 },
  emptyIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { marginTop: 10, fontFamily: F.serifMedium, fontSize: 18, color: C.text },
  emptyBody: { marginTop: 3, fontFamily: F.sans, fontSize: 9.5, lineHeight: 14, color: C.textSecondary, textAlign: 'center' },
  blockedList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: 42 },
  blockedRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 9 },
  appMark: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F8E7EA', alignItems: 'center', justifyContent: 'center' },
  appMarkText: { fontFamily: F.sansBold, fontSize: 12, color: '#A24351' },
  appName: { fontFamily: F.sansSemiBold, fontSize: 11.5, color: C.text },
  appMeta: { marginTop: 2, fontFamily: F.sans, fontSize: 8.5, color: C.textMuted },
  strengthControl: { flexDirection: 'row', gap: 3, borderRadius: 999, backgroundColor: '#EEECE7', padding: 2 },
  strengthOption: { width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  looseOn: { backgroundColor: '#FFF0C5' },
  strictOn: { backgroundColor: '#F3CBD2' },
  strengthText: { fontFamily: F.sansBold, fontSize: 8, color: C.textMuted },
  looseText: { color: '#95681F' },
  strictText: { color: '#A24351' },
  addButton: { height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#DDCEAD', backgroundColor: '#FFFDF7' },
  plusIcon: { width: 24, height: 24, borderRadius: 8, backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
  addText: { fontFamily: F.sansSemiBold, fontSize: 10.5, color: C.goldDark },
  availableList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  listLabel: { marginTop: 10, marginBottom: 4, fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.6, color: C.textMuted },
  availableRow: { minHeight: 45, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  disabled: { opacity: 0.5 },
  availableName: { flex: 1, fontFamily: F.sansMedium, fontSize: 11.5, color: C.text },
  essentialTag: { fontFamily: F.sansSemiBold, fontSize: 8, color: C.textMuted },
  nativeBuckets: { gap: 11 },
  nativeBucketCopy: { paddingHorizontal: 3 },
  nativeBucketTitle: { fontFamily: F.serifMedium, fontSize: 18, color: C.text },
  nativeBucketBody: { marginTop: 2, fontFamily: F.sans, fontSize: 9.5, lineHeight: 14, color: C.textSecondary },
  nativeBucketDivider: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginVertical: 4 },
});
