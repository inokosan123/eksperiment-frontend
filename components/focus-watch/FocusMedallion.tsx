import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

/**
 * The focus medallion.
 *
 * Focus used to wear the challenge trophy, which meant one emblem stood both
 * for a day the phone was kept down and for a finished 40-day challenge - a
 * currency earned daily and one earned twice a season, drawn identically. The
 * trophy stays with challenges and the bucket list; focus gets its own mark.
 *
 * Geometry is lifted from `assets/animations/focus-medallion.json` at its
 * settled frame, so the still and the animation are the same object: the
 * scalloped rim over its deeper purple ground, the three struck rings, the
 * numeral, and the two ribbon tails.
 *
 * Two cuts of the same artwork. `FocusMedallion` is the whole thing, ribbons
 * and all. `FocusMedallionMark` is the disc alone - square, so it drops into a
 * calendar cell where a trophy used to sit without changing that cell's
 * metrics - and it keeps every scallop, because at 22pt a scallop is still
 * more than a device pixel deep and a plain circle reads as a different, much
 * duller object. Both are memoised: a month of cells rebuilds no path data on
 * scroll, and neither mounts an animation player. The Lottie is kept for the
 * one-off hero moment, where a single player is affordable.
 */

// The badge sits centred on (250, 217.3) in the 500x500 artboard; the outer
// scallop reaches 148.5, so this square frames the disc exactly.
const DISC_BOX = '101.5 68.8 297 297';

/**
 * The scalloped rim ALONE, and the box that frames it.
 *
 * The full medallion is a five-colour object. At hero size that is the point;
 * at 26pt, printed five times across a week strip, five of them beside a sixth
 * on the same card, it stops being a currency and becomes wallpaper — and the
 * numeral on its face says "1" on every single day, which means nothing.
 *
 * So a day that was won is struck as a COIN instead: the medallion's own
 * scalloped edge in one tone, with a gold face seated in it. Same silhouette,
 * same family, one voice — and the full-colour medallion is left to be the
 * only one of its kind on the card.
 */
export const FOCUS_MEDALLION_DISC_BOX = DISC_BOX;
export const FOCUS_MEDALLION_SCALLOP = 'M398.5 217.3C398.5 226.6 380.9 234.2 379.2 243.0C377.4 252.1 390.7 265.7 387.2 274.1C383.7 282.7 364.6 282.9 359.5 290.4C354.4 298.0 361.5 315.8 355.0 322.3C348.5 328.8 330.8 321.7 323.2 326.8C315.5 331.9 315.4 351.0 306.8 354.5C298.5 358.0 284.8 344.7 275.7 346.5C266.9 348.2 259.4 365.8 250 365.8C240.6 365.8 233.1 348.2 224.3 346.5C215.2 344.7 201.5 358.0 193.2 354.5C184.6 351.0 184.4 331.9 176.8 326.8C169.3 321.7 151.5 328.8 145.0 322.3C138.5 315.8 145.6 298.1 140.5 290.4C135.4 282.8 116.3 282.6 112.8 274.1C109.3 265.7 122.6 252.1 120.8 243.0C119.1 234.2 101.5 226.6 101.5 217.3C101.5 207.9 119.1 200.4 120.8 191.6C122.6 182.5 109.3 168.8 112.8 160.4C116.3 151.9 135.4 151.7 140.5 144.1C145.6 136.6 138.5 118.8 145.0 112.3C151.5 105.8 169.2 112.9 176.8 107.8C184.5 102.7 184.6 83.6 193.2 80.1C201.5 76.6 215.2 89.9 224.3 88.1C233.1 86.4 240.6 68.8 250 68.8C259.4 68.8 266.9 86.4 275.7 88.1C284.8 89.9 298.5 76.6 306.8 80.1C315.4 83.6 315.6 102.7 323.2 107.8C330.7 112.9 348.5 105.8 355.0 112.3C361.5 118.8 354.4 136.5 359.5 144.1C364.6 151.8 383.7 151.9 387.2 160.4C390.7 168.8 377.4 182.5 379.2 191.6C380.9 200.4 398.5 207.9 398.5 217.3Z';
/** The face's radius as a fraction of the framed box — the gold seated in the rim. */
export const FOCUS_MEDALLION_FACE_R = 111.4 / 297;
// With the ribbon tails the artwork is taller than it is wide.
const FULL_BOX = '101.5 68.8 297 384';
/**
 * Width over height of the full artwork. A seat that has a square of space and
 * wants the whole medallion in it should ask for `side * FOCUS_MEDALLION_RATIO`
 * of width — then the ribbons reach exactly to the bottom of the square rather
 * than hanging out of it.
 */
