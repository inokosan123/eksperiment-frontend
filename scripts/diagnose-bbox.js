const fs = require('fs');
const path = require('path');

function expandBbox(b, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  if (x < b.minX) b.minX = x;
  if (y < b.minY) b.minY = y;
  if (x > b.maxX) b.maxX = x;
  if (y > b.maxY) b.maxY = y;
}

function getAttr(attrs, name) {
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return m ? m[1] : null;
}

function parsePathBbox(d, bbox) {
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:[eE][+-]?\d+)?/g);
  if (!tokens) return;
  let cx = 0, cy = 0, sx = 0, sy = 0, cmd = '';
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (/^[a-zA-Z]$/.test(t)) {
      cmd = t;
      if (cmd === 'Z' || cmd === 'z') { cx = sx; cy = sy; }
      continue;
    }
    const isRel = cmd === cmd.toLowerCase();
    const num = parseFloat(t);
    switch (cmd.toUpperCase()) {
      case 'M': case 'L': case 'T': {
        const x = isRel ? cx + num : num;
        const y = isRel ? cy + parseFloat(tokens[++i]) : parseFloat(tokens[++i]);
        cx = x; cy = y;
        if (cmd.toUpperCase() === 'M') { sx = x; sy = y; }
        expandBbox(bbox, cx, cy);
        break;
      }
      case 'H': cx = isRel ? cx + num : num; expandBbox(bbox, cx, cy); break;
      case 'V': cy = isRel ? cy + num : num; expandBbox(bbox, cx, cy); break;
      case 'C': {
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
      case 'S': case 'Q': {
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
        const rx = num;
        const ry = parseFloat(tokens[++i]);
        i += 3;
        const x = isRel ? cx + parseFloat(tokens[++i]) : parseFloat(tokens[++i]);
        const y = isRel ? cy + parseFloat(tokens[++i]) : parseFloat(tokens[++i]);
        expandBbox(bbox, x - rx, y - ry);
        expandBbox(bbox, x + rx, y + ry);
        cx = x; cy = y;
        break;
      }
    }
  }
}

const target = process.argv[2] || 'praying-hands';
const file = path.join(__dirname, '..', 'assets', 'noto', 'habits', `${target}.svg`);
const content = fs.readFileSync(file, 'utf-8');

console.log(`\n=== ${target} ===`);
const bbox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
const pathRe = /<path\b([^>]*)>/gi;
let m, idx = 0;
while ((m = pathRe.exec(content))) {
  const localBbox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const d = getAttr(m[1], 'd');
  if (!d) continue;
  parsePathBbox(d, localBbox);
  parsePathBbox(d, bbox);
  if (Number.isFinite(localBbox.minX)) {
    console.log(`Path ${idx++}: x=[${localBbox.minX.toFixed(1)}, ${localBbox.maxX.toFixed(1)}] y=[${localBbox.minY.toFixed(1)}, ${localBbox.maxY.toFixed(1)}]`);
  }
}
console.log(`\nFINAL: x=[${bbox.minX.toFixed(1)}, ${bbox.maxX.toFixed(1)}] y=[${bbox.minY.toFixed(1)}, ${bbox.maxY.toFixed(1)}]`);
console.log(`Center: (${((bbox.minX + bbox.maxX) / 2).toFixed(1)}, ${((bbox.minY + bbox.maxY) / 2).toFixed(1)})`);
console.log(`viewBox center is (64, 64) for stock 0 0 128 128 svg`);
