import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTallyRuns, tallyUnit, type DayOutcome } from '../components/home/day-tally-layout';

const W = 112;
const build = (outcomes: DayOutcome[]) => buildTallyRuns(outcomes, W);

const day = (spec: [DayOutcome, number][]): DayOutcome[] =>
  spec.flatMap(([outcome, n]) => Array.from({ length: n }, () => outcome));

const alternating = (n: number): DayOutcome[] =>
  Array.from({ length: n }, (_, i) => (i % 2 ? 'pending' : 'done'));

test('a day with no tasks draws nothing', () => {
  assert.deepEqual(build([]), []);
});

test('consecutive tasks of one outcome fuse into a single band', () => {
  const runs = build(day([['done', 3], ['pending', 3]]));
  assert.deepEqual(runs.map(r => [r.outcome, r.count]), [['done', 3], ['pending', 3]]);
});

test('a band knows which task seat it starts on', () => {
  const runs = build(day([['done', 2], ['skipped', 1], ['pending', 3]]));
  assert.deepEqual(runs.map(r => r.start), [0, 2, 3]);
});

test('a band is as wide as the seats it covers', () => {
  const runs = build(day([['done', 3], ['pending', 3]]));
  assert.ok(Math.abs(runs[0].w - runs[1].w) < 1e-9, 'equal seat counts must measure equal');
  assert.ok(Math.abs(runs[0].w - W / 2) < 1e-9);
});

test('an unbroken day is one band spanning the whole rail', () => {
  for (const outcome of ['done', 'skipped', 'pending'] as DayOutcome[]) {
    const runs = build(day([[outcome, 5]]));
    assert.equal(runs.length, 1);
    assert.equal(runs[0].x, 0);
    assert.ok(Math.abs(runs[0].w - W) < 1e-9, `${outcome} should fill the rail`);
  }
});

// The tiling is the whole contract: any seam between two bands would show a
// thread of empty well through a band that is meant to read as one object.
test('bands tile the rail with no seam and no overlap', () => {
  const shapes: DayOutcome[][] = [
    day([['pending', 1]]),
    day([['done', 3], ['pending', 3]]),
    day([['done', 1], ['skipped', 1], ['done', 1], ['pending', 2]]),
    day([['done', 8], ['pending', 12]]),
    day([['skipped', 7]]),
    ...[2, 3, 5, 7, 10, 13, 16, 20, 24, 30, 40, 60].map(alternating),
  ];

  for (const shape of shapes) {
    const runs = build(shape);
    assert.equal(runs[0].x, 0, `a day of ${shape.length} did not start at the edge`);
    for (let i = 1; i < runs.length; i += 1) {
      assert.ok(
        Math.abs(runs[i].x - (runs[i - 1].x + runs[i - 1].w)) < 1e-9,
        `a day of ${shape.length} left a seam at band ${i}`,
      );
    }
    const last = runs[runs.length - 1];
    assert.ok(
      Math.abs(last.x + last.w - W) < 1e-9,
      `a day of ${shape.length} did not reach the far edge`,
    );
  }
});

test('no band is ever zero or negative, however broken the day', () => {
  for (let n = 1; n <= 60; n += 1) {
    for (const run of build(alternating(n))) {
      assert.ok(run.w > 0, `a band collapsed at ${n} tasks (w=${run.w})`);
    }
  }
});

// The seat is what the view creases on, and what it measures against
// MIN_CREASE_SEAT to decide whether creasing would crowd the rail at all.
test('a seat is the rail divided by the tasks in it', () => {
  assert.ok(Math.abs(tallyUnit(7, W) - W / 7) < 1e-9);
  assert.equal(tallyUnit(0, W), 0, 'an empty day has no seat to measure');
});

test('a rail with no width is refused rather than drawn negative', () => {
  assert.deepEqual(buildTallyRuns(day([['done', 2]]), 0), []);
});
