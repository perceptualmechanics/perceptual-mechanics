import { readCorpus, flatSentences, wordCount } from '../../utils/corpus.js';
import { FILAPIXEL_COUNT as STATED_COUNT } from './psyshell.count.js';
import * as scroll from '../scroll/scroll.text.js';
import * as theater from '../theater/theater.text.js';
import * as sphere from '../sphere/sphere.text.js';
import * as library from '../library/library.text.js';
import * as orbiter from '../orbiter/orbiter.text.js';
import * as apollo from '../apollo/apollo.text.js';
import * as beamline from '../beamline/beamline.text.js';
import * as orrery from '../orrery/orrery.text.js';
import * as butterfly from '../butterfly/butterfly.text.js';
import * as quiz from '../quiz/quiz.text.js';

const MODULES = { scroll, theater, sphere, library, orbiter, apollo, beamline, orrery, butterfly, quiz };

const ORDER = ['sphere', 'butterfly', 'scroll', 'theater', 'orbiter', 'orrery', 'library', 'beamline', 'apollo', 'quiz'];
const LABELS = {
  sphere: 'The Sphere', butterfly: 'Chaos Butterfly', scroll: 'Selected Works', quiz: 'Quiz',
  theater: 'The Theater', orbiter: 'Orbiter', orrery: 'The Orrery of Los Feliz',
  library: 'The Library', beamline: 'Beamline', apollo: 'Apollo',
};

const corpus = readCorpus(MODULES);
const byKey = Object.fromEntries(flatSentences(corpus).map(c => [c.key, c.sentences]));
const piecesOf = Object.fromEntries(corpus.map(c => [c.key, c.pieces.length]));
const present = ORDER.filter(k => (byKey[k]?.length ?? 0) > 0);

export const TEXTS = [];
const sourceOf = [];
export const SOURCES = [];
for (const key of present) {
  const list = byKey[key];
  SOURCES.push({
    key, label: LABELS[key] ?? key, count: list.length, first: TEXTS.length,
    pieces: piecesOf[key] ?? 0,
    words: list.reduce((a, t) => a + wordCount(t), 0),
  });
  for (const t of list) { TEXTS.push(t); sourceOf.push(SOURCES.length - 1); }
}
export const SOURCE_OF = Uint8Array.from(sourceOf);
export const FILAPIXEL_COUNT = TEXTS.length;
export const PIECE_COUNT = SOURCES.reduce((a, s) => a + s.pieces, 0);
export const CORPUS_WORDS = SOURCES.reduce((a, s) => a + s.words, 0);

export const ABSENT = ['harmonics', 'medium', 'outside'];

{
  const summed = SOURCES.reduce((a, s) => a + s.count, 0);
  if (summed !== FILAPIXEL_COUNT || SOURCE_OF.length !== FILAPIXEL_COUNT) {
    throw new Error(`psyshell: filapixel count disagrees with sentence count — sources sum to ${summed}, texts ${FILAPIXEL_COUNT}, sources ${SOURCE_OF.length}`);
  }
  if (STATED_COUNT !== FILAPIXEL_COUNT) {
    throw new Error(`psyshell: psyshell.count.js says ${STATED_COUNT} filapixels but the corpus has ${FILAPIXEL_COUNT} sentences — set FILAPIXEL_COUNT in psyshell.count.js to ${FILAPIXEL_COUNT}`);
  }
}
export { RADIX, DIGIT_SET, FRACTIONAL_PLACES, baseEDigits, decodeBaseE } from './psyshell.digits.js';

