import { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image as ExpoImage, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import Reanimated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

/* ─────────────────────────────────────────────────────────────
 * THE SINAI PANTOCRATOR — the panel, the details in it, and the two
 * faces made out of it.
 *
 * One component family, used in two places: the hero of the My Rule
 * prayer screen, and every figure in the About sheet. They share a file
 * because they must share a frame — the same board seen many times, not
 * many drawings of it. Nothing here ships a second picture: the details
 * and the composites are all windows onto the one photograph, so no crop
 * of Christ in this app can ever drift from another.
 *
 * WHAT THE PANEL IS
 *
 * A Byzantine icon is not a picture in a frame; it is a board with its
 * field cut down into it. The raised border and the sunken field — the
 * kovcheg — are one piece of wood, and the shadow along that inner step
 * is what tells you so. So: a gilded border, a fine dark step where the
 * field begins, and the icon lying inside it. The app's own lit hairline
 * runs the top edge, because every lifted surface in this app has one.
 *
 * THE LAMP
 *
 * A lamp burns in front of an icon. That is the whole animation on the
 * prayer screen: while the timer runs the light lives, and when it
 * pauses the light banks rather than dies — the app's banked-ember
 * register, in one warm pool behind the board.
 *
 * ⚠ OPACITY ONLY. Scaling a small view on Android resamples its bitmap,
 * and this app has been bitten by that before; the pool is drawn once at
 * full size and only its opacity moves. It reads as a lamp either way.
 *
 * THE TWO FACES, MADE HERE RATHER THAN SHIPPED
 *
 * The famous demonstration of this icon's asymmetry is two composites:
 * the left half of the face mirrored into a whole face, and the right
 * half mirrored into another. They are built here out of the one source
 * image — a clip and a scaleX(-1) — so the app carries no second and
 * third picture of Christ that could drift from the first.
 * ───────────────────────────────────────────────────────────── */

/* ── THE IMAGE ────────────────────────────────────────────────────────
 *
 * The Sinai Pantocrator — public domain, sixth century, unknown hand.
 * Source: Wikimedia Commons, `Spas vsederzhitel sinay.jpg`, 2023 × 3774.
 *
 * ⚠ IT IS CROPPED TO THE PAINTED BOARD AND NOTHING ELSE, and the crop was
 * done in the repo rather than by eye, because the Commons file is the
 * board photographed on a WHITE BACKING and carries a pale margin on all
 * four sides. Dropped in unprocessed it would have hung a light frame
 * around an image whose whole design is that it has no frame — and the
 * fades at its edges would have been fading a white margin into warm
 * paper, which is nothing at all.
 *
 * The recipe, so it can be redone from the original:
 *   · the board is found by column and row means — the surround runs
 *     above 225 and the painted panel nowhere near it,
 *   · the height is then trimmed EVENLY at both ends to PANEL_ASPECT, so
 *     `cover` never has to crop the board at render and no part of it can
 *     be lost on any phone,
 *   · and it is shipped 1400 wide. That is set by the About sheet, not by
 *     this screen: the sheet's mirrored faces enlarge a crop 52% of the
 *     board across, so they ask for more source than the hero does.
 *
 * ⚠ IT STAYS A CONSTANT rather than a require() at the point of use.
 * Metro resolves require() statically — a require of a missing path is a
 * build failure, not a runtime null — so keeping the one source here
 * means everything below can fall back to an empty board if it ever goes
 * missing again, instead of taking the app down with it.
 */
export const PANTOCRATOR_IMAGE: ImageSource | number | null =
  require('@/assets/images/prayer/pantocrator-sinai.jpg');

/**
 * The board's real proportion: 45.5 cm wide by 84 cm tall.
 * Source: Wikipedia, "Christ Pantocrator (Sinai)".
 */
export const PANEL_ASPECT = 45.5 / 84;

/* ── FACE CALIBRATION ─────────────────────────────────────────────────
 *
 * ⚠ THESE FOUR NUMBERS ARE MEASURED AGAINST THE SHIPPED FILE, not
 * estimated. All four are fractions of the cropped board, from its
 * top-left corner.
 *
 *   axisX      where the FACE's own midline falls — down the bridge of
 *              the nose. ⚠ NOT the middle of the board: the figure sits
 *              LEFT of centre, at 0.44, because the panel was cut down
 *              along its sides at some point in fourteen hundred years.
 *              Everything about the two composites depends on this one
 *              number — mirror about the wrong axis and you get two
 *              strangers rather than two readings of one man.
 *   halfWidth  how far to either side of that axis the face crop runs.
 *   top        where the crop begins, above the hair.
 *   bottom     where it ends, below the beard.
 *
 * ⚠ THE CROP WAS PULLED BACK. It ran 0.26 / 0.06 / 0.44 — tight enough
 * that the hair met the top edge of the box and the chin very nearly met
 * the bottom, so each composite read as a head pressed against glass
 * rather than as a face. 0.30 / 0.015 / 0.53 lets the halo close over the
 * head, brings the neck and the first of the shoulders in, and makes the
 * box taller in proportion, which is the shape a portrait wants.
 *
 * ⚠ THE AXIS DID NOT MOVE and must not. Widening the crop is safe
 * precisely because it is CENTRED ON THE AXIS BY CONSTRUCTION: taking
 * more to either side takes the same amount to both, so the mirror line
 * still falls down the bridge of the nose and both composites still
 * cohere. Any change to axisX is a different matter entirely — see below.
 *
 * ⚠ HOW THE AXIS WAS FOUND, because measuring a nose by eye does not
 * settle it: the composites themselves were built from the real file at
 * 0.40 / 0.42 / 0.44 / 0.46 / 0.48 and then at tenths between, and the
 * axis chosen was the one where BOTH halves make a coherent face. It is
 * a sharp test — a fifth of a percent off and the mirrored nose forks or
 * the mouth widens — and it is worth redoing exactly this way if the
 * crop is ever regenerated.
 */
export const FACE = {
  axisX: 0.44,
  halfWidth: 0.30,
  top: 0.015,
  bottom: 0.53,
} as const;

export type PantocratorFaceMode = 'whole' | 'mercy' | 'judgement';

/* ── THE DETAILS ──────────────────────────────────────────────────────
 *
 * ⚠ THREE OF THE FIVE ABOUT PAGES USED TO CARRY NO IMAGE AT ALL — a page
 * about the blessing hand with no hand on it, a page about the Gospel
 * book with no book, while a photograph containing both sat two swipes
 * away. These are windows onto that one photograph, so the app still
 * ships a single picture of Christ and every page can point at the thing
 * it is describing.
 *
 * ⚠ ALL FOUR NUMBERS ARE FRACTIONS OF THE CROPPED BOARD, measured off the
 * shipped file on a twentieth-grid rather than guessed. To re-measure
 * after a re-crop: lay a 5%-grid over the asset and read the corners.
 */
export const PANTOCRATOR_DETAILS = {
  /** The eyes, close. The panel is built to be met at this distance. */
  gaze: { x0: 0.185, y0: 0.150, x1: 0.700, y1: 0.345 },
  /** The right hand, opened outward. [SIN] */
  hand: { x0: 0.125, y0: 0.600, x1: 0.395, y1: 0.885 },
  /** The thick Gospel book, held in against the body. [SIN] */
  book: { x0: 0.400, y0: 0.560, x1: 0.975, y1: 0.900 },
} as const;

export type PantocratorDetailName = keyof typeof PANTOCRATOR_DETAILS;
export type PantocratorCrop = { x0: number; y0: number; x1: number; y1: number };

/**
 * How wide a detail comes out for a given height.
 *
 * The crop spans `x1 − x0` across the board and `y1 − y0` down it, and the
 * board is `PANEL_ASPECT` wide for its height — so in real proportions the
 * window is `(x1 − x0)` by `(y1 − y0) / PANEL_ASPECT`, and that ratio is
 * what a caller needs before it can lay anything out.
 */
export function detailAspect(crop: PantocratorCrop): number {
  return (crop.x1 - crop.x0) / ((crop.y1 - crop.y0) / PANEL_ASPECT);
}

/* ── The icon ────────────────────────────────────────────────────── */

/** The ground seen only while the image is missing. */
const FIELD_EMPTY = ['#F3EADA', '#E4D6BD'] as const;

/* ── THE NICHE ────────────────────────────────────────────────────────
 *
 * ⚠ THE ICON IS A DARK OBJECT AND THE PAGE IS BRIGHT PAPER, and until
 * the real painting arrived nothing here had to reckon with that. An
 * empty board was a pale gradient and dissolved into warm paper
 * beautifully. A sixth-century encaustic panel does not: its robe is
 * nearly black and its board is dark at every edge, and dropped straight
 * onto cream it is a hole punched in a bright page.
 *
 * ⚠ THE ANSWER IS NOT TO PUSH THE ICON TOWARD THE PAPER — that was
 * tried, by fading its edges out, and it is what this file did until the
 * crop was fixed. It is to bring the paper toward the icon: a wide, soft,
 * warm-deep field gathered where the board stands. An icon hangs in a
 * niche; this is that niche, made of light rather than of architecture.
 *
 * ⚠ IT BELONGS TO THE ICON AND NOT TO THE SCREEN, which is the opposite
 * of the lamp. The lamp stays lit while the object in it changes — that
 * is the whole good of the exchange. The niche is the WALL, and the wall
 * is the icon's own: a pale wooden cross wants bright paper behind it and
 * would look shadowed hanging here.
 *
 * ⚠ AND IT IS THE ICON'S ANSWER TO THE PRAYER BEGINNING.
 *
 * The cross gets a visible one for free: it stands on bright paper, so
 * the room darkening at its edges and the lamp coming up are plainly
 * legible against it. Behind the icon the same two moves did almost
 * nothing — the field there was already warm, and the only thing that
 * read was the object growing, which is not enough to mark the one
 * deliberate act on the screen.
 *
 * So the WALL ITSELF DEEPENS. At rest it is a warm suggestion; while the
 * prayer runs it is a dark chapel, and the lamp — up a sixth for the
 * icon already — lights the face out of it. It is the same idea the room
 * has, done where it can actually be seen, and it is the truest thing
 * this screen does: an icon in the dark with a lamp burning in front of
 * it is not a metaphor for anything, it is what the object is for.
 *
 * ⚠ ONE LAYER OPACITY, NOT AN ANIMATED GRADIENT. The field is drawn once
 * at its DEEPEST value and the whole layer is faded toward its resting
 * share, so react-native-svg is never handed a stop update per frame.
 *
 * ⚠ AND IT IS MUCH WIDER THAN THE BOARD, deliberately. A field only a
 * little larger would fall away across the panel's own footprint and
 * leave the corners lighter than the sides.
 */
const NICHE_TINT = '#3A260C';

/**
 * How deep the field goes at its darkest.
 *
 * ⚠ THERE IS ONE ROOM AGAIN. The About sheet used to hang the panel on a
 * shallow version of this wall — a warm bloom under a small board on a
 * bright page — because the page it stood on was parchment. That sheet's
 * chapel is a real dark room now and carries its own light, so the only
 * niche left in the app is the prayer screen's.
 */
export const NICHE_DEPTH = { prayer: 0.34 } as const;

/**
 * What share of that depth stands before the prayer begins.
 *
 * 0.38 of 0.34 is 0.13 — the value the resting screen was tuned at — so
 * the rest state is unchanged and the whole of the change is the arrival
 * of the running one.
 */
const NICHE_REST_SHARE = 0.38;

export function panelWidth(height: number) {
  return height * PANEL_ASPECT;
}

/**
 * The wall the icon hangs on.
 *
 * `swap` brings it with the board and takes it away with it; `ignition`
 * deepens it while the prayer runs. Both are optional, and `depth` is
 * kept a parameter rather than folded into the body, because a wall whose
 * darkness cannot be set is a wall that can only ever hang in one room.
 */
export function PrayerNiche({
  depth = NICHE_DEPTH.prayer,
  ignition,
  panelHeight,
  swap,
}: {
  depth?: number;
  /** 0 at rest, 1 while the prayer runs. */
  ignition?: SharedValue<number>;
  panelHeight: number;
  /** 0 = the cross is standing, 1 = the icon is. */
  swap?: SharedValue<number>;
}) {
  const width = Math.round(panelWidth(panelHeight) * 4);
  const height = Math.round(panelHeight * 1.9);
  // ⚠ The gradient's id carries the depth, so two walls of different
  // darkness can be mounted at once without the second being drawn at the
  // first's. Only one is, today; the cost of keeping this is one string.
  const id = `prayerNiche${Math.round(depth * 1000)}`;

  const style = useAnimatedStyle(() => {
    const here = swap ? swap.value : 1;
    const lit = ignition
      ? NICHE_REST_SHARE + ignition.value * (1 - NICHE_REST_SHARE)
      : 1;
    return { opacity: here * lit };
  }, [ignition, swap]);

  return (
    <Reanimated.View
      pointerEvents="none"
      style={[s.niche, { width, height, marginLeft: -width / 2, marginTop: -height / 2 }, style]}
      shouldRasterizeIOS
      renderToHardwareTextureAndroid
    >
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            {/* Held flat out to 45% — which covers the whole board — and
                gone by the edge, so the panel has ONE tone behind it and
                the field never shows an edge of its own. */}
            <Stop offset="0" stopColor={NICHE_TINT} stopOpacity={depth} />
            <Stop offset="0.45" stopColor={NICHE_TINT} stopOpacity={depth} />
            <Stop offset="0.74" stopColor={NICHE_TINT} stopOpacity={depth * 0.44} />
            <Stop offset="1" stopColor={NICHE_TINT} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} fill={`url(#${id})`} />
      </Svg>
    </Reanimated.View>
  );
}

