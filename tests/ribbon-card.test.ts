import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RIBBON,
  RIBBON_STARS,
  placeRibbonStars,
  ribbonCardRhythm,
  ribbonEmblem,
  ribbonZones,
  sparkPath,
} from '../components/shared/ribbonCardGeometry';

/* The section card is the app's most-used element — four screens, and on two
 * of them it is the only thing there. It also has to hold up across a 110pt
 * spread of plate widths, which is what broke the first cut of the design.
 *
 * These are the checks that used to be done by eye, one device at a time. */

// Plate width = screen width minus the screen's own padding: 32 on Library and
// Inner, 40 on Home. Narrowest phone the app runs on is 320, widest 430.
const WIDTHS = [288, 280, 320, 328, 335, 343, 353, 358, 361, 372, 380, 390, 398];
// Two-, three-, four- and five-line sentences.
const HEIGHTS = [136, 159, 182, 205];

function forEveryPlate(fn: (w: number, h: number) => void) {
  WIDTHS.forEach(w => HEIGHTS.forEach(h => fn(w, h)));
}

test('no star is hidden behind the arrow button', () => {
  forEveryPlate((w, h) => {
    const arrow = {
      x0: w - RIBBON.arrowInset - RIBBON.arrowSize,
      x1: w - RIBBON.arrowInset,
      y0: RIBBON.arrowInset,
      y1: RIBBON.arrowInset + RIBBON.arrowSize,
    };
    placeRibbonStars(w, h).forEach((s, i) => {
      const clear =
        s.x + s.size <= arrow.x0 || s.x >= arrow.x1 || s.y + s.size <= arrow.y0 || s.y >= arrow.y1;
      assert.ok(clear, `star ${i} (${s.zone}) sits under the arrow at ${w}x${h}`);
    });
  });
});

test('no star lands on the type', () => {
  forEveryPlate((w, h) => {
    // What the three rows of type can actually cover. The eyebrow and title are
    // absolutely sized; only the sentence's wrap point moves with the plate.
    const rows = [
      { x0: RIBBON.pad, x1: RIBBON.labelEnd, y0: RIBBON.top, y1: RIBBON.labelBottom },
      { x0: RIBBON.pad, x1: RIBBON.titleEnd, y0: RIBBON.titleTop, y1: RIBBON.titleBottom },
      {
        x0: RIBBON.pad,
        x1: RIBBON.textWidth * w - RIBBON.pad,
        y0: RIBBON.descTop,
        y1: h - RIBBON.bottom,
      },
    ];
    placeRibbonStars(w, h).forEach((s, i) => {
      rows.forEach((r, ri) => {
        const clear = s.x + s.size <= r.x0 || s.x >= r.x1 || s.y + s.size <= r.y0 || s.y >= r.y1;
        assert.ok(clear, `star ${i} (${s.zone}) covers row ${ri} at ${w}x${h}`);
      });
    });
  });
});

test('no star is clipped by the plate edge', () => {
  forEveryPlate((w, h) => {
    placeRibbonStars(w, h).forEach((s, i) => {
      assert.ok(s.x >= 0 && s.y >= 0, `star ${i} runs off the top/left at ${w}x${h}`);
      assert.ok(s.x + s.size <= w, `star ${i} runs off the right at ${w}x${h}`);
      assert.ok(s.y + s.size <= h, `star ${i} runs off the bottom at ${w}x${h}`);
    });
  });
});

test('every room stays wide enough to hold its largest star', () => {
  const biggest = Math.max(...RIBBON_STARS.map(s => s.size));
  forEveryPlate((w, h) => {
    const zones = ribbonZones(w, h);
    (Object.keys(zones) as (keyof typeof zones)[]).forEach(name => {
      const r = zones[name];
      assert.ok(r.x1 - r.x0 >= biggest, `${name} is narrower than a star at ${w}x${h}`);
      assert.ok(r.y1 - r.y0 >= biggest, `${name} is shorter than a star at ${w}x${h}`);
    });
  });
});

test('a star stays inside the room it was given, at either extreme of u/v', () => {
  forEveryPlate((w, h) => {
    const zones = ribbonZones(w, h);
    RIBBON_STARS.forEach((star, i) => {
      const room = zones[star.zone];
      [0, 1].forEach(edge => {
        const spanX = Math.max(0, room.x1 - room.x0 - star.size);
        const spanY = Math.max(0, room.y1 - room.y0 - star.size);
        const x = room.x0 + edge * spanX;
        const y = room.y0 + edge * spanY;
        assert.ok(x >= room.x0 && x + star.size <= room.x1, `star ${i} overhangs its room in x`);
        assert.ok(y >= room.y0 && y + star.size <= room.y1, `star ${i} overhangs its room in y`);
      });
    });
  });
});

