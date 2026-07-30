import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ORBIT_STEPS,
  makeOrbitRing,
  orbitGeometry,
  orbitPoint,
  orbitSpill,
  type OrbitRing,
} from '../components/prayer/prayerOrbitGeometry';

/* The orbit on the My Rule prayer screen reads as three-dimensional for
 * exactly one reason: the far half of each hoop is painted behind what it
 * encircles and the near half in front of it. If an arc does not actually
 * OVERLAP anything, nothing is ever occluded and the whole figure collapses
 * into a ring drawn politely around some content.
 *
 * The first cut of this geometry set `b` and the tilt by hand and failed
 * that on two of five sizes. It looked perfectly fine on the phone it was
 * written against. These are the checks that replace looking. */

/**
 * The stage the hoops encircle, and the object standing centred in it.
 *
 * ⚠ THE OBJECT IS CENTRED AND NEARLY FILLS THE STAGE, which is what the
 * screen actually does: the icon room is a flex box and the object takes
 * `min(room − 10, 380)` of it. So the arcs do NOT have to reach past the
 * object's foot — they have to land INSIDE its band, where it can hide
 * them. An arc outside that band is an arc with nothing to be behind.
 *
 * Both the widest and the narrowest phone the app runs on appear here,
 * with the object's own size derived rather than guessed: the icon is
 * 45.5 by 84, and the cross is narrower still.
 */
const OBJECT_CAP = 380;
const OBJECT_ASPECT = 45.5 / 84;

const STAGES: { label: string; width: number; height: number }[] = [
  { label: 'small phone', width: 288, height: 300 },
  { label: 'normal phone', width: 358, height: 400 },
  { label: 'tall phone', width: 390, height: 470 },
  { label: 'short phone', width: 398, height: 230 },
  { label: 'narrow tall', width: 280, height: 520 },
];

