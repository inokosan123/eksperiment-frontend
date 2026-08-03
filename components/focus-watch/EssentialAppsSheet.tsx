import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { Lock, Trash2, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import { AlwaysBlockedRow } from './AlwaysBlockedList';
import { ESSENTIAL_APP_OPTIONS } from './focusContent';
import FocusCheck from './FocusCheck';
import NativeActivitySelectionButton from './NativeActivitySelectionButton';
import FocusSheetHeader from './FocusSheetHeader';
import { isNativeFocusAvailable } from './focusNativeBridge';
import { useNativeActivitySelectionSummary } from './nativeSelectionSummaryStore';
import {
  allCoreEssentialIds,
  saveOptionalEssentialApps,
  useDayPlan,
} from './dayPlanStore';

// One simple story, three sections: what is locked for safety, what you chose,
// and everything else. No cards inside cards — just clear lists with a plain
// sentence above each one.

function appLabel(appId: string) {
  return ESSENTIAL_APP_OPTIONS.find(app => app.id === appId)?.name ?? appId;
}

function SectionHeading({ label, note }: { label: string; note: string }) {
  return (
    <View style={s.sectionHeading}>
      <Text style={s.sectionLabel}>{label}</Text>
      <Text style={s.sectionNote}>{note}</Text>
    </View>
  );
}

export default function EssentialAppsSheet({
  visible,
  onClose,
  planId,
  planAppIds = [],
  onChangePlanApps,
}: {
  visible: boolean;
  onClose: () => void;
  planId?: string;
  planAppIds?: string[];
  onChangePlanApps?: (appIds: string[]) => void;
}) {
  const state = useDayPlan();
  const nativeAvailable = isNativeFocusAvailable();
  const alwaysStrictSummary = useNativeActivitySelectionSummary('always.strict');
  const alwaysLooseSummary = useNativeActivitySelectionSummary('always.loose');
  const planMode = !!planId;
  const [query, setQuery] = useState('');
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const coreIds = useMemo(() => new Set([
    ...allCoreEssentialIds(state),
    ...(planMode ? state.optionalEssentialAppIds : []),
  ]), [planMode, state]);
  const selectedSource = planMode ? planAppIds : state.optionalEssentialAppIds;
  const selectedIds = useMemo(() => new Set(selectedSource), [selectedSource]);
  const blockedIds = useMemo(
    () => new Set(state.alwaysBlockedApps.map(entry => entry.appId)),
    [state.alwaysBlockedApps]
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();

  const lockedApps = useMemo(
    () => Array.from(coreIds)
      .map(id => ({ id, name: appLabel(id) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [coreIds]
  );
  const chosenApps = useMemo(
    () => ESSENTIAL_APP_OPTIONS
      .filter(app => !coreIds.has(app.id) && !blockedIds.has(app.id) && selectedIds.has(app.id))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [blockedIds, coreIds, selectedIds]
  );
  const otherApps = useMemo(
    () => ESSENTIAL_APP_OPTIONS
      .filter(app => !coreIds.has(app.id) && !selectedIds.has(app.id) && !blockedIds.has(app.id))
      .filter(app => !normalizedQuery || app.name.toLocaleLowerCase().includes(normalizedQuery))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [blockedIds, coreIds, selectedIds, normalizedQuery]
  );
  const blockedApps = useMemo(
    () => ESSENTIAL_APP_OPTIONS
      .filter(app => blockedIds.has(app.id))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [blockedIds]
  );
  const nativeBlockedCount = (alwaysStrictSummary?.applicationCount ?? 0)
    + (alwaysLooseSummary?.applicationCount ?? 0);

  const toggleOptional = (appId: string) => {
    if (coreIds.has(appId) || blockedIds.has(appId)) return;

    if (selectedIds.has(appId)) {
      setPendingRemove(appId);
      return;
    }

    const next = [...selectedSource, appId];
    if (planMode) onChangePlanApps?.(next);
    else saveOptionalEssentialApps(next);
  };

  const confirmRemove = () => {
    if (!pendingRemove) return;
    const next = selectedSource.filter(id => id !== pendingRemove);
    if (planMode) onChangePlanApps?.(next);
    else saveOptionalEssentialApps(next);
    setPendingRemove(null);
  };

  const closeSheet = () => {
    setQuery('');
    setPendingRemove(null);
    onClose();
  };

  const removeConfirm = (
    <ConfirmModal
      embedded
      visible={pendingRemove !== null}
      icon={<Trash2 s={22} c={C.red} w={2.1} />}
      iconBg="#FEE2E2"
      title="Remove from Essentials?"
      body="This app will no longer stay reachable after your daily limit is spent."
      subject={pendingRemove ? appLabel(pendingRemove) : undefined}
      confirmLabel="REMOVE"
      confirmColor={C.red}
      onCancel={() => setPendingRemove(null)}
      onConfirm={confirmRemove}
    />
  );

  return (
    <SmoothBottomSheet
      visible={visible}
      onClose={closeSheet}
      sheetStyle={s.sheet}
      keyboardAware
      overlayChildren={removeConfirm}
    >
      <FocusSheetHeader
        title={planMode ? 'Plan Apps' : 'Essential Apps'}
        onClose={closeSheet}
        centered
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scrollContent}
      >
        <Text style={s.description}>
          {planMode
            ? 'This plan protects the phone from minute one. Global Essentials stay included; add only the extra apps this plan truly needs. Their use still counts toward the Goal.'
            : 'When your daily limit is spent, the phone closes down to Essentials only. Everything on this list stays reachable — its use still counts toward your day.'}
        </Text>
        <View>
          <SectionHeading
            label={planMode ? 'Already Included' : 'Locked Essentials'}
            note={planMode
              ? 'Core access and your global Essentials stay available automatically.'
              : 'Kept reachable for safety. These are not a choice — they are always open.'}
          />
          <View style={s.list}>
            {lockedApps.map((app, index) => (
              <View key={app.id}>
                {index > 0 && <View style={s.separator} />}
                <View style={s.row}>
                  <View style={s.monogramLocked}>
                    <Text style={s.monogramLockedText}>{app.name[0]}</Text>
                  </View>
                  <Text style={s.appNameLocked}>{app.name}</Text>
                  <Lock s={14} c={C.textMuted} w={2.1} />
                </View>
              </View>
            ))}
          </View>
        </View>

        <View>
          <SectionHeading
            label={planMode ? 'Extra Apps for This Plan' : 'Your Essentials'}
            note={planMode
              ? 'These exceptions belong only to this plan. They do not become global Essentials.'
              : 'Apps you chose to keep open after everything else closes. Tap one to remove it.'}
          />
          {nativeAvailable ? (
            <NativeActivitySelectionButton
              selectionId={planMode ? `plan.${planId}.essentials` : 'global.essentials'}
              title={planMode ? 'Choose Apps for This Plan' : 'Choose Essential Apps'}
              label={planMode ? 'Choose plan-only apps' : 'Choose essential apps'}
              prominent
            />
          ) : chosenApps.length === 0 ? (
            <Text style={s.emptyNote}>Nothing yet — pick from the apps below.</Text>
          ) : (
            <View style={s.list}>
              {chosenApps.map((app, index) => (
                <Animated.View
                  key={app.id}
                  entering={FadeInDown.duration(240)}
                  layout={LinearTransition.duration(220)}
                >
                  {index > 0 && <View style={s.separator} />}
                  <TouchableOpacity
                    style={s.row}
                    onPress={() => toggleOptional(app.id)}
                    haptic="selection"
                    activeOpacity={0.72}
                  >
                    <View style={s.monogramOn}>
                      <Text style={s.monogramOnText}>{app.name[0]}</Text>
                    </View>
                    <Text style={s.appName}>{app.name}</Text>
                    <FocusCheck checked size={25} animateOnMount />
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          )}
        </View>

        {!nativeAvailable && (
          <View>
            <SectionHeading
              label="Other Apps"
              note={planMode
                ? 'These stay closed throughout this plan unless you allow them here.'
                : 'These close when your limit is spent. Tap one to make it an Essential.'}
            />
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
            <View style={s.list}>
              {otherApps.map((app, index) => (
                <Animated.View key={app.id} layout={LinearTransition.duration(220)}>
                  {index > 0 && <View style={s.separator} />}
                  <TouchableOpacity
                    style={s.row}
                    onPress={() => toggleOptional(app.id)}
                    haptic="selection"
                    activeOpacity={0.72}
                  >
                    <View style={s.monogram}>
                      <Text style={s.monogramText}>{app.name[0]}</Text>
                    </View>
                    <Text style={s.appName}>{app.name}</Text>
                    <FocusCheck checked={false} size={25} />
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          </View>
        )}

        {!nativeAvailable && blockedApps.length > 0 && (
          <View>
            <SectionHeading
              label="Always Blocked"
              note="This system group always stays closed. Its apps cannot become Essentials unless you remove that protection first."
            />
            {blockedApps.map(app => (
              <AlwaysBlockedRow key={app.id} name={app.name} />
            ))}
          </View>
        )}

        {nativeAvailable && nativeBlockedCount > 0 && (
          <View>
            <SectionHeading
              label="Always Blocked"
              note="Apple keeps app names private. This system group is shown here so it is clear why those apps cannot be selected as Essentials."
            />
            <AlwaysBlockedRow
              name="Always Blocked"
              meta={`${nativeBlockedCount} ${nativeBlockedCount === 1 ? 'private app' : 'private apps'}`}
            />
          </View>
        )}
      </ScrollView>
    </SmoothBottomSheet>
  );
}

const s = StyleSheet.create({
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingHorizontal: 18,
    paddingBottom: 24,
    maxHeight: '92%',
  },
  description: {
    paddingRight: 10,
    fontFamily: F.serif,
    fontSize: 16,
    lineHeight: 22.5,
    color: C.textSecondary,
  },
  scrollContent: { paddingTop: 16, paddingBottom: 32, gap: 24 },
  sectionHeading: { gap: 6, paddingHorizontal: 2, marginBottom: 12 },
  sectionLabel: { fontFamily: F.serifSemiBold, fontSize: 20, lineHeight: 24, color: C.text },
  sectionNote: { fontFamily: F.serif, fontSize: 16, lineHeight: 22.5, color: C.textSecondary },
  list: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: 52 },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 3 },
  monogram: { width: 39, height: 39, borderRadius: 13, borderCurve: 'continuous', backgroundColor: '#F0EFEB', alignItems: 'center', justifyContent: 'center' },
  monogramText: { fontFamily: F.serifSemiBold, fontSize: 16, color: C.textSecondary },
  monogramOn: { width: 39, height: 39, borderRadius: 13, borderCurve: 'continuous', backgroundColor: '#F1E3BF', alignItems: 'center', justifyContent: 'center' },
  monogramOnText: { fontFamily: F.serifSemiBold, fontSize: 16, color: C.goldDark },
  monogramLocked: { width: 39, height: 39, borderRadius: 13, borderCurve: 'continuous', backgroundColor: '#F2F1ED', alignItems: 'center', justifyContent: 'center' },
  monogramLockedText: { fontFamily: F.serifSemiBold, fontSize: 16, color: C.textMuted },
  appName: { flex: 1, minWidth: 0, fontFamily: F.serifMedium, fontSize: 17, color: C.text },
  appNameLocked: { flex: 1, minWidth: 0, fontFamily: F.serifMedium, fontSize: 17, color: C.textMuted },
  emptyNote: { paddingHorizontal: 2, fontFamily: F.serifItalic, fontSize: 16, lineHeight: 22.5, color: C.textMuted },
  searchSurface: { height: 50, flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, paddingHorizontal: 14, marginBottom: 12 },
  searchInput: { flex: 1, fontFamily: F.sansMedium, fontSize: 16, color: C.text },
});
