const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets', 'noto');
const OUT_DIR = path.join(ROOT, 'components', 'shared', 'notoEmoji');

function escapeForTemplate(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

// ─── SVG bounding box computation ────────────────────────────────────────────
// Walks every path/circle/rect/etc shape inside a Noto SVG and computes the
// tightest viewBox that still encloses everything visible. Noto's stock 128×128
// viewBoxes leave inconsistent breathing room around the artwork (some have
// halos, some sit low) which makes the icons look mis-centered when rendered
// in chips of fixed size. Re-cropping makes every icon read centered.

function expandBbox(bbox, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  if (x < bbox.minX) bbox.minX = x;
  if (y < bbox.minY) bbox.minY = y;
  if (x > bbox.maxX) bbox.maxX = x;
  if (y > bbox.maxY) bbox.maxY = y;
}

function parsePathBbox(d, bbox) {
  // Tokenize: split commands and number arguments. Path grammar uses commas or
  // whitespace as separators; numbers can have optional sign and decimal.
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:[eE][+-]?\d+)?/g);
  if (!tokens) return;

  let cx = 0, cy = 0;          // current point
  let startX = 0, startY = 0;  // sub-path start (for Z)
  let cmd = '';

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (/^[a-zA-Z]$/.test(t)) {
      cmd = t;
      if (cmd === 'Z' || cmd === 'z') {
        cx = startX;
        cy = startY;
      }
      continue;
    }

    const isRel = cmd === cmd.toLowerCase();
    const num = parseFloat(t);

    switch (cmd.toUpperCase()) {
      case 'M':
      case 'L':
      case 'T': {
        const x = isRel ? cx + num : num;
        const y = isRel ? cy + parseFloat(tokens[++i]) : parseFloat(tokens[++i]);
        cx = x; cy = y;
        if (cmd.toUpperCase() === 'M') { startX = x; startY = y; }
        expandBbox(bbox, cx, cy);
        // After M, repeated coords are implicit lineto — handled by next iter.
        break;
      }
      case 'H': {
        cx = isRel ? cx + num : num;
        expandBbox(bbox, cx, cy);
        break;
      }
      case 'V': {
        cy = isRel ? cy + num : num;
        expandBbox(bbox, cx, cy);
        break;
      }
      case 'C': {
        // 6 args: x1 y1 x2 y2 x y. We only sample the endpoints + control
        // points to be safe (control points can extend bbox even if they
        // aren't on the curve). Slight over-approximation is fine.
        const x1 = isRel ? cx + num : num;
        const y1 = isRel ? cy + parseFloat(tokens[++i]) : parseFloat(tokens[++i]);
        const x2 = isRel ? cx + parseFloat(tokens[++i]) : parseFloat(tokens[++i]);
        const y2 = isRel ? cy + parseFloat(tokens[++i]) : parseFloat(tokens[++i]);
        const x  = isRel ? cx + parseFloat(tokens[++i]) : parseFloat(tokens[++i]);
        const y  = isRel ? cy + parseFloat(tokens[++i]) : parseFloat(tokens[++i]);
        expandBbox(bbox, x1, y1);
        expandBbox(bbox, x2, y2);
        expandBbox(bbox, x, y);
        cx = x; cy = y;
        break;
      }
      case 'S':
      case 'Q': {
        // 4 args: x1 y1 x y
        const x1 = isRel ? cx + num : num;
        const y1 = isRel ? cy + parseFloat(tokens[++i]) : parseFloat(tokens[++i]);
        const x  = isRel ? cx + parseFloat(tokens[++i]) : parseFloat(tokens[++i]);
        const y  = isRel ? cy + parseFloat(tokens[++i]) : parseFloat(tokens[++i]);
        expandBbox(bbox, x1, y1);
        expandBbox(bbox, x, y);
        cx = x; cy = y;
        break;
      }
      case 'A': {
        // 7 args: rx ry x-axis-rotation large-arc-flag sweep-flag x y
        const rx = num;
        const ry = parseFloat(tokens[++i]);
        i += 3; // skip rotation + flags
        const x = isRel ? cx + parseFloat(tokens[++i]) : parseFloat(tokens[++i]);
        const y = isRel ? cy + parseFloat(tokens[++i]) : parseFloat(tokens[++i]);
        // Approximate arc bounds with start + end points, plus a buffer
        // equal to the radii (over-approximates but safe).
        expandBbox(bbox, x - rx, y - ry);
        expandBbox(bbox, x + rx, y + ry);
        cx = x; cy = y;
        break;
      }
    }
  }
}

