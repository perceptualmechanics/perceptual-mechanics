// A theme's ornament, drawn from geometry rather than traced: its patterns
// and their sizes come from the theme's data (euphonia.themes.json), its
// colours from the theme's tokens, and it is handed to the stylesheet as an
// SVG image the page makes itself.
//
// Drystone coursing, after the decorated walls of the Zimbabwe plateau: each
// course a row of granite in the shadow of its joints, one course high (h)
// and repeating every two (2h), so every pattern tiles with every other.
// - chevron: stones set to a zigzag, rising and falling across the course;
// - herringbone: short stones slanted one way, then the other;
// - check: two half-courses of stone and recess, alternating;
// - dentelle: stones set on edge, their corners standing up as a saw-tooth.
// Courses are parted by a joint a twelfth of a course deep.
const JOINT = 1 / 12;
// How thick a chevron's stones and a herringbone's are, as shares of a course,
// and how many herringbone stones lean each way in a repeat.
const CHEVRON_STONE = 0.42, HERRING_STONE = 0.2, HERRING_PER_SIDE = 3;

const COURSES = {
  chevron: (h, y, stone) => {
    const t = CHEVRON_STONE * h, top = y + t / 2, foot = y + h - t / 2;
    return `<polyline points="${[-h, foot, 0, top, h, foot, 2 * h, top, 3 * h, foot].join(' ')}" fill="none" stroke="${stone}" stroke-width="${t}" stroke-linejoin="miter"/>`;
  },
  herringbone: (h, y, stone) => {
    const t = HERRING_STONE * h, step = h / HERRING_PER_SIDE;
    const lean = (x0, dir) => Array.from({ length: HERRING_PER_SIDE + 1 }, (_, i) => {
      const x = x0 + i * step;
      return `<line x1="${x}" y1="${y + h}" x2="${x + dir * step * 1.5}" y2="${y}" stroke="${stone}" stroke-width="${t}"/>`;
    }).join('');
    return lean(-step, 1) + lean(h + step, -1);
  },
  check: (h, y, stone) => {
    const s = h / 2, g = JOINT * h;
    return Array.from({ length: 8 }, (_, i) => {
      const row = Math.floor(i / 4), col = i % 4;
      return (row + col) % 2 ? '' : `<rect x="${col * s + g / 2}" y="${y + row * s + g / 2}" width="${s - g}" height="${s - g}" fill="${stone}"/>`;
    }).join('');
  },
  dentelle: (h, y, stone) => {
    const g = JOINT * h;
    return [0, h].map(x => `<polygon points="${[x + g, y + h, x + h / 2, y + g, x + h - g, y + h].join(' ')}" fill="${stone}"/>`).join('');
  },
};

