// ─── Spectra: the measurement ───────────────────────────────────────────────
// Every number this scene draws is computed here, from `theater.text.js`, at
// runtime. Nothing is copied.
//
// That is not a style preference, it is this project's oldest content rule:
// published copies import, they never copy. A baked table of profiles would
// drift the first time a line of dialogue changed, and the drift would be
// invisible — the plate would keep rendering a cast that no longer says those
// words. Importing costs a few milliseconds at scene open and makes drift
// impossible instead of merely unlikely.
//
// It also means this module is the scene's honest content. Spectra publishes no
// new prose; what it publishes is this measurement, which is why its /text/ page
// carries these tables rather than Theater's dialogue (see prerender.js).
//
// ─── Rulers, stated, because every number below is a ruler choice ───────────
// This whole file exists downstream of a 2026-09-02 correction in which a
// corpus measurement was wrong by 3.5x because it never said which export it
// counted. So each decision here is named where it is made, and the /text/ page
// prints them next to the figures rather than burying them in a commit.
//
//   SOURCE       `PIECES` only — the nested source. NOT `BEATS`, which is a
//                flattened index over the same beats and would count every word
//                twice. See STANDARDS.md, "name the export, not the module".
//   SPEAKER      Scoped per play. Two different characters are named Paul (the
//                duck-tour guide in Paul Revere, and Brian's friend in Truth and
//                Beauty) and collapsing them would merge a monologuist with a
//                bar-stool interlocutor.
//   DIALOGUE     A beat's `t` field. Stage directions (`a`) have no speaker and
//                are excluded from every per-speaker figure — they are counted
//                separately as the play's own unattributed voice.
//   FLOOR        100 spoken words. Eight of the 26 speakers fall below it. They
//                are returned, flagged `belowFloor`, so the scene can show the
//                exclusion rather than silently dropping a cast member.
//   SENTENCE     See SENTENCE_SPLIT below — the most contested ruler here.
//   VOCABULARY   See sharedVocabulary() — the second most contested.

import { PIECES } from '../theater/theater.text.js';

const strip = s => String(s).replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
const wordsOf = s => strip(s).split(/\s+/).filter(Boolean);

// ─── Sentence split ─────────────────────────────────────────────────────────
// Words-per-sentence is the feature most sensitive to where a sentence is
// judged to end, and this corpus is full of ellipses, em-dashes and
// interruptions — which is exactly the material a blunt /[.!?]+/ split handles
// worst. Three rules were measured against each other before this one was
// chosen (2026-09-02):
//
//   blunt     every . ! ? is a boundary. An ellipsis is three sentences and
//             "Mr." ends one. This is the naive default.
//   prose     ellipsis and em-dash are NOT boundaries.        ← what ships
//   beatwise  em-dash IS a boundary; a cut-off ends a unit of speech.
//
// `prose` ships because an interrupted or trailing line is dramatically one
// sentence — a character trailing off has not finished three thoughts, they
// have not finished one. The measured spread between the three rules is
// smaller than the choice suggests: Horace moves most, 6.3 -> 7.0 -> 6.6, and
// Todd 3.7 -> 4.4; every other speaker moves by 0.2 or less, because this
// corpus's ellipses mostly sit inside lines rather than at their ends.
//
// Worth knowing when reading the plate: words-per-LINE is untouched by any of
// this. It divides by beat count, which is authored structure, so Paul's 52.8
// — the largest outlier in the cast — is the same number under all three rules.
// The fragile feature and the striking feature are not the same feature.
export const SENTENCE_SPLIT = 'prose';
const splitSentences = t => strip(t)
  .replace(/\.{2,}|…/g, ' ')
  .replace(/—|--/g, ' ')
  // Split *after* terminal punctuation, keeping it attached. Splitting ON the
  // punctuation instead throws it away, and then question and exclamation rates
  // — which are counted by looking for it — read near zero for everybody. That
  // was the first version of this line, and it failed quietly: the numbers were
  // plausible, just uniformly too low.
  .split(/(?<=[.!?])\s+/)
  .map(x => x.trim())
  .filter(Boolean);

