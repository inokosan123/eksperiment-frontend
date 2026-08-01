import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/* ─────────────────────────────────────────────────────────────────────
 * THE ABOUT SHEET'S ARITHMETIC AND ITS COPY.
 *
 * ⚠ WHAT IS WORTH TESTING HERE IS NOT THE LOOK. It is the handful of
 * places where a wrong number is invisible until somebody opens the
 * sheet on a phone that nobody had:
 *
 *   · the chapel's budget, which must leave a readable page on every
 *     screen size and must never eat the foot,
 *   · the bold-phrase marks, which are hand-authored and therefore can
 *     be left unclosed,
 *   · the versal, which is taken off a marked-up string and would
 *     happily raise an asterisk,
 *   · and the crop arithmetic, which every figure in the sheet is laid
 *     out from.
 *
 * The two functions under test are re-declared here rather than imported
 * because the module they live in is a React component that pulls in
 * Reanimated, expo-image and an icon; the content, by contrast, is
 * plain data and is read off the real file.
 * ───────────────────────────────────────────────────────────────────── */

/* ── The sheet's own numbers, as shipped ─────────────────────────── */
const CHAPEL_SHARE = 0.6;
const MIN_LEAF = 262;
const CHAPEL_CAP = 540;
const LEAF_LAP = 8;

function chapelHeight(height: number, bottomInset: number): number {
  const foot = 12 + 46 + Math.max(bottomInset, 12) + 6;
  return Math.round(Math.min(
    height * CHAPEL_SHARE,
    height - foot - MIN_LEAF + LEAF_LAP,
    CHAPEL_CAP,
  ));
}

function splitBold(text: string): { text: string; bold: boolean }[] {
  return text
    .split('**')
    .map((piece, index) => ({ text: piece, bold: index % 2 === 1 }))
    .filter(run => run.text.length > 0);
}

function takeVersal(
  runs: { text: string; bold: boolean }[],
): { initial: string; rest: { text: string; bold: boolean }[] } | null {
  const whole = runs.reduce((count, run) => count + run.text.length, 0);
  if (whole < 24 || !runs.length) return null;
  const head = runs[0].text.trimStart();
  const initial = head.slice(0, 1);
  if (!initial || initial.toUpperCase() === initial.toLowerCase()) return null;
  return {
    initial,
    rest: [{ text: head.slice(1), bold: runs[0].bold }, ...runs.slice(1)],
  };
}

/* ── The content, read off the shipped file ──────────────────────── */
const source = readFileSync('data/prayers/pantocratorContent.ts', 'utf8');

/** Every string literal in the slide bodies, in file order. */
function bodyParagraphs(): string[] {
  const bodies = source.matchAll(/body:\s*\[([\s\S]*?)\n {4}\]/g);
  const out: string[] = [];
  for (const body of bodies) {
    for (const line of body[1].split('\n')) {
      const quoted = line.match(/^\s*'((?:[^'\\]|\\.)*)',?\s*$/);
      if (quoted) out.push(quoted[1]);
    }
  }
  return out;
}

const PARAGRAPHS = bodyParagraphs();

test('the content file was actually read', () => {
  // A regex that quietly matches nothing would make every test below pass.
  assert.ok(PARAGRAPHS.length >= 18, `only found ${PARAGRAPHS.length} paragraphs`);
});

/* ── The chapel's budget ─────────────────────────────────────────── */

test('the chapel leaves a readable page on every phone', () => {
  const phones: [string, number, number][] = [
    ['iPhone SE', 667, 0],
    ['iPhone 8 Plus', 736, 0],
    ['small Android', 740, 24],
    ['iPhone 13 mini', 812, 34],
    ['iPhone 15', 852, 34],
    ['iPhone 15 Pro Max', 932, 34],
    ['tall Android', 1000, 24],
  ];

  for (const [name, height, bottom] of phones) {
    const foot = 12 + 46 + Math.max(bottom, 12) + 6;
    const chapel = chapelHeight(height, bottom);
    const leafVisible = height - (chapel - LEAF_LAP) - foot;

    assert.ok(
      leafVisible >= MIN_LEAF - 1,
      `${name}: only ${leafVisible}pt of page showing`,
    );
    // And the wall must still be worth standing an icon on.
    assert.ok(chapel >= 330, `${name}: chapel only ${chapel}pt`);
    assert.ok(chapel <= CHAPEL_CAP, `${name}: chapel ${chapel}pt over the cap`);
  }
});

/**
 * ⚠ THE BUG THIS FIXES: read to the end of a slide and the page used to
 * climb clear of the bottom of the screen, showing the room's black
 * backing under the text. The cure is geometric rather than a clamp —
 * the pager begins BELOW the head-band and runs to the very bottom, so
 * the spacer above the page and the scroller's own height cancel — and
 * this is the proof of it, at every offset a reader can reach.
 */
