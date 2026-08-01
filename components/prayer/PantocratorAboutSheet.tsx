import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  Easing,
  interpolateColor,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import OrthodoxPlaque, { plaqueAlpha, plaqueInk } from '@/components/prayer/OrthodoxPlaque';
import { C, F } from '@/constants/tokens';
import {
  FACE,
  PANEL_ASPECT,
  PANTOCRATOR_DETAILS,
  PANTOCRATOR_IMAGE,
  PantocratorDetail,
  PantocratorFace,
  PantocratorPanel,
  PantocratorWall,
  detailAspect,
} from '@/components/prayer/PantocratorIcon';
import {
  PANTOCRATOR_DETAIL_LABELS,
  PANTOCRATOR_FACE_CAPTIONS,
  PANTOCRATOR_FACE_LABELS,
  PANTOCRATOR_FACE_VIEWS,
  PANTOCRATOR_SLIDES,
  PANTOCRATOR_SOURCE_NOTE,
  type PantocratorSlide,
} from '@/data/prayers/pantocratorContent';

/* ─────────────────────────────────────────────────────────────────────
 * ABOUT THE ICON — a chapel, and the book open under it.
 *
 * ⚠ THE FIRST REBUILD MADE THIS ROOM BEAUTIFUL AND MADE IT A STRANGER.
 * Black wall, parchment page, gold and nothing but gold — handsome, and
 * belonging to some other application. The rest of this app is warm
 * paper, ALABASTER STONE, INCISED RULES, STRUCK DIAMONDS and A COLOUR
 * PER SUBJECT, and the Prayer Book two taps away is the clearest
 * statement of all five. So every piece of furniture in here is now the
 * app's own piece:
 *
 *   THE HEAD-BAND is the reader's head-band — the folio set in the
 *   book's face with a struck diamond between its figures, the way out
 *   cut into a roundel of the plaque's own stone, and a RULED CHANNEL
 *   under both with the rubricator's diamond riding at the head of the
 *   ink. Not a row of story segments; a rule filling as the sheet is
 *   read.
 *
 *   THE WAY ON is the ORTHODOX PLAQUE — the same object that begins a
 *   prayer and turns a page in the reader, doing here what it does
 *   there. It is the app's one action, and this sheet had been using a
 *   parchment rectangle of its own invention.
 *
 *   EVERY PART HAS A COLOUR, and it is spent the way the plaque spends
 *   an hour's colour: on the versal, the eyebrow, the ornament, the
 *   plate's labels and the plaque's lettering — never on the ground.
 *
 *   AND THE WALL IS THE ICON'S OWN. The chapel is lit by the panel
 *   itself, blown up and blurred past recognition, so the room behind
 *   the board carries the gold of its halo and the umber of its robe
 *   rather than a designer's brown.
 *
 * ⚠ THE PAGE USED TO SCROLL CLEAR OF THE FOOT OF THE SCREEN, leaving the
 * room's dark backing showing under the text. The pager begins BELOW the
 * band and runs to the very bottom, and the spacer above the page and
 * the scroller's own height cancel — so the parchment reaches the foot at
 * every offset, by construction rather than by a clamp.
 *
 * The page does pass UNDER the band, which is right: it is a bound book's
 * head-band, not a lid. That is what `BandGround` is for.
 *
 * ⚠ STILL NO GESTURE HANDLER. RNGH inside a Modal crashes Android unless
 * the content carries its own GestureHandlerRootView, and nothing here
 * needs it: a horizontal ScrollView with pagingEnabled brings the swipe,
 * the snap and the momentum on the platform's own thread, and Reanimated
 * reads its offset without owning it.
 * ───────────────────────────────────────────────────────────────────── */

/** The shade drawn over the blurred panel — see PantocratorWall. */
const WALL_SHADE = [
  'rgba(12,8,3,0.66)',
  'rgba(16,10,4,0.40)',
  'rgba(20,13,5,0.46)',
  'rgba(24,15,7,0.66)',
] as const;

const PARCHMENT = ['#FDFBF6', '#F9F3E8', '#F4ECDD'] as const;
const FOOT_GROUND = ['rgba(246,239,226,0)', '#F6EFE2', '#F3EBDB'] as const;

/** The stone every roundel and plaque in this app is cut from. */
const STONE = '#F8F3E8';
const GOLD_HAIR = 'rgba(197,160,89,0.36)';
const BODY_INK = '#4A4038';
const LEAD_INK = '#443A31';
const BOLD_INK = '#332C25';

/**
 * How tall the chapel stands, how much of the page must survive under it,
 * and how far the leaf laps over its foot.
 *
 * ⚠ THE LAP IS THE WHOLE TRICK. A page that stops short of the wall is a
 * card pinned to it; a page that runs eight points over the wall's edge
 * is lying on something.
 */
const CHAPEL_SHARE = 0.6;
const MIN_LEAF = 262;
const CHAPEL_CAP = 540;
const LEAF_LAP = 8;

const SLIDE_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;

function slideNumeral(index: number): string {
  return SLIDE_NUMERALS[index] ?? String(index + 1);
}

/* ── The phrase that carries the paragraph ──────────────────────────
 *
 * The content marks it `**like this**` — see the note in the data file.
 * Split on the marks; the odd pieces are the ones that were inside them.
 */
function splitBold(text: string): { text: string; bold: boolean }[] {
  return text
    .split('**')
    .map((piece, index) => ({ text: piece, bold: index % 2 === 1 }))
    .filter(run => run.text.length > 0);
}

/**
 * The opening letter, raised.
 *
 * ⚠ THE SAME RULE AS THE PRAYER READER (`PrayerBookView`'s `takeVersal`):
 * only a real letter takes one, because a raised quotation mark is worse
 * than no flourish at all, and a short line is left alone because a
 * versal on three words reads as a mistake.
 *
 * ⚠ IT IS TAKEN OFF THE RUNS, NOT OFF THE RAW STRING. A paragraph whose
 * first phrase is marked bold begins with an asterisk, and a versal
 * drawn from the raw text would have set a gold thirty-point `*`.
 */
function takeVersal(
  runs: { text: string; bold: boolean }[],
): { initial: string; rest: { text: string; bold: boolean }[] } | null {
  const whole = runs.reduce((count, run) => count + run.text.length, 0);
  if (whole < 24 || !runs.length) return null;
  const head = runs[0].text.trimStart();
  const initial = head.slice(0, 1);
  if (!initial || initial.toUpperCase() === initial.toLowerCase()) return null;
  return {
    initial,
    rest: [{ text: head.slice(1), bold: runs[0].bold }, ...runs.slice(1)],
  };
}

