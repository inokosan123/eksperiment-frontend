import Svg, { Line, Path, Rect } from 'react-native-svg';
import { EMBLEM_LIGHT, emblemStrokes, type EmblemProps } from '@/components/icons/emblemStroke';
import {
  guardShieldInner,
  guardShieldPath,
  sampleLine,
  sampleRoundRect,
  shieldCheck,
  shieldGate,
  trimRuns,
  type Box,
} from '@/components/icons/guardShield';

/* ─────────────────────────────────────────────────────────────
 * THE GUARDED PHONE — Focus's App Blocking card.
 *
 * Its old mark was the icon set's `Clock`, which said the card was
 * about time and nothing about what the time is spent on. The card's
 * subject is the phone, and what the app does to it is guard it.
 *
 * So: the phone, with `guardShield`'s shield standing in front of
 * its lower-right corner and carrying a tick — the limit was kept.
 * Web Protection, the card directly below it, wears the same
 * composition around a globe, so the two read as one promise.
 *
 * DEPTH IS OCCLUSION. The phone's outline, its glass and its last
 * two lines of content are TRIMMED where the shield covers them, so
 * they genuinely stop at its edge. Nothing is filled — see
 * `guardShield` for why that matters when the same emblem has to
 * sit on a white disc and on a gradient plate.
 *
 * The phone's density is the SCREEN: a speaker slit, six app tiles,
 * two lines of content running behind the shield, and the home bar.
 * The tiles are what stop the body reading as a rounded rectangle —
 * which is to say, as a card, the one thing it must not look like on
 * a card.
 * ───────────────────────────────────────────────────────────── */

const GRID = 24;

/** Upper left, leaving the lower-right quarter to the shield. */
const BODY = { x: 2.2, y: 1.3, w: 12.2, h: 19.6, r: 2.5 } as const;
/** The glass, inset from the body — the bezel is what makes it a device. */
const SCREEN = { x: 3.6, y: 3.9, w: 9.4, h: 14.2, r: 1.1 } as const;

const SPEAKER = { y: 2.65, x1: 6.6, x2: 10.0 } as const;
const HOME_BAR = { y: 19.4, x1: 6.0, x2: 10.6 } as const;

/** Two rows of three: the app grid, kept clear of the shield by design. */
const TILE = { w: 2.5, h: 2.3, r: 0.7 } as const;
const TILES: readonly (readonly [number, number])[] = [
  [4.6, 5.1], [7.4, 5.1], [10.2, 5.1],
  [4.6, 8.2], [7.4, 8.2], [10.2, 8.2],
];
/** Content below the grid. These DO run behind the shield, and are trimmed. */
const CONTENT: readonly (readonly [number, number, number])[] = [
  [4.6, 12.4, 12.4],
  [4.6, 11.4, 14.6],
];

/** Standing in front of the phone's foot, breaking its right edge and corner. */
const SHIELD: Box = { x: 10.4, y: 11.5, w: 11.4, h: 11.4 };
const SHIELD_PATH = guardShieldPath(SHIELD);
const SHIELD_INNER = guardShieldInner(SHIELD, 1.15);
const CHECK = shieldCheck(SHIELD, 1.02);

/** Air between the shield's edge and whatever passes behind it. */
const GATE = shieldGate(SHIELD, 1.15);

const BODY_RUNS = trimRuns(sampleRoundRect(BODY.x, BODY.y, BODY.w, BODY.h, BODY.r), GATE);
const SCREEN_RUNS = trimRuns(sampleRoundRect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h, SCREEN.r), GATE);
const CONTENT_RUNS = CONTENT.flatMap(([x1, x2, y]) => trimRuns(sampleLine(x1, y, x2, y), GATE));
const HOME_RUNS = trimRuns(sampleLine(HOME_BAR.x1, HOME_BAR.y, HOME_BAR.x2, HOME_BAR.y), GATE);

export default function ShieldedPhone({ s: size = 24, c = '#000', w = 1.6 }: EmblemProps) {
  const stroke = emblemStrokes(size, w, GRID);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`}>
      {BODY_RUNS.map((d, i) => (
        <Path key={`body-${i}`} d={d} stroke={c} strokeWidth={stroke.board} fill="none" strokeLinecap="round" />
      ))}
      {SCREEN_RUNS.map((d, i) => (
        <Path key={`glass-${i}`} d={d} stroke={c} strokeWidth={stroke.hair} fill="none" strokeLinecap="round" opacity={EMBLEM_LIGHT.hair} />
      ))}

      <Line x1={SPEAKER.x1} y1={SPEAKER.y} x2={SPEAKER.x2} y2={SPEAKER.y} stroke={c} strokeWidth={stroke.rule} strokeLinecap="round" opacity={EMBLEM_LIGHT.rule} />

      {TILES.map(([x, y], i) => (
        <Rect key={`tile-${i}`} x={x} y={y} width={TILE.w} height={TILE.h} rx={TILE.r} ry={TILE.r} fill={c} opacity={EMBLEM_LIGHT.rule} />
      ))}

      {CONTENT_RUNS.map((d, i) => (
        <Path key={`line-${i}`} d={d} stroke={c} strokeWidth={stroke.rule} fill="none" strokeLinecap="round" opacity={EMBLEM_LIGHT.rule} />
      ))}
      {HOME_RUNS.map((d, i) => (
        <Path key={`home-${i}`} d={d} stroke={c} strokeWidth={stroke.rubric} fill="none" strokeLinecap="round" opacity={EMBLEM_LIGHT.rule} />
      ))}

      <Path d={SHIELD_PATH} stroke={c} strokeWidth={stroke.heavy} fill="none" strokeLinejoin="round" />
      <Path d={SHIELD_INNER} stroke={c} strokeWidth={stroke.hair} fill="none" strokeLinejoin="round" opacity={EMBLEM_LIGHT.hair} />
      <Path d={CHECK} stroke={c} strokeWidth={stroke.rubric} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
