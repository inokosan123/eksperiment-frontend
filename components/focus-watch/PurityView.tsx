import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line } from 'react-native-svg';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { NotoEmoji } from '@/components/shared/NotoEmoji';
import { ChevronRight, Globe, Hourglass, Lock, Plus, Shield, Trash2, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import FocusSwitch from './FocusSwitch';
import GoldButton from './GoldButton';
import FocusSheetHeader from './FocusSheetHeader';
import PackDomainsSheet from './PackDomainsSheet';
import { CUSTOM_PACK_EMOJI, WEB_PACKS } from './focusContent';
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

// The tab-wide hairline weave, in the card's state color — the texture that
// marks a surface as alive in this app.
function CardWeave({ color }: { color: string }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const step = 30;
  const lineCount = box.w > 0 ? Math.ceil((box.w + box.h) / step) + 1 : 0;
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        setBox({ w: width, h: height });
      }}
    >
      {lineCount > 0 && (
        <Svg width={box.w} height={box.h} style={StyleSheet.absoluteFill}>
          {Array.from({ length: lineCount }).map((_, index) => {
            const offset = index * step;
            return (
              <Line
                key={index}
                x1={offset}
                y1={-4}
                x2={offset - box.h - 8}
                y2={box.h + 4}
                stroke={color}
                strokeOpacity={0.05}
                strokeWidth={1}
              />
            );
          })}
        </Svg>
      )}
    </View>
  );
}

// A pack's face: its Noto emoji in a soft tinted chip. `slashed` draws the
// red "not allowed" line across (sensitive content), with a white underlay so
// the line stays readable over the artwork.
function PackEmoji({ emoji, slashed, size = 26 }: { emoji: string; slashed?: boolean; size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <NotoEmoji name={emoji} size={size} />
      {slashed && (
        <>
          <View pointerEvents="none" style={[s.emojiSlashUnder, { width: size * 1.12 }]} />
          <View pointerEvents="none" style={[s.emojiSlash, { width: size * 1.12 }]} />
        </>
      )}
    </View>
  );
}

