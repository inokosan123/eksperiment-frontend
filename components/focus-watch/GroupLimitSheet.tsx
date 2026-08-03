import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { ChevronRight, Lock, Plus } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import FocusRuleSwitch from './FocusRuleSwitch';
import FocusStrengthSwitch, { Door, type OutcomeCopy } from './FocusStrengthSwitch';
import ReturnPracticeGrid from './ReturnPracticeGrid';
import NativeActivitySelectionButton from './NativeActivitySelectionButton';
import { FocusCeremonialHead, FocusHeadMeta, FocusSheetHandle } from './FocusSheetHeader';
import RulePlate from './RulePlate';
import AllowanceDial from './AllowanceDial';
import { GROUP_EMOJI, withAlpha } from './GroupSeal';
import { useFocusRibbonPalette } from './focusBoundaryShell';
import LimitDurationWheelSheet from './LimitDurationWheelSheet';
import { RULE_TONES, type PreviewApp } from './focusContent';
import { isNativeFocusAvailable } from './focusNativeBridge';
import {
  allocatedAppMinutes,
  appLimitBounds,
  groupLimitBounds,
  type FocusRuleMode,
} from './focusLimitBudget';
import {
  formatMinutesShort,
  groupIcon,
  useDayPlan,
  type AppRule,
  type GroupRule,
  type Strength,
} from './dayPlanStore';

// The group rule: three questions, asked one at a time.
//
// **Limit or Blocked** is `FocusRuleSwitch` — the app's two-KINDS grammar, the
// one Set as Task uses for Spiritual and Challenge: a plaque that changes into
// the thing it selects. It goes first and sets the tone.
// **How long** is a row on the lit plate — the group's colour is spent once,
// there, on the only number the rule owns.
// **What happens when it ends** is `FocusStrengthSwitch` — Loose and Strict are
// two kinds too, so they get the same plaque, and the consequence they differ
// by is stated in full on a card of its own beneath it.
// **Which practice buys the way back** is a grid of four faces, because those
// are four things rather than two kinds.
//
// Settings that are not choices are plain rows, name left and value right, with
// no sentence under them — a value states its own meaning. And the head states
// the rule as it stands, so nothing below has to summarise it again.

const ROSE = '#A24351';
// Rose taken to reading weight, for text on a rose tint.
const ROSE_INK = '#8F3443';

function createAppRuleId() {
  return `app-rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function modeFor(rule: GroupRule | null): FocusRuleMode {
  return rule?.mode === 'blocked' ? 'blocked' : 'limit';
}

// The one disclosure mark on the sheet: a chevron that turns a quarter when
// what it points at opens. It is the same mark whether it opens an app's rule
// or the answer inside it, so "there is more under this" is learned once.
function Disclosure({ open, color = C.textMuted }: { open: boolean; color?: string }) {
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    turn.value = reduceMotion
      ? (open ? 1 : 0)
      : withTiming(open ? 1 : 0, { duration: 190, easing: Easing.out(Easing.cubic) });
  }, [open, reduceMotion, turn]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 90}deg` }] }));

  return (
    <Animated.View style={style}>
      <ChevronRight s={16} c={color} w={2} />
    </Animated.View>
  );
}

// ── The three parts, and their heads ───────────────────────────────────────
// A group rule is three questions asked in order — what KIND of rule, what
// happens when it ENDS, and what the single apps get — so the sheet is numbered
// like the Bible note's three fields, which are numbered for the same reason:
// they are not three boxes, they are one method that runs in sequence.
//
// ⚠️ THE NUMERALS ARE TWO COLOURS, AND THE SPLIT IS THE POINT. Parts one and
// two set the whole group at once and wear the group's colour. Part three sets
// apps one at a time — a different KIND of setting — so it is struck in gold,
// the app's own colour for a thing you go and do. You can see where the global
// ends and the individual begins before reading a word.
//
// ⚠️ Return practice is NOT a fourth part. It is what "Loose" means, so it
// belongs inside part two — as a sub-head, not another numeral.
// ⚠️ These were 9.5pt all-caps kickers with 2.2 of letterspacing. That is the
// app's grammar for a MICRO-label — a word set beside a value — and it cannot
// carry a section: stacked four deep down a scroll it read as noise, and the
// sheet looked like features dropped in rather than a form with parts. A part's
// title is a title, so it is set in the serif at a size you actually read, and
// its rule runs the full width UNDER it so each part visibly opens.
function SectionHead({
  step,
  label,
  accent,
  first = false,
  major = false,
}: {
  step: number;
  label: string;
  accent: string;
  first?: boolean;
  /** Opens a new register rather than the next question — see the note above. */
  major?: boolean;
}) {
  return (
    <View style={[s.sectionHead, first && s.sectionHeadFirst, major && s.sectionHeadMajor]}>
      <View style={s.sectionHeadRow}>
        <View style={[s.stepSeat, { borderColor: withAlpha(accent, 0.34), backgroundColor: withAlpha(accent, 0.09) }]}>
          <Text style={[s.stepText, { color: accent }]}>{step}</Text>
        </View>
        <Text style={s.sectionHeadText} numberOfLines={1}>{label}</Text>
      </View>
      <View style={[s.sectionHeadRule, major && { backgroundColor: withAlpha(accent, 0.26) }]} />
    </View>
  );
}

// A part of a part: what opens the door, asked under Loose. It is indented to
// the numeral's text column so it reads as belonging to the answer above it,
// and it is a real ask — a title and the sentence that says why you are being
// asked — rather than a bare label floating over a grid.
function SubHead({ title, body }: { title: string; body: string }) {
  return (
    <View style={s.subHead}>
      <Text style={s.subHeadTitle}>{title}</Text>
      <Text style={s.subHeadBody}>{body}</Text>
    </View>
  );
}

// ── The words each choice answers with ────────────────────────────────────
// What the chosen side actually brings, said in full. Loose says three things
// in order: how long you get, what it costs, and what happens after.
//
// ⚠️ TWO words are struck, and they are the deal: the DURATION you get and the
// PRACTICE it costs. And the duration is a numeral — "15" is read at a glance
// where "fifteen" has to be read as a word, and this is the one figure on the
// card the eye should find first.
//
// Loose and Strict mean different things under a limit than under a block, so
// they are written per mode rather than once and hedged.
function looseDetail(mode: FocusRuleMode): OutcomeCopy {
  return mode === 'blocked'
    ? [
      'Loose opens the group for ',
      { struck: '15 minutes' },
      ' at a time. First you do one ',
      { struck: 'practice' },
      ' — chosen below — and when the minutes are up it closes again.',
    ]
    : [
      'Loose gives you ',
      { struck: '15 minutes more' },
      ' once the limit is spent. First you do one ',
      { struck: 'practice' },
      ' — chosen below — and when they are up the limit stands again.',
    ];
}

