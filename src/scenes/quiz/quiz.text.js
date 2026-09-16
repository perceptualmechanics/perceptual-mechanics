const WRAP = 28;
const wrap = (n) => ((Math.round(n) - 1) % WRAP + WRAP) % WRAP + 1;
export const maskPhase = (n) => wrap(n + 14);
export const creativeMindPhase = (n) => wrap(30 - n);
export const bodyOfFatePhase = (n) => wrap(16 - n);

export const QUARTERS = [
  { n: 1, name: 'First Quarter',  element: 'Earth', dominant: 'Will',          phases: [2, 3, 4, 5, 6, 7] },
  { n: 2, name: 'Second Quarter', element: 'Water', dominant: 'Mask',          phases: [9, 10, 11, 12, 13, 14] },
  { n: 3, name: 'Third Quarter',  element: 'Air',   dominant: 'Creative Mind', phases: [16, 17, 18, 19, 20, 21] },
  { n: 4, name: 'Fourth Quarter', element: 'Fire',  dominant: 'Body of Fate',  phases: [23, 24, 25, 26, 27, 28] },
];
export const CARDINAL = [1, 8, 15, 22];
export const quarterOf = (n) => QUARTERS.find(q => q.phases.includes(n)) ?? null;

export const TRIAD_ROLES = ['power', 'code', 'belief'];
export function triadOf(n) {
  const q = quarterOf(n);
  if (!q) return null;
  const i = q.phases.indexOf(n);
  return { set: i < 3 ? 1 : 2, role: TRIAD_ROLES[i % 3], phases: q.phases.slice(i < 3 ? 0 : 3, i < 3 ? 3 : 6) };
}

export function tinctureOf(n) {
  if (n === 1) return 'wholly primary';
  if (n === 15) return 'wholly antithetical';
  if (n === 8 || n === 22) return 'the crossing';
  return (n > 8 && n < 22) ? 'antithetical' : 'primary';
}

