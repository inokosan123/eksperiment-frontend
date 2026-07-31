import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import ConfirmModal from '@/components/shared/ConfirmModal';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import PantocratorAboutSheet from '@/components/prayer/PantocratorAboutSheet';
import { PantocratorPanel, PrayerLamp, PrayerNiche, panelWidth } from '@/components/prayer/PantocratorIcon';
import PrayerFocusSwitch, { type PrayerFocus } from '@/components/prayer/PrayerFocusSwitch';
import StandingCross, { CROSS_ASPECT } from '@/components/prayer/StandingCross';
import PrayerReadout, { PrayerReadoutLight } from '@/components/prayer/PrayerReadout';
import { useIgnition } from '@/components/prayer/prayerMotion';
import PrayerRoom from '@/components/prayer/PrayerRoom';
import PrayerStartHalo from '@/components/prayer/PrayerStartHalo';
import { useAppSettings } from '@/components/settings/SettingsContext';
import { ArrowLeft, CheckSmall, ChevronDown, ChevronRight, OpenBook, OrthodoxCross, Pause, Play, RotateCcw, X } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// These are static, expensive native/SVG/image subtrees. Their SharedValue
// props keep animating on the UI thread without React needing to visit them
// again when the clock, running state, or a modal changes.
const StablePrayerRoom = React.memo(PrayerRoom);
const StablePrayerLamp = React.memo(PrayerLamp);
const StablePrayerNiche = React.memo(PrayerNiche);
const StableStandingCross = React.memo(StandingCross);
const StablePantocratorPanel = React.memo(PantocratorPanel);
const StablePrayerFocusSwitch = React.memo(PrayerFocusSwitch);
const StablePrayerStartHalo = React.memo(PrayerStartHalo);
const StablePantocratorAboutSheet = React.memo(PantocratorAboutSheet);
const StableConfirmModal = React.memo(ConfirmModal);

const EXIT_CONFIRM_ICON = <ArrowLeft s={22} c={C.red} />;
const FINISH_CONFIRM_ICON = <CheckSmall s={22} c={C.gold} w={2.5} />;

/* ─────────────────────────────────────────────────────────────
 * MY RULE — the screen you pray on.
 *
 * It used to be a stopwatch: a large dial, the elapsed time inside it,
 * and a small animated book. That is a fine instrument and it is the
 * wrong object, because the thing you are doing while it runs is not
 * timing something. The timer is the least of what happens here.
 *
 * So the centre is now the SINAI PANTOCRATOR — the oldest surviving
 * icon of Christ, painted in hot wax in the sixth century and kept in
 * the Sinai desert ever since. It is here as the oldest face, which is
 * a thing every Christian tradition can stand in front of, and the
 * About sheet under it is what makes that framing explicit rather than
 * assumed: history and craft, told so it is useful to anyone.
 *
 * THE ORDER OF THE SCREEN, TOP TO BOTTOM
 *
 *   the title
 *   the epigraph    "pray without ceasing" — never dimmed, in any state
 *   the object      the cross or the icon, given all the room left over
 *   About the icon  the icon's own footnote, directly beneath it
 *   the seat        the switch and the reading, sharing one fixed height
 *   the controls    reset · start/pause · finish, on the floor
 *
 * ⚠ THE CONTROLS ARE THE LAST ROW, with nothing under them but the home
 * indicator's inset. They were lowered by MOVING WHAT WAS BELOW THEM
 * ABOVE THEM — the reading and the About door both belong further up —
 * rather than by shaving margins, which is what had been tried before
 * and did not work.
 *
 * THE THREE PHASES
 *
 *   IDLE     no reading on the screen at all. A row of zeroes is a
 *            stopwatch waiting; this screen offers a choice instead.
 *   RUNNING  the reading at full size, the switch withdrawn, the object
 *            grown, the room dark at its edges.
 *   PAUSED   the reading small, the switch back, the object small. The
 *            reading giving up its room is what lets the switch return,
 *            so you can change what you are praying in front of and go
 *            on.
 *
 * ⚠ WHAT PRESSING START DOES, AND WHAT IT NO LONGER DOES.
 *
 * It used to draw LINES: hoops turning round the object and round the
 * clock. They were the best drawing on the screen and they were the
 * wrong instinct — a thing that moves asks to be watched, and this is a
 * screen you are meant to be looking THROUGH rather than at.
 *
 * What happens instead is light and scale, all on one ignition:
 *
 *   the switch    steps back, and is gone by 62% of the way
 *   the reading   rises into its place from 34%, so the two overlap by a
 *                 quarter and read as ONE gesture rather than a crossfade
 *   the object    grows into its full size
 *   the room      darkens at its edges (PrayerRoom)
 *   the lamp      comes up behind the object
 *   the button    is struck like a bell and then breathes
 *
 * Nothing counts, nothing ticks, nothing travels.
 *
 * ⚠ AND NOTHING IS EVER LAID OUT TWICE. Every row that can empty — the
 * About door, the switch, the reading — keeps its height whether it is
 * showing or not, and its occupants are absolute inside it. That single
 * decision is what makes this screen feel smooth; the easing is only
 * what makes it feel considered.
 *
 * ⚠ THE GROUND IS WARM, NOT WHITE. A low warm glow over pure white
 * reads as a stain; over warm paper it reads as light. And the room's
 * shadow is warm for the same reason — a neutral darkening reads as the
 * phone dimming, which is a fault rather than a mood.
 * ───────────────────────────────────────────────────────────── */

const QUOTE = '"Pray without ceasing."';
const QUOTE_REF = '1 Thessalonians 5:17';

/** Warm paper, so the lamp has something to be light against. */
const GROUND = ['#FFFDF9', '#FDF8EF', '#FAF3E6'] as const;

/**
 * How small the cross or the icon stands before the prayer begins.
 *
 * ⚠ IT IS A DOWNSCALE, NOT AN UPSCALE, and the direction is the whole
 * decision. The object is rendered at its RUNNING size, so at rest it is
 * being sampled down — which is crisp — and the running state lands on
 * exactly 1, the image's own resolution. Drawn small and grown instead,
 * the state you actually pray in would be the blurred one.
 *
 * ⚠ 0.84 RATHER THAN THE 0.88 IT STOOD AT, which is the only way this
 * object can be made to GROW MORE without ever being drawn above its own
 * resolution. The running state has to land on exactly 1 — it is the one
 * you pray in, and it must be the sharp one — so a bigger arrival is
 * bought by starting smaller, never by finishing larger.
 *
 * Still not dramatic: this is a prayer beginning, not a card flipping.
 * The change has to be felt more than watched.
 */
const REST_SCALE = 0.84;

/**
 * How far the object SINKS as the prayer begins.
 *
 * ⚠ IT MOVES INTO ROOM THAT HAS JUST BEEN VACATED, which is the whole
 * justification. Starting a prayer empties the screen underneath the
 * object — the About door goes, the switch steps back — and an object
 * that grows while everything below it withdraws should settle into that
 * space rather than hold its mark and let a gap open under it.
 *
 * It is also what lets the object be BIGGER while running than the
 * resting layout could hold: the growth goes downward into the freed
 * row instead of upward into the epigraph.
 */