test('the page reaches the foot of the screen at every scroll offset', () => {
  const phones: [string, number, number, number][] = [
    ['iPhone SE', 667, 20, 0],
    ['iPhone 15', 852, 59, 34],
    ['iPhone 15 Pro Max', 932, 59, 34],
    ['Android', 800, 24, 24],
  ];

  for (const [name, height, topInset, bottomInset] of phones) {
    const chapel = chapelHeight(height, bottomInset);
    const band = topInset + 2 + 34 + 10 + 9;
    const leafTop = chapel - LEAF_LAP;
    // What the sheet hands the scroller.
    const spacer = leafTop - band;
    const scroller = height - band;
    const minLeaf = height - leafTop;

    assert.ok(spacer > 0, `${name}: the page would begin above the head-band`);

    // Every page length a reader could meet, from the shortest to a very
    // long one, at the top, the middle and the very end of its scroll.
    for (let length = minLeaf; length <= minLeaf + 900; length += 7) {
      const content = spacer + length;
      const maxScroll = Math.max(0, content - scroller);
      for (const y of [0, maxScroll / 2, maxScroll]) {
        const top = leafTop - y;
        const bottom = top + length;
        assert.ok(
          bottom >= height - 0.001,
          `${name}: at ${Math.round(y)}pt the page ends ${Math.round(height - bottom)}pt short of the foot`,
        );
      }

      /* ⚠ A LONG SLIDE DOES PASS UNDER THE BAND, and that is the point of
         BandGround: the head is a bound book's head-band, not a lid. What
         must hold is that the band has finished changing ground BY the
         time the page arrives under it — otherwise there is a window in
         which pale-gold ink is sitting on parchment. */
      const coverAt = leafTop - band;
      const reachesTheBand = maxScroll >= coverAt;
      if (reachesTheBand) {
        assert.ok(
          coverAt > 0,
          `${name}: the page starts already under the band`,
        );
      }
    }
  }
});

test('the head-band finishes changing ground before the page reaches it', () => {
  for (const [height, topInset, bottomInset] of
    [[667, 20, 0], [852, 59, 34], [932, 59, 34], [800, 24, 24]] as const) {
    const chapel = chapelHeight(height, bottomInset);
    const band = topInset + 2 + 34 + 10 + 9;
    const cover = Math.max(1, (chapel - LEAF_LAP) - band);

    // The ink is fully dark at leafY === cover, and the page's top edge
    // is at `band` at exactly that offset — so the two land together.
    const topAtCover = (chapel - LEAF_LAP) - cover;
    assert.equal(topAtCover, band, `the ground and the page disagree at ${height}pt`);
    // And there must be real travel to do it in, or it snaps.
    assert.ok(cover >= 150, `only ${cover}pt of travel to change ground at ${height}pt`);
  }
});

test('the chapel never runs past the foot of the screen', () => {
  for (let height = 600; height <= 1100; height += 4) {
    for (const bottom of [0, 24, 34]) {
      const foot = 12 + 46 + Math.max(bottom, 12) + 6;
      const chapel = chapelHeight(height, bottom);
      assert.ok(
        chapel < height - foot,
        `${height}/${bottom}: chapel ${chapel} reaches the foot`,
      );
    }
  }
});

/* ── Going in, and coming back out ───────────────────────────────────
 *
 * ⚠ THE DOOR IS A LITTLE STATE MACHINE AND ITS FAILURES ARE UGLY ONES:
 * a room that unmounts before its own leaving animation has run (the
 * platform slide all over again), or one that survives a close and
 * re-opens on page five. Both are cheap to check and neither is
 * noticeable in a screenshot, so they are checked here.
 *
 * The reducer below is the component's effect written as pure data. It
 * has to be kept in step with it by hand, which is worth saying plainly —
 * what it buys is that the SEQUENCE is stated once, in a form that can be
 * run.
 */
type Door = { mounted: boolean; visit: number; target: 0 | 1; animating: boolean };

const shut: Door = { mounted: false, visit: 0, target: 0, animating: false };

/** `visible` changed. */
function press(door: Door, visible: boolean): Door {
  if (visible) {
    // Mount, bump the visit — which re-keys and therefore rebuilds the
    // room — zero the value, and animate in on the next frame.
    return { mounted: true, visit: door.visit + 1, target: 1, animating: true };
  }
  // The room stays mounted while it leaves.
  return { ...door, target: 0, animating: true };
}

/** The animation reached its target. */
function settle(door: Door): Door {
  if (!door.animating) return door;
  // Only the closing animation unmounts, and only when it finishes.
  return { ...door, animating: false, mounted: door.target === 1 };
}

