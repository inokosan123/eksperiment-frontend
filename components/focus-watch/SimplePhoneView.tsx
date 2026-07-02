import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { Cross, MapPin, MessageCircle, Phone } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import FocusSwitch from './FocusSwitch';
import AppPicker from './AppPicker';
import {
  toggleAllowlistMode,
  updateAllowlistConfig,
  useFocusWatch,
} from './focusWatchStore';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';

const enter = (delay: number) => FadeInDown.duration(420).delay(delay);

const ESSENTIALS = [
  { id: 'phone', name: 'Phone', Icon: Phone },
  { id: 'messages', name: 'Messages', Icon: MessageCircle },
  { id: 'maps', name: 'Maps', Icon: MapPin },
  { id: 'anasta', name: 'Anasta', Icon: Cross },
];

export default function SimplePhoneView() {
  const { allowlistMode, allowlistConfig } = useFocusWatch();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitleBar title="SIMPLE PHONE" showBack />
        <Animated.View entering={enter(0)}>
          <Text style={s.intro}>One phone, only what matters.</Text>
        </Animated.View>

        <View style={{ paddingHorizontal: 16 }}>
          <Animated.View entering={enter(70)}>
            <View style={s.masterCard}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={s.masterTitle}>Simple phone</Text>
                <Text style={s.masterDesc}>
                  Everything is held back except what you choose to keep.
                </Text>
              </View>
              <FocusSwitch value={allowlistMode} onToggle={toggleAllowlistMode} />
            </View>
          </Animated.View>

          <Animated.View entering={enter(140)}>
            <Text style={s.sectionLabel}>ALWAYS KEPT</Text>
            <View style={s.groupCard}>
              {ESSENTIALS.map((item, i) => (
                <View key={item.id}>
                  {i > 0 && <View style={s.separator} />}
                  <View style={s.essentialRow}>
                    <View style={s.essentialIcon}>
                      <item.Icon s={15} c={C.goldDark} w={2} />
                    </View>
                    <Text style={s.essentialName}>{item.name}</Text>
                    <Text style={s.essentialKept}>always kept</Text>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>

          <Animated.View entering={enter(210)}>
            <Text style={s.sectionLabel}>ALSO KEEP OPEN</Text>
            <AppPicker
              selection={allowlistConfig.keep}
              onChange={keep => updateAllowlistConfig({ keep })}
            />
            <Text style={s.helperText}>
              Whatever you check here stays open while Simple phone is on. Everything else waits.
            </Text>
          </Animated.View>

          <Animated.View entering={enter(280)}>
            <Text style={s.sectionLabel}>STRENGTH</Text>
            <View style={s.strengthRow}>
              <TouchableOpacity
                style={[s.strengthCard, allowlistConfig.strength === 'loose' && s.strengthCardOn]}
                activeOpacity={0.85}
                haptic="selection"
                onPress={() => updateAllowlistConfig({ strength: 'loose' })}
              >
                <Text style={s.strengthTitle}>Loose</Text>
                <Text style={s.strengthDesc}>You may switch it off at any time.</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.strengthCard, allowlistConfig.strength === 'strict' && s.strengthCardOn]}
                activeOpacity={0.85}
                haptic="selection"
                onPress={() => updateAllowlistConfig({ strength: 'strict' })}
              >
                <Text style={s.strengthTitle}>Strict</Text>
                <Text style={s.strengthDesc}>Turning it off waits for the cooldown.</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          <Animated.View entering={enter(340)}>
            <Text style={s.footnote}>
              Simple phone becomes a real system-level mode once Apple grants the Screen Time
              permission. Shape it here the way you will want it kept.
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
  helperText: {
    marginTop: 9,
    marginHorizontal: 10,
    fontFamily: F.sans,
    fontSize: 11,
    lineHeight: 16,
    color: C.textMuted,
  },

  masterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.goldBg,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.goldLight,
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginTop: 8,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  masterTitle: {
    fontFamily: F.serifMedium,
    fontSize: 19,
    color: C.text,
  },
  masterDesc: {
    marginTop: 3,
    fontFamily: F.serif,
    fontSize: 14.5,
    lineHeight: 19,
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
  essentialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  essentialIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.goldBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  essentialName: {
    flex: 1,
    fontFamily: F.serifMedium,
    fontSize: 16.5,
    color: C.text,
  },
  essentialKept: {
    fontFamily: F.sansMedium,
    fontSize: 11.5,
    color: C.textMuted,
  },

  strengthRow: {
    flexDirection: 'row',
    gap: 8,
  },
  strengthCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  strengthCardOn: {
    borderColor: C.gold,
    backgroundColor: C.goldBg,
  },
  strengthTitle: {
    fontFamily: F.serifMedium,
    fontSize: 17,
    color: C.text,
  },
  strengthDesc: {
    marginTop: 3,
    fontFamily: F.sans,
    fontSize: 11,
    lineHeight: 15,
    color: C.textSecondary,
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