// The SVG for a stack of courses, top to bottom, `h` CSS pixels a course, and
// its height.
export function coursing(courses, h, { stone, joint }) {
  const gap = JOINT * h, height = courses.length * h + (courses.length - 1) * gap, width = 2 * h;
  const rows = courses.map((name, i) => {
    const y = i * (h + gap);
    return `<svg x="0" y="${y}" width="${width}" height="${h}" overflow="hidden"><g transform="translate(0 ${-y})">${COURSES[name](h, y, stone)}</g></svg>`;
  }).join('');
  return { height, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${joint}"/>${rows}</svg>` };
}

// Tocapu, after the cells of Inca cumbi tunics: a row of squares, each a
// small construction on its own grid, in the theme's dyes. `cells` names them
// in order; the row repeats.
// - quartered: the square cut by its diagonals, opposite quarters alike;
// - stepped: a staircase from corner to corner, three steps;
// - checked: a three-by-three chequer;
// - nested: a square within a square within the square;
// - key: a square hook, the cell's frame with one side turned in.
const TOCAPU = {
  quartered: (x, y, s, [a, b]) => `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${a}"/><path d="M${x} ${y}L${x + s / 2} ${y + s / 2}L${x} ${y + s}ZM${x + s} ${y}L${x + s / 2} ${y + s / 2}L${x + s} ${y + s}Z" fill="${b}"/>`,
  stepped: (x, y, s, [a, b]) => { const t = s / 3; return `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${a}"/><path d="M${x} ${y + s}V${y + 2 * t}H${x + t}V${y + t}H${x + 2 * t}V${y}H${x + s}V${y + s}Z" fill="${b}"/>`; },
  checked: (x, y, s, [a, b]) => { const t = s / 3; let out = `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${a}"/>`; for (let i = 0; i < 9; i++) if (i % 2 === 0) out += `<rect x="${x + (i % 3) * t}" y="${y + Math.floor(i / 3) * t}" width="${t}" height="${t}" fill="${b}"/>`; return out; },
  nested: (x, y, s, [a, b]) => `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${a}"/><rect x="${x + s / 6}" y="${y + s / 6}" width="${s * 2 / 3}" height="${s * 2 / 3}" fill="${b}"/><rect x="${x + s / 3}" y="${y + s / 3}" width="${s / 3}" height="${s / 3}" fill="${a}"/>`,
  key: (x, y, s, [a, b]) => { const t = s / 5; return `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${a}"/><path d="M${x + t} ${y + t}H${x + 4 * t}V${y + 4 * t}H${x + 2 * t}V${y + 2 * t}H${x + 3 * t}V${y + 3 * t}" fill="none" stroke="${b}" stroke-width="${t * 0.9}"/>`; },
};
// The cells' colours take turns from the theme's dyes, so neighbours differ.
export function tocapu(cells, s, { dyes, joint }) {
  const gap = JOINT * s, width = cells.length * (s + gap), height = s;
  const row = cells.map((name, i) => TOCAPU[name](i * (s + gap) + gap / 2, 0, s, [dyes[i % dyes.length], dyes[(i + 2) % dyes.length]])).join('');
  return { height, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${joint}"/>${row}</svg>` };
}

// The eight-pointed star and cross, as Ottoman tile and stone carry it,
// constructed as with compass and straightedge: in each square of side s,
// two squares inscribed in the same circle, one turned an eighth of a turn,
// make the star where they overlap; the crosses are what the stars leave.
// `rows` of tiles, stacked.
export function star(rows, s, { stone, joint }) {
  const r = s * Math.SQRT1_2 * 0.82;
  const square = (cx, cy, turn) => [0, 1, 2, 3].map(k => { const a = turn + k * Math.PI / 2 + Math.PI / 4; return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`; }).join(' ');
  const width = s, height = rows * s;
  let shapes = '';
  for (let j = 0; j < rows; j++) {
    const cx = s / 2, cy = j * s + s / 2;
    shapes += `<polygon points="${square(cx, cy, 0)}" fill="${stone}"/><polygon points="${square(cx, cy, Math.PI / 4)}" fill="${stone}"/>`;
  }
  return { height, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${joint}"/>${shapes}</svg>` };
}

// Jali, the pierced stone screens of Mughal building: octagons cut through a
// slab with small squares between them, the lattice an octagon's width
// apart. The stone is the slab; the joint colour is the light through it.
// With `rings`, a small ring stands in each square between the octagons.
export function jali(rows, s, { stone, joint, ring }, { rings } = {}) {
  const c = s / (2 + Math.SQRT2), width = s, height = rows * s;   // the octagon's side, from its width
  const oct = (x, y) => [[c / Math.SQRT2, 0], [c / Math.SQRT2 + c, 0], [s, c / Math.SQRT2], [s, c / Math.SQRT2 + c], [c / Math.SQRT2 + c, s], [c / Math.SQRT2, s], [0, c / Math.SQRT2 + c], [0, c / Math.SQRT2]].map(([a, b]) => `${x + a},${y + b}`).join(' ');
  const margin = s * JOINT;
  let holes = '';
  for (let j = 0; j < rows; j++) holes += `<polygon points="${oct(0, j * s)}" fill="${joint}" transform="translate(${s / 2} ${j * s + s / 2}) scale(${1 - 2 * JOINT}) translate(${-s / 2} ${-(j * s + s / 2)})"/>`;
  // The squares between octagons sit at the tiles' corners, a side c across.
  if (rings) for (let j = 0; j <= rows; j++) for (const x of [0, s]) holes += `<circle cx="${x}" cy="${j * s}" r="${c * 0.3}" fill="none" stroke="${ring}" stroke-width="${c * 0.12}"/>`;
  return { height, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${stone}"/>${holes}<rect x="${s - margin}" y="0" width="${margin}" height="${height}" fill="${stone}"/></svg>` };
}

// The key fret (huiwen), one squared spiral turned in on itself and out
// again, repeating along the band: drawn on a five-by-five grid per repeat.
export function fret(rows, s, { stone, joint }) {
  const t = s / 5, width = s, height = rows * s;
  let lines = '';
  for (let j = 0; j < rows; j++) {
    const y = j * s;
    lines += `<path d="M0 ${y + 4.5 * t}H${4.5 * t}V${y + 0.5 * t}H${1.5 * t}V${y + 2.5 * t}H${2.5 * t}" fill="none" stroke="${stone}" stroke-width="${t * 0.8}" stroke-linecap="square"/><path d="M${4.5 * t} ${y + 4.5 * t}H${s}" fill="none" stroke="${stone}" stroke-width="${t * 0.8}"/>`;
  }
  return { height, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${joint}"/>${lines}</svg>` };
}

// A khipu (Tawantinsuyu): numbers as knotted cords, as the Inca recorded
// them, in base ten by position. Each number hangs on its own pendant from
// the primary cord, its tens nearer the primary and its units below: tens as
// so many single knots, units of two to nine as one long knot of so many
// turns, a unit of one as a figure-eight, a zero as an empty place. A number
// not yet known hangs as a bare cord. The numbers are ability scores, which
// the SRD caps at 30, so each place's band is sized for its most: three tens
// knots, nine turns. Drawn in the page's colours by class (euphonia.css), so
// it carries none of its own.
const KHIPU = { pitch: 22, knot: 2.4, top: 6, gap: 4, tens: 3, turns: 9 };
export function khipu(numbers) {
  const { pitch, knot, top, gap } = KHIPU, step = knot * 2.1, turn = knot * 1.6;
  const tensAt = top + gap + (KHIPU.tens - 1) * step / 2 + knot;
  const unitsAt = tensAt + (KHIPU.tens - 1) * step / 2 + knot + gap;
  const width = (numbers.length + 1) * pitch, height = unitsAt + KHIPU.turns * turn + gap;
  let out = `<line class="cord" x1="0" y1="${top}" x2="${width}" y2="${top}" stroke="currentColor" stroke-width="2"/>`;
  numbers.forEach((n, i) => {
    const x = (i + 1) * pitch;
    out += `<line class="cord" x1="${x}" y1="${top}" x2="${x}" y2="${height - 2}" stroke="currentColor" stroke-width="1.2"/>`;
    if (!Number.isFinite(n) || n < 0) return;
    const d = Math.floor(n / 10);
    for (let k = 0; k < d; k++) out += `<circle class="knot" cx="${x}" cy="${tensAt + (k - (d - 1) / 2) * step}" r="${knot}"/>`;
    const u = n % 10;
    if (u === 1) out += `<circle class="knot" cx="${x}" cy="${unitsAt + knot * 0.9}" r="${knot * 0.9}"/><circle class="knot" cx="${x}" cy="${unitsAt + knot * 2.7}" r="${knot * 0.9}"/>`;
    else if (u > 1) out += `<rect class="knot" x="${x - knot}" y="${unitsAt}" width="${knot * 2}" height="${u * turn}" rx="${knot}"/>` + Array.from({ length: u }, (_, k) => `<line x1="${x - knot}" y1="${unitsAt + (k + 0.5) * turn}" x2="${x + knot}" y2="${unitsAt + (k + 0.1) * turn}" stroke="currentColor" stroke-width="0.6"/>`).join('');
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${out}</svg>`;
}

// Each kind a theme can name.
export const ORNAMENTS = { coursing, tocapu, star, jali, fret };
