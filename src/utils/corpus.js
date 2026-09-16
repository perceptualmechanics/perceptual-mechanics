export const SENTENCE_SPLIT = 'prose';

const strip = s => String(s).replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();

export function splitSentences(text) {
  return strip(text)
    .replace(/\.{2,}|…/g, ' ')
    .replace(/—|--/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

export const wordCount = s => strip(s).split(' ').filter(Boolean).length;

export const isSentence = s => /[.!?]$/.test(s) || wordCount(s) > 4;

export const CORPUS_SOURCES = [
  { key: 'scroll', read: m => m.scrollPieces.map(p => p.body) },
  { key: 'theater', read: m => {
    const by = new Map();
    for (const b of m.BEATS) {
      if (!by.has(b.sceneId)) by.set(b.sceneId, []);
      by.get(b.sceneId).push(b.text);
    }
    return [...by.values()];
  } },
  { key: 'sphere', read: m => m.fragments.map(f => [f.text]) },
  { key: 'library', read: m => m.libraryItems.filter(i => i.excerpt).map(i => [i.excerpt]) },
  { key: 'orbiter', read: m => m.poems.map(p => p.stanzas) },
  { key: 'apollo', read: m => m.ELEMENTS.map(e => [e.character, e.note]) },
  { key: 'beamline', read: m => [[m.EPIGRAPH_PRIMARY, m.EPIGRAPH_SECONDARY], ...m.BOUNCES.map(b => [b.text])] },
  { key: 'orrery', read: m => [[m.ORRERY.note]] },
  { key: 'butterfly', read: m => [[m.BUTTERFLY.text]] },
  { key: 'quiz', read: m => [m.PREAMBLE, m.ITEMS.map(i => i.text)] },
];

export function readCorpus(modules) {
  return CORPUS_SOURCES.map(({ key, read }) => {
    const mod = modules[key];
    if (!mod) throw new Error(`corpus: no module supplied for "${key}"`);
    const pieces = read(mod)
      .map(fields => (Array.isArray(fields) ? fields : [fields])
        .filter(v => typeof v === 'string' && v.trim())
        .flatMap(splitSentences)
        .filter(isSentence))
      .filter(p => p.length > 0);
    return { key, pieces };
  });
}

export function flatSentences(corpus) {
  return corpus.map(({ key, pieces }) => ({ key, sentences: pieces.flat() }));
}
