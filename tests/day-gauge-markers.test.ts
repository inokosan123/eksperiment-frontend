import test from 'node:test';
import assert from 'node:assert/strict';
import {
  essentialsCapWidth,
  ESSENTIALS_HALF,
  gaugeMarkerLayout,
  GOAL_LABEL_OFFSET,
  GOAL_LABEL_W,
  LABEL_AIR,
  MARK_CLEARANCE,
  MARK_HALF,
  TOL_LABEL_HALF,
} from '../components/focus-watch/dayGaugeMarkers';

/**
 * The gauge's marker line has to survive a plan with no tolerance at all,
 * which is the case that used to stack the goal medallion on top of the
 * essentials mark. The cap widens to open that clearance; these fix how far it
 * is allowed to go, and prove the geometry actually clears.
 */

const GAP = 2.5;
const BASE_CAP = 17;

/** Where the two marks end up, given a cap width. */
function marks(trackWidth: number, capWidth: number, goalShare: number, gapTotal: number) {
  const flexWidth = Math.max(0, trackWidth - capWidth - gapTotal);
  return {
    goal: goalShare * flexWidth,
    essentials: trackWidth - capWidth / 2,
  };
}

function clearance(trackWidth: number, goalMinutes: number, toleranceSpan: number) {
  const planned = Math.max(goalMinutes + toleranceSpan, 1);
  const goalShare = Math.min(1, goalMinutes / planned);
  const gapTotal = GAP * (toleranceSpan > 0 ? 2 : 1);
  const cap = essentialsCapWidth(trackWidth, BASE_CAP, goalShare, gapTotal);
  const { goal, essentials } = marks(trackWidth, cap, goalShare, gapTotal);
  return { cap, gap: essentials - goal };
}

test('a plan with no tolerance at all still separates its two marks', () => {
  const { cap, gap } = clearance(325, 90, 0);
  assert.ok(gap >= MARK_CLEARANCE - 0.01, `marks only ${gap.toFixed(1)} apart`);
  assert.ok(cap > BASE_CAP, 'the cap has to grow to open that clearance');
});

test('the widened cap is the ONLY thing that changes — it never exceeds a quarter of the bar', () => {
  for (const width of [150, 200, 260, 325, 420]) {
    const { cap } = clearance(width, 120, 0);
    assert.ok(cap <= width * 0.25 + 0.01, `cap ${cap.toFixed(1)} of track ${width}`);
  }
});

test('a tolerance too small to matter is treated like none at all', () => {
  // Five minutes on a two-hour goal puts the tick within a hair of the cap.
  const { gap } = clearance(325, 120, 5);
  assert.ok(gap >= MARK_CLEARANCE - 0.01, `marks only ${gap.toFixed(1)} apart`);
});

test('a generous tolerance leaves the cap at its base width', () => {
  const { cap, gap } = clearance(325, 90, 30);
  assert.equal(cap, BASE_CAP);
  assert.ok(gap >= MARK_CLEARANCE, 'and needs no help to clear');
});

test('a goal in the bar’s left half never needs the cap to grow', () => {
  for (const [goal, tol] of [[30, 90], [60, 120], [10, 200]] as const) {
    const { cap } = clearance(325, goal, tol);
    assert.equal(cap, BASE_CAP, `goal ${goal} / tolerance ${tol}`);
  }
});

test('the clearance holds across every bar width the card can be given', () => {
  for (const width of [180, 220, 260, 300, 325, 360, 420]) {
    const { gap } = clearance(width, 100, 0);
    // At the narrowest widths the quarter-of-the-bar ceiling binds before the
    // clearance is fully open — the marks still separate, they just sit closer.
    const floor = width >= 220 ? MARK_CLEARANCE : MARK_HALF + ESSENTIALS_HALF;
    assert.ok(gap >= floor - 0.01, `track ${width}: marks ${gap.toFixed(1)} apart`);
  }
});

test('the marks never actually overlap, however narrow the bar gets', () => {
  for (let width = 120; width <= 420; width += 4) {
    const { gap } = clearance(width, 100, 0);
    assert.ok(
      gap >= MARK_HALF + ESSENTIALS_HALF - 0.01,
      `track ${width}: marks ${gap.toFixed(1)} apart, which overlaps`
    );
  }
});

test('an unmeasurable track asks for nothing', () => {
  assert.equal(essentialsCapWidth(0, BASE_CAP, 1, GAP), BASE_CAP);
});

test('the cap never shrinks below the width the bar’s own height asks for', () => {
  for (const share of [0.5, 0.7, 0.9, 1]) {
    for (const width of [150, 325]) {
      assert.ok(essentialsCapWidth(width, BASE_CAP, share, GAP) >= BASE_CAP);
    }
  }
});

/* ── The marker line ──────────────────────────────────────── */

function layout(trackWidth: number, goalMinutes: number, toleranceSpan: number) {
  return gaugeMarkerLayout({
    trackWidth,
    baseCapWidth: BASE_CAP,
    goalMinutes,
    toleranceSpan,
    gap: GAP,
  });
}

test('the goal mark stands ON its tick — that is the whole job of a mark', () => {
  // The everyday case: a goal well down its span, with room on both sides.
  const l = layout(325, 90, 30);
  assert.ok(Math.abs(l.goalAnchor - l.goalPx) < 0.01, 'the mark drifted off its tick');
});

test('the mark only ever leaves its tick to stay on the card', () => {
  // A goal at the very start of a huge tolerance would otherwise be drawn
  // half off the left edge.
  const l = layout(325, 1, 300);
  assert.ok(l.goalAnchor >= MARK_HALF, 'the mark is clipped by the card');
  assert.ok(l.goalAnchor > l.goalPx, 'and it moved right to avoid that');
});