function parseCircle(attrs, bbox) {
  const cx = parseFloat(getAttr(attrs, 'cx')) || 0;
  const cy = parseFloat(getAttr(attrs, 'cy')) || 0;
  const r  = parseFloat(getAttr(attrs, 'r'))  || 0;
  expandBbox(bbox, cx - r, cy - r);
  expandBbox(bbox, cx + r, cy + r);
}

function parseEllipse(attrs, bbox) {
  const cx = parseFloat(getAttr(attrs, 'cx')) || 0;
  const cy = parseFloat(getAttr(attrs, 'cy')) || 0;
  const rx = parseFloat(getAttr(attrs, 'rx')) || 0;
  const ry = parseFloat(getAttr(attrs, 'ry')) || 0;
  expandBbox(bbox, cx - rx, cy - ry);
  expandBbox(bbox, cx + rx, cy + ry);
}

function parseRect(attrs, bbox) {
  const x = parseFloat(getAttr(attrs, 'x')) || 0;
  const y = parseFloat(getAttr(attrs, 'y')) || 0;
  const w = parseFloat(getAttr(attrs, 'width'))  || 0;
  const h = parseFloat(getAttr(attrs, 'height')) || 0;
  expandBbox(bbox, x, y);
  expandBbox(bbox, x + w, y + h);
}

function parsePolygon(attrs, bbox) {
  const points = getAttr(attrs, 'points') || '';
  const nums = points.match(/-?\d*\.?\d+/g);
  if (!nums) return;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    expandBbox(bbox, parseFloat(nums[i]), parseFloat(nums[i + 1]));
  }
}

function parseLine(attrs, bbox) {
  expandBbox(bbox, parseFloat(getAttr(attrs, 'x1')) || 0, parseFloat(getAttr(attrs, 'y1')) || 0);
  expandBbox(bbox, parseFloat(getAttr(attrs, 'x2')) || 0, parseFloat(getAttr(attrs, 'y2')) || 0);
}

function getAttr(attrs, name) {
  // \b at the start prevents matching `id="..."` when looking up `d="..."`
  // (since `d=` is a substring of `id=`). This silently fed gradient ids
  // through the path-bbox parser and produced viewBoxes with 1e+43 numbers.
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return m ? m[1] : null;
}

function computeContentBbox(svgContent) {
  const bbox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

  // <path d="...">
  const pathRe = /<path\b([^>]*)>/gi;
  let m;
  while ((m = pathRe.exec(svgContent))) {
    const d = getAttr(m[1], 'd');
    if (d) parsePathBbox(d, bbox);
  }

  // Primitive shapes
  const shapeRe = /<(circle|ellipse|rect|polygon|polyline|line)\b([^>]*)>/gi;
  while ((m = shapeRe.exec(svgContent))) {
    const [, tag, attrs] = m;
    if (tag === 'circle')   parseCircle(attrs, bbox);
    else if (tag === 'ellipse') parseEllipse(attrs, bbox);
    else if (tag === 'rect')    parseRect(attrs, bbox);
    else if (tag === 'polygon' || tag === 'polyline') parsePolygon(attrs, bbox);
    else if (tag === 'line')    parseLine(attrs, bbox);
  }

  if (!Number.isFinite(bbox.minX)) return null;
  return bbox;
}

