// ─── Quiz: the twenty-eight phases, and the sixteen questions that place you ─
// NO DOM AND NO THREE.JS IN THIS FILE. `scripts/prerender.js` imports it to
// build /text/quiz/, `scripts/verify-counts.mjs` derives its counts from it,
// and `scripts/quiz-wheel.mjs` runs the scoring over the whole response space.
// None of those has a browser. Same rule as every other .text.js here.
//
// ─── Where this came from ───────────────────────────────────────────────────
// W. B. Yeats, `A Vision` — the Wheel of the twenty-eight incarnations. The
// structure below was read off Neil Mann's `yeatsvision.com` on 2026-09-06:
// the per-phase Faculty tables at `Ph1.html`–`Ph28.html`, the group and
// Faculty geometry at `Wheel.html`, the elements and dominant Faculties at
// `Q1.html`–`Q4.html`, and the tincture crossings at `Tinctures.html`.
//
// **Facts and structure are free; prose is not.** So what is here is Yeats's
// own short designations — the name of each phase, the True and False Mask,
// the True and False Creative Mind, the Body of Fate, the symbol, the people
// he named — and nothing of anybody's paragraphs. Every sentence a visitor
// reads that is not one of those designations was written for this scene.
//
// ─── The Faculties are DERIVED, not stored ──────────────────────────────────
// Yeats's four Faculties sit at fixed positions relative to each other, and
// `Wheel.html` states them as reflections rather than as a table: Mask is
// diametrically opposite Will; Creative Mind is Will reflected across the
// Phase 1–Phase 15 axis; Body of Fate faces Creative Mind. On a 28-phase wheel
// that is arithmetic and nothing else:
//
//   Mask         = will + 14
//   CreativeMind = 30 - will
//   BodyOfFate   = 16 - will          (all wrapped into 1..28)
//
// which is why no phase below carries the numbers of its own Faculties. It
// would have been three more columns to mistype, and the whole point of the
// 6.0 pass is that a number you can derive is a number you do not write down.
// `scripts/quiz-wheel.mjs` asserts that these three formulas reproduce the
// eight groups `Wheel.html` publishes — 1-15, 2-14-16-28, 3-13-17-27,
// 4-12-18-26, 5-11-19-25, 6-10-20-24, 7-9-21-23, 8-22 — which is the check
// that the arithmetic is Yeats's and not merely self-consistent.
const WRAP = 28;
const wrap = (n) => ((Math.round(n) - 1) % WRAP + WRAP) % WRAP + 1;
export const maskPhase = (n) => wrap(n + 14);
export const creativeMindPhase = (n) => wrap(30 - n);
export const bodyOfFatePhase = (n) => wrap(16 - n);

// ─── The Quarters, and the four phases that are not in one ──────────────────
// Each Quarter has an element and a Faculty that dominates it. The Cardinal
// Phases — 1, 8, 15, 22 — fall on the boundaries rather than inside a Quarter,
// which is Yeats's arrangement and not a rounding decision here.
export const QUARTERS = [
  { n: 1, name: 'First Quarter',  element: 'Earth', dominant: 'Will',          phases: [2, 3, 4, 5, 6, 7] },
  { n: 2, name: 'Second Quarter', element: 'Water', dominant: 'Mask',          phases: [9, 10, 11, 12, 13, 14] },
  { n: 3, name: 'Third Quarter',  element: 'Air',   dominant: 'Creative Mind', phases: [16, 17, 18, 19, 20, 21] },
  { n: 4, name: 'Fourth Quarter', element: 'Fire',  dominant: 'Body of Fate',  phases: [23, 24, 25, 26, 27, 28] },
];
export const CARDINAL = [1, 8, 15, 22];
export const quarterOf = (n) => QUARTERS.find(q => q.phases.includes(n)) ?? null;

// ─── The Triads ─────────────────────────────────────────────────────────────
// A second grouping, and NOT the Faculty rectangles — the two were conflated
// once in this project's notes and the correction is worth keeping visible.
// The rectangles (1-15, 2-14-16-28, …) say where a phase draws its Faculties
// from. The Triads say what a phase DOES inside its quarter, and they are
// Yeats's, at AV B 92-93: excluding the four phases of crisis, each quarter is
// six phases, or two sets of three, and in every set the first phase is a
// manifestation of power, the second of a code or arrangement of powers, and
// the third of a belief — the belief being a submission to some quality which
// becomes power in the next set.
//
// Which is entirely derivable from position, so nothing is written down: the
// index within the quarter gives the set and the role, and a Cardinal Phase
// has neither because it is outside the quarters.
export const TRIAD_ROLES = ['power', 'code', 'belief'];
export function triadOf(n) {
  const q = quarterOf(n);
  if (!q) return null;
  const i = q.phases.indexOf(n);
  return { set: i < 3 ? 1 : 2, role: TRIAD_ROLES[i % 3], phases: q.phases.slice(i < 3 ? 0 : 3, i < 3 ? 3 : 6) };
}

