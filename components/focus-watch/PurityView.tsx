import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { NotoEmoji } from '@/components/shared/NotoEmoji';
import { CheckSmall, ChevronRight, Clock, Globe, Hourglass, Lock, Plus, Shield, Trash2, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import { useGuidedSetup, useGuideTarget } from '@/components/onboarding/guided/GuidedSetupContext';
import FocusSwitch from './FocusSwitch';
import GoldButton from './GoldButton';
import FocusSheetHeader from './FocusSheetHeader';
import PackDomainsSheet from './PackDomainsSheet';
import { WebProtectionHeroCard, type WebProtectionHeroState } from './ProtectionPillarCards';
import WebProtectionIntroAnimation from './WebProtectionIntroAnimation';
import { CUSTOM_PACK_EMOJI, WEB_PACKS } from './focusContent';
import { resolveWebProtectionDomains, WEB_DOMAIN_LIMIT } from './webProtectionCatalog';
import { usePermissionGate } from './usePermissionGate';
import {
  addCustomDomain,
  addDomainToWebPack,
  addDomainToCustomWebPack,
  cancelPendingChange,
  createCustomWebPack,
  formatEndsAt,
  HARD_LOCK_DISABLE_DELAY_MS,
  hardLockDelayMs,
  normalizeDomain,
  removeCustomDomain,
  removeDomainFromWebPack,
  removeDomainFromCustomWebPack,
  removeCustomWebPack,
  setCustomWebPackMode,
  setDomainNever,
  setPackMode,
  updateWebHardLock,
  useDayPlan,
  type CustomWebPack,
  type LockCooldown,
  type PackMode,
  type PendingChange,
  type WebPackId,
} from './dayPlanStore';

const enter = (delay: number) => FadeInDown.duration(420).delay(delay);

function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return `rgba(45,121,103,${alpha})`;
  const value = Number.parseInt(normalized, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}
const PACK_EXPANSION_EASE = Easing.bezier(0.22, 1, 0.36, 1);
const PACK_COLLAPSE_EASE = Easing.bezier(0.4, 0, 0.2, 1);
const PACK_LAYOUT_TRANSITION = LinearTransition
  .duration(280)
  .easing(PACK_EXPANSION_EASE);
const PACK_BODY_ENTER = FadeIn
  .duration(220)
  .easing(PACK_EXPANSION_EASE);
const PACK_BODY_EXIT = FadeOut
  .duration(150)
  .easing(PACK_COLLAPSE_EASE);
const COOLDOWNS: { id: LockCooldown; label: string; detail: string }[] = [
  { id: '45m', label: '45 minutes', detail: 'The minimum impulse-protection delay' },
  { id: '1h', label: '1 hour', detail: 'A short pause before protection can weaken' },
  { id: '6h', label: '6 hours', detail: 'Keep today’s vulnerable hours protected' },
  { id: '12h', label: '12 hours', detail: 'Half a day between impulse and access' },
  { id: '24h', label: '24 hours', detail: 'Sleep on every weakening decision' },
  { id: '3d', label: '3 days', detail: 'The strongest removable delay in this version' },
];

// The tab-wide hairline weave, in the card's state color — the texture that
// marks a surface as alive in this app.
function CardWeave({ color }: { color: string }) {
  const patternId = `pack-weave-${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id={patternId} width={30} height={30} patternUnits="userSpaceOnUse">
            <Path d="M 0 30 L 30 0" stroke={color} strokeOpacity={0.05} strokeWidth={1} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </Svg>
    </View>
  );
}

function RoundedDashedOutline({ color, radius }: { color: string; radius: number }) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={({ nativeEvent }) => {
        const { width, height } = nativeEvent.layout;
        setSize(current => current.width === width && current.height === height
          ? current
          : { width, height });
      }}
    >
      {size.width > 2 && size.height > 2 ? (
        <Svg width={size.width} height={size.height}>
          <Rect
            x={1}
            y={1}
            width={size.width - 2}
            height={size.height - 2}
            rx={radius - 1}
            ry={radius - 1}
            fill="none"
            stroke={color}
            strokeWidth={1.4}
            strokeDasharray={[6, 5]}
            strokeLinecap="round"
          />
        </Svg>
      ) : null}
    </View>
  );
}

const HEADER_TONES = {
  green: { rule: '#2D7967', ruleSoft: 'rgba(45,121,103,0.28)', gem: '#2D7967' },
  gold: { rule: '#B78A22', ruleSoft: 'rgba(183,138,34,0.30)', gem: '#C9A227' },
};

// A short designed underline: a small gold/green gem, then a rule that fades
// out — the app's gem-rule ornament, sized for a section title.
function HeaderRule({ tone }: { tone: keyof typeof HEADER_TONES }) {
  const t = HEADER_TONES[tone];
  return (
    <View style={s.headerRuleWrap} pointerEvents="none">
      <View style={[s.headerGem, { backgroundColor: t.gem }]} />
      <LinearGradient
        colors={[t.rule, t.rule, t.ruleSoft]}
        locations={[0, 0.62, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={s.headerRuleBar}
      />
    </View>
  );
}

// The screen's section header, one grammar for every section: a dominant serif
// title underlined by the section's own tone, a bold same-size lead line that
// says what the section does, then a quieter serif sentence describing the
// extras. An optional slim stat pill on the right.
function ProtectionSectionHeader({
  title,
  subtitle,
  description,
  tone = 'green',
  activeCount,
  totalCount,
}: {
  title: string;
  subtitle: string;
  description?: string;
  tone?: keyof typeof HEADER_TONES;
  // When both are given, the pill shows the active count out of the total.
  activeCount?: number;
  totalCount?: number;
}) {
  const showBadge = activeCount != null && totalCount != null;
  const lit = showBadge && activeCount > 0;
  return (
    <View style={s.contentSectionHeader}>
      <View style={s.contentSectionTitleRow}>
        {/* Title + its rule live in a column that shrinks to the title, so the
            rule spans exactly from the start to the end of the title text. */}
        <View style={s.contentSectionTitleBlock}>
          <Text selectable style={s.contentSectionTitle}>{title}</Text>
          <HeaderRule tone={tone} />
        </View>
        {showBadge && (
          <View style={[s.packStatPill, lit && s.packStatPillOn]}>
            <LinearGradient
              pointerEvents="none"
              colors={lit ? ['#F4FBF8', '#E4F2EC'] : ['#FBFAF6', '#F1EFE8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text selectable style={[s.packStatNum, lit && s.packStatNumOn]}>{activeCount}</Text>
            <View style={[s.packStatDivider, lit && s.packStatDividerOn]} />
            <View style={s.packStatLabelCol}>
              <Text style={[s.packStatLabelTop, lit && s.packStatLabelTopOn]}>ACTIVE</Text>
              <Text style={[s.packStatLabelBot, lit && s.packStatLabelBotOn]}>OF {totalCount}</Text>
            </View>
          </View>
        )}
      </View>
      <Text selectable style={s.contentSectionSubtitle}>{subtitle}</Text>
      {!!description && <Text selectable style={s.contentSectionDescription}>{description}</Text>}
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
  pendingText,
  onCancelPending,
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
  pendingText?: string;
  onCancelPending?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const expandedTarget = useRef(false);
  const expansionProgress = useSharedValue(0);
  const enabled = mode !== 'off';
  const never = mode === 'never';
  const pending = !!pendingText;
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${expansionProgress.value * 90}deg` }],
  }));

  const toggleExpanded = () => {
    const nextExpanded = !expandedTarget.current;
    expandedTarget.current = nextExpanded;
    expansionProgress.value = withTiming(nextExpanded ? 1 : 0, {
      duration: nextExpanded ? 280 : 220,
      easing: nextExpanded ? PACK_EXPANSION_EASE : PACK_COLLAPSE_EASE,
    });
    setExpanded(nextExpanded);
  };

  return (
    <Animated.View
      layout={PACK_LAYOUT_TRANSITION}
      style={[s.packCard, enabled && s.packCardOn, never && s.packCardNever, pending && s.packCardPending]}
    >
      {enabled && (
        <LinearGradient
          colors={pending
            ? ['#ECECEA', '#F7F6F3', '#FBFAF7']
            : never
              ? ['#FBECEF', '#FFFAFB', '#FFFDFD']
              : ['#E6F3EC', '#F9FCFA', '#FEFFFE']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {enabled && <CardWeave color={pending ? '#77756F' : never ? '#A24351' : '#2D7967'} />}
      {pending && (
        <Animated.View
          pointerEvents="none"
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(160)}
          style={s.pendingSurfaceWash}
        />
      )}
      <View style={s.packRow}>
        <TouchableOpacity
          style={s.packMain}
          onPress={toggleExpanded}
          activeOpacity={0.72}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${name}. ${expanded ? 'Collapse' : 'Expand'} details.`}
        >
          <View style={[s.packIcon, enabled && !never && !pending && s.packIconOn, never && s.packIconNever, pending && s.packIconPending]}>
            <PackEmoji emoji={emoji} slashed={slashed} size={26} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={s.packTitleRow}>
              <Text style={s.packName} numberOfLines={1}>{name}</Text>
              {pending && (
                <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={s.packPendingTag}>
                  <Clock s={9} c="#7A5A1D" w={2.2} />
                  <Text style={s.packPendingTagText}>PENDING</Text>
                </Animated.View>
              )}
            </View>
            <View style={s.packStatusRow}>
              {pending
                ? <Clock s={11} c="#77736B" w={2.1} />
                : <View style={[
                    s.packStatusDot,
                    { backgroundColor: never ? '#A24351' : enabled ? '#2D7967' : '#CFC9BB' },
                  ]} />}
              <Text
                style={[s.packDetail, enabled && s.packDetailOn, never && s.packDetailNever, pending && s.packDetailPending]}
                numberOfLines={1}
              >
                {pending
                  ? pendingText
                  : never
                  ? `Never allowed · ${domains.length} domains stay locked`
                  : enabled
                    ? `${domains.length} domains blocked`
                    : detail}
              </Text>
            </View>
          </View>
          <Animated.View style={[s.packChevron, chevronStyle]}>
            <ChevronRight s={16} c={C.textMuted} w={2} />
          </Animated.View>
        </TouchableOpacity>
        {pending ? (
          <FocusSwitch value={false} onToggle={onCancelPending ?? onToggle} activeColor="#77736B" />
        ) : never ? (
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

      {pending && (
        <Animated.View
          entering={FadeInDown.duration(220)}
          exiting={FadeOut.duration(150)}
          layout={LinearTransition.duration(200)}
          style={s.packPendingBar}
        >
          <View style={s.packPendingBarIcon}><Hourglass s={13} c="#67635C" w={2.1} /></View>
          <Text style={s.packPendingBarText}>These websites are still blocked by Hard Lock.</Text>
          <TouchableOpacity style={s.packPendingCancel} onPress={onCancelPending} haptic="selection">
            <Text style={s.packPendingCancelText}>KEEP ON</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {expanded && (
        <Animated.View
          entering={PACK_BODY_ENTER}
          exiting={PACK_BODY_EXIT}
          style={s.packBody}
        >
          {appleFilter && (
            <Animated.View entering={FadeIn.duration(180)} style={s.expandedAppleFilter}>
              <View style={s.expandedAppleFilterIcon}><Shield s={14} c="#566276" w={2.1} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={s.expandedAppleFilterTitleRow}>
                  <Text style={s.expandedAppleFilterTitle}>Apple Filter</Text>
                  <View style={s.expandedAppleFilterTag}><Text style={s.expandedAppleFilterTagText}>BUILT IN</Text></View>
                </View>
                <Text style={s.expandedAppleFilterBody}>Apple’s adult website filter strengthens this pack when it is active.</Text>
              </View>
            </Animated.View>
          )}

          {/* The blocked sites, in one framed well: a header that carries the
              count and the add action, the domains as chips, then a full-list
              row. Reads as "inside this pack" rather than a stack of buttons. */}
          <View style={s.domainWell}>
            <View style={s.domainWellHead}>
              <View style={s.domainWellHeadLeft}>
                <Globe s={13} c="#2D7967" w={2.1} />
                <Text style={s.domainWellLabel}>BLOCKED SITES</Text>
                <View style={s.domainWellCount}><Text style={s.domainWellCountText}>{domains.length}</Text></View>
              </View>
              <TouchableOpacity style={s.domainAddPill} onPress={onSeeAll} activeOpacity={0.76} haptic="selection">
                <Plus s={12} c="#2D7967" w={2.5} />
                <Text style={s.domainAddPillText}>Add</Text>
              </TouchableOpacity>
            </View>
            <View style={s.domainChips}>
              {domains.slice(0, 6).map(domain => (
                <View key={domain} style={s.domainChip}>
                  <View style={s.domainChipDot} />
                  <Text style={s.domainChipText} numberOfLines={1}>{domain}</Text>
                </View>
              ))}
              {domains.length > 6 && (
                <View style={[s.domainChip, s.domainChipMore]}>
                  <Text style={s.domainChipMoreText}>+{domains.length - 6}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={s.seeAllRow} onPress={onSeeAll} activeOpacity={0.72}>
              <Text style={s.seeAllText}>
                {domains.length > 6 ? `See all ${domains.length} sites` : 'Open the full list'}
              </Text>
              <ChevronRight s={14} c="#2D7967" w={2.2} />
            </TouchableOpacity>
          </View>

          {!pending && (
            <View style={s.packActions}>
              <TouchableOpacity
                style={[s.neverButton, mode === 'never' && s.neverButtonOn]}
                onPress={onNever}
                activeOpacity={0.78}
                haptic="selection"
              >
                <View style={[s.neverButtonSeal, mode === 'never' && s.neverButtonSealOn]}>
                  <Lock s={13} c={mode === 'never' ? '#FFFFFF' : '#A24351'} w={2.2} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.neverButtonText}>{mode === 'never' ? 'Request unlock' : 'Never allow'}</Text>
                  <Text style={s.neverButtonSub} numberOfLines={1}>
                    {mode === 'never' ? 'Hard Lock protects the exit' : 'Locked even from yourself'}
                  </Text>
                </View>
              </TouchableOpacity>
              {onRemove && (
                <TouchableOpacity style={s.removeButton} onPress={onRemove} activeOpacity={0.78} haptic="selection">
                  <Trash2 s={14} c={C.textSecondary} w={2} />
                </TouchableOpacity>
              )}
            </View>
          )}
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

type PackTurnOffRequest =
  | { kind: 'builtin'; id: WebPackId; name: string; domainCount: number }
  | { kind: 'custom'; id: string; name: string; domainCount: number };

export default function PurityView({
  guided = false,
  guidedPackId = 'social',
  onGuidedComplete,
}: {
  guided?: boolean;
  guidedPackId?: WebPackId;
  onGuidedComplete?: () => void;
} = {}) {
  const { height: screenHeight } = useWindowDimensions();
  const state = useDayPlan();
  const { purity, pendingChanges } = state;
  const { request, gate } = usePermissionGate();
  const { session, patchSession, setPresentation } = useGuidedSetup();
  const isGuided = guided && session?.active === true && session.activeStep === 'focusWebProtection';
  const guidePhase = isGuided ? session.phase : '';
  const guideScrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const guidePackTarget = useGuideTarget('focus-web-protection-pack', isGuided);
  const hardLockTarget = useGuideTarget('focus-web-protection-hard-lock', isGuided);
  const guideScrollY = useRef(0);
  const guideTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [guidePackId] = useState<WebPackId>(() => {
    const recommended = purity.packs.find(pack => pack.id === guidedPackId);
    if (recommended?.mode === 'off') return guidedPackId;
    return purity.packs.find(pack => pack.mode === 'off')?.id ?? guidedPackId;
  });
  const [newPackOpen, setNewPackOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [cooldownOpen, setCooldownOpen] = useState(false);
  const [hardLockExpanded, setHardLockExpanded] = useState(false);
  const [confirmHardLockOff, setConfirmHardLockOff] = useState(false);
  const [confirmPackOff, setConfirmPackOff] = useState<PackTurnOffRequest | null>(null);
  const [confirmDomainRemoval, setConfirmDomainRemoval] = useState<string | null>(null);
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
  // One hero card covers every state: live, armed (preview / saved / applying),
  // couldn't-start, and resting (nothing chosen yet).
  const heroState: WebProtectionHeroState = enforced
    ? 'on'
    : nativeError
      ? 'error'
      : configured
        ? 'preview'
        : 'off';
  const hardLockDelay = COOLDOWNS.find(option => option.id === purity.locks.cooldown) ?? COOLDOWNS[1];
  const hardLockPendingOff = pendingChanges.find(change =>
    change.action.kind === 'locks' && change.action.partial.enabled === false
  );
  const hardLockTurningOff = !!hardLockPendingOff;
  const hardLockSummary = hardLockPendingOff
    ? `Turns off ${pendingWhen(hardLockPendingOff.effectiveAt)}`
    : purity.locks.enabled
      ? `Blocked websites stay blocked for ${hardLockDelay.label} after an unlock request`
      : 'Set a delay before blocked websites can be unlocked';
  const packMode = (id: WebPackId) => purity.packs.find(pack => pack.id === id)?.mode ?? 'off';
  const guidePackMode = packMode(guidePackId);
  const guidePackName = WEB_PACKS.find(pack => pack.id === guidePackId)?.name ?? 'Protection Pack';
  const domainsForBuiltInPack = (id: WebPackId) => {
    const curated = WEB_PACKS.find(pack => pack.id === id)?.sites ?? [];
    const extra = purity.packs.find(pack => pack.id === id)?.extraDomains ?? [];
    return [...curated, ...extra];
  };
  const builtInPackPending = (id: WebPackId) => pendingChanges.find(change =>
    change.action.kind === 'pack-mode'
      && change.action.packId === id
      && change.action.mode === 'off'
  );
  const customPackPending = (id: string) => pendingChanges.find(change =>
    (change.action.kind === 'custom-pack-mode'
      && change.action.packId === id
      && change.action.mode === 'off')
    || (change.action.kind === 'custom-pack-remove' && change.action.packId === id)
  );
  const pendingPackText = (change: PendingChange | undefined) => {
    if (!change) return undefined;
    return change.action.kind === 'custom-pack-remove'
      ? `Removal pending · ${pendingWhen(change.effectiveAt)}`
      : `Turns off ${pendingWhen(change.effectiveAt)}`;
  };

  const clearGuideTimers = useCallback(() => {
    guideTimersRef.current.forEach(clearTimeout);
    guideTimersRef.current = [];
  }, []);

  const stageGuideTarget = useCallback((
    binding: ReturnType<typeof useGuideTarget>,
    position: 'origin' | 'middle',
    present: () => void,
  ) => {
    const node = binding.ref.current;
    if (!node?.measureInWindow) {
      guideTimersRef.current.push(setTimeout(present, 40));
      return;
    }
    if (position === 'origin') {
      guideScrollRef.current?.scrollTo({ y: 0, animated: guideScrollY.current > 4 });
      guideTimersRef.current.push(setTimeout(() => {
        binding.measure();
        guideTimersRef.current.push(setTimeout(present, 48));
      }, guideScrollY.current > 4 ? 330 : 56));
      return;
    }
    node.measureInWindow((_x: number, y: number, _width: number, height: number) => {
      const desired = Math.max(86, screenHeight * 0.47 - height / 2);
      const delta = y - desired;
      if (Math.abs(delta) < 14) {
        binding.measure();
        guideTimersRef.current.push(setTimeout(present, 56));
        return;
      }
      guideScrollRef.current?.scrollTo({ y: Math.max(0, guideScrollY.current + delta), animated: true });
      guideTimersRef.current.push(setTimeout(() => {
        const refreshedNode = binding.ref.current;
        if (!refreshedNode?.measureInWindow) {
          binding.measure();
          guideTimersRef.current.push(setTimeout(present, 48));
          return;
        }
        refreshedNode.measureInWindow((_nextX: number, nextY: number, _nextWidth: number, nextHeight: number) => {
          const safeTop = 82;
          const safeBottom = screenHeight - 84;
          const correction = nextY < safeTop
            ? nextY - safeTop
            : nextY + nextHeight > safeBottom
              ? nextY + nextHeight - safeBottom
              : 0;
          if (Math.abs(correction) > 4) {
            guideScrollRef.current?.scrollTo({
              y: Math.max(0, guideScrollY.current + correction),
              animated: false,
            });
          }
          guideTimersRef.current.push(setTimeout(() => {
            binding.measure();
            guideTimersRef.current.push(setTimeout(present, 48));
          }, Math.abs(correction) > 4 ? 80 : 0));
        });
      }, 340));
    });
  }, [screenHeight]);

  const finishGuidedWebProtection = useCallback(() => {
    setPresentation(null);
    onGuidedComplete?.();
  }, [onGuidedComplete, setPresentation]);

  useEffect(() => {
    if (!isGuided) return;
    clearGuideTimers();

    if (guidePhase === 'webIntro') {
      if (guideScrollY.current > 4) guideScrollRef.current?.scrollTo({ y: 0, animated: true });
      guideTimersRef.current.push(setTimeout(() => {
        setPresentation({
          key: 'focus-web-protection-intro',
          placement: 'bottom',
          lightScrim: true,
          eyebrow: 'WEB PROTECTION',
          progress: { current: 1, total: 3 },
          message: 'This is the real Web Protection screen. Ready-made packs block entire groups of harmful sites across supported browsers.',
          highlights: ['real Web Protection screen', 'Ready-made packs'],
          ctaLabel: 'Choose my first pack',
          onCta: () => patchSession({ phase: 'webPack' }),
        });
      }, 360));
      return;
    }

    if (guidePhase === 'webPack') {
      stageGuideTarget(guidePackTarget, 'middle', () => {
        const alreadyOn = guidePackMode !== 'off';
        setPresentation({
          key: 'focus-web-protection-pack',
          targetId: 'focus-web-protection-pack',
          cutoutPadding: 7,
          placement: 'above',
          allowTargetInteraction: !alreadyOn,
          eyebrow: 'WEB PROTECTION',
          progress: { current: 2, total: 3 },
          message: alreadyOn
            ? `${guidePackName} is already protecting you. Packs can be changed from this real screen at any time.`
            : `${guidePackName} best matches the protection you asked for. Turn it on now.`,
          highlights: [guidePackName, alreadyOn ? 'already protecting you' : 'Turn it on now'],
          action: alreadyOn ? undefined : `Turn on ${guidePackName}`,
          hint: alreadyOn ? undefined : 'tap',
          hintAnchor: 'right',
          ctaLabel: alreadyOn ? 'Continue' : undefined,
          onCta: alreadyOn ? () => patchSession({ phase: 'webHardLock' }) : undefined,
        });
      });
      return;
    }

    if (guidePhase === 'webHardLock') {
      stageGuideTarget(hardLockTarget, 'middle', () => {
        setPresentation({
          key: 'focus-web-protection-hard-lock',
          targetId: 'focus-web-protection-hard-lock',
          cutoutPadding: 7,
          placement: 'above',
          allowTargetInteraction: false,
          eyebrow: 'WEB PROTECTION',
          progress: { current: 3, total: 3 },
          message: 'Hard Lock adds a delay before protection can be weakened. It is already on, but permanent lock remains your choice.',
          highlights: ['Hard Lock', 'delay', 'your choice'],
          ctaLabel: 'Finish Web Protection',
          onCta: finishGuidedWebProtection,
        });
      });
      return;
    }

    setPresentation(null);
  }, [
    clearGuideTimers,
    finishGuidedWebProtection,
    guidePackMode,
    guidePackName,
    guidePackTarget,
    guidePhase,
    hardLockTarget,
    isGuided,
    patchSession,
    setPresentation,
    stageGuideTarget,
  ]);

  useEffect(() => () => clearGuideTimers(), [clearGuideTimers]);

  const handleBuiltInPackToggle = (
    id: WebPackId,
    name: string,
    mode: PackMode,
    pending: PendingChange | undefined,
    domainCount: number,
  ) => {
    if (pending) {
      cancelPendingChange(pending.id);
      return;
    }
    if (mode === 'off') {
      request(() => {
        setPackMode(id, 'on');
        if (isGuided && guidePhase === 'webPack' && id === guidePackId) {
          setPresentation(null);
          patchSession({ phase: 'webHardLock' });
        }
      });
      return;
    }
    setConfirmPackOff({ kind: 'builtin', id, name, domainCount });
  };

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
      const packState = purity.packs.find(entry => entry.id === pack.id);
      const addedDomains = packState?.extraDomains ?? [];
      const pendingRemovals: Record<string, { id: string; text: string }> = {};
      pendingChanges.forEach(change => {
        if (change.action.kind !== 'pack-domain-remove' || change.action.packId !== pack.id) return;
        pendingRemovals[change.action.domain] = {
          id: change.id,
          text: `Removal pending · ${pendingWhen(change.effectiveAt)}`,
        };
      });
      return {
        title: pack.name,
        domains: [...pack.sites, ...addedDomains],
        note: pack.sitesNote,
        addedDomains,
        appleFilter: pack.id === 'adult',
        builtInId: pack.id,
        customId: null,
        pendingRemovals,
        removalDelayLabel: purity.locks.enabled && packState?.mode !== 'off' ? hardLockDelay.label : undefined,
      };
    }
    const pack = purity.customPacks.find(entry => entry.id === domainsFor.id);
    if (!pack) return null;
    const pendingRemovals: Record<string, { id: string; text: string }> = {};
    pendingChanges.forEach(change => {
      if (change.action.kind !== 'custom-pack-domain-remove' || change.action.packId !== pack.id) return;
      pendingRemovals[change.action.domain] = {
        id: change.id,
        text: `Removal pending · ${pendingWhen(change.effectiveAt)}`,
      };
    });
    return {
      title: pack.name,
      domains: pack.domains,
      note: undefined,
      addedDomains: pack.domains.length > 1 ? pack.domains : [],
      appleFilter: false,
      builtInId: null,
      customId: pack.id,
      pendingRemovals,
      removalDelayLabel: purity.locks.enabled && pack.mode !== 'off' ? hardLockDelay.label : undefined,
    };
  }, [domainsFor, hardLockDelay.label, pendingChanges, purity.customPacks, purity.locks.enabled, purity.packs]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        ref={isGuided ? guideScrollRef : undefined}
        contentContainerStyle={s.page}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={isGuided ? 16 : undefined}
        onScroll={isGuided ? event => { guideScrollY.current = event.nativeEvent.contentOffset.y; } : undefined}
      >
        <ScreenTitleBar
          title="WEB PROTECTION"
          showBack
          horizontalBleed={16}
          sideWidth={56}
          onBackOverride={isGuided ? () => {} : undefined}
        />
        <Animated.View entering={enter(0)} style={s.introWrap}>
          <Text style={s.intro}>“Far from the eyes, far from the heart.”</Text>
        </Animated.View>
        <WebProtectionIntroAnimation />

        {/* One hero for every state — live, armed, couldn't-start, resting. */}
        <Animated.View entering={enter(40)} style={s.statusReadyWrap}>
          <WebProtectionHeroCard
            state={heroState}
            title={statusTitle}
            body={statusBody}
            packsOn={activePacks}
            domainsReady={webResolution.domains.length}
            lockCaption={purity.locks.locked
              ? 'HARD LOCKED'
              : purity.locks.enabled
                ? 'HARD LOCK'
                : 'SYSTEM-WIDE'}
          />
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

        <View style={s.zoneDivider}>
          <View style={s.zoneDividerLine} />
          <Text style={s.zoneDividerText}>BLOCKING SETTINGS</Text>
          <View style={s.zoneDividerLine} />
        </View>

        <Animated.View entering={enter(90)} style={s.sectionBlock}>
          <ProtectionSectionHeader
            title="Protection Packs"
            subtitle="Choose which groups of websites will be blocked."
            description="Block whole categories at once, add your own sites, or build a new pack."
            activeCount={activePacks}
            totalCount={WEB_PACKS.length + purity.customPacks.length}
          />
          <View style={s.packList}>
            {WEB_PACKS.map(pack => {
              const mode = packMode(pack.id);
              const pending = builtInPackPending(pack.id);
              const domains = domainsForBuiltInPack(pack.id);
              const row = (
                <PackRow
                  key={pack.id}
                  name={pack.name}
                  detail={pack.detail}
                  domains={domains}
                  mode={mode}
                  emoji={pack.emoji}
                  slashed={pack.slashed}
                  appleFilter={pack.id === 'adult'}
                  onToggle={() => handleBuiltInPackToggle(pack.id, pack.name, mode, pending, domains.length)}
                  onNever={() => mode === 'never'
                    ? setConfirmPackOff({ kind: 'builtin', id: pack.id, name: pack.name, domainCount: domains.length })
                    : setConfirmNeverPack(pack.id)}
                  onSeeAll={() => setDomainsFor({ kind: 'builtin', id: pack.id })}
                  pendingText={pendingPackText(pending)}
                  onCancelPending={pending ? () => cancelPendingChange(pending.id) : undefined}
                />
              );
              return isGuided && pack.id === guidePackId ? (
                <View key={`guided-${pack.id}`} {...guidePackTarget}>{row}</View>
              ) : row;
            })}
            {purity.customPacks.map(pack => {
              const pending = customPackPending(pack.id);
              return (
                <PackRow
                  key={pack.id}
                  name={pack.name}
                  detail="Your custom domain collection"
                  domains={pack.domains}
                  mode={pack.mode}
                  emoji={CUSTOM_PACK_EMOJI}
                  onToggle={() => {
                    if (pending) {
                      cancelPendingChange(pending.id);
                    } else if (pack.mode === 'off') {
                      request(() => setCustomWebPackMode(pack.id, 'on'));
                    } else {
                      setConfirmPackOff({ kind: 'custom', id: pack.id, name: pack.name, domainCount: pack.domains.length });
                    }
                  }}
                  onNever={() => pack.mode === 'never'
                    ? setConfirmPackOff({ kind: 'custom', id: pack.id, name: pack.name, domainCount: pack.domains.length })
                    : setCustomWebPackMode(pack.id, 'never')}
                  onSeeAll={() => setDomainsFor({ kind: 'custom', id: pack.id })}
                  onRemove={() => setConfirmRemovePack(pack)}
                  pendingText={pendingPackText(pending)}
                  onCancelPending={pending ? () => cancelPendingChange(pending.id) : undefined}
                />
              );
            })}
          </View>
          <TouchableOpacity style={s.newPackButton} onPress={() => setNewPackOpen(true)}>
            <LinearGradient
              pointerEvents="none"
              colors={['#F7E8C5', '#FFF7E5', '#FFFCF4']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <CardWeave color="#9A6C1E" />
            <RoundedDashedOutline color="#D0AA55" radius={18} />
            <View style={s.plusIcon}><Plus s={15} c={C.goldDark} w={2.5} /></View>
            <Text style={s.newPackText}>Create a custom pack</Text>
          </TouchableOpacity>
          <View style={s.bottomNote}>
            <View style={s.bottomNoteIcon}><Shield s={17} c="#2D7967" w={2.1} /></View>
            <Text style={s.bottomNoteText}>Blocked websites stay blocked in every browser.</Text>
          </View>
        </Animated.View>

        {[
        <Animated.View
          key="hard-lock"
          {...(isGuided ? hardLockTarget : {})}
          entering={enter(175)}
          style={s.sectionBlock}
        >
          <View style={s.subsectionDivider} />
          <ProtectionSectionHeader
            title="Hard Lock"
            subtitle="Keep your choices from being undone too fast."
            description="Set how long blocked sites stay protected before any weakening change can take effect."
            tone="gold"
          />
          <Animated.View
            layout={LinearTransition.duration(220)}
            style={[
            s.hardLockPanel,
            purity.locks.enabled && s.hardLockPanelOn,
            purity.locks.locked && s.hardLockPanelPermanent,
            hardLockTurningOff && s.hardLockPanelPending,
            ]}
          >
            {purity.locks.enabled && (
              <LinearGradient
                colors={hardLockTurningOff
                  ? ['#E9E9E6', '#F5F4F1', '#FBFAF7']
                  : purity.locks.locked
                    ? ['#F9EDCE', '#FFF9EC', '#FFFDF8']
                    : ['#F8F0DC', '#FFFDF8', '#FFFFFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            )}
            {purity.locks.enabled && <CardWeave color={hardLockTurningOff ? '#706D67' : '#A97724'} />}
            {hardLockTurningOff && (
              <Animated.View
                pointerEvents="none"
                entering={FadeIn.duration(220)}
                exiting={FadeOut.duration(160)}
                style={s.pendingSurfaceWash}
              />
            )}
            <View style={s.hardLockHeader}>
              <TouchableOpacity
                style={s.hardLockMain}
                onPress={() => setHardLockExpanded(current => !current)}
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityState={{ expanded: hardLockExpanded }}
                accessibilityLabel={`Hard Lock. ${hardLockSummary}. ${hardLockExpanded ? 'Collapse' : 'Expand'} details.`}
              >
                <View style={[
                  s.hardLockIcon,
                  purity.locks.locked && s.hardLockIconPermanent,
                  hardLockTurningOff && s.hardLockIconPending,
                ]}>
                  {hardLockTurningOff
                    ? <Hourglass s={19} c="#66635D" w={2.2} />
                    : <Lock s={20} c={purity.locks.locked ? '#FFFFFF' : C.goldDark} w={2.3} />}
                </View>
                <View style={s.hardLockCopy}>
                  <Text style={[s.hardLockEyebrow, hardLockTurningOff && s.hardLockEyebrowPending]}>
                    {purity.locks.locked ? 'PERMANENTLY LOCKED' : 'IMPULSE PROTECTION'}
                  </Text>
                  <View style={s.hardLockTitleRow}>
                    <Text style={s.hardLockTitle}>Hard Lock</Text>
                    {hardLockTurningOff && (
                      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={s.hardLockPendingTag}>
                        <Hourglass s={9} c="#7A5A1D" w={2.2} />
                        <Text style={s.hardLockPendingTagText}>PENDING</Text>
                      </Animated.View>
                    )}
                  </View>
                  <Text
                    style={[
                      s.hardLockBody,
                      purity.locks.enabled && s.hardLockBodyOn,
                      purity.locks.locked && s.hardLockBodyLocked,
                      hardLockTurningOff && s.hardLockBodyPending,
                    ]}
                    numberOfLines={2}
                  >
                    {hardLockSummary}
                  </Text>
                </View>
                <View style={[s.hardLockChevron, hardLockExpanded && s.hardLockChevronOpen]}>
                  <ChevronRight s={16} c={C.textMuted} w={2} />
                </View>
              </TouchableOpacity>
              {purity.locks.locked ? (
                <View style={s.hardLockOnBadge}>
                  <Lock s={10} c="#7A5A1D" w={2.4} />
                  <Text style={s.hardLockOnBadgeText}>LOCKED ON</Text>
                </View>
              ) : (
                <FocusSwitch
                  value={purity.locks.enabled && !hardLockTurningOff}
                  onToggle={() => {
                    if (hardLockPendingOff) {
                      cancelPendingChange(hardLockPendingOff.id);
                    } else if (purity.locks.enabled) {
                      setConfirmHardLockOff(true);
                    } else {
                      updateWebHardLock({ enabled: true });
                    }
                  }}
                  activeColor={hardLockTurningOff ? '#77736B' : C.gold}
                />
              )}
            </View>

            {hardLockExpanded && (
              <Animated.View entering={FadeIn.duration(180)} style={s.hardLockSettings}>
                {hardLockPendingOff ? (
                  <Animated.View entering={FadeIn.duration(180)} style={s.hardLockPendingDetail}>
                    <View style={s.hardLockPendingDetailIcon}><Hourglass s={17} c="#66635D" w={2.2} /></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.hardLockPendingDetailTitle}>Hard Lock is still protecting you.</Text>
                      <Text style={s.hardLockPendingDetailBody}>
                        It turns off {pendingWhen(hardLockPendingOff.effectiveAt)}. Until then, blocked websites and every unlock delay stay active.
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={s.hardLockPendingCancel}
                      onPress={() => cancelPendingChange(hardLockPendingOff.id)}
                      haptic="selection"
                    >
                      <Text style={s.hardLockPendingCancelText}>KEEP ON</Text>
                    </TouchableOpacity>
                  </Animated.View>
                ) : <>
                  <View style={s.hardLockExplanationCard}>
                  <Text style={s.hardLockExplanationLabel}>HOW HARD LOCK WORKS</Text>
                  <Text style={s.hardLockExplanationTitle}>
                    With Hard Lock on, unblocking websites takes {hardLockDelay.label}.
                  </Text>
                  <Text style={s.hardLockExplanation}>
                    If temptation makes you try to restore access, those websites remain blocked during the delay. This gives you time to let the urge pass instead of acting on it immediately.
                  </Text>
                  </View>

                  <TouchableOpacity
                    style={s.hardLockDelayRow}
                    onPress={() => setCooldownOpen(true)}
                    haptic="selection"
                    accessibilityRole="button"
                    accessibilityLabel={`Unlock delay, ${hardLockDelay.label}`}
                  >
                    <View style={s.hardLockDelayIcon}><Clock s={16} c={C.goldDark} w={2.1} /></View>
                    <View style={s.hardLockDelayCopy}>
                      <Text style={s.hardLockDelayLabel}>UNLOCK DELAY</Text>
                      <Text style={s.hardLockDelayValue}>{hardLockDelay.label}</Text>
                    </View>
                    <Text style={s.hardLockDelayHint}>Change</Text>
                    <ChevronRight s={15} c={C.goldDark} w={2.2} />
                  </TouchableOpacity>

                  {purity.locks.locked && (
                    <Animated.View entering={FadeIn.duration(180)} style={s.permanentNote}>
                      <Shield s={15} c="#7A5A1D" w={2.2} />
                      <Text style={s.permanentNoteText}>
                        This legacy Hard Lock remains on. Shortening its delay must first wait through the current delay.
                      </Text>
                    </Animated.View>
                  )}
                </>}
              </Animated.View>
            )}
          </Animated.View>
        </Animated.View>,

        <Animated.View key="individual-domains" entering={enter(135)} style={s.sectionBlock}>
          <View style={s.subsectionDivider} />
          <ProtectionSectionHeader
            title="Individual Domains"
            subtitle="Block one specific website on its own!"
            description="Add any sites that aren’t already covered by the packs above."
          />
          {/* Compose card: type a domain, tap the green add. */}
          <View style={[s.domainAddCard, normalizeDomain(draftDomain).includes('.') && s.domainAddCardReady]}>
            <View style={s.domainAddGlobe}><Globe s={16} c="#2D7967" w={2} /></View>
            <TextInput
              value={draftDomain}
              onChangeText={setDraftDomain}
              onSubmitEditing={addOneDomain}
              placeholder="example.com"
              placeholderTextColor="#A7B5AE"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={s.domainAddInput}
            />
            <TouchableOpacity
              style={[s.domainAddBtn, !normalizeDomain(draftDomain).includes('.') && s.domainAddBtnOff]}
              onPress={addOneDomain}
              disabled={!normalizeDomain(draftDomain).includes('.')}
              haptic="selection"
            >
              <Plus s={16} c="#FFFFFF" w={2.6} />
            </TouchableOpacity>
          </View>

          {purity.customDomains.length === 0 ? (
            <View style={s.domainEmpty}>
              <Text style={s.domainEmptyText}>No individual sites yet. Add one above.</Text>
            </View>
          ) : (
            <View style={s.domainCardStack}>
              {purity.customDomains.map(entry => {
                const pending = pendingChanges.find(change =>
                  (change.action.kind === 'domain-remove' || change.action.kind === 'domain-never')
                    && change.action.domain === entry.domain
                );
                const pendingText = pending?.action.kind === 'domain-never'
                  ? `Leaves Never Allowed ${pendingWhen(pending.effectiveAt)}`
                  : pending
                    ? `Removal pending · ${pendingWhen(pending.effectiveAt)}`
                    : null;
                const state: 'pending' | 'never' | 'on' = pending ? 'pending' : entry.never ? 'never' : 'on';
                const accent = state === 'pending' ? '#6E6A63' : state === 'never' ? '#A24351' : '#2D7967';
                return (
                  <Animated.View
                    key={entry.domain}
                    layout={LinearTransition.duration(200)}
                    entering={FadeInDown.duration(240).easing(Easing.out(Easing.cubic))}
                    style={[s.domainCard, state === 'never' && s.domainCardNever, state === 'pending' && s.domainCardPending]}
                  >
                    <LinearGradient
                      pointerEvents="none"
                      colors={state === 'pending'
                        ? ['#EFEEEB', '#F8F7F4', '#FBFAF8']
                        : state === 'never'
                          ? ['#FBECEF', '#FFFAFB', '#FFFDFD']
                          : ['#E9F4EF', '#FAFDFB', '#FEFFFE']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={[s.domainCardChip, { borderColor: withAlpha(accent, 0.28), backgroundColor: withAlpha(accent, 0.1) }]}>
                      {state === 'pending'
                        ? <Hourglass s={16} c={accent} w={2.1} />
                        : state === 'never'
                          ? <Lock s={15} c={accent} w={2.2} />
                          : <Globe s={16} c={accent} w={2} />}
                    </View>
                    <View style={s.domainCardCopy}>
                      <Text style={s.domainCardName} numberOfLines={1}>{entry.domain}</Text>
                      <View style={s.domainCardStatusRow}>
                        <View style={[s.domainCardDot, { backgroundColor: accent }]} />
                        <Text style={[s.domainCardStatus, { color: accent }]} numberOfLines={1}>
                          {pendingText ?? (state === 'never' ? 'Locked · never allowed' : 'Blocked everywhere')}
                        </Text>
                      </View>
                    </View>
                    {state === 'pending' ? (
                      <TouchableOpacity style={s.domainKeepBtn} onPress={() => cancelPendingChange(pending!.id)} haptic="selection" activeOpacity={0.8}>
                        <Text style={s.domainKeepText}>Keep</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={s.domainCardActions}>
                        <TouchableOpacity
                          style={[s.domainLockBtn, state === 'never' && s.domainLockBtnOn]}
                          onPress={() => setDomainNever(entry.domain, !entry.never)}
                          haptic="selection"
                          accessibilityLabel={entry.never ? 'Remove Never Allowed' : 'Lock as Never Allowed'}
                        >
                          <Lock s={14} c={state === 'never' ? '#FFFFFF' : '#8A8378'} w={2.2} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={s.domainTrashBtn}
                          onPress={() => setConfirmDomainRemoval(entry.domain)}
                          haptic="selection"
                          accessibilityLabel={`Remove ${entry.domain}`}
                        >
                          <Trash2 s={15} c="#B0554F" w={2} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </Animated.View>
                );
              })}
            </View>
          )}
        </Animated.View>,
        ].reverse()}

      </ScrollView>

      <NewPackSheet visible={newPackOpen} onClose={() => setNewPackOpen(false)} />
      <PackDomainsSheet
        visible={domainsSheet !== null}
        title={domainsSheet?.title ?? ''}
        domains={domainsSheet?.domains ?? []}
        note={domainsSheet?.note}
        addedDomains={domainsSheet?.addedDomains}
        pendingRemovals={domainsSheet?.pendingRemovals}
        removalDelayLabel={domainsSheet?.removalDelayLabel}
        onAdd={domainsSheet?.builtInId
          ? domain => addDomainToWebPack(domainsSheet.builtInId!, domain)
          : domainsSheet?.customId
            ? domain => addDomainToCustomWebPack(domainsSheet.customId!, domain)
            : undefined}
        onRemove={domainsSheet?.builtInId
          ? domain => { removeDomainFromWebPack(domainsSheet.builtInId!, domain); }
          : domainsSheet?.customId
            ? domain => removeDomainFromCustomWebPack(domainsSheet.customId!, domain)
            : undefined}
        onCancelPending={id => cancelPendingChange(id)}
        onClose={() => setDomainsFor(null)}
      />
      <SmoothBottomSheet
        visible={cooldownOpen}
        onClose={() => setCooldownOpen(false)}
        sheetStyle={s.cooldownSheet}
      >
        <FocusSheetHeader
          kicker="HARD LOCK"
          title="Choose the unlock delay"
          subtitle="A request to weaken website blocking becomes eligible only after this time passes."
          onClose={() => setCooldownOpen(false)}
          large
        />
        <ScrollView
          style={[s.cooldownList, { maxHeight: Math.min(420, screenHeight * 0.55) }]}
          contentContainerStyle={s.cooldownListContent}
          showsVerticalScrollIndicator={false}
        >
          {COOLDOWNS.map((option, index) => {
            const selected = purity.locks.cooldown === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={[s.cooldownOption, index > 0 && s.cooldownOptionBorder]}
                onPress={() => {
                  updateWebHardLock({ cooldown: option.id });
                  setCooldownOpen(false);
                }}
                haptic="selection"
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View style={[s.cooldownOptionIcon, selected && s.cooldownOptionIconOn]}>
                  {selected
                    ? <CheckSmall s={17} c="#FFFFFF" w={2.7} />
                    : <Clock s={15} c={C.textMuted} w={2} />}
                </View>
                <View style={s.cooldownOptionCopy}>
                  <Text style={[s.cooldownOptionTitle, selected && s.cooldownOptionTitleOn]}>{option.label}</Text>
                  <Text style={s.cooldownOptionDetail}>{option.detail}</Text>
                </View>
                {selected && <Text style={s.cooldownCurrent}>CURRENT</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <Text style={s.cooldownFootnote}>
          If you choose a shorter delay while Hard Lock is on, the current longer delay protects that change too.
        </Text>
      </SmoothBottomSheet>
      <SmoothBottomSheet
        visible={pendingOpen && pendingChanges.length > 0}
        onClose={() => setPendingOpen(false)}
        sheetStyle={s.pendingSheet}
      >
        <FocusSheetHeader
          kicker="HARD LOCK"
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
        visible={confirmHardLockOff}
        icon={<Hourglass s={21} c="#765F37" w={2.2} />}
        iconBg="#F1ECE2"
        title="Turn off Hard Lock?"
        body="Hard Lock will remain active for the next 24 hours. Blocked websites and every unlock delay stay protected during that time. You can cancel the turn-off at any moment."
        subject={`Turns off ${pendingWhen(Date.now() + HARD_LOCK_DISABLE_DELAY_MS)}`}
        cancelLabel="Cancel"
        confirmLabel="Turn Off"
        confirmColor="#A24351"
        naturalButtonLabels
        onCancel={() => setConfirmHardLockOff(false)}
        onConfirm={() => {
          updateWebHardLock({ enabled: false });
          setConfirmHardLockOff(false);
        }}
      />
      <ConfirmModal
        visible={confirmPackOff !== null}
        icon={<Hourglass s={21} c="#765F37" w={2.2} />}
        iconBg="#F1ECE2"
        title={`Turn off ${confirmPackOff?.name ?? 'this pack'}?`}
        body={purity.locks.enabled
          ? `Hard Lock will keep all ${confirmPackOff?.domainCount ?? 0} domains blocked for ${hardLockDelay.label}. The pack changes to Pending now and turns off only when that delay ends.`
          : 'This pack will stop blocking its domains immediately because Hard Lock is off.'}
        subject={purity.locks.enabled
          ? `Turns off ${pendingWhen(Date.now() + hardLockDelayMs(purity.locks.cooldown))}`
          : `${confirmPackOff?.domainCount ?? 0} domains will no longer be blocked by this pack`}
        cancelLabel="Cancel"
        confirmLabel="Turn Off"
        confirmColor="#A24351"
        naturalButtonLabels
        onCancel={() => setConfirmPackOff(null)}
        onConfirm={() => {
          if (confirmPackOff?.kind === 'builtin') {
            request(() => setPackMode(confirmPackOff.id, 'off'));
          } else if (confirmPackOff?.kind === 'custom') {
            request(() => setCustomWebPackMode(confirmPackOff.id, 'off'));
          }
          setConfirmPackOff(null);
        }}
      />
      <ConfirmModal
        visible={confirmDomainRemoval !== null}
        icon={<Globe s={21} c="#765F37" w={2.1} />}
        iconBg="#F1ECE2"
        title="Remove this blocked website?"
        body={purity.locks.enabled
          ? `Hard Lock keeps this website blocked for ${hardLockDelay.label}. Its row changes to Pending now, and removal happens only when the delay ends.`
          : 'This website will be removed from Web Protection immediately because Hard Lock is off.'}
        subject={confirmDomainRemoval ?? undefined}
        naturalButtonLabels
        cancelLabel="Keep Blocking"
        confirmLabel={purity.locks.enabled ? 'Start Removal' : 'Remove'}
        confirmColor="#BE123C"
        onCancel={() => setConfirmDomainRemoval(null)}
        onConfirm={() => {
          if (confirmDomainRemoval) removeCustomDomain(confirmDomainRemoval);
          setConfirmDomainRemoval(null);
        }}
      />
      <ConfirmModal
        visible={confirmNeverPack !== null}
        icon={<Lock s={21} c="#A24351" w={2.2} />}
        iconBg="#F8E7EA"
        title="Make this pack Never Allowed?"
        body="It stays active without an ordinary unlock. If Hard Lock is on, a later weakening request must wait through its selected delay."
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
        body={purity.locks.enabled && confirmRemovePack?.mode !== 'off'
          ? `Hard Lock keeps this pack active for ${hardLockDelay.label}. The pack remains visible as Pending until removal can take effect.`
          : 'Its domains leave this pack immediately. Any same domain protected elsewhere remains blocked.'}
        subject={confirmRemovePack?.name}
        confirmLabel={purity.locks.enabled && confirmRemovePack?.mode !== 'off' ? 'START REMOVAL' : 'REMOVE PACK'}
        confirmColor="#7A7368"
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
  statusReadyWrap: { marginTop: 12 },
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
  zoneDivider: { marginTop: 27, marginBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 10 },
  zoneDividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#D8D1C5' },
  zoneDividerText: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.55, color: C.textMuted },
  subsectionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#D8D1C5', marginBottom: 20 },
  sectionBlock: { marginTop: 22 },
  // One header grammar for the whole screen: dominant serif title underlined by
  // the section's tone, a bold serif lead line, then a quieter serif sentence.
  contentSectionHeader: { paddingHorizontal: 3, marginBottom: 13 },
  contentSectionTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  contentSectionTitleBlock: { flexShrink: 1, minWidth: 0 },
  contentSectionTitle: { fontFamily: F.serifSemiBold, fontSize: 29, lineHeight: 34, letterSpacing: -0.5, color: C.text },
  // The rule sits close under the title and spans its full width: gem at the
  // start, a bar that runs to the end and softens.
  headerRuleWrap: { marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerGem: { width: 5, height: 5, borderRadius: 1, transform: [{ rotate: '45deg' }] },
  headerRuleBar: { flex: 1, height: 2.5, borderRadius: 2 },
  contentSectionSubtitle: { marginTop: 8, fontFamily: F.serifBold, fontSize: 15.5, lineHeight: 18.5, color: '#2E2A25' },
  contentSectionDescription: { marginTop: 1, maxWidth: 344, fontFamily: F.serifMedium, fontSize: 15, lineHeight: 18.5, color: C.textSecondary },
  // A refined stat tag: a big serif active count, a hairline, then a two-line
  // ACTIVE / OF N caption. No dot; a soft gradient and shadow give it depth.
  packStatPill: {
    flexShrink: 0, marginTop: 3, position: 'relative', overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    minHeight: 34, borderRadius: 13, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E1DCD2',
    paddingLeft: 12, paddingRight: 12,
    boxShadow: '0 4px 12px rgba(45, 40, 33, 0.06)',
  },
  packStatPillOn: { borderColor: '#B7DACB', boxShadow: '0 4px 12px rgba(31, 90, 76, 0.1)' },
  packStatNum: { fontFamily: F.serifBold, fontSize: 20, lineHeight: 22, color: '#9A9186', fontVariant: ['tabular-nums'] },
  packStatNumOn: { color: '#1F5A4C' },
  packStatDivider: { width: StyleSheet.hairlineWidth, height: 20, backgroundColor: 'rgba(60,54,46,0.18)' },
  packStatDividerOn: { backgroundColor: 'rgba(45,121,103,0.28)' },
  packStatLabelCol: { justifyContent: 'center' },
  packStatLabelTop: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1, color: '#9A9186' },
  packStatLabelTopOn: { color: '#2D7967' },
  packStatLabelBot: { marginTop: 1.5, fontFamily: F.sansSemiBold, fontSize: 8, letterSpacing: 0.6, color: '#B4AEA3', fontVariant: ['tabular-nums'] },
  packStatLabelBotOn: { color: '#66998A' },
  packList: { gap: 7 },
  packCard: { position: 'relative', overflow: 'hidden', borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, paddingHorizontal: 12, paddingVertical: 8, boxShadow: '0 6px 16px rgba(35, 40, 37, 0.06)' },
  packCardOn: { borderColor: '#B7D8CA' },
  packCardNever: { borderColor: '#EAC6CD' },
  packCardPending: { borderColor: '#C8C5BE', boxShadow: '0 7px 18px rgba(70, 68, 63, 0.08)' },
  pendingSurfaceWash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(235,235,232,0.38)' },
  packRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 11 },
  packMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 11 },
  // The face chip takes the pack's state colour, not a fixed gold.
  packIcon: { flexShrink: 0, width: 46, height: 46, borderRadius: 15, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E4DFD4', backgroundColor: '#F5F3EE', alignItems: 'center', justifyContent: 'center' },
  packIconOn: { borderColor: '#C2E0D4', backgroundColor: '#E4F3EC' },
  packIconNever: { borderColor: '#EAC6CD', backgroundColor: '#FBEBEF' },
  packIconPending: { borderColor: '#D6D3CC', backgroundColor: '#EEEDEA' },
  packTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  packName: { flexShrink: 1, fontFamily: F.serifSemiBold, fontSize: 18, lineHeight: 22, color: C.text },
  packStatusRow: { marginTop: 3.5, flexDirection: 'row', alignItems: 'center', gap: 6 },
  packStatusDot: { width: 5, height: 5, borderRadius: 3 },
  packPendingTag: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, borderWidth: 1, borderColor: '#D8BD7B', backgroundColor: 'rgba(255,249,232,0.94)', paddingHorizontal: 7, paddingVertical: 3 },
  packPendingTagText: { fontFamily: F.sansBold, fontSize: 7.2, letterSpacing: 0.75, color: '#7A5A1D' },
  neverSeal: { width: 36, height: 36, borderRadius: 12, borderCurve: 'continuous', backgroundColor: '#A24351', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 9px rgba(162, 67, 81, 0.3)' },
  packDetail: { flexShrink: 1, fontFamily: F.sans, fontSize: 12, lineHeight: 16, color: C.textSecondary },
  packDetailOn: { fontFamily: F.sansMedium, color: '#2D7967' },
  packDetailNever: { fontFamily: F.sansMedium, color: '#A24351' },
  packDetailPending: { fontFamily: F.serifMedium, color: '#6D6962' },
  packChevron: { alignItems: 'center', justifyContent: 'center' },
  packBody: { marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#ECEAE3', paddingTop: 12, gap: 10 },
  expandedAppleFilter: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 15, borderCurve: 'continuous', borderWidth: 1, borderColor: '#D8DDE6', backgroundColor: '#F6F8FB', paddingHorizontal: 11, paddingVertical: 10 },
  expandedAppleFilterIcon: { width: 32, height: 32, borderRadius: 11, borderCurve: 'continuous', backgroundColor: '#E5E9F0', alignItems: 'center', justifyContent: 'center' },
  expandedAppleFilterTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  expandedAppleFilterTitle: { fontFamily: F.serifSemiBold, fontSize: 15.5, lineHeight: 19, color: '#3F4856' },
  expandedAppleFilterTag: { borderRadius: 999, backgroundColor: '#E7EAF0', paddingHorizontal: 6, paddingVertical: 3 },
  expandedAppleFilterTagText: { fontFamily: F.sansBold, fontSize: 6.8, letterSpacing: 0.7, color: '#566276' },
  expandedAppleFilterBody: { marginTop: 2, fontFamily: F.sans, fontSize: 11.5, lineHeight: 16, color: '#697384' },

  // The blocked-sites well: framed, so the dropdown reads as "inside this pack".
  domainWell: { borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: '#DCE9E3', backgroundColor: '#F5FAF8', paddingHorizontal: 11, paddingTop: 10, paddingBottom: 4 },
  domainWellHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 9 },
  domainWellHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  domainWellLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.4, color: '#3D8273' },
  domainWellCount: { minWidth: 19, height: 19, borderRadius: 10, backgroundColor: '#DDEFE8', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  domainWellCountText: { fontFamily: F.sansBold, fontSize: 10, color: '#1F5A4C', fontVariant: ['tabular-nums'] },
  domainAddPill: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 28, borderRadius: 999, borderWidth: 1, borderColor: '#C4E0D4', backgroundColor: '#FFFFFF', paddingHorizontal: 10 },
  domainAddPillText: { fontFamily: F.sansSemiBold, fontSize: 11.5, color: '#2D7967' },
  packPendingBar: { minHeight: 42, marginTop: 9, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, borderCurve: 'continuous', borderWidth: 1, borderColor: 'rgba(121,117,108,0.20)', backgroundColor: 'rgba(255,255,255,0.60)', paddingHorizontal: 8, paddingVertical: 6 },
  packPendingBarIcon: { width: 28, height: 28, borderRadius: 9, borderCurve: 'continuous', backgroundColor: '#E1E0DB', alignItems: 'center', justifyContent: 'center' },
  packPendingBarText: { flex: 1, fontFamily: F.serifMedium, fontSize: 11.5, lineHeight: 15, color: '#625F59' },
  packPendingCancel: { minHeight: 29, justifyContent: 'center', borderRadius: 9, borderCurve: 'continuous', borderWidth: 1, borderColor: '#C6C3BC', backgroundColor: 'rgba(255,255,255,0.80)', paddingHorizontal: 8 },
  packPendingCancelText: { fontFamily: F.sansBold, fontSize: 7.8, letterSpacing: 0.75, color: '#5D5953' },
  emojiSlashUnder: { position: 'absolute', height: 4.6, borderRadius: 3, backgroundColor: '#FFFFFF', transform: [{ rotate: '-45deg' }] },
  emojiSlash: { position: 'absolute', height: 2.4, borderRadius: 2, backgroundColor: '#C63B4E', transform: [{ rotate: '-45deg' }] },
  domainChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  domainChip: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%', borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: '#D4E6DE', backgroundColor: '#FFFFFF', paddingLeft: 8, paddingRight: 11, paddingVertical: 6 },
  domainChipDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#7FB3A2' },
  domainChipText: { flexShrink: 1, fontFamily: F.sansMedium, fontSize: 11.5, color: '#4A6B62' },
  domainChipMore: { backgroundColor: '#E4F1EB', borderColor: '#C4E0D4', paddingHorizontal: 11 },
  domainChipMoreText: { fontFamily: F.sansBold, fontSize: 11, color: '#2D7967' },
  seeAllRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 4, marginHorizontal: -11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DCE9E3' },
  seeAllText: { fontFamily: F.sansSemiBold, fontSize: 12.5, color: '#2D7967' },
  inlineAdd: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
  packActions: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  neverButton: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderCurve: 'continuous', borderWidth: 1, borderColor: '#EDCBD2', backgroundColor: '#FFF6F7', paddingHorizontal: 10 },
  neverButtonOn: { borderColor: '#E2AEB8', backgroundColor: '#FDEEF1' },
  neverButtonSeal: { width: 30, height: 30, borderRadius: 10, borderCurve: 'continuous', backgroundColor: '#F6DFE4', alignItems: 'center', justifyContent: 'center' },
  neverButtonSealOn: { backgroundColor: '#A24351' },
  neverButtonText: { fontFamily: F.sansSemiBold, fontSize: 12.5, color: '#A24351' },
  neverButtonSub: { marginTop: 1, fontFamily: F.sansMedium, fontSize: 9.5, color: '#B87681' },
  removeButton: { width: 48, borderRadius: 14, borderCurve: 'continuous', borderWidth: 1, borderColor: C.border, backgroundColor: '#FBFAF7', alignItems: 'center', justifyContent: 'center' },
  newPackButton: { position: 'relative', overflow: 'hidden', marginTop: 11, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 18, borderCurve: 'continuous', backgroundColor: '#FFF6E1', boxShadow: '0 5px 14px rgba(126,88,24,0.08)' },
  plusIcon: { width: 33, height: 33, borderRadius: 11, borderWidth: 1, borderColor: '#DEC688', backgroundColor: '#F2DFB2', alignItems: 'center', justifyContent: 'center' },
  newPackText: { fontFamily: F.serifSemiBold, fontSize: 16.5, color: '#76521A' },
  // Compose card — type a site, green add button; border warms green when valid.
  domainAddCard: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, borderRadius: 17, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E1DCD2', backgroundColor: '#FFFFFF', paddingLeft: 10, paddingRight: 8, boxShadow: '0 6px 16px rgba(35,40,37,0.05)' },
  domainAddCardReady: { borderColor: '#BADACC' },
  domainAddGlobe: { width: 36, height: 36, borderRadius: 12, borderCurve: 'continuous', borderWidth: 1, borderColor: '#C7E1D6', backgroundColor: '#EAF5F0', alignItems: 'center', justifyContent: 'center' },
  domainAddInput: { flex: 1, fontFamily: F.sansMedium, fontSize: 15, color: C.text, paddingVertical: 0 },
  domainAddBtn: { width: 40, height: 40, borderRadius: 13, borderCurve: 'continuous', backgroundColor: '#2D7967', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 11px rgba(45,121,103,0.32)' },
  domainAddBtnOff: { backgroundColor: '#CFCEC8', boxShadow: 'none' },

  domainEmpty: { marginTop: 9, alignItems: 'center', paddingVertical: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E4DFD4', backgroundColor: '#FBFAF7' },
  domainEmptyText: { fontFamily: F.serifMedium, fontSize: 14.5, color: '#8A8378' },

  // Each site is its own state-coloured card: green blocked, rose locked, slate pending.
  domainCardStack: { marginTop: 9, gap: 7 },
  domainCard: { position: 'relative', overflow: 'hidden', minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, borderColor: '#C2E0D4', paddingLeft: 11, paddingRight: 10, paddingVertical: 9, boxShadow: '0 6px 16px rgba(35,40,37,0.055)' },
  domainCardNever: { borderColor: '#EAC6CD' },
  domainCardPending: { borderColor: '#D6D3CC' },
  domainCardChip: { flexShrink: 0, width: 40, height: 40, borderRadius: 13, borderCurve: 'continuous', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  domainCardCopy: { flex: 1, minWidth: 0 },
  domainCardName: { fontFamily: F.serifSemiBold, fontSize: 16.5, lineHeight: 20, letterSpacing: -0.15, color: C.text },
  domainCardStatusRow: { marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 5 },
  domainCardDot: { width: 5, height: 5, borderRadius: 3 },
  domainCardStatus: { flexShrink: 1, fontFamily: F.sansMedium, fontSize: 11.5, lineHeight: 15 },
  domainCardActions: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 7 },
  domainLockBtn: { width: 36, height: 36, borderRadius: 12, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E4DFD4', backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  domainLockBtnOn: { borderColor: '#A24351', backgroundColor: '#A24351' },
  domainTrashBtn: { width: 36, height: 36, borderRadius: 12, borderCurve: 'continuous', borderWidth: 1, borderColor: '#EAC6CD', backgroundColor: '#FCEFF1', alignItems: 'center', justifyContent: 'center' },
  domainKeepBtn: { flexShrink: 0, minHeight: 34, justifyContent: 'center', borderRadius: 11, borderCurve: 'continuous', borderWidth: 1, borderColor: '#C6C3BC', backgroundColor: 'rgba(255,255,255,0.82)', paddingHorizontal: 14 },
  domainKeepText: { fontFamily: F.sansSemiBold, fontSize: 12.5, color: '#5D5953' },
  hardLockPanel: { position: 'relative', overflow: 'hidden', borderRadius: 24, borderCurve: 'continuous', borderWidth: 1, borderColor: '#DED8CC', backgroundColor: '#FBFAF7', boxShadow: '0 8px 22px rgba(73, 57, 25, 0.07)' },
  hardLockPanelOn: { borderColor: '#DDC994' },
  hardLockPanelPermanent: { borderColor: '#D3B66F', boxShadow: '0 10px 26px rgba(111, 78, 21, 0.12)' },
  hardLockPanelPending: { borderColor: '#C7C4BD', boxShadow: '0 8px 20px rgba(68,66,61,0.09)' },
  hardLockHeader: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, paddingVertical: 10 },
  hardLockMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 11 },
  hardLockIcon: { flexShrink: 0, width: 46, height: 46, borderRadius: 15, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E2D3B3', backgroundColor: '#F7EBCF', alignItems: 'center', justifyContent: 'center' },
  hardLockIconPermanent: { borderColor: '#A97825', backgroundColor: '#A97825', boxShadow: '0 5px 12px rgba(127,86,20,0.25)' },
  hardLockIconPending: { borderColor: '#CBC8C1', backgroundColor: '#E3E2DD', boxShadow: 'none' },
  hardLockCopy: { flex: 1, minWidth: 0 },
  hardLockEyebrow: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.55, color: C.goldDark },
  hardLockEyebrowPending: { color: '#6D6962' },
  hardLockTitleRow: { marginTop: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  hardLockTitle: { fontFamily: F.serifSemiBold, fontSize: 21, lineHeight: 24, color: C.text },
  hardLockPendingTag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, borderWidth: 1, borderColor: '#D8BD7B', backgroundColor: 'rgba(255,249,232,0.92)', paddingHorizontal: 7, paddingVertical: 3 },
  hardLockPendingTagText: { fontFamily: F.sansBold, fontSize: 7.4, lineHeight: 9, letterSpacing: 0.75, color: '#7A5A1D' },
  hardLockBody: { marginTop: 4, fontFamily: F.serifMedium, fontSize: 13.25, lineHeight: 17, color: C.textSecondary },
  hardLockBodyOn: { color: '#89651F' },
  hardLockBodyLocked: { color: '#8F3846' },
  hardLockBodyPending: { color: '#625F59' },
  hardLockChevron: { flexShrink: 0, transform: [{ rotate: '0deg' }] },
  hardLockChevronOpen: { transform: [{ rotate: '90deg' }] },
  hardLockOnBadge: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, borderWidth: 1, borderColor: '#D9BF82', backgroundColor: 'rgba(255,250,236,0.92)', paddingHorizontal: 8, paddingVertical: 7 },
  hardLockOnBadgeText: { fontFamily: F.sansBold, fontSize: 7.8, letterSpacing: 0.7, color: '#7A5A1D' },
  hardLockSettings: { borderTopWidth: 1, borderTopColor: 'rgba(150,119,54,0.16)', padding: 13, paddingTop: 14, gap: 11 },
  hardLockPendingDetail: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, borderColor: '#C8C5BE', backgroundColor: 'rgba(255,255,255,0.66)', paddingHorizontal: 11, paddingVertical: 12 },
  hardLockPendingDetailIcon: { width: 36, height: 36, borderRadius: 12, borderCurve: 'continuous', backgroundColor: '#E1E0DB', alignItems: 'center', justifyContent: 'center' },
  hardLockPendingDetailTitle: { fontFamily: F.serifSemiBold, fontSize: 16.5, lineHeight: 20, color: '#4F4C47' },
  hardLockPendingDetailBody: { marginTop: 3, fontFamily: F.serifMedium, fontSize: 12.5, lineHeight: 17, color: '#716D66' },
  hardLockPendingCancel: { alignSelf: 'center', minHeight: 32, justifyContent: 'center', borderRadius: 10, borderCurve: 'continuous', borderWidth: 1, borderColor: '#C6C3BC', backgroundColor: '#FFFFFF', paddingHorizontal: 8 },
  hardLockPendingCancelText: { fontFamily: F.sansBold, fontSize: 7.8, letterSpacing: 0.75, color: '#5D5953' },
  hardLockExplanationCard: { borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, borderColor: 'rgba(190,156,84,0.30)', backgroundColor: 'rgba(255,252,244,0.78)', paddingHorizontal: 13, paddingVertical: 13 },
  hardLockExplanationLabel: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.4, color: C.goldDark },
  hardLockExplanationTitle: { marginTop: 5, fontFamily: F.serifSemiBold, fontSize: 18, lineHeight: 22, color: C.text },
  hardLockDelayRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 17, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E2D5B9', backgroundColor: 'rgba(255,255,255,0.78)', paddingHorizontal: 11, paddingVertical: 9 },
  hardLockDelayIcon: { width: 38, height: 38, borderRadius: 13, borderCurve: 'continuous', backgroundColor: '#F7EBCF', alignItems: 'center', justifyContent: 'center' },
  hardLockDelayCopy: { flex: 1, minWidth: 0 },
  hardLockDelayLabel: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.25, color: C.textMuted },
  hardLockDelayValue: { marginTop: 2, fontFamily: F.serifSemiBold, fontSize: 18, lineHeight: 21, color: C.text },
  hardLockDelayHint: { fontFamily: F.sansSemiBold, fontSize: 10.5, color: C.goldDark },
  hardLockExplanation: { marginTop: 6, fontFamily: F.serifMedium, fontSize: 14.5, lineHeight: 20.5, color: C.textSecondary },
  permanentNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderRadius: 16, borderCurve: 'continuous', backgroundColor: 'rgba(246,234,202,0.72)', paddingHorizontal: 11, paddingVertical: 10 },
  permanentNoteText: { flex: 1, fontFamily: F.serifMedium, fontSize: 13, lineHeight: 18, color: '#71551E' },
  bottomNote: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, borderColor: '#CDE3DA', backgroundColor: '#EAF5F0', paddingHorizontal: 13, paddingVertical: 12 },
  bottomNoteIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#D7EBE2', alignItems: 'center', justifyContent: 'center' },
  bottomNoteText: { flex: 1, fontFamily: F.sansMedium, fontSize: 13, lineHeight: 18, color: '#35685C' },
  newPackSheet: { backgroundColor: C.bg, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 18, paddingBottom: 28 },
  cooldownSheet: { backgroundColor: C.bg, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 18, paddingBottom: 30 },
  cooldownList: { marginTop: 14, overflow: 'hidden', borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  cooldownListContent: { paddingHorizontal: 12 },
  cooldownOption: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10 },
  cooldownOptionBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  cooldownOptionIcon: { width: 38, height: 38, borderRadius: 13, borderCurve: 'continuous', backgroundColor: '#F0EFEB', alignItems: 'center', justifyContent: 'center' },
  cooldownOptionIconOn: { backgroundColor: '#A97825' },
  cooldownOptionCopy: { flex: 1, minWidth: 0 },
  cooldownOptionTitle: { fontFamily: F.serifSemiBold, fontSize: 16.5, lineHeight: 20, color: C.text },
  cooldownOptionTitleOn: { color: '#7A5A1D' },
  cooldownOptionDetail: { marginTop: 2, fontFamily: F.sans, fontSize: 11, lineHeight: 15.5, color: C.textSecondary },
  cooldownCurrent: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 0.85, color: C.goldDark },
  cooldownFootnote: { marginTop: 13, paddingHorizontal: 3, fontFamily: F.sansMedium, fontSize: 11.5, lineHeight: 16.5, color: C.textSecondary },
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
