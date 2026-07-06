import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import FocusSwitch from './FocusSwitch';
import ScreenTimePermissionModal from './ScreenTimePermissionModal';
import {
  grantScreenTimePermission,
  hasScreenTimePermission,
  updateStrictSettings,
  useFocusWatch,
  type StrictCooldown,
} from './focusWatchStore';

const enter = (delay: number) => FadeInDown.duration(420).delay(delay);

const COOLDOWN_OPTIONS: { id: StrictCooldown; label: string }[] = [
  { id: '10m', label: '10 minutes' },
  { id: '1h', label: '1 hour' },
  { id: 'morning', label: 'Until morning' },
];

export default function StrictWatchView() {
  const { strictSettings } = useFocusWatch();
  const { enabled } = strictSettings;
  const [permissionPrompt, setPermissionPrompt] = useState(false);

  const requestToggleStrict = () => {
    if (enabled) {
      updateStrictSettings({ enabled: false });
      return;
    }
    if (hasScreenTimePermission()) {
      updateStrictSettings({ enabled: true });
      return;
    }
    setPermissionPrompt(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitleBar title="STRICT WATCH" showBack />
        <Animated.View entering={enter(0)}>
          <Text style={s.intro}>No easy way out — by your own choice.</Text>
        </Animated.View>

        <View style={{ paddingHorizontal: 16 }}>
          <Animated.View entering={enter(70)}>
            <View style={s.masterCard}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={s.masterTitle}>Strict Watch</Text>
                <Text style={s.masterDesc}>
                  When on, your rules cannot be quietly undone in a weak moment.
                </Text>
              </View>
              <FocusSwitch
                value={enabled}
                onToggle={requestToggleStrict}
              />
            </View>
          </Animated.View>

          <Animated.View entering={enter(140)}>
            <Text style={s.sectionLabel}>THE LOCKS</Text>
            <View
              style={enabled ? undefined : s.locksDimmed}
              pointerEvents={enabled ? 'auto' : 'none'}
            >
              <View style={s.lockCard}>
                <Text style={s.lockTitle}>Cooldown before changes</Text>
                <Text style={s.lockDesc}>
                  Weakening a rule or ending a strict watch only takes effect after the wait.
                </Text>
                <View style={s.cooldownRow}>
                  {COOLDOWN_OPTIONS.map(option => {
                    const selected = strictSettings.cooldown === option.id;
                    return (
                      <TouchableOpacity
                        key={option.id}
                        style={[s.cooldownChip, selected && s.cooldownChipOn]}
                        activeOpacity={0.8}
                        haptic="selection"
                        onPress={() => updateStrictSettings({ cooldown: option.id })}
                      >
                        <Text style={[s.cooldownChipText, selected && s.cooldownChipTextOn]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={s.lockCard}>
                <View style={s.lockRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={s.lockTitle}>Uninstall protection</Text>
                    <Text style={s.lockDesc}>
                      Anasta cannot be deleted while a strict watch stands.
                    </Text>
                  </View>
                  <FocusSwitch
                    value={strictSettings.uninstallProtection}
                    onToggle={() =>
                      updateStrictSettings({
                        uninstallProtection: !strictSettings.uninstallProtection,
                      })
                    }
                  />
                </View>
              </View>

              <View style={s.lockCard}>
                <View style={s.lockRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={s.lockTitle}>Block new installs</Text>
                    <Text style={s.lockDesc}>
                      No new apps during protected hours — no re-downloading the bookmaker.
                    </Text>
                  </View>
                  <FocusSwitch
                    value={strictSettings.denyNewApps}
                    onToggle={() =>
                      updateStrictSettings({ denyNewApps: !strictSettings.denyNewApps })
                    }
                  />
                </View>
              </View>
            </View>
          </Animated.View>

          <Animated.View entering={enter(220)}>
            <Text style={s.footnote}>
              These locks are enforced by iOS itself once Apple grants the Screen Time
              permission. Until then, set them the way you will want them kept.
            </Text>
          </Animated.View>
        </View>
      </ScrollView>
      <ScreenTimePermissionModal
        visible={permissionPrompt}
        onCancel={() => setPermissionPrompt(false)}
        onConfirm={() => {
          grantScreenTimePermission();
          setPermissionPrompt(false);
          updateStrictSettings({ enabled: true });
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

  locksDimmed: {
    opacity: 0.45,
  },
  lockCard: {
    backgroundColor: C.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockTitle: {
    fontFamily: F.serifMedium,
    fontSize: 17,
    color: C.text,
  },
  lockDesc: {
    marginTop: 3,
    fontFamily: F.sans,
    fontSize: 11.5,
    lineHeight: 16,
    color: C.textSecondary,
  },
  cooldownRow: {
    marginTop: 11,
    flexDirection: 'row',
    gap: 7,
  },
  cooldownChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    alignItems: 'center',
  },
  cooldownChipOn: {
    borderColor: C.gold,
    backgroundColor: C.goldBg,
  },
  cooldownChipText: {
    fontFamily: F.sansMedium,
    fontSize: 11.5,
    color: C.textSecondary,
  },
  cooldownChipTextOn: {
    fontFamily: F.sansSemiBold,
    color: C.goldDark,
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
