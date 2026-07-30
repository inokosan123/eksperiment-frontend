import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fuseMedalStreakWeek,
  type MedalStreakStatus,
  type MedalStreakWeekCell,
} from '../components/focus-watch/medalStreakWeek';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function week(...statuses: MedalStreakStatus[]): MedalStreakWeekCell[] {
  assert.equal(statuses.length, 7, 'a week is seven days');
  return statuses.map((status, index) => ({
    key: `d${index}`,
    letter: LETTERS[index],
    status,
  }));
}

// A compact picture of what the strip draws: '=' a full-gold seam, '-' the
// paler bridge tone, '·' no seam at all. Read between the cells.
function seams(cells: MedalStreakWeekCell[]) {
  const run = fuseMedalStreakWeek(cells);
  return run.slice(0, 6).map((cell, index) => {
    const right = cell.linkRight;
    const left = run[index + 1].linkLeft;
    assert.equal(right, left, `seam ${index} must agree from both sides`);
    if (!right) return '·';
    return cell.softRight || run[index + 1].softLeft ? '-' : '=';
  }).join('');
}

test('a run of won days fuses into one chain', () => {
  assert.equal(
    seams(week('kept', 'kept', 'kept', 'broken', 'rest', 'rest', 'rest')),
    '==····',
  );
});

test('a lone won day links to nothing', () => {
  assert.equal(
    seams(week('rest', 'kept', 'broken', 'rest', 'broken', 'rest', 'broken')),
    '······',
  );
});

test('mercy carries the chain across a rest day, in the paler tone', () => {
  // Kept, rest, kept: the streak survived, so the chain must cross it.
  assert.equal(
    seams(week('kept', 'rest', 'kept', 'broken', 'rest', 'broken', 'broken')),
    '--····',
  );
});

test('mercy carries the chain across several rest days at once', () => {
  assert.equal(
    seams(week('kept', 'rest', 'rest', 'kept', 'broken', 'broken', 'broken')),
    '---···',
  );
});

test('a broken day is never bridged — that is where the streak actually ends', () => {
  assert.equal(
    seams(week('kept', 'broken', 'kept', 'broken', 'kept', 'broken', 'kept')),
    '······',
  );
});

test('rest days with no won day on one side are not bridged', () => {
  const run = fuseMedalStreakWeek(week('rest', 'rest', 'kept', 'kept', 'rest', 'rest', 'rest'));
  assert.deepEqual(run.map(cell => cell.bridge), [false, false, false, false, false, false, false]);
  assert.equal(seams(week('rest', 'rest', 'kept', 'kept', 'rest', 'rest', 'rest')), '··=···');
});

test('a live streak reaches into today as a soft tail', () => {
  // Yesterday is part of the run, so the chain enters today's ring — but
  // softly, because today is not won yet.
  assert.equal(
    seams(week('rest', 'rest', 'kept', 'kept', 'kept', 'kept', 'today')),
    '··===-',
  );
});

test('today takes the tail across a bridged rest day too', () => {
  assert.equal(
    seams(week('rest', 'rest', 'kept', 'rest', 'kept', 'kept', 'today')),
    '··--=-',
  );
});

test('today is left alone when yesterday broke the run', () => {
  assert.equal(
    seams(week('kept', 'kept', 'kept', 'kept', 'kept', 'broken', 'today')),
    '====··',
  );
});

test('today is left alone when yesterday was an unbridged rest day', () => {
  // Yesterday rests and nothing follows it but today, which is not won — so
  // there is no run to carry and no tail to draw.
  assert.equal(
    seams(week('kept', 'kept', 'kept', 'kept', 'rest', 'rest', 'today')),
    '===···',
  );
});

test('a lost today ends the chain before it rather than reaching into it', () => {
  // buildWeek marks a day already lost as 'broken', not 'today'.
  const run = fuseMedalStreakWeek(week('kept', 'kept', 'kept', 'kept', 'kept', 'kept', 'broken'));
  assert.equal(run[6].linkLeft, false);
  assert.equal(run[5].linkRight, false);
  assert.equal(seams(week('kept', 'kept', 'kept', 'kept', 'kept', 'kept', 'broken')), '=====·');
});

test('the run never wraps past the ends of the strip', () => {
  const run = fuseMedalStreakWeek(week('kept', 'kept', 'kept', 'kept', 'kept', 'kept', 'kept'));
  assert.equal(run[0].linkLeft, false);
  assert.equal(run[6].linkRight, false);
});

test('fusing leaves the week it was handed untouched', () => {
  const input = week('kept', 'rest', 'kept', 'today', 'rest', 'rest', 'rest');
  const snapshot = JSON.stringify(input);
  fuseMedalStreakWeek(input);
  assert.equal(JSON.stringify(input), snapshot);
});