test('GOAL flips to the left of its mark rather than colliding with the cap', () => {
  const tight = layout(325, 120, 0);
  assert.equal(tight.goalLabelFlipped, true);
  const roomy = layout(325, 60, 60);
  assert.equal(roomy.goalLabelFlipped, false);
});

test('the tolerance reading clears the GOAL caption on both sides', () => {
  // The everyday plan. GOAL cannot stay on the right here — the reading needs
  // that room — so it moves, and both still print.
  const l = layout(325, 90, 30);
  assert.equal(l.showTolerance, true);
  assert.equal(l.goalLabelFlipped, true);
  const goalCaptionRight = l.goalLabelFlipped
    ? l.goalAnchor - GOAL_LABEL_OFFSET
    : l.goalAnchor + GOAL_LABEL_OFFSET + GOAL_LABEL_W;
  assert.ok(l.toleranceAnchor - TOL_LABEL_HALF >= goalCaptionRight, 'the two captions run together');
  assert.ok(
    l.toleranceAnchor + TOL_LABEL_HALF <= l.essentialsAnchor - ESSENTIALS_HALF,
    'the reading runs into the essentials mark',
  );
});

test('GOAL keeps the right side whenever the right side is actually free', () => {
  // A goal early in a long day: nothing is competing for the room after it.
  const l = layout(325, 40, 120);
  assert.equal(l.goalLabelFlipped, false);
  assert.equal(l.showTolerance, true);
  assert.ok(l.toleranceAnchor - TOL_LABEL_HALF >= l.goalAnchor + GOAL_LABEL_OFFSET + GOAL_LABEL_W);
});

test('the caption stays put when there is no room on the left to move into', () => {
  const l = layout(325, 2, 300);
  assert.equal(l.goalLabelFlipped, false, 'it would have been drawn off the card');
});

test('a tolerance with nowhere to print its reading drops the reading, not the zone', () => {
  // Five minutes on a two-hour goal: the segment is still drawn, and its own
  // length is the reading. A crushed "+5m" would say less.
  const l = layout(325, 120, 5);
  assert.equal(l.showTolerance, false);
  assert.ok(l.flexWidth - l.goalPx > 0, 'but the zone itself is still there');
});

test('no tolerance at all means no reading to place', () => {
  assert.equal(layout(325, 90, 0).showTolerance, false);
});

test('a reading is only ever dropped for want of room, never for want of a pixel', () => {
  // Every plan a person would plausibly set, on the card's own bar width. A
  // tolerance zone with real room around it must print its reading — the
  // failure this guards against was a margin a third of a pixel too generous,
  // which silently dropped "+30m" from an entirely ordinary day.
  const roomy: [number, number][] = [
    [90, 30], [120, 30], [60, 30], [120, 60], [45, 15], [30, 30], [60, 15],
  ];
  for (const [goal, tol] of roomy) {
    const l = layout(325, goal, tol);
    assert.equal(l.showTolerance, true, `goal ${goal} / +${tol} lost its reading`);
  }
});

test('and a reading IS dropped once its zone is genuinely too narrow to hold it', () => {
  // Three hours with half an hour after it: the tolerance is a seventh of the
  // day, so its zone is narrower than the words naming it. This is the line
  // the rule is meant to draw, and it is worth pinning down — the previous
  // test would be satisfied by simply never dropping anything.
  const l = layout(325, 180, 30);
  assert.equal(l.showTolerance, false);
  // What decides it is not the zone's own width but the SLOT — the run of line
  // left between the goal mark and the essentials mark, which is where a
  // reading would actually have to be printed.
  const slot = (l.essentialsAnchor - ESSENTIALS_HALF) - (l.goalAnchor + MARK_HALF);
  const needed = TOL_LABEL_HALF * 2 + LABEL_AIR * 2;
  assert.ok(slot < needed, `the slot is ${slot.toFixed(1)} against ${needed} needed`);
});

test('the two marks clear each other on every shape of day', () => {
  const plans: [number, number][] = [
    [90, 0], [120, 0], [30, 0], [120, 5], [90, 30], [60, 60], [15, 200], [240, 15],
  ];
  for (const width of [220, 260, 325, 400]) {
    for (const [goal, tol] of plans) {
      const l = layout(width, goal, tol);
      const clear = l.essentialsAnchor - l.goalAnchor;
      assert.ok(
        clear >= MARK_HALF + ESSENTIALS_HALF - 0.01,
        `track ${width}, goal ${goal}/+${tol}: marks ${clear.toFixed(1)} apart`,
      );
    }
  }
});

test('nothing is placed off the end of the track', () => {
  for (const [goal, tol] of [[90, 0], [90, 30], [1, 300], [300, 1]] as const) {
    const l = layout(325, goal, tol);
    assert.ok(l.goalAnchor <= 325 && l.goalAnchor >= 0);
    assert.ok(l.essentialsAnchor <= 325 && l.essentialsAnchor >= 0);
    if (l.showTolerance) {
      assert.ok(l.toleranceAnchor + TOL_LABEL_HALF <= 325, 'the tolerance reading runs off the card');
    }
  }
});

test('a track that has not been measured yet places nothing anywhere silly', () => {
  const l = layout(0, 90, 30);
  assert.equal(l.flexWidth, 0);
  assert.equal(l.goalPx, 0);
  assert.ok(Number.isFinite(l.goalAnchor));
  assert.ok(Number.isFinite(l.toleranceAnchor));
});