const OBJECT_DROP = 18;

/**
 * How small the reading stands when the prayer is paused.
 *
 * Same rule as the object, for the same reason: the figures are laid out
 * at their RUNNING size and sampled down here, so the state you actually
 * pray in is type at its own size rather than type enlarged. It also
 * means the shrink is what frees the room the switch comes back into,
 * which is exactly what it should look like.
 */
const READING_REST_SCALE = 0.52;

/**
 * The seat the switch and the reading share, and how they sit in it.
 *
 * `height` is fixed and reserved always — see the note on `switchStyle`.
 * The other two are the PAUSED arrangement: how far the switch rises
 * when a reading is present beneath it, and how far that reading sits
 * below centre while it is small. Both go to zero at the ends of the
 * range, where each occupant is alone and centred.
 *
 * ⚠ THEY ARE SHARES OF THE SEAT, NOT POINTS. Fixed offsets were tried
 * and the compact seat pushed the switch four points off its own top
 * edge — invisible on the phone this was written on, obvious on a small
 * one. Proportions cannot fall out of the box when the box changes.
 */
const SEAT = { height: 104, compactHeight: 100, liftShare: 0.22, dropShare: 0.29 } as const;

/**
 * How far the deck stands off the floor, ON TOP OF the home indicator's
 * own inset.
 *
 * ⚠ SMALL ON PURPOSE. The controls being the last row on the screen is
 * the arrangement this screen was built toward, and a deck floated well
 * up the page turns back into a toolbar. Ten points is the difference
 * between a plate resting ON the floor and one that has the floor
 * underneath it — enough that the pill's own shadow has somewhere to
 * fall, which is what was missing.
 *
 * It is paid for by the object, which is the only thing here that
 * flexes, so it is deliberately half as much on a short phone where the
 * object has nothing to spare.
 */
const DECK_LIFT = { normal: 10, compact: 5 } as const;

/* ── THE DECK, LIT ────────────────────────────────────────────────────
 *
 * ⚠ THE PLATE WAS PURE WHITE AND STAYED PURE WHITE WHILE THE PRAYER RAN,
 * which made it the brightest surface on the page at exactly the moment
 * the room was darkening everything else so the object could be the only
 * lit thing. The controls were out-shining the thing they serve.
 *
 * So the plate travels with the room: warm paper rather than white,
 * and its hairline turns from neutral ink to the lamp's own gold — the
 * app's lit edge, which every other lifted surface in it already wears.
 * It still stands clear of the ground beneath it; it simply stops being
 * a white card lying on an evening page.
 */
const DECK_PLATE = { rest: '#FFFFFF', lit: '#FFF9EF' } as const;
const DECK_EDGE = { rest: 'rgba(28,25,23,0.06)', lit: 'rgba(197,160,89,0.34)' } as const;

/** Reset and Finish, in the same warm ink their labels are set in. */
const SMALL_INK = 'rgba(74,51,18,0.42)';

/** The About door's own ink — a shade deeper than the app's gold, so a
 *  serif at 14.5 on a warm plate reads without being shouted. */
const ABOUT_INK = '#7A5A22';

/** How far the About door keeps below the foot of the icon it belongs to. */
const ABOUT_GAP = 18;

export type PersonalPrayerRuleChoice = 'personal' | 'standard' | 'short' | 'seraphim';

const RULE_OPTIONS: { id: PersonalPrayerRuleChoice; label: string }[] = [
  { id: 'personal', label: 'My Rule' },
  { id: 'standard', label: 'Standard Rule' },
  { id: 'short', label: 'Shortened Rule' },
  { id: 'seraphim', label: 'Rule of Saint Seraphim' },
];

const RULE_DESCRIPTIONS: Record<PersonalPrayerRuleChoice, string> = {
  personal: 'For Christians of every tradition — Catholic, Protestant, Orthodox, non-denominational, and any other.',
  standard: 'Full prayer rule',
  short: 'Abbreviated prayer rule',
  seraphim: 'Rule of St. Seraphim of Sarov',
};

function isOrthodoxRule(rule: PersonalPrayerRuleChoice) {
  return rule !== 'personal';
}

const PERSONAL_RULE_THEMES = {
  morning: { accent: '#D97706', bg: '#FEF3C7', border: '#FDE68A' },
  evening: { accent: '#7C6EAF', bg: '#EDE9FE', border: '#C4B5FD' },
  default: { accent: C.gold, bg: '#FFFBEB', border: '#E8DCC4' },
};

type Props = {
  title?: string;
  prayerType?: string;
  isTask?: boolean;
  onBack: () => void;
  onComplete?: () => void | Promise<void>;
  selectedRule?: PersonalPrayerRuleChoice;
  onRuleChange?: (rule: PersonalPrayerRuleChoice) => void | Promise<void>;
};

function titleForPrayer(type?: string, title?: string) {
  if (title?.trim()) return title.trim();
  if (type === 'evening') return 'My Evening Rule';
  if (type === 'morning') return 'My Morning Rule';
  return 'My Rule';
}

function canSwitchPrayerRule(type?: string) {
  return type === 'morning' || type === 'evening';
}

function formatElapsed(totalSecs: number) {
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  if (hours > 0) {
    return {
      main: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      tail: String(seconds).padStart(2, '0'),
    };
  }

  return {
    main: String(minutes).padStart(2, '0'),
    tail: String(seconds).padStart(2, '0'),
  };
}

/**
 * Owns the one-second updates so the large icon, gradients, SVG room,
 * selector, controls, and modals do not rerender with the clock. The rendered
 * readout is intentionally identical to the former inline one.
 */
function PrayerTimerReadout({
  accent,
  bloom,
  compact,
  ignition,
  onFirstSecond,
  resetToken,
  running,
}: {
  accent: string;
  bloom: SharedValue<number>;
  compact: boolean;
  ignition: SharedValue<number>;
  onFirstSecond: () => void;
  resetToken: number;
  running: boolean;
}) {
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const accumulatedMsRef = useRef(0);
  const reportedElapsedRef = useRef(false);

  useEffect(() => {
    accumulatedMsRef.current = 0;
    reportedElapsedRef.current = false;
    setElapsedSecs(0);
  }, [resetToken]);

  useEffect(() => {
    if (!running) return;

    const startedAt = Date.now();
    const publish = () => {
      const next = Math.floor((accumulatedMsRef.current + Date.now() - startedAt) / 1000);
      if (next > 0 && !reportedElapsedRef.current) {
        reportedElapsedRef.current = true;
        onFirstSecond();
      }
      setElapsedSecs(current => current === next ? current : next);
    };
    const timer = setInterval(publish, 1000);

    return () => {
      clearInterval(timer);
      accumulatedMsRef.current += Date.now() - startedAt;
    };
  }, [onFirstSecond, running]);

  const hasHours = elapsedSecs >= 3600;
  const timeFont = hasHours ? (compact ? 38 : 44) : (compact ? 50 : 58);
  const display = formatElapsed(elapsedSecs);

  // How the figures are set, how they change places and how a minute
  // landing is marked all live in PrayerReadout. What stays here is the
  // one thing this component exists for: owning the second so the icon,
  // the room, the deck and the modals never rerender with the clock.
  return (
    <PrayerReadout
      accent={accent}
      bloom={bloom}
      ignition={ignition}
      main={display.main}
      tail={display.tail}
      timeFont={timeFont}
    />
  );
}