test('the drawn path lands exactly where the geometry put it', () => {
  // Position and tilt are baked into the coordinates rather than left to a
  // transform, so this is checkable here instead of on a device: read every
  // number back out of the path data and compare the box it covers.
  forEveryPlate((w, h) => {
    placeRibbonStars(w, h).forEach((s, i) => {
      const nums = s.d.match(/-?\d+(\.\d+)?/g)!.map(Number);
      const xs = nums.filter((_, n) => n % 2 === 0);
      const ys = nums.filter((_, n) => n % 2 === 1);
      assert.equal(xs.length, 13, `star ${i} lost points`);
      // A rotated spark's box is its circumcircle at worst, never wider than
      // the star's own size measured corner to corner.
      const pad = s.size * 0.5;
      assert.ok(Math.min(...xs) >= s.x - pad, `star ${i} drawn left of its place`);
      assert.ok(Math.max(...xs) <= s.x + s.size + pad, `star ${i} drawn right of its place`);
      assert.ok(Math.min(...ys) >= s.y - pad, `star ${i} drawn above its place`);
      assert.ok(Math.max(...ys) <= s.y + s.size + pad, `star ${i} drawn below its place`);
      assert.ok(Number.isFinite(nums[0]), `star ${i} has NaN in its path`);
    });
  });
});

test('an untilted spark fills its box exactly', () => {
  const d = sparkPath(40, 70, 12, 0);
  const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
  const xs = nums.filter((_, n) => n % 2 === 0);
  const ys = nums.filter((_, n) => n % 2 === 1);
  assert.equal(Math.min(...xs), 40);
  assert.equal(Math.max(...xs), 52);
  assert.equal(Math.min(...ys), 70);
  assert.equal(Math.max(...ys), 82);
  assert.ok(d.startsWith('M') && d.endsWith('Z'), 'path is closed');
});

test('both constellations are used, and each has its own clock', () => {
  const shoulder = RIBBON_STARS.filter(s => s.clock === 'shoulder');
  const foot = RIBBON_STARS.filter(s => s.clock === 'foot');
  assert.ok(shoulder.length >= 3, 'the lit shoulder carries a constellation');
  assert.ok(foot.length >= 4, 'the emblem is ringed');
  // Uneven phases: no two arrivals on the same clock may share a moment.
  [shoulder, foot].forEach(group => {
    const phases = group.map(s => s.phase).sort((a, b) => a - b);
    phases.forEach((p, i) => {
      if (i === 0) return;
      assert.ok(p - phases[i - 1] > 0.1, 'two stars on one clock arrive together');
    });
  });
});

test('no two cards on a screen share a moment', () => {
  // The complaint this answers: the big star beside the title arriving on
  // every card at once. Screens carry four to six of these.
  for (let n = 2; n <= 8; n += 1) {
    const offsets = Array.from({ length: n }, (_, i) => ribbonCardRhythm(i).offset)
      .sort((a, b) => a - b);
    let closest = 1;
    offsets.forEach((p, i) => {
      const gap = i === 0 ? p + 1 - offsets[offsets.length - 1] : p - offsets[i - 1];
      closest = Math.min(closest, gap);
    });
    // A star is lit for a third to a little under half of its cycle, so
    // neighbours must be further apart than a rounding error — an eighth of
    // the cycle keeps their peaks visibly apart.
    assert.ok(closest > 0.08, `${n} cards: two arrive ${closest.toFixed(3)} apart`);
  }
});

test('cards run at different tempos, so they never fall back into step', () => {
  const stretches = Array.from({ length: 6 }, (_, i) => ribbonCardRhythm(i).stretch);
  stretches.forEach(s => {
    // Different, but all still the same design — a card must not read as
    // hurried or sluggish next to its neighbour.
    assert.ok(s > 0.9 && s < 1.1, `tempo ${s} is off the design`);
  });
  const unique = new Set(stretches.map(s => s.toFixed(4)));
  assert.equal(unique.size, stretches.length, 'two cards share a tempo');
});

test('the rhythm is the same on every launch, and safe for a stray index', () => {
  assert.deepEqual(ribbonCardRhythm(3), ribbonCardRhythm(3));
  [0, -1, 2.7, Number.NaN].forEach(i => {
    const r = ribbonCardRhythm(i);
    assert.ok(Number.isFinite(r.offset) && r.offset >= 0 && r.offset < 1, `offset broke on ${i}`);
    assert.ok(Number.isFinite(r.stretch) && r.stretch > 0, `stretch broke on ${i}`);
  });
});

test('the emblem reproduces the size it was drawn at in the lab', () => {
  // The lab plate: 326 wide, and tall enough that its sentence ran to four
  // lines. The design was tuned there at 150pt.
  const e = ribbonEmblem(326, 182);
  assert.equal(e.size, 150);
});

test('the emblem bleeds off the right and bottom, and never off the top', () => {
  forEveryPlate((w, h) => {
    const e = ribbonEmblem(w, h);
    assert.ok(e.right < 0 && e.bottom < 0, 'the emblem bleeds off the corner');
    // Top edge of the emblem's box, in plate coordinates.
    const top = h + e.bottom - e.size;
    assert.ok(top >= -1, `emblem is cut ${-top}pt off the top at ${w}x${h}`);
    // And it must never swallow the plate whole.
    assert.ok(w + e.right - e.size > RIBBON.pad, `emblem swallows the plate at ${w}x${h}`);
  });
});

test('the emblem never outgrows its share of the width', () => {
  forEveryPlate((w, h) => {
    const e = ribbonEmblem(w, h);
    assert.ok(e.size <= RIBBON.emblemScale * w + 1, `emblem is too wide at ${w}x${h}`);
    assert.ok(e.size > 60, `emblem has collapsed at ${w}x${h}`);
  });
});