export const PHASES = [
  { n: 1,  will: 'No description except complete plasticity',
    mask: null, cm: null, bf: null,
    symbol: 'A figure climbing a pine to take hold of the stars.',
    who: [], attributed: [] },
  { n: 2,  will: 'Beginning of energy',
    mask: { t: 'Player on Pan’s Pipes', f: 'Fury' },
    cm:   { t: 'Hope', f: 'Moroseness' },
    bf:   'None except monotony',
    symbol: 'a white bird flying with entranced limp leopard in beak — bird not 1/6 of leopard in size',
    who: [], attributed: [] },
  { n: 3,  will: 'Beginning of ambition',
    mask: { t: 'Innocence', f: 'Folly' },
    cm:   { t: 'Simplicity', f: 'Abstraction' },
    bf:   'Interest',
    symbol: 'Eagle over sea with one foot caught in back of sea lion one foot caught by Dolphin. Eagle drags both',
    who: ['Morris’s Birdalone', 'many pastoral types'], attributed: [] },
  { n: 4,  will: 'Desire for exterior world',
    mask: { t: 'Passion', f: 'Will' },
    cm:   { t: 'First perception of character', f: 'Mutilation' },
    bf:   'Search',
    symbol: 'figure climbing pine to grasp stars',
    who: [], attributed: [] },
  { n: 5,  will: 'Separation from innocence',
    mask: { t: 'Excess', f: 'Limitation' },
    cm:   { t: 'Social intellect', f: 'Limitation' },
    bf:   'Natural law',
    symbol: 'A man forging a chain, or fastening one onto somebody else.',
    who: ['Byron’s Don Juan', 'Byron’s Giaour'], attributed: [] },
  { n: 6,  will: 'Artificial individuality',
    mask: { t: 'Justice', f: 'Tyranny' },
    cm:   { t: 'Ideality', f: 'Derision' },
    bf:   'Humanity',
    symbol: 'A man driving nails into an idol.',
    who: ['Walt Whitman'], attributed: [] },
  { n: 7,  will: 'Assertion of Individuality',
    mask: { t: 'Altruism', f: 'Efficiency' },
    cm:   { t: 'Heroic sentiment', f: 'Dogmatic sentimentality' },
    bf:   'Adventure that excites the individuality',
    symbol: 'A satyr, goat-legged, following its own image or mask.',
    who: ['George Borrow', 'Alexandre Dumas', 'Thomas Carlyle', 'James Macpherson'], attributed: [] },
  { n: 8,  will: 'War between individuality and race',
    mask: { t: 'Courage', f: 'Fear' },
    cm:   { t: 'Versatility', f: 'Impotence' },
    bf:   'The beginning of strength',
    symbol: 'A man stretched across an abyss, his hands in the beak of a bird of prey and his feet in the mouth of a bear, with water below.',
    who: [], attributed: [] },
  { n: 9,  will: 'Belief instead of individuality',
    mask: { t: 'Facility', f: 'Obscurity' },
    cm:   { t: 'Self-dramatisation', f: 'Anarchy' },
    bf:   'Enforced sensuality',
    symbol: 'A leopard, with an eagle on its head plucking out its eyes.',
    who: [], attributed: ['Wyndham Lewis'] },
  { n: 10, will: 'The image-breaker',
    mask: { t: 'Organisation', f: 'Inertia' },
    cm:   { t: 'Domination through emotional construction', f: 'Reformation' },
    bf:   'Enforced emotion',
    symbol: 'A man whose mouth has been forced open and his tongue torn out.',
    who: ['Parnell'], attributed: [] },
  { n: 11, will: 'The consumer, pyre-builder',
    mask: { t: 'Rejection', f: 'Moral indifference' },
    cm:   { t: 'Moral iconoclasm', f: 'Self-assertion' },
    bf:   'Enforced belief',
    symbol: 'A sword cleaving a skull.',
    who: ['Spinoza', 'Savonarola'], attributed: [] },
  { n: 12, will: 'The forerunner',
    mask: { t: 'Self-exaggeration', f: 'Self-abandonment' },
    cm:   { t: 'Subjective philosophy', f: 'War between two forms of expression' },
    bf:   'Enforced intellectual action',
    symbol: 'A sword cutting a hand in two.',
    who: ['Nietzsche'], attributed: [] },
  { n: 13, will: 'The sensuous man',
    mask: { t: 'Self-expression', f: 'Self-absorption' },
    cm:   { t: 'Subjective truth', f: 'Morbidity' },
    bf:   'Enforced love of another',
    symbol: 'A man hanging over a pool.',
    who: ['Baudelaire', 'Beardsley', 'Ernest Dowson'], attributed: [] },
  { n: 14, will: 'The obsessed man',
    mask: { t: 'Serenity', f: 'Self-distrust' },
    cm:   { t: 'Emotional will', f: 'Terror' },
    bf:   'Enforced love of the world',
    symbol: 'A leopard in mid-spring.',
    who: [], attributed: [] },
  { n: 15, will: 'No description except that this is a phase of complete beauty',
    mask: null, cm: null, bf: null,
    symbol: 'A man holding an arrow in one hand and a stone in the other.',
    who: [], attributed: [] },
  { n: 16, will: 'The positive man',
    mask: { t: 'Illusion', f: 'Delusion' },
    cm:   { t: 'Vehemence', f: 'Opinionated will' },
    bf:   'Enforced illusion',
    symbol: 'A dark circle, and a hand.',
    who: ['William Blake', 'Rabelais', 'Aretino', 'Paracelsus', 'some beautiful women'],
    attributed: ['Maud Gonne'] },
  { n: 17, will: 'The Daimonic man',
    mask: { t: 'Simplification through intensity', f: 'Dispersal' },
    cm:   { t: 'Creative imagination through antithetical emotion', f: 'Enforced self-realization' },
    bf:   'Enforced loss',
    symbol: 'A crystal arrow and a crescent.',
    who: ['Dante', 'Shelley', 'Landor'], attributed: ['W. B. Yeats'] },
  { n: 18, will: 'The emotional man',
    mask: { t: 'Intensity through emotions', f: 'Curiosity' },
    cm:   { t: 'Emotional philosophy', f: 'Enforced lure' },
    bf:   'Enforced disillusionment',
    symbol: 'A two-faced figure.',
    who: ['Goethe', 'Matthew Arnold'], attributed: ['George Yeats'] },
  { n: 19, will: 'The assertive man',
    mask: { t: 'Conviction', f: 'Domination' },
    cm:   { t: 'Emotional intellect', f: 'The Unfaithful' },
    bf:   'Enforced failure of action',
    symbol: 'A wolf.',
    who: ['Oscar Wilde', 'Byron', 'Gabriele d’Annunzio (perhaps)'],
    attributed: ['Mrs Patrick Campbell'] },
  { n: 20, will: 'The concrete man',
    mask: { t: 'Fatalism', f: 'Superstition' },
    cm:   { t: 'Dramatisation of Mask', f: 'Self-desecration' },
    bf:   'Enforced success of action',
    symbol: 'A white bird torn in half between a wolf and a leopard.',
    who: ['Shakespeare', 'Balzac', 'Napoleon'], attributed: [] },
  { n: 21, will: 'The acquisitive man',
    mask: { t: 'Self-analysis', f: 'Self-adaptation' },
    cm:   { t: 'Domination of the intellect', f: 'Distortion' },
    bf:   'Enforced triumph of achievement',
    symbol: 'A man and a statue.',
    who: ['Lamarck', 'George Bernard Shaw', 'H. G. Wells', 'George Moore', 'Jacques Louis David'],
    attributed: [] },
  { n: 22, will: 'Balance between ambition and contemplation',
    mask: { t: 'Self-immolation', f: 'Self-assurance' },
    cm:   { t: 'Amalgamation', f: 'Despair' },
    bf:   'Temptation through strength',
    symbol: 'A man beating himself with a flail.',
    who: [], attributed: [] },
  { n: 23, will: 'The Receptive Man',
    mask: { t: 'Wisdom', f: 'Self-pity' },
    cm:   { t: 'Creation through pity', f: 'Self-driven desire' },
    bf:   'Success',
    symbol: 'A blindfolded man balanced on the point of a pike, juggling.',
    who: ['Rembrandt', 'Synge'], attributed: [] },
  { n: 24, will: 'The end of ambition',
    mask: { t: 'Self-reliance', f: 'Isolation' },
    cm:   { t: 'Constructive emotion', f: 'Authority' },
    bf:   'Objective action',
    symbol: 'A woman, a cup, and a boar.',
    who: ['Queen Victoria', 'Galsworthy', 'Lady Gregory'], attributed: [] },
  { n: 25, will: 'The Conditional Man',
    mask: { t: 'Consciousness of self', f: 'Self-consciousness' },
    cm:   { t: 'Rhetoric', f: 'Spiritual arrogance' },
    bf:   'Persecution',
    symbol: 'A vast figure of a god, with a small human figure flickering before his face.',
    who: ['Cardinal Newman', 'Luther', 'Calvin', 'George Herbert', 'George Russell (AE)'],
    attributed: [] },
  { n: 26, will: 'The Multiple Man, also called “The Hunchback”',
    mask: { t: 'Self-realisation', f: 'Self-abandonment' },
    cm:   { t: 'Beginning of the abstract supersensual', f: 'Fascination of sin' },
    bf:   'The Hunchback is his own Body of Fate',
    symbol: 'A hunchback fighting his own shadow, on ground that bleeds.',
    who: [], attributed: [] },
  { n: 27, will: 'The Saint',
    mask: { t: 'Renunciation', f: 'Emulation' },
    cm:   { t: 'Supersensual receptivity', f: 'Pride' },
    bf:   'None except impersonal action',
    symbol: 'A figure — the word qualifying it is illegible in the manuscript.',
    who: ['Socrates', 'Pascal'], attributed: [] },
  { n: 28, will: 'The Fool',
    mask: { t: 'Oblivion', f: 'Malignity' },
    cm:   { t: 'Physical activity', f: 'Cunning' },
    bf:   'The Fool is his own Body of Fate',
    symbol: 'A shrunken, faceless man whirling a rattle.',
    who: [], attributed: [] },
];