const StablePrayerTimerReadout = React.memo(PrayerTimerReadout);

const StablePrayerRuleSelector = React.memo(function PrayerRuleSelector({
  bottomInset,
  enabled,
  onClose,
  onRulePress,
  selectedRule,
  theme,
  visible,
}: {
  bottomInset: number;
  enabled: boolean;
  onClose: () => void;
  onRulePress: (rule: PersonalPrayerRuleChoice) => void;
  selectedRule: PersonalPrayerRuleChoice;
  theme: { accent: string; bg: string; border: string };
  visible: boolean;
}) {
  return (
    <Modal
      transparent
      visible={enabled && visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={s.selectorOverlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={[s.selectorSheet, { paddingBottom: bottomInset + 24 }]}>
          <View style={s.selectorHandle} />
          <View style={s.selectorHeader}>
            <Text style={s.selectorTitle}>Prayer Rule</Text>
            <TouchableOpacity
              onPress={onClose}
              style={s.selectorClose}
              activeOpacity={0.76}
            >
              <X s={17} c="#78716C" />
            </TouchableOpacity>
          </View>

          <View style={s.selectorList}>
            {RULE_OPTIONS.map(rule => {
              const active = rule.id === selectedRule;
              const showOrthodoxBadge = isOrthodoxRule(rule.id);

              return (
                <TouchableOpacity
                  key={rule.id}
                  onPress={() => onRulePress(rule.id)}
                  activeOpacity={0.78}
                  style={[
                    s.selectorOption,
                    active
                      ? { backgroundColor: theme.bg, borderColor: theme.border }
                      : s.selectorOptionInactive,
                  ]}
                >
                  <View style={s.selectorCopy}>
                    <Text style={[s.selectorOptionTitle, { color: active ? theme.accent : C.text }]}>
                      {rule.label}
                    </Text>
                    <Text style={s.selectorOptionSub}>{RULE_DESCRIPTIONS[rule.id]}</Text>
                  </View>
                  {(showOrthodoxBadge || active) && (
                    <View style={s.selectorOptionTrailing}>
                      {showOrthodoxBadge && (
                        <View style={s.selectorOrthodoxBadge}>
                          <OrthodoxCross s={11} c={theme.accent} w={1.35} />
                          <Text style={[s.selectorOrthodoxBadgeText, { color: theme.accent }]}>ORTH.</Text>
                        </View>
                      )}
                      {active && <CheckSmall s={18} c={theme.accent} />}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
});

export default function PersonalRuleTaskView({
  title,
  prayerType,
  isTask = false,
  onBack,
  onComplete,
  selectedRule = 'personal',
  onRuleChange,
}: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { height, width: screenWidth } = useWindowDimensions();
  const { settings, updateSettings } = useAppSettings();
  const focus: PrayerFocus = settings.prayerFocus === 'icon' ? 'icon' : 'cross';
  const [running, setRunning] = useState(false);
  const [hasElapsed, setHasElapsed] = useState(false);
  const [timerResetToken, setTimerResetToken] = useState(0);
  const [showExit, setShowExit] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [showRuleSelector, setShowRuleSelector] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  // What the icon actually has to stand in, measured rather than guessed:
  // this screen carries a title bar, sometimes a rule pill, an epigraph, a
  // readout, a control deck and a door, and no constant survives all the
  // combinations of those across every phone.
  const [iconRoom, setIconRoom] = useState({ width: 0, height: 0 });
  const finishLockRef = useRef(false);
  // One value lights the object, the room, the reading and the button.
  const { ignition, animateIgnition } = useIgnition(running);
  // 0 = the cross is standing, 1 = the icon is. The exchange between them
  // is the one animation on this screen that has to be worth watching.
  const swap = useSharedValue(focus === 'icon' ? 1 : 0);
  const focusIntentRef = useRef<PrayerFocus>(focus);
  // The slow breath in the button's light.
  const breath = useSharedValue(0);
  // A minute turning over. ⚠ Owned here rather than inside the reading,
  // because the light under the reading swells with it and that light is
  // the reading's SIBLING — see PrayerReadout. One value, two readers.
  const bloom = useSharedValue(0);
  /**
   * THE THREE PHASES, IN TWO VALUES.
   *
   *   IDLE     nothing begun. No reading on the screen at all — a row of
   *            zeroes is a stopwatch waiting, and this screen should be
   *            offering a choice instead. `reveal` 0, `ignition` 0.
   *   RUNNING  the reading at full size, the switch withdrawn, the object
   *            grown. `reveal` 1, `ignition` 1.
   *   PAUSED   the reading small, the switch back, the object small. The
   *            reading SHRINKING is what makes the room the switch
   *            returns into. `reveal` 1, `ignition` 0.
   *
   * Everything on the screen reads its state off this pair rather than
   * off React, so nothing can be a frame out of step with anything else.
   */
  const timerShown = running || hasElapsed;
  const reveal = useSharedValue(timerShown ? 1 : 0);
  /** 0 → 1 once each time the prayer is started. The bell. */
  const strike = useSharedValue(0);

  const isCompactHeight = height < 720;
  const theme = prayerType === 'evening'
    ? PERSONAL_RULE_THEMES.evening
    : prayerType === 'morning'
      ? PERSONAL_RULE_THEMES.morning
      : PERSONAL_RULE_THEMES.default;
  const selectedRuleOption = RULE_OPTIONS.find(rule => rule.id === selectedRule) ?? RULE_OPTIONS[0];
  /* THE OBJECT'S SIZE.
   *
   * ⚠ THIS IS THE SIZE IT TAKES WHILE THE PRAYER RUNS, and it is drawn at
   * this size always. At rest it is SCALED DOWN to `REST_SCALE`, never up
   * from a smaller one — which is the right way round for an image:
   * downsampling is crisp, upsampling is soft, and the running state is
   * the one that has to be perfect. Growing into full size is therefore
   * growing into the image's native resolution.
   *
   * The cross is 19% wider than the icon and they share this seat, so the
   * width budget is figured from the wider of the two.
   *
   * ⚠ THE HEIGHT BUDGET IS THE ROOM PLUS THE DROP, NOT THE ROOM. The
   * object is centred in its box and then SINKS by OBJECT_DROP while the
   * prayer runs, so an object exactly `2 × OBJECT_DROP` taller than the
   * box still has its head inside it — the whole of the overhang has gone
   * down into the row the About door just vacated, and none of it up into
   * the epigraph. That is what buys the extra size, and the arithmetic is
   * why the drop and the budget must be changed together.
   *
   * At rest the same object is at REST_SCALE, so what actually has to fit
   * the resting layout is 0.84 of this — which on every phone this app
   * runs on is comfortably inside the box.
   *
   * 412 is where the height stops mattering: past it the controls look
   * like they fell off the bottom of a tall phone.
   */
  const panelHeight = iconRoom.height > 0
    ? Math.max(150, Math.min(
      iconRoom.height + OBJECT_DROP * 2 - 8,
      (iconRoom.width * 0.66) / CROSS_ASPECT,
      412,
    ))
    : 0;
  // The pool reaches well outside whatever is standing in it; a glow that
  // stops at the object's edge is a rectangle of light, which is not what
  // a lamp makes.
  const lampSize = Math.min(screenWidth * 1.15, Math.round(panelWidth(panelHeight) * 2.4));
  // The pool under the reading. Wide enough that its own edge is always
  // off the sides of the seat — a light you can see the end of is a
  // shape, and this one has to be light.
  const readoutLightWidth = Math.round(Math.min(screenWidth * 1.02, 400));

  /**
   * THE CROSS STANDS A LITTLE LOWER THAN THE ICON, on purpose.
   *
   * Both objects are centred in the same box, and centred is where the
   * icon belongs — a painted board is an even rectangle and its geometric
   * middle is its optical one. A cross is not: its mass is the crossbar
   * and the head above it, all of it in the upper half, with a long bare
   * shaft under. Hung on the box's true centre it therefore reads as
   * riding high, which is the one thing an object standing in a room must
   * never look like.
   *
   * ⚠ A SHARE OF THE OBJECT, NOT A COUNT OF POINTS, and ⚠ NEVER MORE THAN
   * THE SLACK THE BOX ACTUALLY HAS. The object is sized to the room it is
   * given, so on a short phone it can already fill that room to within a
   * few points; a fixed drop would push the foot of the cross out of its
   * box and into the row beneath it, on exactly the phones with the least
   * room to give.
   */
  const crossDrop = Math.min(
    Math.round(panelHeight * 0.035),
    Math.max(0, Math.round((iconRoom.height - panelHeight) / 2)),
  );

  useEffect(() => {
    // Arriving is slower than leaving, and eases out rather than in and
    // out: a reading appearing should feel like it settles, and one
    // clearing should simply be gone.
    reveal.value = withTiming(timerShown ? 1 : 0, {
      duration: timerShown ? 520 : 340,
      easing: timerShown ? Easing.out(Easing.cubic) : Easing.inOut(Easing.quad),
    });
  }, [reveal, timerShown]);

  useEffect(() => {
    if (!running) return;
    if (reduceMotion) return;
    // Struck once, on the way up only. ⚠ Restarted from zero rather than
    // resumed: pressing start twice in quick succession should ring
    // twice, not carry on from where the last one had got to.
    strike.value = 0;
    strike.value = withTiming(1, { duration: 1300, easing: Easing.out(Easing.cubic) });
  }, [reduceMotion, running, strike]);

  useEffect(() => {
    if (!running || reduceMotion) {
      cancelAnimation(breath);
      breath.value = withTiming(0, { duration: 400 });
      return;
    }
    breath.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      -1,
      // Reversing rather than restarting: a breath that snaps back to
      // empty and swells again is a blink, not a breath.
      true,
    );
    return () => cancelAnimation(breath);
  }, [breath, reduceMotion, running]);

  useEffect(() => {
    if (focusIntentRef.current === focus) return;
    focusIntentRef.current = focus;
    // Long and even. A spring here would overshoot the exchange and snap
    // the incoming object into place, and this is not a control settling
    // — it is one thing giving way to another.
    swap.value = withTiming(focus === 'icon' ? 1 : 0, {
      duration: 560,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [focus, swap]);

  const handleFocusIntent = useCallback((next: PrayerFocus) => {
    focusIntentRef.current = next;
    // Start the already-designed object exchange directly. Waiting for the
    // settings context to persist and rerender the app was the visible pause.
    swap.value = withTiming(next === 'icon' ? 1 : 0, {
      duration: 560,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [swap]);

  const commitFocus = useCallback((next: PrayerFocus) => {
    updateSettings({ prayerFocus: next });
  }, [updateSettings]);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Anything presented over the screen answers back on its own —
      // every one of these is a real Modal with an onRequestClose. The
      // screen only has to keep out of the way, or closing the About
      // sheet would also ask you to abandon your prayer.
      if (showAbout || showExit || showFinish || showRuleSelector) return true;
      if (running) {
        setShowExit(true);
        return true;
      }
      return false;
    });

    return () => handler.remove();
  }, [running, showAbout, showExit, showFinish, showRuleSelector]);

  const onIconRoomLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setIconRoom(current => (
      Math.abs(current.width - width) < 1 && Math.abs(current.height - height) < 1
        ? current
        : { width, height }
    ));
  }, []);

  const handleReset = useCallback(() => {
    animateIgnition(false);
    setRunning(false);
    setHasElapsed(false);
    setTimerResetToken(token => token + 1);
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
  }, [animateIgnition]);

  const handleToggleRunning = useCallback(() => {
    const next = !running;
    // Same ignition timing/easing; it now begins before the React state commit
    // instead of one effect later.
    animateIgnition(next);
    setRunning(next);
  }, [animateIgnition, running]);

  const handleFirstSecond = useCallback(() => {
    setHasElapsed(true);
  }, []);

  const closeAbout = useCallback(() => setShowAbout(false), []);
  const closeExit = useCallback(() => setShowExit(false), []);
  const closeFinish = useCallback(() => setShowFinish(false), []);
  const closeRuleSelector = useCallback(() => setShowRuleSelector(false), []);

  const confirmExit = useCallback(() => {
    setShowExit(false);
    setRunning(false);
    onBack();
  }, [onBack]);

  const handleFinish = useCallback(async () => {
    if (finishLockRef.current) return;
    finishLockRef.current = true;
    animateIgnition(false);
    setRunning(false);
    if (Platform.OS !== 'web' && !isTask) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    await onComplete?.();
    onBack();
  }, [animateIgnition, isTask, onBack, onComplete]);

  const handleRulePress = useCallback((rule: PersonalPrayerRuleChoice) => {
    if (rule === selectedRule) {
      setShowRuleSelector(false);
      return;
    }
    animateIgnition(false);
    setRunning(false);
    setShowRuleSelector(false);
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    void onRuleChange?.(rule);
  }, [animateIgnition, onRuleChange, selectedRule]);

  const screenTitle = titleForPrayer(prayerType, title);
  const canSwitchRules = canSwitchPrayerRule(prayerType);

  // Resolved here, in plain numbers, because a worklet reading
  // `isCompactHeight` would be closing over React state on the UI thread.
  const seatHeight = isCompactHeight ? SEAT.compactHeight : SEAT.height;
  const seatLift = seatHeight * SEAT.liftShare;
  const seatDrop = seatHeight * SEAT.dropShare;

  // The button travels with it: ink at rest, the hour's colour running,
  // with a halo of its own light behind it while it does.
  const mainControlStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(ignition.value, [0, 1], [C.text, theme.accent]),
  }), [theme.accent]);
  // And the plate under all three travels with them — see DECK_PLATE. Two
  // colours on one existing animated pass; nothing here is laid out again.
  const deckPlateStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(ignition.value, [0, 1], [DECK_PLATE.rest, DECK_PLATE.lit]),
    /**
     * ⚠ AND THE EDGE BREATHES ONCE THE PRAYER IS RUNNING.
     *
     * Three things on this screen were lit and alive — the lamp behind
     * the object, the pool under the reading, the halo round the button —
     * and all three breathe on one shared value. The deck was the fourth
     * lit thing and the only still one, so the bottom of the screen read
     * as a photograph of a plate under three things that were breathing.
     *
     * ⚠ ON THE HAIRLINE ONLY, and only between two golds. Breathing the
     * plate's fill would be a surface changing brightness, which at this
     * size reads as a flicker; a lit edge gaining and losing a little
     * gold is a highlight moving on metal.
     */
    borderColor: interpolateColor(
      ignition.value * (0.72 + breath.value * 0.28),
      [0, 1],
      [DECK_EDGE.rest, DECK_EDGE.lit],
    ),
  }));
  /**
   * The button's modelling, arriving with the prayer.
   *
   * ⚠ IT IS HALF-STRENGTH AT REST AND WHOLE WHILE RUNNING, because the
   * same highlight does two different things depending on what is under
   * it. On the hour's colour it models a struck button; on near-black it
   * reads as gloss — a plastic dome, which is the one register this
   * screen cannot afford. Half of it on ink is a lit edge; all of it on
   * gold is a lit object.
   *
   * Layer opacity on one wrapper, so the sheen and the rim stay a single
   * static gradient and a single static border underneath it — nothing
   * here is redrawn per frame.
   */
  const mainGlossStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + ignition.value * 0.5,
  }));
  // The two glyphs cross-fade in place and pass each other vertically.
  // ⚠ No scale on the swap: this is a small view, and scaling small views
  // on Android resamples their bitmaps.
  const playGlyphStyle = useAnimatedStyle(() => ({
    opacity: 1 - ignition.value,
    transform: [{ translateY: ignition.value * -9 }],
  }));
  const pauseGlyphStyle = useAnimatedStyle(() => ({
    opacity: ignition.value,
    transform: [{ translateY: (1 - ignition.value) * 9 }],
  }));

  /* ── The exchange ──────────────────────────────────────────────────
   *
   * ⚠ THE TWO OBJECTS NEVER OVERLAP AT FULL STRENGTH, which is what
   * stops this from being a dissolve between two pictures. The one
   * leaving is gone by 55% of the way through; the one arriving does
   * not begin until 45%. For that tenth in the middle the lamp is
   * alone — and the lamp is flaring exactly then — so what you see is
   * a light with nothing in it yet, and then the other object rising
   * into it.
   *
   * Both move UPWARD throughout: the old one lifts away, the new one
   * rises from below into the same seat. Nothing sinks, so the two
   * movements read as one continuous gesture rather than as a swap.
   *
   * ⚠ Opacity and translateY only — no scale. These are large views,
   * but the rule that scaling resamples bitmaps on Android is not worth
   * testing on the one element the user called the important part.
   */
  const crossStyle = useAnimatedStyle(() => {
    const out = Math.min(1, swap.value / 0.55);
    return { opacity: 1 - out, transform: [{ translateY: crossDrop + out * -14 }] };
  }, [crossDrop]);
  const iconStyle = useAnimatedStyle(() => {
    const arrive = Math.max(0, (swap.value - 0.45) / 0.55);
    return { opacity: arrive, transform: [{ translateY: (1 - arrive) * 14 }] };
  });
  // The About door belongs to the icon — there is no sheet behind the
  // cross — but it stays MOUNTED either way, so the deck below never
  // changes height and the only thing that moves during the exchange is
  // the object itself.
  /* ── The About door, hung on the icon rather than on the page ───────
   *
   * ⚠ IT WAS SITTING AT THE BOTTOM OF THE ROOM, NOT UNDER THE ICON, and
   * on a tall phone those are sixty points apart. The object is CENTRED
   * in a box that flexes, so whenever the object is smaller than its box
   * all the slack gathers under its foot, and the door sat below the
   * slack. It read as a control belonging to the page instead of as the
   * icon's own footnote.
   *
   * So it is lifted by exactly the slack it is asked to cross, less the
   * gap it should keep. Measured from the object AT REST, which is the
   * only state it is ever seen in, so it holds at every size on every
   * phone; clamped at zero for the phones with no slack to give.
   *
   * ⚠ AND IT LEAVES WHEN THE PRAYER BEGINS. It is a door to seven pages
   * of history and craft — a thing to read before or after praying and
   * never during. Every other invitation on this screen withdraws at that
   * moment; the one that stayed was the one offering the longest detour.
   *
   * Gone by 45% of the ignition: what withdraws should be clear before
   * what replaces it settles, or the two read as a crossfade. It is also
   * why the door does not follow the object down as the object sinks and
   * grows — it is no longer on the screen by the time that finishes.
   */
  const aboutLift = Math.max(
    0,
    Math.round((iconRoom.height - panelHeight * REST_SCALE) / 2) - ABOUT_GAP,
  );

  const aboutStyle = useAnimatedStyle(() => {
    const out = Math.min(1, ignition.value / 0.45);
    return {
      opacity: Math.max(0, (swap.value - 0.45) / 0.55) * (1 - out),
      transform: [
        { translateY: -aboutLift },
        // It steps back as it goes, exactly as the switch does — fading
        // alone reads as switching off, where a shade smaller reads as
        // withdrawing.
        { scale: 1 - out * 0.06 },
      ],
    };
  }, [aboutLift]);

  /* ── What the start of a prayer does to the screen ──────────────────
   *
   * One value, four faces, and no line anywhere. The object GROWS into
   * its full size, the room darkens at its edges so the object is the
   * only lit thing on the page, the reading warms into the hour's colour
   * and the switch withdraws — you are not choosing what to pray in
   * front of any more, you are praying.
   */

  // ⚠ SCALED DOWN AT REST, NEVER UP WHILE RUNNING. The object is drawn at
  // its running size, so this only ever downsamples — which is crisp —
  // and the state that matters lands on exactly 1, the image's own
  // resolution. Growing from a smaller render would have meant praying in
  // front of an upscaled one.
  const objectStyle = useAnimatedStyle(() => ({
    transform: [
      // ⚠ THE SINK COMES BEFORE THE SCALE. Transforms compose in order,
      // so a translate written after a scale is a translate MEASURED IN
      // THE SCALED SPACE — the drop would arrive 16% shorter at rest than
      // running and the object would appear to travel on its own as the
      // scale eased. Written first, the eighteen points are eighteen
      // points throughout.
      { translateY: OBJECT_DROP * ignition.value },
      { scale: REST_SCALE + (1 - REST_SCALE) * ignition.value },
    ],
  }));

  /* ── THE SWITCH AND THE READING SHARE ONE SEAT ──────────────────────
   *
   * ⚠ AND THEY ARE BOTH ABSOLUTE INSIDE IT, WHICH IS THE WHOLE REASON
   * THIS SCREEN FEELS SMOOTH. The seat is a fixed height that never
   * changes, so a reading appearing, a switch withdrawing and the pair
   * rearranging around each other move NOTHING else: not the object
   * above, not the controls below, not the page. Nothing on this screen
   * is ever laid out twice. A transition whose easing is perfect but
   * which reflows the page underneath can never feel calm.
   *
   * Where each of them sits:
   *
   *   IDLE     switch alone, centred in the seat
   *   RUNNING  reading alone, centred, at full size
   *   PAUSED   switch lifted to the top of the seat, reading beneath it
   *            and small — the reading giving up its room is what lets
   *            the switch come back
   *
   * THE TWO MOVES ARE STAGGERED, not simultaneous. The switch is gone by
   * 62% of the ignition and the reading does not begin arriving until
   * 34%, so they overlap by a quarter and the eye reads one gesture —
   * something stepping back, and something else taking its place —
   * rather than two things crossfading.
   */
  const switchStyle = useAnimatedStyle(() => {
    const out = Math.min(1, ignition.value / 0.62);
    return {
      opacity: 1 - out,
      transform: [
        { translateY: -seatLift * reveal.value + out * 8 },
        // It steps back as well as away: a shade smaller reads as
        // withdrawing, where fading alone reads as switching off.
        { scale: 1 - out * 0.05 },
      ],
    };
  }, [seatLift]);

  const readingStyle = useAnimatedStyle(() => {
    const arrive = Math.max(0, (ignition.value - 0.34) / 0.66);
    return {
      opacity: reveal.value,
      transform: [
        // Below the switch when paused, centred when running.
        { translateY: seatDrop * (1 - arrive) },
        // ⚠ DRAWN LARGE AND SCALED DOWN, never up — the same rule the
        // object follows. The running state, which is the one you pray
        // in, lands on exactly 1 and is therefore type at its own size.
        { scale: READING_REST_SCALE + (1 - READING_REST_SCALE) * arrive },
      ],
    };
  }, [seatDrop]);

  return (
    <View style={s.screen}>
      <LinearGradient
        colors={GROUND}
        locations={[0, 0.55, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* The room closing in — see PrayerRoom. It sits over the paper and
          under everything else, so nothing legible is ever shadowed. */}
      <StablePrayerRoom ignition={ignition} />

      <ScreenTitleBar
        title={screenTitle}
        showBack
        onBackOverride={running ? () => setShowExit(true) : undefined}
        compactBottom
        bg="transparent"
      />

      {canSwitchRules && (
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setShowRuleSelector(true);
          }}
          activeOpacity={0.76}
          style={[s.readerRulePill, { borderColor: theme.border, backgroundColor: theme.bg }]}
        >
          <Text style={[s.readerRuleText, { color: theme.accent }]}>{selectedRuleOption.label}</Text>
          <ChevronDown s={13} c={theme.accent} w={2.2} />
        </TouchableOpacity>
      )}

      {/* ⚠ THE EPIGRAPH IS NOT DIMMED WHILE THE PRAYER RUNS. It was faded
          to a half-light on the reasoning that it had said its piece —
          which was wrong twice over: "pray without ceasing" is exactly
          the thing worth having in front of you WHILE you pray, and
          dimming type is how a screen tells you something has been
          disabled. It reads the same in both states.

          It steps aside entirely on a short phone, which is different:
          that is the one thing here that can go without breaking
          anything, and it costs the object fifty points it needs more. */}
      {!isCompactHeight && (
        <View pointerEvents="none">
          <Text style={s.quote}>{QUOTE}</Text>
          <Text style={s.quoteRef}>{QUOTE_REF}</Text>
        </View>
      )}

      {/* ── The object, in its light ────────────────────────────────── */}
      <View style={s.iconRoom} onLayout={onIconRoomLayout}>
        {panelHeight > 0 && (
          <Reanimated.View style={[s.stage, objectStyle]} pointerEvents="none">
            {/* ⚠ THE WALL, AND IT BELONGS TO THE ICON — see PrayerNiche.
                The icon is a dark painting and this page is bright paper;
                without a warm field gathered where it stands, its edges
                have nothing to dissolve into but cream and it fogs. The
                cross needs none of this and gets none: the niche arrives
                and leaves with the board, on the same `swap`. */}
            <StablePrayerNiche ignition={ignition} panelHeight={panelHeight} swap={swap} />

            {/* One lamp, behind both. It does not belong to either object
                — see PrayerLamp — because the whole point of the change
                is that the light stays lit and the thing in it changes. */}
            <StablePrayerLamp size={lampSize} light={ignition} swap={swap} />

            <Reanimated.View
              style={[s.stage, crossStyle]}
              shouldRasterizeIOS
              renderToHardwareTextureAndroid
            >
              <StableStandingCross height={panelHeight} />
            </Reanimated.View>
            <Reanimated.View
              style={[s.stage, iconStyle]}
              shouldRasterizeIOS
              renderToHardwareTextureAndroid
            >
              {/* No frame and no fade — see PantocratorPanel. It is a
                  panel of painted wood with a warm shadow under it, and
                  the niche behind is what it stands in. */}
              <StablePantocratorPanel height={panelHeight} />
            </Reanimated.View>
          </Reanimated.View>
        )}
      </View>

      {/* ── The door to the seven pages ──────────────────────────────
          ⚠ DIRECTLY UNDER THE ICON, which is where it was asked to be and
          where it belongs: it is the icon's own footnote, and down among
          the controls it read as a fourth control. It keeps its row
          whether the cross or the icon is standing, so the exchange
          between them moves nothing. */}
      <View style={s.aboutRow}>
        <Reanimated.View
          style={aboutStyle}
          pointerEvents={focus === 'icon' && !running ? 'auto' : 'none'}
        >
          <TouchableOpacity
            onPress={() => setShowAbout(true)}
            activeOpacity={0.76}
            haptic="selection"
            style={s.about}
            accessibilityRole="button"
            accessibilityLabel="About the icon"
            accessibilityElementsHidden={focus !== 'icon' || running}
            importantForAccessibility={focus === 'icon' && !running ? 'auto' : 'no-hide-descendants'}
          >
            {/* Struck from the app's own plate material — three stops on
                the diagonal from near-white at the shoulder to warm at the
                foot, under a lit hairline. It was a flat white pill at 60%
                over warm paper, which is the one surface finish this app
                does not use anywhere. */}
            <LinearGradient
              colors={['#FFFDF8', '#FBF3E2', '#F3E4C6']}
              locations={[0, 0.52, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View pointerEvents="none" style={s.aboutLit} />

            <OpenBook s={14} c={ABOUT_INK} w={1.6} />
            <Text style={s.aboutText}>About the icon</Text>
            {/* ⚠ It opens a seven-page sheet, and nothing about a label
                said so. The app's own arrow orb, at the size a footnote
                can carry. */}
            <View style={s.aboutChevron}>
              <ChevronRight s={11} c={ABOUT_INK} w={2.4} />
            </View>
          </TouchableOpacity>
        </Reanimated.View>
      </View>

      {/* ── The seat the switch and the reading share ────────────────
          Both absolute inside a height that never changes — see the note
          on `switchStyle`. This is the piece that keeps the whole screen
          still while its state changes. */}
      <View style={[s.seat, isCompactHeight && s.seatCompact]}>
        {/* ⚠ A SIBLING OF THE READING, NOT ITS CHILD — see PrayerReadout.
            The reading is scaled between its resting and running sizes by
            the seat, and a vector inside it would be scaled with it and
            resample on Android for the whole of every transition. It is
            invisible at rest, so it never has to be taken out. */}
        <PrayerReadoutLight
          bloom={bloom}
          breath={breath}
          ignition={ignition}
          tint={theme.accent}
          width={readoutLightWidth}
        />

        <Reanimated.View
          style={[s.seatItem, switchStyle]}
          pointerEvents={running ? 'none' : 'auto'}
        >
          <View style={s.switchWrap}>
            <StablePrayerFocusSwitch
              value={focus}
              onChange={commitFocus}
              onIntent={handleFocusIntent}
            />
          </View>
        </Reanimated.View>

        <Reanimated.View style={[s.seatItem, readingStyle]} pointerEvents="none">
          <StablePrayerTimerReadout
            accent={theme.accent}
            bloom={bloom}
            compact={isCompactHeight}
            ignition={ignition}
            onFirstSecond={handleFirstSecond}
            resetToken={timerResetToken}
            running={running}
          />
        </Reanimated.View>
      </View>

      {/* ── The controls, on the floor ────────────────────────────────
          ⚠ THE LAST ROW ON THE SCREEN, with nothing but the home
          indicator's own inset beneath it. Everything that used to sit
          under here — the reading, the About door — has moved up to where
          it belongs, which is what actually lowered these rather than
          shaving margins off them. */}
      <View
        style={[
          s.deck,
          {
            paddingBottom:
              Math.max(insets.bottom, 10)
              + (isCompactHeight ? DECK_LIFT.compact : DECK_LIFT.normal),
          },
        ]}
      >
        <Reanimated.View
          style={[s.controlsDeck, isCompactHeight && s.controlsDeckCompact, deckPlateStyle]}
        >
          {/* The pane of light along the shoulder that every lifted surface
              in this app wears. Inset well clear of the pill's own curve,
              so it reads as light lying on the plate rather than as a line
              trying and failing to follow its edge. */}
          <View pointerEvents="none" style={s.deckLit} />
          <TouchableOpacity
            onPress={handleReset}
            activeOpacity={0.78}
            style={[s.smallControl, isCompactHeight && s.smallControlCompact]}
          >
            <RotateCcw s={isCompactHeight ? 18 : 20} c={SMALL_INK} w={1.8} />
            <Text style={s.smallLabel}>Reset</Text>
          </TouchableOpacity>

          <View style={s.mainWrap}>
            {/* The strike, the standing ring and the pool — see
                PrayerStartHalo. It is drawn behind the button and takes
                no touches, so it can never steal the press it exists to
                celebrate. */}
            <StablePrayerStartHalo
              size={isCompactHeight ? 58 : 66}
              tint={theme.accent}
              ignition={ignition}
              breath={breath}
              strike={strike}
            />
            <TouchableOpacity
              onPress={handleToggleRunning}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel={running ? 'Pause' : 'Start'}
              style={[s.mainHit, isCompactHeight && s.mainHitCompact]}
            >
              <Reanimated.View
                style={[
                  s.mainControl,
                  isCompactHeight && s.mainControlCompact,
                  { shadowColor: theme.accent },
                  mainControlStyle,
                ]}
              >
                {/* ⚠ THE ONE FLAT SURFACE ON A SCREEN OF MODELLED ONES.
                    Everything else here is struck: the plates run three
                    stops on the diagonal, carry a pane of light and a lit
                    edge. This was a disc of solid colour, and at rest —
                    near-black on warm paper — it read as a hole in the
                    deck rather than as a button standing in it.

                    Light off the top, a foot in shadow, and a rim of light
                    all round. All of it WHITE AND BLACK AT LOW ALPHA, never
                    a tinted gradient, because the colour underneath it is
                    animated: the same modelling has to sit correctly on ink
                    at rest and on any of the three hours' colours running.
                    And all of it static, so the strike, the breath and the
                    colour keep the button to a single animated pass. */}
                <Reanimated.View
                  style={[StyleSheet.absoluteFill, mainGlossStyle]}
                  pointerEvents="none"
                >
                  <LinearGradient
                    colors={['rgba(255,255,255,0.24)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.12)']}
                    locations={[0, 0.52, 1]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={s.mainRim} />
                </Reanimated.View>

                {/* Both glyphs live on the button at once and pass each
                    other; a straight swap on React state was the one
                    thing on this screen that changed with no transition
                    at all. */}
                <Reanimated.View style={[s.mainGlyph, playGlyphStyle]}>
                  <Play s={isCompactHeight ? 24 : 27} c="#FFFFFF" />
                </Reanimated.View>
                <Reanimated.View style={[s.mainGlyph, pauseGlyphStyle]}>
                  <Pause s={isCompactHeight ? 24 : 27} c="#FFFFFF" />
                </Reanimated.View>
              </Reanimated.View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => isTask ? setShowFinish(true) : handleFinish()}
            activeOpacity={0.78}
            style={[s.smallControl, isCompactHeight && s.smallControlCompact]}
          >
            <CheckSmall s={isCompactHeight ? 19 : 21} c={SMALL_INK} w={1.8} />
            <Text style={s.smallLabel}>Finish</Text>
          </TouchableOpacity>
        </Reanimated.View>
      </View>

      <StablePantocratorAboutSheet visible={showAbout} onClose={closeAbout} />

      <StableConfirmModal
        visible={showExit}
        icon={EXIT_CONFIRM_ICON}
        iconBg="#FEF2F2"
        title="Exit My Rule?"
        body="Your prayer timer progress will be lost."
        cancelLabel="STAY"
        confirmLabel="EXIT"
        onCancel={closeExit}
        onConfirm={confirmExit}
      />

      <StableConfirmModal
        visible={showFinish}
        icon={FINISH_CONFIRM_ICON}
        iconBg="#FFF8E0"
        title="Mark as Complete?"
        body="This will mark the prayer task as done for today."
        cancelLabel="CANCEL"
        confirmLabel="COMPLETE"
        confirmColor={C.gold}
        onCancel={closeFinish}
        onConfirm={handleFinish}
      />

      <StablePrayerRuleSelector
        bottomInset={insets.bottom}
        enabled={canSwitchRules}
        onClose={closeRuleSelector}
        onRulePress={handleRulePress}
        selectedRule={selectedRule}
        theme={theme}
        visible={showRuleSelector}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFDF9', overflow: 'hidden' },
  readerRulePill: {
    minHeight: 34,
    maxWidth: '88%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 14,
    marginTop: 8,
    marginBottom: 2,
  },
  readerRuleText: { flexShrink: 1, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center' },
  quote: {
    fontFamily: F.serifItalic,
    fontSize: 19,
    lineHeight: 27,
    letterSpacing: 0.2,
    color: 'rgba(94,71,42,0.9)',
    textAlign: 'center',
    paddingHorizontal: 26,
    marginTop: 14,
  },
  quoteRef: {
    marginTop: 6,
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 2.2,
    color: 'rgba(197,160,89,0.78)',
    textTransform: 'uppercase',
    textAlign: 'center',
  },

  /**
   * The icon's footnote, in its own reserved row directly under it.
   *
   * The row is held whether the cross or the icon is standing, so the
   * exchange between the two moves nothing below it.
   */
  aboutRow: { height: 44, alignItems: 'center', justifyContent: 'center' },

  /**
   * The seat the switch and the reading share.
   *
   * ⚠ ITS HEIGHT NEVER CHANGES, whatever is in it. Both occupants are
   * absolute, so appearing, withdrawing and rearranging are pure
   * transform work on the UI thread and nothing above or below is ever
   * laid out a second time. This is the single decision that makes the
   * screen feel smooth; the easing is only what makes it feel considered.
   */
  seat: { height: SEAT.height, justifyContent: 'center' },
  seatCompact: { height: SEAT.compactHeight },
  seatItem: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchWrap: { alignSelf: 'stretch', paddingHorizontal: 40 },

  // The object takes what is left, and it is the only thing on this
  // screen that flexes — everything else is worth exactly what it
  // measures.
  // ⚠ NO PADDING. The orbit is built to the measured size of this box and
  // laid inside it, so any padding here would size the figure to the outer
  // width and then draw it in the narrower inner one — overflowing by
  // exactly the padding. The hoops keep their own clearance from the edge
  // instead (see ORBIT_PRESETS), which is where that decision belongs.
  iconRoom: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Both objects stand on the same seat, absolutely, so the exchange
  // between them moves nothing else on the screen.
  stage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },

  deck: { alignItems: 'center', paddingHorizontal: 16 },

  controlsDeck: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    // ⚠ Nothing, deliberately. The orbit's box already holds 17 points of
    // clear air under the digits for its hoops to swing through, and a
    // margin here was stacking a second gap on top of one that was
    // already there — 31 points of nothing between the reading and the
    // controls, on the screen with the least to spare.
    marginTop: 0,
    // The rest colour. It is animated from here to warm paper while the
    // prayer runs — see DECK_PLATE — and the same for the hairline.
    backgroundColor: DECK_PLATE.rest,
    padding: 9,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: DECK_EDGE.rest,
    // ⚠ WARM, NOT BLACK. This screen's whole shadow language is the
    // room's: a neutral shadow on warm paper reads as the phone dimming,
    // which is a fault rather than a mood. A warm shadow reads lighter
    // than a black one at the same alpha, so it is given a little more.
    shadowColor: '#4A3312',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.1,
    shadowRadius: 26,
    elevation: 9,
  },
  controlsDeckCompact: { gap: 15, marginTop: 0, padding: 7, paddingHorizontal: 11 },
  deckLit: {
    position: 'absolute',
    top: 1,
    left: 34,
    right: 34,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  mainWrap: { alignItems: 'center', justifyContent: 'center' },
  mainHit: { width: 66, height: 66, borderRadius: 33 },
  mainHitCompact: { width: 58, height: 58, borderRadius: 29 },
  mainControl: {
    width: 66,
    height: 66,
    borderRadius: 33,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
  },
  mainControlCompact: { width: 58, height: 58, borderRadius: 29 },
  // The rim of light round the button's own edge. `borderRadius: 999`
  // rather than the button's exact 33, so it follows whichever size the
  // button is on this phone without a second compact variant to keep in
  // step with it.
  mainRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  mainGlyph: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  smallControl: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  smallControlCompact: { width: 46, height: 46, borderRadius: 23 },
  // ⚠ WARM INK, NOT NEUTRAL. Stone grey is what these were, and it is the
  // one colour on this page that belongs to no light in the room — it
  // reads as disabled at rest and as forgotten while the prayer runs.
  smallLabel: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 0.8, color: 'rgba(74,51,18,0.4)', marginTop: 2, textTransform: 'uppercase' },

  about: {
    position: 'relative',
    // The plate is a gradient and the chevron's seat sits on the curve, so
    // both have to be clipped to the radius.
    overflow: 'hidden',
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    // Tighter on the chevron side: the orb carries its own optical margin
    // and 14 on both sides left it adrift from the edge it points at.
    paddingLeft: 14,
    paddingRight: 8,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.44)',
    shadowColor: '#4A3312',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.13,
    shadowRadius: 12,
    elevation: 3,
  },
  aboutLit: {
    position: 'absolute',
    top: 1,
    left: 22,
    right: 22,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  aboutText: {
    fontFamily: F.serifMedium,
    fontSize: 14.5,
    color: ABOUT_INK,
  },
  aboutChevron: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(197,160,89,0.18)',
  },

  selectorOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(28,25,23,0.24)' },
  selectorSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingHorizontal: 18, shadowColor: '#000', shadowOpacity: 0.18, shadowOffset: { width: 0, height: -10 }, shadowRadius: 28, elevation: 18 },
  selectorHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#E7E5E4', alignSelf: 'center', marginBottom: 12 },
  selectorHeader: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  selectorTitle: { fontFamily: F.serifMedium, fontSize: 21, color: C.text },
  selectorClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F5F4', alignItems: 'center', justifyContent: 'center' },
  selectorList: { gap: 10 },
  selectorOption: { minHeight: 72, borderRadius: 18, borderWidth: 1, paddingHorizontal: 15, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  selectorOptionInactive: { backgroundColor: '#FAFAF9', borderColor: '#EEE9E0' },
  selectorCopy: { flex: 1, minWidth: 0 },
  selectorOptionTitle: { fontFamily: F.serifMedium, fontSize: 19, lineHeight: 23, flexShrink: 1 },
  selectorOptionTrailing: {
    minWidth: 56,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 7,
  },
  selectorOrthodoxBadge: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8DCC4',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  selectorOrthodoxBadgeText: {
    fontFamily: F.sansBold,
    fontSize: 7.5,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  selectorOptionSub: {
    marginTop: 4,
    fontFamily: F.sans,
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 0,
    color: '#8A8178',
  },
});
