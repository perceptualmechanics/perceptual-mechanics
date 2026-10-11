// The workbench's system. Two kinds of fact live here and they are kept apart:
// what a source says, transcribed and then derived from, and what Scott
// assigned, which is marked as his wherever it appears.

// The seven classical planets in Chaldean order, slowest apparent motion first.
export const CHALDEAN = ['saturn', 'jupiter', 'mars', 'sun', 'venus', 'mercury', 'moon'];

// Typed as the week reads, Sunday first, so verify-bench can hold it against
// the order above: a day is ruled by the planet of its first hour, a day has 24
// hours, and 24 mod 7 = 3.
export const WEEKDAY_RULERS = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn'];

export const HOURS_PER_DAY = 24;

export const PLANETS = {
  saturn:  { name: 'Saturn',  metal: 'lead' },
  jupiter: { name: 'Jupiter', metal: 'tin' },
  mars:    { name: 'Mars',    metal: 'iron' },
  sun:     { name: 'the Sun', metal: 'gold' },
  venus:   { name: 'Venus',   metal: 'copper' },
  mercury: { name: 'Mercury', metal: 'quicksilver' },
  moon:    { name: 'the Moon', metal: 'silver' },
};

// George Ripley, The Compound of Alchymy, the Preface, as printed in Elias
// Ashmole, Theatrum Chemicum Britannicum (London, 1652), pp. 127-128. Read off
// the page images of the Internet Archive scan, leaves 150-151. Long s is set as
// s; spelling and punctuation are otherwise as printed. The words the printer
// set in italic are wrapped in asterisks, because the gates are those words.
export const RIPLEY = {
  edition: 'Elias Ashmole, Theatrum Chemicum Britannicum (London, 1652)',
  work: 'George Ripley, The Compound of Alchymy',
  url: 'https://archive.org/details/theatrumchemicum00ashm',
  division: {
    page: 127,
    lines: [
      'But into Chapters thys Treatis I shall devyde,',
      'In number Twelve with dew Recapytulatyon;',
    ],
  },
  order: {
    page: 128,
    lines: [
      'The Fyrst Chapter shalbe of naturall *Calcination*;',
      'The Second of *Dyssolution* secret and Phylosophycall;',
      'The Thyrd of our Elementall *Separation*;',
      'The Fourth of *Conjunction* matrymonyall;',
      'The Fyfthe of *Putrefaction* then followe shall;',
      'Of *Congelatyon*, albyfycative shall be the Syxt,',
      'Then of *Cybatyon* the Seaventh shall follow next.',
      'The secret of our *Sublymation* the eyght shall shew;',
      'The nynth shall be of *Fermentation*,',
      'The Tenth of our *Exaltation* I trow;',
      'The Eleventh of our mervelose *Multyplycatyon*;',
      'The Twelfth of *Projectyon*; then *Recapytulatyon*;',
      'And so thys Treatyse shall take an end,',
      'By the help of God as I entend.',
    ],
  },
};

// Ripley's own number words, in his spellings. The gate reads the stanza with
// these and nothing else.
export const RIPLEY_NUMBERS = {
  fyrst: 1, second: 2, thyrd: 3, fourth: 4, fyfthe: 5, syxt: 6,
  seaventh: 7, eyght: 8, nynth: 9, tenth: 10, eleventh: 11, twelfth: 12,
  twelve: 12,
};

const ITALIC = /\*([^*]+)\*/g;

// Ripley's 1652 spellings differ from the modern ones by y for i and nothing
// else, across all twelve.
export const modernSpelling = word => word.replace(/y/g, 'i');

// One gate per line that carries an ordinal; on that line the gate is the first
// italic word. "then Recapytulatyon" shares the twelfth line and has no
// ordinal of its own, which is how Ripley keeps it outside the twelve.
export function parseGates(lines = RIPLEY.order.lines) {
  const gates = [];
  for (const line of lines) {
    const words = line.toLowerCase().match(/[a-z]+/g) ?? [];
    const ordinals = words.filter(w => Object.hasOwn(RIPLEY_NUMBERS, w) && w !== 'twelve');
    if (ordinals.length === 0) continue;
    if (ordinals.length > 1) throw new Error(`Ripley: "${line}" carries two ordinals`);
    const italics = [...line.matchAll(ITALIC)].map(m => m[1]);
    if (!italics.length) throw new Error(`Ripley: "${line}" names no operation`);
    gates.push({ n: RIPLEY_NUMBERS[ordinals[0]], spelling: italics[0], name: modernSpelling(italics[0]) });
  }
  return gates.sort((a, b) => a.n - b.n);
}

// The number of chapters Ripley says he divides the work into, read from p. 127.
export function statedGateCount(lines = RIPLEY.division.lines) {
  for (const line of lines) {
    const m = line.toLowerCase().match(/in number (\w+)/);
    if (m && Object.hasOwn(RIPLEY_NUMBERS, m[1])) return RIPLEY_NUMBERS[m[1]];
  }
  return null;
}

