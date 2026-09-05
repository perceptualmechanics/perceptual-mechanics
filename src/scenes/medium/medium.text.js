// ─── Medium — the board, and what is written about it ───────────────────────
// NO DOM AND NO PHYSICS. The board's geometry lives here because two things
// need it and must not be able to disagree: `medium.js`, which draws it, and
// `scripts/prerender.js`, which runs a séance at build time and publishes the
// transcript at /text/medium/. A board laid out twice is a board that drifts.
//
// Coordinates are the same normalised board space the physics uses — 0..1 in
// both axes, origin top-left, and the scene maps that square into whatever
// aspect the viewport turns out to be. Nothing here is in pixels.

// ─── The board ──────────────────────────────────────────────────────────────
// A homemade one, not a Parker Brothers one: two arcs of letters, a row of
// digits, YES and NO in the upper corners, GOODBYE at the foot. That is the
// arrangement every hand-made board has had since the 1890s, and the reason it
// is worth copying exactly is that the shape does work — the arcs put every
// letter roughly the same distance from the middle, so no letter is cheaper to
// reach than any other, and a board where E sat closer to centre than X would
// be a board with an opinion.
// One gap, everywhere. Every mark on this board sits this far from its
// neighbour — letters, digits and punctuation alike — which is what makes the
// board read as one object rather than as three rows that were each eyeballed
// separately. It is also the number the catchment claim below is about.
export const MARK_GAP = 0.069;

// Arc length of the ellipse below between -s/2 and s/2. Simpson's rule on a
// fine grid: the integrand is smooth, so this is exact to far more digits than
// a board measured in hundredths could use.
const arcLength = (s, radius, ry, n = 2048) => {
  const speed = t => Math.hypot(radius * Math.cos(t), ry * Math.sin(t));
  const h = s / n;
  let sum = speed(-s / 2) + speed(s / 2);
  for (let i = 1; i < n; i++) sum += speed(-s / 2 + i * h) * (i % 2 ? 4 : 2);
  return (sum * h) / 3;
};

// An arc of letters at EQUAL SPACING — equal along the curve, which is the
// only place spacing means anything to a reader or to the cup.
//
// This used to take a `spread` and step through it in equal ANGLE:
// `t = (i/(n-1) - 0.5) * spread`. On a circle those are the same thing. These
// arcs are not circles — they are flattened, ry/radius about 0.28 — and on a
// flattened ellipse a step of equal angle covers a distance of
// `dt * sqrt(radius^2 cos^2 t + ry^2 sin^2 t)`, which is largest in the middle
// of the arc and smallest at its ends. So the letters bunched up towards A and
// M and spread out around G: 0.0494 to 0.0725 within the first arc and 0.0433
// to 0.0606 within the second, a 1.4-1.5x variation each. The digit and
// punctuation rows are straight lines stepped evenly, so they were exactly
// even the whole time, which is why the letters were the rows that looked odd.
//
// So the parameter is the gap, not the spread. Given a gap, solve for the
// spread that makes the arc exactly (n-1) gaps long, then walk the curve
// placing each letter where the accumulated length says it goes. Two
// consequences worth having: the two arcs now have the same spacing as each
// other (they did not — 0.0633 against 0.0538 for the same 13 letters), and
// the number that governs the board is a distance somebody can compare to
// DWELL_RADIUS rather than an angle nobody can.
const ARC = (chars, gap, radius, cy, ry) => {
  const n = chars.length;
  const want = gap * (n - 1);

  // The spread that makes the arc that long. Bisection rather than an
  // algebraic inverse because the elliptic integral has none, and 60 halvings
  // of [0, pi] lands well under floating-point noise.
  // Half a turn is the ceiling: past pi the arc doubles back on itself and the
  // letters start walking backwards along the board. Checked rather than
  // clamped, because a bisection that runs into its own bound returns the
  // bound, which looks like an answer — ask for a gap that cannot fit at this
  // radius and you would get a silently squashed arc instead of a complaint.
  // Caught by asking for one: at radius 0.37 this arc's thirteen letters no
  // longer fit inside half a turn, and the search returned pi with a straight
  // face.
  if (arcLength(Math.PI, radius, ry) < want) {
    throw new Error(
      `ARC(${chars}): a gap of ${gap} needs ${want.toFixed(3)} board units, and a ` +
      `radius of ${radius} with ry ${ry} gives at most ` +
      `${arcLength(Math.PI, radius, ry).toFixed(3)} across half a turn. Widen the radius.`
    );
  }
  let lo = 0, hi = Math.PI;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (arcLength(mid, radius, ry) < want) lo = mid; else hi = mid;
  }
  const spread = (lo + hi) / 2;

  // Cumulative length along the curve, then read it backwards: for each
  // letter's target distance, the parameter t that reaches it.
  const STEPS = 4000;
  const t0 = -spread / 2, dt = spread / STEPS;
  const speed = t => Math.hypot(radius * Math.cos(t), ry * Math.sin(t));
  const cum = new Float64Array(STEPS + 1);
  for (let i = 1; i <= STEPS; i++) {
    cum[i] = cum[i - 1] + ((speed(t0 + (i - 1) * dt) + speed(t0 + i * dt)) / 2) * dt;
  }
  const total = cum[STEPS];

  // `j` walks forward across the whole map, never restarting: the targets are
  // increasing, so this is one pass over the table rather than n searches.
  let j = 0;
  return chars.split('').map((ch, i) => {
    const target = (i / (n - 1)) * total;
    while (j < STEPS && cum[j + 1] < target) j++;
    const seg = cum[j + 1] - cum[j];
    const t = t0 + (j + (seg > 0 ? (target - cum[j]) / seg : 0)) * dt;
    return { ch, x: 0.5 + Math.sin(t) * radius, y: cy + (1 - Math.cos(t)) * ry, kind: 'letter' };
  });
};

