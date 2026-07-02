import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { Globe, Plus, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import {
  addNeverAllowedSite,
  normalizeDomain,
  removeNeverAllowed,
  useFocusWatch,
  type NeverAllowedEntry,
} from './focusWatchStore';

const enter = (delay: number) => FadeInDown.duration(420).delay(delay);
const LIST_TRANSITION = LinearTransition.springify().damping(19).stiffness(200);

function EntryRow({ entry }: { entry: NeverAllowedEntry }) {
  const confirmRemove = () => {
    Alert.alert(
      'Open this door again?',
      'It was closed for a reason. Once real, removing an entry waits until the next morning.',
      [
        { text: 'Keep it closed', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeNeverAllowed(entry.id) },
      ]
    );
  };

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
        onPress={confirmRemove}
      >
        <X s={15} c={C.textMuted} w={2.2} />
      </TouchableOpacity>
    </View>
  );
}

export default function NeverAllowedView() {
  const { neverAllowed } = useFocusWatch();
  const [draft, setDraft] = useState('');
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
          <Animated.View entering={enter(70)}>
            <Text style={s.sectionLabel}>THE LIST</Text>
            <Animated.View style={s.groupCard} layout={LIST_TRANSITION}>
              {neverAllowed.map((entry, i) => (
                <Animated.View
                  key={entry.id}
                  entering={FadeIn.duration(220)}
                  exiting={FadeOut.duration(160)}
                  layout={LIST_TRANSITION}
                >
                  {i > 0 && <View style={s.separator} />}
                  <EntryRow entry={entry} />
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

          <Animated.View entering={enter(150)}>
            <Text style={s.footnote}>
              Entries here run day and night, with no unlock and no exceptions.
              Blocked apps join this list once Apple grants the Screen Time permission.
            </Text>
          </Animated.View>
        </View>
      </ScrollView>
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