// ─── The tincture ───────────────────────────────────────────────────────────
// `Tinctures.html`: "Phase 8 of the greater Wheel is Phase 1 of the smaller,
// antithetical wheel, and Phase 22 is Phase 1 of the smaller, primary wheel."
// So 8 and 22 are the crossings themselves, 15 is wholly antithetical and 1
// wholly primary, and everything between takes the tincture of the half it is
// in. Derived here rather than written into each row, for the same reason the
// Faculty positions are.
export function tinctureOf(n) {
  if (n === 1) return 'wholly primary';
  if (n === 15) return 'wholly antithetical';
  if (n === 8 || n === 22) return 'the crossing';
  return (n > 8 && n < 22) ? 'antithetical' : 'primary';
}

// ─── The twenty-eight ───────────────────────────────────────────────────────
// `will` is Yeats's designation for the phase. `mask` and `cm` carry his True
// and False forms; `bf` the Body of Fate. `symbol` RESTATES the phase's symbol
// rather than transcribing it, and that is a copyright decision as much as a
// tonal one.
//
// The symbols are recorded in the Yeats papers (YVP 3 400-01) as manuscript
// jottings, and the first build quoted them verbatim: "satyr (goat leggs)
// followed own image or mask", "more or less [?easter] figure". Two problems
// at once. **They are sentences out of an edited scholarly edition**, which is
// the one place in this file the brief's rule bites — names, attributions and
// structure are free, somebody's transcribed prose is not. And they read as
// apparatus in a report whose whole job is to sound certain: an editorial
// query in square brackets is the sound of a footnote, not of a judgment.
//
// So the IMAGE is kept, which is the fact, and the words are ours. Where the
// manuscript is genuinely illegible the report says so, because guessing the
// missing word would be inventing, and a system that admits one gap is more
// authoritative than one that never has any.
//
// `who` is the people Yeats named at the phase. `attributed` is the people
// yeatsvision.com brackets — attributions from elsewhere in the papers or from
// scholarship rather than from `A Vision` itself. Kept apart rather than
// merged, because "Yeats put himself at Phase 17" is a different kind of claim
// from "Yeats wrote Dante at Phase 17", and the scene says which is which.
//
// Phases 1 and 15 have no Faculty attributes and no people, because nobody is
// born there. Their rows carry Yeats's two words and stop.
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


// ─── What the visitor is told before they start ─────────────────────────────
// **Nothing.** This is the load-bearing constraint of the whole scene and the
// first thing that broke: the first version of this paragraph named Yeats,
// named the twenty-eight phases, named the Wheel, and mentioned that two of
// them could not be yours. Every one of those is the ending. A visitor who
// reads that answers sixteen questions knowing what shape the answer will be,
// and the verdict lands on ground already prepared for it.
//
// So the preamble says what a questionnaire says: how long, and answer
// honestly. No author, no system, no wheel, no phases, no count of anything
// but the questions. The scene is a personality quiz until the moment it is
// not, and it has to be a convincing one.
//
// Here rather than in quiz.html for two reasons. The /text/ page needs it —
// that page is the scene for anybody without JavaScript. And
// `src/utils/corpus.js` reads it: these are sentences this site publishes, so
// they are sentences the Psyshell holds, and text that lives only in a markup
// file is text the lens cannot see.
export const PREAMBLE = [
  'Sixteen questions. It takes about three minutes.',
  'Answer honestly rather than carefully. There are no better or worse answers here.',
];

