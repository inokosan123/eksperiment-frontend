/**
 * The day gauge's marker line — where the four things above the bar go.
 *
 * Four things share that line: the goal medallion, the word GOAL, the
 * tolerance reading, and the essentials mark. Only two of them MEAN a
 * position — the medallion stands on the goal tick, the essentials mark stands
 * on the cap — so those are placed first and never moved for a caption's sake.
 * The captions arbitrate around them, and the one with the least to say gives
 * way first.
 *
 * Kept pure and away from the drawing, because the interesting part is the
 * arbitration and it is worth being able to prove.
 */

export const MARK_HALF = 11;          // the goal medallion plus its air
export const GOAL_LABEL_OFFSET = 13;  // the caption's near edge, from the mark's centre
export const GOAL_LABEL_W = 31;
export const TOL_LABEL_HALF = 15;
export const ESSENTIALS_HALF = 9;
/**
 * The air a caption keeps around itself. Nine, not eleven: at eleven the
 * everyday plan — a goal four fifths of the way down its span, with half an
 * hour of tolerance after it — came out a third of a pixel short of room and
 * silently dropped its reading. A caption should be dropped because there is
 * genuinely nowhere to put it, never because the margin it was asked to keep
 * was a shade more generous than the bar could afford.
 */
export const LABEL_AIR = 9;
/**
 * Centre-to-centre, goal mark ↔ essentials mark: the medallion's half plus the
 * no-entry mark's half, plus enough air that they read as two marks rather
 * than as one damaged one.
 */
export const MARK_CLEARANCE = 27;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/**
 * How wide the essentials cap has to be for its mark to clear the goal's.
 *
 * THE EDGE CASE. The cap is a fixed stub at the end of the bar, and the goal
 * tick lands wherever the goal's share of the planned day puts it. When the
 * tolerance span is zero — or so small it rounds to nothing — the goal owns
 * the whole flexible span, its tick lands hard against the cap, and the two
 * marks sit on top of each other.
 *
 * The cap grows instead. It is the one segment on this bar that is NOT a
 * measured length: "after the limit, only essentials" has no duration, so its
 * width is a presentation decision rather than a fact, and widening it costs
 * the reading nothing. A day with no tolerance genuinely IS a day that ends in
 * essentials the moment the limit is met — and a bar that says so with a broad
 * closing band reads better, and more truthfully, than one that says it with a
 * stub the goal mark is standing on.
 *
 * Growing the cap by a pixel moves the essentials mark left by half of it and
 * the goal tick left by the goal's own share of the span, so the clearance
 * opens by (share − ½) per pixel — hence the division. At or below a half
 * share the goal sits in the bar's left half and there is nothing to solve.
 * Held to a quarter of the track, because past that the closing band stops
 * being a cap and starts being the bar.
 */
export function essentialsCapWidth(
  trackWidth: number,
  baseWidth: number,
  goalShare: number,
  gapTotal: number
): number {
  if (trackWidth <= 0 || goalShare <= 0.5) return baseWidth;
  const widthFor = (clearance: number) => {
    const shortfall = clearance - trackWidth * (1 - goalShare) - goalShare * gapTotal;
    return shortfall <= 0 ? 0 : shortfall / (goalShare - 0.5);
  };
  // Two clearances, and they are not the same kind of thing. MARK_CLEARANCE is
  // how far apart the marks should be; MARK_HALF + ESSENTIALS_HALF is how far
  // apart they MUST be for their ink not to overlap. A quarter of the track is
  // as much as the closing band may take for the sake of the first — but the
  // second is not a matter of taste, so on a bar too narrow to afford both, the
  // ceiling gives way rather than the marks.
  const ceiling = Math.min(
    trackWidth * 0.42,
    Math.max(trackWidth * 0.25, widthFor(MARK_HALF + ESSENTIALS_HALF)),
  );
  return clamp(Math.max(baseWidth, widthFor(MARK_CLEARANCE)), baseWidth, Math.max(baseWidth, ceiling));
}

export type GaugeMarkerLayout = {
  capWidth: number;
  flexWidth: number;
  /** The goal tick's true position — what the mark is marking. */
  goalPx: number;
  /** The medallion's centre: the tick, held only by the card's own edges. */
  goalAnchor: number;
  essentialsAnchor: number;
  /** The GOAL caption reads to the LEFT of its mark when the right is taken. */
  goalLabelFlipped: boolean;
  toleranceAnchor: number;
  showTolerance: boolean;
};

