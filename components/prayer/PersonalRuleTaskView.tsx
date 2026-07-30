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
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import ConfirmModal from '@/components/shared/ConfirmModal';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import PantocratorAboutSheet from '@/components/prayer/PantocratorAboutSheet';
import { PantocratorPanel, PrayerLamp, panelWidth } from '@/components/prayer/PantocratorIcon';
import PrayerFocusSwitch, { type PrayerFocus } from '@/components/prayer/PrayerFocusSwitch';
import StandingCross, { CROSS_ASPECT } from '@/components/prayer/StandingCross';
import { useIgnition, useReadoutInk } from '@/components/prayer/prayerMotion';
import PrayerRoom from '@/components/prayer/PrayerRoom';
import { useAppSettings } from '@/components/settings/SettingsContext';
import { ArrowLeft, CheckSmall, ChevronDown, OpenBook, OrthodoxCross, Pause, Play, RotateCcw, X } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
 * THE ORDER OF THE SCREEN, AND WHY
 *
 *   the object    the hero — the cross or the icon, given whatever
 *                 height the screen has left
 *   the switch    which of the two, directly under the thing it changes
 *   the reading   the elapsed time, quieter than the object
 *   the controls  reset · start/pause · finish, unchanged in behaviour
 *   About         the door to the seven pages
 *
 * ⚠ WHAT PRESSING START DOES, AND WHAT IT NO LONGER DOES.
 *
 * It used to draw LINES: hoops turning round the object and round the
 * clock, near halves in front and far halves behind. They were the best
 * drawing on the screen and they were the wrong instinct — a thing that
 * moves asks to be watched, and this is a screen you are meant to be
 * looking THROUGH rather than at. Every one of them is gone.
 *
 * What happens instead is light and scale, on one shared ignition:
 *
 *   the object    grows into its full size
 *   the room      darkens at its edges, so the object is the only lit
 *                 part of the page (see PrayerRoom)
 *   the lamp      comes up behind it
 *   the reading   warms into the hour's colour
 *   the switch    withdraws — you are not choosing what to pray in
 *                 front of any more, you are praying
 *   the button    takes a slow breath of its own light
 *
 * Nothing counts, nothing ticks, nothing travels.
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
 * 0.88 rather than something more dramatic: this is a prayer beginning,
 * not a card flipping. The change has to be felt more than watched.
 */