function rewriteViewBox(svgContent) {
  // Noto Emoji glyphs are designed to sit on a text baseline — the actual
  // ink is biased toward the lower-middle of the 128×128 viewBox so emojis
  // align with adjacent text. When we render them in fixed-size square chips
  // (no surrounding text), that bias reads as "the icon is too low".
  //
  // Empirically a uniform −5 unit (4%) upward shift matches the perceived
  // centre of mass for Noto's people/hands/candle/runner glyphs and barely
  // moves already-balanced glyphs (sun, droplet, heart). Cheaper than per
  // icon centroid analysis and produces a single, predictable result.
  const SHIFT_Y = -5;

  return svgContent.replace(/(<svg[^>]*>)([\s\S]*?)(<\/svg>)/i, (_, open, body, close) =>
    `${open}<g transform="translate(0, ${SHIFT_Y})">${body}</g>${close}`
  );
}

function readSvgs(srcDir) {
  const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.svg')).sort();
  return files.map(f => {
    const name = f.replace('.svg', '');
    let content = fs.readFileSync(path.join(srcDir, f), 'utf-8');
    content = content
      .replace(/<\?xml[^>]*\?>\s*/g, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Tighten the viewBox around real content so the icon sits centered when
    // rendered in a fixed-size chip.
    content = rewriteViewBox(content);

    // Strip / normalise root <svg> attributes that disagree across renderers:
    //  - x="0px" / y="0px" — react-native-svg's iOS native code interprets
    //    these as offsets and shifts the artwork; web ignores them.
    //  - enable-background — Adobe-only, ignored everywhere but adds noise.
    //  - Ensure preserveAspectRatio is explicit so iOS native and web agree
    //    on centering.
    content = content.replace(/<svg\b([^>]*)>/i, (full, attrs) => {
      let next = attrs
        .replace(/\s+x="[^"]*"/gi, '')
        .replace(/\s+y="[^"]*"/gi, '')
        .replace(/\s+style="[^"]*enable-background:[^"]*"/gi, '')
        .replace(/\s+xml:space="[^"]*"/gi, '');
      if (!/\bpreserveAspectRatio=/i.test(next)) {
        next += ' preserveAspectRatio="xMidYMid meet"';
      }
      return `<svg${next}>`;
    });

    // Make every internal id unique per icon. Multiple Noto SVGs share the
    // same Adobe Illustrator export ids ("SVGID_1_" etc); when several render
    // on the same screen react-native-svg on iOS collides on the shared id
    // space and can crash the native paint backend. We deliberately do NOT
    // also rewrite plain `href="#..."` because xlink:href contains "href=" as
    // a substring — running both replacers double-prefixes ids on iOS.
    const safeName = name.replace(/[^a-zA-Z0-9_]/g, '_');
    const idPrefix = `${safeName}_`;
    content = content
      .replace(/id="([^"]+)"/g, (_match, id) => `id="${idPrefix}${id}"`)
      .replace(/url\(#([^)]+)\)/g, (_match, id) => `url(#${idPrefix}${id})`)
      .replace(/xlink:href="#([^"]+)"/g, (_match, id) => `xlink:href="#${idPrefix}${id}"`);

    return { name, content };
  });
}

function buildHabitsFile() {
  const entries = readSvgs(path.join(ASSETS, 'habits'));
  const lines = entries.map(({ name, content }) =>
    `  '${name}': \`${escapeForTemplate(content)}\`,`
  ).join('\n');
  const out = [
    '// AUTO-GENERATED from assets/noto/habits/*.svg.',
    '// Regenerate via: node scripts/build-noto-emoji.js',
    '',
    'export const HABIT_SVG: Record<string, string> = {',
    lines,
    '};',
    '',
    'export type HabitEmojiName = keyof typeof HABIT_SVG;',
    '',
  ].join('\n');
  const outPath = path.join(OUT_DIR, 'habits.ts');
  fs.writeFileSync(outPath, out, 'utf-8');
  return { count: entries.length, sizeKb: (fs.statSync(outPath).size / 1024).toFixed(1), names: entries.map(e => e.name) };
}

const result = buildHabitsFile();
console.log(`habits.ts: ${result.count} icons, ${result.sizeKb} KB`);
console.log(`Names: ${result.names.join(', ')}`);