/**
 * Places everything on the marker line.
 *
 * `goalAnchor` used to be clamped away from the card's right margin to leave
 * the captions room, which meant that on any plan whose goal sits well down
 * its span — the common case — the medallion stood visibly off the tick it was
 * supposed to be marking. A mark that is not on its mark is worse than a
 * caption that has to move, so the medallion is held only by the card's own
 * edges and the words arbitrate around it.
 */
export function gaugeMarkerLayout({
  trackWidth,
  baseCapWidth,
  goalMinutes,
  toleranceSpan,
  gap,
}: {
  trackWidth: number;
  baseCapWidth: number;
  goalMinutes: number;
  toleranceSpan: number;
  gap: number;
}): GaugeMarkerLayout {
  const plannedTotal = Math.max(goalMinutes + toleranceSpan, 1);
  const goalShare = Math.min(1, goalMinutes / plannedTotal);
  const gapTotal = gap * (toleranceSpan > 0 ? 2 : 1);
  const capWidth = essentialsCapWidth(trackWidth, baseCapWidth, goalShare, gapTotal);
  const flexWidth = Math.max(0, trackWidth - capWidth - gapTotal);
  const goalPx = goalShare * flexWidth;

  const goalAnchor = clamp(
    goalPx,
    MARK_HALF + 2,
    Math.max(MARK_HALF + 2, trackWidth - MARK_HALF - 2),
  );
  const essentialsAnchor = trackWidth - capWidth / 2;

  /* WHICH SIDE THE WORD GOES ON.

     Everything to the right of the goal mark is contested: the GOAL caption
     wants it, the tolerance reading wants it, and the essentials mark already
     owns the end of it. The caption is the one that can move — it names a mark
     that is right there beside it and reads the same from either side — so it
     goes left whenever the right is spoken for, either by the cap or by the
     tolerance reading it would otherwise squeeze out. It only stays put when
     there is genuinely no room on the left, which happens on a goal set near
     the very start of a long day. */
  const essentialsLeft = essentialsAnchor - ESSENTIALS_HALF;
  const toleranceCeiling = essentialsLeft - LABEL_AIR - TOL_LABEL_HALF;
  const toleranceFloorFor = (flipped: boolean) =>
    (flipped ? goalAnchor + MARK_HALF : goalAnchor + GOAL_LABEL_OFFSET + GOAL_LABEL_W)
      + LABEL_AIR + TOL_LABEL_HALF;

  const canFlip = goalAnchor - GOAL_LABEL_OFFSET - GOAL_LABEL_W >= 0;
  const crowdedByCap =
    goalAnchor + GOAL_LABEL_OFFSET + GOAL_LABEL_W + LABEL_AIR > essentialsLeft;
  const crowdedByTolerance = toleranceSpan > 0 && toleranceFloorFor(false) > toleranceCeiling;
  const goalLabelFlipped = canFlip && (crowdedByCap || crowdedByTolerance);

  /* The tolerance reading is centred on the zone it names, pushed clear of the
     GOAL caption, and held off the essentials mark. If the room left between
     those two is narrower than the label itself — even with the caption moved
     out of its way — it is dropped: the zone is still there to be seen, and
     its LENGTH is the reading. A "+5m" crushed against a no-entry sign tells
     you less than the clean segment does. */
  const toleranceZoneWidth = Math.max(0, flexWidth - goalPx);
  const toleranceCentre = goalPx + gap + toleranceZoneWidth / 2;
  const toleranceFloor = toleranceFloorFor(goalLabelFlipped);
  const showTolerance = toleranceSpan > 0 && toleranceCeiling >= toleranceFloor;

  return {
    capWidth,
    flexWidth,
    goalPx,
    goalAnchor,
    essentialsAnchor,
    goalLabelFlipped,
    toleranceAnchor: clamp(
      Math.max(toleranceCentre, toleranceFloor),
      toleranceFloor,
      Math.max(toleranceFloor, toleranceCeiling),
    ),
    showTolerance,
  };
}