// ─── The instrument ─────────────────────────────────────────────────────────
// Two scales, eight items each, because the Wheel is two questions and not
// twenty-eight. Where you sit is fixed by how far you are from the two poles
// and by which half of the circle you are travelling through, and everything
// else about the phase — its Quarter, its element, all four Faculties, the
// people at it — follows from the number without asking you anything more.
//
// **Eight and not six, and the reason is keying.** Half the items on a scale
// are worded so that agreeing pushes toward one pole and half toward the
// other, so that a visitor who tends to agree with statements does not drift
// in one direction on wording alone. Seven items would split four and three
// and leave that drift in the result, invisible and unarguable. Eight splits
// evenly, and `scripts/quiz-wheel.mjs` asserts the split rather than trusting
// this paragraph.
//
// **The items are deliberately flat, and flatness is a requirement rather than
// a limit on the writing.** The first set read like the scene: "What I want
// most, I had to invent. It was not waiting for me." That is a good sentence
// and it is a tell — nobody writes that on a personality quiz, so a reader
// with an ear knows something is coming before question two, and the ending is
// spent. Every item here is meant to be indistinguishable from a magazine
// instrument. If a line in this list starts sounding like Yeats, or like this
// site, it is wrong however well it reads.
export const SCALES = {
  // Yeats states the Faculties as two pairs of opposites, which is already the
  // shape of a psychometric scale: "Will and Mask are the will and its object,
  // or the Is and the Ought; Creative Mind and Body of Fate are thought and
  // its object, or the Knower and the Known."
  //
  // So two scales rather than four, and they are his structure rather than one
  // imposed on it. An earlier build measured antithetical-against-primary and
  // waxing-against-waning instead — a defensible pair of axes, invented here,
  // and not the ones the system supplies. The difference is the whole claim
  // the scene makes about being honest.
  will_mask: {
    key: 'will_mask',
    // - is Will, the Is: acting out of what you already are.
    // + is Mask, the Ought: acting toward what you mean to become.
    low: 'Will', high: 'Mask', question: 'the Is and the Ought',
  },
  mind_fate: {
    key: 'mind_fate',
    // - is Creative Mind, the Knower: understanding a thing by thinking it.
    // + is Body of Fate, the Known: understanding it by what it does to you.
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

// Five points and a real middle. A forced four-point scale would remove the
// exact centre from the SCALE and not from the RESULT — the sums can still
// land on zero — so it would buy nothing except the pretence that nobody is
// undecided.
export const CHOICES = [
  { value: -2, label: 'Strongly disagree' },
  { value: -1, label: 'Disagree' },
  { value:  0, label: 'Neither' },
  { value:  1, label: 'Agree' },
  { value:  2, label: 'Strongly agree' },
];

const ITEMS_PER_SCALE = ITEMS.filter(i => i.scale === 'will_mask').length;
const MAX_ABS = ITEMS_PER_SCALE * 2;   // eight items at ±2

// ─── Placing you on the Wheel ───────────────────────────────────────────────
// **One Faculty is measured and the other three follow.** Yeats numbers a
// phase by where the Will sits, and fixes the rest by construction, so an
// instrument only has to find one position — and then a report can state all
// four as though it measured them, which is exactly the unearned authority the
// scene is about, arrived at by his arithmetic rather than by a cheat.
//
// Which of the two scales you answer more STRONGLY on decides which pair of
// Faculties governs you, and its sign picks the quarter — Yeats's own
// arrangement, one dominant Faculty per quarter:
//
//   Will dominant          -> First Quarter,  phases 2-7,   earth
//   Mask dominant          -> Second Quarter, phases 9-14,  water
//   Creative Mind dominant -> Third Quarter,  phases 16-21, air
//   Body of Fate dominant  -> Fourth Quarter, phases 23-28, fire
//
// The other scale then places you inside that quarter, running from the
// Cardinal Phase that opens it through its six phases. Seven slots, and the
// Cardinal Phase is slot zero because a phase of crisis is where a quarter
// begins rather than an edge case bolted onto it.
//
// **Phases 1 and 15 are reachable here on purpose.** They are not incarnations
// — no human life at the dark or at the full — and the instrument must not
// return them. It would be easy to clamp them out silently and nobody would
// know. Instead the placement is allowed to land there and the REPORT says so:
// you came to rest at a phase that holds no life, and the wheel has set you
// down at the first one that can. Which is funnier than a silent exclusion and
// truer to a system that has opinions about where you cannot be.
const QUARTER_OPENS = { 1: 1, 2: 8, 3: 15, 4: 22 };
const UNINHABITABLE = { 1: 2, 15: 16 };

export function place(willMask, mindFate) {
  const wm = Math.max(-1, Math.min(1, willMask));
  const mf = Math.max(-1, Math.min(1, mindFate));
  // Dead centre on both pairs. No Faculty dominates, which is not an edge case
  // to be broken arbitrarily — it is the definition of a phase of crisis, and
  // the habitable one that names itself is 22, "Balance between ambition and
  // contemplation". Reporting a dominant Faculty for somebody who scored zero
  // on both scales would be the one lie in the instrument.
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

// `responses` is a map of item id -> chosen value. Anything unanswered counts
// as zero, so a partly-filled form still returns a phase rather than throwing;
// the scene requires all sixteen before it will submit, and this is what
// happens if something ever gets past that.
export function score(responses) {
  const sum = (scale) => ITEMS
    .filter(i => i.scale === scale)
    .reduce((a, i) => a + (responses?.[i.id] ?? 0) * i.key, 0);
  const willMask = sum('will_mask') / MAX_ABS;
  const mindFate = sum('mind_fate') / MAX_ABS;
  const p = place(willMask, mindFate);
  return { willMask, mindFate, ...p, phase: PHASE_BY_N[p.n] };
}

// Every phase this scoring can actually return. Derived by walking the whole
// response space in `scripts/quiz-wheel.mjs`; exported here so the /text/ page
// can list them without re-deriving.
export const REACHABLE = PHASES.filter(p => p.n !== 1 && p.n !== 15).map(p => p.n);

// ─── The report, built once and rendered twice ──────────────────────────────
// **This is here rather than in quiz.js so that every outcome can be checked
// without a browser.** The Cardinal Phases shipped for four releases with the
// Faculty rectangle collapsed and the report saying nothing about it, and the
// only reason it was ever seen is that Scott took the quiz and drew Phase 22.
// A report assembled inside a DOM renderer can only be inspected by rendering
// it, which means the outcomes that get inspected are the ones somebody
// happens to draw.
//
// So the report is DATA. `rows` are segments — plain text and emphasised text
// — which quiz.js turns into markup and `scripts/quiz-wheel.mjs` walks for all
// twenty-eight phases on every build. One assembly, two readers, and the
// second one runs whether anyone is looking or not.
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

  // A Faculty is attributed to the phase it is DRAWN FROM and described by
  // what it does here. Conflating the two is the easiest mistake in the system.
  const faculty = (label, from, spec, bare) => {
    const segs = [T(`drawn from phase ${from}, ${PHASE_BY_N[from].will}`)];
    if (spec) segs.push(T(' \u00a0\u00b7\u00a0 '), B(bare ? spec : spec.t));
    row(label, ...segs);
  };
  faculty('Will', n, null);
  faculty('Mask', mn, p.mask);
  faculty('Creative Mind', cn, p.cm);
  faculty('Body of Fate', bn, p.bf, true);

  // The rectangle collapses at the Cardinal Phases and nowhere else — Yeats
  // puts the exception in a parenthesis and the report says it out loud,
  // because on the page it otherwise reads as the report repeating itself.
  const corners = [...new Set([n, mn, cn, bn])].sort((a, b) => a - b);
  if (corners.length < 4) {
    row('The rectangle', B('Collapsed'), T(` — the four Faculties fall on ${corners.join(' and ')} rather than on four phases`));
  }
  if (p.mask && p.cm) row('The failure', B(p.mask.f), T(', and then '), B(p.cm.f));
  row('Symbol', T(p.symbol));
  // **The address is a fact in the report, not a call to action.** Stated as
  // flatly as the symbol beside it, in the same voice, and the visitor takes
  // it or does not. The scene will not ask them to share anything; a button
  // that did would be the ANSWER AGAIN problem again, and the register does
  // not survive being asked for a favour.
  if (!shared) row('Address', T(`${origin.replace(/^https?:\/\//, '') || 'perceptualmechanics.com'}/#quiz/${n}`));
  if (p.who.length) row('Others here', T(p.who.join(' \u00a0\u00b7\u00a0 ')));
  if (p.attributed.length) row('Placed here by others', T(p.attributed.join(' \u00a0\u00b7\u00a0 ')));

  const closers = [];
  if (result.displaced) {
    closers.push([`You came to rest at Phase ${result.raw}, where there is no human life.`,
                  'The wheel has set you down at the first phase that can hold one.']);
  }
  // A visitor who followed a link was sent, not measured, so the report does
  // not tell them anything about themselves. It tells them about whoever sent
  // it, and then offers the only thing that could tell them about themselves.
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
    // One flat sentence for a screen reader, ahead of the capitals.
    shared,
    announcement: `${shared ? 'Phase' : 'You are Phase'} ${n} of 28. ${p.will}. `
      + (q ? `${q.name}, element ${q.element}, ${q.dominant} dominates.` : 'A phase of crisis, outside the quarters.')
      + ` Your mask is drawn from phase ${mn}, your creative mind from phase ${cn}, your body of fate from phase ${bn}.`,
  };
}