/**
 * THE ICON, UNFRAMED — BUT NOT DISSOLVED.
 *
 * ⚠ IT WORE A GILT BORDER AND THE BORDER IS GONE, and that stands. A
 * frame turns the icon into a picture hanging on the screen — an object
 * on display, announcing that it is a reproduction. The lamp and the
 * niche do all the framing that is wanted.
 *
 * ⚠ AND IT USED TO FADE OUT AT ALL FOUR EDGES, WHICH IS ALSO GONE, and
 * that is the correction. The reasoning had been that a rectangle of
 * photograph cut off dead against warm paper is worse than a frame was —
 * true of the crop we had, and not true of the crop we have.
 *
 * THE FADE WAS COVERING FOR A BAD CUT. The Commons file is the board
 * photographed on a white backing, and the board is not a rectangle: its
 * fourteen-hundred-year-old edges are chipped and BOWED — wide at the
 * middle, tapering sharply at the very top and foot. Any rectangle loose
 * enough to hold the whole silhouette carries strips of that white
 * backing down both sides, which is exactly what the first asset did and
 * exactly why its edges had to be dissolved to hide them.
 *
 * The crop now taken is the largest rectangle lying INSIDE the board
 * across the band where it runs full width, so there is no backing left
 * anywhere to hide. And a clean edge does not want hiding: the icon reads
 * as what it is, a panel, with a warm shadow under it setting it in its
 * niche. Fading it was making a sixth-century painting look as though it
 * had been printed on tissue.
 */
