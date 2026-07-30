import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ORBIT_BOX,
  makeOrbitRing,
  orbitGeometry,
  orbitBlushReach,
  orbitHaloReach,
  orbitPoint,
  type OrbitRing,
} from '../components/prayer/prayerOrbitGeometry';

/* The orbit around the My Rule prayer timer reads as three-dimensional for
 * exactly one reason: the far half of the ellipse is painted behind the
 * digits and the near half in front of them. If the arc does not actually
 * OVERLAP the digits, nothing is ever occluded and the whole figure
 * collapses into a ring drawn politely around some type.
 *
 * The first cut of this geometry set `b` and the tilt by hand and failed
 * that on two of five readings — including the one that appears the moment
 * a prayer passes an hour. It looked perfectly fine on the phone it was
 * written against. These are the checks that replace looking. */

// Every reading this screen actually produces: the compact-height font (50)
// and the full one (58), each at minutes:seconds; the wider, shorter shape
// hours put on the clock; and the extremes either side of those.
const READINGS: { label: string; width: number; height: number }[] = [
  { label: 'tiny phone, 38pt', width: 110, height: 44 },
  { label: 'compact, 50pt', width: 128, height: 56 },
  { label: 'normal, 58pt', width: 150, height: 65 },
  { label: 'hours shown, 44pt', width: 190, height: 50 },
  { label: 'largest reading', width: 240, height: 72 },
];

/** The arc's extremes, sampled finely enough to trust. */
function survey(ring: OrbitRing) {
  let nearLow = -Infinity;
  let farHigh = Infinity;
  let maxAbsX = 0;
  let maxAbsY = 0;

  for (let i = 0; i <= 1440; i += 1) {
    const p = orbitPoint(ring, (i / 1440) * Math.PI * 2);
    if (p.depth > 0) nearLow = Math.max(nearLow, p.y);
    if (p.depth < 0) farHigh = Math.min(farHigh, p.y);
    maxAbsX = Math.max(maxAbsX, Math.abs(p.x));
    maxAbsY = Math.max(maxAbsY, Math.abs(p.y));
  }

  return { nearLow, farHigh, maxAbsX, maxAbsY };
}

test('a solved ring reaches exactly the height it was asked for', () => {
  // The property the whole parameterisation exists to guarantee. If this
  // holds, no reading can push the arc off the digits.
  for (const a of [60, 91, 121, 160, 240]) {
    for (const reach of [8, 13, 20, 30]) {
      for (const tiltShare of [-0.8, -0.55, -0.2, 0, 0.2, 0.62, 0.8]) {
        const ring = makeOrbitRing({
          a, reach, tiltShare, phase: 0, beadR: 2, ink: { near: 0.5, far: 0.2 },
        });
        assert.ok(
          Math.abs(survey(ring).maxAbsY - reach) < 0.01,
          `a=${a} reach=${reach} tiltShare=${tiltShare} reached ${survey(ring).maxAbsY}`,
        );
      }
    }
  }
});

test('the two rings lean opposite ways', () => {
  for (const reading of READINGS) {
    const [outer, inner] = orbitGeometry(reading).rings;
    assert.ok(
      outer.tilt * inner.tilt < 0,
      `${reading.label}: tilts ${outer.tilt} and ${inner.tilt} do not oppose`,
    );
  }
});

test('the near arc crosses the lower half of the digits', () => {
  for (const reading of READINGS) {
    for (const ring of orbitGeometry(reading).rings) {
      const { nearLow } = survey(ring);
      assert.ok(nearLow > 0, `${reading.label}: near arc never dips below the middle`);
      assert.ok(
        nearLow < reading.height / 2,
        `${reading.label}: near arc reaches ${nearLow.toFixed(1)}, past the digits' ${(reading.height / 2).toFixed(1)} — it sails over them and occludes nothing`,
      );
    }
  }
});

