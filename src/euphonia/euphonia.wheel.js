// The Wheel, as the book draws it (The Setting, The Plenum; The Classes,
// Introduction and the Revelator): Earth at the centre in the spheres of the
// elements, the seven planetary spheres, the Fixed Stars and the Empyrean;
// Good up and Evil down, the height, and Law and Chaos to either side, the
// bearing. The books leave Law's side open; it is on the left, as the
// Setting's table reads its "ordered" column first (Scott, 2026-11-12).
// Pure, so the gate can hold it to the export.
import { CHALDEAN, PLANETS } from '../bench/bench.text.js';
import { plain } from './euphonia.markdown.js';

// Bearings in degrees, counterclockwise from the right, with Good at the top.
export const AXES = { Chaos: 0, Good: 90, Law: 180, Evil: 270 };
// "X and Y" lies halfway between two axes, and "X, toward Y" a quarter of the
// way from X to Y: the ring in sixteenths, with the nine alignments on it.
const TOWARD = 1 / 4;
// The step between places on the ring, a quarter of the way between axes.
export const SIXTEENTH = (AXES.Good - AXES.Chaos) * TOWARD;
const RAD = Math.PI / 180;
const CENTRE = 'Neutral, the center';

// The spheres from the earth outward: the elements past earth and water,
// which are the globe, fire's just below the Moon; then the planets, slowest
// outermost, so the Chaldean order reversed; then the Fixed Stars and the
// Empyrean.
export const SPHERES = ['Air', 'Fire', ...CHALDEAN.toReversed().map(p => PLANETS[p].name.replace(/^the /, '')), 'Fixed Stars', 'Empyrean'];

// Where the Wheel files a plane: a bearing in degrees, 'centre', or null for
// the planes beside, above or within the world, which have no place on it.
export function bearing(filed) {
  if (filed === CENTRE) return 'centre';
  let m = /^(\w+) and (\w+)$/.exec(filed);
  if (m && m[1] in AXES && m[2] in AXES) return between(AXES[m[1]], AXES[m[2]], 1 / 2);
  m = /^(\w+), toward (\w+)$/.exec(filed);
  if (m && m[1] in AXES && m[2] in AXES) return between(AXES[m[1]], AXES[m[2]], TOWARD);
  if (filed in AXES) return AXES[filed];
  return null;
}
// From a toward b by a share of the shorter way round.
function between(a, b, share) {
  const d = ((b - a + 540) % 360) - 180;
  return (a + d * share + 360) % 360;
}

// The realms on the Wheel, and the Revelator's roads through them. A road runs
// through every plane its pathway's opening names or its features grant: round
// the Wheel the short way between the ones on its ring, and through the centre
// where the Middle World is one of them. It rises in the first plane its
// opening names ("The Oceanus rises in Elysium…") and runs from there.
export function wheelOf(wheel, classes) {
  const realms = wheel.planes.map(p => ({ name: plain(p.name), at: bearing(p.filed) })).filter(p => p.at !== null);
  // Where a text first names a realm, by its name without the article, or -1.
  const mention = (text, name) => text.search(new RegExp(`(?<![\\p{L}])${name.replace(/^The /, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'iu'));
  const revelator = classes.find(c => c.name === 'Revelator');
  const roads = (revelator?.subclasses ?? []).map(s => {
    const text = [plain(s.lead), ...s.features.map(f => f.name)].join('\n');
    const through = realms.filter(r => mention(text, r.name) >= 0);
    const ring = through.filter(r => r.at !== 'centre').map(r => r.at).sort((a, b) => a - b);
    // The shortest arc holding them all starts after the widest gap between
    // neighbours round the ring.
    let from = ring[0], span = 0;
    if (ring.length > 1) {
      const gaps = ring.map((a, i) => ((ring[(i + 1) % ring.length] - a) + 360) % 360 || 360);
      const widest = gaps.indexOf(Math.max(...gaps));
      from = ring[(widest + 1) % ring.length];
      span = 360 - gaps[widest];
    }
    // Where its opening names none, its course can't be read: rises is null
    // and the map gate stops the build, rather than draw a road the book
    // doesn't give.
    const lead = plain(s.lead), at = r => { const i = mention(lead, r.name); return i < 0 ? Infinity : i; };
    const first = through.reduce((a, r) => (at(r) < at(a) ? r : a), through[0]);
    const rises = first && at(first) < Infinity ? first.name : null;
    return { name: s.name, through: through.map(r => r.name), from, span, centre: through.some(r => r.at === 'centre'), rises };
  });
  return { realms, roads };
}

// Where the planets stand on their spheres at an instant, as geocentric
// ecliptic longitudes in degrees: the Sun's and Moon's from the site's own
// sky (the Sun's apparent longitude; the Moon east of it by its elongation
// while waxing, west while waning, the elongation read from its lit
// fraction), the others seen from the earth, each on its Keplerian ellipse
// in the ecliptic's plane from its J2000 mean elements (Meeus, Astronomical
// Algorithms, tables 31.A–B): good to about a degree over the centuries,
// with the inner planets swinging about the Sun and the outer ones turning
// back at opposition.
const ORBITS = {
  mercury: { a: 0.387098, e: 0.205632, peri: 77.456119,  L0: 252.250906, n: 149472.6746358 },
  venus:   { a: 0.723330, e: 0.006772, peri: 131.563703, L0: 181.979801, n: 58517.8156760 },
  earth:   { a: 1.000001, e: 0.016709, peri: 102.937348, L0: 100.466457, n: 35999.3728565 },
  mars:    { a: 1.523679, e: 0.093401, peri: 336.060234, L0: 355.433000, n: 19140.2993039 },
  jupiter: { a: 5.202603, e: 0.048498, peri: 14.331309,  L0: 34.351519,  n: 3034.9056606 },
  saturn:  { a: 9.554909, e: 0.055546, peri: 93.056787,  L0: 50.077444,  n: 1222.1137943 },
};
const JD_UNIX = 2440587.5, JD_J2000 = 2451545, DAYS_PER_CENTURY = 36525, MS_PER_DAY = 86400000;
// Kepler's equation by Newton's method: a handful of steps for these orbits.
const KEPLER_STEPS = 8;
export function planetsAt(ms, sunLongitude, moon) {
  const T = (ms / MS_PER_DAY + JD_UNIX - JD_J2000) / DAYS_PER_CENTURY;
  const helio = ({ a, e, peri, L0, n }) => {
    const M = (L0 + n * T - peri) * RAD;
    let E = M;
    for (let i = 0; i < KEPLER_STEPS; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    const x = a * (Math.cos(E) - e), y = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const w = peri * RAD;
    return [x * Math.cos(w) - y * Math.sin(w), x * Math.sin(w) + y * Math.cos(w)];
  };
  const [ex, ey] = helio(ORBITS.earth);
  const seen = body => { const [x, y] = helio(ORBITS[body]); return ((Math.atan2(y - ey, x - ex) / RAD) + 360) % 360; };
  const elongation = 180 - Math.acos(2 * moon.lit - 1) / RAD;
  const at = { sun: sunLongitude, moon: (sunLongitude + (moon.waxing ? elongation : -elongation) + 360) % 360 };
  for (const p of ['mercury', 'venus', 'mars', 'jupiter', 'saturn']) at[p] = seen(p);
  return at;
}