export const FOCUS_MEDALLION_RATIO = 297 / 384;
const FULL_RATIO = FOCUS_MEDALLION_RATIO;

export const FOCUS_MEDALLION_SOURCE = require('@/assets/animations/focus-medallion.json');

// The medallion's own palette, for the surfaces that frame it.
export const MEDALLION = {
  rim: '#9A5CA6',
  rimDeep: '#76509A',
  ring: '#FC9026',
  core: '#FA514C',
  face: '#FDD85A',
  faceShade: '#FCC22D',
  numeral: '#FC7823',
} as const;

/**
 * The medallion at rest.
 *
 * A banked focus card cools its emblem to ash. The trophy did that with a flat
 * `tintColor` over a PNG, which collapses every one of its tones to one grey -
 * the shape survived, the striking did not. Struck in warm ash instead, the
 * medallion keeps its rings and its depth while plainly not being lit.
 */
const MEDALLION_ASH = {
  rim: '#BCB098',
  rimDeep: '#A89877',
  ring: '#CFC3A6',
  core: '#C2B594',
  face: '#E4DAC4',
  faceShade: '#D6CAAF',
  numeral: '#A89877',
} as const;

type Palette = typeof MEDALLION | typeof MEDALLION_ASH;

function DiscBody({ c }: { c: Palette }) {
  return (
    <>
      <Path fill={c.rim} d="M398.5 217.3C398.5 226.6 380.9 234.2 379.2 243.0C377.4 252.1 390.7 265.7 387.2 274.1C383.7 282.7 364.6 282.9 359.5 290.4C354.4 298.0 361.5 315.8 355.0 322.3C348.5 328.8 330.8 321.7 323.2 326.8C315.5 331.9 315.4 351.0 306.8 354.5C298.5 358.0 284.8 344.7 275.7 346.5C266.9 348.2 259.4 365.8 250 365.8C240.6 365.8 233.1 348.2 224.3 346.5C215.2 344.7 201.5 358.0 193.2 354.5C184.6 351.0 184.4 331.9 176.8 326.8C169.3 321.7 151.5 328.8 145.0 322.3C138.5 315.8 145.6 298.1 140.5 290.4C135.4 282.8 116.3 282.6 112.8 274.1C109.3 265.7 122.6 252.1 120.8 243.0C119.1 234.2 101.5 226.6 101.5 217.3C101.5 207.9 119.1 200.4 120.8 191.6C122.6 182.5 109.3 168.8 112.8 160.4C116.3 151.9 135.4 151.7 140.5 144.1C145.6 136.6 138.5 118.8 145.0 112.3C151.5 105.8 169.2 112.9 176.8 107.8C184.5 102.7 184.6 83.6 193.2 80.1C201.5 76.6 215.2 89.9 224.3 88.1C233.1 86.4 240.6 68.8 250 68.8C259.4 68.8 266.9 86.4 275.7 88.1C284.8 89.9 298.5 76.6 306.8 80.1C315.4 83.6 315.6 102.7 323.2 107.8C330.7 112.9 348.5 105.8 355.0 112.3C361.5 118.8 354.4 136.5 359.5 144.1C364.6 151.8 383.7 151.9 387.2 160.4C390.7 168.8 377.4 182.5 379.2 191.6C380.9 200.4 398.5 207.9 398.5 217.3Z" />
      <Path fill={c.rimDeep} d="M363.0 194.8C361.5 186.8 373.1 174.9 370.1 167.5C367.0 160.1 350.3 159.9 345.8 153.3C341.3 146.6 347.6 131.1 341.9 125.4C336.2 119.7 320.7 126.0 314.0 121.5C307.4 117.0 307.2 100.3 299.8 97.2C292.4 94.2 280.5 105.8 272.5 104.3C264.8 102.7 258.2 87.4 250 87.4C241.8 87.4 235.2 102.7 227.5 104.3C219.5 105.8 207.6 94.2 200.3 97.2C192.8 100.3 192.6 117.0 186.0 121.5C179.3 126.0 163.8 119.7 158.1 125.4C152.5 131.1 158.7 146.6 154.2 153.3C149.8 159.9 133.0 160.1 129.9 167.5C126.9 174.9 138.5 186.8 137.0 194.7C135.5 202.5 120.1 209.1 120.1 217.3C120.1 225.5 135.5 232.1 137.0 239.8C138.5 247.8 126.9 259.7 129.9 267.0C133.0 274.5 149.7 274.7 154.2 281.3C158.7 288.0 152.5 303.5 158.1 309.1C160.7 311.1 164.0 312.0 167.2 311.7C173.8 311.7 181.7 310.2 186.0 313.1C186.3 313.3 186.7 313.6 186.9 313.9C187.1 314.0 187.3 314.2 187.5 314.4C188.0 314.9 188.4 315.5 188.8 316.1C190.4 318.9 191.6 321.9 192.6 325.0C193.1 326.5 193.6 328.0 194.2 329.5C194.6 330.6 195.1 331.6 195.7 332.6C195.9 333.0 196.1 333.4 196.4 333.8C196.6 334.2 196.9 334.6 197.2 334.9C197.2 335.0 197.2 335.0 197.3 335.0C197.5 335.4 197.8 335.7 198.1 335.9C198.8 336.5 199.5 337.0 200.3 337.3C207.6 340.4 219.5 328.7 227.5 330.3C227.6 330.3 227.7 330.4 227.9 330.4C228.5 330.6 229.1 330.8 229.6 331.1C230.0 331.2 230.3 331.4 230.6 331.6C233.6 333.9 236.4 336.6 238.8 339.7C239.7 340.6 240.5 341.4 241.3 342.3C241.3 342.3 241.8 342.7 241.8 342.7C243.8 345.2 246.8 346.8 250 347.2C253.2 346.8 256.2 345.2 258.2 342.7C258.2 342.7 258.7 342.2 258.7 342.2C259.5 341.4 260.3 340.6 261.1 339.6C263.6 336.6 266.3 333.9 269.4 331.6C269.7 331.4 270.0 331.2 270.3 331.1C270.9 330.8 271.5 330.6 272.1 330.4C272.2 330.3 272.3 330.3 272.5 330.3C280.5 328.7 292.4 340.4 299.7 337.3C300.5 337.0 301.2 336.5 301.9 335.9C302.2 335.6 302.5 335.3 302.7 335.0C302.8 335.0 302.8 334.9 302.8 334.9C303.1 334.6 303.4 334.2 303.6 333.8C303.9 333.4 304.1 333.0 304.3 332.6C304.9 331.6 305.3 330.5 305.7 329.5C306.4 328.0 306.9 326.5 307.4 325.0C308.4 321.9 309.6 318.9 311.2 316.1C311.6 315.5 312.0 314.9 312.5 314.4C312.7 314.2 312.9 314.0 313.1 313.8C313.4 313.5 313.7 313.3 314.0 313.1C318.3 310.2 326.2 311.7 332.8 311.7C336.0 312.0 339.3 311.1 341.9 309.1C347.6 303.4 341.3 288.0 345.8 281.2C350.3 274.6 367.0 274.5 370.1 267.0C373.1 259.6 361.5 247.7 363.0 239.8C364.5 232.1 379.9 225.5 379.9 217.3C379.9 209.1 364.5 202.5 363.0 194.8Z" />
      <Circle fill={c.ring} cx={250} cy={217.3} r={111.4} />
      <Circle fill={c.core} cx={250} cy={217.3} r={99.0} />
      <Path fill={c.faceShade} d="M194.3 192.5C194.3 169.4 203.0 147.1 218.7 130.0C170.5 147.2 145.3 200.3 162.5 248.5C179.8 296.8 232.8 321.9 281.0 304.7C295.4 299.6 308.2 291.0 318.4 279.8C270.3 297.2 217.3 272.4 199.9 224.3C196.2 214.1 194.3 203.4 194.3 192.5Z" />
      <Path fill={c.face} d="M250.0 124.5C301.3 124.5 342.8 166.0 342.8 217.3C342.8 268.5 301.3 310.1 250.0 310.1C198.7 310.1 157.2 268.5 157.2 217.3C157.2 166.0 198.8 124.5 250.0 124.5Z" />
      <Path fill={c.numeral} d="M268.6 248.2C268.6 248.2 268.6 161.6 268.6 161.6C268.6 161.6 243.8 161.6 243.8 161.6C243.8 161.6 219.1 174.0 219.1 174.0C219.1 174.0 219.1 198.7 219.1 198.7C219.1 198.7 243.8 186.4 243.8 186.4C243.8 186.4 243.8 248.2 243.8 248.2C243.8 248.2 225.3 248.2 225.3 248.2C225.3 248.2 225.3 273.0 225.3 273.0C225.3 273.0 287.1 273.0 287.1 273.0C287.1 273.0 287.1 248.2 287.1 248.2C287.1 248.2 268.6 248.2 268.6 248.2Z" />
    </>
  );
}