// Sigils. The symbol, its Unicode code point and its Unicode name are sourced;
// verify-bench checks the name against unicode-alchemy.txt. Which scene carries
// which sigil is Scott's assignment, not a tradition's, and `why` is his reason.
export const SIGIL_AUTHORSHIP = "Scott's assignment, not a traditional correspondence";

export const SIGILS = {
  sun:          { cp: 0x2609,  unicode: 'SUN',                                planet: 'sun' },
  moon:         { cp: 0x263D,  unicode: 'FIRST QUARTER MOON',                 planet: 'moon' },
  mercury:      { cp: 0x263F,  unicode: 'MERCURY',                            planet: 'mercury' },
  venus:        { cp: 0x2640,  unicode: 'FEMALE SIGN',                        planet: 'venus' },
  mars:         { cp: 0x2642,  unicode: 'MALE SIGN',                          planet: 'mars' },
  jupiter:      { cp: 0x2643,  unicode: 'JUPITER',                            planet: 'jupiter' },
  saturn:       { cp: 0x2644,  unicode: 'SATURN',                             planet: 'saturn' },
  quintessence: { cp: 0x1F700, unicode: 'ALCHEMICAL SYMBOL FOR QUINTESSENCE', name: 'quintessence' },
  air:          { cp: 0x1F701, unicode: 'ALCHEMICAL SYMBOL FOR AIR',          name: 'air' },
  fire:         { cp: 0x1F702, unicode: 'ALCHEMICAL SYMBOL FOR FIRE',         name: 'fire' },
  earth:        { cp: 0x1F703, unicode: 'ALCHEMICAL SYMBOL FOR EARTH',        name: 'earth' },
  water:        { cp: 0x1F704, unicode: 'ALCHEMICAL SYMBOL FOR WATER',        name: 'water' },
  sulfur:       { cp: 0x1F70D, unicode: 'ALCHEMICAL SYMBOL FOR SULFUR',       name: 'sulphur' },
  salt:         { cp: 0x1F714, unicode: 'ALCHEMICAL SYMBOL FOR SALT',         name: 'salt' },
};

// Scene -> sigil, and why. Scott's assignment.
export const ASSIGNMENTS = {
  sphere:    { sigil: 'quintessence', why: 'In Aristotle the celestial spheres are made of the fifth element.' },
  scroll:    { sigil: 'fire',         why: 'Its burned and flame-lit edges.' },
  orrery:    { sigil: 'sun',          why: 'The Sun sits at its centre.' },
  orbiter:   { sigil: 'jupiter',      why: 'A nucleus with satellites, as Jupiter has its moons.' },
  butterfly: { sigil: 'air',          why: "Lorenz's equations are a model of convection in the atmosphere." },
  library:   { sigil: 'saturn',       why: "Saturn's slowness, the scholar's planet, and lead type." },
  harmonics: { sigil: 'venus',        why: 'Attraction: it draws what pulls the pieces toward each other.' },
  beamline:  { sigil: 'water',        why: 'Reflection, and water was the first mirror.' },
  theater:   { sigil: 'sulfur',       why: 'Sulphur is the soul and the passions, the principle that performs.' },
  outside:   { sigil: 'earth',        why: 'The bloom, and what grows.' },
  apollo:    { sigil: 'mars',         why: "Iron's lines in sunlight are one of its strikes." },
  psyshell:  { sigil: 'salt',         why: 'Crystal and residue; salt is what calcination leaves behind.' },
  medium:    { sigil: 'mercury',      why: 'The messenger, and the planchette that carries the words.' },
  quiz:      { sigil: 'moon',         why: "Yeats's Wheel is the twenty-eight phases of the moon." },
};

export const sceneOfPlanet = Object.fromEntries(
  Object.entries(ASSIGNMENTS)
    .filter(([, a]) => SIGILS[a.sigil].planet)
    .map(([scene, a]) => [SIGILS[a.sigil].planet, scene]),
);

// The line the landing shows. A pure function of the planet and of where the
// hours were reckoned from, so verify-bench can check every rendering.
export function hourLine(planet, provenance) {
  const p = PLANETS[planet];
  if (!p) throw new Error(`hourLine: no planet "${planet}"`);
  const by = {
    sky: 'by your sky',
    zone: `by the sky over ${provenance.city}`,
    equal: 'by equal hours',
    polar: 'by equal hours, the sun not rising or not setting here today',
  }[provenance.kind];
  if (!by) throw new Error(`hourLine: no provenance "${provenance.kind}"`);
  if (provenance.kind === 'zone' && !provenance.city) throw new Error('hourLine: a zone needs its city');
  return `the hour of ${p.name} · ${p.metal} — ${by}`;
}