const REST_SCALE = 0.88;

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
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [running, setRunning] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [showRuleSelector, setShowRuleSelector] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  // What the icon actually has to stand in, measured rather than guessed:
  // this screen carries a title bar, sometimes a rule pill, an epigraph, a
  // readout, a control deck and a door, and no constant survives all the
  // combinations of those across every phone.
  const [iconRoom, setIconRoom] = useState({ width: 0, height: 0 });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishLockRef = useRef(false);
  // One value lights the object, the room, the reading and the button.
  const ignition = useIgnition(running);
  // 0 = the cross is standing, 1 = the icon is. The exchange between them
  // is the one animation on this screen that has to be worth watching.
  const swap = useSharedValue(focus === 'icon' ? 1 : 0);
  // The slow breath in the button's light. See mainHaloStyle.
  const breath = useSharedValue(0);

  const isCompactHeight = height < 720;
  const hasHours = elapsedSecs >= 3600;
  const timeFont = hasHours ? (isCompactHeight ? 38 : 44) : (isCompactHeight ? 50 : 58);
  const colonFont = timeFont * 0.42;
  const display = formatElapsed(elapsedSecs);
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
   * width budget is figured from the wider of the two. 380 is where the
   * height stops mattering: past it the controls look like they fell off
   * the bottom of a tall phone.
   */
  const panelHeight = iconRoom.height > 0
    ? Math.max(150, Math.min(iconRoom.height - 8, (iconRoom.width * 0.66) / CROSS_ASPECT, 380))
    : 0;
  // The pool reaches well outside whatever is standing in it; a glow that
  // stops at the object's edge is a rectangle of light, which is not what
  // a lamp makes.
  const lampSize = Math.min(screenWidth * 1.15, Math.round(panelWidth(panelHeight) * 2.4));

  useEffect(() => {
    if (!running) return;

    timerRef.current = setInterval(() => {
      setElapsedSecs(prev => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [running]);

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
    // Long and even. A spring here would overshoot the exchange and snap
    // the incoming object into place, and this is not a control settling
    // — it is one thing giving way to another.
    swap.value = withTiming(focus === 'icon' ? 1 : 0, {
      duration: 560,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [focus, swap]);

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
    setRunning(false);
    setElapsedSecs(0);
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
  }, []);

  const handleFinish = useCallback(async () => {
    if (finishLockRef.current) return;
    finishLockRef.current = true;
    setRunning(false);
    if (Platform.OS !== 'web' && !isTask) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    await onComplete?.();
    onBack();
  }, [isTask, onBack, onComplete]);

  const handleRulePress = useCallback((rule: PersonalPrayerRuleChoice) => {
    if (rule === selectedRule) {
      setShowRuleSelector(false);
      return;
    }
    setRunning(false);
    setShowRuleSelector(false);
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    void onRuleChange?.(rule);
  }, [onRuleChange, selectedRule]);

  const screenTitle = titleForPrayer(prayerType, title);
  const canSwitchRules = canSwitchPrayerRule(prayerType);

  // The reading warms into the hour's colour on the same curve the orbit
  // kindles on, rather than flipping the instant `running` changes.
  const readoutInk = useReadoutInk(ignition, C.text, theme.accent);

  // The button travels with it: ink at rest, the hour's colour running,
  // with a halo of its own light behind it while it does.
  const mainControlStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(ignition.value, [0, 1], [C.text, theme.accent]),
  }), [theme.accent]);
  /**
   * The button's own light, and the one thing on this screen that keeps
   * moving while the prayer runs.
   *
   * ⚠ IT BREATHES; IT DOES NOT TICK. A pulse on the second would make the
   * button a clock, and the whole redesign is the argument that this
   * screen is not one. Six seconds a cycle is about the pace of a slow
   * breath, and the swing is small — 0.24 to 0.34 — so it is felt at the
   * edge of vision rather than watched.
   *
   * ⚠ Opacity only, no scale. This is a small view, and scaling small
   * views on Android resamples their bitmaps every frame; here that would
   * be every frame for as long as somebody prays.
   */
  const mainHaloStyle = useAnimatedStyle(() => ({
    opacity: ignition.value * (0.24 + breath.value * 0.1),
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
    return { opacity: 1 - out, transform: [{ translateY: out * -14 }] };
  });
  const iconStyle = useAnimatedStyle(() => {
    const arrive = Math.max(0, (swap.value - 0.45) / 0.55);
    return { opacity: arrive, transform: [{ translateY: (1 - arrive) * 14 }] };
  });
  // The About door belongs to the icon — there is no sheet behind the
  // cross — but it stays MOUNTED either way, so the deck below never
  // changes height and the only thing that moves during the exchange is
  // the object itself.
  const aboutStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, (swap.value - 0.45) / 0.55),
  }));

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
    transform: [{ scale: REST_SCALE + (1 - REST_SCALE) * ignition.value }],
  }));

  // The switch withdraws rather than vanishing: it fades and settles a
  // few points, so it reads as stepping back. ⚠ Its strip keeps its
  // height either way — collapsing it would jump the whole screen at the
  // exact moment the prayer begins.
  const switchStyle = useAnimatedStyle(() => ({
    opacity: 1 - ignition.value,
    transform: [{ translateY: ignition.value * 6 }],
  }));

  // And the epigraph steps back with it, to a half-light. It is the
  // instruction; once you are following it, it has said its piece.
  const epigraphStyle = useAnimatedStyle(() => ({
    opacity: 1 - ignition.value * 0.55,
  }));

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
      <PrayerRoom ignition={ignition} />

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

      {/* The epigraph steps aside entirely on a short phone. It is the one
          thing here that can go without breaking anything, and it costs
          the object fifty points it needs more. */}
      {!isCompactHeight && (
        <Reanimated.View style={epigraphStyle} pointerEvents="none">
          <Text style={s.quote}>{QUOTE}</Text>
          <Text style={s.quoteRef}>{QUOTE_REF}</Text>
        </Reanimated.View>
      )}

      {/* ── The object, in its light ────────────────────────────────── */}
      <View style={s.iconRoom} onLayout={onIconRoomLayout}>
        {panelHeight > 0 && (
          <Reanimated.View style={[s.stage, objectStyle]} pointerEvents="none">
            {/* One lamp, behind both. It does not belong to either object
                — see PrayerLamp — because the whole point of the change
                is that the light stays lit and the thing in it changes. */}
            <PrayerLamp size={lampSize} light={ignition} swap={swap} />

            <Reanimated.View style={[s.stage, crossStyle]}>
              <StandingCross height={panelHeight} />
            </Reanimated.View>
            <Reanimated.View style={[s.stage, iconStyle]}>
              {/* The icon has no frame; it fades into the page at its own
                  edges, so it has to be told which page. GROUND[1] is the
                  screen's colour at the height the icon stands. */}
              <PantocratorPanel height={panelHeight} ground={GROUND[1]} />
            </Reanimated.View>
          </Reanimated.View>
        )}
      </View>

      {/* ── What stands in front of you ──────────────────────────────
          ⚠ BELOW THE OBJECT, NOT ABOVE IT. Above, it was the first thing
          on the page and the thing keeping the deck from dropping; here
          it sits directly under what it changes, which is also where a
          control belongs. The strip is a fixed height so the screen
          never jumps as it withdraws. */}
      <View style={s.focusWrap} pointerEvents={running ? 'none' : 'auto'}>
        <Reanimated.View style={switchStyle}>
          <PrayerFocusSwitch
            value={focus}
            onChange={next => updateSettings({ prayerFocus: next })}
          />
        </Reanimated.View>
      </View>

      {/* ── The reading, the controls, the door ─────────────────────── */}
      {/* ⚠ THE DECK SITS AS LOW AS THE PHONE ALLOWS. Every point it gives
          back goes to the flexible room above it. Nothing is added under
          the safe area: the home indicator's own inset is the floor. */}
      <View style={[s.deck, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={s.readout}>
          <Reanimated.Text style={[s.timeText, readoutInk, { fontSize: timeFont, lineHeight: timeFont * 1.12 }]}>
            {display.main}
          </Reanimated.Text>
          <Reanimated.Text style={[s.colonText, readoutInk, { fontSize: colonFont }]}>:</Reanimated.Text>
          {/* ⚠ THE SECONDS ARE SET LIGHTER THAN THE MINUTES, not smaller.
              A clock face distinguishes the figure you read from the one
              that is merely running, and doing it by weight keeps the
              reading on one baseline at one size — where doing it by size
              would make the pair jump every time an hour appeared. */}
          <Reanimated.Text style={[s.timeText, s.timeTail, readoutInk, { fontSize: timeFont, lineHeight: timeFont * 1.12 }]}>
            {display.tail}
          </Reanimated.Text>
        </View>

        <View style={[s.controlsDeck, isCompactHeight && s.controlsDeckCompact]}>
          <TouchableOpacity
            onPress={handleReset}
            activeOpacity={0.78}
            style={[s.smallControl, isCompactHeight && s.smallControlCompact]}
          >
            <RotateCcw s={isCompactHeight ? 18 : 20} c="rgba(28,25,23,0.38)" w={1.8} />
            <Text style={s.smallLabel}>Reset</Text>
          </TouchableOpacity>

          <View style={s.mainWrap}>
            {/* The button's own light, behind it. */}
            <Reanimated.View
              pointerEvents="none"
              style={[
                s.mainHalo,
                isCompactHeight && s.mainHaloCompact,
                { backgroundColor: theme.accent },
                mainHaloStyle,
              ]}
            />
            <TouchableOpacity
              onPress={() => setRunning(value => !value)}
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
            <CheckSmall s={isCompactHeight ? 19 : 21} c="rgba(28,25,23,0.38)" w={1.8} />
            <Text style={s.smallLabel}>Finish</Text>
          </TouchableOpacity>
        </View>

        {/* The door to the seven pages. An open book rather than an info
            glyph, because what is behind it IS a book — and it opens
            without touching the clock: the prayer keeps its time while
            you read. */}
        <Reanimated.View style={aboutStyle} pointerEvents={focus === 'icon' ? 'auto' : 'none'}>
          <TouchableOpacity
            onPress={() => setShowAbout(true)}
            activeOpacity={0.76}
            haptic="selection"
            style={s.about}
            accessibilityRole="button"
            accessibilityLabel="About the icon"
            accessibilityElementsHidden={focus !== 'icon'}
            importantForAccessibility={focus === 'icon' ? 'auto' : 'no-hide-descendants'}
          >
            <OpenBook s={15} c={C.goldDark} w={1.6} />
            <Text style={s.aboutText}>About the icon</Text>
          </TouchableOpacity>
        </Reanimated.View>
      </View>

      <PantocratorAboutSheet visible={showAbout} onClose={() => setShowAbout(false)} />

      <ConfirmModal
        visible={showExit}
        icon={<ArrowLeft s={22} c={C.red} />}
        iconBg="#FEF2F2"
        title="Exit My Rule?"
        body="Your prayer timer progress will be lost."
        cancelLabel="STAY"
        confirmLabel="EXIT"
        onCancel={() => setShowExit(false)}
        onConfirm={() => {
          setShowExit(false);
          setRunning(false);
          onBack();
        }}
      />

      <ConfirmModal
        visible={showFinish}
        icon={<CheckSmall s={22} c={C.gold} w={2.5} />}
        iconBg="#FFF8E0"
        title="Mark as Complete?"
        body="This will mark the prayer task as done for today."
        cancelLabel="CANCEL"
        confirmLabel="COMPLETE"
        confirmColor={C.gold}
        onCancel={() => setShowFinish(false)}
        onConfirm={handleFinish}
      />

      <Modal
        transparent
        visible={canSwitchRules && showRuleSelector}
        animationType="fade"
        onRequestClose={() => setShowRuleSelector(false)}
      >
        <View style={s.selectorOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowRuleSelector(false)} />
          <View style={[s.selectorSheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={s.selectorHandle} />
            <View style={s.selectorHeader}>
              <Text style={s.selectorTitle}>Prayer Rule</Text>
              <TouchableOpacity
                onPress={() => setShowRuleSelector(false)}
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
                    onPress={() => handleRulePress(rule.id)}
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
   * The switch's strip, under the object.
   *
   * ⚠ IT KEEPS ITS ROOM WHETHER THE SWITCH IS SHOWING OR NOT. The switch
   * withdraws when the prayer starts, and if the strip collapsed with it
   * the reading and the controls would leap upward at the exact moment
   * you pressed start — which is the one moment on this screen that has
   * to be calm.
   */
  focusWrap: { paddingHorizontal: 40, paddingTop: 10, paddingBottom: 4 },

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
  readout: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  timeText: {
    fontFamily: F.serifBold,
    // Tabular figures, so a second ticking over does not shove the whole
    // reading sideways. It did, every second, for as long as this screen
    // has existed.
    fontVariant: ['tabular-nums', 'lining-nums'],
    includeFontPadding: false,
  },
  colonText: {
    fontFamily: F.serifBold,
    opacity: 0.3,
    marginHorizontal: 3,
    includeFontPadding: false,
  },
  /**
   * The seconds, lighter than the minutes.
   *
   * A clock face distinguishes the figure you READ from the one that is
   * merely running, and this reading had them at identical weight — two
   * pairs of numerals with a dim colon between, which is a stopwatch.
   *
   * ⚠ BY OPACITY, NOT BY SIZE. Setting the seconds smaller would put the
   * pair on two optical baselines and make the whole reading resize the
   * moment an hour appeared and the minutes moved left. Same size, same
   * baseline, less ink.
   */
  timeTail: { opacity: 0.58 },

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
    backgroundColor: '#FFFFFF',
    padding: 9,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(28,25,23,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.07,
    shadowRadius: 26,
    elevation: 9,
  },
  controlsDeckCompact: { gap: 15, marginTop: 0, padding: 7, paddingHorizontal: 11 },
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
  // Wider than the button and behind it, so what shows is a rim of light
  // around the edge rather than a disc under it.
  mainHalo: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    opacity: 0,
  },
  mainHaloCompact: { width: 84, height: 84, borderRadius: 42 },
  mainGlyph: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  smallControl: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  smallControlCompact: { width: 46, height: 46, borderRadius: 23 },
  smallLabel: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 0.8, color: 'rgba(28,25,23,0.32)', marginTop: 2, textTransform: 'uppercase' },

  about: {
    marginTop: 8,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 15,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.34)',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  aboutText: {
    fontFamily: F.serif,
    fontSize: 14.5,
    color: C.goldDark,
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
