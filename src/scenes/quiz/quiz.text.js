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
// and False forms; `bf` the Body of Fate. `symbol` is the phase's symbol as
// recorded in the Yeats papers (YVP 3 400-01), reproduced with its own
// spelling and its own strangeness — several are ungrammatical in the source
// and correcting them would be inventing.
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
    symbol: 'naked man with out stretched hands tied to swinging branch of tree',
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
    symbol: 'man making chain, or putting it on another',
    who: ['Byron’s Don Juan', 'Byron’s Giaour'], attributed: [] },
  { n: 6,  will: 'Artificial individuality',
    mask: { t: 'Justice', f: 'Tyranny' },
    cm:   { t: 'Ideality', f: 'Derision' },
    bf:   'Humanity',
    symbol: 'savage putting nails into idol',
    who: ['Walt Whitman'], attributed: [] },
  { n: 7,  will: 'Assertion of Individuality',
    mask: { t: 'Altruism', f: 'Efficiency' },
    cm:   { t: 'Heroic sentiment', f: 'Dogmatic sentimentality' },
    bf:   'Adventure that excites the individuality',
    symbol: 'satyr (goat leggs) followed own image or mask',
    who: ['George Borrow', 'Alexandre Dumas', 'Thomas Carlyle', 'James Macpherson'], attributed: [] },
  { n: 8,  will: 'War between individuality and race',
    mask: { t: 'Courage', f: 'Fear' },
    cm:   { t: 'Versatility', f: 'Impotence' },
    bf:   'The beginning of strength',
    symbol: 'a man across abyss hands in beak of bird of prey feet in mouth of bear. water below.',
    who: [], attributed: [] },
  { n: 9,  will: 'Belief instead of individuality',
    mask: { t: 'Facility', f: 'Obscurity' },
    cm:   { t: 'Self-dramatisation', f: 'Anarchy' },
    bf:   'Enforced sensuality',
    symbol: 'leopard. Eagle on head plucking out eyes.',
    who: [], attributed: ['Wyndham Lewis'] },
  { n: 10, will: 'The image-breaker',
    mask: { t: 'Organisation', f: 'Inertia' },
    cm:   { t: 'Domination through emotional construction', f: 'Reformation' },
    bf:   'Enforced emotion',
    symbol: 'a man with mouth forced open [by gag and tongue torn out]',
    who: ['Parnell'], attributed: [] },
  { n: 11, will: 'The consumer, pyre-builder',
    mask: { t: 'Rejection', f: 'Moral indifference' },
    cm:   { t: 'Moral iconoclasm', f: 'Self-assertion' },
    bf:   'Enforced belief',
    symbol: 'a sword cleaving through skull',
    who: ['Spinoza', 'Savonarola'], attributed: [] },
  { n: 12, will: 'The forerunner',
    mask: { t: 'Self-exaggeration', f: 'Self-abandonment' },
    cm:   { t: 'Subjective philosophy', f: 'War between two forms of expression' },
    bf:   'Enforced intellectual action',
    symbol: 'sword cutting hand in two',
    who: ['Nietzsche'], attributed: [] },
  { n: 13, will: 'The sensuous man',
    mask: { t: 'Self-expression', f: 'Self-absorption' },
    cm:   { t: 'Subjective truth', f: 'Morbidity' },
    bf:   'Enforced love of another',
    symbol: 'man hanging over pool',
    who: ['Baudelaire', 'Beardsley', 'Ernest Dowson'], attributed: [] },
  { n: 14, will: 'The obsessed man',
    mask: { t: 'Serenity', f: 'Self-distrust' },
    cm:   { t: 'Emotional will', f: 'Terror' },
    bf:   'Enforced love of the world',
    symbol: 'leopard springing',
    who: [], attributed: [] },
  { n: 15, will: 'No description except that this is a phase of complete beauty',
    mask: null, cm: null, bf: null,
    symbol: 'man with arrow & stone one in each hand',
    who: [], attributed: [] },
  { n: 16, will: 'The positive man',
    mask: { t: 'Illusion', f: 'Delusion' },
    cm:   { t: 'Vehemence', f: 'Opinionated will' },
    bf:   'Enforced illusion',
    symbol: 'dark circle with hand',
    who: ['William Blake', 'Rabelais', 'Aretino', 'Paracelsus', 'some beautiful women'],
    attributed: ['Maud Gonne'] },
  { n: 17, will: 'The Daimonic man',
    mask: { t: 'Simplification through intensity', f: 'Dispersal' },
    cm:   { t: 'Creative imagination through antithetical emotion', f: 'Enforced self-realization' },
    bf:   'Enforced loss',
    symbol: 'crystal arrow & crescent',
    who: ['Dante', 'Shelley', 'Landor'], attributed: ['W. B. Yeats'] },
  { n: 18, will: 'The emotional man',
    mask: { t: 'Intensity through emotions', f: 'Curiosity' },
    cm:   { t: 'Emotional philosophy', f: 'Enforced lure' },
    bf:   'Enforced disillusionment',
    symbol: 'Two faced figure',
    who: ['Goethe', 'Matthew Arnold'], attributed: ['George Yeats'] },
  { n: 19, will: 'The assertive man',
    mask: { t: 'Conviction', f: 'Domination' },
    cm:   { t: 'Emotional intellect', f: 'The Unfaithful' },
    bf:   'Enforced failure of action',
    symbol: 'Wolf',
    who: ['Oscar Wilde', 'Byron', 'Gabriele d’Annunzio (perhaps)'],
    attributed: ['Mrs Patrick Campbell'] },
  { n: 20, will: 'The concrete man',
    mask: { t: 'Fatalism', f: 'Superstition' },
    cm:   { t: 'Dramatisation of Mask', f: 'Self-desecration' },
    bf:   'Enforced success of action',
    symbol: 'White bird torn in half by wolf & leopard?',
    who: ['Shakespeare', 'Balzac', 'Napoleon'], attributed: [] },
  { n: 21, will: 'The acquisitive man',
    mask: { t: 'Self-analysis', f: 'Self-adaptation' },
    cm:   { t: 'Domination of the intellect', f: 'Distortion' },
    bf:   'Enforced triumph of achievement',
    symbol: 'Man & statue',
    who: ['Lamarck', 'George Bernard Shaw', 'H. G. Wells', 'George Moore', 'Jacques Louis David'],
    attributed: [] },
  { n: 22, will: 'Balance between ambition and contemplation',
    mask: { t: 'Self-immolation', f: 'Self-assurance' },
    cm:   { t: 'Amalgamation', f: 'Despair' },
    bf:   'Temptation through strength',
    symbol: 'Man beating self with flail',
    who: [], attributed: [] },
  { n: 23, will: 'The Receptive Man',
    mask: { t: 'Wisdom', f: 'Self-pity' },
    cm:   { t: 'Creation through pity', f: 'Self-driven desire' },
    bf:   'Success',
    symbol: 'blind folded man ballanced on point of pike & juggling',
    who: ['Rembrandt', 'Synge'], attributed: [] },
  { n: 24, will: 'The end of ambition',
    mask: { t: 'Self-reliance', f: 'Isolation' },
    cm:   { t: 'Constructive emotion', f: 'Authority' },
    bf:   'Objective action',
    symbol: 'woman, cup & boar',
    who: ['Queen Victoria', 'Galsworthy', 'Lady Gregory'], attributed: [] },
  { n: 25, will: 'The Conditional Man',
    mask: { t: 'Consciousness of self', f: 'Self-consciousness' },
    cm:   { t: 'Rhetoric', f: 'Spiritual arrogance' },
    bf:   'Persecution',
    symbol: 'vast figure of god with small human figure flicking before his face',
    who: ['Cardinal Newman', 'Luther', 'Calvin', 'George Herbert', 'George Russell (AE)'],
    attributed: [] },
  { n: 26, will: 'The Multiple Man, also called “The Hunchback”',
    mask: { t: 'Self-realisation', f: 'Self-abandonment' },
    cm:   { t: 'Beginning of the abstract supersensual', f: 'Fascination of sin' },
    bf:   'The Hunchback is his own Body of Fate',
    symbol: 'Hunch back fighting his shadow on ground which bleeds',
    who: [], attributed: [] },
  { n: 27, will: 'The Saint',
    mask: { t: 'Renunciation', f: 'Emulation' },
    cm:   { t: 'Supersensual receptivity', f: 'Pride' },
    bf:   'None except impersonal action',
    symbol: 'more or less [?easter] figure',
    who: ['Socrates', 'Pascal'], attributed: [] },
  { n: 28, will: 'The Fool',
    mask: { t: 'Oblivion', f: 'Malignity' },
    cm:   { t: 'Physical activity', f: 'Cunning' },
    bf:   'The Fool is his own Body of Fate',
    symbol: 'a shrunken faceless man whirling a rattle',
    who: [], attributed: [] },
];

