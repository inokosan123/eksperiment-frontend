import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import Reanimated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import {
  FACE,
  PANEL_ASPECT,
  PANTOCRATOR_DETAILS,
  PANTOCRATOR_IMAGE,
  PantocratorDetail,
  PantocratorFace,
  PantocratorPanel,
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
 * ABOUT THE ICON — a chapel with a book open under it.
 *
 * ⚠ IT WAS FIVE PAGES OF GREY SERIF ON BEIGE. One small panel at the top
 * of page one, two mirrored faces on page three, and three pages that
 * were prose alone — a page about the blessing hand with no hand on it, a
 * page about the Gospel book with no book, while a photograph containing
 * both sat two swipes away. The writing was good and nothing carried it.
 *
 * THE ROOM IS NOW TWO ROOMS, AND THAT IS THE WHOLE IDEA.
 *
 *   THE CHAPEL, above. Dark, warm, with a lamp burning in it. The icon
 *   stands the full height of it, edge to edge, the way the object
 *   actually is — a metre of painted board, not a stamp on a page. This
 *   is what the file's own PrayerLamp note has always said the panel
 *   wants: "an icon in the dark with a lamp burning in front of it is not
 *   a metaphor for anything, it is what the object is for."
 *
 *   THE LEAF, below. Parchment, rounded over the chapel's foot, carrying
 *   the reading. It rides UP over the chapel as you read and comes back
 *   down when you are done, so the page you are reading and the thing you
 *   are reading about are never in competition for the screen.
 *
 * ⚠ THE FIGURE CHANGES WITH THE PAGE AND THE LAMP DOES NOT. Swiping
 * cross-fades the whole board into the eyes, the eyes into the two
 * mirrored composites, those into the hand and the book, and the last
 * page pulls back to the whole board again. The light stays lit and the
 * thing in it changes — the same exchange the prayer screen makes
 * between the cross and the icon, which is why it belongs here.
 *
 * ⚠ AND THE CHAPEL PARALLAXES BEHIND THE LEAF at a quarter of its speed,
 * which is the only reason the two rooms read as one deep room rather
 * than as a picture with a card taped under it.
 *
 * ⚠ STILL NO GESTURE HANDLER. RNGH inside a Modal crashes Android unless
 * the content carries its own GestureHandlerRootView, and nothing here
 * needs it: a horizontal ScrollView with pagingEnabled brings the swipe,
 * the snap and the momentum on the platform's own thread, and Reanimated
 * reads its offset without owning it.
 * ───────────────────────────────────────────────────────────────────── */

/* ── The chapel ─────────────────────────────────────────────────────── */
const CHAPEL = ['#0C0703', '#1A1109', '#241708', '#2B1C0A'] as const;
const CHAPEL_STOPS = [0, 0.4, 0.76, 1] as const;
const LAMP_CORE = '#FFC978';
const LAMP_MID = '#F0BE7A';
const LAMP_EDGE = '#E9C58E';

/** Ink that reads on the chapel wall. */
const ON_DARK = 'rgba(255,236,205,0.85)';
const ON_DARK_SOFT = 'rgba(255,236,205,0.60)';
const GILT = '#E2BB74';

/* ── The leaf ───────────────────────────────────────────────────────── */
const PARCHMENT = ['#FDFBF6', '#F8F2E6', '#F3EBDB'] as const;
const GOLD_INK = '#8B6B2F';
const GOLD_HAIR = 'rgba(197,160,89,0.36)';
const BODY_INK = '#4A4038';
const LEAD_INK = '#463C33';

/**
 * How tall the chapel stands, how much of the page must survive under
 * it, and how far the leaf laps over its foot.
 *
 * ⚠ THE LAP IS THE WHOLE TRICK. A page that stops short of the wall is a
 * card pinned to it; a page that runs eight points over the wall's edge
 * is lying on something. Eight is enough to be seen at the rounded
 * corners and not so much that the board's foot is eaten.
 */
const CHAPEL_SHARE = 0.545;
const MIN_LEAF = 250;
const LEAF_LAP = 8;

/* ── The rule of three parts ────────────────────────────────────────── */
const SLIDE_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;

function slideNumeral(index: number): string {
  return SLIDE_NUMERALS[index] ?? String(index + 1);
}

/**
 * The opening letter, raised.
 *
 * ⚠ THE SAME RULE AS THE PRAYER READER (`PrayerBookView`'s `takeVersal`):
 * only a real letter takes one, because a raised quotation mark is worse
 * than no flourish at all, and a short line is left alone because a
 * versal on three words reads as a mistake.
 */
function takeVersal(content: string): { initial: string; rest: string } | null {
  const text = content.trimStart();
  if (text.length < 24) return null;
  const initial = text.slice(0, 1);
  if (initial.toUpperCase() === initial.toLowerCase()) return null;
  return { initial, rest: text.slice(1) };
}

export default function PantocratorAboutSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const [facesWhole, setFacesWhole] = useState(false);
  const pager = useRef<ScrollView>(null);
  const leaves = useRef<(ScrollView | null)[]>([]);
  const total = PANTOCRATOR_SLIDES.length;

  const metrics = useMemo(() => {
    const foot = 13 + 52 + Math.max(insets.bottom, 12) + 6;
    /* ⚠ THE CHAPEL IS BUDGETED AGAINST THE PAGE, not taken off the top.
       A flat share of the screen is right on a large phone and wrong on a
       small one: 0.545 of 852 leaves a page opening on its title, its
       plate and a line of prose, and 0.545 of 667 leaves one opening on
       a title and nothing — which reads as a picture with a caption
       stuck under it rather than as a page you are meant to read. So it
       takes a little over half, and never so much that the leaf shows
       less than MIN_LEAF. */
    const chapel = Math.round(Math.min(
      height * CHAPEL_SHARE,
      height - foot - MIN_LEAF + LEAF_LAP,
      520,
    ));
    const headTop = insets.top + 8;
    // Where a figure that is not the whole board may stand: clear of the
    // rail above it and of the leaf's rounded edge below.
    const figureTop = headTop + 42;
    const leafTop = chapel - LEAF_LAP;
    return {
      chapel,
      headTop,
      figureTop,
      leafTop,
      foot,
      /** How far the leaf travels before it has covered the chapel. */
      cover: Math.max(1, leafTop - (headTop + 34)),
    };
  }, [height, insets.bottom, insets.top]);

  /** Where the pager stands, in pages. Drives every cross-fade. */
  const at = useSharedValue(0);
  /** How far the leaf of the page in view has been read up. */
  const leafY = useSharedValue(0);
  /** Which page the shared value last announced — see the handler. */
  const announced = useSharedValue(0);

  // Opening it again opens it at the beginning. A sheet that remembers
  // page five is a sheet that opens on a sentence with no beginning.
  useEffect(() => {
    if (!visible) return;
    setPage(0);
    setFacesWhole(false);
    at.value = 0;
    leafY.value = 0;
    announced.value = 0;
    pager.current?.scrollTo({ x: 0, animated: false });
  }, [announced, at, leafY, visible]);

  /**
   * ⚠ THE PAGE IS ANNOUNCED FROM THE UI THREAD, ONCE PER PAGE. Calling
   * back into JavaScript on every scroll frame to keep a `useState` in
   * step would spend a bridge hop per frame on a value that changes five
   * times in the life of the sheet; comparing against `announced` first
   * means the hop happens only when the answer is different.
   */
  const onPagerScroll = useAnimatedScrollHandler({
    onScroll: event => {
      at.value = event.contentOffset.x / width;
      const next = Math.round(at.value);
      if (next !== announced.value && next >= 0 && next < total) {
        announced.value = next;
        // The page arriving is at the top of its own reading, and the
        // head has to know that while the swipe is still running or it
        // would still be dressed for parchment over a dark chapel.
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

  const next = page < total - 1 ? PANTOCRATOR_SLIDES[page + 1] : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="overFullScreen"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={s.room}>
        {/* ── THE CHAPEL ───────────────────────────────────────────────
            Behind everything, and moving a quarter as far as the leaf
            that covers it. */}
        <Reanimated.View
          pointerEvents="none"
          entering={FadeIn.duration(520)}
          style={[s.chapel, { height: metrics.chapel }, chapelStyle]}
        >
          <LinearGradient
            colors={CHAPEL}
            locations={CHAPEL_STOPS}
            style={StyleSheet.absoluteFill}
          />
          <Lamp width={width} height={metrics.chapel} />

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
                chapel={metrics.chapel}
                figureTop={metrics.figureTop}
                leafTop={metrics.leafTop}
                whole={facesWhole}
              />
            </FigureLayer>
          ))}

          {/* The lintel. A dark head is the only way the rail and the
              way out stay legible over a gilded halo. */}
          <LinearGradient
            colors={['rgba(8,5,2,0.62)', 'rgba(8,5,2,0.26)', 'rgba(8,5,2,0)']}
            locations={[0, 0.48, 1]}
            style={[s.lintel, { height: insets.top + 110 }]}
          />
        </Reanimated.View>

        {/* ── THE PAGES ────────────────────────────────────────────────
            Transparent, so the chapel is the ground they lie on. */}
        <Reanimated.ScrollView
          ref={pager as never}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onPagerScroll}
          onMomentumScrollEnd={() => restOthers(page)}
          scrollEventThrottle={16}
          style={[s.pager, { bottom: metrics.foot }]}
        >
          {PANTOCRATOR_SLIDES.map((slide, index) => (
            <Leaf
              key={slide.id}
              ref={leaf => { leaves.current[index] = leaf; }}
              slide={slide}
              index={index}
              width={width}
              minLeaf={height - metrics.leafTop}
              leafTop={metrics.leafTop}
              bottom={metrics.foot + 26}
              leafY={leafY}
              last={index === total - 1}
              whole={facesWhole}
              onWhole={setFacesWhole}
            />
          ))}
        </Reanimated.ScrollView>

        {/* ── THE HEAD ─────────────────────────────────────────────────
            Where you are, and the way out. Both are dressed for the
            chapel and re-dress themselves for parchment as the leaf rises
            over it — see RailSegment and CloseChip.

            ⚠ box-none, OR IT EATS THE TOP OF EVERY SWIPE. This bar lies
            over the head of the pager; a plain View there is a hit target
            like any other, and the band across the top of the icon —
            which is exactly where a thumb reaches to turn a page — would
            answer nothing at all. */}
        <View
          pointerEvents="box-none"
          style={[s.head, { paddingTop: metrics.headTop }]}
        >
          <ReadingRail page={page} total={total} onGo={goTo} leafY={leafY} cover={metrics.cover} />
          <CloseChip onPress={onClose} leafY={leafY} cover={metrics.cover} />
        </View>

        {/* ── THE FOOT ─────────────────────────────────────────────────
            ⚠ IT NAMES THE PAGE IT IS GOING TO. A bare arrow says only
            that there is more; a title says what the more IS, and a
            reader goes on because they want that page rather than
            because a control existed. */}
        <LinearGradient
          colors={['rgba(245,237,223,0)', '#F5EDDF', '#F3EADA']}
          locations={[0, 0.3, 1]}
          style={[s.foot, { paddingBottom: Math.max(insets.bottom, 12) + 6 }]}
          pointerEvents="box-none"
        >
          <View style={s.footRule} />
          {page > 0 ? (
            <TouchableOpacity
              onPress={() => goTo(page - 1)}
              activeOpacity={0.78}
              haptic="selection"
              style={s.back}
              accessibilityRole="button"
              accessibilityLabel="Previous page"
            >
              <ChevronLeft s={17} c={GOLD_INK} w={2} />
            </TouchableOpacity>
          ) : (
            <View style={s.backSpacer} />
          )}

          <TouchableOpacity
            onPress={next ? () => goTo(page + 1) : onClose}
            activeOpacity={0.86}
            haptic="selection"
            style={s.on}
            accessibilityRole="button"
            accessibilityLabel={next ? `Next: ${next.title}` : 'Return to the icon'}
          >
            {/* ⚠ THE DESTINATION FADES, IT DOES NOT CUT. This plate names
                the page it is going to, so its title changes on every
                turn; swapped outright it flickered a new sentence into
                place under a thumb that had just left the screen. Keyed
                on the page, it arrives the way the page did. */}
            <Reanimated.View key={page} entering={FadeIn.duration(240)} style={s.onCopy}>
              {!!next && <Text style={s.onKicker}>NEXT</Text>}
              <Text style={s.onTitle} numberOfLines={1}>
                {next ? next.title : 'Return to the icon'}
              </Text>
            </Reanimated.View>
            <View style={s.onChevron}>
              <ChevronRight s={16} c={GOLD_INK} w={2} />
            </View>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </Modal>
  );
}