export function PantocratorPanel({
  /** The icon's height. Width follows the panel's real proportion. */
  height,
  style,
}: {
  height: number;
  style?: StyleProp<ViewStyle>;
}) {
  const width = height * PANEL_ASPECT;

  return (
    <View style={[{ width, height }, s.panelWrap, style]}>
      {PANTOCRATOR_IMAGE ? (
        <ExpoImage
          source={PANTOCRATOR_IMAGE}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={220}
          accessibilityLabel="Christ Pantocrator, Saint Catherine's Monastery, Sinai, sixth century"
        />
      ) : (
        <LinearGradient
          colors={FIELD_EMPTY}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  );
}

/**
 * THE LAMP: one warm pool, behind whatever is standing there.
 *
 * ⚠ IT BELONGS TO THE SCREEN, NOT TO THE BOARD, and that is deliberate.
 * The prayer screen holds two objects — the cross and the icon — and the
 * change between them is the good part: THE LIGHT STAYS LIT AND THE
 * THING IN IT CHANGES. A lamp owned by the board would go out with it
 * and come back with the other, which is a swap; a lamp that stays is a
 * lamp.
 *
 * Resting it is not extinguished either — it banks, the way the app's
 * dormant register does everywhere else. A prayer that is paused is
 * still a prayer that was begun.
 *
 * `swap` lifts it as the objects exchange, so the moment of the change
 * is lit rather than merely got through.
 */
export function PrayerLamp({
  size,
  light,
  swap,
}: {
  size: number;
  light?: SharedValue<number>;
  swap?: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const at = swap?.value ?? 0;
    const base = 0.34 + (light?.value ?? 0) * 0.66;
    /**
     * ⚠ THE LAMP IS TURNED UP FOR THE ICON, and only a little.
     *
     * This is the one thing about it that may depend on what is standing
     * there — everything else about the exchange rests on the light
     * STAYING and the object changing. But the two objects do not take
     * light the same way: the cross is pale maple in a light frame and
     * gives it all back, while a sixth-century encaustic panel is a dark
     * thing that swallows it. Lit identically, the same lamp reads bright
     * behind the cross and dim behind the icon.
     *
     * A sixth, so it is a lamp answering a darker object rather than a
     * second brightness the eye can catch changing.
     */
    const forObject = 1 + at * 0.17;
    // Brightest exactly halfway through the exchange, and back to
    // nothing at either end of it.
    const flare = 1 + 0.26 * Math.sin(Math.PI * at);
    return { opacity: base * forObject * flare };
  }, [light, swap]);

  return (
    <Reanimated.View
      pointerEvents="none"
      style={[s.lamp, { width: size, height: size }, style]}
      shouldRasterizeIOS
      renderToHardwareTextureAndroid
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="pantocratorLamp" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFC978" stopOpacity={0.46} />
            <Stop offset="0.42" stopColor="#F0BE7A" stopOpacity={0.2} />
            <Stop offset="1" stopColor="#E9C58E" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#pantocratorLamp)" />
      </Svg>
    </Reanimated.View>
  );
}

/**
 * ONE DETAIL OF THE BOARD, enlarged.
 *
 * The same arithmetic the composites use, with no mirror: the board is
 * scaled until the crop fills the window, then slid so the crop's corner
 * sits in the window's corner.
 *
 *   imageW  = boxW / (x1 − x0)
 *   imageH  = imageW / PANEL_ASPECT
 *   offsetX = −x0 · imageW,  offsetY = −y0 · imageH
 *
 * ⚠ IT IS A WINDOW, NOT A FRAME — rounded and shadowed because it is a
 * fragment lifted out of the panel and set on the chapel wall, which is
 * what a museum does with a detail and what the whole board must never
 * get. The board is the object; a frame around it would make it a
 * reproduction. A detail already is one, and says so.
 */
export function PantocratorDetail({
  crop,
  height,
  style,
}: {
  crop: PantocratorCrop;
  height: number;
  style?: StyleProp<ViewStyle>;
}) {
  const g = useMemo(() => {
    const width = height * detailAspect(crop);
    const imageW = width / (crop.x1 - crop.x0);
    const imageH = imageW / PANEL_ASPECT;
    return {
      width,
      imageW,
      imageH,
      left: -crop.x0 * imageW,
      top: -crop.y0 * imageH,
    };
  }, [crop, height]);

  return (
    <View style={[s.detail, { width: g.width, height }, style]}>
      {PANTOCRATOR_IMAGE ? (
        <ExpoImage
          source={PANTOCRATOR_IMAGE}
          style={{
            position: 'absolute',
            width: g.imageW,
            height: g.imageH,
            left: g.left,
            top: g.top,
          }}
          contentFit="fill"
        />
      ) : (
        <LinearGradient
          colors={FIELD_EMPTY}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  );
}

/* ── The two faces ───────────────────────────────────────────────── */

/**
 * The face, whole or mirrored.
 *
 * The geometry, once, so it is checkable:
 *
 *   the crop spans `axisX ± halfWidth` across and `top…bottom` down, and
 *   it is CENTRED ON THE AXIS BY CONSTRUCTION. That is the whole trick —
 *   a crop centred on the face's midline makes each composite a matter
 *   of taking one half of the box and repeating it mirrored, with no
 *   second set of offsets to get wrong.
 *
 *   imageW = boxW / (2 · halfWidth)      the full board, scaled so the
 *   imageH = imageW / PANEL_ASPECT       crop fills the box
 *   offsetX = −(axisX − halfWidth) · imageW
 *   offsetY = −top · imageH
 *
 * `whole` lays the board in the box once. `mercy` fills both halves from
 * the box's LEFT half — the right one flipped. `judgement` fills both
 * from its RIGHT half, which is the same image slid a half-box further
 * left, with the flip on the other side.
 */
export function PantocratorFace({
  width,
  mode,
  style,
}: {
  width: number;
  mode: PantocratorFaceMode;
  style?: StyleProp<ViewStyle>;
}) {
  const g = useMemo(() => {
    const cropW = FACE.halfWidth * 2;
    const cropH = FACE.bottom - FACE.top;
    const imageW = width / cropW;
    const imageH = imageW / PANEL_ASPECT;
    return {
      boxH: cropH * imageH,
      imageW,
      imageH,
      offsetX: -(FACE.axisX - FACE.halfWidth) * imageW,
      offsetY: -FACE.top * imageH,
    };
  }, [width]);

  const half = width / 2;

  // An empty field, and nothing written on it. The panel says nothing when
  // its image is missing either, and it is the caller — which knows why the
  // reader is looking at this — that should do the explaining.
  if (!PANTOCRATOR_IMAGE) {
    return (
      <View style={[s.faceBox, { width, height: g.boxH }, style]}>
        <LinearGradient
          colors={FIELD_EMPTY}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
    );
  }

  if (mode === 'whole') {
    return (
      <View style={[s.faceBox, { width, height: g.boxH }, style]}>
        <FaceSlab
          width={width}
          height={g.boxH}
          imageW={g.imageW}
          imageH={g.imageH}
          left={g.offsetX}
          top={g.offsetY}
        />
      </View>
    );
  }

  // Which half of the crop is repeated, and therefore how far the board
  // has to slide inside each clip: the left half stays where it is, the
  // right half comes across by half a box.
  const slide = mode === 'mercy' ? 0 : -half;
  // And which side of the composite is the flipped one: mercy mirrors the
  // left half onto the right, judgement mirrors the right onto the left.
  const flipRight = mode === 'mercy';

  return (
    <View style={[s.faceBox, s.faceSplit, { width, height: g.boxH }, style]}>
      <FaceSlab
        width={half}
        height={g.boxH}
        imageW={g.imageW}
        imageH={g.imageH}
        left={g.offsetX + slide}
        top={g.offsetY}
        flipped={!flipRight}
      />
      <FaceSlab
        width={half}
        height={g.boxH}
        imageW={g.imageW}
        imageH={g.imageH}
        left={g.offsetX + slide}
        top={g.offsetY}
        flipped={flipRight}
      />
      {/* The seam. A mirrored face joined with no mark reads as a
          photograph of a strange man; a hairline down the axis says
          plainly that this is a made image, which is the honest thing
          for it to say. */}
      <View pointerEvents="none" style={s.faceSeam} />
    </View>
  );
}

/** One clipped window onto the board. */
function FaceSlab({
  width, height, imageW, imageH, left, top, flipped = false,
}: {
  width: number;
  height: number;
  imageW: number;
  imageH: number;
  left: number;
  top: number;
  flipped?: boolean;
}) {
  return (
    <View style={[{ width, height }, s.slab, flipped && s.slabFlipped]}>
      <ExpoImage
        source={PANTOCRATOR_IMAGE ?? undefined}
        style={{ position: 'absolute', width: imageW, height: imageH, left, top }}
        contentFit="fill"
      />
    </View>
  );
}

const s = StyleSheet.create({
  /**
   * ⚠ THE SHADOW IS BACK, and the note that removed it is worth keeping
   * because it was right at the time: a shadow under a picture with no
   * edges is a shadow cast by nothing, and while the board dissolved into
   * the page it had no edges to cast one.
   *
   * It has them now. The panel is a rectangle of painted wood standing in
   * a niche, and the shadow is what puts it there rather than leaving it
   * pasted on. ⚠ WARM, like every other shadow on this screen — a neutral
   * one over warm paper reads as the phone dimming.
   *
   * ⚠ AND STATIC. The niche behind it already carries the whole change
   * between resting and praying; animating a shadow as well would mean
   * re-rasterising a soft edge every frame for a second reading of a
   * thing the wall has already said.
   */
  panelWrap: {
    position: 'relative',
    shadowColor: '#281906',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 28,
    elevation: 12,
  },
  lamp: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  // Centred on the stage the way the lamp is, and behind everything.
  niche: { position: 'absolute', left: '50%', top: '50%' },

  /** A detail lifted out of the board — see PantocratorDetail. */
  detail: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: '#1A1209',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.5,
    shadowRadius: 26,
    elevation: 10,
  },

  faceBox: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: '#1A1209',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.5,
    shadowRadius: 26,
    elevation: 10,
  },
  faceSplit: { flexDirection: 'row', alignItems: 'flex-start' },
  slab: { position: 'relative', overflow: 'hidden' },
  slabFlipped: { transform: [{ scaleX: -1 }] },
  // ⚠ WARM, NOT WHITE. The composites hang on a dark, warm wall now; a
  // neutral white hairline down the middle of a sixth-century face read
  // as a scratch on the photograph rather than as the mark of a join.
  faceSeam: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 1,
    backgroundColor: 'rgba(255,226,182,0.18)',
  },
});