function PackRow({
  name,
  detail,
  domains,
  mode,
  emoji,
  slashed,
  appleFilter,
  onToggle,
  onNever,
  onSeeAll,
  onRemove,
}: {
  name: string;
  detail: string;
  domains: string[];
  mode: PackMode;
  emoji: string;
  slashed?: boolean;
  appleFilter?: boolean;
  onToggle: () => void;
  onNever: () => void;
  onSeeAll: () => void;
  onRemove?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const enabled = mode !== 'off';
  const never = mode === 'never';

  return (
    <Animated.View
      layout={LinearTransition.duration(200)}
      style={[s.packCard, enabled && s.packCardOn, never && s.packCardNever]}
    >
      {enabled && (
        <LinearGradient
          colors={never ? ['#FBECEF', '#FFFAFB', '#FFFDFD'] : ['#E6F3EC', '#F9FCFA', '#FEFFFE']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {enabled && <CardWeave color={never ? '#A24351' : '#2D7967'} />}
      <View style={s.packRow}>
        <TouchableOpacity style={s.packMain} onPress={() => setExpanded(current => !current)} activeOpacity={0.72}>
          <View style={s.packIcon}>
            <PackEmoji emoji={emoji} slashed={slashed} size={27} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={s.packTitleRow}>
              <Text style={s.packName} numberOfLines={1}>{name}</Text>
              {appleFilter && enabled && !never && (
                <Animated.View entering={FadeIn.duration(180)} layout={LinearTransition.duration(180)} style={s.appleFilterTag}>
                  <View style={s.appleFilterTagIcon}>
                    <Shield s={9} c="#566276" w={2.1} />
                  </View>
                  <Text style={s.appleFilterTagText}>APPLE FILTER</Text>
                </Animated.View>
              )}
            </View>
            <View style={s.packStatusRow}>
              <View style={[
                s.packStatusDot,
                { backgroundColor: never ? '#A24351' : enabled ? '#2D7967' : '#CFC9BB' },
              ]} />
              <Text
                style={[s.packDetail, enabled && s.packDetailOn, never && s.packDetailNever]}
                numberOfLines={1}
              >
                {never
                  ? `Never allowed · ${domains.length} domains stay locked`
                  : enabled
                    ? `${domains.length} domains blocked`
                    : detail}
              </Text>
            </View>
          </View>
          <View style={[s.packChevron, expanded && s.packChevronOpen]}><ChevronRight s={16} c={C.textMuted} w={2} /></View>
        </TouchableOpacity>
        {never ? (
          <TouchableOpacity
            style={s.neverSeal}
            onPress={onNever}
            haptic="selection"
            accessibilityRole="button"
            accessibilityLabel="Never allowed. Request unlock."
          >
            <Lock s={15} c="#FFFFFF" w={2.3} />
          </TouchableOpacity>
        ) : (
          <FocusSwitch value={enabled} onToggle={onToggle} activeColor="#2D7967" />
        )}
      </View>

      {expanded && (
        <Animated.View entering={FadeIn.duration(180)} style={s.packBody}>
          <Text style={s.domainListLabel}>BLOCKED DOMAINS</Text>
          <View style={s.domainChips}>
            {domains.slice(0, 6).map(domain => (
              <View key={domain} style={s.domainChip}><Text style={s.domainChipText}>{domain}</Text></View>
            ))}
          </View>
          <TouchableOpacity style={s.seeAllButton} onPress={onSeeAll} activeOpacity={0.74}>
            <Globe s={14} c="#2D7967" w={2.1} />
            <Text style={s.seeAllText}>
              {domains.length > 6 ? `See all ${domains.length} domains` : 'Open the domain list'}
            </Text>
            <ChevronRight s={14} c="#2D7967" w={2.2} />
          </TouchableOpacity>
          <View style={s.packActions}>
            <TouchableOpacity
              style={[s.neverButton, mode === 'never' && s.neverButtonOn]}
              onPress={onNever}
              activeOpacity={0.78}
            >
              <View style={[s.neverButtonSeal, mode === 'never' && s.neverButtonSealOn]}>
                <Lock s={13} c={mode === 'never' ? '#FFFFFF' : '#A24351'} w={2.2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.neverButtonText}>{mode === 'never' ? 'Request unlock' : 'Never allow'}</Text>
                <Text style={s.neverButtonSub} numberOfLines={1}>
                  {mode === 'never' ? 'Strict Watch decides when' : 'Locked even from yourself'}
                </Text>
              </View>
            </TouchableOpacity>
            {onRemove && (
              <TouchableOpacity style={s.removeButton} onPress={onRemove} activeOpacity={0.78}>
                <Trash2 s={13} c={C.textSecondary} w={2} />
                <Text style={s.removeButtonText}>Remove</Text>
              </TouchableOpacity>
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
      <FocusSheetHeader
        kicker="YOUR OWN BOUNDARY"
        title="New Protection Pack"
        subtitle="Group domains that belong behind the same boundary."
        onClose={close}
        large
      />
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
  const [domainsFor, setDomainsFor] = useState<{ kind: 'builtin'; id: WebPackId } | { kind: 'custom'; id: string } | null>(null);
  const activePacks = purity.packs.filter(pack => pack.mode !== 'off').length + purity.customPacks.filter(pack => pack.mode !== 'off').length;
  const configured = activePacks + purity.customDomains.length > 0;
  const enforced = configured
    && state.permission === 'approved'
    && state.nativeProtection.status === 'applied';
  const previewReady = configured && state.permission === 'preview';
  const webResolution = useMemo(() => resolveWebProtectionDomains(purity), [purity]);
  const nativeApplying = configured
    && state.permission === 'approved'
    && (state.nativeProtection.status === 'idle' || state.nativeProtection.status === 'applying');
  const nativeError = configured
    && state.permission === 'approved'
    && state.nativeProtection.status === 'error';
  const statusLabel = enforced
    ? 'ON'
    : previewReady
      ? 'PREVIEW'
      : nativeError
        ? 'ERROR'
        : nativeApplying
          ? 'STARTING'
          : configured
            ? 'SAVED'
            : 'OFF';
  const statusTitle = enforced
    ? 'Harmful sites stay out.'
    : previewReady
      ? 'Your protection is ready to preview.'
      : nativeError
        ? 'Protection needs attention.'
        : nativeApplying
          ? 'Protection is starting.'
          : configured
            ? 'Your choices are saved.'
            : 'Choose what you want to block.';
  const statusBody = enforced
    ? 'Clean Sight is active across supported browsers.'
    : previewReady
      ? 'Your selected rules are ready for a native iPhone build.'
      : nativeError
        ? state.nativeProtection.error ?? 'Anasta could not apply the saved web rules.'
        : nativeApplying
          ? 'Anasta is applying your saved web rules now.'
          : configured
            ? 'Allow Screen Time access to activate these rules.'
            : 'Turn on a ready-made pack or add one specific domain.';
  const statusReady = enforced || previewReady;
  const pendingAt = useMemo(
    () => pendingChanges.length ? formatEndsAt(Math.min(...pendingChanges.map(change => change.effectiveAt))) : null,
    [pendingChanges]
  );
  const packMode = (id: WebPackId) => purity.packs.find(pack => pack.id === id)?.mode ?? 'off';

  const addOneDomain = () => {
    if (!normalizeDomain(draftDomain).includes('.')) return;
    request(() => { addCustomDomain(draftDomain); setDraftDomain(''); });
  };

  // Live data for the full-domain-list sheet, so add/remove reflect instantly.
  const domainsSheet = useMemo(() => {
    if (!domainsFor) return null;
    if (domainsFor.kind === 'builtin') {
      const pack = WEB_PACKS.find(entry => entry.id === domainsFor.id);
      if (!pack) return null;
      return { title: pack.name, domains: pack.sites, note: pack.sitesNote, editable: false as const, customId: null };
    }
    const pack = purity.customPacks.find(entry => entry.id === domainsFor.id);
    if (!pack) return null;
    return { title: pack.name, domains: pack.domains, note: undefined, editable: true as const, customId: pack.id };
  }, [domainsFor, purity.customPacks]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <ScreenTitleBar title="WEB PROTECTION" showBack horizontalBleed={16} sideWidth={56} />
        <Animated.View entering={enter(0)} style={s.introWrap}>
          <Text style={s.intro}>“Far from the eyes, far from the heart.”</Text>
        </Animated.View>

        <Animated.View entering={enter(40)} style={s.statusCardShell}>
          <LinearGradient
            colors={nativeError
              ? ['#FFF0F2', '#FFFAFA']
              : statusReady
                ? ['#E7F5EF', '#F8FCFA']
                : configured
                  ? ['#FFF4D8', '#FFFCF5']
                  : ['#F1F0EC', '#FBFAF7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[s.statusCard, nativeError && s.statusCardError]}
          >
            <View pointerEvents="none" style={[s.statusBeam, statusReady && s.statusBeamOn, nativeError && s.statusBeamError]} />
            <View pointerEvents="none" style={s.statusBeamSoft} />
            <View pointerEvents="none" style={[s.statusShieldGlow, statusReady && s.statusShieldGlowOn, nativeError && s.statusShieldGlowError]} />
            <View pointerEvents="none" style={[s.statusOrbit, statusReady && s.statusOrbitOn, nativeError && s.statusOrbitError]} />
            <View pointerEvents="none" style={[s.statusOrbitInner, statusReady && s.statusOrbitInnerOn, nativeError && s.statusOrbitInnerError]} />
            <View pointerEvents="none" style={s.statusWatermark}>
              <Shield s={140} c={nativeError ? '#A24351' : statusReady ? '#2D7967' : C.goldDark} w={1.05} />
            </View>

            <View style={s.statusHeadingRow}>
              <Text style={[s.statusKicker, nativeError && s.statusKickerError]}>CLEAN SIGHT</Text>
              <View style={[s.liveBadge, statusReady && s.liveBadgeOn, nativeError && s.liveBadgeError]}>
                <View style={[s.liveIndicator, statusReady && s.liveIndicatorOn, nativeError && s.liveIndicatorError]}>
                  <View style={[s.liveDot, statusReady && s.liveDotOn, nativeError && s.liveDotError]} />
                </View>
                <Text style={[s.liveText, statusReady && s.liveTextOn, nativeError && s.liveTextError]}>{statusLabel}</Text>
              </View>
            </View>

            <View style={s.statusCopy}>
              <Text style={s.statusTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.86}>
                {statusTitle}
              </Text>
              <Text style={s.statusBody} numberOfLines={3}>
                {statusBody}
              </Text>
            </View>

            <View style={s.statusMetricsShell}>
              <View style={[s.statusMetricsClip, statusReady && s.statusMetricsOn, nativeError && s.statusMetricsError]}>
                <LinearGradient
                  pointerEvents="none"
                  colors={nativeError
                    ? ['rgba(255,255,255,0.94)', 'rgba(255,244,246,0.86)']
                    : statusReady
                      ? ['rgba(255,255,255,0.94)', 'rgba(239,249,245,0.86)']
                      : ['rgba(255,255,255,0.94)', 'rgba(253,249,239,0.86)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <View pointerEvents="none" style={s.statusMetricsHighlight} />
                <View style={s.statusMetric}>
                  <Text style={s.statusMetricValue}>{activePacks}</Text>
                  <Text style={s.statusMetricLabel}>{activePacks === 1 ? 'active pack' : 'active packs'}</Text>
                </View>
                <View style={s.statusMetricDivider} />
                <View style={s.statusMetric}>
                  <Text style={s.statusMetricValue}>{webResolution.domains.length}</Text>
                  <Text style={s.statusMetricLabel}>{webResolution.domains.length === 1 ? 'domain ready' : 'domains ready'}</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {state.permission !== 'approved' && configured && (
          <Animated.View entering={FadeIn.duration(200)} style={s.permissionBand}>
            <View style={s.permissionIcon}><Lock s={16} c="#8D5C1E" w={2.2} /></View>
            <Text style={s.permissionText}>
              {state.permission === 'preview'
                ? 'Preview only. Real browser blocking requires the Anasta development build.'
                : 'Allow Screen Time access to activate your saved web rules.'}
            </Text>
            {state.permission !== 'preview' && (
              <TouchableOpacity style={s.permissionAction} onPress={() => request(() => {})}>
                <Text style={s.permissionActionText}>ENABLE</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

        {webResolution.omittedDomains.length > 0 && (
          <View style={s.capacityBandWarning}>
            <Globe s={17} c="#A36F2B" w={2} />
            <View style={{ flex: 1 }}>
              <Text style={s.capacityTitle}>
                {webResolution.omittedDomains.length} domains could not be added
              </Text>
              <Text style={s.capacityBody}>
                Apple allows {WEB_DOMAIN_LIMIT} explicit domain slots. Your individual domains stay first.
              </Text>
            </View>
          </View>
        )}

        {pendingChanges.length > 0 && (
          <TouchableOpacity style={s.pendingBand} onPress={() => setPendingOpen(true)} activeOpacity={0.72}>
            <View style={s.pendingIcon}><Hourglass s={16} c={C.goldDark} w={2} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.pendingTitle}>{pendingChanges.length} {pendingChanges.length === 1 ? 'change' : 'changes'} waiting</Text>
              <Text style={s.pendingText}>Eligible {pendingAt}</Text>
            </View>
            <ChevronRight s={17} c={C.goldDark} w={2} />
          </TouchableOpacity>
        )}

        <Animated.View entering={enter(90)} style={s.sectionBlock}>
          <View style={s.sectionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.sectionLabel}>PROTECTION PACKS</Text>
              <Text style={s.sectionTitle}>Choose what stays out</Text>
            </View>
            <View style={s.sectionCount}><Text style={s.sectionCountText}>{WEB_PACKS.length + purity.customPacks.length}</Text></View>
          </View>
          <View style={s.packList}>
            {WEB_PACKS.map(pack => {
              const mode = packMode(pack.id);
              return (
                <PackRow
                  key={pack.id}
                  name={pack.name}
                  detail={pack.detail}
                  domains={pack.sites}
                  mode={mode}
                  emoji={pack.emoji}
                  slashed={pack.slashed}
                  appleFilter={pack.id === 'adult'}
                  onToggle={() => request(() => setPackMode(pack.id, mode === 'off' ? 'on' : 'off'))}
                  onNever={() => mode === 'never' ? setPackMode(pack.id, 'off') : setConfirmNeverPack(pack.id)}
                  onSeeAll={() => setDomainsFor({ kind: 'builtin', id: pack.id })}
                />
              );
            })}
            {purity.customPacks.map(pack => (
              <PackRow
                key={pack.id}
                name={pack.name}
                detail="Your custom domain collection"
                domains={pack.domains}
                mode={pack.mode}
                emoji={CUSTOM_PACK_EMOJI}
                onToggle={() => request(() => setCustomWebPackMode(pack.id, pack.mode === 'off' ? 'on' : 'off'))}
                onNever={() => setCustomWebPackMode(pack.id, pack.mode === 'never' ? 'off' : 'never')}
                onSeeAll={() => setDomainsFor({ kind: 'custom', id: pack.id })}
                onRemove={() => setConfirmRemovePack(pack)}
              />
            ))}
          </View>
          <TouchableOpacity style={s.newPackButton} onPress={() => setNewPackOpen(true)}>
            <View style={s.plusIcon}><Plus s={15} c="#2D7967" w={2.5} /></View>
            <Text style={s.newPackText}>Create a custom pack</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={enter(150)} style={s.sectionBlock}>
          <View style={s.sectionIntro}>
            <Text style={s.sectionLabel}>INDIVIDUAL DOMAINS</Text>
            <Text style={s.sectionTitle}>Block one site directly</Text>
            <Text style={s.sectionBody}>Add a domain that does not belong in a full pack.</Text>
          </View>
          <View style={s.individualList}>
            {purity.customDomains.map((entry, index) => (
              <View key={entry.domain}>
                {index > 0 && <View style={s.individualSeparator} />}
                <View style={s.individualRow}>
                  <View style={[s.individualIcon, entry.never && s.individualIconNever]}>
                    <Globe s={16} c={entry.never ? '#A24351' : '#2D7967'} w={2} />
                  </View>
                  <Text style={s.individualDomain} numberOfLines={1}>{entry.domain}</Text>
                  <TouchableOpacity style={[s.smallLock, entry.never && s.smallLockOn]} onPress={() => setDomainNever(entry.domain, !entry.never)}>
                    <Lock s={13} c={entry.never ? '#A24351' : C.textMuted} w={2.2} />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.removeDomainButton} onPress={() => removeCustomDomain(entry.domain)} hitSlop={8}>
                    <X s={15} c={C.textMuted} w={2.2} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {purity.customDomains.length > 0 && <View style={s.individualSeparator} />}
            <View style={s.domainInputRow}>
              <TextInput value={draftDomain} onChangeText={setDraftDomain} onSubmitEditing={addOneDomain} placeholder="example.com" placeholderTextColor={C.textMuted} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={s.domainInput} />
              <TouchableOpacity style={[s.inlineAdd, !normalizeDomain(draftDomain).includes('.') && s.disabled]} onPress={addOneDomain} disabled={!normalizeDomain(draftDomain).includes('.')}><Plus s={15} c="#fff" w={2.5} /></TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={enter(210)} style={s.sectionBlock}>
          <View style={s.lockPanel}>
            <View style={s.lockHeader}>
              <View style={s.lockIcon}><Lock s={19} c={C.goldDark} w={2.2} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.lockEyebrow}>ANTI-BYPASS</Text>
                <Text style={s.lockTitle}>Strict Watch</Text>
                <Text style={s.lockBody}>Weakening protection waits. Stronger changes apply now.</Text>
              </View>
              <FocusSwitch value={purity.locks.enabled} onToggle={() => updateLocks({ enabled: !purity.locks.enabled })} />
            </View>
            <View style={[s.lockSettings, !purity.locks.enabled && s.lockSettingsDisabled]} pointerEvents={purity.locks.enabled ? 'auto' : 'none'}>
              <Text style={s.lockSettingLabel}>WEAKER CHANGES WAIT FOR</Text>
              <View style={s.cooldownRow}>{COOLDOWNS.map(option => <TouchableOpacity key={option.id} style={[s.cooldownChip, purity.locks.cooldown === option.id && s.cooldownChipOn]} onPress={() => updateLocks({ cooldown: option.id })} haptic="selection"><Text style={[s.cooldownText, purity.locks.cooldown === option.id && s.cooldownTextOn]}>{option.label}</Text></TouchableOpacity>)}</View>
              <View style={s.lockToggleRow}><View style={{ flex: 1 }}><Text style={s.lockToggleTitle}>Protect app removal</Text><Text style={s.lockToggleBody}>Make Anasta harder to remove in a weak moment.</Text></View><FocusSwitch value={purity.locks.uninstallProtection} onToggle={() => updateLocks({ uninstallProtection: !purity.locks.uninstallProtection })} /></View>
              <View style={s.lockToggleRow}><View style={{ flex: 1 }}><Text style={s.lockToggleTitle}>Block new app installs</Text><Text style={s.lockToggleBody}>Prevent replacing a blocked website with its app.</Text></View><FocusSwitch value={purity.locks.denyNewApps} onToggle={() => updateLocks({ denyNewApps: !purity.locks.denyNewApps })} /></View>
            </View>
          </View>
        </Animated.View>

        <View style={s.bottomNote}>
          <View style={s.bottomNoteIcon}><Shield s={17} c="#2D7967" w={2.1} /></View>
          <Text style={s.bottomNoteText}>Web Protection works independently of Phone Plans. An Essential browser still cannot open a blocked domain.</Text>
        </View>
      </ScrollView>

      <NewPackSheet visible={newPackOpen} onClose={() => setNewPackOpen(false)} />
      <PackDomainsSheet
        visible={domainsSheet !== null}
        title={domainsSheet?.title ?? ''}
        domains={domainsSheet?.domains ?? []}
        note={domainsSheet?.note}
        editable={domainsSheet?.editable ?? false}
        onAdd={domainsSheet?.customId ? domain => addDomainToCustomWebPack(domainsSheet.customId!, domain) : undefined}
        onRemove={domainsSheet?.customId ? domain => removeDomainFromCustomWebPack(domainsSheet.customId!, domain) : undefined}
        onClose={() => setDomainsFor(null)}
      />
      <SmoothBottomSheet
        visible={pendingOpen && pendingChanges.length > 0}
        onClose={() => setPendingOpen(false)}
        sheetStyle={s.pendingSheet}
      >
        <FocusSheetHeader
          kicker="STRICT WATCH"
          title="Pending Changes"
          onClose={() => setPendingOpen(false)}
          large
        />
        <Text style={s.pendingSheetIntro}>
          Stronger protection stays active until each change becomes eligible. Cancel a request to keep the current rule.
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
  page: { paddingHorizontal: 16, paddingBottom: 90 },
  introWrap: { paddingHorizontal: 26, paddingTop: 8, paddingBottom: 6, alignItems: 'center' },
  intro: { fontFamily: F.serifMediumItalic, fontSize: 17, lineHeight: 21.5, color: C.textSecondary, textAlign: 'center' },
  statusCardShell: { marginTop: 12, borderRadius: 28, borderCurve: 'continuous', backgroundColor: C.surface, boxShadow: '0 12px 30px rgba(35, 40, 37, 0.10)' },
  statusCard: { position: 'relative', overflow: 'hidden', borderRadius: 28, borderCurve: 'continuous', borderWidth: 1, borderColor: '#DFD9CC', paddingHorizontal: 18, paddingTop: 13, paddingBottom: 18 },
  statusCardError: { borderColor: '#E9C7CD' },
  statusBeam: { position: 'absolute', right: -60, top: -48, width: 255, height: 116, borderRadius: 58, backgroundColor: 'rgba(183,154,96,0.12)', transform: [{ rotate: '-14deg' }] },
  statusBeamOn: { backgroundColor: 'rgba(45,121,103,0.13)' },
  statusBeamError: { backgroundColor: 'rgba(162,67,81,0.12)' },
  statusBeamSoft: { position: 'absolute', right: -92, bottom: 18, width: 250, height: 66, borderRadius: 33, backgroundColor: 'rgba(255,255,255,0.42)', transform: [{ rotate: '-14deg' }] },
  statusShieldGlow: { position: 'absolute', right: -16, top: 39, width: 158, height: 158, borderRadius: 79, backgroundColor: 'rgba(183,154,96,0.055)' },
  statusShieldGlowOn: { backgroundColor: 'rgba(45,121,103,0.055)' },
  statusShieldGlowError: { backgroundColor: 'rgba(162,67,81,0.055)' },
  statusOrbit: { position: 'absolute', right: -43, top: 28, width: 194, height: 194, borderRadius: 97, borderWidth: 1, borderColor: 'rgba(183,154,96,0.17)' },
  statusOrbitOn: { borderColor: 'rgba(45,121,103,0.17)' },
  statusOrbitError: { borderColor: 'rgba(162,67,81,0.16)' },
  statusOrbitInner: { position: 'absolute', right: -7, top: 63, width: 122, height: 122, borderRadius: 61, borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed', borderColor: 'rgba(183,154,96,0.20)' },
  statusOrbitInnerOn: { borderColor: 'rgba(45,121,103,0.20)' },
  statusOrbitInnerError: { borderColor: 'rgba(162,67,81,0.19)' },
  statusWatermark: { position: 'absolute', right: -12, top: 48, opacity: 0.105, transform: [{ rotate: '5deg' }] },
  statusHeadingRow: { height: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  statusKicker: { fontFamily: F.sansBold, fontSize: 10, lineHeight: 14, letterSpacing: 2, color: '#2D7967', includeFontPadding: false },
  statusKickerError: { color: '#A24351' },
  statusCopy: { width: '92%', paddingTop: 8 },
  statusTitle: { fontFamily: F.serifMedium, fontSize: 26, lineHeight: 28, letterSpacing: -0.25, color: C.text },
  statusBody: { marginTop: 3, fontFamily: F.serifMedium, fontSize: 14.5, lineHeight: 18, color: C.textSecondary },
  liveBadge: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(116,111,101,0.13)', backgroundColor: 'rgba(255,255,255,0.76)', paddingLeft: 5, paddingRight: 10, paddingVertical: 4, boxShadow: '0 3px 10px rgba(50,45,40,0.07)' },
  liveBadgeOn: { borderColor: '#BFDDD1', backgroundColor: 'rgba(235,248,243,0.90)' },
  liveBadgeError: { borderColor: '#E8C4CB', backgroundColor: 'rgba(255,239,242,0.92)' },
  liveIndicator: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: 'rgba(116,111,101,0.13)', backgroundColor: 'rgba(255,255,255,0.80)', alignItems: 'center', justifyContent: 'center' },
  liveIndicatorOn: { borderColor: '#C8E1D7', backgroundColor: '#F8FCFA' },
  liveIndicatorError: { borderColor: '#ECCFD4', backgroundColor: '#FFF8F9' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.textMuted },
  liveDotOn: { backgroundColor: '#2D7967' },
  liveDotError: { backgroundColor: '#A24351' },
  liveText: { fontFamily: F.sansBold, fontSize: 9, lineHeight: 12, letterSpacing: 1.2, color: C.textSecondary, includeFontPadding: false },
  liveTextOn: { color: '#2D7967' },
  liveTextError: { color: '#A24351' },
  statusMetricsShell: { marginTop: 19, borderRadius: 17, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.90)', boxShadow: '0 6px 18px rgba(65,54,45,0.10)' },
  statusMetricsClip: { position: 'relative', overflow: 'hidden', minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 17, borderCurve: 'continuous', borderWidth: 1, borderColor: 'rgba(112,102,88,0.15)', paddingHorizontal: 10, paddingVertical: 9 },
  statusMetricsOn: { borderColor: 'rgba(45,121,103,0.20)' },
  statusMetricsError: { borderColor: 'rgba(162,67,81,0.20)' },
  statusMetricsHighlight: { position: 'absolute', left: 14, right: 14, top: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.92)' },
  statusMetric: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'center', gap: 5 },
  statusMetricValue: { fontFamily: F.serifSemiBold, fontSize: 20, lineHeight: 22, color: C.text, fontVariant: ['tabular-nums'] },
  statusMetricLabel: { flexShrink: 1, fontFamily: F.serifMedium, fontSize: 14, lineHeight: 17, color: C.textSecondary, textAlign: 'center' },
  statusMetricDivider: { width: StyleSheet.hairlineWidth, height: 27, backgroundColor: 'rgba(74,70,62,0.18)' },
  permissionBand: { marginTop: 14, minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E8D4AB', backgroundColor: '#FFF7E5', paddingHorizontal: 12, paddingVertical: 10 },
  permissionIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F8E9C8', alignItems: 'center', justifyContent: 'center' },
  permissionText: { flex: 1, fontFamily: F.sansMedium, fontSize: 13, lineHeight: 18, color: '#765026' },
  permissionAction: { minHeight: 34, justifyContent: 'center', borderRadius: 11, backgroundColor: '#E7C67E', paddingHorizontal: 11 },
  permissionActionText: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1, color: '#5F421E' },
  capacityBandWarning: { marginTop: 12, minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E8D4AB', backgroundColor: '#FFF8E8', paddingHorizontal: 13, paddingVertical: 11 },
  capacityTitle: { fontFamily: F.serifSemiBold, fontSize: 16, color: C.text },
  capacityBody: { marginTop: 3, fontFamily: F.sans, fontSize: 12.5, lineHeight: 17, color: C.textSecondary },
  pendingBand: { marginTop: 12, minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E6D7B5', backgroundColor: '#FFF9EB', paddingHorizontal: 12, paddingVertical: 10 },
  pendingIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
  pendingTitle: { fontFamily: F.serifSemiBold, fontSize: 16.5, color: C.text },
  pendingText: { marginTop: 2, fontFamily: F.sansMedium, fontSize: 12, color: C.goldDark },
  sectionBlock: { marginTop: 22 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, paddingHorizontal: 3, marginBottom: 12 },
  sectionIntro: { gap: 3, paddingHorizontal: 3, marginBottom: 12 },
  sectionLabel: { fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 2, color: '#2D7967' },
  sectionTitle: { marginTop: 3, fontFamily: F.serifSemiBold, fontSize: 23, lineHeight: 27, color: C.text },
  sectionBody: { marginTop: 3, fontFamily: F.sans, fontSize: 13.5, lineHeight: 19, color: C.textSecondary },
  sectionCount: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E7F3EE', alignItems: 'center', justifyContent: 'center' },
  sectionCountText: { fontFamily: F.sansBold, fontSize: 13, color: '#2D7967', fontVariant: ['tabular-nums'] },
  packList: { gap: 8 },
  packCard: { position: 'relative', overflow: 'hidden', borderRadius: 21, borderCurve: 'continuous', borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, paddingHorizontal: 12, paddingVertical: 10, boxShadow: '0 6px 16px rgba(35, 40, 37, 0.06)' },
  packCardOn: { borderColor: '#B7D8CA' },
  packCardNever: { borderColor: '#EAC6CD' },
  packRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 11 },
  packMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 11 },
  packIcon: { flexShrink: 0, width: 48, height: 48, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: 'rgba(169,134,63,0.22)', backgroundColor: '#FBF3DE', alignItems: 'center', justifyContent: 'center' },
  packTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  packName: { flexShrink: 1, fontFamily: F.serifSemiBold, fontSize: 18, lineHeight: 22, color: C.text },
  packStatusRow: { marginTop: 3.5, flexDirection: 'row', alignItems: 'center', gap: 6 },
  packStatusDot: { width: 5, height: 5, borderRadius: 3 },
  neverSeal: { width: 36, height: 36, borderRadius: 12, borderCurve: 'continuous', backgroundColor: '#A24351', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 9px rgba(162, 67, 81, 0.3)' },
  appleFilterTag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, borderWidth: 1, borderColor: '#D8DDE6', backgroundColor: '#F6F8FB', paddingLeft: 3, paddingRight: 7, paddingVertical: 3, boxShadow: '0 2px 7px rgba(62,72,88,0.08)' },
  appleFilterTagIcon: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#E5E9F0', alignItems: 'center', justifyContent: 'center' },
  appleFilterTagText: { fontFamily: F.sansBold, fontSize: 7.2, lineHeight: 9, letterSpacing: 0.65, color: '#566276' },
  packDetail: { flexShrink: 1, fontFamily: F.sans, fontSize: 12, lineHeight: 16, color: C.textSecondary },
  packDetailOn: { fontFamily: F.sansMedium, color: '#2D7967' },
  packDetailNever: { fontFamily: F.sansMedium, color: '#A24351' },
  packChevron: { transform: [{ rotate: '0deg' }] },
  packChevronOpen: { transform: [{ rotate: '90deg' }] },
  packBody: { marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, paddingTop: 13, gap: 11 },
  emojiSlashUnder: { position: 'absolute', height: 4.6, borderRadius: 3, backgroundColor: '#FFFFFF', transform: [{ rotate: '-45deg' }] },
  emojiSlash: { position: 'absolute', height: 2.4, borderRadius: 2, backgroundColor: '#C63B4E', transform: [{ rotate: '-45deg' }] },
  domainListLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.5, color: C.textMuted },
  domainChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  domainChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, backgroundColor: '#F0EFEB', paddingHorizontal: 10, paddingVertical: 7 },
  domainChipText: { fontFamily: F.sansMedium, fontSize: 11.5, color: C.textSecondary },
  seeAllButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 14, borderCurve: 'continuous', borderWidth: 1, borderColor: '#C4E0D4', backgroundColor: '#F2FAF6' },
  seeAllText: { fontFamily: F.sansSemiBold, fontSize: 12.5, color: '#2D7967' },
  inlineAdd: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
  packActions: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  neverButton: { flex: 1, minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 15, borderCurve: 'continuous', borderWidth: 1, borderColor: '#EDCBD2', backgroundColor: '#FFF6F7', paddingHorizontal: 10 },
  neverButtonOn: { borderColor: '#E2AEB8', backgroundColor: '#FDEEF1' },
  neverButtonSeal: { width: 30, height: 30, borderRadius: 10, borderCurve: 'continuous', backgroundColor: '#F6DFE4', alignItems: 'center', justifyContent: 'center' },
  neverButtonSealOn: { backgroundColor: '#A24351' },
  neverButtonText: { fontFamily: F.sansSemiBold, fontSize: 12.5, color: '#A24351' },
  neverButtonSub: { marginTop: 1, fontFamily: F.sansMedium, fontSize: 9.5, color: '#B87681' },
  removeButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 15, borderCurve: 'continuous', borderWidth: 1, borderColor: C.border, backgroundColor: '#FBFAF7', paddingHorizontal: 13 },
  removeButtonText: { fontFamily: F.sansSemiBold, fontSize: 12, color: C.textSecondary },
  newPackButton: { marginTop: 11, height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, borderStyle: 'dashed', borderColor: '#BFDCCF', backgroundColor: '#F4FAF7' },
  plusIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#DDEFE8', alignItems: 'center', justifyContent: 'center' },
  newPackText: { fontFamily: F.serifSemiBold, fontSize: 16.5, color: '#2D7967' },
  individualList: { overflow: 'hidden', borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, paddingHorizontal: 12 },
  individualSeparator: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: 46 },
  individualRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 9 },
  individualIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#E7F3EE', alignItems: 'center', justifyContent: 'center' },
  individualIconNever: { backgroundColor: '#F8E7EA' },
  individualDomain: { flex: 1, fontFamily: F.sansSemiBold, fontSize: 14, color: C.text },
  smallLock: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#F0EFEB', alignItems: 'center', justifyContent: 'center' },
  smallLockOn: { backgroundColor: '#F8E7EA' },
  removeDomainButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  domainInputRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 9 },
  domainInput: { flex: 1, fontFamily: F.sansMedium, fontSize: 14, color: C.text },
  lockPanel: { borderRadius: 24, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E4D6B8', backgroundColor: '#FFFDF8', overflow: 'hidden', boxShadow: '0 8px 22px rgba(73, 57, 25, 0.07)' },
  lockHeader: { minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, paddingVertical: 14 },
  lockIcon: { flexShrink: 0, width: 46, height: 46, borderRadius: 15, borderCurve: 'continuous', backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
  lockEyebrow: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.6, color: C.goldDark },
  lockTitle: { marginTop: 2, fontFamily: F.serifSemiBold, fontSize: 21, lineHeight: 24, color: C.text },
  lockBody: { marginTop: 4, fontFamily: F.sans, fontSize: 12.5, lineHeight: 17, color: C.textSecondary },
  lockSettings: { borderTopWidth: 1, borderTopColor: '#EEE5D3', padding: 15, gap: 13 },
  lockSettingsDisabled: { opacity: 0.38 },
  lockSettingLabel: { fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 1.4, color: C.textMuted },
  cooldownRow: { flexDirection: 'row', gap: 7 },
  cooldownChip: { flex: 1, alignItems: 'center', borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, paddingHorizontal: 6, paddingVertical: 10 },
  cooldownChipOn: { borderColor: C.gold, backgroundColor: C.goldLight },
  cooldownText: { fontFamily: F.sansMedium, fontSize: 11, color: C.textSecondary },
  cooldownTextOn: { fontFamily: F.sansSemiBold, color: C.goldDark },
  lockToggleRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  lockToggleTitle: { fontFamily: F.serifMedium, fontSize: 16, color: C.text },
  lockToggleBody: { marginTop: 3, fontFamily: F.sans, fontSize: 12.5, lineHeight: 17, color: C.textSecondary },
  bottomNote: { marginTop: 22, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 18, borderCurve: 'continuous', backgroundColor: '#EAF5F0', paddingHorizontal: 13, paddingVertical: 12 },
  bottomNoteIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#D7EBE2', alignItems: 'center', justifyContent: 'center' },
  bottomNoteText: { flex: 1, fontFamily: F.sansMedium, fontSize: 13, lineHeight: 18, color: '#35685C' },
  newPackSheet: { backgroundColor: C.bg, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 18, paddingBottom: 28 },
  pendingSheet: { backgroundColor: C.bg, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 18, paddingBottom: 30 },
  packNameInput: { marginTop: 18, height: 54, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, justifyContent: 'center', paddingHorizontal: 14 },
  nameInput: { fontFamily: F.serifMedium, fontSize: 18, color: C.text },
  domainEntry: { marginTop: 10, height: 52, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, paddingLeft: 14, paddingRight: 7 },
  domainEntryInput: { flex: 1, fontFamily: F.sansMedium, fontSize: 14, color: C.text },
  newDomains: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  newDomainChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: '#E5F1EC', paddingHorizontal: 10, paddingVertical: 8 },
  newDomainText: { fontFamily: F.sansMedium, fontSize: 11.5, color: '#2D7967' },
  pendingSheetIntro: { marginTop: 12, fontFamily: F.serif, fontSize: 14.5, lineHeight: 20, color: C.textSecondary },
  pendingList: { marginTop: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  pendingRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10 },
  pendingRowIcon: { width: 40, height: 40, borderRadius: 13, borderCurve: 'continuous', backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
  pendingRowTitle: { fontFamily: F.serifMedium, fontSize: 14.5, color: C.text },
  pendingRowTime: { marginTop: 3, fontFamily: F.sansMedium, fontSize: 11.5, color: C.textMuted },
  cancelPendingButton: { minHeight: 36, justifyContent: 'center', borderRadius: 11, backgroundColor: '#F0EFEB', paddingHorizontal: 11 },
  cancelPendingText: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1, color: C.textSecondary },
});