function strictDetail(mode: FocusRuleMode, sessionScoped: boolean): OutcomeCopy {
  const opens = sessionScoped ? 'your next Session' : 'tomorrow';
  return mode === 'blocked'
    ? ['Strict keeps the group shut until ', { struck: opens }, '. No practice opens it.']
    : [
      'Strict closes the group once the limit is spent, until ',
      { struck: opens },
      '. Nothing reopens it.',
    ];
}

// ── What the single apps have taken out of the group ───────────────────────
// The group's allowance is a purse the individual app rules are paid from, and
// `appLimitBounds` has always enforced that — the wheel simply refuses to cross
// it. But the sheet never showed the purse, so the boundary was only ever met
// as a refusal, after the user had already chosen a number. This states it up
// front. Nothing new is computed: both figures are already on screen elsewhere.
function LedgerSegment({
  left,
  width,
  color,
  index,
}: {
  left: number;
  width: number;
  color: string;
  index: number;
}) {
  const reduceMotion = useReducedMotion();
  const l = useSharedValue(reduceMotion ? left : 0);
  const w = useSharedValue(reduceMotion ? width : 0);

  useEffect(() => {
    const glide = { duration: 460, easing: Easing.out(Easing.cubic) };
    l.value = reduceMotion ? left : withTiming(left, glide);
    w.value = reduceMotion ? width : withTiming(width, glide);
  }, [l, left, reduceMotion, w, width]);

  const style = useAnimatedStyle(() => ({ left: l.value, width: Math.max(0, w.value) }));

  return (
    <Animated.View
      style={[
        s.ledgerSegment,
        // Alternating weight, because every app in a group shares one colour:
        // without it a row of claims reads as one long bar.
        { backgroundColor: color, opacity: index % 2 === 0 ? 1 : 0.72 },
        style,
      ]}
    />
  );
}

function AppsLedger({
  claims,
  allowance,
  accent,
}: {
  /** One entry per app that has taken minutes out of the group. */
  claims: { id: string; label: string; minutes: number }[];
  allowance: number;
  accent: string;
}) {
  const reduceMotion = useReducedMotion();
  const [railWidth, setRailWidth] = useState(0);
  const allocated = claims.reduce((sum, claim) => sum + claim.minutes, 0);
  const fraction = allowance > 0 ? Math.min(1, allocated / allowance) : 0;
  const left = Math.max(0, allowance - allocated);
  const full = left === 0 && allowance > 0;

  // Each claim takes its own span of the rail, laid end to end.
  const segments = useMemo(() => {
    let consumed = 0;
    return claims.map(claim => {
      const at = allowance > 0 ? consumed / allowance : 0;
      consumed += claim.minutes;
      return {
        id: claim.id,
        left: at,
        width: allowance > 0 ? Math.max(0, Math.min(1 - at, claim.minutes / allowance)) : 0,
      };
    });
  }, [allowance, claims]);

  const dialFraction = useSharedValue(reduceMotion ? fraction : 0);
  useEffect(() => {
    dialFraction.value = reduceMotion
      ? fraction
      : withTiming(fraction, { duration: 460, easing: Easing.out(Easing.cubic) });
  }, [dialFraction, fraction, reduceMotion]);

  return (
    <View style={s.ledger}>
      {/* The head reads like the board's capacity meter, one level down: a ring
          carrying the share spoken for, and the copy beside it. */}
      <View style={s.ledgerHead}>
        <AllowanceDial size={46} strokeWidth={3.5} fraction={fraction} accent={accent}>
          <Text style={[s.ledgerDial, { color: accent }]}>
            {Math.round(fraction * 100)}<Text style={s.ledgerDialUnit}>%</Text>
          </Text>
        </AllowanceDial>
        <View style={s.ledgerCopy}>
          <Text style={s.ledgerTitle} numberOfLines={1}>
            {full
              ? 'Every minute is spoken for'
              : `${formatMinutesShort(left)} still shared`}
          </Text>
          <Text style={s.ledgerBody} numberOfLines={2}>
            {claims.length === 0
              ? `No app has its own limit yet — all ${formatMinutesShort(allowance)} is shared.`
              : `${formatMinutesShort(allocated)} of the group’s ${formatMinutesShort(allowance)} is promised to ${claims.length} ${claims.length === 1 ? 'app' : 'apps'}.`}
          </Text>
        </View>
      </View>

      {/* THE PURSE, DIVIDED. This is the board's own rail read at group scale:
          there the day is split among groups, here a group is split among its
          apps. The unclaimed remainder is the track showing through, which is
          exactly what it is — minutes no single app has spoken for. */}
      <View style={s.ledgerRail} onLayout={event => setRailWidth(event.nativeEvent.layout.width)}>
        {railWidth > 0 && segments.map((segment, index) => (
          <LedgerSegment
            key={segment.id}
            left={segment.left * railWidth}
            width={segment.width * railWidth}
            color={accent}
            index={index}
          />
        ))}
        <LinearGradient
          colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0)']}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={s.ledgerSheen}
          pointerEvents="none"
        />
      </View>

      {/* The tally: the same parchment footer the board's meter carries, so the
          two read as one instrument at two scopes. */}
      <View style={s.tallyBand}>
        <TallyColumn label="Given" value={formatMinutesShort(allocated)} color={accent} emphasis />
        <View style={s.tallyDivider} />
        <TallyColumn
          label="Shared"
          value={formatMinutesShort(left)}
          color={full ? ROSE_INK : '#5C7A63'}
        />
        <View style={s.tallyDivider} />
        <TallyColumn label="Group" value={formatMinutesShort(allowance)} color="#2D2923" />
      </View>
    </View>
  );
}

