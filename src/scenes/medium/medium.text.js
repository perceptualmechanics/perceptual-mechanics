
export const MARK_GAP = 0.069;

const arcLength = (s, radius, ry, n = 2048) => {
  const speed = t => Math.hypot(radius * Math.cos(t), ry * Math.sin(t));
  const h = s / n;
  let sum = speed(-s / 2) + speed(s / 2);
  for (let i = 1; i < n; i++) sum += speed(-s / 2 + i * h) * (i % 2 ? 4 : 2);
  return (sum * h) / 3;
};

const ARC = (chars, gap, radius, cy, ry) => {
  const n = chars.length;
  const want = gap * (n - 1);

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

  const STEPS = 4000;
  const t0 = -spread / 2, dt = spread / STEPS;
  const speed = t => Math.hypot(radius * Math.cos(t), ry * Math.sin(t));
  const cum = new Float64Array(STEPS + 1);
  for (let i = 1; i <= STEPS; i++) {
    cum[i] = cum[i - 1] + ((speed(t0 + (i - 1) * dt) + speed(t0 + i * dt)) / 2) * dt;
  }
  const total = cum[STEPS];

  let j = 0;
  return chars.split('').map((ch, i) => {
    const target = (i / (n - 1)) * total;
    while (j < STEPS && cum[j + 1] < target) j++;
    const seg = cum[j + 1] - cum[j];
    const t = t0 + (j + (seg > 0 ? (target - cum[j]) / seg : 0)) * dt;
    return { ch, x: 0.5 + Math.sin(t) * radius, y: cy + (1 - Math.cos(t)) * ry, kind: 'letter' };
  });
};

export const CARD = { x0: 0.02, y0: 0.13, x1: 0.98, y1: 0.87 };

export const LETTER_ARCS = [
  ARC('ABCDEFGHIJKLM', MARK_GAP, 0.46, 0.245, 0.13),
  ARC('NOPQRSTUVWXYZ', MARK_GAP, 0.41, 0.440, 0.11),
];

export const DIGITS = '0123456789'.split('').map((ch, i) => ({
  ch, x: 0.5 + (i - 4.5) * MARK_GAP, y: 0.630, kind: 'digit',
}));

export const PUNCTUATION = [
  { ch: '.', w: 1.00 }, { ch: ',', w: 0.85 }, { ch: '?', w: 0.20 }, { ch: '!', w: 0.12 },
].map((m, i, all) => ({
  ...m, kind: 'punct',
  x: 0.5 + (i - (all.length - 1) / 2) * MARK_GAP, y: 0.720,
}));

export const WORDS = [
  { ch: 'YES', x: 0.115, y: 0.185, kind: 'word' },
  { ch: 'NO', x: 0.885, y: 0.185, kind: 'word' },
  { ch: 'GOODBYE', x: 0.5, y: 0.805, kind: 'word' },
];

export const MARKS = [...LETTER_ARCS.flat(), ...DIGITS, ...PUNCTUATION, ...WORDS];

export const BOARD_HOME = (() => {
  const ls = LETTER_ARCS.flat();
  return {
    x: ls.reduce((a, l) => a + l.x, 0) / ls.length,
    y: ls.reduce((a, l) => a + l.y, 0) / ls.length,
  };
})();

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