/** The standing object's own half-height and half-width, in the stage. */
function objectHalf(stage: { width: number; height: number }) {
  const height = Math.min(stage.height - 10, OBJECT_CAP);
  return { y: height / 2, x: (height * OBJECT_ASPECT) / 2 };
}

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
  // holds, no stage can push an arc off the thing it has to cross.
  for (const a of [60, 91, 121, 160, 240]) {
    for (const reach of [40, 90, 150, 220]) {
      for (const tiltShare of [-0.8, -0.5, -0.2, 0, 0.2, 0.5, 0.8]) {
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

test('the two hoops lean opposite ways', () => {
  for (const stage of STAGES) {
    const [outer, inner] = orbitGeometry(stage).rings;
    assert.ok(
      outer.tilt * inner.tilt < 0,
      `${stage.label}: tilts ${outer.tilt} and ${inner.tilt} do not oppose`,
    );
  }
});

test('the far arc passes BEHIND the standing object', () => {
  // High enough to be up in the object's body, where the object hides it —
  // which is the entire depth cue. An arc that crests above the object's
  // head has nothing to be behind.
  for (const stage of STAGES) {
    const object = objectHalf(stage);
    for (const ring of orbitGeometry(stage).rings) {
      const { farHigh } = survey(ring);
      assert.ok(farHigh < 0, `${stage.label}: far arc never rises above the middle`);
      assert.ok(
        farHigh > -object.y,
        `${stage.label}: far arc crests at ${farHigh.toFixed(1)}, above the object's head at ${(-object.y).toFixed(1)} — nothing occludes it`,
      );
    }
  }
});

test('the near arc comes IN FRONT of the object\'s lower body', () => {
  // The other half of the same cue: having passed behind the figure up
  // top, the hoop comes back ACROSS it low down. If it dipped past the
  // object's foot it would cross empty page instead of the object.
  for (const stage of STAGES) {
    const object = objectHalf(stage);
    for (const ring of orbitGeometry(stage).rings) {
      const { nearLow } = survey(ring);
      assert.ok(nearLow > 0, `${stage.label}: near arc never comes below the middle`);
      assert.ok(
        nearLow < object.y,
        `${stage.label}: near arc dips to ${nearLow.toFixed(1)}, past the object's foot ${object.y.toFixed(1)}`,
      );
    }
  }
});

test('the readout preset still crosses the digits it surrounds', () => {
  // ⚠ The stage hoops CANNOT reach the reading — maxX ≤ a ⟺ reach ≤ a for
  // a tilted ellipse, so a hoop tall enough to span object and reading
  // together must escape sideways past its own width and be clipped. That
  // is why the reading keeps its own small pair, and this is the check
  // that they still do their job at every size the digits come out at.
  const READINGS = [
    { label: 'tiny, 38pt', width: 110, height: 44 },
    { label: 'compact, 50pt', width: 128, height: 56 },
    { label: 'normal, 58pt', width: 150, height: 65 },
    { label: 'hours shown, 44pt', width: 190, height: 50 },
    { label: 'largest', width: 240, height: 72 },
  ];

  for (const reading of READINGS) {
    const g = orbitGeometry(reading, 'readout');
    for (const ring of g.rings) {
      const { nearLow, farHigh, maxAbsX, maxAbsY } = survey(ring);
      assert.ok(
        nearLow > 0 && nearLow < reading.height / 2,
        `${reading.label}: near arc at ${nearLow.toFixed(1)} does not cross the digits' lower half (${(reading.height / 2).toFixed(1)})`,
      );
      assert.ok(
        farHigh < 0 && farHigh > -reading.height / 2,
        `${reading.label}: far arc at ${farHigh.toFixed(1)} does not run behind the digits' upper half`,
      );
      assert.ok(
        maxAbsX > reading.width / 2,
        `${reading.label}: ring reaches x=${maxAbsX.toFixed(1)}, inside the reading's ${(reading.width / 2).toFixed(1)}`,
      );
      const spill = orbitSpill(ring);
      assert.ok(
        maxAbsX + spill <= g.boxW / 2 && maxAbsY + spill <= g.boxH / 2,
        `${reading.label}: the figure escapes its own box and would be clipped`,
      );
    }
  }
});

test('the hoops encircle the object rather than passing through it', () => {
  // Wider than the object at its widest, or the arc would cut across the
  // figure at the sides instead of going round it — and both hoops have
  // to clear it, not just the outer one.
  for (const stage of STAGES) {
    const object = objectHalf(stage);
    for (const ring of orbitGeometry(stage).rings) {
      assert.ok(
        survey(ring).maxAbsX > object.x,
        `${stage.label}: hoop reaches x=${survey(ring).maxAbsX.toFixed(1)}, inside the object's ${object.x.toFixed(1)}`,
      );
    }
  }
});

test('nothing, out to the bead\'s halo, escapes the stage', () => {
  // react-native-svg clips to the surface, so anything past the box is not
  // merely off-layout — it is cut, with a visible straight edge, which is
  // the one thing a glow must never have.
  for (const stage of STAGES) {
    const g = orbitGeometry(stage);
    for (const ring of g.rings) {
      const { maxAbsX, maxAbsY } = survey(ring);
      const spill = orbitSpill(ring);
      assert.ok(
        maxAbsX + spill <= g.boxW / 2,
        `${stage.label}: needs ${(maxAbsX + spill).toFixed(1)} across, stage gives ${(g.boxW / 2).toFixed(1)}`,
      );
      assert.ok(
        maxAbsY + spill <= g.boxH / 2,
        `${stage.label}: needs ${(maxAbsY + spill).toFixed(1)} down, stage gives ${(g.boxH / 2).toFixed(1)}`,
      );
    }
  }
});

test('the inner hoop stays inside the outer one', () => {
  // Two hoops that cross at the sides read as an armillary sphere; two
  // that reach the same width read as one line drawn twice.
  for (const stage of STAGES) {
    const [outer, inner] = orbitGeometry(stage).rings;
    assert.ok(
      survey(inner).maxAbsX < survey(outer).maxAbsX,
      `${stage.label}: the inner hoop is not narrower than the outer`,
    );
    assert.ok(
      survey(inner).maxAbsY < survey(outer).maxAbsY,
      `${stage.label}: the inner hoop is not shallower than the outer`,
    );
  }
});

test('an unmeasured first frame still builds a sane figure', () => {
  for (const preset of ['stage', 'readout'] as const) {
    const g = orbitGeometry({ width: 0, height: 0 }, preset);
    assert.ok(g.boxW > 0 && g.boxH > 0, preset);
    for (const ring of g.rings) {
      assert.ok(Number.isFinite(ring.a) && ring.a > 0, preset);
      assert.ok(Number.isFinite(ring.b) && ring.b > 0, preset);
      assert.ok(Number.isFinite(ring.tilt), preset);
    }
  }
});

test('both halves of every path are drawn and closed end to end', () => {
  for (const stage of STAGES) {
    const g = orbitGeometry(stage);
    for (const path of g.paths) {
      for (const d of [path.near, path.far]) {
        assert.ok(d.startsWith('M'), 'path must open with a move');
        assert.equal((d.match(/M/g) ?? []).length, 1, 'a half is one unbroken run');
        assert.equal((d.match(/L/g) ?? []).length, ORBIT_STEPS, 'a half is sampled at every step');
        assert.ok(!/NaN|Infinity/.test(d), 'path carries no NaN or Infinity');
      }
    }
    // The two halves must meet: the near arc's ends are the far arc's ends.
    for (let i = 0; i < g.rings.length; i += 1) {
      const near = g.paths[i].near;
      const far = g.paths[i].far;
      assert.equal(
        near.slice(1, near.indexOf('L')),
        far.slice(far.lastIndexOf('L') + 1),
        'the near arc must begin where the far one ends',
      );
      assert.equal(
        near.slice(near.lastIndexOf('L') + 1),
        far.slice(1, far.indexOf('L')),
        'the near arc must end where the far one begins',
      );
    }
  }
});
