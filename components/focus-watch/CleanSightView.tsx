import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { Globe, Plus, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import FocusSwitch from './FocusSwitch';
import { WEB_PACKS } from './focusContent';
import {
  addCustomDomain,
  normalizeDomain,
  removeCustomDomain,
  toggleWebPack,
  useFocusWatch,
} from './focusWatchStore';

const enter = (delay: number) => FadeInDown.duration(420).delay(delay);
const LIST_TRANSITION = LinearTransition.springify().damping(19).stiffness(200);

function PackCard({ packId }: { packId: (typeof WEB_PACKS)[number]['id'] }) {
  const { webPacks } = useFocusWatch();
  const content = WEB_PACKS.find(pack => pack.id === packId)!;
  const enabled = webPacks.find(pack => pack.id === packId)?.enabled ?? false;

  return (
    <View style={s.packCard}>
      <View style={[s.packIcon, { backgroundColor: content.iconBg }]}>{content.icon}</View>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={s.packName}>{content.name}</Text>
        <Text style={s.packDetail}>{content.detail}</Text>
      </View>
      <FocusSwitch value={enabled} onToggle={() => toggleWebPack(packId)} />
    </View>
  );
}

function CustomDomains() {
  const { customDomains } = useFocusWatch();
  const [draft, setDraft] = useState('');
  const canAdd = normalizeDomain(draft).includes('.');

  const submit = () => {
    if (!canAdd) return;
    addCustomDomain(draft);
    setDraft('');
  };

  return (
    <Animated.View style={s.groupCard} layout={LIST_TRANSITION}>
      {customDomains.map((domain, i) => (
        <Animated.View
          key={domain}
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(160)}
          layout={LIST_TRANSITION}
        >
          {i > 0 && <View style={s.separator} />}
          <View style={s.domainRow}>
            <Globe s={14} c={C.textMuted} w={2} />
            <Text style={s.domainText}>{domain}</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={() => removeCustomDomain(domain)}
            >
              <X s={15} c={C.textMuted} w={2.2} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      ))}

      {customDomains.length > 0 && <View style={s.separator} />}
      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={submit}
          placeholder="e.g. bet365.com"
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
  );
}

export default function CleanSightView() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenTitleBar title="CLEAN SIGHT" showBack />
        <Animated.View entering={enter(0)}>
          <Text style={s.intro}>Close the door on what wounds the eyes.</Text>
        </Animated.View>

        <View style={{ paddingHorizontal: 16 }}>
          <Animated.View entering={enter(70)}>
            <Text style={s.sectionLabel}>PROTECTION PACKS</Text>
          </Animated.View>

          {WEB_PACKS.map((pack, i) => (
            <Animated.View key={pack.id} entering={enter(100 + i * 55)}>
              <PackCard packId={pack.id} />
            </Animated.View>
          ))}

          <Animated.View entering={enter(340)}>
            <Text style={s.sectionLabel}>CUSTOM WEBSITES</Text>
            <CustomDomains />
          </Animated.View>

          <Animated.View entering={enter(400)}>
            <Text style={s.footnote}>
              One system filter covers Safari, Chrome and the other browsers on this phone.
              We verify it on device once Apple grants the Screen Time permission.
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

  packCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginBottom: 8,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
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
  domainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12.5,
  },
  domainText: {
    flex: 1,
    fontFamily: F.sansMedium,
    fontSize: 14,
    color: C.text,
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
