import { readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { THEMES, CONTRAST, GLOBE } from '../src/euphonia/euphonia.themes.js';
import { placesData } from './verify-euphonia-map.mjs';

const ROOT = new URL('../', import.meta.url);
const read = rel => readFileSync(new URL(rel, ROOT), 'utf8');

// A theme's colour as linear-light luminance, composited over the ground when
// it has alpha. Tokens are #rgb, #rrggbb or rgb()/rgba(), which the gate reads.
const channels = c => {
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (m) { const h = m[1].length === 3 ? [...m[1]].map(x => x + x).join('') : m[1]; return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).concat(1); }
  m = /^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)$/.exec(c);
  return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null;
};
const over = ([r, g, b, a], [R, G, B]) => [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a)];
const luminance = rgb => { const c = rgb.map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
export const contrast = (fg, bg, ground) => { const [x, y] = [luminance(over(fg, over(bg, ground))), luminance(over(bg, ground))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// Colour literals: hex, functional notation with numbers, and CSS's named
// colours (CSS Color 4, section 6.1), as values.
const NAMED = 'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'.split(' ');
const LITERAL = new RegExp(`#[0-9a-f]{3,8}\\b|\\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\\(\\s*[\\d.]|(?<![\\w-])(?:${NAMED.join('|')})(?![\\w-])`, 'i');

// Where the page's colours may come from: the theme data alone. The ribbons'
// fade is a mask, whose black and transparent are opacities, not colours.
const SOURCES = ['styles/euphonia.css', 'scripts/euphonia-page.js', 'euphonia/index.html', ...readdirSync(new URL('src/euphonia/', ROOT)).filter(f => f.endsWith('.js') && f !== 'euphonia.themes.js').map(f => `src/euphonia/${f}`)];
const EXEMPT = /^\s*mask-image:/;

export function verifyEuphoniaThemes({ themes = THEMES, sources = SOURCES } = {}) {
  const errors = [], measured = [];
  // Colours only in the theme data.
  for (const file of sources) {
    const text = read(file).replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"])\/\/[^\n]*/g, (m, a) => a + m.slice(a.length).replace(/./g, ' '));
    // In a script a colour can only be a string; in the stylesheet and the
    // page, anything but a character reference (&#215;) may be one.
    const script = file.endsWith('.js');
    text.split('\n').forEach((line, i) => {
      if (EXEMPT.test(line)) return;
      const where = script ? [...line.matchAll(/'[^']*'|"[^"]*"|`[^`]*`/g)].map(m => m[0]).join(' ') : line.replace(/&#x?[0-9a-f]+;/gi, '');
      const m = LITERAL.exec(where);
      if (m) errors.push(`${file}:${i + 1}: a colour outside the themes (${m[0]})`);
    });
  }
  // One stance for every theme's globe, north up.
  if (!(GLOBE?.setting > 0 && GLOBE.setting <= 90) || !GLOBE.why) errors.push('the themes need one globe setting, north up (0 to 90), and why');
  // Every theme: whole, readable, and sourced.
  const keys = Object.keys(themes[0].tokens);
  for (const t of themes) {
    for (const k of keys) if (!(k in t.tokens)) errors.push(`${t.id}: no ${k}`);
    for (const [k, v] of Object.entries(t.tokens)) if (!channels(v)) errors.push(`${t.id}: ${k} is "${v}", not a colour the gate can read`);
    const ground = channels(t.tokens.ground);
    for (const { fg, bg, need } of CONTRAST) {
      const [f, b] = [channels(t.tokens[fg]), channels(t.tokens[bg])];
      if (!f || !b) continue;
      const r = contrast(f, b, ground);
      measured.push({ theme: t.id, fg, bg, ratio: +r.toFixed(2), need });
      if (r < need) errors.push(`${t.id}: ${fg} on ${bg} is ${r.toFixed(2)} to 1, under ${need}`);
    }
    // The globe's home: a place the book names, or a turn in degrees.
    const named = t.home?.place && placesData().regions.some(r => r.places.some(p => p.name === t.home.place));
    if (!t.home?.why || !(named || Number.isFinite(t.home?.lon0))) errors.push(`${t.id}: its home must name a place the book places, or give lon0, and say why`);
    if (!t.provenance?.length) errors.push(`${t.id}: no provenance; name the objects its colours and motifs come from`);
    // Each entry names what it gives and where it comes from: a real object or
    // text with a source to check it by, or, honestly, who authored it.
    for (const p of t.provenance ?? []) {
      const sourced = p.source?.title && /^https:\/\//.test(p.source?.url ?? '');
      if (!p.what || !p.from || (!sourced && !p.authored)) errors.push(`${t.id}: provenance entry "${p.what ?? '?'}" needs what, from, and either a source (a title and an https address) or who authored it`);
    }
  }
  errors.forEach(e => console.error(`  ✗ verify-euphonia-themes: ${e}`));
  return { failures: errors.length, themes: themes.length, pairs: measured.length / themes.length, measured };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = verifyEuphoniaThemes();
  if (process.argv.includes('--table')) console.table(r.measured);
  process.exit(r.failures ? 1 : 0);
}