/* ── GOING IN, AND COMING BACK OUT ───────────────────────────────────
 *
 * ⚠ IT WAS THE PLATFORM'S SHEET SLIDE, AND IT WAS WRONG IN BOTH
 * DIRECTIONS. `animationType="slide"` throws a full-screen room up from
 * the bottom edge and drops it back down there — the gesture for a
 * sheet, and this is not a sheet, it is a room you walk into. Worse, the
 * control that leaves it is called RETURN TO THE ICON: it promises you
 * are going back to a particular object, and what it did was fling the
 * whole chapel at the floor.
 *
 * So the room is opened and closed here, in the prayer screen's own
 * motion vocabulary — see `prayerMotion`, which the whole of that screen
 * lights from: ARRIVING IS SLOW AND EASES OUT, the way something coming
 * to life settles; GOING BACK TO REST IS QUICKER AND EASES AT BOTH ENDS,
 * the way a lamp turned down does. One asymmetric pair, used here for
 * exactly what it was written for.
 *
 * And the move is DEPTH, not travel. The room comes toward you a little
 * and settles; leaving, it steps back the same distance and dissolves,
 * and the prayer screen — with the same icon standing on it — is behind
 * the whole time. You went into a chapel and you stepped back out of it.
 */
const OPEN_MS = 420;
const CLOSE_MS = 300;
/** How far back the room stands before it arrives, and after it leaves. */
const AWAY = 0.94;
const RISE = 14;

export default function PantocratorAboutSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();
  /** Mounted covers the way out too — the room has to be there to leave. */
  const [mounted, setMounted] = useState(visible);
  /**
   * ⚠ A FRESH ROOM EVERY TIME, AND THAT IS WHAT KEEPS IT IN PLACE.
   *
   * The sheet used to hold the page number, the pager's offset and every
   * leaf's scroll across a close, then put them back in a `useEffect` —
   * which runs AFTER the first paint. Re-opening therefore showed page
   * five, or a page scrolled to its colophon, for a frame before it
   * snapped to the beginning. Keying the room on the visit throws all of
   * that away at the door: page one, top of the page, halves not
   * mirrored, with nothing to reset because nothing survived.
   */
  const [visit, setVisit] = useState(0);
  const open = useSharedValue(visible ? 1 : 0);

  /**
   * ⚠ THE SHAPE OF THIS EFFECT IS THE APP'S OWN — see `SetAsTaskSheet`,
   * `ScriptureReaderView`, `SmoothBottomSheet`: mount, zero the value,
   * and only then, ON THE NEXT FRAME, animate. That
   * `requestAnimationFrame` is the whole of "everything in its place":
   * it lets the room mount and lay out before a single point of the
   * arrival has been spent, so nothing is ever seen finding its position
   * while the room is already coming toward you.
   */
  useEffect(() => {
    if (visible) {
      setMounted(true);
      setVisit(count => count + 1);
      open.value = 0;
      if (reduceMotion) {
        open.value = 1;
        return;
      }
      const frame = requestAnimationFrame(() => {
        open.value = withTiming(1, { duration: OPEN_MS, easing: Easing.out(Easing.cubic) });
      });
      return () => cancelAnimationFrame(frame);
    }

    if (reduceMotion) {
      open.value = 0;
      setMounted(false);
      return;
    }
    // ⚠ The room is unmounted by the animation that removes it, not by
    // the press — pull it at the press and there is nothing left to
    // animate, which is the slide-down all over again.
    open.value = withTiming(
      0,
      { duration: CLOSE_MS, easing: Easing.inOut(Easing.quad) },
      finished => {
        if (finished) runOnJS(setMounted)(false);
      },
    );
  }, [open, reduceMotion, visible]);

  /**
   * ⚠ THE ROOM AND THE SCRIM DO NOT SHARE A FADE, THEY HAND OVER.
   *
   * The room is gone by three tenths of the way through and the scrim
   * does not begin to lift until four tenths, so THE TWO ARE NEVER BOTH
   * ON THE SCREEN — which is the whole of the double-exposure problem
   * described below. What sits between them is a blink of the chapel's
   * own darkness: a doorway, at this speed, rather than a flash.
   *
   * The scale and the rise still run on the raw value, so the object you
   * are watching keeps travelling smoothly across the hand-over rather
   * than stopping while its opacity does something else.
   */
  const roomStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, (open.value - 0.3) / 0.7),
    transform: [
      { translateY: (1 - open.value) * RISE },
      { scale: AWAY + open.value * (1 - AWAY) },
    ],
  }), []);

  /**
   * ⚠ THE SCRIM IS WHAT KEEPS THERE FROM BEING TWO CHRISTS ON THE SCREEN.
   *
   * The prayer screen behind this one has the SAME PANEL standing on it,
   * at a different size and a different height. Cross-fade the room
   * straight into it and for a third of a second you have a double
   * exposure of the face — the one thing this transition must not do.
   *
   * So the scrim is nearly OPAQUE and it is still solid at four tenths,
   * by which point the room above has already gone — see `roomStyle`.
   * The order is: the chapel steps back and dims into its own darkness,
   * and only then does the prayer screen rise out of that darkness.
   * Neither is ever seen through the other.
   *
   * ⚠ AND IT IS THE CHAPEL'S OWN DARK, not a neutral black. You are
   * leaving a dark room for a lit one; passing through the dark of the
   * room you were in is the truthful way to do that, and a neutral scrim
   * over warm paper reads as the phone dimming.
   *
   * It is the same on the way in, and wanted there too: the paper goes
   * down first, then the chapel arrives out of the dark.
   */
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, open.value / 0.4),
  }), []);

  /* ⚠ AFTER THE HOOKS, NEVER BEFORE THEM — the effect above is what sets
     `mounted`, so an early return over it would shut the door and throw
     away the key. It is here because nothing of this room should exist
     while it is closed: no blurred wall, no four crops of a
     sixth-century panel, for a screen nobody has opened. */
  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      // ⚠ The platform animates nothing. Everything above does.
      animationType="none"
      presentationStyle="overFullScreen"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Reanimated.View pointerEvents="none" style={[s.backdrop, backdropStyle]} />
      <Reanimated.View
        style={[s.roomMotion, roomStyle]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <AboutRoom key={visit} onClose={onClose} />
      </Reanimated.View>
    </Modal>
  );
}

