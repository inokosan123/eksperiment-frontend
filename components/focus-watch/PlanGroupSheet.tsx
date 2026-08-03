import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { BookMarked, CheckSmall, ChevronRight, Lock, Plus, Trash2 } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import FocusCheck from './FocusCheck';
import FocusSegments from './FocusSegments';
import GoldButton from './GoldButton';
import NativeActivitySelectionButton from './NativeActivitySelectionButton';
import FocusSheetHeader from './FocusSheetHeader';
import GroupSeal, { withAlpha } from './GroupSeal';
import { AlwaysBlockedHeading, AlwaysBlockedNote, AlwaysBlockedRow } from './AlwaysBlockedList';
import EmojiPicker, { type EmojiName } from '@/components/shared/EmojiPicker';
import { deep, lit } from '@/components/shared/tone';
import { appsInCategory, CATEGORY_TINTS, ESSENTIAL_APP_OPTIONS, PREVIEW_APPS, RULE_TONES } from './focusContent';
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

// The faces a group can wear, drawn from the same Noto set Habits and Big
// Events choose from.
//
// The ORDER is the design here. Only the first three rows are visible before
// "show more", so those fifteen are the ones a group of apps is most often
// about — the built-in groups' own faces first, so a group you make yourself
// can look like one of them, then the rest of what people keep on a phone.
// Everything after that is grouped by subject, so opening the full set reads as
// a shelf rather than a pile.
const GROUP_ICONS: EmojiName[] = [
  // Screens, and what is on them.
  'mobile-phone', 'movie-camera', 'joker', 'newspaper', 'money-bag',
  'red-heart', 'laptop', 'headphones', 'camera', 'musical-notes',
  'ticket', 'briefcase', 'books', 'soccer-ball', 'world-map',

  // Work and study.
  'memo', 'notebook', 'writing-hand', 'open-book', 'graduation-cap',
  'light-bulb', 'brain', 'chart-increasing', 'bullseye', 'stopwatch',
  'alarm-clock', 'calendar', 'spiral-calendar', 'handshake', 'rocket',
  'compass', 'toolbox', 'hammer-and-wrench', 'wrench',

  // Making things, and celebrating them.
  'artist-palette', 'microphone', 'guitar', 'party-popper', 'confetti-ball',
  'balloon', 'partying-face', 'wrapped-gift', 'birthday-cake', 'sparkles',
  'glowing-star', 'star', 'gem-stone', 'crown', 'trophy',
  'first-place-medal', 'sports-medal', 'chequered-flag',

  // The body, and the table.
  'person-running', 'person-lifting-weights', 'person-walking', 'running-shoe',
  'bicycle', 'flexed-biceps', 'fork-and-knife-with-plate', 'green-salad',
  'red-apple', 'bread', 'cooking', 'bowl-with-spoon', 'hot-beverage',
  'wine-glass', 'cocktail-glass', 'clinking-glasses', 'stethoscope', 'pill',

  // Home, rest and going away.
  'house', 'bed', 'sleeping-face', 'crescent-moon', 'sun', 'sunrise',
  'fire', 'candle', 'potted-plant', 'seedling', 'evergreen-tree',
  'leaf-flutter', 'herb', 'airplane', 'luggage', 'beach-with-umbrella',

  // Faith, and what is kept.
  'church', 'latin-cross', 'praying-hands', 'shield', 'lock', 'eye',
  'bell', 'bookmark', 'scroll', 'ring', 'hourglass-done',
];

function librarySelectionId(groupId: string) {
  return `group.library.${groupId}`;
}

function categoryTint(categoryId: string) {
  return CATEGORY_TINTS[categoryId] ?? { bg: C.goldLight, color: C.goldDark };
}

const PICK = RULE_TONES.limit.color;

// Struck once, here, and NOT inside the animated styles below.
//
// ⚠️ `lit` and `deep` are ordinary functions. The body of a `useAnimatedStyle`
// is a worklet running on the UI thread, and calling a plain imported function
// from there is illegal in Reanimated — it takes the whole app down the moment
// the first card mounts. Anything a worklet reads must already be a value.
const PICKED = {
  cardGround: ['#FFFDFA', lit(PICK, 96)] as [string, string],
  cardEdge: ['#EDE9E0', lit(PICK, 78, 55)] as [string, string],
  seatGround: ['#F4F1EA', lit(PICK, 90)] as [string, string],
  seatEdge: ['#E7E2D6', lit(PICK, 76, 50)] as [string, string],
  letter: ['#A9A092', deep(PICK, 40, 48)] as [string, string],
  name: [C.text, deep(PICK, 28, 46)] as [string, string],
};

