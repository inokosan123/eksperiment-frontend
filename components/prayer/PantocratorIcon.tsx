import { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image as ExpoImage, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
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
 *              0.26 takes the head and a little of the halo; the old
 *              0.33 reached past the shoulders, which put the book and
 *              the blessing hand into a crop that is meant to be a face.
 *   top        where the crop begins, above the hair.
 *   bottom     where it ends, below the beard.
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
  halfWidth: 0.26,
  top: 0.06,
  bottom: 0.44,
} as const;

export type PantocratorFaceMode = 'whole' | 'mercy' | 'judgement';

/* ── The icon ────────────────────────────────────────────────────── */

/** The ground seen only while the image is missing. */
const FIELD_EMPTY = ['#F3EADA', '#E4D6BD'] as const;

/* ── THE NICHE ────────────────────────────────────────────────────────
 *
 * ⚠ THE ICON IS A DARK OBJECT AND THE PAGE IS BRIGHT PAPER, and until
 * the real painting arrived nothing on this screen had to reckon with
 * that. An empty board was a pale gradient and dissolved into warm paper
 * beautifully. A sixth-century encaustic panel does not: it is a deep
 * thing — its robe is nearly black, its board is dark at every edge —
 * and fading THAT into cream produced a milky haze all round it, as if
 * the icon were behind frosted glass. It was the one treatment that made
 * the picture look cheap, and it was the treatment already in the code.
 *
 * THE FIX IS NOT TO PUSH THE ICON TOWARD THE PAPER. It is to bring the
 * paper toward the icon: a wide, soft, warm-deep field gathered where
 * the icon stands, so its edges dissolve into a value close to their own
 * and there is nothing left to fog. An icon hangs in a niche; this is
 * that niche, made of light rather than of architecture.
 *
 * ⚠ IT BELONGS TO THE ICON AND NOT TO THE SCREEN, which is the opposite
 * of the lamp. The lamp stays lit while the object in it changes — that
 * is the whole good of the exchange. The niche is the WALL, and the wall
 * is the icon's own: a pale wooden cross wants bright paper behind it and
 * would look shadowed hanging here. So it arrives and leaves with the
 * board, on `swap`.
 *
 * ⚠ AND IT IS MUCH WIDER THAN THE BOARD, deliberately. A field only a
 * little larger would fall away across the panel's own footprint and
 * leave the corners lighter than the sides — a visible ring at exactly
 * the edge all of this exists to hide. Four board-widths across, with
 * the value held flat over the whole panel and falling only well outside
 * it, and the edges have one tone to dissolve into.
 */
const NICHE_TINT = '#4A3312';
const NICHE_TINT_RGB = [0x4a, 0x33, 0x12] as const;

/** How deep the field is over the board itself. */
export const NICHE_ALPHA = { prayer: 0.16, sheet: 0.13 } as const;

/**
 * THE COLOUR THE PANEL'S EDGES MUST DISSOLVE INTO — worked out, never
 * written down.
 *
 * ⚠ THE FADE AND THE NICHE ARE ONE DECISION. A fade running to the room's
 * paper while a niche lies over that paper draws a pale ring at exactly
 * the edge the niche exists to hide; a fade running to a hardcoded colour
 * draws the same ring the day either the tint or the alpha is tuned. So
 * the ground is COMPUTED from the two of them, and the pair cannot drift.
 *
 * `paper` must be a six-digit hex — the room's own colour at the height
 * the board stands.
 */
export function nicheGround(paper: string, alpha: number = NICHE_ALPHA.prayer): string {
  const hex = /^#([0-9a-fA-F]{6})$/.exec(paper);
  if (!hex) return paper;
  const n = parseInt(hex[1], 16);
  const blend = (channel: number, tint: number) =>
    Math.round(channel * (1 - alpha) + tint * alpha);
  const rgb = [
    blend((n >> 16) & 0xff, NICHE_TINT_RGB[0]),
    blend((n >> 8) & 0xff, NICHE_TINT_RGB[1]),
    blend(n & 0xff, NICHE_TINT_RGB[2]),
  ];
  return `#${rgb.map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

export function panelWidth(height: number) {
  return height * PANEL_ASPECT;
}

/**
 * The wall the icon hangs on. Nothing here moves; only its layer opacity
 * does — on the prayer screen, on the same value that exchanges the two
 * objects; in the About sheet, not at all, because nothing else can ever
 * be standing there.
 */
export function PrayerNiche({
  alpha = NICHE_ALPHA.prayer,
  panelHeight,
  swap,
}: {
  alpha?: number;
  panelHeight: number;
  /** 0 = the cross is standing, 1 = the icon is. Omitted: always present. */
  swap?: SharedValue<number>;
}) {
  const width = Math.round(panelWidth(panelHeight) * 4);
  const height = Math.round(panelHeight * 1.9);

  const style = useAnimatedStyle(() => ({ opacity: swap ? swap.value : 1 }), [swap]);

  return (
    <Reanimated.View
      pointerEvents="none"
      style={[s.niche, { width, height, marginLeft: -width / 2, marginTop: -height / 2 }, style]}
      shouldRasterizeIOS
      renderToHardwareTextureAndroid
    >
      <Svg width={width} height={height}>
        <Defs>
          {/* ⚠ The gradient's id carries the alpha. Two niches at
              different depths on screen at once — which is what the
              sheet opening over the prayer screen is — would otherwise
              share one definition and the second would be drawn at the
              first one's value. */}
          <RadialGradient id={`prayerNiche${Math.round(alpha * 1000)}`} cx="50%" cy="50%" r="50%">
            {/* Held flat out to 45% — which covers the whole board — and
                gone by the edge, so the panel has ONE tone behind it and
                the field never shows an edge of its own. */}
            <Stop offset="0" stopColor={NICHE_TINT} stopOpacity={alpha} />
            <Stop offset="0.45" stopColor={NICHE_TINT} stopOpacity={alpha} />
            <Stop offset="0.74" stopColor={NICHE_TINT} stopOpacity={alpha * 0.44} />
            <Stop offset="1" stopColor={NICHE_TINT} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse
          cx={width / 2}
          cy={height / 2}
          rx={width / 2}
          ry={height / 2}
          fill={`url(#prayerNiche${Math.round(alpha * 1000)})`}
        />
      </Svg>
    </Reanimated.View>
  );
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
  /**
   * ⚠ THE COLOUR ACTUALLY BEHIND THE BOARD'S EDGES, which since the niche
   * arrived is no longer the room's paper. Every caller passes
   * `nicheGround(ownPaper)` rather than its paper directly; handed the
   * paper, the fade overshoots the niche and rings.
   */
  ground,
  style,
}: {
  height: number;
  ground: string;
  style?: StyleProp<ViewStyle>;
}) {
  const width = height * PANEL_ASPECT;
  /**
   * ⚠ A TWENTY-FIFTH, NOT A TWELFTH. The fade was twice this deep and it
   * was built for a board that did not exist yet — a pale placeholder
   * gradient, which can be dissolved over any distance you like without
   * looking of anything. Run that far into the real painting and it eats
   * the top of the halo and the foot of the robe and leaves a milky band
   * round all four sides.
   *
   * The niche behind is what makes the short ramp enough: the tone the
   * edges are dissolving into is now close to their own, so the job is
   * only to lose the cut line, not to travel the whole distance from a
   * dark painting to cream paper.
   */
  const fade = Math.round(height * 0.04);

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
  // Centred on the stage the way the lamp is, and behind everything.
  niche: { position: 'absolute', left: '50%', top: '50%' },
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
