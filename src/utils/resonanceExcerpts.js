
export const FULL_TEXT_THRESHOLD = 500; // pieces at or under this length are shown whole, no windowing needed
export const WINDOW_CONTEXT = 160; // chars of context on each side of a located quote

export function stripHtml(s) {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeForSearch(s) {
  return s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function trimEdgePunctuation(s) {
  return s.replace(/^[\s,.;:!?—–\-"']+/, '').replace(/[\s,.;:!?—–\-"']+$/, '');
}

export function extractQuotes(rationale) {
  const matches = [...rationale.matchAll(/["“]([^"”]{4,200})["”]/g)];
  const raw = matches.map(m => m[1]);
  const withSplits = raw.flatMap(q => [q, ...q.split(/\.\.\.|…/)]);
  return withSplits
    .map(trimEdgePunctuation)
    .filter(q => q.length >= 4);
}

function findQuoteWindow(rawText, quotes) {
  const normText = normalizeForSearch(rawText);
  for (const quote of quotes) {
    const normQuote = normalizeForSearch(quote);
    if (!normQuote) continue;
    const idx = normText.indexOf(normQuote);
    if (idx === -1) continue;
    const ratio = rawText.length / normText.length;
    const rawIdx = Math.max(0, Math.round(idx * ratio));
    const from = Math.max(0, rawIdx - WINDOW_CONTEXT);
    const to = Math.min(rawText.length, rawIdx + normQuote.length + WINDOW_CONTEXT);
    const prefix = from > 0 ? '…' : '';
    const suffix = to < rawText.length ? '…' : '';
    return `${prefix}${rawText.slice(from, to).trim()}${suffix}`;
  }
  return null;
}

export function quoteMatched(rawText, quotes) {
  if (rawText.length <= FULL_TEXT_THRESHOLD) return true;
  return findQuoteWindow(rawText, quotes) !== null;
}

export function snippetFor(rawText, quotes) {
  if (rawText.length <= FULL_TEXT_THRESHOLD) return rawText.trim();
  const windowed = findQuoteWindow(rawText, quotes);
  if (windowed) return windowed;
  return rawText.slice(0, 300).replace(/\s+\S*$/, '') + '…';
}