/**
 * THE ROOM ITSELF.
 *
 * Mounted fresh on every visit and thrown away on the way out — see the
 * note on `visit` above. Nothing in here has to remember anything.
 */
function AboutRoom({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const [facesWhole, setFacesWhole] = useState(false);
  const [track, setTrack] = useState(0);
  const pager = useRef<ScrollView>(null);
  const leaves = useRef<(ScrollView | null)[]>([]);
  const total = PANTOCRATOR_SLIDES.length;

  const metrics = useMemo(() => {
    const foot = 12 + 46 + Math.max(insets.bottom, 12) + 6;
    /* ⚠ THE CHAPEL IS BUDGETED AGAINST THE PAGE, not taken off the top.
       A flat share of the screen is right on a large phone and wrong on
       a small one: 0.6 of 852 leaves a page opening on its title, its
       plate and a line of prose; 0.6 of 667 leaves one opening on a
       title and nothing. */
    const chapel = Math.round(Math.min(
      height * CHAPEL_SHARE,
      height - foot - MIN_LEAF + LEAF_LAP,
      CHAPEL_CAP,
    ));
    // The head-band: the folio row, then the ruled channel under it.
    const band = insets.top + 2 + 34 + 10 + 9;
    const leafTop = chapel - LEAF_LAP;
    return {
      chapel,
      band,
      foot,
      leafTop,
      /** Where a figure that is not the whole board may stand. */
      figureTop: band + 8,
      room: leafTop - (band + 8) - 6,
      /**
       * How far the page must be read up before it is lying under the
       * band rather than below it — see BandGround.
       */
      cover: Math.max(1, leafTop - band),
    };
  }, [height, insets.bottom, insets.top]);

  /** Where the pager stands, in pages. Drives every cross-fade. */
  const at = useSharedValue(0);
  /** How far the leaf of the page in view has been read up. */
  const leafY = useSharedValue(0);
  /** Which page the shared value last announced — see the handler. */
  const announced = useSharedValue(0);

  /**
   * ⚠ THE PAGE IS ANNOUNCED FROM THE UI THREAD, ONCE PER PAGE. Calling
   * back into JavaScript on every scroll frame to keep a `useState` in
   * step would spend a hop per frame on a value that changes five times
   * in the life of the sheet; comparing against `announced` first means
   * the hop happens only when the answer is different.
   */
  const onPagerScroll = useAnimatedScrollHandler({
    onScroll: event => {
      at.value = event.contentOffset.x / width;
      const next = Math.round(at.value);
      if (next !== announced.value && next >= 0 && next < total) {
        announced.value = next;
        // The page arriving is at the top of its own reading, and the
        // chapel has to know that while the swipe is still running.
        leafY.value = withTiming(0, { duration: 220 });
        runOnJS(setPage)(next);
      }
    },
  });

  // Every page opens at its own beginning. Done once the swipe has
  // settled, so nothing is seen jumping while it is still on screen.
  const restOthers = useCallback((current: number) => {
    leaves.current.forEach((leaf, index) => {
      if (index !== current) leaf?.scrollTo({ y: 0, animated: false });
    });
  }, []);

  const goTo = useCallback((index: number) => {
    pager.current?.scrollTo({ x: index * width, animated: true });
  }, [width]);

  const chapelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -leafY.value * 0.25 }],
  }), []);

  const here = PANTOCRATOR_SLIDES[page];
  const next = page < total - 1 ? PANTOCRATOR_SLIDES[page + 1] : null;

  return (
    <View style={s.room}>
      {/* ── THE CHAPEL ───────────────────────────────────────────────
          ⚠ NOTHING IN THIS ROOM ARRIVES ON ITS OWN ANY MORE. The chapel
          faded in over half a second and every leaf dropped in behind
          it, while the platform was still throwing the whole modal up
          from the bottom edge — three clocks running at once on one
          appearance, which is why nothing was ever where it should be
          when you first looked at it. The room arrives as one object,
          and everything inside it is already in place. */}
      <Reanimated.View
        pointerEvents="none"
        style={[s.chapel, { height: metrics.chapel }, chapelStyle]}
      >
        <PantocratorWall shade={WALL_SHADE} />

        {PANTOCRATOR_SLIDES.map((slide, index) => (
          <FigureLayer
            key={slide.id}
            at={at}
            index={index}
            mounted={Math.abs(index - page) <= 1}
            width={width}
          >
            <Figure
              slide={slide}
              width={width}
              room={metrics.room}
              figureTop={metrics.figureTop}
              whole={facesWhole}
            />
          </FigureLayer>
        ))}
      </Reanimated.View>

      {/* ── THE PAGES ───────────────────────────────────────────────
          ⚠ IT BEGINS BELOW THE HEAD-BAND AND RUNS TO THE FOOT OF THE
          SCREEN. Beginning at the top let the leaf climb over the
          folio; ending above the foot let it climb clear of the
          bottom and show the room's backing under it. */}
      <Reanimated.ScrollView
        ref={pager as never}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onPagerScroll}
        onMomentumScrollEnd={() => restOthers(page)}
        scrollEventThrottle={16}
        style={[s.pager, { top: metrics.band }]}
      >
        {PANTOCRATOR_SLIDES.map((slide, index) => (
          <Leaf
            key={slide.id}
            ref={leaf => { leaves.current[index] = leaf; }}
            slide={slide}
            width={width}
            head={metrics.leafTop - metrics.band}
            minLeaf={height - metrics.leafTop}
            bottom={metrics.foot + 22}
            leafY={leafY}
            last={index === total - 1}
            whole={facesWhole}
            onWhole={setFacesWhole}
          />
        ))}
      </Reanimated.ScrollView>

      {/* ── THE HEAD-BAND ──────────────────────────────────────────
          The reader's own: folio, roundel, ruled channel.

          ⚠ IT IS A BOUND BOOK'S HEAD-BAND AND THE PAGE PASSES UNDER
          IT. A long slide read to its end lifts the parchment right up
          to here — so the band takes a parchment ground of its own as
          that happens, and its ink darkens from the pale gold that
          reads on a dark wall into the part's own colour, which is
          what reads on paper. One or the other alone would be
          invisible half the time. */}
      <View
        pointerEvents="box-none"
        style={[s.head, { paddingTop: insets.top + 2 }]}
      >
        <BandGround leafY={leafY} cover={metrics.cover} height={metrics.band} />

        <View style={s.headRow} pointerEvents="box-none">
          <View pointerEvents="none" style={s.headSpacer} />
          <Folio index={page} total={total} at={at} leafY={leafY} cover={metrics.cover} />
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.82}
            style={s.roundel}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <View pointerEvents="none" style={[s.roundelFace, { borderColor: plaqueAlpha(here.accent, 0.42) }]} />
            <View pointerEvents="none" style={s.roundelCatch} />
            <X s={13} c={plaqueInk(here.accent, 32)} w={2.2} />
          </TouchableOpacity>
        </View>

        <RuledChannel
          at={at}
          total={total}
          track={track}
          onTrack={setTrack}
          leafY={leafY}
          cover={metrics.cover}
        />
      </View>

      {/* ── THE FOOT ───────────────────────────────────────────────
          ⚠ THE PLAQUE, NOT A RECTANGLE OF ITS OWN INVENTION. This is
          the app's one action — it begins a prayer on the Prayer Book
          screen and turns the page inside the reader — and it names
          the page it is going to, because a bare arrow says only that
          there is more. */}
      <LinearGradient
        colors={FOOT_GROUND}
        locations={[0, 0.26, 1]}
        style={[s.foot, { paddingBottom: Math.max(insets.bottom, 12) + 6 }]}
        pointerEvents="box-none"
      >
        <View pointerEvents="none" style={s.footRule} />
        {page > 0 ? (
          <TouchableOpacity
            onPress={() => goTo(page - 1)}
            activeOpacity={0.82}
            haptic="selection"
            style={s.roundel}
            accessibilityRole="button"
            accessibilityLabel="Previous page"
          >
            <View pointerEvents="none" style={[s.roundelFace, { borderColor: plaqueAlpha(here.accent, 0.42) }]} />
            <View pointerEvents="none" style={s.roundelCatch} />
            <ChevronLeft s={15} c={plaqueInk(here.accent, 32)} w={2.2} />
          </TouchableOpacity>
        ) : (
          <View style={s.headSpacer} />
        )}

        <OrthodoxPlaque
          accent={here.accent}
          label={next ? next.title : 'Return to the icon'}
          onPress={next ? () => goTo(page + 1) : onClose}
          size="compact"
          style={s.plaque}
        />
      </LinearGradient>
    </View>
  );
}