export const PHASE_BY_N = Object.fromEntries(PHASES.map(p => [p.n, p]));


export const PREAMBLE = [
  'Sixteen questions. It takes about three minutes.',
  'Answer honestly rather than carefully. There are no better or worse answers here.',
];

export const SCALES = {
  will_mask: {
    key: 'will_mask',
    low: 'Will', high: 'Mask', question: 'the Is and the Ought',
  },
  mind_fate: {
    key: 'mind_fate',
    low: 'Creative Mind', high: 'Body of Fate', question: 'the Knower and the Known',
  },
};

export const ITEMS = [
  { id: 1,  scale: 'will_mask', key:  1, text: 'When I picture a better version of myself, it is quite different from how I am now.' },
  { id: 2,  scale: 'mind_fate', key: -1, text: 'I usually know why something upset me.' },
  { id: 3,  scale: 'will_mask', key: -1, text: 'I would rather be good at what I already do than start something I would be bad at.' },
  { id: 4,  scale: 'mind_fate', key:  1, text: 'Things happen to me that I could not have predicted.' },
  { id: 5,  scale: 'will_mask', key:  1, text: 'I hold myself to a standard I have not reached yet.' },
  { id: 6,  scale: 'mind_fate', key: -1, text: 'When something goes wrong I can generally trace how it happened.' },
  { id: 7,  scale: 'will_mask', key: -1, text: 'I am fairly settled about the sort of person I am.' },
  { id: 8,  scale: 'mind_fate', key:  1, text: 'I often find out what I think about something only after it has happened.' },
  { id: 9,  scale: 'will_mask', key:  1, text: 'Most of what I am working on is preparation for something I have not done.' },
  { id: 10, scale: 'mind_fate', key: -1, text: 'I can explain most of my own reactions.' },
  { id: 11, scale: 'will_mask', key: -1, text: 'When I imagine a better version of myself, it is recognisably me.' },
  { id: 12, scale: 'mind_fate', key:  1, text: 'The turns my life has taken were mostly not up to me.' },
  { id: 13, scale: 'will_mask', key:  1, text: 'I would rather aim at something I am not good at yet than do more of what I already do well.' },
  { id: 14, scale: 'mind_fate', key: -1, text: 'I work out what a situation means before I decide what to do about it.' },
  { id: 15, scale: 'will_mask', key: -1, text: 'I make plans that fit who I already am rather than who I would like to be.' },
  { id: 16, scale: 'mind_fate', key:  1, text: 'I learn what matters to me from what happens rather than from thinking it through.' },
];

