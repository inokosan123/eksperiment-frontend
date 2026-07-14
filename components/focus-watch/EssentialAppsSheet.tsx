import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { Lock, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import { ESSENTIAL_APP_OPTIONS } from './focusContent';
import FocusCheck from './FocusCheck';
import NativeActivitySelectionButton from './NativeActivitySelectionButton';
import FocusSheetHeader from './FocusSheetHeader';
import { isNativeFocusAvailable } from './focusNativeBridge';
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
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const state = useDayPlan();
  const nativeAvailable = isNativeFocusAvailable();
  const [query, setQuery] = useState('');
  const coreIds = useMemo(() => new Set(allCoreEssentialIds(state)), [state]);
  const selectedIds = useMemo(() => new Set(state.optionalEssentialAppIds), [state.optionalEssentialAppIds]);
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
      .filter(app => !coreIds.has(app.id) && selectedIds.has(app.id))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [coreIds, selectedIds]
  );
  const otherApps = useMemo(
    () => ESSENTIAL_APP_OPTIONS
      .filter(app => !coreIds.has(app.id) && !selectedIds.has(app.id))
      .filter(app => !normalizedQuery || app.name.toLocaleLowerCase().includes(normalizedQuery))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [coreIds, selectedIds, normalizedQuery]
  );

  const toggleOptional = (appId: string) => {
    if (coreIds.has(appId) || blockedIds.has(appId)) return;
    saveOptionalEssentialApps(
      selectedIds.has(appId)
        ? state.optionalEssentialAppIds.filter(id => id !== appId)
        : [...state.optionalEssentialAppIds, appId]
    );
  };

  const closeSheet = () => {
    setQuery('');
    onClose();
  };

  return (
    <SmoothBottomSheet
      visible={visible}
      onClose={closeSheet}
      sheetStyle={s.sheet}
      keyboardAware
    >
      <FocusSheetHeader
        kicker="ALWAYS AVAILABLE"
        title="Essential Apps"
        onClose={closeSheet}
        large
      />
      <Text style={s.description}>
        When your daily limit is spent, the phone closes down to Essentials only.
        Everything on this list stays reachable — its use still counts toward your day.
      </Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scrollContent}
      >
        <View>
          <SectionHeading
            label="LOCKED ESSENTIALS"
            note="Kept reachable for safety. These are not a choice — they are always open."
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
            label="YOUR ESSENTIALS"
            note="Apps you chose to keep open after everything else closes. Tap one to remove it."
          />
          {nativeAvailable ? (
            <NativeActivitySelectionButton
              selectionId="global.essentials"
              title="Choose Essential Apps"
              label="Choose essential apps"
              prominent
            />
          ) : chosenApps.length === 0 ? (
            <Text style={s.emptyNote}>Nothing yet — pick from the apps below.</Text>
          ) : (
            <View style={s.list}>
              {chosenApps.map((app, index) => (
                <View key={app.id}>
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
                    <FocusCheck checked size={24} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {!nativeAvailable && (
          <View>
            <SectionHeading
              label="OTHER APPS"
              note="These close when your limit is spent. Tap one to make it an Essential."
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
              {otherApps.map((app, index) => {
                const blocked = blockedIds.has(app.id);
                return (
                  <View key={app.id}>
                    {index > 0 && <View style={s.separator} />}
                    <TouchableOpacity
                      style={[s.row, blocked && s.rowDisabled]}
                      onPress={() => toggleOptional(app.id)}
                      disabled={blocked}
                      haptic="selection"
                      activeOpacity={0.72}
                    >
                      <View style={s.monogram}>
                        <Text style={s.monogramText}>{app.name[0]}</Text>
                      </View>
                      <Text style={s.appName}>{app.name}</Text>
                      {blocked ? (
                        <View style={s.blockedTag}>
                          <Lock s={10} c="#A24351" w={2.2} />
                          <Text style={s.blockedText}>Always Blocked</Text>
                        </View>
                      ) : (
                        <FocusCheck checked={false} size={24} />
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
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
  description: {
    marginTop: 9,
    paddingRight: 12,
    fontFamily: F.serif,
    fontSize: 16,
    lineHeight: 22,
    color: C.textSecondary,
  },
  scrollContent: { paddingTop: 22, paddingBottom: 32, gap: 26 },
  sectionHeading: { gap: 4, paddingHorizontal: 2, marginBottom: 10 },
  sectionLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2, color: C.goldDark },
  sectionNote: { fontFamily: F.sans, fontSize: 12.5, lineHeight: 17, color: C.textSecondary },
  list: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: 46 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 3 },
  rowDisabled: { opacity: 0.55 },
  monogram: { width: 34, height: 34, borderRadius: 12, borderCurve: 'continuous', backgroundColor: '#F0EFEB', alignItems: 'center', justifyContent: 'center' },
  monogramText: { fontFamily: F.sansBold, fontSize: 13, color: C.textSecondary },
  monogramOn: { width: 34, height: 34, borderRadius: 12, borderCurve: 'continuous', backgroundColor: '#F1E3BF', alignItems: 'center', justifyContent: 'center' },
  monogramOnText: { fontFamily: F.sansBold, fontSize: 13, color: C.goldDark },
  monogramLocked: { width: 34, height: 34, borderRadius: 12, borderCurve: 'continuous', backgroundColor: '#F2F1ED', alignItems: 'center', justifyContent: 'center' },
  monogramLockedText: { fontFamily: F.sansBold, fontSize: 13, color: C.textMuted },
  appName: { flex: 1, minWidth: 0, fontFamily: F.serifMedium, fontSize: 16.5, color: C.text },
  appNameLocked: { flex: 1, minWidth: 0, fontFamily: F.serifMedium, fontSize: 16.5, color: C.textMuted },
  emptyNote: { paddingHorizontal: 2, fontFamily: F.serifItalic, fontSize: 14, color: C.textMuted },
  searchSurface: { height: 48, flexDirection: 'row', alignItems: 'center', borderRadius: 15, borderCurve: 'continuous', borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, paddingHorizontal: 14, marginBottom: 12 },
  searchInput: { flex: 1, fontFamily: F.sansMedium, fontSize: 14, color: C.text },
  blockedTag: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, backgroundColor: '#F8E7EA', paddingHorizontal: 8, paddingVertical: 6 },
  blockedText: { fontFamily: F.sansSemiBold, fontSize: 9.5, color: '#A24351' },
});
