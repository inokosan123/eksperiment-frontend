import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { ChevronRight, Globe, Hourglass, Lock, Plus, Shield, Trash2, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import FocusSwitch from './FocusSwitch';
import GoldButton from './GoldButton';
import { WEB_PACKS } from './focusContent';
import { resolveWebProtectionDomains, WEB_DOMAIN_LIMIT } from './webProtectionCatalog';
import { usePermissionGate } from './usePermissionGate';
import {
  addCustomDomain,
  addDomainToCustomWebPack,
  cancelPendingChange,
  createCustomWebPack,
  formatEndsAt,
  normalizeDomain,
  removeCustomDomain,
  removeDomainFromCustomWebPack,
  removeCustomWebPack,
  setCustomWebPackMode,
  setDomainNever,
  setPackMode,
  updateLocks,
  useDayPlan,
  type CustomWebPack,
  type LockCooldown,
  type PackMode,
  type WebPackId,
} from './dayPlanStore';

const enter = (delay: number) => FadeInDown.duration(420).delay(delay);
const COOLDOWNS: { id: LockCooldown; label: string }[] = [
  { id: '10m', label: '10 min' },
  { id: '1h', label: '1 hour' },
  { id: 'morning', label: 'Until morning' },
];

function ModeTag({ mode }: { mode: PackMode }) {
  return (
    <View style={[s.modeTag, mode === 'on' && s.modeTagOn, mode === 'never' && s.modeTagNever]}>
      {mode === 'never' && <Lock s={9} c="#A24351" w={2.2} />}
      <Text style={[s.modeTagText, mode === 'on' && s.modeTagTextOn, mode === 'never' && s.modeTagTextNever]}>
        {mode === 'off' ? 'OFF' : mode === 'on' ? 'ON' : 'NEVER'}
      </Text>
    </View>
  );
}

function PackRow({
  name,
  detail,
  domains,
  mode,
  onToggle,
  onNever,
  onAddDomain,
  onRemoveDomain,
  onRemove,
}: {
  name: string;
  detail: string;
  domains: string[];
  mode: PackMode;
  onToggle: () => void;
  onNever: () => void;
  onAddDomain?: (domain: string) => void;
  onRemoveDomain?: (domain: string) => void;
  onRemove?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState('');
  const enabled = mode !== 'off';
  const submit = () => {
    if (!onAddDomain || !normalizeDomain(draft).includes('.')) return;
    onAddDomain(draft);
    setDraft('');
  };

  return (
    <Animated.View layout={LinearTransition.duration(200)}>
      <View style={s.packRow}>
        <TouchableOpacity style={s.packMain} onPress={() => setExpanded(current => !current)} activeOpacity={0.72}>
          <View style={[s.packIcon, enabled && s.packIconOn, mode === 'never' && s.packIconNever]}>
            {mode === 'never' ? <Lock s={15} c="#A24351" w={2.2} /> : <Globe s={16} c={enabled ? '#2D7967' : C.textMuted} w={2} />}
          </View>
          <View style={{ flex: 1 }}>
            <View style={s.packTitleRow}><Text style={s.packName}>{name}</Text><ModeTag mode={mode} /></View>
            <Text style={s.packDetail}>{enabled ? `${domains.length} domains in this pack` : detail}</Text>
          </View>
          <View style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}><ChevronRight s={15} c={C.textMuted} w={2} /></View>
        </TouchableOpacity>
        <FocusSwitch value={enabled} onToggle={mode === 'never' ? onNever : onToggle} />
      </View>

      {expanded && (
        <Animated.View entering={FadeIn.duration(180)} style={s.packBody}>
          <View style={s.domainChips}>
            {domains.slice(0, 10).map(domain => onRemoveDomain && domains.length > 1 ? (
              <TouchableOpacity
                key={domain}
                style={s.domainChip}
                onPress={() => onRemoveDomain(domain)}
                accessibilityLabel={`Remove ${domain} from this pack`}
              >
                <Text style={s.domainChipText}>{domain}</Text>
                <X s={9} c={C.textMuted} w={2.1} />
              </TouchableOpacity>
            ) : (
              <View key={domain} style={s.domainChip}><Text style={s.domainChipText}>{domain}</Text></View>
            ))}
            {domains.length > 10 && <Text style={s.moreDomains}>+{domains.length - 10} more</Text>}
          </View>
          {onAddDomain && (
            <View style={s.inlineInputRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={submit}
                placeholder="Add a domain"
                placeholderTextColor={C.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={s.inlineInput}
              />
              <TouchableOpacity style={[s.inlineAdd, !normalizeDomain(draft).includes('.') && s.disabled]} onPress={submit} disabled={!normalizeDomain(draft).includes('.')}>
                <Plus s={13} c="#fff" w={2.5} />
              </TouchableOpacity>
            </View>
          )}
          <View style={s.packActions}>
            <TouchableOpacity style={[s.neverButton, mode === 'never' && s.neverButtonOn]} onPress={onNever}>
              <Lock s={11} c="#A24351" w={2.2} />
              <Text style={s.neverButtonText}>{mode === 'never' ? 'Request unlock' : 'Make Never Allowed'}</Text>
            </TouchableOpacity>
            {onRemove && (
              <TouchableOpacity style={s.removeButton} onPress={onRemove}><Trash2 s={12} c={C.textMuted} w={2} /><Text style={s.removeButtonText}>Remove pack</Text></TouchableOpacity>
            )}
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

function NewPackSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [domainDraft, setDomainDraft] = useState('');
  const [domains, setDomains] = useState<string[]>([]);
  const add = () => {
    const domain = normalizeDomain(domainDraft);
    if (!domain.includes('.') || domains.includes(domain)) return;
    setDomains(current => [...current, domain]);
    setDomainDraft('');
  };
  const close = () => { setName(''); setDomainDraft(''); setDomains([]); onClose(); };
  const save = () => { if (createCustomWebPack(name, domains)) close(); };

  return (
    <SmoothBottomSheet visible={visible} onClose={close} sheetStyle={s.newPackSheet} keyboardAware>
      <View style={s.handle} />
      <View style={s.sheetHeader}>
        <View style={{ flex: 1 }}><Text style={s.sheetKicker}>YOUR OWN BOUNDARY</Text><Text style={s.sheetTitle}>New Protection Pack</Text></View>
        <TouchableOpacity style={s.closeBtn} onPress={close}><X s={17} c={C.textMuted} w={2.2} /></TouchableOpacity>
      </View>
      <View style={s.packNameInput}><TextInput value={name} onChangeText={setName} placeholder="Name the pack" placeholderTextColor={C.textMuted} style={s.nameInput} maxLength={30} /></View>
      <View style={s.domainEntry}>
        <TextInput value={domainDraft} onChangeText={setDomainDraft} onSubmitEditing={add} placeholder="example.com" placeholderTextColor={C.textMuted} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={s.domainEntryInput} />
        <TouchableOpacity style={[s.inlineAdd, !normalizeDomain(domainDraft).includes('.') && s.disabled]} onPress={add} disabled={!normalizeDomain(domainDraft).includes('.')}><Plus s={13} c="#fff" w={2.5} /></TouchableOpacity>
      </View>
      <View style={s.newDomains}>
        {domains.map(domain => (
          <TouchableOpacity key={domain} style={s.newDomainChip} onPress={() => setDomains(current => current.filter(item => item !== domain))}>
            <Text style={s.newDomainText}>{domain}</Text><X s={10} c={C.textMuted} w={2} />
          </TouchableOpacity>
        ))}
      </View>
      <GoldButton label="Create and turn on" disabled={!name.trim() || domains.length === 0} onPress={save} style={{ marginTop: 16 }} />
    </SmoothBottomSheet>
  );
}

function pendingWhen(effectiveAt: number) {
  const target = new Date(effectiveAt);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
  const day = sameDay(target, today) ? 'Today' : sameDay(target, tomorrow) ? 'Tomorrow' : target.toLocaleDateString();
  return `${day} at ${formatEndsAt(effectiveAt)}`;
}

export default function PurityView() {
  const state = useDayPlan();
  const { purity, pendingChanges } = state;
  const { request, gate } = usePermissionGate();
  const [newPackOpen, setNewPackOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [draftDomain, setDraftDomain] = useState('');
  const [confirmNeverPack, setConfirmNeverPack] = useState<WebPackId | null>(null);
  const [confirmRemovePack, setConfirmRemovePack] = useState<CustomWebPack | null>(null);
  const activePacks = purity.packs.filter(pack => pack.mode !== 'off').length + purity.customPacks.filter(pack => pack.mode !== 'off').length;
  const configured = activePacks + purity.customDomains.length > 0;
  const enforced = configured
    && state.permission === 'approved'
    && state.nativeProtection.status === 'applied';
  const previewReady = configured && state.permission === 'preview';
  const webResolution = useMemo(() => resolveWebProtectionDomains(purity), [purity]);
  const pendingAt = useMemo(
    () => pendingChanges.length ? formatEndsAt(Math.min(...pendingChanges.map(change => change.effectiveAt))) : null,
    [pendingChanges]
  );
  const packMode = (id: WebPackId) => purity.packs.find(pack => pack.id === id)?.mode ?? 'off';

  const addOneDomain = () => {
    if (!normalizeDomain(draftDomain).includes('.')) return;
    request(() => { addCustomDomain(draftDomain); setDraftDomain(''); });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <ScreenTitleBar title="CLEAN SIGHT" showBack />
        <Animated.View entering={enter(0)} style={s.introWrap}>
          <Text style={s.intro}>Keep the web useful without leaving every door open.</Text>
        </Animated.View>

        <Animated.View entering={enter(40)} style={[s.statusBand, (enforced || previewReady) && s.statusBandOn]}>
          <View style={[s.statusIcon, (enforced || previewReady) && s.statusIconOn]}><Shield s={24} c={enforced || previewReady ? '#2D7967' : C.textMuted} w={1.8} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.statusKicker}>WEB PROTECTION</Text>
            <Text style={s.statusTitle}>
              {enforced
                ? 'Clean Sight is active.'
                : previewReady
                  ? 'Clean Sight preview is ready.'
                  : configured
                    ? 'Protection is saved, not active.'
                    : 'No web protection is active.'}
            </Text>
            <Text style={s.statusMeta}>
              {configured
                ? `${activePacks} active packs / ${purity.customDomains.length} individual domains`
                : 'Turn on a pack or add a domain below.'}
            </Text>
          </View>
          <View style={[s.liveBadge, (enforced || previewReady) && s.liveBadgeOn]}>
            <View style={[s.liveDot, (enforced || previewReady) && s.liveDotOn]} />
            <Text style={[s.liveText, (enforced || previewReady) && s.liveTextOn]}>
              {enforced ? 'ON' : previewReady ? 'PREVIEW' : configured ? 'SAVED' : 'OFF'}
            </Text>
          </View>
        </Animated.View>

        {state.permission !== 'approved' && configured && (
          <Animated.View entering={FadeIn.duration(200)} style={s.permissionBand}>
            <Lock s={14} c="#A36F2B" w={2.2} />
            <Text style={s.permissionText}>
              {state.permission === 'preview'
                ? 'Preview mode shows the complete flow. Real browser protection requires the Anasta development build.'
                : 'These choices are saved, but Screen Time access is needed before supported browser protection can apply.'}
            </Text>
            {state.permission !== 'preview' && <TouchableOpacity onPress={() => request(() => {})}><Text style={s.permissionAction}>Enable</Text></TouchableOpacity>}
          </Animated.View>
        )}

        {configured && (
          <View style={[s.capacityBand, webResolution.omittedDomains.length > 0 && s.capacityBandWarning]}>
            <Globe s={14} c={webResolution.omittedDomains.length > 0 ? '#A36F2B' : '#2D7967'} w={2} />
            <View style={{ flex: 1 }}>
              <Text style={s.capacityTitle}>
                {webResolution.domains.length} of {WEB_DOMAIN_LIMIT} explicit domain slots
              </Text>
              <Text style={s.capacityBody}>
                {webResolution.omittedDomains.length > 0
                  ? `${webResolution.omittedDomains.length} lower-priority pack domains do not fit. Your individual domains remain first.`
                  : webResolution.adultFilterActive
                    ? "Apple's automatic adult filter also remains active beyond this list."
                    : 'Individual domains are kept ahead of broad starter packs.'}
              </Text>
            </View>
          </View>
        )}

        {pendingChanges.length > 0 && (
          <TouchableOpacity style={s.pendingBand} onPress={() => setPendingOpen(true)} activeOpacity={0.72}>
            <Hourglass s={14} c={C.goldDark} w={2} />
            <Text style={s.pendingText}>{pendingChanges.length} weakening {pendingChanges.length === 1 ? 'change is' : 'changes are'} eligible {pendingAt}. Anasta applies {pendingChanges.length === 1 ? 'it' : 'them'} while active.</Text>
            <ChevronRight s={14} c={C.goldDark} w={2} />
          </TouchableOpacity>
        )}

        <Animated.View entering={enter(90)}>
          <View style={s.sectionHeader}><Text style={s.sectionLabel}>PROTECTION PACKS</Text><Text style={s.sectionMeta}>{WEB_PACKS.length + purity.customPacks.length} total</Text></View>
          <View style={s.packList}>
            {WEB_PACKS.map((pack, index) => {
              const mode = packMode(pack.id);
              return (
                <View key={pack.id}>
                  {index > 0 && <View style={s.separator} />}
                  <PackRow
                    name={pack.name}
                    detail={pack.detail}
                    domains={pack.sites}
                    mode={mode}
                    onToggle={() => request(() => setPackMode(pack.id, mode === 'off' ? 'on' : 'off'))}
                    onNever={() => mode === 'never' ? setPackMode(pack.id, 'off') : setConfirmNeverPack(pack.id)}
                  />
                </View>
              );
            })}
            {purity.customPacks.map(pack => (
              <View key={pack.id}>
                <View style={s.separator} />
                <PackRow
                  name={pack.name}
                  detail="Your custom domain collection"
                  domains={pack.domains}
                  mode={pack.mode}
                  onToggle={() => request(() => setCustomWebPackMode(pack.id, pack.mode === 'off' ? 'on' : 'off'))}
                  onNever={() => setCustomWebPackMode(pack.id, pack.mode === 'never' ? 'off' : 'never')}
                  onAddDomain={domain => addDomainToCustomWebPack(pack.id, domain)}
                  onRemoveDomain={domain => removeDomainFromCustomWebPack(pack.id, domain)}
                  onRemove={() => setConfirmRemovePack(pack)}
                />
              </View>
            ))}
          </View>
          <TouchableOpacity style={s.newPackButton} onPress={() => setNewPackOpen(true)}><View style={s.plusIcon}><Plus s={13} c={C.goldDark} w={2.5} /></View><Text style={s.newPackText}>Create a custom pack</Text></TouchableOpacity>
        </Animated.View>

        <Animated.View entering={enter(150)}>
          <Text style={s.sectionLabel}>INDIVIDUAL DOMAINS</Text>
          <View style={s.individualList}>
            {purity.customDomains.map((entry, index) => (
              <View key={entry.domain}>
                {index > 0 && <View style={s.separator} />}
                <View style={s.individualRow}>
                  <Globe s={14} c={entry.never ? '#A24351' : '#2D7967'} w={2} />
                  <Text style={s.individualDomain} numberOfLines={1}>{entry.domain}</Text>
                  <TouchableOpacity style={[s.smallLock, entry.never && s.smallLockOn]} onPress={() => setDomainNever(entry.domain, !entry.never)}><Lock s={11} c={entry.never ? '#A24351' : C.textMuted} w={2.2} /></TouchableOpacity>
                  <TouchableOpacity onPress={() => removeCustomDomain(entry.domain)} hitSlop={8}><X s={14} c={C.textMuted} w={2.2} /></TouchableOpacity>
                </View>
              </View>
            ))}
            {purity.customDomains.length > 0 && <View style={s.separator} />}
            <View style={s.domainInputRow}>
              <TextInput value={draftDomain} onChangeText={setDraftDomain} onSubmitEditing={addOneDomain} placeholder="Add a domain, e.g. example.com" placeholderTextColor={C.textMuted} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={s.domainInput} />
              <TouchableOpacity style={[s.inlineAdd, !normalizeDomain(draftDomain).includes('.') && s.disabled]} onPress={addOneDomain} disabled={!normalizeDomain(draftDomain).includes('.')}><Plus s={13} c="#fff" w={2.5} /></TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={enter(210)}>
          <Text style={s.sectionLabel}>STRICT WATCH</Text>
          <View style={s.lockPanel}>
            <View style={s.lockHeader}>
              <View style={s.lockIcon}><Lock s={15} c={C.goldDark} w={2.2} /></View>
              <View style={{ flex: 1 }}><Text style={s.lockTitle}>Delay weaker changes</Text><Text style={s.lockBody}>Turning protection off waits, while stronger changes apply immediately.</Text></View>
              <FocusSwitch value={purity.locks.enabled} onToggle={() => updateLocks({ enabled: !purity.locks.enabled })} />
            </View>
            <View style={[s.lockSettings, !purity.locks.enabled && s.lockSettingsDisabled]} pointerEvents={purity.locks.enabled ? 'auto' : 'none'}>
              <Text style={s.lockSettingLabel}>COOLDOWN</Text>
              <View style={s.cooldownRow}>{COOLDOWNS.map(option => <TouchableOpacity key={option.id} style={[s.cooldownChip, purity.locks.cooldown === option.id && s.cooldownChipOn]} onPress={() => updateLocks({ cooldown: option.id })} haptic="selection"><Text style={[s.cooldownText, purity.locks.cooldown === option.id && s.cooldownTextOn]}>{option.label}</Text></TouchableOpacity>)}</View>
              <View style={s.lockToggleRow}><View style={{ flex: 1 }}><Text style={s.lockToggleTitle}>Uninstall protection</Text><Text style={s.lockToggleBody}>Keep protection harder to remove in a weak moment.</Text></View><FocusSwitch value={purity.locks.uninstallProtection} onToggle={() => updateLocks({ uninstallProtection: !purity.locks.uninstallProtection })} /></View>
              <View style={s.lockToggleRow}><View style={{ flex: 1 }}><Text style={s.lockToggleTitle}>Block new installs</Text><Text style={s.lockToggleBody}>Prevent replacing a blocked site with its app.</Text></View><FocusSwitch value={purity.locks.denyNewApps} onToggle={() => updateLocks({ denyNewApps: !purity.locks.denyNewApps })} /></View>
            </View>
          </View>
        </Animated.View>

        <Text style={s.footnote}>Clean Sight remains independent from Screen Time plans. An Essential browser never bypasses an active blocked domain in supported browsers.</Text>
      </ScrollView>

      <NewPackSheet visible={newPackOpen} onClose={() => setNewPackOpen(false)} />
      <SmoothBottomSheet
        visible={pendingOpen && pendingChanges.length > 0}
        onClose={() => setPendingOpen(false)}
        sheetStyle={s.pendingSheet}
      >
        <View style={s.handle} />
        <View style={s.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.sheetKicker}>STRICT WATCH</Text>
            <Text style={s.sheetTitle}>Pending Changes</Text>
          </View>
          <TouchableOpacity style={s.closeBtn} onPress={() => setPendingOpen(false)}>
            <X s={17} c={C.textMuted} w={2.2} />
          </TouchableOpacity>
        </View>
        <Text style={s.pendingSheetIntro}>
          Your stronger protection stays in place through the cooldown. Due changes apply while Anasta is active or on the next open. Canceling keeps the stronger rule.
        </Text>
        <View style={s.pendingList}>
          {pendingChanges.map(change => (
            <View key={change.id} style={s.pendingRow}>
              <View style={s.pendingRowIcon}><Hourglass s={14} c={C.goldDark} w={2} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.pendingRowTitle}>{change.label}</Text>
                <Text style={s.pendingRowTime}>Eligible {pendingWhen(change.effectiveAt)}</Text>
              </View>
              <TouchableOpacity
                style={s.cancelPendingButton}
                onPress={() => {
                  if (pendingChanges.length === 1) setPendingOpen(false);
                  cancelPendingChange(change.id);
                }}
              >
                <Text style={s.cancelPendingText}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </SmoothBottomSheet>
      {gate}
      <ConfirmModal
        visible={confirmNeverPack !== null}
        icon={<Lock s={21} c="#A24351" w={2.2} />}
        iconBg="#F8E7EA"
        title="Make this pack Never Allowed?"
        body="It stays active without an ordinary unlock. A later weakening change must wait for Strict Watch when enabled."
        subject={WEB_PACKS.find(pack => pack.id === confirmNeverPack)?.name}
        confirmLabel="MAKE NEVER"
        confirmColor="#A24351"
        onCancel={() => setConfirmNeverPack(null)}
        onConfirm={() => { if (confirmNeverPack) request(() => setPackMode(confirmNeverPack, 'never')); setConfirmNeverPack(null); }}
      />
      <ConfirmModal
        visible={confirmRemovePack !== null}
        icon={<Trash2 s={21} c="#A24351" w={2.1} />}
        iconBg="#F8E7EA"
        title="Remove this custom pack?"
        body="Its domains leave this pack. Any same domain protected elsewhere remains blocked."
        subject={confirmRemovePack?.name}
        confirmLabel="REMOVE PACK"
        confirmColor="#A24351"
        onCancel={() => setConfirmRemovePack(null)}
        onConfirm={() => { if (confirmRemovePack) removeCustomWebPack(confirmRemovePack.id); setConfirmRemovePack(null); }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingBottom: 90, gap: 18 },
  introWrap: { paddingHorizontal: 28, alignItems: 'center' },
  intro: { fontFamily: F.serifMediumItalic, fontSize: 16, lineHeight: 21, color: C.textSecondary, textAlign: 'center' },
  statusBand: { minHeight: 96, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, padding: 14 },
  statusBandOn: { borderColor: '#CDE4DB', backgroundColor: '#F4FAF7' },
  statusIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#F0EFEB', alignItems: 'center', justifyContent: 'center' },
  statusIconOn: { backgroundColor: '#DDEFE8' },
  statusKicker: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.5, color: '#2D7967' },
  statusTitle: { marginTop: 2, fontFamily: F.serifMedium, fontSize: 19, color: C.text },
  statusMeta: { marginTop: 2, fontFamily: F.sans, fontSize: 8.8, color: C.textSecondary },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, backgroundColor: '#EEEDE9', paddingHorizontal: 7, paddingVertical: 5 },
  liveBadgeOn: { backgroundColor: '#D8ECE4' },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.textMuted },
  liveDotOn: { backgroundColor: '#2D7967' },
  liveText: { fontFamily: F.sansBold, fontSize: 7.5, letterSpacing: 0.8, color: C.textMuted },
  liveTextOn: { color: '#2D7967' },
  permissionBand: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, backgroundColor: '#FFF1D5', paddingHorizontal: 11, paddingVertical: 9 },
  permissionText: { flex: 1, fontFamily: F.sansMedium, fontSize: 8.7, lineHeight: 12.5, color: '#8D5C1E' },
  permissionAction: { fontFamily: F.sansBold, fontSize: 8.5, color: '#8D5C1E' },
  pendingBand: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, backgroundColor: '#FFF8E8', paddingHorizontal: 11, paddingVertical: 9 },
  pendingText: { flex: 1, fontFamily: F.sansMedium, fontSize: 9, color: C.goldDark },
  capacityBand: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 13, borderCurve: 'continuous', borderWidth: 1, borderColor: '#CDE4DB', backgroundColor: '#F4FAF7', paddingHorizontal: 11, paddingVertical: 9 },
  capacityBandWarning: { borderColor: '#E8D4AB', backgroundColor: '#FFF8E8' },
  capacityTitle: { fontFamily: F.sansSemiBold, fontSize: 9.5, color: C.text },
  capacityBody: { marginTop: 2, fontFamily: F.sans, fontSize: 8.5, lineHeight: 12.5, color: C.textSecondary },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 8 },
  sectionLabel: { marginBottom: 8, marginLeft: 4, fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 2.2, color: C.textMuted },
  sectionMeta: { fontFamily: F.sansMedium, fontSize: 8.5, color: C.textMuted },
  packList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: 45 },
  packRow: { minHeight: 63, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  packMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  packIcon: { width: 35, height: 35, borderRadius: 12, backgroundColor: '#F0EFEB', alignItems: 'center', justifyContent: 'center' },
  packIconOn: { backgroundColor: '#DDEFE8' },
  packIconNever: { backgroundColor: '#F8E7EA' },
  packTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  packName: { flexShrink: 1, fontFamily: F.sansSemiBold, fontSize: 11.5, color: C.text },
  packDetail: { marginTop: 2, fontFamily: F.sans, fontSize: 8.5, color: C.textMuted },
  modeTag: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, backgroundColor: '#F0EFEB', paddingHorizontal: 6, paddingVertical: 4 },
  modeTagOn: { backgroundColor: '#DDEFE8' },
  modeTagNever: { backgroundColor: '#F8E7EA' },
  modeTagText: { fontFamily: F.sansBold, fontSize: 6.5, letterSpacing: 0.7, color: C.textMuted },
  modeTagTextOn: { color: '#2D7967' },
  modeTagTextNever: { color: '#A24351' },
  packBody: { marginLeft: 45, paddingBottom: 12, gap: 9 },
  domainChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  domainChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, backgroundColor: '#F0EFEB', paddingHorizontal: 8, paddingVertical: 5 },
  domainChipText: { fontFamily: F.sansMedium, fontSize: 8, color: C.textSecondary },
  moreDomains: { alignSelf: 'center', fontFamily: F.sansMedium, fontSize: 8, color: C.textMuted },
  inlineInputRow: { height: 39, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, paddingLeft: 10, paddingRight: 4 },
  inlineInput: { flex: 1, fontFamily: F.sansMedium, fontSize: 10.5, color: C.text },
  inlineAdd: { width: 30, height: 30, borderRadius: 10, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
  packActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  neverButton: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 11, backgroundColor: '#F8E7EA', paddingHorizontal: 9 },
  neverButtonOn: { backgroundColor: '#FFF1F3' },
  neverButtonText: { fontFamily: F.sansSemiBold, fontSize: 8.5, color: '#A24351' },
  removeButton: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 11, backgroundColor: '#F0EFEB', paddingHorizontal: 9 },
  removeButtonText: { fontFamily: F.sansSemiBold, fontSize: 8.5, color: C.textSecondary },
  newPackButton: { marginTop: 9, height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#BFDCCF', backgroundColor: '#F4FAF7' },
  plusIcon: { width: 24, height: 24, borderRadius: 8, backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
  newPackText: { fontFamily: F.sansSemiBold, fontSize: 10.5, color: '#2D7967' },
  individualList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  individualRow: { minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 3 },
  individualDomain: { flex: 1, fontFamily: F.sansMedium, fontSize: 11, color: C.text },
  smallLock: { width: 27, height: 27, borderRadius: 9, backgroundColor: '#F0EFEB', alignItems: 'center', justifyContent: 'center' },
  smallLockOn: { backgroundColor: '#F8E7EA' },
  domainInputRow: { minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 3 },
  domainInput: { flex: 1, fontFamily: F.sansMedium, fontSize: 10.5, color: C.text },
  lockPanel: { borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E6DCC6', backgroundColor: '#FFFDF8', overflow: 'hidden' },
  lockHeader: { minHeight: 67, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13 },
  lockIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
  lockTitle: { fontFamily: F.sansSemiBold, fontSize: 11.5, color: C.text },
  lockBody: { marginTop: 2, fontFamily: F.sans, fontSize: 8.5, lineHeight: 12, color: C.textSecondary },
  lockSettings: { borderTopWidth: 1, borderTopColor: '#EEE5D3', padding: 13, gap: 10 },
  lockSettingsDisabled: { opacity: 0.38 },
  lockSettingLabel: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.5, color: C.textMuted },
  cooldownRow: { flexDirection: 'row', gap: 6 },
  cooldownChip: { borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, paddingHorizontal: 10, paddingVertical: 7 },
  cooldownChipOn: { borderColor: C.gold, backgroundColor: C.goldLight },
  cooldownText: { fontFamily: F.sansMedium, fontSize: 9, color: C.textSecondary },
  cooldownTextOn: { fontFamily: F.sansSemiBold, color: C.goldDark },
  lockToggleRow: { minHeight: 51, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  lockToggleTitle: { fontFamily: F.sansSemiBold, fontSize: 10.5, color: C.text },
  lockToggleBody: { marginTop: 2, fontFamily: F.sans, fontSize: 8.3, color: C.textSecondary },
  footnote: { paddingHorizontal: 24, fontFamily: F.sans, fontSize: 9, lineHeight: 14, color: C.textMuted, textAlign: 'center' },
  newPackSheet: { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 28 },
  pendingSheet: { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 30 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E0DA', marginTop: 10 },
  sheetHeader: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetKicker: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: '#2D7967' },
  sheetTitle: { marginTop: 3, fontFamily: F.serifMedium, fontSize: 25, color: C.text },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0EFEA', alignItems: 'center', justifyContent: 'center' },
  packNameInput: { marginTop: 14, height: 47, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, justifyContent: 'center', paddingHorizontal: 12 },
  nameInput: { fontFamily: F.serifMedium, fontSize: 16, color: C.text },
  domainEntry: { marginTop: 9, height: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, paddingLeft: 12, paddingRight: 5 },
  domainEntryInput: { flex: 1, fontFamily: F.sansMedium, fontSize: 11, color: C.text },
  newDomains: { marginTop: 9, flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  newDomainChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, backgroundColor: '#E5F1EC', paddingHorizontal: 8, paddingVertical: 6 },
  newDomainText: { fontFamily: F.sansMedium, fontSize: 8.5, color: '#2D7967' },
  pendingSheetIntro: { marginTop: 10, fontFamily: F.sans, fontSize: 10.5, lineHeight: 15.5, color: C.textSecondary },
  pendingList: { marginTop: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  pendingRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  pendingRowIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
  pendingRowTitle: { fontFamily: F.sansSemiBold, fontSize: 10.5, color: C.text },
  pendingRowTime: { marginTop: 3, fontFamily: F.sansMedium, fontSize: 8.5, color: C.textMuted },
  cancelPendingButton: { minHeight: 32, justifyContent: 'center', borderRadius: 10, backgroundColor: '#F0EFEB', paddingHorizontal: 10 },
  cancelPendingText: { fontFamily: F.sansBold, fontSize: 7.5, letterSpacing: 0.8, color: C.textSecondary },
});