/* ── The lamp ────────────────────────────────────────────────────────
 *
 * One warm pool, low in the chapel, drawn once. ⚠ OPACITY AND NOTHING
 * ELSE: scaling a soft gradient on Android resamples its bitmap, and this
 * app has been bitten by that before. It does not move at all here — the
 * chapel it lives in is what parallaxes.
 */
function Lamp({ width, height }: { width: number; height: number }) {
  const size = Math.round(Math.max(width, height) * 1.5);
  return (
    <Reanimated.View
      pointerEvents="none"
      entering={FadeIn.duration(760)}
      style={[
        s.lamp,
        { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 },
      ]}
      shouldRasterizeIOS
      renderToHardwareTextureAndroid
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="aboutLamp" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={LAMP_CORE} stopOpacity={0.32} />
            <Stop offset="0.42" stopColor={LAMP_MID} stopOpacity={0.14} />
            <Stop offset="1" stopColor={LAMP_EDGE} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse
          cx={size / 2}
          cy={size / 2}
          rx={size / 2}
          ry={size / 2}
          fill="url(#aboutLamp)"
        />
      </Svg>
    </Reanimated.View>
  );
}

/* ── One figure, lying over the last ─────────────────────────────────
 *
 * ⚠ ABSOLUTE, AND FADED BY THE PAGER'S OWN OFFSET. The cross-fade is not
 * fired when the page changes — it IS the swipe, so a drag half way
 * across leaves the icon and the eyes half way between each other, and
 * letting go either finishes the exchange or takes it back.
 *
 * ⚠ AND IT DRIFTS AT A FIFTH OF THE PAGE'S SPEED. Two objects exchanging
 * in a fixed frame look like a slideshow; the same exchange with the
 * incoming object still travelling looks like a room being walked
 * through.
 *
 * Only the page in view and its two neighbours are mounted: the figures
 * hold as many as four windows onto the board apiece, and there is no
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
    <Reanimated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, style]}
    >
      {children}
    </Reanimated.View>
  );
}

/* ── What stands in the chapel ───────────────────────────────────── */

