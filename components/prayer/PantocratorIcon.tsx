import { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image as ExpoImage, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Reanimated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

/* ─────────────────────────────────────────────────────────────
 * THE SINAI PANTOCRATOR — the panel, and the two faces in it.
 *
 * One component family, used in two places: the hero of the My Rule
 * prayer screen, and the figure on two slides of the About sheet. They
 * share a file because they must share a frame — the same board seen
 * twice, not two drawings of it.
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
 * ⚠ THE FILE IS NOT IN THE REPO YET, AND THAT IS WHY THIS IS A CONSTANT
 * RATHER THAN A require() AT THE POINT OF USE.
 *
 * Metro resolves require() statically: a require of a path that does not
 * exist is not a runtime null, it is a build failure, and there is no
 * try/catch that saves you from it. So the source lives here alone, and
 * everything below renders an empty board while it is null.
 *
 * TO TURN THE ICON ON:
 *   1. Save the Sinai Pantocrator — public domain, sixth century — as
 *      `assets/images/prayer/pantocrator-sinai.jpg`. Wikimedia Commons
 *      carries it at full resolution.
 *   2. ⚠ Crop it to the painted board and nothing else. No mount, no
 *      wall, no drop shadow from the photograph. PANEL_ASPECT below is
 *      the panel's real proportion, and a photograph with margin in it
 *      will not match.
 *   3. Replace the null on the next line with:
 *        require('@/assets/images/prayer/pantocrator-sinai.jpg')
 *   4. Calibrate FACE against the real file — see the block below.
 */
export const PANTOCRATOR_IMAGE: ImageSource | number | null = null;

/**
 * The board's real proportion: 45.5 cm wide by 84 cm tall.
 * Source: Wikipedia, "Christ Pantocrator (Sinai)".
 */
export const PANEL_ASPECT = 45.5 / 84;

/* ── FACE CALIBRATION ─────────────────────────────────────────────────
 *
 * ⚠ THESE FOUR NUMBERS ARE ESTIMATES UNTIL SOMEONE SETS THEM AGAINST
 * THE REAL FILE. They are written down rather than guessed inline so
 * that tuning them is a two-minute job and not an archaeology dig.
 *
 * All four are fractions of the cropped board, measured from its
 * top-left corner.
 *
 *   axisX      where the FACE's own midline falls — down the bridge of
 *              the nose. ⚠ NOT the middle of the board. The figure is
 *              not centred on the panel, and the board was cut down
 *              along its sides at some point, so 0.5 is a starting
 *              guess and almost certainly wrong. Everything about the
 *              two composites depends on this one number: mirror about
 *              the wrong axis and you get two strangers rather than two
 *              readings of one man.
 *   halfWidth  how far to either side of that axis the face crop runs.
 *   top        where the crop begins, above the hair.
 *   bottom     where it ends, below the beard.
 */
export const FACE = {
  axisX: 0.5,
  halfWidth: 0.33,
  top: 0.05,
  bottom: 0.40,
} as const;

export type PantocratorFaceMode = 'whole' | 'mercy' | 'judgement';

/* ── The icon ────────────────────────────────────────────────────── */

/** The ground seen only while the image is missing. */
const FIELD_EMPTY = ['#F3EADA', '#E4D6BD'] as const;

export function panelWidth(height: number) {
  return height * PANEL_ASPECT;
}

/**
 * THE ICON, UNFRAMED.
 *
 * ⚠ IT WORE A GILT BORDER AND THE BORDER IS GONE. A frame turns the icon
 * into a picture hanging on the screen — an object with an edge, a thing
 * displayed. What this screen wants is the face itself, present, with
 * nothing announcing that it is a reproduction. The lamp behind it does
 * all the framing that is wanted.
 *
 * ⚠ AND IT DOES NOT END IN A HARD LINE EITHER. Without a border, a
 * rectangle of photograph cut off dead against warm paper is worse than
 * a frame was — the frame at least explained the edge. So the image
 * FADES OUT at its own edges into the page: four gradients, one per
 * side, running from the screen's paper colour to transparent. The face
 * is at the middle where they never reach, and what you see is an image
 * emerging from the light rather than a picture placed on it.
 *
 * `ground` is the paper it fades into and must be the colour actually
 * behind it, or the fade shows as a grey haze. The prayer screen hands
 * over its own; the About sheet, which is parchment, hands over its.
 */
export function PantocratorPanel({
  /** The icon's height. Width follows the panel's real proportion. */
  height,
  ground = '#FDF8EF',
  style,
}: {
  height: number;
  ground?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const width = height * PANEL_ASPECT;
  // Enough to lose the cut edge, little enough to leave the face whole:
  // the head sits within the top third, so a fade of a twelfth never
  // touches it.
  const fade = Math.round(height * 0.085);

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

      {/* The four edges dissolving into the page. Drawn over the image,
          each one only as deep as it needs to be. */}
      <EdgeFade ground={ground} depth={fade} side="top" />
      <EdgeFade ground={ground} depth={fade} side="bottom" />
      <EdgeFade ground={ground} depth={fade} side="left" />
      <EdgeFade ground={ground} depth={fade} side="right" />
    </View>
  );
}

function EdgeFade({
  ground,
  depth,
  side,
}: {
  ground: string;
  depth: number;
  side: 'top' | 'bottom' | 'left' | 'right';
}) {
  const vertical = side === 'top' || side === 'bottom';
  /**
   * ⚠ THE FAR STOP IS THE SAME COLOUR AT ZERO ALPHA, NEVER 'transparent'.
   * `transparent` is transparent BLACK, and Android interpolates through
   * it — so a warm fade to `transparent` arrives as a dirty grey halo
   * around the image, which is the single most common way an effect like
   * this goes wrong. `ground` must therefore be a six-digit hex; anything
   * else falls back rather than producing that halo silently.
   */
  const clear = /^#[0-9a-fA-F]{6}$/.test(ground) ? `${ground}00` : 'rgba(253,248,239,0)';

  // Every fade runs FROM the paper INTO nothing, so the colour stop order
  // is fixed and only the direction turns.
  const start = side === 'top' ? { x: 0.5, y: 0 }
    : side === 'bottom' ? { x: 0.5, y: 1 }
      : side === 'left' ? { x: 0, y: 0.5 }
        : { x: 1, y: 0.5 };
  const end = side === 'top' ? { x: 0.5, y: 1 }
    : side === 'bottom' ? { x: 0.5, y: 0 }
      : side === 'left' ? { x: 1, y: 0.5 }
        : { x: 0, y: 0.5 };

  return (
    <LinearGradient
      pointerEvents="none"
      colors={[ground, clear]}
      start={start}
      end={end}
      style={[
        s.edgeFade,
        vertical
          ? { [side]: 0, left: 0, right: 0, height: depth }
          : { [side]: 0, top: 0, bottom: 0, width: depth },
      ]}
    />
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
    const base = 0.34 + (light?.value ?? 0) * 0.66;
    // Brightest exactly halfway through the exchange, and back to
    // nothing at either end of it.
    const flare = 1 + 0.26 * Math.sin(Math.PI * (swap?.value ?? 0));
    return { opacity: base * flare };
  }, [light, swap]);

  return (
    <Reanimated.View pointerEvents="none" style={[s.lamp, { width: size, height: size }, style]}>
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
  // ⚠ No shadow on it any more. A drop shadow is what an object lying ON
  // a surface casts, and the whole point of losing the frame is that the
  // icon is not an object placed on the page — it comes out of the light.
  // A shadow under a picture with no edges is a shadow cast by nothing.
  panelWrap: { position: 'relative' },
  lamp: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  edgeFade: { position: 'absolute' },

  faceBox: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 10,
    borderCurve: 'continuous',
    backgroundColor: '#EFE5D2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceSplit: { flexDirection: 'row', alignItems: 'flex-start' },
  slab: { position: 'relative', overflow: 'hidden' },
  slabFlipped: { transform: [{ scaleX: -1 }] },
  faceSeam: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
});