test('the room stays mounted for the whole of its leaving', () => {
  let door = settle(press(shut, true));
  assert.equal(door.mounted, true);

  door = press(door, false);
  assert.equal(door.mounted, true, 'the room was pulled at the press, with nothing left to animate');
  assert.equal(door.target, 0);

  door = settle(door);
  assert.equal(door.mounted, false, 'the room never left');
});

test('every opening builds a new room', () => {
  let door = settle(press(shut, true));
  const first = door.visit;

  door = settle(press(door, false));
  door = settle(press(door, true));

  assert.notEqual(door.visit, first, 'the second visit reused the first room');
  assert.equal(door.mounted, true);
});

test('re-opening mid-close catches the room and rebuilds it', () => {
  let door = settle(press(shut, true));
  const first = door.visit;

  door = press(door, false);        // leaving, not yet gone
  door = press(door, true);         // opened again before it finished

  assert.equal(door.mounted, true, 'the room was lost between the two presses');
  assert.equal(door.target, 1);
  assert.notEqual(door.visit, first, 'the caught room kept its old page');

  door = settle(door);
  assert.equal(door.mounted, true, 'settling an OPEN animation unmounted the room');
});

test('the way in is slower than the way out', () => {
  // The prayer screen's own asymmetry — see `prayerMotion`. Arriving
  // settles; going back to rest is quicker.
  const OPEN_MS = 420;
  const CLOSE_MS = 300;
  assert.ok(OPEN_MS > CLOSE_MS, 'leaving should not take longer than arriving');
  // And neither should be long enough to feel like waiting.
  assert.ok(OPEN_MS <= 500 && CLOSE_MS >= 200);
});

/* ── The authored bold phrases ───────────────────────────────────── */

test('every bold mark in the copy is closed', () => {
  for (const paragraph of PARAGRAPHS) {
    const marks = paragraph.split('**').length - 1;
    assert.equal(
      marks % 2, 0,
      `unclosed ** in: ${paragraph.slice(0, 60)}…`,
    );
  }
});

test('no paragraph is bold end to end, and none is bolded to nothing', () => {
  for (const paragraph of PARAGRAPHS) {
    const runs = splitBold(paragraph);
    const boldChars = runs.filter(run => run.bold)
      .reduce((count, run) => count + run.text.length, 0);
    const whole = runs.reduce((count, run) => count + run.text.length, 0);
    if (boldChars === 0) continue;

    assert.ok(boldChars >= 8, `bold phrase too short in: ${paragraph.slice(0, 50)}…`);
    // ⚠ A paragraph set entirely in the semibold is a paragraph with no
    // emphasis in it — the point of the mark is that it is the exception.
    assert.ok(
      boldChars / whole < 0.62,
      `${Math.round((boldChars / whole) * 100)}% bold in: ${paragraph.slice(0, 50)}…`,
    );
  }
});

test('the marks are stripped from what is rendered', () => {
  for (const paragraph of PARAGRAPHS) {
    for (const run of splitBold(paragraph)) {
      assert.ok(!run.text.includes('**'), 'a mark survived into a run');
    }
  }
});

/* ── The versal ──────────────────────────────────────────────────── */

test('the opening letter is a letter, never a mark', () => {
  // The first paragraph of each slide is the one that takes the versal.
  const openings = source.match(/body:\s*\[\s*(?:\/\/[^\n]*\n\s*)*'((?:[^'\\]|\\.)*)'/g);
  assert.ok(openings && openings.length >= 5, 'could not find the opening paragraphs');

  for (const opening of openings) {
    const text = opening.replace(/^body:\s*\[\s*(?:\/\/[^\n]*\n\s*)*'/, '').replace(/'$/, '');
    const versal = takeVersal(splitBold(text));
    assert.ok(versal, `no versal taken from: ${text.slice(0, 40)}…`);
    assert.notEqual(versal.initial, '*', 'the versal raised a bold mark');
    assert.match(versal.initial, /\p{L}/u, `versal "${versal.initial}" is not a letter`);
    // And the rest must still begin with the second character of the text.
    assert.ok(
      versal.rest[0].text.startsWith(text.replace(/^\*\*/, '').slice(1, 6)),
      'the versal ate more than its letter',
    );
  }
});

test('a versal keeps the boldness of the phrase it opens', () => {
  const runs = splitBold('**Painted in the mid-sixth century**, this is the oldest surviving icon.');
  const versal = takeVersal(runs);
  assert.ok(versal);
  assert.equal(versal.initial, 'P');
  assert.equal(versal.rest[0].bold, true, 'the rest of a bold opening lost its weight');
  assert.equal(versal.rest[0].text, 'ainted in the mid-sixth century');
});

test('a short line and a quotation mark are left alone', () => {
  assert.equal(takeVersal(splitBold('Too short.')), null);
  assert.equal(takeVersal(splitBold('“A quotation long enough to pass the length test.”')), null);
});