// ─── The card ───────────────────────────────────────────────────────────────
// A real Ouija board is about 22 inches by 15 — landscape, and markedly wider
// than it is tall. The first version of this scene drew a square, which fitted
// the screen badly in both directions at once: on any desktop the board was
// bounded by the viewport's HEIGHT and left a third of the width black either
// side, and the letters were smaller than they needed to be the whole time.
//
// Everything below still lives in a 0..1 unit square and the scene still maps
// that square isotropically — a board unit is the same length in x as in y, so
// the cup's drawn footprint and its catchment stay the same shape, which is the
// one thing that must not be traded for a nicer aspect ratio. What changed is
// the CONTENT: the arcs run out to the edges and the rows are packed closer, so
// the used area is a wide band inside the square and the card is drawn around
// that band rather than around the whole thing.
export const CARD = { x0: 0.02, y0: 0.13, x1: 0.98, y1: 0.87 };

// ─── The board ──────────────────────────────────────────────────────────────
// A homemade one, not a Parker Brothers one: two arcs of letters, a row of
// digits, punctuation under them, YES and NO in the upper corners, GOODBYE at
// the foot. That is the arrangement every hand-made board has had since the
// 1890s, and the reason it is worth copying exactly is that the shape does
// work — the arcs put every letter roughly the same distance from the middle,
// so no letter is cheaper to reach than any other, and a board where E sat
// closer to centre than X would be a board with an opinion.
//
// Wide, and much wider than the first version, which held both arcs inside the
// middle two thirds and left a margin of blank board either side that nothing
// ever used. A real board runs its letters nearly to the edge — that is what
// makes the shape read as a board rather than as a caption — and spreading them
// also spreads the cup's travel, so a letter is a journey rather than a nudge.
//
// Widening was not free, and the price was measured rather than waved at:
// pushing A, O and the other end letters away from where the cup spends its
// time cost the board about two and a half points of vowel share. What was not
// noticed at the time is that most of that was not the WIDTH. It was the
// placement. On an equal-angle arc the letters bunch at the ends and thin out
// in the middle, and the middle is exactly where the cup is — so the widening
// had quietly starved the cup's own neighbourhood of letters while stating,
// two paragraphs up, that the arc shape exists so no letter is cheaper to
// reach than any other.
//
// Placing at equal arc length instead gives it back. Same radii, same width,
// same everything else; ten seeds x 300s with a hand resting on the board:
//
//                        letters/s   vowel share
//     equal angle          0.140        31.1%
//     equal arc length     0.139        34.6%     <- here
//     (English)                         38.1%
//
// With plausibility switched off, 24.2% and 24.6% — unchanged, which is the
// control that says this is the lexicon getting a fairer board rather than the
// board being tilted.
//
// The letters stay closer together than twice DWELL_RADIUS. Every gap on the
// board is now MARK_GAP, 0.069, against a 0.048 catchment: 0.069 < 0.096, so
// the discs overlap everywhere, the arcs are continuous and there is no dead
// ground between two letters where the cup catches nothing. That claim used to
// need a worst case (spacing ran 0.043 to 0.073 and the widest pair was the
// one that had to fit); there is no worst case now, which is the quieter
// benefit of one gap rather than a range.
export const LETTER_ARCS = [
  ARC('ABCDEFGHIJKLM', MARK_GAP, 0.46, 0.245, 0.13),
  ARC('NOPQRSTUVWXYZ', MARK_GAP, 0.41, 0.440, 0.11),
];

// Ten digits on one straight row, at the same gap as everything else. The 0.62
// this used to spread across worked out at 0.0689 per digit, which is where
// MARK_GAP's value comes from — the digit row was already right, and the
// letters have been brought to it rather than the other way round.
export const DIGITS = '0123456789'.split('').map((ch, i) => ({
  ch, x: 0.5 + (i - 4.5) * MARK_GAP, y: 0.630, kind: 'digit',
}));

