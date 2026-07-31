import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import {
  FACE,
  NICHE_DEPTH,
  PANEL_ASPECT,
  PantocratorFace,
  PantocratorPanel,
  PANTOCRATOR_IMAGE,
  PrayerNiche,
} from '@/components/prayer/PantocratorIcon';
import {
  PANTOCRATOR_FACE_CAPTIONS,
  PANTOCRATOR_FACE_LABELS,
  PANTOCRATOR_SLIDES,
  PANTOCRATOR_SOURCE_NOTE,
  type PantocratorSlide,
} from '@/data/prayers/pantocratorContent';

/* ─────────────────────────────────────────────────────────────
 * ABOUT THE ICON — five pages on the Sinai Pantocrator.
 *
 * THE REGISTER IS THE LITURGICAL ONE. Scripture is the most serious
 * part of this app and it is drawn quieter than the coin grammar, not
 * louder: parchment rather than white, gold as hairlines rather than as
 * fills, the serif given room, and the first letter of each page raised
 * the way a prayer book raises the first letter of a prayer. Nothing on
 * these pages is a card, a plaque or a seat. This is a book.
 *
 * ⚠ THE PAGER IS A NATIVE SCROLL, NOT A GESTURE HANDLER. RNGH inside a
 * Modal crashes Android unless the content is wrapped in its own
 * GestureHandlerRootView, and this needs nothing RNGH gives: a
 * horizontal ScrollView with pagingEnabled brings the swipe, the snap
 * and the momentum for free, on the platform's own thread. The only
 * Reanimated here is opacity on the face composites.
 *
 * ⚠ AND THE FACES ARE NOT A WIPE. A horizontal drag inside a horizontal
 * pager fights the pager — every attempt to reveal one half would
 * either turn the page or fail to. So the three states are chosen from
 * a rule of three names and cross-fade in place, which is also the only
 * form that can show the ORIGINAL beside the two composites rather than
 * only one against the other.
 * ───────────────────────────────────────────────────────────── */

const PARCHMENT = ['#FDFBF6', '#F8F2E6', '#F2E9D8'] as const;
const GOLD_INK = '#8B6B2F';
const GOLD_HAIR = 'rgba(197,160,89,0.42)';
const BODY_INK = '#4A4038';

