// The workbench's system. Two kinds of fact live here and they are kept apart:
// what a source says, and what was authored for this site, which is marked as
// authored wherever it appears.

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

// Sigils. The symbol, its Unicode code point and its Unicode name are sourced;
// verify-bench checks the name against unicode-alchemy.txt. Which scene carries
// which sigil is an assignment authored for this site, not a tradition's, and
// `why` is the reason given when it was made.
export const SIGIL_AUTHORSHIP = 'authored for this site, not a traditional correspondence';

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

// Scene -> sigil, and why. Authored for this site.
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
