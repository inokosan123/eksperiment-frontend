import Svg, { Path } from 'react-native-svg';
import { EMBLEM_LIGHT, emblemStrokes, type EmblemProps } from '@/components/icons/emblemStroke';
import {
  guardShieldInner,
  guardShieldPath,
  padlock,
  sampleEllipse,
  sampleLine,
  shieldGate,
  trimRuns,
  type Box,
} from '@/components/icons/guardShield';

/* ─────────────────────────────────────────────────────────────
 * THE GUARDED GLOBE — Focus's Web Protection.
 *
 * Used twice, deliberately: as the seal on the live Clean Sight
 * pillar at the top of Focus, and as the emblem on the Web
 * Protection card at the foot of it. It is the same subject on both,
 * and one drawing is what makes the page hold together.
 *
 * The composition is `guardShield`'s: THE THING GUARDED, with the
 * shield in front of its lower-right corner. The App Blocking card
 * wears the same arrangement around a phone.
 *
 * THE GLOBE. Outline, an equator at full light, two parallels at
 * half, and one meridian ellipse — five members, which is what gives
 * a circle enough inside it to read at this size. Nothing else in
 * the app is a sphere.
 *
 * THE DEVICE IS A PADLOCK, and it is ON the shield rather than
 * beside it. Beside it, at this size, all three objects shrink until
 * none of them reads; on it, the lock is the shield's charge and
 * everything stays legible. Its body is filled and its shackle
 * stroked — mixed weight is what keeps a lock this small from
 * closing into a blob — and the keyhole is a slot cut back through
 * the body at the plate's own light.
 *
 * DEPTH IS OCCLUSION: every line of the globe is TRIMMED where the
 * shield covers it. Nothing is filled with a background colour,
 * because this emblem sits both on a white disc and on a gradient
 * plate. See `guardShield`.
 * ───────────────────────────────────────────────────────────── */

const GRID = 24;

/** Upper left, leaving the lower-right quarter to the shield. */
const GLOBE = { cx: 9.9, cy: 9.6, r: 8.0 } as const;
/** The meridian: an ellipse on the globe's own centre. */
const MERIDIAN_RX = 3.5;

/** The parallels, as chords — `[dy, halfWidth]`, pulled in off the outline. */
const PARALLELS: readonly (readonly [number, number])[] = [
  [-4.2, 6.5], [4.2, 6.5],
];
/** The equator, at full light: the one line that fixes the sphere's axis. */
const EQUATOR_HALF = 7.86;

/** Standing in front of the globe's foot, breaking its edge. */
const SHIELD: Box = { x: 10.9, y: 11.6, w: 11.2, h: 11.3 };
const SHIELD_PATH = guardShieldPath(SHIELD);
const SHIELD_INNER = guardShieldInner(SHIELD, 1.15);
const LOCK = padlock(SHIELD, 1.0);

/** Air between the shield's edge and whatever passes behind it. */
const GATE = shieldGate(SHIELD, 1.15);

const OUTLINE_RUNS = trimRuns(sampleEllipse(GLOBE.cx, GLOBE.cy, GLOBE.r, GLOBE.r), GATE);
const MERIDIAN_RUNS = trimRuns(sampleEllipse(GLOBE.cx, GLOBE.cy, MERIDIAN_RX, GLOBE.r), GATE);
const PARALLEL_RUNS = PARALLELS.flatMap(([dy, half]) =>
  trimRuns(sampleLine(GLOBE.cx - half, GLOBE.cy + dy, GLOBE.cx + half, GLOBE.cy + dy), GATE));
const EQUATOR_RUNS = trimRuns(
  sampleLine(GLOBE.cx - EQUATOR_HALF, GLOBE.cy, GLOBE.cx + EQUATOR_HALF, GLOBE.cy), GATE);

export default function ShieldedGlobe({ s: size = 24, c = '#000', w = 1.6 }: EmblemProps) {
  const stroke = emblemStrokes(size, w, GRID);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`}>
      {OUTLINE_RUNS.map((d, i) => (
        <Path key={`globe-${i}`} d={d} stroke={c} strokeWidth={stroke.board} fill="none" strokeLinecap="round" />
      ))}
      {MERIDIAN_RUNS.map((d, i) => (
        <Path key={`mer-${i}`} d={d} stroke={c} strokeWidth={stroke.rule} fill="none" strokeLinecap="round" opacity={EMBLEM_LIGHT.rule} />
      ))}
      {PARALLEL_RUNS.map((d, i) => (
        <Path key={`par-${i}`} d={d} stroke={c} strokeWidth={stroke.rule} fill="none" strokeLinecap="round" opacity={EMBLEM_LIGHT.rule} />
      ))}
      {EQUATOR_RUNS.map((d, i) => (
        <Path key={`eq-${i}`} d={d} stroke={c} strokeWidth={stroke.rule} fill="none" strokeLinecap="round" />
      ))}

      <Path d={SHIELD_PATH} stroke={c} strokeWidth={stroke.heavy} fill="none" strokeLinejoin="round" />
      <Path d={SHIELD_INNER} stroke={c} strokeWidth={stroke.hair} fill="none" strokeLinejoin="round" opacity={EMBLEM_LIGHT.hair} />

      <Path d={LOCK.shackle} stroke={c} strokeWidth={stroke.board} fill="none" strokeLinecap="round" />
      <Path d={LOCK.body} fill={c} />
      {/* The keyhole, cut back out of the filled body. */}
      <Path
        d={`M ${LOCK.keyhole.x} ${LOCK.keyhole.y1} L ${LOCK.keyhole.x} ${LOCK.keyhole.y2}`}
        stroke={c}
        strokeWidth={stroke.rubric}
        strokeLinecap="round"
        opacity={0.18}
      />
    </Svg>
  );
}