/**
 * The opening letter, raised.
 *
 * The same rule the prayer reader uses (`PrayerBookView`'s `takeVersal`):
 * only a real letter takes a versal, because a raised quotation mark or
 * ellipsis is worse than no flourish at all, and a short line is left
 * alone because a versal on three words reads as a mistake.
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
  const scrollRef = useRef<ScrollView>(null);
  const total = PANTOCRATOR_SLIDES.length;

  // Opening it again opens it at the beginning. A sheet that remembers
  // page five is a sheet that opens on a sentence with no beginning.
  useEffect(() => {
    if (!visible) return;
    setPage(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [visible]);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    setPage(current => (current === next ? current : Math.max(0, Math.min(total - 1, next))));
  }, [total, width]);

  const goTo = useCallback((index: number) => {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
  }, [width]);

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
        <LinearGradient
          colors={PARCHMENT}
          locations={[0, 0.5, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* ── The head of the book ─────────────────────────────────── */}
        <View style={[s.head, { paddingTop: insets.top + 10 }]}>
          <View style={s.headCopy}>
            <Text style={s.headKicker}>ABOUT THE ICON</Text>
            <Text style={s.headTitle}>Christ Pantocrator</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.78}
            style={s.close}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X s={18} c={GOLD_INK} />
          </TouchableOpacity>
        </View>
        <View style={s.headRule} />

        {/* ── The pages ────────────────────────────────────────────── */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={32}
          style={s.pager}
        >
          {PANTOCRATOR_SLIDES.map((slide, index) => (
            <Slide
              key={slide.id}
              slide={slide}
              width={width}
              screenHeight={height}
              last={index === total - 1}
            />
          ))}
        </ScrollView>

        {/* ── The foot: one diamond per page, on a gold thread ─────── */}
        <View style={[s.foot, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <View style={s.threadRow}>
            {/* The thread is drawn INSIDE the row and centred on it with a
                percentage, so it stays on the beads' own centre line
                whatever the marks measure — a hand-added offset would be
                one restyle away from floating off them. */}
            <View pointerEvents="none" style={s.thread} />
            {PANTOCRATOR_SLIDES.map((slide, index) => {
              const here = index === page;
              return (
                <TouchableOpacity
                  key={slide.id}
                  onPress={() => goTo(index)}
                  activeOpacity={0.7}
                  haptic="selection"
                  style={s.markHit}
                  accessibilityRole="button"
                  accessibilityLabel={`Page ${index + 1} of ${total}`}
                  accessibilityState={{ selected: here }}
                >
                  <View style={[s.mark, here ? s.markHere : s.markRest]} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ── One page ─────────────────────────────────────────────────────── */

function Slide({
  slide,
  width,
  screenHeight,
  last,
}: {
  slide: PantocratorSlide;
  width: number;
  screenHeight: number;
  last: boolean;
}) {
  const [first, ...rest] = slide.body;
  const versal = takeVersal(first);
  // The board is tall — 84 by 45.5 — so it is budgeted from the height of
  // the phone rather than from the width of the page, or it swallows a
  // small screen whole and leaves the prose no room at all.
  const panelHeight = Math.min(screenHeight * 0.34, 300);

  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={s.page}
      showsVerticalScrollIndicator={false}
    >
      {slide.figure === 'icon' && (
        <View style={s.figure}>
          {/* ⚠ THE SAME PROBLEM AS THE PRAYER SCREEN, IN A LIGHTER ROOM —
              see PrayerNiche. A dark sixth-century panel fading into
              parchment fogs at every edge exactly as it fogged into the
              prayer page's cream, so it gets the same warm field to
              dissolve into. Shallower than the prayer screen's: this
              sheet is a page you read, not a room you pray in, and the
              field has prose beside it. */}
          <PrayerNiche depth={NICHE_DEPTH.sheet} panelHeight={panelHeight} />
          <PantocratorPanel height={panelHeight} />
        </View>
      )}

      {slide.figure === 'faces' && <FacesFigure width={width - 44} />}

      {/* ⚠ A RULE CLOSES THE FIGURE, NOT A GAP. The plate and the prose
          were held apart by twenty-two points of nothing, which is how
          a page ends up looking like two pages. A hairline does the same
          work in one point and says something a gap cannot: that what
          is above it and what is below it belong to each other. */}
      {!!slide.figure && <View style={s.figureRule} />}

      <Text style={s.eyebrow}>{slide.eyebrow}</Text>
      <Text style={s.title}>{slide.title}</Text>

      {!!slide.facts?.length && (
        <View style={s.facts}>
          {slide.facts.map((fact, index) => (
            <View key={fact} style={s.factItem}>
              {index > 0 && <View style={s.factDiamond} />}
              <Text style={s.factText}>{fact}</Text>
            </View>
          ))}
        </View>
      )}

      {versal ? (
        <Text style={s.body}>
          <Text style={s.versal}>{versal.initial}</Text>
          {versal.rest}
        </Text>
      ) : (
        <Text style={s.body}>{first}</Text>
      )}

      {rest.map(paragraph => (
        <Text key={paragraph.slice(0, 24)} style={[s.body, s.bodyAfter]}>
          {paragraph}
        </Text>
      ))}

      {last && (
        <View style={s.sourceWrap}>
          <View style={s.sourceRule} />
          <Text style={s.source}>{PANTOCRATOR_SOURCE_NOTE}</Text>
        </View>
      )}
    </ScrollView>
  );
}

/* ── The two faces ──────────────────────────────────────────────────
 *
 * ⚠ THEY ARE SHOWN SIDE BY SIDE NOW, WHICH IS THE WHOLE POINT OF THEM.
 *
 * The figure used to show ONE composite at a time, chosen from a rule of
 * three names set at nine and a half points. Two faults, and the first
 * is fatal to the idea: a demonstration that two halves DIFFER cannot be
 * made by showing one half at a time. You had to tap, remember, tap
 * back, and compare against a memory. Every presentation of this famous
 * comparison — including the one this sheet was written from — puts them
 * beside each other, because that is the only arrangement in which the
 * difference is a thing you SEE rather than a thing you are told.
 *
 * The second: nine and a half points of tracked capitals with a
 * twenty-two point underline is not a control anybody finds. It is now
 * two segments at readable size, and the pair is what it opens on.
 *
 * ⚠ AND THE BOX NEVER RESIZES, which is what lets the two states
 * cross-fade instead of jumping. The composites and the whole panel are
 * the same crop, so a column of one width is a column of one height:
 * two side by side, or one centred, inside a box whose height is fixed
 * by that single column. Nothing below the figure ever moves.
 * ────────────────────────────────────────────────────────────────── */

type FacesView = 'halves' | 'whole';

const FACES_VIEWS: { id: FacesView; label: string }[] = [
  { id: 'halves', label: 'The two halves' },
  { id: 'whole', label: 'The icon' },
];

function FacesFigure({ width }: { width: number }) {
  const [view, setView] = useState<FacesView>('halves');
  const at = useSharedValue(0);

  const choose = useCallback((next: FacesView) => {
    setView(next);
    at.value = withTiming(next === 'whole' ? 1 : 0, { duration: 260 });
  }, [at]);

  // ⚠ One column sets the height for both states — see the note above.
  const column = Math.floor((width - FACES_GAP) / 2);

  // With no image there is nothing to mirror, and a control that changes
  // nothing is worse than no control at all.
  if (!PANTOCRATOR_IMAGE) {
    return (
      <View style={s.figure}>
        <PantocratorFace width={column} mode="whole" />
        <Text style={s.faceCaption}>
          The two composites appear here once the icon file is added to the app.
        </Text>
      </View>
    );
  }

  return (
    <View style={s.figure}>
      <View style={[s.faceStage, { width, height: faceBoxHeight(column) }]}>
        {/* THE PAIR */}
        <FaceLayer at={at} show={0}>
          <View style={s.facePair}>
            <View>
              <PantocratorFace width={column} mode="mercy" />
              <Text style={s.faceName}>{PANTOCRATOR_FACE_LABELS.mercy}</Text>
            </View>
            <View>
              <PantocratorFace width={column} mode="judgement" />
              <Text style={s.faceName}>{PANTOCRATOR_FACE_LABELS.judgement}</Text>
            </View>
          </View>
        </FaceLayer>

        {/* THE PANEL AS IT IS */}
        <FaceLayer at={at} show={1}>
          <View style={s.faceWhole}>
            <PantocratorFace width={column} mode="whole" />
            <Text style={s.faceName}>{PANTOCRATOR_FACE_LABELS.whole}</Text>
          </View>
        </FaceLayer>
      </View>

      {/* ⚠ A SEGMENTED CONTROL, NOT A RULE OF NAMES. It is still a book's
          furniture — parchment, a gold hairline, the serif — but it is
          the size of something meant to be pressed, and the chosen side
          is a lifted plate rather than a twenty-two point underscore. */}
      <View style={s.faceSwitch}>
        {FACES_VIEWS.map(candidate => {
          const here = candidate.id === view;
          return (
            <TouchableOpacity
              key={candidate.id}
              onPress={() => choose(candidate.id)}
              activeOpacity={0.82}
              haptic="selection"
              style={[s.faceSegment, here && s.faceSegmentHere]}
              accessibilityRole="button"
              accessibilityState={{ selected: here }}
            >
              <Text style={[s.faceSegmentText, here && s.faceSegmentTextHere]}>
                {candidate.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Reanimated.Text key={view} entering={FadeIn.duration(220)} style={s.faceCaption}>
        {view === 'halves'
          ? 'Each half of the face, mirrored into a whole one.'
          : PANTOCRATOR_FACE_CAPTIONS.whole}
      </Reanimated.Text>
    </View>
  );
}

/** The gap between the two composites. */
const FACES_GAP = 9;

/**
 * How tall a column of this width comes out.
 *
 * ⚠ IT IS THE CROP'S OWN ARITHMETIC, not a guess: the crop spans
 * `2 × halfWidth` across the board and `bottom − top` down it, so a
 * column of width w is `(bottom − top) × w / (2 × halfWidth) /
 * PANEL_ASPECT` tall. Written here because the stage has to reserve that
 * height before either state has been laid out — otherwise the figure
 * would settle a frame late and shove the prose down with it.
 */
function faceBoxHeight(column: number): number {
  const cropW = FACE.halfWidth * 2;
  const cropH = FACE.bottom - FACE.top;
  return Math.round((cropH * (column / cropW)) / PANEL_ASPECT);
}

/**
 * One state of the figure, lying over the other.
 *
 * ⚠ BOTH ARE ABSOLUTE INSIDE A STAGE OF FIXED HEIGHT, so the change is
 * pure opacity on the UI thread and nothing on the page is laid out a
 * second time when it happens.
 */
function FaceLayer({
  at, show, children,
}: {
  at: SharedValue<number>;
  /** The value of `at` at which this layer is the one showing. */
  show: 0 | 1;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - Math.abs(at.value - show)),
  }));

  return (
    <Reanimated.View
      style={[StyleSheet.absoluteFill, s.faceLayer, style]}
      pointerEvents="none"
    >
      {children}
    </Reanimated.View>
  );
}

const s = StyleSheet.create({
  room: { flex: 1, backgroundColor: '#FDFBF6' },

  // ── Head ───────────────────────────────────────────────────────────
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 22,
    paddingBottom: 12,
  },
  headCopy: { flex: 1, minWidth: 0 },
  headKicker: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 2.6,
    color: 'rgba(139,107,47,0.7)',
  },
  headTitle: {
    marginTop: 4,
    fontFamily: F.serifMedium,
    fontSize: 25,
    lineHeight: 30,
    letterSpacing: -0.2,
    color: C.text,
  },
  close: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: GOLD_HAIR,
    backgroundColor: 'rgba(255,255,255,0.66)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headRule: {
    height: 1,
    marginHorizontal: 22,
    backgroundColor: GOLD_HAIR,
  },

  // ── Pages ──────────────────────────────────────────────────────────
  pager: { flex: 1 },
  /**
   * ⚠ THE PAGE WAS HELD APART BY GAPS AND IT READ AS SEVERAL PAGES.
   *
   * Twenty-two points under the figure, eighteen over the first
   * paragraph, fourteen between every pair after it, twelve over the
   * facts — every block on this page was separated by a space large
   * enough to be mistaken for the end of something. The prose is set at
   * 17 over 27, so a 22-point gap is most of a blank line: the reader
   * kept arriving at what looked like a finish.
   *
   * The reference pages this was rebuilt against — the artwork pages in
   * Google Arts & Culture, the plate-and-caption pages in Blue Bottle —
   * do the opposite everywhere: metadata is pinned tight under its
   * title, two to four points, and SEPARATION IS DONE BY A HAIRLINE.
   * A rule costs one point and says what a gap cannot, which is that
   * the things on either side of it belong together.
   *
   * So: the gaps come in, the rules go in, and the page reads as one
   * page. The type sizes are untouched — nothing here was too small.
   */
  page: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 32,
  },
  figure: { alignItems: 'center', marginBottom: 14 },
  // The hairline that closes the figure block — see the note in Slide.
  figureRule: {
    height: 1,
    marginBottom: 16,
    backgroundColor: GOLD_HAIR,
    opacity: 0.55,
  },

  eyebrow: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: GOLD_INK,
  },
  title: {
    marginTop: 5,
    fontFamily: F.serifMedium,
    fontSize: 30,
    lineHeight: 35,
    letterSpacing: -0.4,
    color: C.text,
  },

  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 9,
  },
  factItem: { flexDirection: 'row', alignItems: 'center' },
  // The prayer book's own ornament, doing the work a bullet would do
  // badly: it separates without listing.
  factDiamond: {
    width: 4,
    height: 4,
    marginHorizontal: 9,
    borderRadius: 0.8,
    opacity: 0.6,
    backgroundColor: C.gold,
    transform: [{ rotate: '45deg' }],
  },
  factText: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(74,64,56,0.66)',
  },

  body: {
    marginTop: 14,
    fontFamily: F.serif,
    // 17 over 27: this is prose to be read, not a caption under a
    // control, and it is the one place in the app that asks for a
    // reading measure rather than a glancing one.
    fontSize: 17,
    lineHeight: 27,
    color: BODY_INK,
  },
  // ⚠ TIGHTER THAN THE BLOCK ABOVE IT. Paragraph spacing that equals
  // block spacing tells the reader every paragraph is a new section.
  bodyAfter: { marginTop: 11 },
  versal: {
    fontFamily: F.serifMedium,
    fontSize: 34,
    lineHeight: 34,
    color: GOLD_INK,
  },

  // ⚠ The one gap on this page that stays large. It is not separating
  // two blocks of the same page — it is separating the page from the
  // note about where the page came from.
  sourceWrap: { marginTop: 22, alignItems: 'center', gap: 10 },
  sourceRule: { width: 32, height: 1, opacity: 0.5, backgroundColor: C.gold },
  source: {
    fontFamily: F.serifItalic,
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(74,64,56,0.6)',
    textAlign: 'center',
  },

  // ── The faces ──────────────────────────────────────────────────────
  /** The stage both states lie in — see FacesFigure. */
  faceStage: { position: 'relative' },
  faceLayer: { alignItems: 'center', justifyContent: 'flex-start' },
  facePair: { flexDirection: 'row', gap: 9 },
  faceWhole: { alignItems: 'center' },
  /** The name under each composite. */
  faceName: {
    marginTop: 7,
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 1.8,
    textAlign: 'center',
    color: GOLD_INK,
    textTransform: 'uppercase',
  },
  /**
   * THE CONTROL.
   *
   * ⚠ STILL A BOOK'S FURNITURE — parchment, a gold hairline, the serif —
   * but the size of something meant to be pressed. It replaced three
   * names at 9.5 with a 22-point underscore, which nobody found and
   * nobody could hit.
   */
  faceSwitch: {
    marginTop: 16,
    flexDirection: 'row',
    padding: 3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GOLD_HAIR,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  faceSegment: {
    minHeight: 34,
    paddingHorizontal: 15,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceSegmentHere: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#8C7A4F',
    shadowOpacity: 0.13,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 7,
    elevation: 1,
  },
  faceSegmentText: {
    fontFamily: F.serifMedium,
    fontSize: 14.5,
    color: 'rgba(74,64,56,0.5)',
  },
  faceSegmentTextHere: { color: GOLD_INK },
  faceCaption: {
    marginTop: 12,
    fontFamily: F.serifItalic,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(74,64,56,0.68)',
    textAlign: 'center',
    paddingHorizontal: 16,
  },

  // ── Foot ───────────────────────────────────────────────────────────
  foot: { paddingTop: 14, paddingHorizontal: 22 },
  thread: {
    position: 'absolute',
    // In from the outer beads' hit areas, so the line ends under the row
    // of marks rather than running out past them.
    left: 8,
    right: 8,
    top: '50%',
    marginTop: -0.5,
    height: 1,
    backgroundColor: GOLD_HAIR,
  },
  // Shrunk to its own contents, so the thread spans the beads and nothing
  // more.
  threadRow: {
    position: 'relative',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
  },
  markHit: { paddingHorizontal: 8, paddingVertical: 7, alignItems: 'center', justifyContent: 'center' },
  mark: {
    width: 6,
    height: 6,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  // The page you are on is struck; the rest are the thread's own colour,
  // so the row reads as one line with a bead on it rather than as seven
  // buttons.
  markHere: { backgroundColor: C.gold, width: 8, height: 8 },
  markRest: { backgroundColor: 'rgba(197,160,89,0.34)' },
});