test('the far arc runs behind the upper half of the digits', () => {
  for (const reading of READINGS) {
    for (const ring of orbitGeometry(reading).rings) {
      const { farHigh } = survey(ring);
      assert.ok(farHigh < 0, `${reading.label}: far arc never rises above the middle`);
      assert.ok(
        farHigh > -reading.height / 2,
        `${reading.label}: far arc reaches ${farHigh.toFixed(1)}, past the digits' -${(reading.height / 2).toFixed(1)}`,
      );
    }
  }
});

test('the rings still encircle the type rather than sitting inside it', () => {
  for (const reading of READINGS) {
    for (const ring of orbitGeometry(reading).rings) {
      assert.ok(
        survey(ring).maxAbsX > reading.width / 2,
        `${reading.label}: ring reaches x=${survey(ring).maxAbsX.toFixed(1)}, inside the reading's ${(reading.width / 2).toFixed(1)}`,
      );
    }
  }
});

test('nothing, out to the bead\'s outermost blush, escapes the box', () => {
  // react-native-svg clips to the surface, so anything past the box is not
  // merely off-layout — it is cut, with a visible straight edge, which is
  // the one thing a glow must never have. The blush is the widest thing
  // the figure draws, so it is what the box has to be measured against.
  for (const reading of READINGS) {
    const g = orbitGeometry(reading);
    for (const ring of g.rings) {
      const { maxAbsX, maxAbsY } = survey(ring);
      const spill = orbitBlushReach(ring);
      assert.ok(spill > orbitHaloReach(ring), 'the blush must be the outermost layer');
      assert.ok(
        maxAbsX + spill <= g.boxW / 2,
        `${reading.label}: needs ${(maxAbsX + spill).toFixed(1)} across, box gives ${(g.boxW / 2).toFixed(1)}`,
      );
      assert.ok(
        maxAbsY + spill <= g.boxH / 2,
        `${reading.label}: needs ${(maxAbsY + spill).toFixed(1)} down, box gives ${(g.boxH / 2).toFixed(1)}`,
      );
    }
  }
});

test('the box costs the icon above it as little height as it can', () => {
  // Every point this box takes is a point off the icon, which is the hero
  // of the screen. The padding is deliberately small because the rings
  // live INSIDE the reading's own band; if someone widens it, this is the
  // reason to think twice.
  assert.equal(ORBIT_BOX.padY, 34);
  for (const reading of READINGS) {
    const g = orbitGeometry(reading);
    assert.ok(g.boxH <= reading.height + 40, `${reading.label}: box is ${g.boxH} tall for a ${reading.height} reading`);
  }
});

test('an unmeasured first frame still builds a sane figure', () => {
  const g = orbitGeometry({ width: 0, height: 0 });
  assert.ok(g.boxW > 0 && g.boxH > 0);
  for (const ring of g.rings) {
    assert.ok(Number.isFinite(ring.a) && ring.a > 0);
    assert.ok(Number.isFinite(ring.b) && ring.b > 0);
    assert.ok(Number.isFinite(ring.tilt));
  }
});

test('both halves of every path are drawn and closed end to end', () => {
  for (const reading of READINGS) {
    const g = orbitGeometry(reading);
    for (const path of g.paths) {
      for (const d of [path.near, path.far]) {
        assert.ok(d.startsWith('M'), 'path must open with a move');
        assert.equal((d.match(/M/g) ?? []).length, 1, 'a half is one unbroken run');
        assert.equal((d.match(/L/g) ?? []).length, 48, 'a half is sampled at 48 segments');
        assert.ok(!/NaN|Infinity/.test(d), 'path carries no NaN or Infinity');
      }
    }
    // The two halves must meet: the near arc's ends are the far arc's ends.
    for (let i = 0; i < g.rings.length; i += 1) {
      const near = g.paths[i].near;
      const far = g.paths[i].far;
      const nearStart = near.slice(1, near.indexOf('L'));
      const farEnd = far.slice(far.lastIndexOf('L') + 1);
      const nearEnd = near.slice(near.lastIndexOf('L') + 1);
      const farStart = far.slice(1, far.indexOf('L'));
      assert.equal(nearStart, farEnd, 'the near arc must begin where the far one ends');
      assert.equal(nearEnd, farStart, 'the near arc must end where the far one begins');
    }
  }
});