export const CHOICES = [
  { value: -2, label: 'Strongly disagree' },
  { value: -1, label: 'Disagree' },
  { value:  0, label: 'Neither' },
  { value:  1, label: 'Agree' },
  { value:  2, label: 'Strongly agree' },
];

const ITEMS_PER_SCALE = ITEMS.filter(i => i.scale === 'will_mask').length;
const MAX_ABS = ITEMS_PER_SCALE * 2;   // eight items at ±2

const QUARTER_OPENS = { 1: 1, 2: 8, 3: 15, 4: 22 };
const UNINHABITABLE = { 1: 2, 15: 16 };

export function place(willMask, mindFate) {
  const wm = Math.max(-1, Math.min(1, willMask));
  const mf = Math.max(-1, Math.min(1, mindFate));
  if (wm === 0 && mf === 0) {
    return { raw: 22, n: 22, displaced: false, quarter: null, dominant: null };
  }
  const wmRules = Math.abs(wm) >= Math.abs(mf);
  const ruling = wmRules ? wm : mf;
  const other = wmRules ? mf : wm;
  const q = wmRules ? (ruling < 0 ? 1 : 2) : (ruling < 0 ? 3 : 4);
  const slots = [QUARTER_OPENS[q], ...QUARTERS[q - 1].phases];
  const raw = slots[Math.round(((other + 1) / 2) * 6)];
  return {
    raw,
    n: UNINHABITABLE[raw] ?? raw,
    displaced: raw in UNINHABITABLE,
    quarter: q,
    dominant: wmRules ? (ruling < 0 ? 'Will' : 'Mask') : (ruling < 0 ? 'Creative Mind' : 'Body of Fate'),
  };
}