export const PHASE_BY_N = Object.fromEntries(PHASES.map(p => [p.n, p]));


// ─── What the visitor is told before they start ─────────────────────────────
// Here rather than in quiz.html for two reasons. The /text/ page needs it —
// that page is the scene for anybody without JavaScript, and a form with no
// preamble is a form with no subject. And `src/utils/corpus.js` reads it: these
// are sentences this site publishes, so they are sentences the Psyshell holds,
// and text that lives only in a markup file is text the lens cannot see.
export const PREAMBLE = [
  'W. B. Yeats held that every soul is born at one of twenty-eight phases of the moon, and that the phase decides the shape of a life: what you want, what you can make, and what will be done to you regardless.',
  'These sixteen questions place you on his Wheel. There is no human life at the full or at the dark, so two of the phases cannot be yours.',
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
// The prose is written for this scene. Yeats's designations are quoted in the
// verdict because they are the system's own vocabulary; the questions are not
// his and do not pretend to be.
export const SCALES = {
  // + is antithetical (the self it makes), - is primary (the world it is given)
  tincture: { key: 'tincture', pole: '+antithetical / -primary' },
  // + is waxing, before the full: "it sought itself". - is waning, after.
  half:     { key: 'half',     pole: '+waxing / -waning' },
};

export const ITEMS = [
  { id: 1,  scale: 'tincture', key:  1, text: 'What I want most, I had to invent. It was not waiting for me.' },
  { id: 2,  scale: 'half',     key:  1, text: 'I am still finding out what I am capable of.' },
  { id: 3,  scale: 'tincture', key: -1, text: 'The best parts of my life arrived through circumstance rather than through anything I chose.' },
  { id: 4,  scale: 'half',     key: -1, text: 'I have already been the thing I was going to be. Now I am spending it.' },
  { id: 5,  scale: 'tincture', key:  1, text: 'I would rather be exact and difficult than agreeable.' },
  { id: 6,  scale: 'half',     key:  1, text: 'I take the harder of two options fairly often, largely to find out whether I can.' },
  { id: 7,  scale: 'tincture', key: -1, text: 'I take my measure from the people around me, and that seems right to me.' },
  { id: 8,  scale: 'half',     key: -1, text: 'I choose work by how much it is needed, not by how much it costs me.' },
  { id: 9,  scale: 'tincture', key:  1, text: 'There is a version of myself I am deliberately building, and I know what it looks like.' },
  { id: 10, scale: 'half',     key:  1, text: 'My appetites have grown larger with age, not smaller.' },
  { id: 11, scale: 'tincture', key: -1, text: 'I trust what everyone can see over what only I can see.' },
  { id: 12, scale: 'half',     key: -1, text: 'More and more of what I do is for people who will never know I did it.' },
  { id: 13, scale: 'tincture', key:  1, text: 'I care more about the shape of a thing than about what it is for.' },
  { id: 14, scale: 'half',     key:  1, text: 'I am still gathering. I have not begun to spend.' },
  { id: 15, scale: 'tincture', key: -1, text: 'Being useful matters to me more than being unlike anybody else.' },
  { id: 16, scale: 'half',     key: -1, text: 'I am giving things away faster than I take them in.' },
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

const ITEMS_PER_SCALE = ITEMS.filter(i => i.scale === 'tincture').length;
const MAX_ABS = ITEMS_PER_SCALE * 2;   // eight items at ±2

// ─── Placing you on the Wheel ───────────────────────────────────────────────
// "There's no human life at the full or the dark": Phase 1 and Phase 15 are
// not incarnations, and this scoring cannot return them. The waxing half is
// 2..14 and the waning half 16..28, which is thirteen phases on each side and
// **twenty-six reachable phases** — the number Yeats gives in `The Phases of
// the Moon` for the cradles a man must needs be rocked in. That is not a
// coincidence arranged here; it is what excluding the two poles leaves.
//
// The tincture score walks you around the half; the half score chooses which
// half you are walking. A tie on the half is decided by the tincture, and a
// visitor who ties on BOTH lands at Phase 22 — the phase Yeats calls the
// balance between ambition and contemplation, one of the two phases of crisis.
// Which is the honest answer to a person who came out exactly in the middle,
// and it is arithmetic rather than a special case: dead centre on the tincture
// puts the walk six steps from the start of either half, and six steps back
// from 28 is 22.
export function place(tincture, half) {
  const t = (Math.max(-1, Math.min(1, tincture)) + 1) / 2;     // 0 primary .. 1 antithetical
  const waxing = half > 0 || (half === 0 && tincture > 0);
  return waxing ? Math.round(2 + t * 12) : Math.round(28 - t * 12);
}

// `responses` is a map of item id -> chosen value. Anything unanswered counts
// as zero, so a partly-filled form still returns a phase rather than throwing;
// the scene requires all sixteen before it will submit, and this is what
// happens if something ever gets past that.
export function score(responses) {
  const sum = (scale) => ITEMS
    .filter(i => i.scale === scale)
    .reduce((a, i) => a + (responses?.[i.id] ?? 0) * i.key, 0);
  const tincture = sum('tincture') / MAX_ABS;
  const half = sum('half') / MAX_ABS;
  const n = place(tincture, half);
  return { tincture, half, n, phase: PHASE_BY_N[n] };
}

// Every phase this scoring can actually return. Derived by walking the whole
// response space in `scripts/quiz-wheel.mjs`; exported here so the /text/ page
// can list them without re-deriving.
export const REACHABLE = PHASES.filter(p => p.n !== 1 && p.n !== 15).map(p => p.n);