/** The disc alone: square, every scallop kept, no ribbons. */
export const FocusMedallionMark = React.memo(function FocusMedallionMark({
  size = 22,
  muted = false,
  style,
}: {
  size?: number;
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View pointerEvents="none" style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox={DISC_BOX}>
        <DiscBody c={muted ? MEDALLION_ASH : MEDALLION} />
      </Svg>
    </View>
  );
});

/**
 * A day that was won: the medallion struck as a coin.
 *
 * The scalloped edge in the medal's violet, a gold face seated in it under a
 * top-light, and a hairline of white where the light lands. No numeral — the
 * face says "a medal was won here", and a "1" printed on seven consecutive
 * days says nothing at all.
 */
export const FocusMedalCoin = React.memo(function FocusMedalCoin({
  size = 26,
  muted = false,
  style,
}: {
  size?: number;
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = muted ? MEDALLION_ASH : MEDALLION;
  const faceR = 297 * FOCUS_MEDALLION_FACE_R;
  return (
    <View pointerEvents="none" style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox={DISC_BOX}>
        <Defs>
          <RadialGradient id={muted ? 'coinFaceAsh' : 'coinFace'} cx="42%" cy="34%" r="76%">
            <Stop offset="0" stopColor={muted ? '#F3EDDF' : '#FFF7DD'} />
            <Stop offset="0.55" stopColor={muted ? '#DFD5BE' : '#F4DA9C'} />
            <Stop offset="1" stopColor={muted ? '#C9BEA3' : '#E2BC6E'} />
          </RadialGradient>
        </Defs>
        <Path fill={muted ? c.rimDeep : '#8C5A9C'} d={FOCUS_MEDALLION_SCALLOP} />
        <Circle
          cx={250}
          cy={217.3}
          r={faceR}
          fill={`url(#${muted ? 'coinFaceAsh' : 'coinFace'})`}
        />
        {/* The light the coin catches along its upper edge. */}
        <Path
          d={`M ${250 - faceR * 0.72} ${217.3 - faceR * 0.6} A ${faceR} ${faceR} 0 0 1 ${250 + faceR * 0.62} ${217.3 - faceR * 0.7}`}
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity={muted ? 0.4 : 0.72}
          strokeWidth={9}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
});

/**
 * The whole medallion, ribbons included. Taller than it is wide, so `size` is
 * its width and the height follows the artwork.
 */
export const FocusMedallion = React.memo(function FocusMedallion({
  size = 96,
  muted = false,
  style,
}: {
  size?: number;
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = muted ? MEDALLION_ASH : MEDALLION;
  const height = size / FULL_RATIO;
  return (
    <View pointerEvents="none" style={[{ width: size, height }, style]}>
      <Svg width={size} height={height} viewBox={FULL_BOX}>
      <Path fill={c.rim} d="M247.5 272.4C248.4 272.0 249.2 271.5 249.9 270.8C250.3 270.5 250.6 270.2 250.9 269.8C250.9 269.8 250.9 269.7 251.0 269.6C251.3 269.3 251.6 268.8 251.9 268.4C252.2 268.0 252.5 267.5 252.7 267.0C253.3 265.8 253.9 264.7 254.3 263.5C255.0 261.8 255.6 260.1 256.3 258.3C257.3 254.8 258.8 251.4 260.6 248.2C260.6 248.2 373.7 409.1 373.7 409.1C373.7 409.1 342.8 402.9 342.8 402.9C342.8 402.9 342.8 440.0 342.8 440.0C342.8 440.0 215.9 264.5 215.9 264.5C216.0 264.4 216.2 264.4 216.3 264.4C225.4 262.6 239.1 275.9 247.5 272.4Z" />
      <Path fill={c.faceShade} d="M263.7 244.7C268.6 241.4 277.7 243.2 285.2 243.1C285.2 243.1 390.7 394.3 390.7 394.3C393.6 398.6 392.4 404.5 388.1 407.5C386.5 408.5 384.7 409.1 382.8 409.1C382.8 409.1 373.7 409.1 373.7 409.1C373.7 409.1 260.6 248.2 260.6 248.2C261.0 247.5 261.5 246.8 262.1 246.2C262.3 245.9 262.5 245.7 262.8 245.6C263.0 245.2 263.4 244.9 263.7 244.7Z" />
      <Path fill={c.faceShade} d="M342.8 440.0C342.8 440.0 342.8 442.9 342.8 442.9C342.8 448.1 338.5 452.4 333.3 452.4C333.3 452.4 329.3 452.4 329.3 452.4C326.1 452.4 323.2 450.8 321.4 448.2C321.4 448.2 200.0 278.5 200.0 278.5C200.0 278.5 200.5 278.0 200.5 278.0C201.5 277.1 202.4 276.1 203.4 275.0C206.1 271.6 209.3 268.5 212.8 265.9C213.2 265.7 213.5 265.5 213.9 265.3C214.5 265.0 215.2 264.7 215.9 264.5C215.9 264.5 342.8 440.0 342.8 440.0Z" />
      <Path fill={c.rim} d="M273.1 276.2C273.1 276.2 157.2 440.0 157.2 440.0C157.2 440.0 157.2 402.9 157.2 402.9C157.2 402.9 126.3 409.1 126.3 409.1C126.3 409.1 228.4 259.8 228.4 259.8C230.2 263.0 231.7 266.4 232.8 270.0C233.4 271.7 234.0 273.5 234.7 275.1C235.1 276.3 235.7 277.5 236.3 278.6C236.5 279.1 236.8 279.6 237.1 280.0C237.4 280.5 237.7 280.9 238.0 281.3C238.1 281.3 238.1 281.4 238.1 281.4C238.4 281.8 238.8 282.2 239.1 282.5C239.8 283.1 240.6 283.7 241.5 284.1C250.0 287.5 263.6 274.2 272.7 276.0C272.8 276.0 273.0 276.1 273.1 276.2Z" />
      <Path fill={c.faceShade} d="M275.1 277.0C275.5 277.1 275.8 277.3 276.2 277.5C279.7 280.2 282.9 283.2 285.7 286.7C286.6 287.7 287.5 288.7 288.5 289.6C288.5 289.6 289.0 290.1 289.0 290.1C289.0 290.1 178.6 448.2 178.6 448.2C176.8 450.8 173.9 452.4 170.7 452.4C170.7 452.4 166.7 452.4 166.7 452.4C161.5 452.4 157.2 448.1 157.2 442.9C157.2 442.9 157.2 440.0 157.2 440.0C157.2 440.0 273.1 276.2 273.1 276.2C273.8 276.3 274.5 276.6 275.1 277.0Z" />
      <Path fill={c.faceShade} d="M225.3 256.4C225.6 256.6 226.0 256.9 226.3 257.2C226.5 257.4 226.8 257.6 226.9 257.8C227.5 258.4 228.0 259.1 228.4 259.8C228.4 259.8 126.3 409.1 126.3 409.1C126.3 409.1 117.2 409.1 117.2 409.1C112.0 409.1 107.7 404.9 107.7 399.6C107.7 397.7 108.3 395.9 109.3 394.3C109.3 394.3 203.8 254.7 203.8 254.7C211.3 254.8 220.4 253.1 225.3 256.4Z" />
      <Path fill={c.rim} d="M398.5 217.3C398.5 226.6 380.9 234.2 379.2 243.0C377.4 252.1 390.7 265.7 387.2 274.1C383.7 282.7 364.6 282.9 359.5 290.4C354.4 298.0 361.5 315.8 355.0 322.3C348.5 328.8 330.8 321.7 323.2 326.8C315.5 331.9 315.4 351.0 306.8 354.5C298.5 358.0 284.8 344.7 275.7 346.5C266.9 348.2 259.4 365.8 250 365.8C240.6 365.8 233.1 348.2 224.3 346.5C215.2 344.7 201.5 358.0 193.2 354.5C184.6 351.0 184.4 331.9 176.8 326.8C169.3 321.7 151.5 328.8 145.0 322.3C138.5 315.8 145.6 298.1 140.5 290.4C135.4 282.8 116.3 282.6 112.8 274.1C109.3 265.7 122.6 252.1 120.8 243.0C119.1 234.2 101.5 226.6 101.5 217.3C101.5 207.9 119.1 200.4 120.8 191.6C122.6 182.5 109.3 168.8 112.8 160.4C116.3 151.9 135.4 151.7 140.5 144.1C145.6 136.6 138.5 118.8 145.0 112.3C151.5 105.8 169.2 112.9 176.8 107.8C184.5 102.7 184.6 83.6 193.2 80.1C201.5 76.6 215.2 89.9 224.3 88.1C233.1 86.4 240.6 68.8 250 68.8C259.4 68.8 266.9 86.4 275.7 88.1C284.8 89.9 298.5 76.6 306.8 80.1C315.4 83.6 315.6 102.7 323.2 107.8C330.7 112.9 348.5 105.8 355.0 112.3C361.5 118.8 354.4 136.5 359.5 144.1C364.6 151.8 383.7 151.9 387.2 160.4C390.7 168.8 377.4 182.5 379.2 191.6C380.9 200.4 398.5 207.9 398.5 217.3Z" />
      <Path fill={c.rimDeep} d="M363.0 194.8C361.5 186.8 373.1 174.9 370.1 167.5C367.0 160.1 350.3 159.9 345.8 153.3C341.3 146.6 347.6 131.1 341.9 125.4C336.2 119.7 320.7 126.0 314.0 121.5C307.4 117.0 307.2 100.3 299.8 97.2C292.4 94.2 280.5 105.8 272.5 104.3C264.8 102.7 258.2 87.4 250 87.4C241.8 87.4 235.2 102.7 227.5 104.3C219.5 105.8 207.6 94.2 200.3 97.2C192.8 100.3 192.6 117.0 186.0 121.5C179.3 126.0 163.8 119.7 158.1 125.4C152.5 131.1 158.7 146.6 154.2 153.3C149.8 159.9 133.0 160.1 129.9 167.5C126.9 174.9 138.5 186.8 137.0 194.7C135.5 202.5 120.1 209.1 120.1 217.3C120.1 225.5 135.5 232.1 137.0 239.8C138.5 247.8 126.9 259.7 129.9 267.0C133.0 274.5 149.7 274.7 154.2 281.3C158.7 288.0 152.5 303.5 158.1 309.1C160.7 311.1 164.0 312.0 167.2 311.7C173.8 311.7 181.7 310.2 186.0 313.1C186.3 313.3 186.7 313.6 186.9 313.9C187.1 314.0 187.3 314.2 187.5 314.4C188.0 314.9 188.4 315.5 188.8 316.1C190.4 318.9 191.6 321.9 192.6 325.0C193.1 326.5 193.6 328.0 194.2 329.5C194.6 330.6 195.1 331.6 195.7 332.6C195.9 333.0 196.1 333.4 196.4 333.8C196.6 334.2 196.9 334.6 197.2 334.9C197.2 335.0 197.2 335.0 197.3 335.0C197.5 335.4 197.8 335.7 198.1 335.9C198.8 336.5 199.5 337.0 200.3 337.3C207.6 340.4 219.5 328.7 227.5 330.3C227.6 330.3 227.7 330.4 227.9 330.4C228.5 330.6 229.1 330.8 229.6 331.1C230.0 331.2 230.3 331.4 230.6 331.6C233.6 333.9 236.4 336.6 238.8 339.7C239.7 340.6 240.5 341.4 241.3 342.3C241.3 342.3 241.8 342.7 241.8 342.7C243.8 345.2 246.8 346.8 250 347.2C253.2 346.8 256.2 345.2 258.2 342.7C258.2 342.7 258.7 342.2 258.7 342.2C259.5 341.4 260.3 340.6 261.1 339.6C263.6 336.6 266.3 333.9 269.4 331.6C269.7 331.4 270.0 331.2 270.3 331.1C270.9 330.8 271.5 330.6 272.1 330.4C272.2 330.3 272.3 330.3 272.5 330.3C280.5 328.7 292.4 340.4 299.7 337.3C300.5 337.0 301.2 336.5 301.9 335.9C302.2 335.6 302.5 335.3 302.7 335.0C302.8 335.0 302.8 334.9 302.8 334.9C303.1 334.6 303.4 334.2 303.6 333.8C303.9 333.4 304.1 333.0 304.3 332.6C304.9 331.6 305.3 330.5 305.7 329.5C306.4 328.0 306.9 326.5 307.4 325.0C308.4 321.9 309.6 318.9 311.2 316.1C311.6 315.5 312.0 314.9 312.5 314.4C312.7 314.2 312.9 314.0 313.1 313.8C313.4 313.5 313.7 313.3 314.0 313.1C318.3 310.2 326.2 311.7 332.8 311.7C336.0 312.0 339.3 311.1 341.9 309.1C347.6 303.4 341.3 288.0 345.8 281.2C350.3 274.6 367.0 274.5 370.1 267.0C373.1 259.6 361.5 247.7 363.0 239.8C364.5 232.1 379.9 225.5 379.9 217.3C379.9 209.1 364.5 202.5 363.0 194.8Z" />
      <Circle fill={c.ring} cx={250} cy={217.3} r={111.4} />
      <Circle fill={c.core} cx={250} cy={217.3} r={99.0} />
      <Path fill={c.faceShade} d="M194.3 192.5C194.3 169.4 203.0 147.1 218.7 130.0C170.5 147.2 145.3 200.3 162.5 248.5C179.8 296.8 232.8 321.9 281.0 304.7C295.4 299.6 308.2 291.0 318.4 279.8C270.3 297.2 217.3 272.4 199.9 224.3C196.2 214.1 194.3 203.4 194.3 192.5Z" />
      <Path fill={c.face} d="M250.0 124.5C301.3 124.5 342.8 166.0 342.8 217.3C342.8 268.5 301.3 310.1 250.0 310.1C198.7 310.1 157.2 268.5 157.2 217.3C157.2 166.0 198.8 124.5 250.0 124.5Z" />
      <Path fill={c.numeral} d="M268.6 248.2C268.6 248.2 268.6 161.6 268.6 161.6C268.6 161.6 243.8 161.6 243.8 161.6C243.8 161.6 219.1 174.0 219.1 174.0C219.1 174.0 219.1 198.7 219.1 198.7C219.1 198.7 243.8 186.4 243.8 186.4C243.8 186.4 243.8 248.2 243.8 248.2C243.8 248.2 225.3 248.2 225.3 248.2C225.3 248.2 225.3 273.0 225.3 273.0C225.3 273.0 287.1 273.0 287.1 273.0C287.1 273.0 287.1 248.2 287.1 248.2C287.1 248.2 268.6 248.2 268.6 248.2Z" />
      </Svg>
    </View>
  );
});

/**
 * The ribbon tails alone.
 *
 * A day the phone was kept is drawn as a coin in a round seat. Given the whole
 * medallion the seat would have to grow tall enough to hold the tails, and a
 * row of tall cells reads as a list rather than as a week. So the tails are
 * drawn behind the seat instead: the round ground covers where they join the
 * disc, and only what reaches past its edge shows. The coin gains a layer
 * behind it and the strip keeps its round rhythm.
 *
 * The viewBox is the tails' own bounds (they hang from y 241 to 452 in the
 * artboard), so the caller positions a small box rather than a full-size
 * medallion with a transparent disc-shaped hole in it.
 */
const RIBBON_BOX = '107.7 241.4 285.9 211';
export const FOCUS_RIBBON_RATIO = 285.9 / 211;

export const FocusMedallionRibbons = React.memo(function FocusMedallionRibbons({
  width,
  muted = false,
  style,
}: {
  width: number;
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = muted ? MEDALLION_ASH : MEDALLION;
  const height = width / FOCUS_RIBBON_RATIO;
  return (
    <View pointerEvents="none" style={[{ width, height }, style]}>
      <Svg width={width} height={height} viewBox={RIBBON_BOX}>
      <Path fill={c.rim} d="M247.5 272.4C248.4 272.0 249.2 271.5 249.9 270.8C250.3 270.5 250.6 270.2 250.9 269.8C250.9 269.8 250.9 269.7 251.0 269.6C251.3 269.3 251.6 268.8 251.9 268.4C252.2 268.0 252.5 267.5 252.7 267.0C253.3 265.8 253.9 264.7 254.3 263.5C255.0 261.8 255.6 260.1 256.3 258.3C257.3 254.8 258.8 251.4 260.6 248.2C260.6 248.2 373.7 409.1 373.7 409.1C373.7 409.1 342.8 402.9 342.8 402.9C342.8 402.9 342.8 440.0 342.8 440.0C342.8 440.0 215.9 264.5 215.9 264.5C216.0 264.4 216.2 264.4 216.3 264.4C225.4 262.6 239.1 275.9 247.5 272.4Z" />
      <Path fill={c.faceShade} d="M263.7 244.7C268.6 241.4 277.7 243.2 285.2 243.1C285.2 243.1 390.7 394.3 390.7 394.3C393.6 398.6 392.4 404.5 388.1 407.5C386.5 408.5 384.7 409.1 382.8 409.1C382.8 409.1 373.7 409.1 373.7 409.1C373.7 409.1 260.6 248.2 260.6 248.2C261.0 247.5 261.5 246.8 262.1 246.2C262.3 245.9 262.5 245.7 262.8 245.6C263.0 245.2 263.4 244.9 263.7 244.7Z" />
      <Path fill={c.faceShade} d="M342.8 440.0C342.8 440.0 342.8 442.9 342.8 442.9C342.8 448.1 338.5 452.4 333.3 452.4C333.3 452.4 329.3 452.4 329.3 452.4C326.1 452.4 323.2 450.8 321.4 448.2C321.4 448.2 200.0 278.5 200.0 278.5C200.0 278.5 200.5 278.0 200.5 278.0C201.5 277.1 202.4 276.1 203.4 275.0C206.1 271.6 209.3 268.5 212.8 265.9C213.2 265.7 213.5 265.5 213.9 265.3C214.5 265.0 215.2 264.7 215.9 264.5C215.9 264.5 342.8 440.0 342.8 440.0Z" />
      <Path fill={c.rim} d="M273.1 276.2C273.1 276.2 157.2 440.0 157.2 440.0C157.2 440.0 157.2 402.9 157.2 402.9C157.2 402.9 126.3 409.1 126.3 409.1C126.3 409.1 228.4 259.8 228.4 259.8C230.2 263.0 231.7 266.4 232.8 270.0C233.4 271.7 234.0 273.5 234.7 275.1C235.1 276.3 235.7 277.5 236.3 278.6C236.5 279.1 236.8 279.6 237.1 280.0C237.4 280.5 237.7 280.9 238.0 281.3C238.1 281.3 238.1 281.4 238.1 281.4C238.4 281.8 238.8 282.2 239.1 282.5C239.8 283.1 240.6 283.7 241.5 284.1C250.0 287.5 263.6 274.2 272.7 276.0C272.8 276.0 273.0 276.1 273.1 276.2Z" />
      <Path fill={c.faceShade} d="M275.1 277.0C275.5 277.1 275.8 277.3 276.2 277.5C279.7 280.2 282.9 283.2 285.7 286.7C286.6 287.7 287.5 288.7 288.5 289.6C288.5 289.6 289.0 290.1 289.0 290.1C289.0 290.1 178.6 448.2 178.6 448.2C176.8 450.8 173.9 452.4 170.7 452.4C170.7 452.4 166.7 452.4 166.7 452.4C161.5 452.4 157.2 448.1 157.2 442.9C157.2 442.9 157.2 440.0 157.2 440.0C157.2 440.0 273.1 276.2 273.1 276.2C273.8 276.3 274.5 276.6 275.1 277.0Z" />
      <Path fill={c.faceShade} d="M225.3 256.4C225.6 256.6 226.0 256.9 226.3 257.2C226.5 257.4 226.8 257.6 226.9 257.8C227.5 258.4 228.0 259.1 228.4 259.8C228.4 259.8 126.3 409.1 126.3 409.1C126.3 409.1 117.2 409.1 117.2 409.1C112.0 409.1 107.7 404.9 107.7 399.6C107.7 397.7 108.3 395.9 109.3 394.3C109.3 394.3 203.8 254.7 203.8 254.7C211.3 254.8 220.4 253.1 225.3 256.4Z" />
      </Svg>
    </View>
  );
});