// One figure of the tally: its name in small caps, the number beneath it.
function TallyColumn({
  label,
  value,
  color,
  emphasis = false,
}: {
  label: string;
  value: string;
  color: string;
  emphasis?: boolean;
}) {
  return (
    <View style={s.tallyColumn}>
      <Text style={s.tallyLabel} numberOfLines={1}>{label}</Text>
      <Text style={[s.tallyValue, emphasis && s.tallyValueEmphasis, { color }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// ── One app's own rule ─────────────────────────────────────────────────────
// What opens inside an app's card, and it asks exactly two things: what KIND of
// rule, and what happens when it ENDS. Both are answered by the same two
// controls the group above uses, and the one fact the rule owns sits between
// them on the same plate.
//
// Nothing here is hidden behind a further tap. An app has two settings; putting
// either behind a disclosure inside a card you have already opened is one door
// too many.
function AppRuleDrawer({
  app,
  rule,
  inheritedStrength,
  groupMinutes,
  accent,
  tintBg,
  sessionName,
  sessionScoped,
  onChange,
  onEditMinutes,
  nativeSelectionId,
  nativeAvailable,
}: {
  app: PreviewApp;
  rule: AppRule | null;
  inheritedStrength: Strength;
  /** The group's own allowance — what this app's minutes are a share of. */
  groupMinutes: number | null;
  accent: string;
  tintBg: string;
  sessionName?: string;
  sessionScoped: boolean;
  onChange: (rule: AppRule) => void;
  onEditMinutes: (rule: AppRule) => void;
  nativeSelectionId: string;
  nativeAvailable: boolean;
}) {
  // ⚠️ "Same as the group" is a READING, not a stored state: `AppRule.strength`
  // is a required field and the enforcement engine reads it as a concrete
  // value, so there is nothing to store an "inherit" in. It is said only while
  // the app's answer genuinely matches the group's, and it compares strength
  // alone — the return practice is the group's to set, and an app rule carries
  // whatever it was created with.
  const current: AppRule = rule ?? {
    appId: app.id,
    mode: 'limit',
    minutes: null,
    strength: inheritedStrength,
    practice: 'prayer',
    checkInMinutes: 15,
  };
  const mode: FocusRuleMode = current.mode === 'blocked' ? 'blocked' : 'limit';
  const matchesGroup = current.strength === inheritedStrength;

  const setMode = (next: FocusRuleMode) => {
    if (next === 'blocked') {
      onChange({ ...current, mode: next, minutes: null, checkInMinutes: null });
      return;
    }
    onChange({ ...current, mode: next, minutes: mode === 'limit' ? current.minutes : null });
  };

  return (
    <Animated.View entering={FadeIn.duration(180)} style={s.drawer}>
      {/* The same switch the group's rule is struck with — one decision, one
          control, wherever it is asked. */}
      <FocusRuleSwitch
        value={mode}
        accent={accent}
        tintBg={tintBg}
        onChange={setMode}
      />

      {/* The same plate the group carries, one size down: the allowance under a
          limit, the closed ring under a block. An app's rule and a group's rule
          are the same decision at two scopes, so they wear the same object. */}
      <RulePlate
        compact
        blocked={mode === 'blocked'}
        minutes={current.minutes}
        wholeMinutes={groupMinutes}
        accent={mode === 'blocked' ? ROSE : accent}
        fallbackLabel={app.name}
        sessionName={sessionName}
        checkInOn={current.checkInMinutes === 15}
        onToggleCheckIn={() => onChange({ ...current, checkInMinutes: current.checkInMinutes === 15 ? null : 15 })}
        onPress={mode === 'limit' ? () => onEditMinutes(current) : undefined}
      />

      {/* ⚠️ NOT behind a disclosure. This used to be a row you tapped to reveal
          the Loose/Strict switch — a second thing to open inside something you
          had already opened, hiding one of the only two settings an app has.
          It is simply here now. */}
      <View style={s.answerBlock}>
        <Text style={s.answerHead} numberOfLines={1}>
          {mode === 'blocked' ? 'When it opens' : 'When the limit ends'}
          {matchesGroup ? <Text style={s.inheritNote}>  ·  same as the group</Text> : null}
        </Text>
        <FocusStrengthSwitch
          value={current.strength}
          looseDetail={looseDetail(mode)}
          strictDetail={strictDetail(mode, sessionScoped)}
          onChange={strength => onChange({ ...current, strength })}
        />
      </View>

      {nativeAvailable && (
        <NativeActivitySelectionButton
          selectionId={nativeSelectionId}
          title={`Choose ${app.name}`}
          label="Choose this app on iPhone"
        />
      )}
    </Animated.View>
  );
}

// ── One app, one card ──────────────────────────────────────────────────────
// A coloured plate carrying one app's rule: the group's own colour struck as a
// ribbon, the app's face cut into it, and the rule's two facts — how long, and
// what happens after — on a chip at the far end.
//
// ⚠️ The ground is built the way every beautiful card in this app is built: see
// the palette note in `AppRuleCard`. It is not white with a wash of colour over
// it, and it must not become that again.
//
// Two deliberate departures from the board's group card:
//   · the seat is a SQUIRCLE, not a disc, because a real iOS app icon goes in
//     it — a circle would crop the corners off every one of them;
//   · it is FLATTER. A board card is one of six on a whole screen; these stack
//     under a third of a sheet, so the padding above and below is cut.
function AppIconSeat({
  label,
  ground,
  edge,
  ink,
  quiet,
}: {
  label: string;
  ground: string;
  edge: string;
  ink: string;
  quiet: boolean;
}) {
  return (
    <View
      style={[
        s.appSeat,
        quiet
          // Stone, not a faded tint: an app following the group has no colour
          // of its own to show yet.
          ? s.appSeatQuiet
          : { backgroundColor: ground, borderColor: edge },
      ]}
    >
      {/* Cut in rather than raised: the icon will sit IN this, so the seat is a
          recess — shadow inside the top edge, light on the bottom lip. */}
      <View pointerEvents="none" style={s.appSeatWell} />
      <Text style={[s.appSeatText, { color: quiet ? '#9A9186' : ink }]}>
        {label.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function AppRuleCard({
  label,
  blocked,
  value,
  accent,
  strict,
  inherited = false,
  expanded = false,
  alwaysBlocked,
  onPress,
  children,
}: {
  label: string;
  blocked: boolean;
  value: string;
  /** The group's colour — the whole card is struck from it. */
  accent: string;
  /** What happens when this app's boundary is reached. */
  strict: boolean;
  /** True while the app has no rule of its own and simply follows the group. */
  inherited?: boolean;
  expanded?: boolean;
  alwaysBlocked?: boolean;
  onPress: () => void;
  /** The rule drawer, which opens inside the card so one app stays one object. */
  children?: React.ReactNode;
}) {
  // The value used to carry six different sentences in one grey serif — "Group
  // rule", "No limit", "Blocked", "Always", a number — so the list read as
  // evenly loud whether an app had been given a boundary or not. The colour
  // says which kind of answer it is before the word is read.
  const isLit = !inherited || blocked;
  const cardAccent = blocked ? ROSE : accent;

  // THE CARD IS A COLOURED OBJECT, NOT A WHITE ONE WITH A HINT OF COLOUR.
  //
  // ⚠️ Built the way every beautiful card in this app is built: in HSL, holding
  // hue and saturation and moving ONLY lightness. Mixing a colour toward white
  // drains it — the app's green falls from 72% saturation to 30% that way — and
  // that is exactly what a faint wash over white had been doing here.
  //
  // The figures are the Library ribbon's own, compressed for a 54pt row: a
  // three-stop diagonal from near-white at the shoulder to real colour at the
  // foot, a border at 78, and ink taken DOWN rather than a tint taken up.
  const palette = useFocusRibbonPalette(cardAccent);

  const valueColor = isLit ? palette.value : C.textMuted;

  return (
    <Animated.View
      layout={LinearTransition.duration(180)}
      style={[
        s.appCard,
        isLit
          ? { borderColor: palette.border }
          // An app with no rule of its own is not a dimmer version of one that
          // has: it is quiet on purpose. Parchment ground, colourless edge, a
          // shallower shadow — and that contrast is what lets a ruled card read
          // as a lit thing rather than as a slightly louder white one.
          : s.appCardQuiet,
      ]}
    >
      {isLit && (
        <>
          <LinearGradient
            colors={palette.gradient}
            locations={[0, 0.45, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {/* A pane of light gathered at the shoulder, drawn once and left
              still. ⚠️ It must run corner to corner and reach transparent well
              before any edge — a fading layer that stops mid-card rules a hard
              line across it as cleanly as if you had drawn one. */}
          <LinearGradient
            colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
            locations={[0, 0.55]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View pointerEvents="none" style={s.appCardLit} />
        </>
      )}
      <TouchableOpacity
        style={s.appCardRow}
        onPress={onPress}
        activeOpacity={0.74}
        haptic="selection"
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${label}, ${value}`}
      >
        <AppIconSeat
          label={label}
          ground={palette.inset}
          edge={palette.insetEdge}
          ink={palette.seatInk}
          quiet={inherited && !blocked}
        />
        <Text
          style={[s.appCardName, isLit ? { color: palette.name } : s.appCardNameQuiet]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {alwaysBlocked && <Lock s={12} c={ROSE} w={2.2} />}
        {/* The chip carries BOTH facts the rule holds: how long, and what
            happens when that is spent. The strength used to be invisible until
            you opened the card, so two apps set to the same minutes but
            opposite endings looked identical in the list. The door is the same
            object the Loose/Strict switch is struck from, at a third scale. */}
        <View
          style={[
            s.valueChip,
            isLit && { backgroundColor: palette.inset, borderColor: palette.insetEdge },
          ]}
        >
          {isLit && <Door shut={strict} size={15} />}
          <Text style={[s.valueChipText, { color: valueColor }]} numberOfLines={1}>{value}</Text>
        </View>
        {/* The chevron takes the card's own ink when the card is lit, so the
            row ends in the same colour it began. */}
        <Disclosure open={expanded} color={isLit ? palette.chevron : C.textMuted} />
      </TouchableOpacity>

      {children}
    </Animated.View>
  );
}

type DurationEditor =
  | { kind: 'group' }
  | { kind: 'app'; appId: string; label: string };

export default function GroupLimitSheet({
  rule,
  groupLabel,
  apps,
  planStrength,
  dailyTargetMinutes,
  allRules,
  onChange,
  onClose,
  sessionName,
  nativeSelectionBaseId,
}: {
  rule: GroupRule | null;
  groupLabel: string;
  apps: PreviewApp[];
  planStrength: Strength;
  dailyTargetMinutes: number | null;
  allRules: GroupRule[];
  onChange: (partial: Partial<GroupRule>) => void;
  onClose: () => void;
  sessionName?: string;
  nativeSelectionBaseId: string;
}) {
  const state = useDayPlan();
  const nativeAvailable = isNativeFocusAvailable();
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);
  const [newAppLabel, setNewAppLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [durationEditor, setDurationEditor] = useState<DurationEditor | null>(null);
  const mode = modeFor(rule);
  const alwaysBlockedIds = useMemo(() => new Set(state.alwaysBlockedApps.map(entry => entry.appId)), [state.alwaysBlockedApps]);
  // Memoised: it feeds the claims useMemo, and a fresh [] each render would
  // rebuild the rail's segments on every keystroke.
  const appRules = useMemo(() => rule?.appRules ?? [], [rule?.appRules]);

  // The sheet wears the colour of the CARD it was opened from, and that colour
  // says what the rule is: measured, or shut. ⚠️ It used to take the group's own
  // tint, which meant a sheet for a group whose tint happened to be red looked
  // blocked while it was merely limited. Identity is carried by the name in the
  // head and the face on the seal; state is carried by the colour. See
  // `RULE_TONES`.
  const tint = RULE_TONES.limit;
  const accent = tint.color;
  const visualAccent = mode === 'blocked' ? ROSE : accent;
  const groupBounds = useMemo(
    () => groupLimitBounds({
      dailyTargetMinutes,
      rules: allRules,
      groupId: rule?.groupId ?? '',
    }),
    [allRules, dailyTargetMinutes, rule?.groupId]
  );
  const groupAppAllocation = allocatedAppMinutes(appRules);
  // What each single app has taken out of the group's purse, in the order they
  // sit in the list — so a segment on the rail lines up with a card below it.
  const appClaims = useMemo(
    () => appRules
      .filter(entry => entry.mode !== 'blocked' && entry.minutes != null)
      .map(entry => ({
        id: entry.appId,
        label: entry.label?.trim() || entry.appId,
        minutes: entry.minutes as number,
      })),
    [appRules],
  );
  // A group you made yourself wears the face you chose; the built-in ones carry
  // theirs in the seal's own table. Neither: the dial falls back to the initial.
  const groupEmoji = groupIcon(state, rule?.groupId ?? '') ?? GROUP_EMOJI[rule?.groupId ?? ''];


  // What the head says under the name: the rule as it stands. Strength is left
  // off when there is no boundary for it to govern — a rule with no limit has
  // no ending to be strict or loose about.
  const headMeta = useMemo(() => {
    const bounded = mode === 'blocked' || rule?.dailyMinutes != null;
    const parts = [
      mode === 'blocked'
        ? 'Closed all day'
        : rule?.dailyMinutes != null
          ? `${formatMinutesShort(rule.dailyMinutes)} a day`
          : 'No limit yet',
    ];
    if (bounded && rule) parts.push(rule.strength === 'strict' ? 'Strict' : 'Loose');
    if (sessionName) parts.push(`in ${sessionName}`);
    return parts.join(' · ');
  }, [mode, rule, sessionName]);

  const setMode = (next: FocusRuleMode) => {
    if (!rule) return;
    if (next === 'limit') {
      onChange({
        mode: next,
        dailyMinutes: mode === 'limit' ? rule.dailyMinutes : null,
        strength: rule.strength ?? planStrength,
      });
      return;
    }
    onChange({
      mode: next,
      dailyMinutes: null,
      checkInMinutes: null,
      strength: rule.strength ?? planStrength,
    });
    setExpandedAppId(null);
  };

  const updateAppRule = (next: AppRule) => {
    onChange({ appRules: [...appRules.filter(entry => entry.appId !== next.appId), next] });
  };

  const addNativeAppRule = () => {
    const label = newAppLabel.trim();
    if (!label || !rule) return;
    const appId = createAppRuleId();
    updateAppRule({
      appId,
      label,
      mode: 'limit',
      minutes: null,
      strength: rule?.strength ?? planStrength,
      practice: 'prayer',
      checkInMinutes: 15,
    });
    setNewAppLabel('');
    setExpandedAppId(appId);
  };

  // The field closes behind a saved rule; the handler above is untouched.
  const submitAppRule = () => {
    if (!newAppLabel.trim()) return;
    addNativeAppRule();
    setAdding(false);
  };

  const durationAppRule = durationEditor?.kind === 'app'
    ? appRules.find(entry => entry.appId === durationEditor.appId) ?? null
    : null;
  const durationBounds = rule && durationEditor?.kind === 'app'
    ? appLimitBounds({
        dailyTargetMinutes,
        groupRule: rule,
        appId: durationEditor.appId,
      })
    : groupBounds;
  const durationValue = durationEditor?.kind === 'app'
    ? durationAppRule?.minutes ?? null
    : rule?.dailyMinutes ?? null;
  const durationParentLabel = durationEditor?.kind === 'app'
    ? mode === 'limit'
      ? `${groupLabel} group`
      : 'Daily Target'
    : 'Daily Target';
  const durationLowerReason = durationEditor?.kind === 'group'
    ? `Individual app limits already reserve ${formatMinutesShort(groupAppAllocation)}. Reduce them first.`
    : 'App limits start at 15 minutes.';
  const durationUpperReason = durationEditor?.kind === 'group'
    ? dailyTargetMinutes == null
      ? 'This is the maximum Focus allowance available in one rule.'
      : `Other groups already use ${formatMinutesShort(groupBounds.allocatedElsewhereMinutes)} of the Daily Target.`
    : durationBounds.parentMinutes == null
      ? 'This is the maximum Focus allowance available in one rule.'
      : `${formatMinutesShort(durationBounds.allocatedElsewhereMinutes)} is already assigned to other apps in this group.`;

  return (
    <>
      <SmoothBottomSheet
        visible={rule !== null}
        onClose={onClose}
        sheetStyle={s.sheet}
        overlayChildren={(
          <>
            <LimitDurationWheelSheet
              visible={durationEditor !== null}
              embedded
              // Just the subject: that sheet's head supplies "Time limit" and
              // sets this beneath it as "for <subject>".
              title={durationEditor?.kind === 'app' ? durationEditor.label : groupLabel}
              value={durationValue}
              defaultMinutes={durationEditor?.kind === 'app' ? 30 : 45}
              minimumMinutes={durationBounds.minimumMinutes}
              maximumMinutes={durationBounds.maximumMinutes}
              parentLabel={durationParentLabel}
              parentMinutes={durationBounds.parentMinutes}
              allocatedElsewhereMinutes={durationBounds.allocatedElsewhereMinutes}
              lowerBoundReason={durationLowerReason}
              upperBoundReason={durationUpperReason}
              accent={accent}
              onClose={() => setDurationEditor(null)}
              onSave={minutes => {
                if (durationEditor?.kind === 'app' && durationAppRule) {
                  updateAppRule({ ...durationAppRule, mode: 'limit', minutes });
                } else if (durationEditor?.kind === 'group') {
                  onChange({ mode: 'limit', dailyMinutes: minutes });
                }
              }}
              onSaveNoLimit={() => {
                if (durationEditor?.kind === 'app' && durationAppRule) {
                  updateAppRule({
                    ...durationAppRule,
                    mode: 'limit',
                    minutes: null,
                    checkInMinutes: null,
                  });
                } else if (durationEditor?.kind === 'group') {
                  onChange({ mode: 'limit', dailyMinutes: null, checkInMinutes: null });
                }
              }}
            />
          </>
        )}
      >
        <GestureHandlerRootView style={s.gestureRoot}>
          {/* The group's face rides in the head, so no card below has to
              repeat its name to say whose room this is. */}
          <FocusSheetHandle />
          {/* The pinned part of the head holds only what NAMES the sheet — the
              group, its rule and the close. The state line reads the content,
              so it travels with the content and scrolls away. */}
          <FocusCeremonialHead
            title={groupLabel}
            accent={visualAccent}
            onClose={onClose}
          />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
            <FocusHeadMeta meta={headMeta} accent={visualAccent} />

            {/* The first choice on the sheet, and the one that sets the tone:
                struck in the app's own two-kinds grammar rather than as a list,
                because Limit and Blocked are two different kinds of rule. */}
            <SectionHead step={1} label="Group rule" accent={visualAccent} first />
            <FocusRuleSwitch
              value={mode}
              accent={accent}
              tintBg={tint.bg}
              onChange={setMode}
            />

            {/* The one fact the rule owns, on the plate both scopes share.
                Under a limit it is the allowance; under a block it is the same
                instrument with its ring closed. */}
            {rule && (
              <RulePlate
                blocked={mode === 'blocked'}
                minutes={rule.dailyMinutes}
                wholeMinutes={dailyTargetMinutes}
                accent={visualAccent}
                emoji={groupEmoji}
                fallbackLabel={groupLabel}
                sessionName={sessionName}
                checkInOn={rule.checkInMinutes === 15}
                onToggleCheckIn={() => onChange({ checkInMinutes: rule.checkInMinutes === 15 ? null : 15 })}
                onPress={mode === 'limit' ? () => setDurationEditor({ kind: 'group' }) : undefined}
              />
            )}

            {rule && (
              <>
                <SectionHead
                  step={2}
                  label={mode === 'blocked' ? 'When it opens' : 'When the limit ends'}
                  accent={visualAccent}
                />
                <FocusStrengthSwitch
                  value={rule.strength}
                  looseDetail={looseDetail(mode)}
                  strictDetail={strictDetail(mode, !!sessionName)}
                  onChange={strength => onChange({ strength })}
                />

                {rule.strength === 'loose' && (
                  <Animated.View key="practice" entering={FadeIn.duration(200)} style={s.practiceBlock}>
                    {/* The card above already says a practice is what opens the
                        door, so this asks WHICH — and says what choosing well
                        depends on, which is whether you will actually do it. */}
                    <SubHead
                      title="Choose the practice"
                      body="This is what stands between you and the extra minutes. Pick the one you will actually do."
                    />
                    <ReturnPracticeGrid
                      value={rule.practice}
                      accent={accent}
                      onChange={practice => onChange({ practice })}
                    />
                  </Animated.View>
                )}
              </>
            )}

            {/* A blocked group has nothing left to divide: every app in it is
                closed, so per-app allowances cannot exist. Everything under
                this head was already gated on the group having a limit, which
                left the head standing over an empty part. It goes with them. */}
            {mode === 'limit' && (
              <SectionHead step={3} label="Individual rules" accent={C.goldDark} major />
            )}

            {/* The purse the individual rules are paid from, stated before the
                list rather than met as a refusal inside the wheel. */}
            {mode === 'limit' && rule?.dailyMinutes != null && appRules.length > 0 && (
              <AppsLedger claims={appClaims} allowance={rule.dailyMinutes} accent={accent} />
            )}

            {nativeAvailable && (
              <NativeActivitySelectionButton
                selectionId={`${nativeSelectionBaseId}.group.${rule?.groupId ?? 'group'}`}
                title={`Choose apps for ${groupLabel}`}
                label="Choose apps on iPhone"
              />
            )}

            {/* App rules divide the group's own allowance, so they only stand
                while the group has one. */}
            {mode === 'limit' && nativeAvailable && (
              <>
                <View style={s.appStack}>
                  {appRules.map(appRule => {
                    const label = appRule.label?.trim()
                      || apps.find(app => app.id === appRule.appId)?.name
                      || 'Individual app';
                    const app: PreviewApp = {
                      id: appRule.appId,
                      name: label,
                      categoryId: rule?.groupId ?? 'custom',
                    };
                    const expanded = expandedAppId === appRule.appId;
                    const blocked = appRule.mode === 'blocked';
                    return (
                      <AppRuleCard
                        key={appRule.appId}
                        label={label}
                        blocked={blocked}
                        accent={accent}
                        strict={appRule.strength === 'strict'}
                        expanded={expanded}
                        inherited={!blocked && appRule.minutes == null}
                        value={blocked
                          ? 'Blocked'
                          : appRule.minutes == null
                            ? 'No limit'
                            : formatMinutesShort(appRule.minutes)}
                        onPress={() => setExpandedAppId(expanded ? null : appRule.appId)}
                      >
                        {expanded && (
                          <AppRuleDrawer
                            app={app}
                            rule={appRule}
                            inheritedStrength={rule?.strength ?? planStrength}
                            groupMinutes={rule?.dailyMinutes ?? null}
                            accent={accent}
                              tintBg={tint.bg}
                            sessionName={sessionName}
                            sessionScoped={!!sessionName}
                            nativeAvailable={nativeAvailable}
                            nativeSelectionId={`${nativeSelectionBaseId}.group.${rule?.groupId ?? 'group'}.app.${appRule.appId}`}
                            onChange={updateAppRule}
                            onEditMinutes={next => {
                              updateAppRule(next);
                              setDurationEditor({ kind: 'app', appId: next.appId, label });
                            }}
                          />
                        )}
                      </AppRuleCard>
                    );
                  })}
                </View>

                {/* A standing dashed text field is a web form, and it was the
                    one thing on this sheet that did not belong to the app. The
                    resting state is a register row now; the field arrives only
                    once you have said you want to write in it. */}
                {adding ? (
                  <Animated.View entering={FadeIn.duration(150)} style={[s.addRow, { borderColor: withAlpha(accent, 0.34) }]}>
                    <TextInput
                      value={newAppLabel}
                      onChangeText={setNewAppLabel}
                      onSubmitEditing={submitAppRule}
                      onBlur={() => { if (!newAppLabel.trim()) setAdding(false); }}
                      autoFocus
                      placeholder="Name the app"
                      placeholderTextColor={C.textMuted}
                      maxLength={28}
                      returnKeyType="done"
                      style={s.addInput}
                    />
                    <TouchableOpacity
                      style={[s.addButton, { backgroundColor: newAppLabel.trim() ? withAlpha(accent, 0.14) : '#F0EFEB' }]}
                      disabled={!newAppLabel.trim()}
                      onPress={submitAppRule}
                      haptic="selection"
                      accessibilityLabel="Add this app rule"
                    >
                      <Plus s={15} c={newAppLabel.trim() ? accent : C.textMuted} w={2.5} />
                    </TouchableOpacity>
                  </Animated.View>
                ) : (
                  <TouchableOpacity
                    style={s.addSeat}
                    onPress={() => setAdding(true)}
                    haptic="selection"
                    activeOpacity={0.74}
                    accessibilityRole="button"
                    accessibilityLabel="Add an app rule"
                  >
                    {/* Gold, with this part's numeral: it is the one thing here
                        you go and DO, and it keeps the gold from being a single
                        stray mark on the sheet. */}
                    <View style={[s.addSeal, { backgroundColor: withAlpha(C.goldDark, 0.1), borderColor: withAlpha(C.goldDark, 0.28) }]}>
                      <Plus s={14} c={C.goldDark} w={2.5} />
                    </View>
                    <Text style={s.addSeatText}>Add an app rule</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {mode === 'limit' && !nativeAvailable && apps.length > 0 && (
              <View style={s.appStack}>
                {apps.map(app => {
                  const appRule = appRules.find(entry => entry.appId === app.id) ?? null;
                  const expanded = expandedAppId === app.id;
                  const alwaysBlocked = alwaysBlockedIds.has(app.id);
                  const blocked = alwaysBlocked || appRule?.mode === 'blocked';
                  return (
                    <AppRuleCard
                      key={app.id}
                      label={app.name}
                      blocked={blocked}
                      accent={accent}
                      strict={(appRule?.strength ?? rule?.strength ?? planStrength) === 'strict'}
                      expanded={expanded}
                      inherited={!blocked && !alwaysBlocked && (appRule == null || appRule.minutes == null)}
                      alwaysBlocked={alwaysBlocked}
                      value={alwaysBlocked
                        ? 'Always'
                        : appRule?.mode === 'blocked'
                          ? 'Blocked'
                          : appRule?.minutes != null
                            ? formatMinutesShort(appRule.minutes)
                            : appRule
                              ? 'No limit'
                              : 'Group rule'}
                      onPress={() => setExpandedAppId(expanded ? null : app.id)}
                    >
                      {/* ⚠️ No Always Blocked action here. Always Blocked is a
                          standing boundary that outlives this plan, so it is set
                          in its own sheet from the board — putting it inside a
                          plan's app rule made a permanent decision look like a
                          setting of this plan. An app already carrying it shows
                          "Always" and has nothing to change here. */}
                      {expanded && !alwaysBlocked && (
                        <AppRuleDrawer
                          app={app}
                          rule={appRule}
                          inheritedStrength={rule?.strength ?? planStrength}
                          groupMinutes={rule?.dailyMinutes ?? null}
                          accent={accent}
                          tintBg={tint.bg}
                          sessionName={sessionName}
                          sessionScoped={!!sessionName}
                          nativeAvailable={false}
                          nativeSelectionId={`${nativeSelectionBaseId}.group.${rule?.groupId ?? 'group'}.app.${app.id}`}
                          onChange={updateAppRule}
                          onEditMinutes={next => {
                            updateAppRule(next);
                            setDurationEditor({ kind: 'app', appId: next.appId, label: app.name });
                          }}
                        />
                      )}
                    </AppRuleCard>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </GestureHandlerRootView>
      </SmoothBottomSheet>

    </>
  );
}

const s = StyleSheet.create({
  gestureRoot: { flexGrow: 0, flexShrink: 1, width: '100%' },

  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 24, maxHeight: '93%' },
  // 9 so the state line keeps the same gap under the head's rule that it had
  // when it was part of the head; `FocusHeadMeta` carries the rest.
  scrollContent: { paddingTop: 9, paddingBottom: 30, gap: 10 },

  // ── Rows ─────────────────────────────────────────────────────────────────
  // The gap ABOVE a numbered head is the sheet's largest, and by a wide margin:
  // `scrollContent` puts 10 between everything, so a part starts on 26 and the
  // three parts read as three rather than as one continuous scroll.
  // The gap above a part is the sheet's largest by a wide margin — everything
  // else in `scrollContent` is 10 apart, so a part opens on 28.
  sectionHead: { marginTop: 18, marginBottom: 2, marginLeft: 2 },
  sectionHeadFirst: { marginTop: 0 },
  // Crossing from what governs the whole group to what governs one app is a
  // bigger step than moving between the group's own two questions, so it is
  // given more air than the head above it.
  sectionHeadMajor: { marginTop: 28 },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // The numeral is where the room's colour lands.
  stepSeat: {
    width: 23,
    height: 23,
    borderRadius: 11.5,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    fontFamily: F.serif,
    fontSize: 13,
    lineHeight: 16,
    includeFontPadding: false,
    fontVariant: ['lining-nums', 'tabular-nums'],
  },
  // A title, in the serif and at reading size. Sentence case: the sheet already
  // has enough capitals.
  sectionHeadText: { flex: 1, minWidth: 0, fontFamily: F.serifSemiBold, fontSize: 19, lineHeight: 23, color: C.text },
  // Full width, under the whole head — a part opens on a line rather than
  // trailing off into one.
  sectionHeadRule: { marginTop: 9, height: StyleSheet.hairlineWidth, backgroundColor: '#E3DCCB' },

  // ⚠️ NOT indented. It was set at marginLeft 35 to line up with the section
  // title's text column, but that column starts past the numeral — so the ask
  // began halfway across the sheet while every card, track and grid around it
  // started at the left edge. Alignment to a neighbour is worth less than
  // alignment to the page. It stays lighter than a part's title, which is what
  // keeps it from reading as a fourth part.
  subHead: { marginTop: 6, marginLeft: 3, paddingRight: 8 },
  subHeadTitle: { fontFamily: F.serifSemiBold, fontSize: 18, lineHeight: 23, color: C.text },
  subHeadBody: { marginTop: 4, fontFamily: F.serif, fontSize: 15.5, lineHeight: 21, color: C.textSecondary },

  // ── The group's purse ────────────────────────────────────────────────────
  // The tally band bleeds to the card's edges, so this clips its overflow and
  // the band supplies the bottom padding itself.
  ledger: {
    overflow: 'hidden',
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#EAE5DA',
    backgroundColor: '#FFFEFB',
    paddingHorizontal: 13,
    paddingVertical: 11,
    gap: 10,
  },
  ledgerHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ledgerDial: { fontFamily: F.serifBold, fontSize: 15, lineHeight: 18, fontVariant: ['tabular-nums'] },
  ledgerDialUnit: { fontFamily: F.serifMedium, fontSize: 9 },
  ledgerCopy: { flex: 1, minWidth: 0 },
  ledgerTitle: { fontFamily: F.serifSemiBold, fontSize: 17, lineHeight: 21, color: C.text },
  ledgerBody: { marginTop: 2, fontFamily: F.serif, fontSize: 13.5, lineHeight: 18, color: C.textSecondary },
  // Deeper than the old 7pt hairline: it now carries a claim per app and has to
  // read as a divided thing rather than as a progress line.
  ledgerRail: {
    position: 'relative',
    height: 12,
    borderRadius: 6,
    borderCurve: 'continuous',
    backgroundColor: '#EFEADC',
    overflow: 'hidden',
    boxShadow: 'inset 0 1px 2.5px rgba(63, 52, 30, 0.09)',
  },
  // Inset by 2 top and bottom, so each claim reads as a bar laid IN the track
  // rather than as the track itself changing colour.
  ledgerSegment: { position: 'absolute', top: 2, bottom: 2, borderRadius: 4, borderCurve: 'continuous' },
  ledgerSheen: { position: 'absolute', left: 0, right: 0, top: 0, height: 7 },
  // The board's meter footer, at group scale: a solid parchment strip bled to
  // the card's edges, each figure set under its name.
  tallyBand: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginHorizontal: -13,
    marginBottom: -11,
    marginTop: 1,
    paddingVertical: 9,
    paddingHorizontal: 10,
    backgroundColor: '#F4EBD2',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2D2AC',
  },
  tallyColumn: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  tallyDivider: { width: StyleSheet.hairlineWidth, marginVertical: 4, backgroundColor: 'rgba(139,107,47,0.24)' },
  tallyLabel: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.3, textTransform: 'uppercase', color: '#8F8060' },
  tallyValue: { fontFamily: F.serifBold, fontSize: 17, lineHeight: 21, fontVariant: ['tabular-nums'] },
  tallyValueEmphasis: { fontSize: 18.5, lineHeight: 22 },
  practiceBlock: { gap: 9 },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  rowFlush: { minHeight: 52, paddingHorizontal: 0, paddingVertical: 4 },
  rowLabel: { flex: 1, minWidth: 0, fontFamily: F.serifSemiBold, fontSize: 16.5, lineHeight: 20, color: C.text },
  rowValue: {
    flexShrink: 0,
    maxWidth: 128,
    fontFamily: F.serifSemiBold,
    fontSize: 15.5,
    lineHeight: 19,
    color: C.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  // ── Apps ─────────────────────────────────────────────────────────────────
  appStack: { gap: 7 },
  // The board's group card at sheet scale: same radius family, same ground,
  // same shadow — but 5 of vertical padding instead of 7, and a 44 row instead
  // of 48, because these stack inside a third of a sheet.
  // ⚠️ Dimensions are settled — 18 radius, 11/5 padding, a 44 row. The ground
  // is what changed; leave the measurements alone.
  appCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 11,
    paddingVertical: 5,
    // ⚠️ NO SHADOW, AND IT CANNOT HAVE ONE.
    //
    // This view must clip its own contents — the gradient fills it corner to
    // corner and the drawer bleeds to its edges, and both have to be cut to the
    // rounded corners. `overflow: 'hidden'` does that, but it also masks the
    // layer, which CLIPS ANY SHADOW the same view casts. What survives is a
    // smear along the bottom that stops dead at the left and right edges, and
    // the sheet's own side padding then reads as a frame laid over it.
    //
    // A shadow here would have to live on a wrapper view outside the clip. It
    // is not worth it: the card is already a raised object by its coloured
    // ground, its lit top edge and its border, and a list of these stacked 7
    // apart does not want shadows bleeding onto each other anyway.
  },
  // White, on colour: the light along the top edge of a raised plate.
  appCardLit: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  // The quiet card, held one clear step below a lit one on every axis: ground,
  // edge and shadow.
  appCardQuiet: {
    borderColor: '#EFEAE0',
    backgroundColor: '#FDFCF8',
  },
  appCardRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  appCardName: { flex: 1, minWidth: 0, fontFamily: F.serifSemiBold, fontSize: 16, lineHeight: 20, letterSpacing: -0.15, color: C.text },
  appCardNameQuiet: { color: '#57534E' },
  // A SQUIRCLE, not a disc: a real iOS app icon goes in here, and a circle
  // would crop the corners off every one of them. 10 on 34 is iOS's own
  // corner-to-side ratio.
  appSeat: {
    flexShrink: 0,
    width: 34,
    height: 34,
    borderRadius: 10,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  appSeatQuiet: { backgroundColor: '#F3F1EC', borderColor: '#E4DFD4' },
  // Cut in, so the icon reads as sitting IN the seat rather than on it.
  appSeatWell: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
    borderCurve: 'continuous',
    boxShadow: 'inset 0 1.5px 3px rgba(72, 60, 35, 0.14), inset 0 -1px 0 rgba(255, 255, 255, 0.7)',
  },
  appSeatText: { fontFamily: F.serifSemiBold, fontSize: 14 },
  valueChip: {
    flexShrink: 0,
    minWidth: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 11,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E7E2D6',
    backgroundColor: '#F4F2EC',
    paddingHorizontal: 9,
    paddingVertical: 5,
    alignItems: 'center',
  },
  // 15, not 14: the chip carries the one value the card is about.
  valueChipText: { fontFamily: F.serifSemiBold, fontSize: 15, lineHeight: 18, fontVariant: ['tabular-nums'] },
  // The second question, standing open. Its head is a plain line rather than a
  // numbered section: this is inside one app's card, and a numeral here would
  // compete with the sheet's own three parts.
  answerBlock: { marginTop: 2, gap: 8 },
  answerHead: { marginLeft: 2, fontFamily: F.serifSemiBold, fontSize: 15.5, lineHeight: 20, color: C.text },
  inheritNote: { fontFamily: F.serif, fontSize: 13.5, color: C.textMuted },

  // The drawer opens INSIDE its app's card, so one app stays one object. It
  // bleeds to the card's edges and is separated from the row above by a single
  // hairline — no border or shadow of its own, or it would read as a second
  // card nested in the first.
  drawer: {
    marginHorizontal: -11,
    marginBottom: -5,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 12,
    // ⚠️ SOLID WHITE, and this is what keeps the whole sheet legible.
    //
    // The card's coloured ribbon is right for a closed row — it makes an app
    // with a boundary read as a lit object at a glance. But the settings that
    // open inside it are themselves coloured plates, and a coloured plate on a
    // coloured ground has nothing to lift off: the plate below the selector
    // simply dissolved into the card behind it.
    //
    // Rather than dulling the card or reworking every plate for contrast, the
    // page that opens is plain white. The cover stays coloured, the page inside
    // it does not, and every plate that lands on it keeps the contrast it was
    // designed against.
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.75)',
    gap: 9,
  },

  // The resting state: a register row, not a form.
  addSeat: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#EAE5DA',
    backgroundColor: '#FFFEFB',
    paddingHorizontal: 13,
  },
  addSeal: {
    flexShrink: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSeatText: { flex: 1, minWidth: 0, fontFamily: F.serifSemiBold, fontSize: 15.5, color: C.textSecondary },
  addRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    backgroundColor: '#FFFEFB',
    paddingLeft: 14,
    paddingRight: 7,
  },
  addInput: { flex: 1, minHeight: 48, fontFamily: F.serifSemiBold, fontSize: 15.5, color: C.text },
  addButton: { width: 36, height: 36, borderRadius: 12, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },

});