// One app, offered to the group.
//
// Unpicked it is a quiet card on warm paper with an empty seat; picked, the
// whole card comes over to the rule's colour — ground, edge, seat and name all
// move together, so a chosen app is legible in a glance down the list rather
// than by hunting for a tick. The seat is a squircle in iOS icon proportions
// because that is where the real app icon will sit.
function AppChoiceCard({
  name,
  selected,
  onToggle,
}: {
  name: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const on = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    on.value = reduceMotion
      ? (selected ? 1 : 0)
      : withTiming(selected ? 1 : 0, { duration: 190, easing: Easing.out(Easing.cubic) });
  }, [on, reduceMotion, selected]);

  const cardStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], PICKED.cardGround),
    borderColor: interpolateColor(on.value, [0, 1], PICKED.cardEdge),
  }));

  const seatStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], PICKED.seatGround),
    borderColor: interpolateColor(on.value, [0, 1], PICKED.seatEdge),
  }));

  const letterStyle = useAnimatedStyle(() => ({
    color: interpolateColor(on.value, [0, 1], PICKED.letter),
  }));

  const nameStyle = useAnimatedStyle(() => ({
    color: interpolateColor(on.value, [0, 1], PICKED.name),
  }));

  return (
    <TouchableOpacity
      onPress={onToggle}
      haptic="selection"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      activeOpacity={0.82}
    >
      <Animated.View style={[s.appCard, cardStyle]}>
        <Animated.View style={[s.appSeat, seatStyle]}>
          <Animated.Text style={[s.appSeatLetter, letterStyle]}>
            {name.charAt(0).toUpperCase()}
          </Animated.Text>
        </Animated.View>
        <Animated.Text style={[s.appName, nameStyle]} numberOfLines={1}>{name}</Animated.Text>
        <FocusCheck checked={selected} accent={PICK} />
      </Animated.View>
    </TouchableOpacity>
  );
}

