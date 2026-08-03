import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { EMBLEM_LIGHT, emblemStrokes, type EmblemProps } from '@/components/icons/emblemStroke';

/* ─────────────────────────────────────────────────────────────
 * THE HARD LOCK — Web Protection's impulse guard.
 *
 * The panel wore a 20pt icon-set padlock: one uniform hairline, two
 * paths, nothing inside it. Beside the drawn marks the rest of the
 * app carries — the hourglass on Focus, the trophy on Bucket List,
 * the Gospel on Scripture — it read as a placeholder.
 *
 * The subject is not in doubt. Hard Lock IS a padlock; the emblem is
 * the object, not a construction about it. What it needed was to be
 * FORGED rather than traced.
 *
 * WHY THIS IS NOT THE PADLOCK ON THE SHIELD. `guardShield`'s lock is
 * a charge — a 4pt device on a shield, built so it survives being
 * tiny. This one is the subject at 26pt and up, so it is built the
 * other way: a case with real hardware in it. The shield's lock is
 * deliberately left alone.
 *
 * THE THREE RULES OF THE FAMILY, as this one keeps them:
 *
 *   MIXED WEIGHTS. The shackle is the emblem's heaviest line and is
 *   drawn as a BEAM — an outer stroke with a hairline running inside
 *   it, the same trick that made the Habits ladder read as timber and
 *   the hourglass's posts as brass. Against it the keyhole is solid
 *   mass and the rivets are struck dots.
 *
 *   INTERNAL DENSITY. Case, bevel, four rivets, keyhole in two parts,
 *   shackle in two — ten members. This is what the eye finds when the
 *   mark is blown up to half a plate.
 *
 *   A WHOLE OBJECT WITH A BOTTOM. The case sits flat. An icon-set
 *   padlock hangs from its shackle and is cropped at the foot; this
 *   one stands, so it can be set into a card corner uncut.
 *
 * WHAT WAS TRIED AND CUT. An escutcheon plate around the keyhole, and
 * a second seam across the case's foot. The plate put a third rounded
 * rectangle inside the bevel inside the case — a box in a box in a
 * box, which is the one construction this app does not allow; the
 * second seam read as a drawer front. Four corner rivets do the same
 * work honestly: they are hardware, and hardware is not a frame.
 *
 * WHY NOTHING IS FILLED BUT THE KEYHOLE. The mark sits on a cream
 * seat, on solid bronze when the lock is permanent, and on ash while
 * a change is pending. A filled case can only ever match one of them
 * — on bronze it collapses into a white blob and every detail inside
 * it is lost. Outline holds all three, and the keyhole stays the one
 * true void: the darkest mass, and what stops the case reading as an
 * empty box.
 *
 * THE SHACKLE IS SHUT. Its legs stop dead on the case's top edge
 * rather than passing behind it — with nothing filled, a leg drawn
 * through the case would show straight through it. Stopping on the
 * edge is what closes the lock.
 * ───────────────────────────────────────────────────────────── */

const GRID = 24;

/** The case: a forged block, standing flat on its own foot. */
const CASE = { x: 3.6, y: 9.6, w: 16.8, h: 12.2, r: 2.6 } as const;
/** The tooled line inside the edge, as on the Gospel's board. */
const BEVEL = 1.35;

/**
 * The shackle, shut. Half-width 3.3 sets the legs at 8.7 and 15.3; the
 * shoulders at 5.9 put the crown at 2.6, which is what fills the grid's
 * upper third — an emblem that floats mid-grid drags the whole set down.
 */
const SHACKLE = { half: 3.3, shoulder: 5.9, foot: CASE.y } as const;
/** The hairline inside the beam, drawn on a slightly tighter radius. */
const SHACKLE_INNER = 0.6;

function shackleAt(half: number): string {
  const n = (v: number) => v.toFixed(2);
  return `M ${n(12 - half)} ${n(SHACKLE.foot)} V ${n(SHACKLE.shoulder)}`
    + ` A ${n(half)} ${n(half)} 0 0 1 ${n(12 + half)} ${n(SHACKLE.shoulder)}`
    + ` V ${n(SHACKLE.foot)}`;
}
const SHACKLE_PATH = shackleAt(SHACKLE.half);
const SHACKLE_BEAM = shackleAt(SHACKLE.half - SHACKLE_INNER);

/** The rivets holding the face plate on — hardware, not a frame. */
const RIVETS: readonly (readonly [number, number])[] = [
  [6.4, 12.9], [17.6, 12.9], [6.4, 19.1], [17.6, 19.1],
];
const RIVET_R = 0.62;

/**
 * The keyhole, warded: a bored eye with a tapered ward cut below it.
 * The emblem's one filled mass, and its focal point.
 */
const KEY_EYE = { cx: 12, cy: 15.9, r: 1.5 } as const;
const KEY_WARD = 'M 11.36 16.73 L 10.66 19.30 L 13.34 19.30 L 12.64 16.73 Z';

export default function HardLock({ s: size = 24, c = '#000', w = 1.6 }: EmblemProps) {
  const stroke = emblemStrokes(size, w, GRID);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`}>
      {/* Drawn first, so the case's edge closes over the shackle's feet. */}
      <Path d={SHACKLE_PATH} stroke={c} strokeWidth={stroke.heavy} fill="none" strokeLinecap="round" />
      <Path
        d={SHACKLE_BEAM} stroke={c} strokeWidth={stroke.hair} fill="none"
        strokeLinecap="round" opacity={EMBLEM_LIGHT.hair}
      />

      <Rect
        x={CASE.x} y={CASE.y} width={CASE.w} height={CASE.h} rx={CASE.r} ry={CASE.r}
        stroke={c} strokeWidth={stroke.board} fill="none"
      />
      <Rect
        x={CASE.x + BEVEL} y={CASE.y + BEVEL}
        width={CASE.w - BEVEL * 2} height={CASE.h - BEVEL * 2}
        rx={CASE.r - BEVEL * 0.6} ry={CASE.r - BEVEL * 0.6}
        stroke={c} strokeWidth={stroke.hair} fill="none" opacity={EMBLEM_LIGHT.hair}
      />

      {RIVETS.map(([cx, cy], i) => (
        <Circle key={i} cx={cx} cy={cy} r={RIVET_R} fill={c} />
      ))}

      <Circle cx={KEY_EYE.cx} cy={KEY_EYE.cy} r={KEY_EYE.r} fill={c} />
      <Path d={KEY_WARD} fill={c} />
    </Svg>
  );
}
