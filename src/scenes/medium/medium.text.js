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
const ARC = (chars, spread, radius, cy, ry) =>
  chars.split('').map((ch, i) => {
    const t = (i / (chars.length - 1) - 0.5) * spread;
    return { ch, x: 0.5 + Math.sin(t) * radius, y: cy + (1 - Math.cos(t)) * ry, kind: 'letter' };
  });

// Wide, and wider than the first version, which held both arcs inside the middle
// two thirds of the card and left a margin of blank board either side that
// nothing ever used. A real board runs its letters nearly to the edge — that is
// what makes the shape read as a board rather than as a caption — and spreading
// them also spreads the cup's travel, so a letter is a journey rather than a
// nudge.
//
// It is not free, and the price was measured rather than waved at. Spreading the
// arcs pushes A, O and the other end letters away from where the cup spends its
// time, and the board's vowel share falls about two and a half points: 35.6% to
// 33.3% with nobody touching, 32.9% to 30.7% with a hand resting on it, against
// English's 38.1%. An intermediate radius bought none of it back. Two and a half
// points for a board that looks like a board is the right trade; the number is
// here so that nobody spends an afternoon rediscovering the cost.
//
// The letters stay closer together than twice DWELL_RADIUS at this spread —
// 0.051 apart against a 0.048 catchment, so the discs overlap — which means the
// arcs are continuous and there is no dead ground between two letters where the
// cup catches nothing.
export const LETTER_ARCS = [
  ARC('ABCDEFGHIJKLM', 1.72, 0.45, 0.255, 0.22),
  ARC('NOPQRSTUVWXYZ', 1.60, 0.40, 0.455, 0.18),
];

export const DIGITS = '0123456789'.split('').map((ch, i) => ({
  ch, x: 0.5 + (i / 9 - 0.5) * 0.60, y: 0.715, kind: 'digit',
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
  x: 0.5 + (i / (all.length - 1) - 0.5) * 0.20, y: 0.805,
}));

// ─── The three words ────────────────────────────────────────────────────────
// YES and NO sit at the top corners, and GOODBYE at the foot — and the foot is
// the interesting one. The other hand may only be inside WANDER_BOUNDS, whose
// floor is y 0.83: punctuation at 0.805 is inside it, and GOODBYE at 0.885 is
// not. **The board cannot say goodbye on its own.** It can say yes, it can say
// no, it can put a full stop on the end of a word; only a visitor can take it
// to GOODBYE, and it takes a deliberate pull to do it.
//
// That is the reason GOODBYE sits at 0.885 rather than tucking up under the
// digits — it has to be below a line that everything else is above.
//
// That is not a flourish. Scott's rule for the scene is that it has neither a
// beginning nor an end, only a state, so nothing here may be an ending — the
// board does not close, the partner does not leave, the tape is not torn off.
// Taking GOODBYE clears what has been spelled and the other hand goes still for
// a moment, and then it starts again, because it always does.
export const WORDS = [
  { ch: 'YES', x: 0.155, y: 0.125, kind: 'word' },
  { ch: 'NO', x: 0.845, y: 0.125, kind: 'word' },
  { ch: 'GOODBYE', x: 0.5, y: 0.885, kind: 'word' },
];

// Everything the cup can stop on, in one flat list — which is the list the
// physics takes and the only one it ever sees. The physics cannot tell a letter
// from a digit from a word, and does not need to.
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
  andersen: 'M. Andersen, K. Nielbo, U. Schjoedt, T. Pfeiffer, A. Roepstorff & J. Sørensen, "Predictive minds in Ouija board sessions," Phenomenology and the Cognitive Sciences 18 (2019), 577–588 — eye-tracking during real sessions: sitters predict the letter before the planchette reaches it, and predict better together than alone.',
  wordlist: 'The lexicon is the english.txt resource of npm most-common-words-by-language @3.0.14 — 9,624 words in frequency order after screening — front-coded to 24KB gzipped and shipped with the page. Nothing is fetched at runtime and no service is called.',
};