export function score(responses) {
  const sum = (scale) => ITEMS
    .filter(i => i.scale === scale)
    .reduce((a, i) => a + (responses?.[i.id] ?? 0) * i.key, 0);
  const willMask = sum('will_mask') / MAX_ABS;
  const mindFate = sum('mind_fate') / MAX_ABS;
  const p = place(willMask, mindFate);
  return { willMask, mindFate, ...p, phase: PHASE_BY_N[p.n] };
}

export const REACHABLE = PHASES.filter(p => p.n !== 1 && p.n !== 15).map(p => p.n);

const T = (s) => ({ t: 'text', s: String(s) });
const B = (s) => ({ t: 'strong', s: String(s) });

export function report(result, { shared = false, origin = '' } = {}) {
  const n = result.n;
  const p = PHASE_BY_N[n];
  const q = quarterOf(n);
  const tri = triadOf(n);
  const mn = maskPhase(n), cn = creativeMindPhase(n), bn = bodyOfFatePhase(n);
  const rows = [];
  const row = (label, ...segs) => rows.push({ label, segs });

  row('Number', B(n), T(' of 28'));
  if (q) row('Quarter', B(q.name), T(' \u00a0 element ' + q.element + ' \u00a0 ' + q.dominant + ' dominates'));
  else row('Quarter', B('None'), T(' — a phase of crisis, on the boundary between quarters'));
  if (tri) row('Triad', T('the '), B(tri.role), T(` of the ${tri.set === 1 ? 'first' : 'second'} triad — phases ${tri.phases.join(', ')}`));
  else row('Triad', B('None'), T(' — outside the quarters that the triads divide'));
  row('Tincture', B(tinctureOf(n)));

  const faculty = (label, from, spec, bare) => {
    const segs = [T(`drawn from phase ${from}, ${PHASE_BY_N[from].will}`)];
    if (spec) segs.push(T(' \u00a0\u00b7\u00a0 '), B(bare ? spec : spec.t));
    row(label, ...segs);
  };
  faculty('Will', n, null);
  faculty('Mask', mn, p.mask);
  faculty('Creative Mind', cn, p.cm);
  faculty('Body of Fate', bn, p.bf, true);

  const corners = [...new Set([n, mn, cn, bn])].sort((a, b) => a - b);
  if (corners.length < 4) {
    row('The rectangle', B('Collapsed'), T(` — the four Faculties fall on ${corners.join(' and ')} rather than on four phases`));
  }
  if (p.mask && p.cm) row('The failure', B(p.mask.f), T(', and then '), B(p.cm.f));
  row('Symbol', T(p.symbol));
  if (!shared) row('Address', T(`${origin.replace(/^https?:\/\//, '') || 'perceptualmechanics.com'}/#quiz/${n}`));
  if (p.who.length) row('Others here', T(p.who.join(' \u00a0\u00b7\u00a0 ')));
  if (p.attributed.length) row('Placed here by others', T(p.attributed.join(' \u00a0\u00b7\u00a0 ')));

  const closers = [];
  if (result.displaced) {
    closers.push([`You came to rest at Phase ${result.raw}, where there is no human life.`,
                  'The wheel has set you down at the first phase that can hold one.']);
  }
  if (shared) {
    closers.push(n === 22 || n === 8
      ? ['This is somebody\u2019s place on the wheel, and it is a phase of crisis.', 'The wheel does not hold still there.']
      : ['This is somebody\u2019s place on the wheel.', 'It was not chosen and it could not be refused.']);
  } else {
    closers.push(n === 22 || n === 8
      ? ['You are at a phase of crisis.', 'The wheel does not hold still here, and neither will you.']
      : ['This is your place on the wheel.', 'It was not chosen and it cannot be refused.']);
  }

  return {
    n, name: p.will, rows, closers,
    citeUrl: `https://www.yeatsvision.com/Ph${n}.html`,
    shared,
    announcement: `${shared ? 'Phase' : 'You are Phase'} ${n} of 28. ${p.will}. `
      + (q ? `${q.name}, element ${q.element}, ${q.dominant} dominates.` : 'A phase of crisis, outside the quarters.')
      + ` Your mask is drawn from phase ${mn}, your creative mind from phase ${cn}, your body of fate from phase ${bn}.`,
  };
}