const CONTRACTION = /\b\w+['’](s|t|re|ve|ll|d|m)\b/gi;
const FIRST_PERSON = /\b(i|me|my|mine|myself)\b/gi;
// `hell` is deliberately absent. One of these three plays is set in Hell and
// uses the word as a location roughly as often as an oath; counting it would
// make a stage-geography fact look like a character's mouth.
const PROFANITY = /\b(fuck\w*|shit\w*|damn\w*|goddamn\w*|ass|asshole\w*|bitch\w*|bastard\w*|crap\w*|christ)\b/gi;

export const SPEAKER_FLOOR = 100;

// ─── Style features — the elements ──────────────────────────────────────────
// These are the lines a speaker emits. Content vocabulary was measured as the
// candidate element set first and demoted: style separates all 18 qualifying
// speakers where content separates 12, and content mostly separates them by
// *topic* rather than voice — `quack` is a duck tour, `rastafarians` is one
// joke. Both are drawn; style is the plate and content is a second band.
//
// `hi`/`lo` are the plate's axis ends, not observed extremes — a speaker can
// sit at either end without being clipped, and a rescale after new dialogue
// won't silently redraw everyone.
export const FEATURES = [
  { key: 'wordsPerSentence', label: 'words per sentence', lo: 3, hi: 12, unit: '' },
  { key: 'wordsPerLine',     label: 'words per line',     lo: 2, hi: 56, unit: '' },
  { key: 'questionRate',     label: 'questions',          lo: 0, hi: 50, unit: '%' },
  { key: 'exclamationRate',  label: 'exclamations',       lo: 0, hi: 70, unit: '%' },
  { key: 'contractions',     label: 'contractions',       lo: 0, hi: 110, unit: '/1k' },
  { key: 'firstPerson',      label: 'first person',       lo: 0, hi: 110, unit: '/1k' },
  { key: 'profanity',        label: 'profanity',          lo: 0, hi: 20, unit: '/1k' },
];

// ─── Shared vocabulary — the absorption denominator ─────────────────────────
// A play's shared vocabulary is every token used by three or more of its
// qualifying speakers. A speaker's absorption spectrum is the part of that they
// never say.
//
// Per play and per cast, never against a site-wide table. That is the whole
// reason this scene exists at all: the site-wide version of this idea failed
// because emission and absorption came out exact complements of one quantity,
// so the two views carried one piece of information between them. Scoped to a
// cast, absorption answers a different question from emission — *what does
// everyone here say that this person doesn't* — and that is characterization.
//
// No stopword list, no minimum token length, on purpose and after getting it
// wrong. A ~90-word stoplist left Paul Revere with three shared terms, which
// quantises its absorption to 0 / 33 / 67% — a percentage with three possible
// values. Function words are also not noise here: "you" and "we" and "I" carry
// real information about who a character addresses. The cost is that the
// absolute percentages are a ruler choice — they moved up to 10 points across
// the filters tried — while the ORDERING held under every one of them. The
// plate should be read for rank, and the /text/ page says so.
function sharedVocabulary(speakers) {
  const freq = new Map();
  for (const s of speakers) for (const t of s.tokens) freq.set(t, (freq.get(t) || 0) + 1);
  return [...freq.entries()].filter(([, n]) => n >= 3).map(([t]) => t).sort();
}
const tokensOf = t => new Set(strip(t).toLowerCase().match(/[a-z']+/g) ?? []);

function profileFor(name, key, lines) {
  const text = lines.join(' ');
  const wc = wordsOf(text).length;
  const sentences = lines.flatMap(splitSentences);
  const nSent = Math.max(1, sentences.length);
  const per1k = n => Math.round((n / Math.max(1, wc)) * 1000);
  return {
    key, name, words: wc, lines: lines.length, sentences: sentences.length,
    belowFloor: wc < SPEAKER_FLOOR,
    tokens: tokensOf(text),
    features: {
      wordsPerSentence: +(wc / nSent).toFixed(1),
      wordsPerLine:     +(wc / Math.max(1, lines.length)).toFixed(1),
      questionRate:     Math.round(sentences.filter(s => s.includes('?')).length / nSent * 100),
      exclamationRate:  Math.round(sentences.filter(s => s.includes('!')).length / nSent * 100),
      contractions:     per1k((text.match(CONTRACTION) || []).length),
      firstPerson:      per1k((text.match(FIRST_PERSON) || []).length),
      profanity:        per1k((text.match(PROFANITY) || []).length),
    },
  };
}

let cached = null;

// Returns one plate per play. Computed once per page life — the input is a
// static module, so a second call cannot produce a different answer, and the
// scene mounts this in both preview and full mode on the same landing page.
export function measurePlays() {
  if (cached) return cached;
  cached = PIECES.map(piece => {
    const beats = piece.scenes.flatMap(s => s.beats);
    const byChar = new Map();
    for (const b of beats) {
      if (!b.t || !b.c) continue;
      if (!byChar.has(b.c)) byChar.set(b.c, []);
      byChar.get(b.c).push(strip(b.t));
    }
    const all = [...byChar.entries()]
      .map(([c, lines]) => profileFor(piece.characters[c]?.name || c, c, lines))
      .sort((a, b) => b.words - a.words);
    const cast = all.filter(s => !s.belowFloor);
    const shared = sharedVocabulary(cast);

    for (const s of all) {
      s.absorbed = shared.filter(t => !s.tokens.has(t));
      s.absorptionRate = shared.length ? Math.round(s.absorbed.length / shared.length * 100) : 0;
    }
    // A speaker's own lines: tokens repeated at least twice that no other
    // qualifying speaker in the corpus uses at all. Read these as topic more
    // than voice — most of them name what a character is doing rather than how
    // they talk, which is why they are the second band and not the plate.
    const counts = new Map();
    for (const s of cast) {
      const c = new Map();
      for (const w of strip(s.tokens ? [...byChar.get(s.key)].join(' ') : '').toLowerCase().match(/[a-z']+/g) ?? [])
        c.set(w, (c.get(w) || 0) + 1);
      counts.set(s.key, c);
    }
    for (const s of cast) {
      const mine = counts.get(s.key);
      s.ownLines = [...mine.entries()]
        .filter(([w, n]) => n >= 2 && cast.every(o => o.key === s.key || !o.tokens.has(w)))
        .sort((a, b) => b[1] - a[1]).slice(0, 8)
        .map(([w, n]) => ({ term: w, count: n }));
    }
    for (const s of all) if (!s.ownLines) s.ownLines = [];

    const directions = beats.filter(b => b.a && !b.t).map(b => strip(b.a));
    return {
      key: piece.key, title: piece.title, date: piece.date,
      speakers: all, cast, shared,
      spokenWords: all.reduce((n, s) => n + s.words, 0),
      directionWords: wordsOf(directions.join(' ')).length,
      directionBeats: directions.length,
    };
  });
  return cached;
}

// Flattened, for the jump list and for the /text/ page.
export function allSpeakers() {
  return measurePlays().flatMap(p => p.cast.map(s => ({ ...s, play: p.key, playTitle: p.title })));
}
