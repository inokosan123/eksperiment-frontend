import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { Globe, Hourglass, Lock, Plus, Shield, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import FocusSwitch from './FocusSwitch';
import FocusWatchLottie from './FocusWatchLottie';
import WebPackCard from './WebPackCard';
import { usePermissionGate } from './usePermissionGate';
import { SMOOTH_LAYOUT, SOFT_IN, SOFT_OUT } from './focusMotion';
import { WEB_PACKS } from './focusContent';
import {
  addCustomDomain,
  formatEndsAt,
  normalizeDomain,
  removeCustomDomain,
  setDomainNever,
  setPackMode,
  updateLocks,
  useDayPlan,
  type LockCooldown,
  type WebPackId,
} from './dayPlanStore';

const enter = (delay: number) => FadeInDown.duration(420).delay(delay);
const LIST_TRANSITION = SMOOTH_LAYOUT;

const COOLDOWN_OPTIONS: { id: LockCooldown; label: string }[] = [
  { id: '10m', label: '10 minutes' },
  { id: '1h', label: '1 hour' },
  { id: 'morning', label: 'Until morning' },
];

// ---------------------------------------------------------------------------
// Custom domains — each row can be raised to "never" (rose lock).
// ---------------------------------------------------------------------------

function CustomDomains({ requestPermission }: { requestPermission: (action: () => void) => void }) {
  const { purity } = useDayPlan();
  const [draft, setDraft] = useState('');
  const [confirmNever, setConfirmNever] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const canAdd = normalizeDomain(draft).includes('.');

  const submit = () => {
    if (!canAdd) return;
    const raw = draft;
    requestPermission(() => {
      addCustomDomain(raw);
      setDraft('');
    });
  };

  return (
    <Animated.View style={s.groupCard} layout={LIST_TRANSITION}>
      {purity.customDomains.map((entry, index) => (
        <Animated.View key={entry.domain} entering={SOFT_IN} exiting={SOFT_OUT} layout={LIST_TRANSITION}>
          {index > 0 && <View style={s.separator} />}
          <View style={[s.domainRow, entry.never && s.domainRowNever]}>
            <Globe s={14} c={entry.never ? '#B54155' : C.textMuted} w={2} />
            <Text style={[s.domainText, entry.never && s.domainTextNever]} numberOfLines={1}>
              {entry.domain}
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              haptic="selection"
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              onPress={() =>
                entry.never ? setDomainNever(entry.domain, false) : setConfirmNever(entry.domain)
              }
            >
              <View style={[s.domainLock, entry.never && s.domainLockOn]}>
                <Lock s={12} c={entry.never ? '#B54155' : C.textMuted} w={2.2} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
              onPress={() =>
                entry.never ? setConfirmRemove(entry.domain) : removeCustomDomain(entry.domain)
              }
            >
              <X s={15} c={C.textMuted} w={2.2} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      ))}

      {purity.customDomains.length > 0 && <View style={s.separator} />}
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

      <ConfirmModal
        visible={confirmNever !== null}
        icon={<Lock s={20} c="#B54155" w={2.2} />}
        iconBg="#FBE6E9"
        title="Close this door for good?"
        body="No practice opens a Never door. Undoing it later waits for the lock cooldown."
        subject={confirmNever ?? undefined}
        confirmLabel="CLOSE IT"
        confirmColor="#B54155"
        onCancel={() => setConfirmNever(null)}
        onConfirm={() => {
          if (confirmNever) setDomainNever(confirmNever, true);
          setConfirmNever(null);
        }}
      />
      <ConfirmModal
        visible={confirmRemove !== null}
        icon={<X s={20} c={C.red} w={2.4} />}
        title="Remove this door?"
        body="It is closed for good — removing it waits for the lock cooldown."
        subject={confirmRemove ?? undefined}
        confirmLabel="REMOVE"
        onCancel={() => setConfirmRemove(null)}
        onConfirm={() => {
          if (confirmRemove) removeCustomDomain(confirmRemove);
          setConfirmRemove(null);
        }}
      />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------

export default function PurityView() {
  const state = useDayPlan();
  const { purity, pendingChanges } = state;
  const { request, gate } = usePermissionGate();
  const [confirmNeverPack, setConfirmNeverPack] = useState<WebPackId | null>(null);
  const locks = purity.locks;

  const packMode = (packId: WebPackId) =>
    purity.packs.find(pack => pack.id === packId)?.mode ?? 'off';

  const pendingByLabel = useMemo(
    () =>
      pendingChanges.length > 0
        ? `takes effect ${formatEndsAt(Math.min(...pendingChanges.map(change => change.effectiveAt)))}`
        : undefined,
    [pendingChanges]
  );

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
          {pendingChanges.length > 0 && (
            <Animated.View entering={SOFT_IN} style={s.pendingCard}>
              <Hourglass s={15} c={C.goldDark} w={2} />
              <Text style={s.pendingText}>
                {`${pendingChanges.length} ${pendingChanges.length === 1 ? 'change waits' : 'changes wait'} for the cooldown — ${pendingByLabel}.`}
              </Text>
            </Animated.View>
          )}

          <Animated.View entering={enter(70)}>
            <Text style={s.sectionLabel}>PROTECTION PACKS</Text>
          </Animated.View>

          {WEB_PACKS.map((pack, index) => {
            const mode = packMode(pack.id);
            return (
              <Animated.View key={pack.id} entering={enter(100 + index * 55)}>
                <WebPackCard
                  packId={pack.id}
                  mode={mode}
                  pendingLabel={pendingByLabel}
                  onToggle={() =>
                    mode === 'off'
                      ? request(() => setPackMode(pack.id, 'on'))
                      : setPackMode(pack.id, 'off')
                  }
                  onSetNever={never =>
                    never ? setConfirmNeverPack(pack.id) : setPackMode(pack.id, 'on')
                  }
                />
              </Animated.View>
            );
          })}

          <Animated.View entering={enter(330)}>
            <Text style={s.sectionLabel}>CUSTOM WEBSITES</Text>
            <CustomDomains requestPermission={request} />
            <Text style={s.helperText}>
              The lock marks a door as Never Allowed — closed for good, no unlock practice.
            </Text>
          </Animated.View>

          {/* ---------------- LOCKS ---------------- */}
          <Animated.View entering={enter(390)}>
            <Text style={s.sectionLabel}>THE LOCKS</Text>
            <View style={s.groupCard}>
              <View style={s.lockRow}>
                <View style={s.lockIcon}>
                  <Shield s={15} c={C.goldDark} w={2.2} />
                </View>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={s.lockTitle}>Locks</Text>
                  <Text style={s.lockDesc}>
                    Weakening any rule here waits for the cooldown — no quiet undoing.
                  </Text>
                </View>
                <FocusSwitch
                  value={locks.enabled}
                  onToggle={() =>
                    locks.enabled
                      ? updateLocks({ enabled: false })
                      : request(() => updateLocks({ enabled: true }))
                  }
                />
              </View>

              <View style={s.separator} />
              <View style={[s.lockBody, !locks.enabled && s.lockBodyDimmed]}
                pointerEvents={locks.enabled ? 'auto' : 'none'}
              >
                <Text style={s.lockSubLabel}>COOLDOWN BEFORE CHANGES</Text>
                <View style={s.cooldownRow}>
                  {COOLDOWN_OPTIONS.map(option => {
                    const selected = locks.cooldown === option.id;
                    return (
                      <TouchableOpacity
                        key={option.id}
                        style={[s.cooldownChip, selected && s.cooldownChipOn]}
                        activeOpacity={0.8}
                        haptic="selection"
                        onPress={() => updateLocks({ cooldown: option.id })}
                      >
                        <Text style={[s.cooldownChipText, selected && s.cooldownChipTextOn]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={s.lockToggleRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={s.lockToggleTitle}>Uninstall protection</Text>
                    <Text style={s.lockDesc}>Anasta cannot be deleted while the locks stand.</Text>
                  </View>
                  <FocusSwitch
                    value={locks.uninstallProtection}
                    onToggle={() =>
                      updateLocks({ uninstallProtection: !locks.uninstallProtection })
                    }
                  />
                </View>

                <View style={s.lockToggleRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={s.lockToggleTitle}>Block new installs</Text>
                    <Text style={s.lockDesc}>No re-downloading the bookmaker in a weak hour.</Text>
                  </View>
                  <FocusSwitch
                    value={locks.denyNewApps}
                    onToggle={() => updateLocks({ denyNewApps: !locks.denyNewApps })}
                  />
                </View>
              </View>
            </View>
          </Animated.View>

          {/* ---------------- STRONG MODE (v2 teaser) ---------------- */}
          <Animated.View entering={enter(450)}>
            <View style={s.strongCard}>
              <View style={s.strongDecor} pointerEvents="none">
                <Shield s={86} c="#3D8273" w={1} />
              </View>
              <Text style={s.strongLabel}>COMING · STRONG MODE</Text>
              <Text style={s.strongTitle}>One door for the whole phone</Text>
              <Text style={s.strongBody}>
                System-deep filtering that also guards links and pages inside apps —
                built on the next foundation, after blocking goes live.
              </Text>
            </View>
          </Animated.View>

          <Animated.View entering={enter(500)}>
            <Text style={s.footnote}>
              One system filter covers the browsers on this phone. The pack lists are
              curated by us and keep growing — verified on device once the Screen Time
              permission arrives.
            </Text>
          </Animated.View>
        </View>
      </ScrollView>

      {gate}

      <ConfirmModal
        visible={confirmNeverPack !== null}
        icon={<Lock s={20} c="#B54155" w={2.2} />}
        iconBg="#FBE6E9"
        title="Close this door for good?"
        body="No practice opens a Never pack. Undoing it later waits for the lock cooldown."
        subject={WEB_PACKS.find(pack => pack.id === confirmNeverPack)?.name}
        confirmLabel="CLOSE IT"
        confirmColor="#B54155"
        onCancel={() => setConfirmNeverPack(null)}
        onConfirm={() => {
          if (confirmNeverPack) {
            const id = confirmNeverPack;
            request(() => setPackMode(id, 'never'));
          }
          setConfirmNeverPack(null);
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
  heroAnim: {
    alignItems: 'center',
    marginTop: 2,
    marginBottom: -6,
  },
  heroLottie: {
    width: 170,
    height: 120,
  },

  pendingCard: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0E3B8',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  pendingText: {
    flex: 1,
    fontFamily: F.sansMedium,
    fontSize: 11.5,
    lineHeight: 15.5,
    color: '#6D4F13',
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
  helperText: {
    marginTop: 9,
    marginHorizontal: 10,
    fontFamily: F.sans,
    fontSize: 11,
    lineHeight: 16,
    color: C.textMuted,
  },

  domainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  domainRowNever: {
    backgroundColor: '#FFFBFB',
  },
  domainText: {
    flex: 1,
    fontFamily: F.sansMedium,
    fontSize: 14,
    color: C.text,
  },
  domainTextNever: {
    color: '#B54155',
  },
  domainLock: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F4F3EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  domainLockOn: {
    backgroundColor: '#FBE6E9',
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

  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  lockIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.goldLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockTitle: {
    fontFamily: F.serifMedium,
    fontSize: 17,
    color: C.text,
  },
  lockDesc: {
    marginTop: 2,
    fontFamily: F.sans,
    fontSize: 11,
    lineHeight: 15,
    color: C.textSecondary,
  },
  lockBody: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  lockBodyDimmed: {
    opacity: 0.45,
  },
  lockSubLabel: {
    marginBottom: 8,
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 1.8,
    color: C.textMuted,
  },
  cooldownRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  cooldownChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  cooldownChipOn: {
    borderColor: C.gold,
    backgroundColor: C.goldBg,
  },
  cooldownChipText: {
    fontFamily: F.sansMedium,
    fontSize: 12,
    color: C.textSecondary,
  },
  cooldownChipTextOn: {
    fontFamily: F.sansSemiBold,
    color: C.goldDark,
  },
  lockToggleRow: {
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockToggleTitle: {
    fontFamily: F.sansSemiBold,
    fontSize: 13.5,
    color: C.text,
  },

  strongCard: {
    marginTop: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#C8E6DD',
    backgroundColor: '#EAF5F1',
    paddingHorizontal: 18,
    paddingVertical: 16,
    overflow: 'hidden',
  },
  strongDecor: {
    position: 'absolute',
    right: -6,
    bottom: -14,
    opacity: 0.12,
    transform: [{ rotate: '-8deg' }],
  },
  strongLabel: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: '#3D8273',
  },
  strongTitle: {
    marginTop: 7,
    fontFamily: F.serifMedium,
    fontSize: 21,
    letterSpacing: -0.2,
    color: '#1F4E45',
  },
  strongBody: {
    marginTop: 4,
    maxWidth: '86%',
    fontFamily: F.serif,
    fontSize: 14.5,
    lineHeight: 20,
    color: '#3D8273',
  },

  footnote: {
    marginTop: 16,
    paddingHorizontal: 22,
    fontFamily: F.sans,
    fontSize: 11,
    lineHeight: 16,
    color: C.textMuted,
    textAlign: 'center',
  },
});