function Figure({
  slide, width, chapel, figureTop, leafTop, whole,
}: {
  slide: PantocratorSlide;
  width: number;
  chapel: number;
  figureTop: number;
  leafTop: number;
  whole: boolean;
}) {
  /* THE WHOLE BOARD, THE FULL HEIGHT OF THE CHAPEL.
     ⚠ IT USED TO BE 34% OF THE SCREEN'S HEIGHT WITH PROSE UNDER IT — a
     157-point-wide stamp of the most important object in the room. It is
     the room now: floor to lintel, its foot tucked under the leaf's
     rounded edge, which is what makes the leaf read as a page lying ON
     something rather than as a panel with a picture above it. */
  if (slide.figure === 'panel') {
    return (
      <View style={s.boardStand}>
        <PantocratorPanel height={chapel} style={s.board} />
      </View>
    );
  }

  // Everything else stands between the rail and the leaf, with its
  // caption under it — a detail on a wall, labelled.
  const room = leafTop - figureTop - 4;
  const stage = { top: figureTop, height: room };
  const inner = width - 40;
  const CAPTION = 34;

  if (slide.figure === 'gaze') {
    const crop = PANTOCRATOR_DETAILS.gaze;
    const tall = Math.min(room - CAPTION, inner / detailAspect(crop));
    return (
      <FigureStand stage={stage} caption={slide.caption}>
        <PantocratorDetail crop={crop} height={tall} />
      </FigureStand>
    );
  }

  if (slide.figure === 'hands') {
    const { hand, book } = PANTOCRATOR_DETAILS;
    const tall = Math.min(
      room - CAPTION - 26,
      (inner - 12) / (detailAspect(hand) + detailAspect(book)),
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
    const column = faceColumn(inner, room - CAPTION - 26);
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
        <View style={{ height: tall + 26 }}>
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

function FigureStand({
  stage, caption, children,
}: {
  stage: { top: number; height: number };
  caption?: string;
  children: React.ReactNode;
}) {
  /* ⚠ NO ENTERING ANIMATION IN HERE. The figures mount and unmount as the
     reader moves through the sheet — a neighbour comes into existence one
     page before it is wanted — so an arrival animation on this would fire
     while a swipe was already halfway across and drop the incoming figure
     twenty points down the wall. The sheet's arrival belongs to the
     chapel, which is mounted exactly once. */
  /* ⚠ THE LABEL LINE IS PINNED AND THE FIGURE FLOATS ABOVE IT. Centring
     the whole stack put the caption at a different height on every page —
     twenty points lower under the composites than under the eyes — so
     cross-fading from one page to the next slid a line of italic up the
     wall for no reason. A museum's labels run at one height along a wall,
     and for the same reason: it is the wall that is being read, not each
     card on its own. */
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

/** The gap between the two composites, and between hand and book. */
const PAIR_GAP = 12;

/**
 * How tall a composite of this width comes out.
 *
 * ⚠ THE CROP'S OWN ARITHMETIC, not a guess: the crop spans `2 × halfWidth`
 * across the board and `bottom − top` down it, so a column of width w is
 * `(bottom − top) × w / (2 × halfWidth) / PANEL_ASPECT` tall. Written here
 * because the wall has to reserve the height before either state has been
 * laid out, or the figure would settle a frame late.
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

/* ── WHERE YOU ARE ───────────────────────────────────────────────────
 *
 * A segmented rail: filled behind you, empty ahead, answered at a glance.
 * Still the book's own material — a gold thread, inked where you have
 * read — and still tappable, with the hit area five times the ink.
 *
 * ⚠ IT CHANGES GROUND WITH THE PAGE. It hangs on a dark chapel until the
 * leaf is read up over it, and then it is a gold thread on parchment.
 * A single colour cannot be right on both, and a rail you cannot see is
 * not a rail.
 */
function ReadingRail({
  page, total, onGo, leafY, cover,
}: {
  page: number;
  total: number;
  onGo: (index: number) => void;
  leafY: SharedValue<number>;
  cover: number;
}) {
  return (
    <View style={s.rail} accessibilityRole="tablist">
      {Array.from({ length: total }, (_, index) => (
        <TouchableOpacity
          key={index}
          onPress={() => onGo(index)}
          activeOpacity={0.7}
          haptic="selection"
          style={s.railHit}
          accessibilityRole="button"
          accessibilityLabel={`Page ${index + 1} of ${total}`}
          accessibilityState={{ selected: index === page }}
        >
          <RailSegment read={index <= page} leafY={leafY} cover={cover} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function RailSegment({
  read, leafY, cover,
}: {
  read: boolean;
  leafY: SharedValue<number>;
  cover: number;
}) {
  const style = useAnimatedStyle(() => {
    const onLeaf = interpolate(leafY.value, [0, cover], [0, 1], Extrapolation.CLAMP);
    return {
      backgroundColor: read
        ? interpolateColor(onLeaf, [0, 1], [GILT, C.gold])
        : interpolateColor(onLeaf, [0, 1], ['rgba(255,236,205,0.24)', 'rgba(197,160,89,0.24)']),
    };
  }, [cover, read]);

  return <Reanimated.View style={[s.railSegment, style]} />;
}

/** The way out — see the note on the rail; it changes ground the same way. */
function CloseChip({
  onPress, leafY, cover,
}: {
  onPress: () => void;
  leafY: SharedValue<number>;
  cover: number;
}) {
  const style = useAnimatedStyle(() => {
    const onLeaf = interpolate(leafY.value, [0, cover], [0, 1], Extrapolation.CLAMP);
    return {
      backgroundColor: interpolateColor(
        onLeaf, [0, 1], ['rgba(255,236,205,0.12)', 'rgba(255,255,255,0.72)'],
      ),
      borderColor: interpolateColor(
        onLeaf, [0, 1], ['rgba(255,236,205,0.28)', GOLD_HAIR],
      ),
    };
  }, [cover]);

  const inkStyle = useAnimatedStyle(() => ({
    opacity: interpolate(leafY.value, [0, cover], [1, 0], Extrapolation.CLAMP),
  }), [cover]);

  const goldStyle = useAnimatedStyle(() => ({
    opacity: interpolate(leafY.value, [0, cover], [0, 1], Extrapolation.CLAMP),
  }), [cover]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel="Close"
    >
      <Reanimated.View style={[s.close, style]}>
        {/* ⚠ TWO MARKS, ONE FADED INTO THE OTHER. An SVG stroke colour is
            a prop rather than a style, so it cannot be driven from the UI
            thread; two crosses at opposite opacities can. */}
        <Reanimated.View style={[s.closeInk, inkStyle]}>
          <X s={16} c={ON_DARK} />
        </Reanimated.View>
        <Reanimated.View style={[s.closeInk, goldStyle]}>
          <X s={16} c={GOLD_INK} />
        </Reanimated.View>
      </Reanimated.View>
    </TouchableOpacity>
  );
}

/* ── One leaf ───────────────────────────────────────────────────────── */

const Leaf = ({
  ref, slide, index, width, minLeaf, leafTop, bottom, leafY, last, whole, onWhole,
}: {
  ref: (leaf: ScrollView | null) => void;
  slide: PantocratorSlide;
  index: number;
  width: number;
  minLeaf: number;
  leafTop: number;
  bottom: number;
  /** Shared with the head and the chapel — see the note below. */
  leafY: SharedValue<number>;
  last: boolean;
  whole: boolean;
  onWhole: (whole: boolean) => void;
}) => {
  const [first, ...rest] = slide.body;
  const versal = takeVersal(first);

  /* ⚠ ONE HANDLER PER LEAF, WRITING INTO ONE SHARED VALUE. The five pages
     could share a single handler — only the page in view ever scrolls, so
     they would never contend — but a handler attached to five scroll
     views at once is a thing to have to be sure of, and there is nothing
     to buy by being clever here. What the head and the chapel need is the
     offset of whichever leaf is moving, and that is exactly what this
     writes. */
  const onScroll = useAnimatedScrollHandler({
    onScroll: event => {
      leafY.value = event.contentOffset.y;
    },
  });

  return (
    <Reanimated.ScrollView
      ref={ref as never}
      style={{ width }}
      contentContainerStyle={{ paddingTop: leafTop }}
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
    >
      <Reanimated.View
        entering={FadeInDown.duration(520).delay(110)}
        style={[s.leaf, { minHeight: minLeaf, paddingBottom: bottom }]}
      >
        {/* ⚠ THE GROUND IS THE ONE THING THAT CLIPS. A shadow is drawn by
            the layer that owns it, and a layer that clips to its own
            bounds clips its shadow away with everything else — so the
            leaf keeps its corners and its shadow, and the parchment and
            the lit edge are clipped one level in. */}
        <View pointerEvents="none" style={s.leafGround}>
          <LinearGradient
            colors={PARCHMENT}
            locations={[0, 0.46, 1]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* The lit edge every raised surface in this app has. */}
          <View style={s.leafEdge} />
        </View>

        <Text style={s.eyebrow}>
          {slideNumeral(index)} · {slide.eyebrow}
        </Text>
        <Text style={s.title}>{slide.title}</Text>

        {slide.figure === 'faces' && (
          <FacesSwitch whole={whole} onWhole={onWhole} />
        )}

        {!!slide.plate?.length && (
          <View style={s.plate}>
            {slide.plate.map(row => (
              <View key={row.label} style={s.plateRow}>
                <Text style={s.plateLabel}>{row.label}</Text>
                <Text style={s.plateValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ⚠ THE OPENING IS A LEAD, AND THE VERSAL IS SIZED TO ITS LINE.
            The raised letter used to be set at 34 over 34 inside prose set
            at 17 over 27 — twice the height of the text it opened, on a
            line seven points taller than every line under it. It did not
            read as a flourish, it read as a mistake: a giant capital
            sitting on a line of its own making, with the rest of its word
            stranded beside it.

            A versal is one and a half times its text, not two, and its
            line is the line it stands on. So the first paragraph is a
            lead at 18 over 28 — which is what an opening paragraph wants
            anyway — and the letter is 27 on a 30-point line, three points
            of air for a capital that has none to spare. */}
        {versal ? (
          <Text style={s.lead}>
            <Text style={s.versal}>{versal.initial}</Text>
            {versal.rest}
          </Text>
        ) : (
          <Text style={s.lead}>{first}</Text>
        )}

        {rest.map(paragraph => (
          <Text key={paragraph.slice(0, 24)} style={s.body}>
            {paragraph}
          </Text>
        ))}

        {!!slide.envoi && (
          <View style={s.envoiWrap}>
            <View style={s.envoiMark} />
            <Text style={s.envoi}>{slide.envoi}</Text>
          </View>
        )}

        {last && (
          <View style={s.colophon}>
            <View style={s.colophonRule} />
            <Text style={s.colophonText}>{PANTOCRATOR_SOURCE_NOTE}</Text>
          </View>
        )}
      </Reanimated.View>
    </Reanimated.ScrollView>
  );
};

/**
 * THE CONTROL OVER THE TWO COMPOSITES.
 *
 * ⚠ IT SITS ON THE LEAF, NOT ON THE WALL. The figure it governs hangs in
 * the chapel, and a segmented control floating over a sixth-century face
 * is furniture standing in front of the exhibit. Under the title it is
 * what it actually is — the caption's own switch — and it is still the
 * first thing on the page, so nobody meets the composites without meeting
 * the way to check them against the original.
 */
function FacesSwitch({
  whole, onWhole,
}: {
  whole: boolean;
  onWhole: (whole: boolean) => void;
}) {
  return (
    <View style={s.switch}>
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
            <Text style={[s.switchText, here && s.switchTextHere]}>
              {candidate ? PANTOCRATOR_FACE_VIEWS.whole : PANTOCRATOR_FACE_VIEWS.halves}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  room: { flex: 1, backgroundColor: '#0C0703' },

  // ── The chapel ─────────────────────────────────────────────────────
  chapel: { position: 'absolute', left: 0, right: 0, top: 0, overflow: 'hidden' },
  lamp: { position: 'absolute', left: '50%', top: '52%' },
  lintel: { position: 'absolute', left: 0, right: 0, top: 0 },

  /** The board, standing the full height of the chapel. */
  boardStand: { ...StyleSheet.absoluteFillObject, alignItems: 'center' },
  // ⚠ DEEPER THAN THE PRAYER SCREEN'S. The same shadow that sets the
  // panel in a bright room is invisible against a dark one; on this wall
  // it has to be near-black to read as a board standing off it at all.
  board: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.7,
    shadowRadius: 36,
    elevation: 18,
  },

  /** A detail, standing between the rail and the leaf. */
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
  /** The name under one window. */
  figureName: {
    marginTop: 10,
    fontFamily: F.sansBold,
    fontSize: 8.5,
    letterSpacing: 1.9,
    textAlign: 'center',
    color: 'rgba(226,187,116,0.88)',
    textTransform: 'uppercase',
  },
  /** What you are looking at, said once, in the chapel's own light. */
  caption: {
    marginTop: 14,
    fontFamily: F.serifItalic,
    fontSize: 13,
    lineHeight: 18,
    color: ON_DARK_SOFT,
    textAlign: 'center',
    paddingHorizontal: 14,
  },

  // ── The head ───────────────────────────────────────────────────────
  head: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
  },
  rail: { flex: 1, flexDirection: 'row', marginLeft: -4 },
  // ⚠ The hit area is five times the ink. A 2.5-point rail is a mark, not
  // a button; this is what makes it one.
  railHit: { flex: 1, paddingHorizontal: 4, paddingVertical: 9 },
  railSegment: { height: 2.5, borderRadius: 1.5 },

  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeInk: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },

  // ── The pages ──────────────────────────────────────────────────────
  pager: { position: 'absolute', left: 0, right: 0, top: 0, backgroundColor: 'transparent' },

  /**
   * THE LEAF.
   *
   * ⚠ ROUNDED AT THE HEAD AND NOWHERE ELSE, and lapped over the chapel's
   * foot. That single overlap is what makes the two rooms one room: a
   * page that stops short of the wall is a card pinned to it, and a page
   * that runs over the wall's edge is lying on something.
   */
  leaf: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderCurve: 'continuous',
    // The shadow needs a shape to be cast by, and a transparent view has
    // none. The gradient lies over this and is never seen.
    backgroundColor: '#FDFBF6',
    paddingHorizontal: 24,
    paddingTop: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -14 },
    shadowOpacity: 0.34,
    shadowRadius: 30,
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
  leafEdge: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 1,
    backgroundColor: GOLD_HAIR,
  },

  eyebrow: {
    fontFamily: F.sansBold,
    fontSize: 8.5,
    letterSpacing: 2,
    color: 'rgba(139,107,47,0.85)',
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 9,
    fontFamily: F.serifMedium,
    fontSize: 31,
    lineHeight: 36,
    letterSpacing: -0.4,
    color: C.text,
  },

  /**
   * THE MUSEUM PLATE.
   *
   * ⚠ IT REPLACED A RUN-ON STRIP OF TRACKED CAPITALS — "MID-6TH CENTURY ◆
   * HOT WAX ON PANEL ◆ 84 × 45.5 CM", three unlike facts at nine and a
   * half points with nothing saying which was which. Named rows, ruled
   * apart, are what hangs beside a panel in every room the reader has
   * ever stood in, and they are read rather than scanned past.
   */
  plate: { marginTop: 15, borderTopWidth: 1, borderTopColor: GOLD_HAIR },
  plateRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(197,160,89,0.26)',
  },
  plateLabel: {
    fontFamily: F.sansBold,
    fontSize: 8,
    letterSpacing: 1.6,
    color: 'rgba(139,107,47,0.68)',
    textTransform: 'uppercase',
  },
  plateValue: {
    fontFamily: F.serifMedium,
    fontSize: 16,
    lineHeight: 20,
    color: BODY_INK,
  },

  // The opening paragraph, and the letter that opens it — see the note
  // where they are rendered.
  lead: {
    marginTop: 16,
    fontFamily: F.serif,
    fontSize: 18,
    lineHeight: 28,
    color: LEAD_INK,
  },
  versal: {
    fontFamily: F.serifSemiBold,
    fontSize: 27,
    lineHeight: 30,
    color: GOLD_INK,
  },
  body: {
    marginTop: 13,
    fontFamily: F.serif,
    // 17 over 27: this is prose to be read, not a caption under a
    // control, and it is the one place in the app that asks for a reading
    // measure rather than a glancing one.
    fontSize: 17,
    lineHeight: 27,
    color: BODY_INK,
  },

  /** The last line of the sheet, given its own measure. */
  envoiWrap: { marginTop: 22, alignItems: 'center' },
  envoiMark: {
    width: 5,
    height: 5,
    marginBottom: 14,
    borderRadius: 1,
    backgroundColor: C.gold,
    opacity: 0.72,
    transform: [{ rotate: '45deg' }],
  },
  envoi: {
    fontFamily: F.serifMedium,
    fontSize: 19,
    lineHeight: 28,
    color: GOLD_INK,
    textAlign: 'center',
    paddingHorizontal: 6,
  },

  // ⚠ The one gap on this page that stays large. It is not separating two
  // blocks of the same page — it is separating the page from the note
  // about where the page came from.
  colophon: { marginTop: 24, alignItems: 'center', gap: 10 },
  colophonRule: { width: 34, height: 1, opacity: 0.6, backgroundColor: C.gold },
  colophonText: {
    fontFamily: F.serifItalic,
    fontSize: 12.5,
    lineHeight: 18,
    color: 'rgba(74,64,56,0.58)',
    textAlign: 'center',
  },

  // ── The switch ─────────────────────────────────────────────────────
  switch: {
    marginTop: 15,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    padding: 3,
    borderRadius: 13,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.38)',
    backgroundColor: 'rgba(255,255,255,0.55)',
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
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 7,
    elevation: 1,
  },
  switchText: {
    fontFamily: F.serifMedium,
    fontSize: 14.5,
    color: 'rgba(74,64,56,0.52)',
  },
  switchTextHere: { color: GOLD_INK },

  // ── The foot ───────────────────────────────────────────────────────
  foot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 13,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footRule: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: 'rgba(197,160,89,0.32)',
  },
  back: {
    width: 46,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.40)',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  // Holds the forward plate in the same place on page one, so it does not
  // jump left the moment you turn back.
  backSpacer: { width: 46 },
  /**
   * ⚠ PARCHMENT, NOT A FILLED PLATE. This is a book. A gold button at the
   * foot of it would be the coin grammar walking into the one room in the
   * app that keeps it out.
   */
  on: {
    flex: 1,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 15,
    paddingRight: 10,
    borderRadius: 15,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.52)',
    backgroundColor: 'rgba(255,255,255,0.86)',
  },
  onCopy: { flex: 1, minWidth: 0 },
  onKicker: {
    fontFamily: F.sansBold,
    fontSize: 7.5,
    letterSpacing: 1.9,
    color: 'rgba(139,107,47,0.62)',
    textTransform: 'uppercase',
  },
  onTitle: {
    marginTop: 1,
    fontFamily: F.serifMedium,
    fontSize: 16.5,
    lineHeight: 20,
    color: GOLD_INK,
  },
  onChevron: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(197,160,89,0.15)',
  },
});
