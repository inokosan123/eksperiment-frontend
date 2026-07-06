import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { Globe, Plus, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import WebPackCard from './WebPackCard';
import ScreenTimePermissionModal from './ScreenTimePermissionModal';
import FocusWatchLottie from './FocusWatchLottie';
import { SMOOTH_LAYOUT, SOFT_IN, SOFT_OUT } from './focusMotion';
import { WEB_PACKS } from './focusContent';
import {
  addCustomDomain,
  grantScreenTimePermission,
  hasScreenTimePermission,
  normalizeDomain,
  removeCustomDomain,
  toggleWebPack,
  useFocusWatch,
  type WebPackId,
} from './focusWatchStore';

const enter = (delay: number) => FadeInDown.duration(420).delay(delay);
const LIST_TRANSITION = SMOOTH_LAYOUT;

function CustomDomains() {
  const { customDomains } = useFocusWatch();
  const [draft, setDraft] = useState('');
  const [pendingDraft, setPendingDraft] = useState<string | null>(null);
  const canAdd = normalizeDomain(draft).includes('.');

  const submit = () => {
    if (!canAdd) return;
    if (!hasScreenTimePermission()) {
      setPendingDraft(draft);
      return;
    }
    addCustomDomain(draft);
    setDraft('');
  };

  return (
    <Animated.View style={s.groupCard} layout={LIST_TRANSITION}>
      {customDomains.map((domain, i) => (
        <Animated.View
          key={domain}
          entering={SOFT_IN}
          exiting={SOFT_OUT}
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
      <ScreenTimePermissionModal
        visible={pendingDraft !== null}
        onCancel={() => setPendingDraft(null)}
        onConfirm={() => {
          const raw = pendingDraft;
          grantScreenTimePermission();
          setPendingDraft(null);
          if (raw) {
            addCustomDomain(raw);
            setDraft('');
          }
        }}
      />
    </Animated.View>
  );
}

export default function CleanSightView() {
  const { webPacks } = useFocusWatch();
  const [pendingPackId, setPendingPackId] = useState<WebPackId | null>(null);

  const requestTogglePack = (packId: WebPackId, enabled: boolean) => {
    if (enabled || hasScreenTimePermission()) {
      toggleWebPack(packId);
      return;
    }
    setPendingPackId(packId);
  };

  const confirmPermission = () => {
    const id = pendingPackId;
    grantScreenTimePermission();
    setPendingPackId(null);
    if (id) toggleWebPack(id);
  };

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

        <Animated.View entering={enter(40)} style={s.heroAnim}>
          <FocusWatchLottie name="website" mode="periodic" restMs={4000} style={s.heroLottie} />
        </Animated.View>

        <View style={{ paddingHorizontal: 16 }}>
          <Animated.View entering={enter(70)}>
            <Text style={s.sectionLabel}>PROTECTION PACKS</Text>
          </Animated.View>

          {WEB_PACKS.map((pack, i) => (
            <Animated.View key={pack.id} entering={enter(100 + i * 55)}>
              <WebPackCard
                packId={pack.id}
                enabled={webPacks.find(entry => entry.id === pack.id)?.enabled ?? false}
                onToggle={() =>
                  requestTogglePack(
                    pack.id,
                    webPacks.find(entry => entry.id === pack.id)?.enabled ?? false
                  )
                }
              />
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
      <ScreenTimePermissionModal
        visible={pendingPackId !== null}
        onCancel={() => setPendingPackId(null)}
        onConfirm={confirmPermission}
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
  heroAnim: {
    alignItems: 'center',
    marginTop: 2,
    marginBottom: -6,
  },
  heroLottie: {
    width: 170,
    height: 120,
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