// ─── Punctuation ────────────────────────────────────────────────────────────
// Not on a Parker Brothers board and on plenty of homemade ones, and here for a
// reason that is about the model rather than about decoration: these are the
// only marks whose plausibility depends on what has been spelled being FINISHED
// rather than on what could come next. A full stop is likely exactly when the
// live context is itself a whole word and unlikely at every other moment, which
// is the same predictive-text logic the letters use, asked a different question
// — and it is what a phone keyboard does when it offers you a period.
//
// It does not make the board decide where the words are. It makes the board
// able to guess, at about the rate English punctuates, and be wrong.
//
// Four, ordered by how often English actually uses them. No apostrophe: the
// lexicon is /^[a-z]+$/ and has no contractions in it, so an apostrophe could
// never be plausible and would sit on the board as a mark that only ever
// arrived by accident.
export const PUNCTUATION = [
  { ch: '.', w: 1.00 }, { ch: ',', w: 0.85 }, { ch: '?', w: 0.20 }, { ch: '!', w: 0.12 },
].map((m, i, all) => ({
  ...m, kind: 'punct',
  x: 0.5 + (i - (all.length - 1) / 2) * MARK_GAP, y: 0.720,
}));

// ─── The three words ────────────────────────────────────────────────────────
// YES and NO sit at the top corners, and GOODBYE at the foot — and the foot is
// the interesting one. The other hand may only be inside WANDER_BOUNDS, whose
// floor is y 0.755: punctuation at 0.720 is inside it, and GOODBYE at 0.805 is
// not. **The board cannot say goodbye on its own.** It can say yes, it can say
// no, it can put a full stop on the end of a word; only a visitor can take it
// to GOODBYE, and it takes a deliberate pull to do it.
//
// That is the reason GOODBYE sits low rather than tucking up under the
// punctuation — it has to be below a line that everything else is above.
export const WORDS = [
  { ch: 'YES', x: 0.115, y: 0.185, kind: 'word' },
  { ch: 'NO', x: 0.885, y: 0.185, kind: 'word' },
  { ch: 'GOODBYE', x: 0.5, y: 0.805, kind: 'word' },
];

// Everything the cup can stop on, in one flat list — which is the list the
// physics takes and the only one it ever sees. The physics cannot tell a letter
// from a digit from a punctuation mark from a word, and does not need to.
export const MARKS = [...LETTER_ARCS.flat(), ...DIGITS, ...PUNCTUATION, ...WORDS];

// The centre of the letter field: where the cup rests when nothing has happened
// yet, and the point the scene fits the board around. Derived rather than typed
// — it is the mean of the two arcs, and if an arc moves this follows it.
export const BOARD_HOME = (() => {
  const ls = LETTER_ARCS.flat();
  return {
    x: ls.reduce((a, l) => a + l.x, 0) / ls.length,
    y: ls.reduce((a, l) => a + l.y, 0) / ls.length,
  };
})();

// ─── The writing ────────────────────────────────────────────────────────────
// Shown in the scene as the placard, and again on /text/medium/. One copy.
export const EPIGRAPH =
  'The hands are not deceiving anybody. That is the part nobody believes and the part that is true.';

export const SOURCES = {
  carpenter: 'W. B. Carpenter, "On the influence of Suggestion in Modifying and directing Muscular Movement independently of Volition," Proceedings of the Royal Institution 1 (1852), 147–153 — the paper that named the ideomotor principle.',
  faraday: 'Michael Faraday, "Experimental Investigation of Table-Moving," The Athenaeum (2 July 1853) — the apparatus that settled it: a table top in two layers with an index between them. The upper layer, the one under the sitters\' hands, always moved first.',
  gauchou: 'H. L. Gauchou, R. A. Rensink & S. Fels, "Expression of nonconscious knowledge via ideomotor actions," Consciousness and Cognition 21:2 (2012), 976–982 — blindfolded sitters answering factual questions were right 65% of the time through a Ouija board and 50% when asked to say the answer aloud.',
  andersen: 'M. Andersen, K. Nielbo, U. Schjoedt, T. Pfeiffer, A. Roepstorff & J. Sørensen, "Predictive minds in Ouija board sessions," Phenomenology and the Cognitive Sciences 18 (2019), 577–588 — mobile eye-tracking of twenty pairs at a Ouija convention. Two findings are load-bearing here: the combined gaze of the two players predicts the planchette about as well as one player who has been told what to spell, and players predict better with each letter already spelled.',
  kinematics: 'No source, and that is the point: there is no published account of how a planchette actually moves — no speed distributions, no dwell times, no acceleration profiles. A camera-based tracking system for Ouija research was described in 2019, so the instrument exists; the kinematics do not appear to have been published. Everything this scene claims about prediction is sourced. Nothing it claims about motion is.',
  wordlist: 'The lexicon is the english.txt resource of npm most-common-words-by-language @3.0.14 — 9,624 words in frequency order after screening — front-coded to 24KB gzipped and shipped with the page. Nothing is fetched at runtime and no service is called.',
};