/* ── WHERE YOU ARE ───────────────────────────────────────────────────
 *
 * ⚠ THE FOLIO AND THE RULED CHANNEL, WHICH IS WHAT THIS APP USES. The
 * sheet had five story segments across the top — a form borrowed from
 * somewhere else entirely, and one this book has an answer to: a bound
 * page is closed at the head by a rule, with the figure of the leaf set
 * in the book's own face beside it.
 *
 * ⚠ AND BOTH TAKE THE PART'S COLOUR, cross-faded on the pager's offset
 * so the head warms from gold into violet as the second part arrives
 * rather than snapping when it lands.
 */
const PART_LIT = PANTOCRATOR_SLIDES.map(slide => slide.lit);
/** The same five colours, at the weight that reads on parchment. */
const PART_INK = PANTOCRATOR_SLIDES.map(slide => plaqueInk(slide.accent, 30));
const PART_STOPS = PANTOCRATOR_SLIDES.map((_, index) => index);

/**
 * THE COLOUR OF THE HEAD, wherever the head happens to be lying.
 *
 * Two interpolations, one inside the other: ACROSS the parts, so the head
 * warms from gold into violet as the second slide arrives; and BETWEEN
 * THE TWO GROUNDS, so it darkens as the page rises under it. Both run on
 * the UI thread — Reanimated parses the `hsl()` that `plaqueInk` returns,
 * so the app's own ink function can be used here rather than a second set
 * of hand-picked colours that could drift from it.
 */
function useHeadInk(at: SharedValue<number>, leafY: SharedValue<number>, cover: number) {
  return useAnimatedStyle(() => {
    const onLeaf = Math.min(1, Math.max(0, leafY.value / cover));
    return {
      color: interpolateColor(onLeaf, [0, 1], [
        interpolateColor(at.value, PART_STOPS, PART_LIT) as string,
        interpolateColor(at.value, PART_STOPS, PART_INK) as string,
      ]),
    };
  }, [cover]);
}

