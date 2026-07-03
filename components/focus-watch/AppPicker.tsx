import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { CheckSmall, ChevronDown, Plus, Trash2, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import GoldButton from './GoldButton';
import { SMOOTH_LAYOUT, SOFT_IN, SOFT_OUT } from './focusMotion';
import { appsInCategory, CATEGORY_TINTS, type MockApp } from './focusContent';
import {
  APP_CATEGORIES,
  deleteCustomGroup,
  saveCustomGroup,
  useFocusWatch,
  type WatchSelection,
} from './focusWatchStore';

const LIST_TRANSITION = SMOOTH_LAYOUT;

type CheckState = 'none' | 'partial' | 'all';

function CheckCircle({ state }: { state: CheckState }) {
  return (
    <View
      style={[
        s.check,
        state === 'all' && s.checkAll,
        state === 'partial' && s.checkPartial,
      ]}
    >
      {state === 'all' && (
        <Animated.View entering={ZoomIn.duration(160)}>
          <CheckSmall s={13} c="#fff" w={3} />
        </Animated.View>
      )}
      {state === 'partial' && (
        <Animated.View entering={ZoomIn.duration(160)} style={s.checkDot} />
      )}
    </View>
  );
}

function AppAvatar({ app }: { app: MockApp }) {
  const tint = CATEGORY_TINTS[app.categoryId] ?? { bg: '#EFEEEB', color: '#5B564F' };
  return (
    <View style={[s.avatar, { backgroundColor: tint.bg }]}>
      <Text style={[s.avatarText, { color: tint.color }]}>{app.name[0]}</Text>
    </View>
  );
}

function GroupEditorSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [appIds, setAppIds] = useState<string[]>([]);
  const canSave = name.trim().length > 0 && appIds.length > 0;

  const toggleApp = (id: string) =>
    setAppIds(current =>
      current.includes(id) ? current.filter(entry => entry !== id) : [...current, id]
    );

  const save = () => {
    saveCustomGroup({ name: name.trim(), appIds });
    setName('');
    setAppIds([]);
    onClose();
  };

  return (
    <SmoothBottomSheet visible={visible} onClose={onClose} sheetStyle={s.sheet} keyboardAware>
      <View style={s.sheetHandle} />
      <View style={s.sheetHeader}>
        <Text style={s.sheetTitle}>New group</Text>
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.8}
          style={s.sheetClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X s={17} c={C.textMuted} w={2.2} />
        </TouchableOpacity>
      </View>

      <View style={s.sheetInputCard}>
        <TextInput
          style={s.sheetInput}
          value={name}
          onChangeText={setName}
          placeholder="Name the group"
          placeholderTextColor={C.textMuted}
          maxLength={24}
        />
      </View>

      <ScrollView style={s.sheetList} showsVerticalScrollIndicator={false}>
        {APP_CATEGORIES.map(category => (
          <View key={category.id}>
            <Text style={s.sheetCategoryLabel}>{category.name.toUpperCase()}</Text>
            {appsInCategory(category.id).map(app => {
              const selected = appIds.includes(app.id);
              return (
                <TouchableOpacity
                  key={app.id}
                  style={s.appRow}
                  activeOpacity={0.75}
                  haptic="selection"
                  onPress={() => toggleApp(app.id)}
                >
                  <AppAvatar app={app} />
                  <Text style={s.appName}>{app.name}</Text>
                  <CheckCircle state={selected ? 'all' : 'none'} />
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <GoldButton label="Save group" disabled={!canSave} onPress={save} style={{ marginTop: 12 }} />
    </SmoothBottomSheet>
  );
}

// The "what to hold back" picker: Apple-style categories that expand into
// app lists, plus the user's own named groups. Mock catalog until the real
// FamilyActivityPicker lands in Phase 2.
export default function AppPicker({
  selection,
  onChange,
  manageGroups = true,
}: {
  selection: WatchSelection;
  onChange: (next: WatchSelection) => void;
  // When false (e.g. inside the quick-watch sheet) groups stay selectable
  // but creating/deleting them is left to the full editor.
  manageGroups?: boolean;
}) {
  const { customGroups } = useFocusWatch();
  const [expanded, setExpanded] = useState<string[]>([]);
  const [groupSheetVisible, setGroupSheetVisible] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);

  const toggleExpanded = (id: string) =>
    setExpanded(current =>
      current.includes(id) ? current.filter(entry => entry !== id) : [...current, id]
    );

  const categoryState = (categoryId: string): CheckState => {
    if (selection.categoryIds.includes(categoryId)) return 'all';
    const apps = appsInCategory(categoryId);
    return apps.some(app => selection.appIds.includes(app.id)) ? 'partial' : 'none';
  };

  const toggleCategory = (categoryId: string) => {
    const apps = appsInCategory(categoryId).map(app => app.id);
    if (selection.categoryIds.includes(categoryId)) {
      onChange({ ...selection, categoryIds: selection.categoryIds.filter(id => id !== categoryId) });
    } else {
      onChange({
        ...selection,
        categoryIds: [...selection.categoryIds, categoryId],
        appIds: selection.appIds.filter(id => !apps.includes(id)),
      });
    }
  };

  const toggleApp = (app: MockApp) => {
    if (selection.categoryIds.includes(app.categoryId)) {
      const others = appsInCategory(app.categoryId)
        .map(entry => entry.id)
        .filter(id => id !== app.id);
      onChange({
        ...selection,
        categoryIds: selection.categoryIds.filter(id => id !== app.categoryId),
        appIds: [...selection.appIds, ...others],
      });
      return;
    }
    onChange({
      ...selection,
      appIds: selection.appIds.includes(app.id)
        ? selection.appIds.filter(id => id !== app.id)
        : [...selection.appIds, app.id],
    });
  };

  const toggleGroup = (groupId: string) =>
    onChange({
      ...selection,
      groupIds: selection.groupIds.includes(groupId)
        ? selection.groupIds.filter(id => id !== groupId)
        : [...selection.groupIds, groupId],
    });

  return (
    <View>
      <Animated.View style={s.groupCard} layout={LIST_TRANSITION}>
        {APP_CATEGORIES.map((category, index) => {
          const isExpanded = expanded.includes(category.id);
          const apps = appsInCategory(category.id);
          const state = categoryState(category.id);
          const wholeCategory = state === 'all';

          return (
            <Animated.View key={category.id} layout={LIST_TRANSITION}>
              {index > 0 && <View style={s.separator} />}
              <View style={[s.categoryRow, state !== 'none' && s.rowSelected]}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  haptic="selection"
                  onPress={() => toggleCategory(category.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <CheckCircle state={state} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.categoryMain}
                  activeOpacity={0.7}
                  onPress={() => toggleExpanded(category.id)}
                >
                  <Text style={[s.categoryName, state === 'all' && s.nameSelected]}>
                    {category.name}
                  </Text>
                  <Text style={[s.categoryCount, state !== 'none' && s.countSelected]}>
                    {state === 'all'
                      ? 'all held back'
                      : state === 'partial'
                        ? `${apps.filter(app => selection.appIds.includes(app.id)).length} of ${apps.length}`
                        : `${apps.length} apps`}
                  </Text>
                  <View style={[s.chevron, isExpanded && s.chevronOpen]}>
                    <ChevronDown s={16} c={C.textMuted} />
                  </View>
                </TouchableOpacity>
              </View>

              {isExpanded && (
                <Animated.View entering={SOFT_IN} exiting={SOFT_OUT}>
                  {apps.map(app => {
                    const appChecked = wholeCategory || selection.appIds.includes(app.id);
                    return (
                      <TouchableOpacity
                        key={app.id}
                        style={[s.appRowIndent, appChecked && s.rowSelected]}
                        activeOpacity={0.75}
                        haptic="selection"
                        onPress={() => toggleApp(app)}
                      >
                        <AppAvatar app={app} />
                        <Text style={[s.appName, appChecked && s.nameSelected]}>{app.name}</Text>
                        <CheckCircle state={appChecked ? 'all' : 'none'} />
                      </TouchableOpacity>
                    );
                  })}
                </Animated.View>
              )}
            </Animated.View>
          );
        })}
      </Animated.View>

      {(manageGroups || customGroups.length > 0) && (
        <>
      <Text style={s.subLabel}>MY GROUPS</Text>
      <Animated.View style={s.groupCard} layout={LIST_TRANSITION}>
        {customGroups.map((group, index) => {
          const groupSelected = selection.groupIds.includes(group.id);
          return (
            <Animated.View
              key={group.id}
              entering={SOFT_IN}
              exiting={SOFT_OUT}
              layout={LIST_TRANSITION}
            >
              {index > 0 && <View style={s.separator} />}
              <View style={[s.categoryRow, groupSelected && s.rowSelected]}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  haptic="selection"
                  onPress={() => toggleGroup(group.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <CheckCircle state={groupSelected ? 'all' : 'none'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.categoryMain}
                  activeOpacity={0.7}
                  onPress={() => toggleGroup(group.id)}
                >
                  <Text style={[s.categoryName, groupSelected && s.nameSelected]}>
                    {group.name}
                  </Text>
                  <Text style={[s.categoryCount, groupSelected && s.countSelected]}>
                    {group.appIds.length} {group.appIds.length === 1 ? 'app' : 'apps'}
                  </Text>
                </TouchableOpacity>
                {manageGroups && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => setGroupToDelete(group.id)}
                  >
                    <Trash2 s={15} c={C.textMuted} w={2} />
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          );
        })}

        {manageGroups && (
          <>
            {customGroups.length > 0 && <View style={s.separator} />}
            <TouchableOpacity
              style={s.newGroupRow}
              activeOpacity={0.75}
              onPress={() => setGroupSheetVisible(true)}
            >
              <View style={s.newGroupIcon}>
                <Plus s={13} c={C.goldDark} w={2.6} />
              </View>
              <Text style={s.newGroupText}>New group</Text>
            </TouchableOpacity>
          </>
        )}
      </Animated.View>
        </>
      )}

      <GroupEditorSheet visible={groupSheetVisible} onClose={() => setGroupSheetVisible(false)} />

      <ConfirmModal
        visible={groupToDelete !== null}
        icon={<Trash2 s={22} c={C.red} w={2} />}
        title="Delete this group?"
        body="Watches using it will simply stop including it."
        subject={customGroups.find(group => group.id === groupToDelete)?.name}
        confirmLabel="DELETE"
        onCancel={() => setGroupToDelete(null)}
        onConfirm={() => {
          if (groupToDelete) {
            deleteCustomGroup(groupToDelete);
            onChange({
              ...selection,
              groupIds: selection.groupIds.filter(id => id !== groupToDelete),
            });
          }
          setGroupToDelete(null);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
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
  subLabel: {
    marginTop: 14,
    marginBottom: 8,
    marginLeft: 10,
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: C.textMuted,
  },

  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  // Selected rows carry the soft gold wash so the whole row reads chosen.
  rowSelected: {
    backgroundColor: '#FFF9EE',
  },
  nameSelected: {
    color: '#6D4F13',
  },
  countSelected: {
    color: '#B08A47',
  },
  categoryMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryName: {
    flex: 1,
    fontFamily: F.serifMedium,
    fontSize: 16.5,
    color: C.text,
  },
  categoryCount: {
    fontFamily: F.sansMedium,
    fontSize: 11.5,
    color: C.textMuted,
  },
  chevron: {
    transform: [{ rotate: '0deg' }],
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },

  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 9,
  },
  appRowIndent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 8.5,
    paddingLeft: 48,
    paddingRight: 16,
  },
  appName: {
    flex: 1,
    fontFamily: F.sansMedium,
    fontSize: 14,
    color: C.text,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: F.sansBold,
    fontSize: 13,
  },

  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#D6D3D1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  checkAll: {
    borderColor: C.gold,
    backgroundColor: C.gold,
  },
  checkPartial: {
    borderColor: C.gold,
  },
  checkDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: C.gold,
  },

  newGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  newGroupIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.goldLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newGroupText: {
    fontFamily: F.serifMedium,
    fontSize: 15.5,
    color: C.textSecondary,
  },

  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 26,
    maxHeight: '88%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#E7E5E0',
    marginTop: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 12,
  },
  sheetTitle: {
    fontFamily: F.serifMedium,
    fontSize: 24,
    letterSpacing: -0.2,
    color: C.text,
  },
  sheetClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F3F2ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetInputCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 15,
  },
  sheetInput: {
    paddingVertical: 12,
    fontFamily: F.serifMedium,
    fontSize: 16.5,
    color: C.text,
  },
  sheetList: {
    marginTop: 6,
    maxHeight: 340,
  },
  sheetCategoryLabel: {
    marginTop: 12,
    marginBottom: 4,
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 2,
    color: C.textMuted,
  },
});
