// ─── Resonance excerpt windowing ────────────────────────────────────────────
// Shared by scripts/build-resonances-doc.mjs (the committed review doc) and
// src/scenes/harmonics/harmonicsPieces.js (Harmonics' own live
// side-by-side passage display, 2026-08-18) — both need the exact same
// answer to "given a rationale's quoted language and a piece's full raw
// text, what's the relevant excerpt to show." Originally written once,
// inline, in the build script; pulled out here rather than reimplemented a
// second time for the live scene, so the two never drift into showing
// different windows for the same row.
//
// Quoting rule (unchanged from the build script's own original comment): a
// rationale that claims specific overlapping language is only checkable if
// the shown excerpt actually contains that language. So instead of always
// truncating from the start of a piece, this pulls every quoted span out of
// the rationale and, for each endpoint, shows a window CENTERED on whichever
// quote actually appears in that piece's text (full text if the piece is
// short enough that there's no point windowing at all). If no quote from
// the rationale matches a given endpoint's text, that's worth knowing too —
// the excerpt falls back to the piece's opening — and quoteMatched() below
// reports that, so the fact reaches the review doc and the build check
// rather than the scene's own panel.
//
// Plain functions, no DOM/Node dependency either way — safe to import from
// a Vite-bundled browser module (harmonicsPieces.js) or a bare `node`
// script (build-resonances-doc.mjs) alike.

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

// Pull every "quoted span" out of a rationale string — straight or
// typographic double quotes, 4+ characters, since shorter than that is too
// generic to be worth locating. A quote sometimes spans an ellipsis
// ("I'm the lasing medium... THE MIRROR") standing in for real intervening
// text this piece actually has — that whole span won't appear contiguously
// anywhere, so each side of the ellipsis is also offered as its own
// candidate quote to search for independently.
export function extractQuotes(rationale) {
  const matches = [...rationale.matchAll(/["“]([^"”]{4,200})["”]/g)];
  const raw = matches.map(m => m[1]);
  const withSplits = raw.flatMap(q => [q, ...q.split(/\.\.\.|…/)]);
  return withSplits
    .map(trimEdgePunctuation)
    .filter(q => q.length >= 4);
}

// Given a piece's raw text and the rationale's quotes, find the first quote
// (normalized, so punctuation/case differences don't block a match) that
// actually appears in this piece, and return a window of context around it.
// Returns null if no quote matches.
function findQuoteWindow(rawText, quotes) {
  const normText = normalizeForSearch(rawText);
  for (const quote of quotes) {
    const normQuote = normalizeForSearch(quote);
    if (!normQuote) continue;
    const idx = normText.indexOf(normQuote);
    if (idx === -1) continue;
    // Map the normalized-text index back onto the raw text approximately by
    // locating the same fraction of the way through — normalization only
    // strips/collapses whitespace and quote-character style, so raw and
    // normalized text stay close enough in length for this to land in the
    // right neighborhood; the window is generous specifically to absorb
    // that slack.
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

// True when a rationale's quoted language can actually be located in this
// piece — i.e. when snippetFor is about to return a window centred on the
// claim rather than an arbitrary opening excerpt.
//
// Separate from snippetFor because the two consumers want different things
// from the same fact. It matters to whoever is REVIEWING the resonance —
// a rationale claiming overlapping language that isn't there is the thing
// review exists to catch — and not at all to somebody reading the scene, who
// did not file the rationale and cannot act on it. So the build doc prints
// it, scripts/verify-resonances.mjs counts it, and the scene shows the
// excerpt on its own.
//
// The live panel used to append "(no rationale quote matched this piece —
// showing opening text instead)" to the excerpt itself, in pull-quote
// italics, for 10 of the 128 slots.
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
