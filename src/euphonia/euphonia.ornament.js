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

// Each kind a theme can name.
export const ORNAMENTS = { coursing };