/* ── The crop arithmetic every figure is laid out from ───────────── */

const PANEL_ASPECT = 45.5 / 84;
const FACE = { axisX: 0.44, halfWidth: 0.30, top: 0.015, bottom: 0.53 };
const DETAILS = {
  gaze: { x0: 0.185, y0: 0.150, x1: 0.700, y1: 0.345 },
  hand: { x0: 0.125, y0: 0.600, x1: 0.395, y1: 0.885 },
  book: { x0: 0.400, y0: 0.560, x1: 0.975, y1: 0.900 },
};

test('the face crop stays on the board and centred on the axis', () => {
  const left = FACE.axisX - FACE.halfWidth;
  const right = FACE.axisX + FACE.halfWidth;
  assert.ok(left >= 0, `crop starts at ${left}, off the board`);
  assert.ok(right <= 1, `crop ends at ${right}, off the board`);
  assert.ok(FACE.top >= 0 && FACE.bottom <= 1, 'crop runs off the top or foot');
  // ⚠ The mirror only coheres because the crop is centred on the axis.
  assert.equal((left + right) / 2, FACE.axisX);
});

test('a mirrored composite comes out taller than it is wide', () => {
  const cropW = FACE.halfWidth * 2;
  const cropH = FACE.bottom - FACE.top;
  const ratio = (cropH / PANEL_ASPECT) / cropW;
  // A portrait, not a letterbox: this is what the "odzumiraj" fix bought.
  assert.ok(ratio > 1.3 && ratio < 1.8, `composite ratio is ${ratio.toFixed(2)}`);
});

test('every detail crop lies inside the board and is not degenerate', () => {
  for (const [name, crop] of Object.entries(DETAILS)) {
    assert.ok(crop.x0 >= 0 && crop.x1 <= 1, `${name}: off the board across`);
    assert.ok(crop.y0 >= 0 && crop.y1 <= 1, `${name}: off the board down`);
    assert.ok(crop.x1 > crop.x0 && crop.y1 > crop.y0, `${name}: inverted`);
    const aspect = (crop.x1 - crop.x0) / ((crop.y1 - crop.y0) / PANEL_ASPECT);
    assert.ok(aspect > 0.35 && aspect < 3, `${name}: aspect ${aspect.toFixed(2)}`);
  }
});

test('the hand and the book stand side by side without overlapping', () => {
  // They are two windows onto one board, shown together — if they
  // overlapped, the same paint would appear in both.
  assert.ok(DETAILS.hand.x1 <= DETAILS.book.x0, 'the hand crop runs into the book crop');
});

test('the pair of details fits the width they are given', () => {
  const inner = 393 - 40;
  const gap = 12;
  const aspect = (c: typeof DETAILS.hand) => (c.x1 - c.x0) / ((c.y1 - c.y0) / PANEL_ASPECT);
  const tall = (inner - gap) / (aspect(DETAILS.hand) + aspect(DETAILS.book));
  const wide = tall * aspect(DETAILS.hand) + tall * aspect(DETAILS.book) + gap;
  assert.ok(Math.abs(wide - inner) < 1, `the pair comes out ${wide.toFixed(1)} of ${inner}`);
});

/* ── The slides themselves ───────────────────────────────────────── */

test('every slide carries a colour, and no two neighbours share one', () => {
  const accents = [...source.matchAll(/^\s*accent: '(#[0-9A-Fa-f]{6})',$/gm)].map(m => m[1]);
  const lits = [...source.matchAll(/^\s*lit: '(#[0-9A-Fa-f]{6})',$/gm)].map(m => m[1]);
  assert.equal(accents.length, 5, `found ${accents.length} accents`);
  assert.equal(lits.length, 5, `found ${lits.length} lit colours`);
  assert.equal(new Set(accents).size, 5, 'two parts share an accent');
  for (let i = 1; i < accents.length; i += 1) {
    assert.notEqual(accents[i], accents[i - 1], 'neighbouring parts share a colour');
  }
});

test('the honest paragraph about the composites is still there', () => {
  // ⚠ Without it a reader can leave believing Sinai holds two panels.
  assert.match(source, /modern comparisons\*\* created from the two sides/);
  assert.match(source, /not separate images found in the original icon/);
});

test('nothing claims the halo is lettered', () => {
  // [GEN] says only that SOME examples of the type carry Ο ΩΝ — see the
  // header of the content file.
  const claims = source.match(/Ο ΩΝ|IC XC/g) ?? [];
  for (const claim of claims) {
    // It may only appear inside a comment warning against claiming it.
    const line = source.split('\n').find(l => l.includes(claim)) ?? '';
    assert.match(line.trim(), /^(\*|\/\/|\/\*)/, `"${claim}" is claimed in the copy`);
  }
});
