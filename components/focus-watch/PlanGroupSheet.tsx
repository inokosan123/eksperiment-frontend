import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { CheckSmall, ChevronRight, Lock, Plus, Trash2, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import GoldButton from './GoldButton';
import NativeActivitySelectionButton from './NativeActivitySelectionButton';
import { appsInCategory, CATEGORY_TINTS, PREVIEW_APPS } from './focusContent';
import {
  clearNativeActivitySelection,
  copyNativeActivitySelection,
  isNativeFocusAvailable,
} from './focusNativeBridge';
import {
  cacheNativeActivitySelectionSummary,
  useNativeActivitySelectionSummary,
} from './nativeSelectionSummaryStore';
import {
  APP_CATEGORIES,
  createCustomGroupId,
  customGroupNameAvailable,
  deleteCustomGroup,
  isCustomGroupInUse,
  saveCustomGroup,
  useDayPlan,
  type CustomGroup,
} from './dayPlanStore';

type Mode = 'new' | 'existing';

function librarySelectionId(groupId: string) {
  return `group.library.${groupId}`;
}

function NativeExistingGroupActions({
  group,
  planId,
  alreadyAdded,
  onAdd,
  onDone,
}: {
  group: CustomGroup;
  planId: string;
  alreadyAdded: boolean;
  onAdd: (groupId: string, appIds: string[]) => void;
  onDone: () => void;
}) {
  const sourceId = librarySelectionId(group.id);
  const destinationId = `plan.${planId}.group.${group.id}`;
  const summary = useNativeActivitySelectionSummary(sourceId);
  const [copying, setCopying] = useState(false);
  const count = summary?.applicationCount ?? 0;

  const copyIntoPlan = async () => {
    if (copying || count === 0) return;
    setCopying(true);
    try {
      const copied = await copyNativeActivitySelection(sourceId, destinationId);
      if (!copied || copied.applicationCount === 0) return;
      cacheNativeActivitySelectionSummary(copied);
      onAdd(group.id, []);
      onDone();
    } finally {
      setCopying(false);
    }
  };

  return (
    <>
      <NativeActivitySelectionButton
        selectionId={sourceId}
        title={`Choose apps for ${group.name}`}
        label={count > 0 ? 'Edit saved group apps' : 'Set up this group on iPhone'}
        onSelected={() => {
          if (alreadyAdded) {
            void copyNativeActivitySelection(sourceId, destinationId).then(copied => {
              if (copied) cacheNativeActivitySelectionSummary(copied);
            });
          }
        }}
      />
      {alreadyAdded ? (
        <View style={s.alreadyRow}>
          <CheckSmall s={13} c="#397A5A" w={2.8} />
          <Text style={s.alreadyText}>Already in this plan</Text>
        </View>
      ) : (
        <GoldButton
          label={copying ? 'Adding group...' : 'Add this group'}
          disabled={copying || count === 0}
          onPress={copyIntoPlan}
        />
      )}
      {count === 0 && (
        <Text style={s.nativeSetupNote}>Choose at least one app before this reusable group can be added.</Text>
      )}
    </>
  );
}

export default function PlanGroupSheet({
  visible,
  planId,
  currentGroupIds,
  onClose,
  onAdd,
}: {
  visible: boolean;
  planId: string;
  currentGroupIds: string[];
  onClose: () => void;
  onAdd: (groupId: string, appIds: string[]) => void;
}) {
  const state = useDayPlan();
  const nativeAvailable = isNativeFocusAvailable();
  const [mode, setMode] = useState<Mode>('new');
  const [name, setName] = useState('');
  const [appIds, setAppIds] = useState<string[]>([]);
  const [draftGroupId, setDraftGroupId] = useState(() => createCustomGroupId());
  const [creating, setCreating] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [lockedNoticeId, setLockedNoticeId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CustomGroup | null>(null);
  const availableExisting = useMemo(
    () => [...state.customGroups].sort((a, b) => a.name.localeCompare(b.name)),
    [state.customGroups]
  );
  const nameAvailable = customGroupNameAvailable(name);
  const draftNativeSummary = useNativeActivitySelectionSummary(librarySelectionId(draftGroupId));
  const canCreate = name.trim().length > 0
    && nameAvailable
    && (nativeAvailable ? (draftNativeSummary?.applicationCount ?? 0) > 0 : appIds.length > 0);

  const reset = (preserveNativeSelection: boolean) => {
    if (nativeAvailable && !preserveNativeSelection) {
      void clearNativeActivitySelection(librarySelectionId(draftGroupId));
    }
    setMode('new');
    setName('');
    setAppIds([]);
    setDraftGroupId(createCustomGroupId());
    setCreating(false);
    setPreviewId(null);
    setLockedNoticeId(null);
    setPendingDelete(null);
  };

  const close = () => {
    reset(false);
    onClose();
  };

  const create = async () => {
    if (!canCreate || creating) return;
    setCreating(true);
    const sourceId = librarySelectionId(draftGroupId);
    const destinationId = `plan.${planId}.group.${draftGroupId}`;
    if (nativeAvailable) {
      const copied = await copyNativeActivitySelection(sourceId, destinationId);
      if (!copied || copied.applicationCount === 0) {
        setCreating(false);
        return;
      }
      cacheNativeActivitySelectionSummary(copied);
    }
    const saved = saveCustomGroup({
      id: draftGroupId,
      name: name.trim(),
      appIds: nativeAvailable ? [] : appIds,
    });
    if (!saved) {
      if (nativeAvailable) void clearNativeActivitySelection(destinationId);
      setCreating(false);
      return;
    }
    onAdd(saved.id, saved.appIds);
    reset(nativeAvailable);
    onClose();
  };

  return (
    <SmoothBottomSheet visible={visible} onClose={close} sheetStyle={s.sheet} keyboardAware>
      <View style={s.handle} />
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>APP GROUP CATALOG</Text>
          <Text style={s.title}>Add a group</Text>
        </View>
        <TouchableOpacity style={s.closeBtn} onPress={close} hitSlop={10}>
          <X s={17} c={C.textMuted} w={2.2} />
        </TouchableOpacity>
      </View>

      <View style={s.segmented}>
        <TouchableOpacity style={[s.segment, mode === 'new' && s.segmentOn]} onPress={() => setMode('new')} haptic="selection">
          <Text style={[s.segmentText, mode === 'new' && s.segmentTextOn]}>Add new</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.segment, mode === 'existing' && s.segmentOn]} onPress={() => setMode('existing')} haptic="selection">
          <Text style={[s.segmentText, mode === 'existing' && s.segmentTextOn]}>Use existing</Text>
        </TouchableOpacity>
      </View>

      {mode === 'new' ? (
        <>
          <View style={s.nameSurface}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Name the group"
              placeholderTextColor={C.textMuted}
              maxLength={28}
              style={s.nameInput}
            />
          </View>
          {name.trim().length > 0 && !nameAvailable && (
            <Text style={s.nameError}>That name already belongs to a default or saved group.</Text>
          )}
          <Text style={s.helper}>Choose the apps this group owns. They will move out of their previous group in this plan.</Text>

          {nativeAvailable ? (
            <View style={s.nativeNewGroup}>
              <NativeActivitySelectionButton
                selectionId={librarySelectionId(draftGroupId)}
                title={name.trim() ? `Choose apps for ${name.trim()}` : 'Choose apps for this group'}
                label="Choose group apps privately"
              />
              <Text style={s.nativeSetupNote}>Apple keeps app names private. Anasta stores this group by name and uses only its protected selection token.</Text>
            </View>
          ) : <ScrollView style={s.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {APP_CATEGORIES.map(category => (
              <View key={category.id}>
                <Text style={s.groupLabel}>{category.name.toUpperCase()}</Text>
                {appsInCategory(category.id).map(app => {
                  const selected = appIds.includes(app.id);
                  const tint = CATEGORY_TINTS[app.categoryId] ?? { bg: C.goldLight, color: C.goldDark };
                  return (
                    <TouchableOpacity
                      key={app.id}
                      style={s.appRow}
                      onPress={() => setAppIds(current => selected ? current.filter(id => id !== app.id) : [...current, app.id])}
                      haptic="selection"
                    >
                      <View style={[s.avatar, { backgroundColor: tint.bg }]}><Text style={[s.avatarText, { color: tint.color }]}>{app.name[0]}</Text></View>
                      <Text style={s.appName}>{app.name}</Text>
                      <View style={[s.checkbox, selected && s.checkboxOn]}>{selected && <CheckSmall s={12} c="#fff" w={3} />}</View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>}
          <GoldButton label={creating ? 'Adding group...' : 'Add group'} disabled={!canCreate || creating} onPress={create} style={{ marginTop: 12 }} />
        </>
      ) : (
        <ScrollView style={s.existingList} showsVerticalScrollIndicator={false}>
          {availableExisting.length === 0 ? (
            <View style={s.emptyState}>
              <View style={s.emptyPlus}><Plus s={16} c={C.goldDark} w={2.4} /></View>
              <Text style={s.emptyTitle}>No other saved groups yet.</Text>
              <Text style={s.emptyBody}>A group created in any plan will become reusable here.</Text>
            </View>
          ) : availableExisting.map(group => {
            const open = previewId === group.id;
            const alreadyAdded = currentGroupIds.includes(group.id);
            const inUse = isCustomGroupInUse(group.id);
            return (
              <View key={group.id} style={s.existingGroup}>
                <TouchableOpacity style={s.existingRow} onPress={() => setPreviewId(open ? null : group.id)}>
                  <View style={s.existingMark}>{group.name[0]}</View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.existingName}>{group.name}</Text>
                    <Text style={s.existingMeta}>{nativeAvailable ? 'Private iPhone group' : `${group.appIds.length} apps`}</Text>
                  </View>
                  <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}><ChevronRight s={16} c={C.textMuted} w={2} /></View>
                </TouchableOpacity>
                {open && (
                  <View style={s.preview}>
                    {!nativeAvailable && <View style={s.previewApps}>
                      {group.appIds.map(appId => (
                        <View key={appId} style={s.previewChip}>
                          <Text style={s.previewChipText}>{PREVIEW_APPS.find(app => app.id === appId)?.name ?? appId}</Text>
                        </View>
                      ))}
                    </View>}
                    {nativeAvailable ? (
                      <NativeExistingGroupActions
                        group={group}
                        planId={planId}
                        alreadyAdded={alreadyAdded}
                        onAdd={onAdd}
                        onDone={close}
                      />
                    ) : alreadyAdded ? (
                      <View style={s.alreadyRow}>
                        <CheckSmall s={13} c="#397A5A" w={2.8} />
                        <Text style={s.alreadyText}>Already in this plan</Text>
                      </View>
                    ) : (
                      <GoldButton label="Add this group" onPress={() => { onAdd(group.id, group.appIds); close(); }} />
                    )}
                    <TouchableOpacity
                      style={[s.deleteGroupButton, inUse && s.deleteGroupButtonLocked]}
                      onPress={() => {
                        if (inUse) setLockedNoticeId(lockedNoticeId === group.id ? null : group.id);
                        else setPendingDelete(group);
                      }}
                    >
                      {inUse
                        ? <Lock s={13} c={C.textMuted} w={2.1} />
                        : <Trash2 s={13} c="#A24351" w={2.1} />}
                      <Text style={[s.deleteGroupText, inUse && s.deleteGroupTextLocked]}>Delete saved group</Text>
                    </TouchableOpacity>
                    {lockedNoticeId === group.id && (
                      <Text style={s.lockedReason}>
                        This group belongs to at least one saved plan. Remove it from every active or inactive plan before deleting it from the library.
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      <ConfirmModal
        embedded
        visible={pendingDelete !== null}
        icon={<Trash2 s={21} c="#A24351" w={2.1} />}
        iconBg="#F8E7EA"
        title="Delete this saved group?"
        body="It will disappear from the reusable group library. Apps in other groups are not deleted."
        subject={pendingDelete?.name}
        confirmLabel="DELETE GROUP"
        confirmColor="#A24351"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete && deleteCustomGroup(pendingDelete.id)) {
            if (nativeAvailable) {
              void clearNativeActivitySelection(librarySelectionId(pendingDelete.id));
            }
            setPreviewId(null);
          }
          setPendingDelete(null);
        }}
      />
    </SmoothBottomSheet>
  );
}

const s = StyleSheet.create({
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 24, maxHeight: '93%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E0DA', marginTop: 10 },
  headerRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  eyebrow: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: C.gold },
  title: { marginTop: 3, fontFamily: F.serifMedium, fontSize: 27, color: C.text },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0EFEA', alignItems: 'center', justifyContent: 'center' },
  segmented: { marginTop: 14, height: 42, flexDirection: 'row', borderRadius: 13, borderCurve: 'continuous', backgroundColor: '#EEECE7', padding: 3 },
  segment: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: C.surface, boxShadow: '0 2px 6px rgba(35,30,20,0.08)' },
  segmentText: { fontFamily: F.sansSemiBold, fontSize: 10.5, color: C.textMuted },
  segmentTextOn: { color: C.text },
  nameSurface: { marginTop: 14, height: 48, borderRadius: 14, borderCurve: 'continuous', borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, paddingHorizontal: 13, justifyContent: 'center' },
  nameInput: { fontFamily: F.serifMedium, fontSize: 16, color: C.text },
  nameError: { marginTop: 5, fontFamily: F.sansMedium, fontSize: 9, color: '#A24351' },
  helper: { marginTop: 8, fontFamily: F.sans, fontSize: 9.5, lineHeight: 14, color: C.textSecondary },
  nativeNewGroup: { marginTop: 12, gap: 8 },
  nativeSetupNote: { paddingHorizontal: 4, fontFamily: F.sans, fontSize: 9, lineHeight: 13, color: C.textMuted, textAlign: 'center' },
  list: { marginTop: 4, maxHeight: 440 },
  groupLabel: { marginTop: 13, marginBottom: 3, fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.7, color: C.textMuted },
  appRow: { minHeight: 47, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  avatar: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: F.sansBold, fontSize: 12 },
  appName: { flex: 1, fontFamily: F.sansMedium, fontSize: 12, color: C.text },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#D6D3D1', backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { borderColor: C.gold, backgroundColor: C.gold },
  existingList: { marginTop: 14, maxHeight: 520 },
  existingGroup: { borderTopWidth: 1, borderTopColor: C.border },
  existingRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10 },
  existingMark: { width: 33, height: 33, borderRadius: 11, backgroundColor: C.goldLight, textAlign: 'center', textAlignVertical: 'center', fontFamily: F.serifMedium, fontSize: 16, color: C.goldDark },
  existingName: { fontFamily: F.sansSemiBold, fontSize: 12.5, color: C.text },
  existingMeta: { marginTop: 2, fontFamily: F.sans, fontSize: 9.5, color: C.textMuted },
  preview: { paddingLeft: 43, paddingBottom: 14, gap: 12 },
  previewApps: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  previewChip: { borderRadius: 999, backgroundColor: '#F0EFEB', paddingHorizontal: 8, paddingVertical: 5 },
  previewChipText: { fontFamily: F.sansMedium, fontSize: 8.5, color: C.textSecondary },
  alreadyRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 13, backgroundColor: '#EAF3ED' },
  alreadyText: { fontFamily: F.sansSemiBold, fontSize: 11, color: '#397A5A' },
  deleteGroupButton: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7 },
  deleteGroupButtonLocked: { opacity: 0.82 },
  deleteGroupText: { fontFamily: F.sansSemiBold, fontSize: 9.5, color: '#A24351' },
  deleteGroupTextLocked: { color: C.textMuted },
  lockedReason: { marginTop: -5, paddingHorizontal: 4, fontFamily: F.sans, fontSize: 9, lineHeight: 13, color: C.textMuted, textAlign: 'center' },
  emptyState: { minHeight: 220, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 25 },
  emptyPlus: { width: 43, height: 43, borderRadius: 14, backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { marginTop: 11, fontFamily: F.serifMedium, fontSize: 18, color: C.text },
  emptyBody: { marginTop: 3, fontFamily: F.sans, fontSize: 10, lineHeight: 14, color: C.textSecondary, textAlign: 'center' },
});
