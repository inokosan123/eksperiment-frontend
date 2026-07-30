/**
 * The week strip's run logic — which days are fused into one golden band.
 *
 * The Medal Streak card's strip used to be seven separate marks, so a streak
 * of five looked like five unrelated coins. The monthly calendar this card
 * opens has fused its run into a band since its redesign; this brings the
 * same grammar down onto the card, where the streak is actually claimed.
 *
 * Two rules carry it, both taken verbatim from the calendar:
 *
 *   · the merciful streak survives a rest day, so the band must too — a
 *     stretch of rest with a kept day on BOTH sides becomes a BRIDGE, drawn
 *     in a paler tone under the resting ring;
 *   · the streak is alive, so when yesterday belongs to the run a soft tail
 *     reaches into today's ring rather than stopping short of it.
 *
 * Pure and side-effect free, because the interesting part is the reasoning
 * about mercy and not the drawing.
 */

export type MedalStreakStatus = 'kept' | 'broken' | 'rest' | 'today';

export type MedalStreakWeekCell = {
  key: string;
  letter: string;
  status: MedalStreakStatus;
};

export type MedalStreakWeekRun = MedalStreakWeekCell & {
  /** A rest day the run is carried across. */
  bridge: boolean;
  linkLeft: boolean;
  linkRight: boolean;
  /** The half-segment is the paler bridge tone rather than full gold. */
  softLeft: boolean;
  softRight: boolean;
};

export function fuseMedalStreakWeek(week: MedalStreakWeekCell[]): MedalStreakWeekRun[] {
  const run: MedalStreakWeekRun[] = week.map(cell => ({
    ...cell,
    bridge: false,
    linkLeft: false,
    linkRight: false,
    softLeft: false,
    softRight: false,
  }));

  // A rest day between two kept days is bridged, however many rest days lie
  // between them.
  for (let index = 0; index < run.length; index++) {
    if (run[index].status !== 'rest') continue;
    let previous = index - 1;
    while (previous >= 0 && run[previous].status === 'rest') previous--;
    let next = index + 1;
    while (next < run.length && run[next].status === 'rest') next++;
    if (run[previous]?.status === 'kept' && run[next]?.status === 'kept') {
      run[index].bridge = true;
    }
  }

  const inRun = (entry?: MedalStreakWeekRun) => !!entry && (entry.status === 'kept' || entry.bridge);

  for (let index = 0; index < run.length; index++) {
    if (!inRun(run[index])) continue;
    run[index].linkLeft = inRun(run[index - 1]);
    run[index].linkRight = inRun(run[index + 1]);
  }

  // A seam is soft when either side of it is a bridge rather than a day the
  // medal was actually won.
  for (let index = 0; index < run.length; index++) {
    if (run[index].linkLeft) {
      run[index].softLeft = run[index].bridge || run[index - 1]?.bridge === true;
    }
    if (run[index].linkRight) {
      run[index].softRight = run[index].bridge || run[index + 1]?.bridge === true;
    }
  }

  // Today is not won yet, so it never carries full gold — but if yesterday is
  // part of the run, the band reaches into its ring as a soft tail. A day
  // already lost is not 'today' here, and the run correctly stops before it.
  const todayIndex = run.findIndex(entry => entry.status === 'today');
  if (todayIndex > 0 && inRun(run[todayIndex - 1])) {
    run[todayIndex].linkLeft = true;
    run[todayIndex].softLeft = true;
    run[todayIndex - 1].linkRight = true;
    run[todayIndex - 1].softRight = true;
  }

  return run;
}