// Always Blocked joins the list as its own section, in the shared marks — a
// heading like any other category, then a row per app that simply cannot be
// chosen. Presented, not offered.
function AlwaysBlockedPickerGroup({
  appNames,
  count,
  privateNames,
}: {
  appNames: string[];
  count: number;
  /** iOS keeps the names to itself; the group is shown as one row with a count. */
  privateNames?: boolean;
}) {
  if (count <= 0) return null;
  return (
    <View>
      <AlwaysBlockedHeading />
      {privateNames || appNames.length === 0 ? (
        <AlwaysBlockedRow
          name="Always Blocked"
          meta={`${count} ${count === 1 ? 'private app' : 'private apps'}`}
        />
      ) : (
        appNames.map(name => <AlwaysBlockedRow key={name} name={name} />)
      )}
      <AlwaysBlockedNote>
        These stay closed by the system group and take no plan limit. Remove Always Blocked first if an app should return to a plan group.
      </AlwaysBlockedNote>
    </View>
  );
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
  const alwaysStrictSummary = useNativeActivitySelectionSummary('always.strict');
  const alwaysLooseSummary = useNativeActivitySelectionSummary('always.loose');
  const [mode, setMode] = useState<Mode>('new');
  const [name, setName] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const [icon, setIcon] = useState<EmojiName>(GROUP_ICONS[0]);
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
  const alwaysBlockedIds = useMemo(
    () => new Set(state.alwaysBlockedApps.map(entry => entry.appId)),
    [state.alwaysBlockedApps]
  );
  const alwaysBlockedAppNames = useMemo(
    () => state.alwaysBlockedApps
      .map(entry => ESSENTIAL_APP_OPTIONS.find(app => app.id === entry.appId)?.name ?? entry.appId)
      .sort((a, b) => a.localeCompare(b)),
    [state.alwaysBlockedApps]
  );
  const selectableAppIds = useMemo(
    () => appIds.filter(appId => !alwaysBlockedIds.has(appId)),
    [alwaysBlockedIds, appIds]
  );
  const nativeAlwaysBlockedCount = (alwaysStrictSummary?.applicationCount ?? 0)
    + (alwaysLooseSummary?.applicationCount ?? 0);
  const alwaysBlockedCount = nativeAvailable ? nativeAlwaysBlockedCount : alwaysBlockedAppNames.length;
  const canCreate = name.trim().length > 0
    && nameAvailable
    && (nativeAvailable ? (draftNativeSummary?.applicationCount ?? 0) > 0 : selectableAppIds.length > 0);

  const reset = (preserveNativeSelection: boolean) => {
    if (nativeAvailable && !preserveNativeSelection) {
      void clearNativeActivitySelection(librarySelectionId(draftGroupId));
    }
    setMode('new');
    setName('');
    setIcon(GROUP_ICONS[0]);
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
      appIds: nativeAvailable ? [] : selectableAppIds,
      icon,
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
      <FocusSheetHeader kicker="APP GROUP CATALOG" title="Add a Group" onClose={close} />

      <View style={{ marginTop: 14 }}>
        <FocusSegments
          options={[
            { key: 'new', label: 'Add new', icon: ink => <Plus s={15} c={ink} w={2.4} /> },
            { key: 'existing', label: 'Use existing', icon: ink => <BookMarked s={15} c={ink} w={2.1} /> },
          ]}
          value={mode}
          onChange={key => setMode(key as Mode)}
          height={46}
        />
      </View>

      {/* ONE scroll surface for the whole body.
          `SmoothBottomSheet` gives no scrolling of its own — the sheet is a
          fixed box (maxHeight 93%) and its children must carry it. This used to
          be a short form with a scrolling app list nested inside it; once the
          face picker was added the form outgrew the box, and because RN's
          default `flexShrink` is 0 the column simply overflowed: everything
          below the nested list, the Add button included, went off-screen with
          nothing to scroll it back. So the body scrolls as one thing, and the
          action stays pinned below it where it can always be reached. */}
      <ScrollView
        style={s.body}
        contentContainerStyle={s.bodyContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
      {mode === 'new' ? (
        <>
          {/* The name and the face are one identity, so they are asked as one
              thing: the seal shows what you are making while you make it, and
              the field beside it names it. */}
          <View style={s.identity}>
            <GroupSeal groupId="custom" name={name || '?'} size={46} icon={icon} tone={RULE_TONES.limit} />
            <View style={s.identityCopy}>
              <Text style={s.fieldLabel}>Name</Text>
              <View style={[s.nameSurface, nameFocused && s.nameSurfaceOn]}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                  placeholder="Name the group"
                  placeholderTextColor={C.textMuted}
                  maxLength={28}
                  style={s.nameInput}
                />
              </View>
            </View>
          </View>
          {name.trim().length > 0 && !nameAvailable && (
            <Text style={s.nameError}>That name already belongs to a default or saved group.</Text>
          )}

          {/* The same picker Habits and Big Events use — one element, so an
              improvement to any of the three lands on all of them. */}
          <Text style={[s.fieldLabel, s.fieldLabelStandalone]}>Face</Text>
          <EmojiPicker
            value={icon}
            icons={GROUP_ICONS}
            onChange={setIcon}
            accent={RULE_TONES.limit.color}
            tint={RULE_TONES.limit.bg}
            // Three rows, not five: the app list has to stay reachable below.
            collapsedRows={3}
            deferExtras
          />
          <Text style={s.helper}>Choose the apps this group owns. They will move out of their previous group in this plan.</Text>

          {nativeAvailable ? (
            <View style={s.nativeNewGroup}>
              <NativeActivitySelectionButton
                selectionId={librarySelectionId(draftGroupId)}
                title={name.trim() ? `Choose apps for ${name.trim()}` : 'Choose apps for this group'}
                label="Choose group apps privately"
              />
              <Text style={s.nativeSetupNote}>Apple keeps app names private. Anasta stores this group by name and uses only its protected selection token.</Text>
              <AlwaysBlockedPickerGroup appNames={[]} count={alwaysBlockedCount} privateNames />
            </View>
          ) : <View style={s.list}>
            {APP_CATEGORIES.map(category => {
              const availableApps = appsInCategory(category.id).filter(app => !alwaysBlockedIds.has(app.id));
              if (availableApps.length === 0) return null;
              return (
              <View key={category.id}>
                {/* The category names itself once, in its own colour, and every
                    app below it is then free to carry only its selected state.
                    Identity above, state below — the same division the rule
                    cards keep. */}
                <View style={s.categoryHead}>
                  <Text style={[s.groupLabel, { color: categoryTint(category.id).color }]}>
                    {category.name.toUpperCase()}
                  </Text>
                  <View style={[s.categoryRule, { backgroundColor: withAlpha(categoryTint(category.id).color, 0.22) }]} />
                </View>
                {availableApps.map(app => (
                  <AppChoiceCard
                    key={app.id}
                    name={app.name}
                    selected={appIds.includes(app.id)}
                    onToggle={() => setAppIds(current =>
                      current.includes(app.id)
                        ? current.filter(id => id !== app.id)
                        : [...current, app.id]
                    )}
                  />
                ))}
              </View>
            );})}
            <AlwaysBlockedPickerGroup appNames={alwaysBlockedAppNames} count={alwaysBlockedCount} />
          </View>}
        </>
      ) : (
        <View style={s.existingList}>
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
            const availableAppIds = group.appIds.filter(appId => !alwaysBlockedIds.has(appId));
            const blockedAppCount = group.appIds.length - availableAppIds.length;
            return (
              <View key={group.id} style={s.existingGroup}>
                <TouchableOpacity style={s.existingRow} onPress={() => setPreviewId(open ? null : group.id)}>
                  <GroupSeal groupId={group.id} name={group.name} size={40} icon={group.icon} tone={RULE_TONES.limit} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.existingName}>{group.name}</Text>
                    <Text style={s.existingMeta}>
                      {nativeAvailable
                        ? 'Private iPhone group'
                        : `${availableAppIds.length} apps${blockedAppCount > 0 ? ` · ${blockedAppCount} Always Blocked` : ''}`}
                    </Text>
                  </View>
                  <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}><ChevronRight s={16} c={C.textMuted} w={2} /></View>
                </TouchableOpacity>
                {open && (
                  <View style={s.preview}>
                    {!nativeAvailable && <View style={s.previewApps}>
                      {availableAppIds.map(appId => (
                        <View key={appId} style={s.previewChip}>
                          <Text style={s.previewChipText}>{PREVIEW_APPS.find(app => app.id === appId)?.name ?? appId}</Text>
                        </View>
                      ))}
                    </View>}
                    {!nativeAvailable && blockedAppCount > 0 && (
                      <Text style={s.excludedAppsNote}>{blockedAppCount} {blockedAppCount === 1 ? 'app stays' : 'apps stay'} in the Always Blocked system group.</Text>
                    )}
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
                      <GoldButton
                        label="Add this group"
                        disabled={availableAppIds.length === 0}
                        onPress={() => { onAdd(group.id, availableAppIds); close(); }}
                      />
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
        </View>
      )}
      </ScrollView>

      {/* Pinned below the scroll, so the action never scrolls out of reach.
          Only 'Add new' has one — a saved group is added from its own row. */}
      {mode === 'new' && (
        <GoldButton
          label={creating ? 'Adding group...' : 'Add group'}
          disabled={!canCreate || creating}
          onPress={create}
          style={s.footerAction}
        />
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
  // `flexShrink: 1` is the whole fix. React Native defaults flexShrink to 0,
  // so a column taller than its maxHeight box overflows rather than yielding,
  // and everything past the edge becomes unreachable. Shrinking lets this
  // take the space that is left and scroll the rest.
  body: { flexShrink: 1 },
  bodyContent: { paddingBottom: 4 },
  footerAction: { marginTop: 12 },
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
  // The name and the face asked as one identity, with the seal showing what is
  // being made while it is being made.
  identity: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 13 },
  identityCopy: { flex: 1, minWidth: 0 },
  fieldLabel: { fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 1.9, color: '#9C9077' },
  fieldLabelStandalone: { marginTop: 18, marginBottom: 9 },
  nameSurface: { marginTop: 6, height: 48, borderRadius: 14, borderCurve: 'continuous', borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, paddingHorizontal: 13, justifyContent: 'center' },
  // The field says it is taking what you type, rather than sitting inert.
  nameSurfaceOn: { borderColor: RULE_TONES.limit.color, backgroundColor: RULE_TONES.limit.bg },
  nameInput: { fontFamily: F.serifMedium, fontSize: 17, color: C.text },
  nameError: { marginTop: 6, fontFamily: F.serif, fontSize: 13, lineHeight: 17, color: '#A24351' },
  helper: { marginTop: 14, fontFamily: F.serif, fontSize: 14, lineHeight: 19, color: C.textSecondary },
  nativeNewGroup: { marginTop: 12, gap: 8 },
  nativeSetupNote: { paddingHorizontal: 4, fontFamily: F.serif, fontSize: 13, lineHeight: 17.5, color: C.textMuted, textAlign: 'center' },
  alwaysBlockedGroup: { marginTop: 16, marginBottom: 4, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, borderColor: '#EBCED4', backgroundColor: '#FFF9FA', padding: 14, gap: 11 },
  alwaysBlockedHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  // The lock is struck ON the seal rather than set beside it — the same seal
  // grammar the group faces use, in the blocked register.
  alwaysBlockedSeal: { width: 36, height: 36, borderRadius: 12, borderCurve: 'continuous', backgroundColor: '#A24351', alignItems: 'center', justifyContent: 'center' },
  alwaysBlockedTitle: { fontFamily: F.serifSemiBold, fontSize: 17, color: '#7B3945' },
  alwaysBlockedMeta: { marginTop: 2, fontFamily: F.sans, fontSize: 12.5, color: '#A08B8F' },
  alwaysBlockedCountSeat: { minWidth: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: '#EBCED4', backgroundColor: '#FDF0F2', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  alwaysBlockedCount: { fontFamily: F.sansBold, fontSize: 13, color: '#A24351', fontVariant: ['tabular-nums'] },
  alwaysBlockedDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EBCED4' },
  alwaysBlockedNames: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  alwaysBlockedNameChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, borderCurve: 'continuous', borderWidth: 1, borderColor: '#F2DDE1', backgroundColor: '#FDF0F2', paddingHorizontal: 9, paddingVertical: 6 },
  alwaysBlockedName: { fontFamily: F.sansSemiBold, fontSize: 11.5, color: '#8A4854' },
  alwaysBlockedReason: { fontFamily: F.serif, fontSize: 13, lineHeight: 17.5, color: '#9C8A8D' },
  // No maxHeight and no scrolling of its own — the app list is part of the
  // page now, and the body above it does the scrolling.
  list: { marginTop: 4 },
  groupLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.9 },
  categoryHead: { marginTop: 16, marginBottom: 7, flexDirection: 'row', alignItems: 'center', gap: 9 },
  categoryRule: { flex: 1, height: StyleSheet.hairlineWidth },
  // A card per app, spaced rather than ruled: a hairline list makes every app
  // look like a setting, and these are choices.
  appCard: { minHeight: 54, marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 15, borderCurve: 'continuous', borderWidth: 1, paddingHorizontal: 11 },
  // iOS icon proportions — this is where the real app icon will sit.
  appSeat: { width: 32, height: 32, borderRadius: 10, borderCurve: 'continuous', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  appSeatLetter: { fontFamily: F.serifSemiBold, fontSize: 15 },
  appName: { flex: 1, fontFamily: F.serifMedium, fontSize: 16 },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#D6D3D1', backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { borderColor: C.gold, backgroundColor: C.gold },
  existingList: { marginTop: 14 },
  existingGroup: { borderTopWidth: 1, borderTopColor: C.border },
  existingRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10 },
  existingName: { fontFamily: F.serifSemiBold, fontSize: 17, color: C.text },
  existingMeta: { marginTop: 2, fontFamily: F.sans, fontSize: 12.5, color: C.textMuted },
  preview: { paddingLeft: 43, paddingBottom: 14, gap: 12 },
  previewApps: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  previewChip: { borderRadius: 999, backgroundColor: '#F0EFEB', paddingHorizontal: 8, paddingVertical: 5 },
  previewChipText: { fontFamily: F.sansMedium, fontSize: 11, color: C.textSecondary },
  excludedAppsNote: { fontFamily: F.serif, fontSize: 13, lineHeight: 17, color: '#8A4854' },
  alreadyRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 13, backgroundColor: '#EAF3ED' },
  alreadyText: { fontFamily: F.sansSemiBold, fontSize: 13, color: '#397A5A' },
  deleteGroupButton: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7 },
  deleteGroupButtonLocked: { opacity: 0.82 },
  deleteGroupText: { fontFamily: F.sansSemiBold, fontSize: 9.5, color: '#A24351' },
  deleteGroupTextLocked: { color: C.textMuted },
  lockedReason: { marginTop: -5, paddingHorizontal: 4, fontFamily: F.sans, fontSize: 9, lineHeight: 13, color: C.textMuted, textAlign: 'center' },
  emptyState: { minHeight: 220, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 25 },
  emptyPlus: { width: 43, height: 43, borderRadius: 14, backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { marginTop: 11, fontFamily: F.serifMedium, fontSize: 18, color: C.text },
  emptyBody: { marginTop: 5, fontFamily: F.serif, fontSize: 14, lineHeight: 19, color: C.textSecondary, textAlign: 'center' },
});