/** The parchment the band lies on once the page has been read up to it. */
function BandGround({
  leafY, cover, height,
}: {
  leafY: SharedValue<number>;
  cover: number;
  height: number;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, leafY.value / cover)),
  }), [cover]);

  return (
    <Reanimated.View
      pointerEvents="none"
      // ⚠ It reaches past the band by the height of the fade below it, so
      // the parchment does not stop dead on a line of its own.
      style={[s.bandGround, { height: height + 22 }, style]}
    >
      <LinearGradient
        colors={['#FDFBF6', '#FCF8F0', 'rgba(252,248,240,0)']}
        locations={[0, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />
    </Reanimated.View>
  );
}

function Folio({
  index, total, at, leafY, cover,
}: {
  index: number;
  total: number;
  at: SharedValue<number>;
  leafY: SharedValue<number>;
  cover: number;
}) {
  const inkStyle = useHeadInk(at, leafY, cover);
  // The struck diamond takes the same colour as a fill rather than as ink.
  const diamondStyle = useAnimatedStyle(() => {
    const onLeaf = Math.min(1, Math.max(0, leafY.value / cover));
    return {
      backgroundColor: interpolateColor(onLeaf, [0, 1], [
        interpolateColor(at.value, PART_STOPS, PART_LIT) as string,
        interpolateColor(at.value, PART_STOPS, PART_INK) as string,
      ]),
    };
  }, [cover]);

  return (
    <View style={s.folio} pointerEvents="none">
      <Reanimated.Text style={[s.folioFigure, inkStyle]} allowFontScaling={false}>
        {slideNumeral(index)}
      </Reanimated.Text>
      <Reanimated.View style={[s.folioDiamond, diamondStyle]} />
      <Reanimated.Text style={[s.folioTotal, inkStyle]} allowFontScaling={false}>
        {slideNumeral(total - 1)}
      </Reanimated.Text>
    </View>
  );
}

function RuledChannel({
  at, total, track, onTrack, leafY, cover,
}: {
  at: SharedValue<number>;
  total: number;
  track: number;
  onTrack: (width: number) => void;
  leafY: SharedValue<number>;
  cover: number;
}) {
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    onTrack(event.nativeEvent.layout.width);
  }, [onTrack]);

  const tint = useAnimatedStyle(() => {
    const onLeaf = Math.min(1, Math.max(0, leafY.value / cover));
    return {
      backgroundColor: interpolateColor(onLeaf, [0, 1], [
        interpolateColor(at.value, PART_STOPS, PART_LIT) as string,
        interpolateColor(at.value, PART_STOPS, PART_INK) as string,
      ]),
    };
  }, [cover]);

  /* ⚠ THE INK IS SCALED, NOT RESIZED, and the mark rides the same value
     rather than running on a clock of its own — so the rule and the
     diamond can never disagree about where the reading is. */
  const inkStyle = useAnimatedStyle(() => {
    const onLeaf = Math.min(1, Math.max(0, leafY.value / cover));
    return {
      transform: [{ scaleX: (at.value + 1) / total }],
      backgroundColor: interpolateColor(onLeaf, [0, 1], [
        interpolateColor(at.value, PART_STOPS, PART_LIT) as string,
        interpolateColor(at.value, PART_STOPS, PART_INK) as string,
      ]),
    };
  }, [cover, total]);

  const markStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: track * ((at.value + 1) / total) }],
  }), [track]);

  return (
    <View style={s.channel} onLayout={onLayout} pointerEvents="none">
      <Reanimated.View style={[s.channelTrack, s.channelTrackTint, tint]} />
      <View style={s.channelInk}>
        <Reanimated.View style={[s.channelInkLine, { width: track }, inkStyle]} />
        {/* The mark the rubricator leaves at the head of the ink. */}
        <Reanimated.View style={[s.channelMark, markStyle]}>
          <Reanimated.View style={[s.channelMarkDiamond, tint]} />
        </Reanimated.View>
      </View>
      {/* A ruled line in a manuscript is stopped at both ends by a short
          serif, not left to fade out. */}
      <Reanimated.View style={[s.channelSerif, s.channelSerifStart, s.channelSerifTint, tint]} />
      <Reanimated.View style={[s.channelSerif, s.channelSerifEnd, s.channelSerifTint, tint]} />
    </View>
  );
}

/* ── One figure, lying over the last ─────────────────────────────────
 *
 * ⚠ ABSOLUTE, AND FADED BY THE PAGER'S OWN OFFSET. The cross-fade is not
 * fired when the page changes — it IS the swipe, so a drag half way
 * across leaves the icon and the eyes half way between each other, and
 * letting go either finishes the exchange or takes it back. It drifts at
 * a fifth of the page's speed, because two objects exchanging in a fixed
 * frame look like a slideshow and the same exchange with the incoming
 * object still travelling looks like a room being walked through.
 *
 * Only the page in view and its two neighbours are mounted: there is no
 * reason for the hand, the book and both composites to be decoded while
 * somebody is reading page one.
 */
function FigureLayer({
  at, index, mounted, width, children,
}: {
  at: SharedValue<number>;
  index: number;
  mounted: boolean;
  width: number;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const away = at.value - index;
    return {
      opacity: Math.max(0, 1 - Math.abs(away) * 1.25),
      transform: [{ translateX: -away * width * 0.2 }],
    };
  }, [index, width]);

  if (!mounted) return null;

  return (
    <Reanimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {children}
    </Reanimated.View>
  );
}

/* ── What stands in the chapel ───────────────────────────────────── */

/** The gap between two things standing side by side. */
const PAIR_GAP = 12;
/** What a caption and a pair of names are allowed to take off the wall. */
const CAPTION_ROOM = 32;
const NAME_ROOM = 26;
/**
 * What the sill takes: ten points of air and the hairline itself.
 *
 * ⚠ IT HAS TO BE RESERVED OR IT IS NEVER SEEN. The board was sized to the
 * whole of the room, which put the light it stands on ten points BELOW
 * the room — under the leaf, where nothing is drawn.
 */
const SILL_ROOM = 11;

