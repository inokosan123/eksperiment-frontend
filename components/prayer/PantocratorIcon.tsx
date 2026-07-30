import { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image as ExpoImage, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Reanimated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { F } from '@/constants/tokens';

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

/* ── The board ───────────────────────────────────────────────────── */

const GOLD_FRAME = ['#E7CD93', '#C9A45C', '#A97F35'] as const;
/** The sunken field's own ground, seen only while the image is missing. */
const FIELD_EMPTY = ['#F3EADA', '#E4D6BD'] as const;

/** How much of the board the raised border takes, as a share of its width. */
const BORDER_RATIO = 0.055;

export function PantocratorPanel({
  /** Total height of the board including its border. Width follows. */
  height,
  /** 0 at rest, 1 while the prayer runs — the lamp. */
  light,
  style,
}: {
  height: number;
  light?: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
}) {
  const width = height * PANEL_ASPECT;
  const border = Math.max(7, Math.round(width * BORDER_RATIO));
  // The pool reaches well outside the board; a glow that stops at the
  // frame is a rectangle of light, which is not what a lamp makes.
  const pool = Math.round(width * 2.1);

  return (
    <View style={[{ width, height }, s.panelWrap, style]}>
      <Lamp size={pool} light={light} />

      <View style={[s.board, { width, height, borderRadius: Math.max(6, border * 0.7) }]}>
        <LinearGradient
          colors={GOLD_FRAME}
          locations={[0, 0.55, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View pointerEvents="none" style={s.boardLit} />

        {/* The kovcheg: the field is cut INTO the board, so the step down
            into it throws a hairline of shadow at its head and catches a
            hairline of light at its foot. Without those two lines the
            border is a coloured margin rather than a raised edge. */}
        <View style={[s.field, { top: border, left: border, right: border, bottom: border }]}>
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
          <View pointerEvents="none" style={s.fieldShadowTop} />
          <View pointerEvents="none" style={s.fieldLightFoot} />
        </View>
      </View>
    </View>
  );
}

/**
 * The lamp: one warm pool behind the board.
 *
 * Resting it is not extinguished — it banks, the way the app's dormant
 * register does everywhere else. A prayer that is paused is still a
 * prayer that was begun.
 */
function Lamp({ size, light }: { size: number; light?: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: 0.34 + (light?.value ?? 0) * 0.66,
  }), [light]);

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

  if (!PANTOCRATOR_IMAGE) {
    return (
      <View style={[s.faceBox, { width, height: g.boxH }, style]}>
        <LinearGradient
          colors={FIELD_EMPTY}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Text style={s.facePlaceholder}>
          The icon is not in the app yet
        </Text>
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
  panelWrap: { alignItems: 'center', justifyContent: 'center' },
  lamp: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  board: {
    position: 'relative',
    overflow: 'hidden',
    borderCurve: 'continuous',
    // A board is a heavy object and casts like one.
    shadowColor: '#3A2A10',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.26,
    shadowRadius: 22,
    elevation: 8,
  },
  boardLit: {
    position: 'absolute',
    top: 1,
    left: '18%',
    right: '18%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  field: { position: 'absolute', overflow: 'hidden', backgroundColor: '#EFE5D2' },
  fieldShadowTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: 'rgba(58,42,16,0.34)',
  },
  fieldLightFoot: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,246,224,0.34)',
  },

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
  facePlaceholder: {
    fontFamily: F.serifItalic,
    fontSize: 13.5,
    color: 'rgba(88,68,36,0.6)',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
