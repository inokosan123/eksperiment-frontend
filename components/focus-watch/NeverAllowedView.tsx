import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { Globe, Plus, Shield, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import FocusSwitch from './FocusSwitch';
import { WEB_PACKS } from './focusContent';
import {
  addNeverAllowedSite,
  normalizeDomain,
  removeNeverAllowed,
  toggleNeverPack,
  useFocusWatch,
  type NeverAllowedEntry,
  type WebPackId,
} from './focusWatchStore';

const enter = (delay: number) => FadeInDown.duration(420).delay(delay);
const LIST_TRANSITION = LinearTransition.springify().damping(19).stiffness(200);

const NEVER_PACK_IDS: WebPackId[] = ['gambling', 'adult'];

function NeverPackRow({
  packId,
  onAskDisable,
}: {
  packId: WebPackId;
  onAskDisable: (id: WebPackId) => void;
}) {
  const { neverPacks } = useFocusWatch();
  const content = WEB_PACKS.find(pack => pack.id === packId)!;
  const enabled = neverPacks.find(pack => pack.id === packId)?.enabled ?? false;

  return (
    <View style={s.packRow}>
      <View style={[s.packIcon, { backgroundColor: content.iconBg }]}>{content.icon}</View>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={s.packName}>{content.name}</Text>
        <Text style={s.packDetail}>
          {enabled ? 'Closed for good — apps and sites' : content.detail}
        </Text>
      </View>
      <FocusSwitch
        value={enabled}
        onToggle={() => (enabled ? onAskDisable(packId) : toggleNeverPack(packId))}
      />
    </View>
  );
}

function EntryRow({
  entry,
  onAskRemove,
}: {
  entry: NeverAllowedEntry;
  onAskRemove: (entry: NeverAllowedEntry) => void;
}) {
  return (
    <View style={s.entryRow}>
      <Globe s={14} c={C.textMuted} w={2} />
      <Text style={s.entryText}>{entry.label}</Text>
      <View style={s.kindChip}>
        <Text style={s.kindChipText}>{entry.kind === 'site' ? 'SITE' : 'APP'}</Text>
      </View>
      <TouchableOpacity
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        onPress={() => onAskRemove(entry)}
      >
        <X s={15} c={C.textMuted} w={2.2} />
      </TouchableOpacity>
    </View>
  );
}

export default function NeverAllowedView() {
  const { neverAllowed } = useFocusWatch();
  const [draft, setDraft] = useState('');
  const [packToDisable, setPackToDisable] = useState<WebPackId | null>(null);
  const [entryToRemove, setEntryToRemove] = useState<NeverAllowedEntry | null>(null);
  const canAdd = normalizeDomain(draft).includes('.');

  const submit = () => {
    if (!canAdd) return;
    addNeverAllowedSite(draft);
    setDraft('');
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenTitleBar title="NEVER ALLOWED" showBack />
        <Animated.View entering={enter(0)}>
          <Text style={s.intro}>Doors that stay closed. For good.</Text>
        </Animated.View>

        <View style={{ paddingHorizontal: 16 }}>
          <Animated.View entering={enter(60)}>
            <Text style={s.sectionLabel}>ALWAYS-CLOSED PACKS</Text>
            <View style={s.groupCard}>
              {NEVER_PACK_IDS.map((packId, i) => (
                <View key={packId}>
                  {i > 0 && <View style={s.separator} />}
                  <NeverPackRow packId={packId} onAskDisable={setPackToDisable} />
                </View>
              ))}
            </View>
          </Animated.View>

          <Animated.View entering={enter(120)}>
            <Text style={s.sectionLabel}>YOUR OWN DOORS</Text>
            <Animated.View style={s.groupCard} layout={LIST_TRANSITION}>
              {neverAllowed.map((entry, i) => (
                <Animated.View
                  key={entry.id}
                  entering={FadeIn.duration(220)}
                  exiting={FadeOut.duration(160)}
                  layout={LIST_TRANSITION}
                >
                  {i > 0 && <View style={s.separator} />}
                  <EntryRow entry={entry} onAskRemove={setEntryToRemove} />
                </Animated.View>
              ))}

              {neverAllowed.length > 0 && <View style={s.separator} />}
              <View style={s.inputRow}>
                <TextInput
                  style={s.input}
                  value={draft}
                  onChangeText={setDraft}
                  onSubmitEditing={submit}
                  placeholder="a site to keep closed, e.g. stake.com"
                  placeholderTextColor={C.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={[s.addBtn, !canAdd && { opacity: 0.35 }]}
                  activeOpacity={0.8}
                  disabled={!canAdd}
                  haptic="medium"
                  onPress={submit}
                >
                  <Plus s={15} c="#fff" w={2.6} />
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Animated.View>

          <Animated.View entering={enter(180)}>
            <Text style={s.footnote}>
              Everything here runs day and night, with no unlock and no exceptions.
              Blocked apps join this list once Apple grants the Screen Time permission.
            </Text>
          </Animated.View>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={packToDisable !== null}
        icon={<Shield s={22} c={C.red} w={2} />}
        title="Open this door again?"
        body="It was closed for a reason. Once real, this waits until the next morning — no 2 a.m. exceptions."
        subject={WEB_PACKS.find(pack => pack.id === packToDisable)?.name}
        confirmLabel="OPEN TOMORROW"
        cancelLabel="KEEP IT CLOSED"
        onCancel={() => setPackToDisable(null)}
        onConfirm={() => {
          if (packToDisable) toggleNeverPack(packToDisable);
          setPackToDisable(null);
        }}
      />

      <ConfirmModal
        visible={entryToRemove !== null}
        icon={<Shield s={22} c={C.red} w={2} />}
        title="Open this door again?"
        body="It was closed for a reason. Once real, removing an entry waits until the next morning."
        subject={entryToRemove?.label}
        confirmLabel="REMOVE"
        cancelLabel="KEEP IT CLOSED"
        onCancel={() => setEntryToRemove(null)}
        onConfirm={() => {
          if (entryToRemove) removeNeverAllowed(entryToRemove.id);
          setEntryToRemove(null);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  intro: {
    paddingHorizontal: 32,
    paddingTop: 2,
    paddingBottom: 8,
    fontFamily: F.serifMediumItalic,
    fontSize: 16,
    lineHeight: 21,
    color: C.textSecondary,
    textAlign: 'center',
  },
  sectionLabel: {
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 10,
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: C.textMuted,
  },
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
  packRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  packIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packName: {
    fontFamily: F.serifMedium,
    fontSize: 17,
    color: C.text,
  },
  packDetail: {
    marginTop: 2,
    fontFamily: F.sans,
    fontSize: 11.5,
    color: C.textSecondary,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12.5,
  },
  entryText: {
    flex: 1,
    fontFamily: F.sansMedium,
    fontSize: 14,
    color: C.text,
  },
  kindChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#FBE6E9',
  },
  kindChipText: {
    fontFamily: F.sansBold,
    fontSize: 8.5,
    letterSpacing: 1.2,
    color: '#B54155',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  input: {
    flex: 1,
    fontFamily: F.sansMedium,
    fontSize: 14,
    color: C.text,
    paddingVertical: 8,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footnote: {
    marginTop: 18,
    paddingHorizontal: 22,
    fontFamily: F.sans,
    fontSize: 11,
    lineHeight: 16,
    color: C.textMuted,
    textAlign: 'center',
  },
});