function Figure({
  slide, width, room, figureTop, whole,
}: {
  slide: PantocratorSlide;
  width: number;
  room: number;
  figureTop: number;
  whole: boolean;
}) {
  const stage = { top: figureTop, height: room };
  const inner = width - 40;

  /* THE WHOLE BOARD, TAKING EVERY POINT OF WALL THERE IS.
     ⚠ IT HAS NO CAPTION AND IT STANDS ON A SILL. A tall narrow board on
     a wide wall is the one figure in this sheet that cannot fill its
     room, so it is given the whole of the room's height and a hairline
     of light where it stands — which is what stops it reading as a
     photograph floating in the middle of a dark rectangle. */
  if (slide.figure === 'panel') {
    const tall = Math.min(room - SILL_ROOM, inner / PANEL_ASPECT);
    return (
      <View style={[s.stand, stage]}>
        <View style={s.standRoom}>
          <View>
            <PantocratorPanel height={tall} style={s.board} />
            <View style={s.sill}>
              <LinearGradient
                colors={['rgba(246,227,184,0)', 'rgba(246,227,184,0.8)', 'rgba(246,227,184,0.8)', 'rgba(246,227,184,0)']}
                locations={[0, 0.18, 0.82, 1]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={['rgba(255,203,125,0.3)', 'rgba(255,203,125,0)']}
                style={s.sillGlow}
              />
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (slide.figure === 'gaze') {
    const crop = PANTOCRATOR_DETAILS.gaze;
    const tall = Math.min(room - CAPTION_ROOM, inner / detailAspect(crop));
    return (
      <FigureStand stage={stage} caption={slide.caption}>
        <PantocratorDetail crop={crop} height={tall} />
      </FigureStand>
    );
  }

  if (slide.figure === 'hands') {
    const { hand, book } = PANTOCRATOR_DETAILS;
    const tall = Math.min(
      room - CAPTION_ROOM - NAME_ROOM,
      (inner - PAIR_GAP) / (detailAspect(hand) + detailAspect(book)),
    );
    return (
      <FigureStand stage={stage} caption={slide.caption}>
        <View style={s.pair}>
          <View>
            <PantocratorDetail crop={hand} height={tall} />
            <Text style={s.figureName}>{PANTOCRATOR_DETAIL_LABELS.hand}</Text>
          </View>
          <View>
            <PantocratorDetail crop={book} height={tall} />
            <Text style={s.figureName}>{PANTOCRATOR_DETAIL_LABELS.book}</Text>
          </View>
        </View>
      </FigureStand>
    );
  }

  if (slide.figure === 'faces') {
    /* ⚠ ONE COLUMN SETS THE HEIGHT FOR BOTH STATES, so the pair and the
       single board are the same box and the change between them is pure
       opacity — nothing on the wall is laid out a second time when the
       reader taps. */
    const column = faceColumn(inner, room - CAPTION_ROOM - NAME_ROOM);
    const tall = faceHeight(column);
    if (!PANTOCRATOR_IMAGE) {
      return (
        <FigureStand
          stage={stage}
          caption="The two composites appear here once the icon file is added to the app."
        >
          <PantocratorFace width={column} mode="whole" />
        </FigureStand>
      );
    }
    return (
      <FigureStand
        stage={stage}
        caption={whole ? PANTOCRATOR_FACE_CAPTIONS.whole : slide.caption}
      >
        <View style={{ height: tall + NAME_ROOM }}>
          <FaceState show={!whole}>
            <View style={s.pair}>
              <View>
                <PantocratorFace width={column} mode="mercy" />
                <Text style={s.figureName}>{PANTOCRATOR_FACE_LABELS.mercy}</Text>
              </View>
              <View>
                <PantocratorFace width={column} mode="judgement" />
                <Text style={s.figureName}>{PANTOCRATOR_FACE_LABELS.judgement}</Text>
              </View>
            </View>
          </FaceState>
          <FaceState show={whole}>
            <View style={s.pairCentre}>
              <PantocratorFace width={column} mode="whole" />
              <Text style={s.figureName}>{PANTOCRATOR_FACE_LABELS.whole}</Text>
            </View>
          </FaceState>
        </View>
      </FigureStand>
    );
  }

  return null;
}

/**
 * ⚠ THE LABEL LINE IS PINNED AND THE FIGURE FLOATS ABOVE IT. Centring
 * the whole stack put the caption at a different height on every page, so
 * cross-fading from one to the next slid a line of italic up the wall for
 * no reason. A museum's labels run at one height along a wall, and for
 * the same reason: it is the wall that is read, not each card on its own.
 *
 * ⚠ AND NO ENTERING ANIMATION IN HERE. The figures mount and unmount as
 * the reader moves — a neighbour comes into existence one page before it
 * is wanted — so an arrival animation would fire while a swipe was
 * already halfway across. The sheet's arrival belongs to the chapel,
 * which is mounted exactly once.
 */
function FigureStand({
  stage, caption, children,
}: {
  stage: { top: number; height: number };
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={[s.stand, stage]}>
      <View style={s.standRoom}>{children}</View>
      {!!caption && <Text style={s.caption}>{caption}</Text>}
    </View>
  );
}

/** One of the two states of the faces figure, lying over the other. */
function FaceState({ show, children }: { show: boolean; children: React.ReactNode }) {
  const at = useSharedValue(show ? 1 : 0);
  useEffect(() => {
    at.value = withTiming(show ? 1 : 0, { duration: 260 });
  }, [at, show]);
  const style = useAnimatedStyle(() => ({ opacity: at.value }), []);
  return (
    <Reanimated.View style={[StyleSheet.absoluteFill, s.faceState, style]}>
      {children}
    </Reanimated.View>
  );
}

/**
 * How tall a composite of this width comes out.
 *
 * ⚠ THE CROP'S OWN ARITHMETIC, not a guess: the crop spans `2 × halfWidth`
 * across the board and `bottom − top` down it. Written here because the
 * wall has to reserve the height before either state has been laid out,
 * or the figure would settle a frame late.
 */
function faceHeight(column: number): number {
  const cropW = FACE.halfWidth * 2;
  const cropH = FACE.bottom - FACE.top;
  return Math.round((cropH * (column / cropW)) / PANEL_ASPECT);
}

/** The widest column of the pair that still stands in the room it has. */
function faceColumn(inner: number, room: number): number {
  const wide = Math.floor((inner - PAIR_GAP) / 2);
  const tall = faceHeight(wide);
  return tall <= room ? wide : Math.floor((wide * room) / tall);
}

/* ── One leaf ───────────────────────────────────────────────────────── */

const Leaf = ({
  ref, slide, width, head, minLeaf, bottom, leafY, last, whole, onWhole,
}: {
  ref: (leaf: ScrollView | null) => void;
  slide: PantocratorSlide;
  width: number;
  /** The clear wall above the page, inside the scroller. */
  head: number;
  minLeaf: number;
  bottom: number;
  /** Shared with the chapel — see the note below. */
  leafY: SharedValue<number>;
  last: boolean;
  whole: boolean;
  onWhole: (whole: boolean) => void;
}) => {
  const [first, ...rest] = slide.body;
  const runs = splitBold(first);
  const versal = takeVersal(runs);
  const accent = slide.accent;
  const eyebrowInk = plaqueInk(accent, 38);

  /* ⚠ ONE HANDLER PER LEAF, WRITING INTO ONE SHARED VALUE. The five pages
     could share a single handler — only the page in view ever scrolls —
     but a handler attached to five scroll views at once is a thing to
     have to be sure of, and there is nothing to buy by being clever. */
  const onScroll = useAnimatedScrollHandler({
    onScroll: event => {
      leafY.value = event.contentOffset.y;
    },
  });

  return (
    <Reanimated.ScrollView
      ref={ref as never}
      style={{ width }}
      contentContainerStyle={{ paddingTop: head }}
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
    >
      <View style={[s.leaf, { minHeight: minLeaf, paddingBottom: bottom }]}>
        {/* ⚠ THE GROUND IS THE ONE THING THAT CLIPS. A shadow is drawn by
            the layer that owns it, and a layer that clips to its own
            bounds clips its shadow away with everything else. */}
        <View pointerEvents="none" style={s.leafGround}>
          <LinearGradient
            colors={PARCHMENT}
            locations={[0, 0.46, 1]}
            start={{ x: 0.12, y: 0 }}
            end={{ x: 0.88, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* The incised edge every raised surface in this app has: the
              cut, and the light caught immediately inside it. */}
          <View style={s.leafEdge} />
          <View style={s.leafCatch} />
        </View>

        <Text style={[s.eyebrow, { color: eyebrowInk }]}>{slide.eyebrow}</Text>
        <Text style={s.title}>{slide.title}</Text>

        {slide.figure === 'faces' && (
          <FacesSwitch accent={accent} whole={whole} onWhole={onWhole} />
        )}

        {!!slide.plate?.length && (
          <View style={s.plate}>
            {slide.plate.map(row => (
              <View key={row.label} style={[s.plateRow, { borderBottomColor: plaqueAlpha(accent, 0.22) }]}>
                <Text style={[s.plateLabel, { color: plaqueAlpha(accent, 0.9) }]}>{row.label}</Text>
                <Text style={s.plateValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* The prayer card's own ornament, opening the reading. */}
        <View style={s.ornament}>
          <View style={[s.ornamentLine, { backgroundColor: plaqueAlpha(accent, 0.3) }]} />
          <View style={[s.ornamentDiamond, { backgroundColor: plaqueAlpha(accent, 0.6) }]} />
          <View style={[s.ornamentLine, { backgroundColor: plaqueAlpha(accent, 0.3) }]} />
        </View>

        {/* ⚠ THE VERSAL IS SIZED TO ITS LINE. It used to be set at 34 over
            34 inside prose at 17 over 27 — twice the height of the text it
            opened, on a line seven points taller than every line under it.
            It read as a mistake, not a flourish. A versal is one and a
            half times its text, so the opening paragraph is a lead at 18
            over 26 and the letter is 27 on a 29-point line. */}
        <Text style={s.lead}>
          {versal && (
            <Text style={[s.versal, { color: plaqueInk(accent, 32) }]}>{versal.initial}</Text>
          )}
          {(versal ? versal.rest : runs).map((run, runIndex) => (
            <Text key={runIndex} style={run.bold ? s.leadStrong : undefined}>
              {run.text}
            </Text>
          ))}
        </Text>

        {rest.map(paragraph => (
          <Text key={paragraph.slice(0, 24)} style={s.body}>
            {splitBold(paragraph).map((run, runIndex) => (
              <Text key={runIndex} style={run.bold ? s.strong : undefined}>
                {run.text}
              </Text>
            ))}
          </Text>
        ))}

        {!!slide.envoi && (
          <View style={s.envoiWrap}>
            <View style={[s.envoiMark, { backgroundColor: plaqueAlpha(accent, 0.7) }]} />
            <Text style={[s.envoi, { color: plaqueInk(accent, 30) }]}>{slide.envoi}</Text>
          </View>
        )}

        {last && (
          <View style={s.colophon}>
            <View style={s.colophonRule} />
            <Text style={s.colophonText}>{PANTOCRATOR_SOURCE_NOTE}</Text>
          </View>
        )}
      </View>
    </Reanimated.ScrollView>
  );
};

/**
 * THE CONTROL OVER THE TWO COMPOSITES.
 *
 * ⚠ IT SITS ON THE LEAF, NOT ON THE WALL — a segmented control floating
 * over a sixth-century face is furniture standing in front of the
 * exhibit. Under the title it is what it actually is: the caption's own
 * switch, and the first thing on the page, so nobody meets the
 * composites without meeting the way to check them against the original.
 *
 * ⚠ AND IT IS CUT FROM THE ROUNDEL'S STONE, with the same hairline and
 * the same catch-light inside it.
 */
function FacesSwitch({
  accent, whole, onWhole,
}: {
  accent: string;
  whole: boolean;
  onWhole: (whole: boolean) => void;
}) {
  return (
    <View style={s.switch}>
      <View pointerEvents="none" style={[s.switchFace, { borderColor: plaqueAlpha(accent, 0.42) }]} />
      <View pointerEvents="none" style={s.switchCatch} />
      {([false, true] as const).map(candidate => {
        const here = candidate === whole;
        return (
          <TouchableOpacity
            key={String(candidate)}
            onPress={() => onWhole(candidate)}
            activeOpacity={0.82}
            haptic="selection"
            style={[s.switchSeat, here && s.switchSeatHere]}
            accessibilityRole="button"
            accessibilityState={{ selected: here }}
          >
            <Text style={[s.switchText, here && { color: plaqueInk(accent, 30) }]}>
              {candidate ? PANTOCRATOR_FACE_VIEWS.whole : PANTOCRATOR_FACE_VIEWS.halves}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  /**
   * ⚠ THE MODAL IS TRANSPARENT AND THE PRAYER SCREEN IS BEHIND IT, which
   * is what lets the room step back into depth rather than fall out of
   * the bottom of the phone. The scrim is what keeps the edges of a
   * scaled room from flashing bright paper on the way in and out — warm,
   * like every other shadow on these screens, because a neutral one over
   * warm paper reads as the phone dimming.
   */
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(18,11,4,0.97)' },
  roomMotion: { flex: 1 },

  room: { flex: 1, backgroundColor: '#16100A' },

  // ── The chapel ─────────────────────────────────────────────────────
  chapel: { position: 'absolute', left: 0, right: 0, top: 0, overflow: 'hidden' },

  /** The board — see the note in Figure. */
  board: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.66,
    shadowRadius: 40,
    elevation: 18,
  },
  sill: { height: 1, marginTop: 10 },
  sillGlow: { position: 'absolute', left: -26, right: -26, top: 1, height: 22 },

  stand: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  /** The wall above the label line — the figure hangs in the middle of it. */
  standRoom: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pair: { flexDirection: 'row', gap: PAIR_GAP, alignItems: 'flex-end' },
  pairCentre: { alignItems: 'center' },
  faceState: { alignItems: 'center', justifyContent: 'flex-start' },
  figureName: {
    marginTop: 10,
    fontFamily: F.sansBold,
    fontSize: 8.5,
    letterSpacing: 1.9,
    textAlign: 'center',
    color: 'rgba(240,214,158,0.92)',
    textTransform: 'uppercase',
  },
  caption: {
    marginTop: 12,
    fontFamily: F.serifItalic,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,240,214,0.66)',
    textAlign: 'center',
    paddingHorizontal: 14,
  },

  // ── The head-band ──────────────────────────────────────────────────
  head: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 20 },
  bandGround: { position: 'absolute', left: 0, right: 0, top: 0 },
  headRow: { flexDirection: 'row', alignItems: 'center' },
  headSpacer: { width: 34 },
  folio: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  folioFigure: { fontFamily: F.serifSemiBold, fontSize: 19, lineHeight: 24 },
  folioDiamond: { width: 4, height: 4, borderRadius: 1, opacity: 0.55, transform: [{ rotate: '45deg' }] },
  folioTotal: { fontFamily: F.serif, fontSize: 17, lineHeight: 24, opacity: 0.62 },

  /** Cut from the same stone as the plaque, by the same means. */
  roundel: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: STONE,
  },
  roundelFace: { ...StyleSheet.absoluteFillObject, borderRadius: 17, borderWidth: 1 },
  roundelCatch: {
    position: 'absolute',
    top: 1, left: 1, right: 1, bottom: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
  },

  // The ruled channel — the reader's, in the reader's proportions.
  channel: { height: 9, marginTop: 10, marginHorizontal: 3, justifyContent: 'center' },
  channelTrack: { position: 'absolute', left: 0, right: 0, height: 1.5, borderRadius: 1 },
  channelTrackTint: { opacity: 0.26 },
  channelInk: { position: 'absolute', left: 0, right: 0, height: 9, justifyContent: 'center' },
  // 2.25 against the track's 1.5. What has been read is a line the pen has
  // gone over; an unread rule is the ruling underneath it.
  channelInkLine: { height: 2.25, borderRadius: 1.2, transformOrigin: 'left center' },
  channelMark: { position: 'absolute', left: -2.75, alignItems: 'center', justifyContent: 'center' },
  channelMarkDiamond: { width: 5.5, height: 5.5, borderRadius: 1, transform: [{ rotate: '45deg' }] },
  channelSerif: { position: 'absolute', width: 1.2, height: 7, borderRadius: 0.6 },
  channelSerifTint: { opacity: 0.5 },
  channelSerifStart: { left: 0 },
  channelSerifEnd: { right: 0 },

  // ── The pages ──────────────────────────────────────────────────────
  pager: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'transparent' },

  leaf: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderCurve: 'continuous',
    // The shadow needs a shape to be cast by, and a transparent view has
    // none. The gradient lies over this and is never seen.
    backgroundColor: '#FDFBF6',
    paddingHorizontal: 24,
    paddingTop: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -14 },
    shadowOpacity: 0.38,
    shadowRadius: 32,
    // ⚠ NO ELEVATION. Android draws elevation shadows downward whatever
    // the offset says, so this one would be invisible — and elevation
    // also reorders siblings, which would put the page over the way out.
  },
  leafGround: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  leafEdge: { position: 'absolute', left: 0, right: 0, top: 0, height: 1, backgroundColor: GOLD_HAIR },
  leafCatch: {
    position: 'absolute',
    left: 1, right: 1, top: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },

  eyebrow: {
    fontFamily: F.sansBold,
    fontSize: 8.5,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 8,
    fontFamily: F.serifMedium,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.4,
    color: C.text,
  },

  /**
   * THE MUSEUM PLATE — what a museum hangs beside a panel.
   *
   * ⚠ IT REPLACED A RUN-ON STRIP OF TRACKED CAPITALS: "MID-6TH CENTURY ◆
   * HOT WAX ON PANEL ◆ 84 × 45.5 CM", three unlike facts at nine and a
   * half points with nothing saying which was which.
   */
  plate: { marginTop: 13 },
  plateRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  plateLabel: {
    fontFamily: F.sansBold,
    fontSize: 8,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  plateValue: { fontFamily: F.serifMedium, fontSize: 16, lineHeight: 20, color: BODY_INK },

  ornament: { marginTop: 13, flexDirection: 'row', alignItems: 'center', gap: 8 },
  ornamentLine: { flex: 1, height: 1 },
  ornamentDiamond: { width: 5, height: 5, borderRadius: 1, transform: [{ rotate: '45deg' }] },

  /* ⚠ THE LEADING CAME IN. The prose was set 17 over 27 and the opening
     18 over 28 — a measure for a printed page held at reading distance,
     not for a phone, where it left the lines swimming and cost a fifth of
     every screen. 17 over 25 and 18 over 26 is still generous for a serif
     and puts two more lines on the page. */
  lead: { marginTop: 13, fontFamily: F.serif, fontSize: 18, lineHeight: 26, color: LEAD_INK },
  leadStrong: { fontFamily: F.serifSemiBold, color: BOLD_INK },
  versal: { fontFamily: F.serifSemiBold, fontSize: 27, lineHeight: 29 },
  body: { marginTop: 11, fontFamily: F.serif, fontSize: 17, lineHeight: 25, color: BODY_INK },
  strong: { fontFamily: F.serifSemiBold, color: BOLD_INK },

  /** The last line of the sheet, given its own measure. */
  envoiWrap: { marginTop: 20, alignItems: 'center' },
  envoiMark: { width: 5, height: 5, marginBottom: 13, borderRadius: 1, transform: [{ rotate: '45deg' }] },
  envoi: {
    fontFamily: F.serifMedium,
    fontSize: 19,
    lineHeight: 27,
    textAlign: 'center',
    paddingHorizontal: 4,
  },

  // ⚠ The one gap on this page that stays large. It is not separating two
  // blocks of the same page — it is separating the page from the note
  // about where the page came from.
  colophon: { marginTop: 22, alignItems: 'center', gap: 9 },
  colophonRule: { width: 34, height: 1, opacity: 0.6, backgroundColor: C.gold },
  colophonText: {
    fontFamily: F.serifItalic,
    fontSize: 12.5,
    lineHeight: 18,
    color: 'rgba(74,64,56,0.56)',
    textAlign: 'center',
  },

  // ── The switch ─────────────────────────────────────────────────────
  switch: {
    marginTop: 13,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    padding: 3,
    borderRadius: 13,
    borderCurve: 'continuous',
    backgroundColor: STONE,
  },
  switchFace: { ...StyleSheet.absoluteFillObject, borderRadius: 13, borderWidth: 1 },
  switchCatch: {
    position: 'absolute',
    top: 1, left: 1, right: 1, bottom: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  switchSeat: {
    minHeight: 32,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchSeatHere: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#8C7A4F',
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  switchText: { fontFamily: F.serifMedium, fontSize: 14.5, color: 'rgba(74,64,56,0.5)' },

  // ── The foot ───────────────────────────────────────────────────────
  foot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footRule: {
    position: 'absolute',
    top: 0,
    left: 22,
    right: 22,
    height: 1,
    backgroundColor: 'rgba(197,160,89,0.28)',
  },
  plaque: { flex: 1 },
});
