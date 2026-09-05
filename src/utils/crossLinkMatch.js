// ─── Where a cross-link's phrase actually lands ─────────────────────────────
// NO DOM. That is the entire reason this file exists, and it is worth being
// blunt about why.
//
// `wireCrossLinks` (sceneKit.js) turns a links.js row into an anchor by
// finding its phrase in a piece's own text. `scripts/verify-links.mjs` is the
// build gate that promises every row will find its phrase. Those are the same
// question, and until now they were two different answers: the runtime walked
// a real parsed document, and the gate ran `indexOf` over the raw HTML string
// and a prose description of what the runtime "does". A gate that MODELS the
// thing instead of CALLING it drifts, and the drift is invisible by
// construction, because nothing compares the model to the implementation.
//
// It had already drifted. verify-links still described wireCrossLinks as
// doing "a plain first-occurrence String.replace over HTML", which it had not
// done since the rewrite that fixed the escaping bug — and one of the two
// failure modes it carefully guarded against had become structurally
// impossible in the meantime. Nothing failed. Nothing could have.
//
// So the matching lives here, once, DOM-free, and both sides call it. This is
// `derive, don't type` (STANDARDS.md) pointed at a checker: a gate should not
// describe an algorithm, it should run it.
//
// ─── The rule the original bug was about ───────────────────────────────────
// DECODE BEFORE MATCHING, and never re-encode what you did not decode.
//
// The bug this replaced escaped the phrase and then matched it against
// decoded text, so any phrase containing & < or > silently failed to link.
// Here, text is decoded once, phrases are matched against the decoded form,
// and the OUTPUT reuses the original raw slice rather than re-encoding the
// phrase — so a matched span is byte-identical to what was there before,
// and the only thing that changes anywhere in the document is the insertion
// of an <a> and a </a>.

// The entity forms this understands. Deliberately a short list rather than a
// full HTML5 named-character-reference table (there are 2231 of those, and
// shipping them to a browser to link a phrase would be absurd). The corpus
// today contains ZERO entities of any kind, so this is untested by the real
// text — which is why verify-links asserts that every linkable field stays
// inside this set instead of trusting that it does. A narrow scope that is
// enforced is safe; a narrow scope that is assumed is the next finding.
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

// Anything shaped like an entity, supported or not — the gate uses this to
// find the ones this file would silently pass through as literal text.
export const ENTITY_RE = /&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g;

export const isSupportedEntity = (s) => {
  const m = /^&(#x([0-9a-fA-F]+)|#(\d+)|([a-zA-Z][a-zA-Z0-9]*));$/.exec(s);
  if (!m) return false;
  return m[2] !== undefined || m[3] !== undefined || m[4] in NAMED;
};

// Decode a run of text, and keep a map from each decoded character back to
// where it started in the raw string. The map is what lets the output splice
// anchors in without re-encoding anything: a decoded span [a, b) is exactly
// the raw span [map[a], map[b]).
function decodeRun(raw) {
  let decoded = '';
  const map = [];
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === '&') {
      ENTITY_RE.lastIndex = i;
      const m = ENTITY_RE.exec(raw);
      if (m && m.index === i) {
        const body = m[1];
        let ch = null;
        if (body[0] === '#') {
          const code = body[1] === 'x' || body[1] === 'X'
            ? parseInt(body.slice(2), 16)
            : parseInt(body.slice(1), 10);
          if (Number.isFinite(code) && code >= 0 && code <= 0x10ffff) ch = String.fromCodePoint(code);
        } else if (body in NAMED) {
          ch = NAMED[body];
        }
        if (ch !== null) {
          // One decoded character standing for the whole raw entity.
          for (const c of ch) { decoded += c; map.push(i); }
          i = m.index + m[0].length;
          continue;
        }
      }
    }
    decoded += raw[i]; map.push(i); i++;
  }
  map.push(raw.length);
  return { decoded, map };
}

// Split HTML into markup and text runs. Deliberately narrow: this corpus is
// <p>, <em>, <i> and <br> with no comments, no CDATA, no <script> and no
// <style>, and this is not trying to be an HTML parser. verify-links asserts
// the corpus stays that way, for the same reason as the entity set above.
//
// `linkClass` matters because text already inside one of these anchors is not
// available to a later phrase — which is exactly what the DOM version got
// from `node.parentElement.closest('a.' + linkClass)`. Source text carries no
// anchors today; the ones this has to skip are the ones a previous link in
// the same pass just created.
export function tokenize(html, linkClass) {
  const segs = [];
  const tagRe = /<\/?([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>])*)>/g;
  let pos = 0, m, depth = 0;
  const push = (raw) => {
    if (!raw) return;
    const { decoded, map } = decodeRun(raw);
    segs.push({ kind: 'text', raw, decoded, map, linkable: depth === 0 });
  };
  while ((m = tagRe.exec(html))) {
    push(html.slice(pos, m.index));
    const name = m[1].toLowerCase();
    const closing = m[0][1] === '/';
    const selfClosing = m[0].endsWith('/>');
    if (name === 'a' && !selfClosing) {
      if (closing) { if (depth > 0) depth--; }
      else if (!linkClass || new RegExp(`class\\s*=\\s*["'][^"']*\\b${linkClass}\\b`).test(m[2])) depth++;
    }
    segs.push({ kind: 'markup', raw: m[0] });
    pos = m.index + m[0].length;
  }
  push(html.slice(pos));
  return segs;
}

/**
 * Decide where each phrase lands, in order, exactly as wrapping them one at a
 * time would. Returns one entry per phrase: `{ seg, start, end }` in decoded
 * coordinates, or `null` for a phrase with nowhere to go.
 *
 * A phrase cannot span a tag boundary (it is one text node's worth of text),
 * and once a span is claimed it is invisible to every later phrase — both of
 * which are what the DOM version got for free from splitText plus the
 * already-inside-an-anchor guard.
 */
export function crossLinkPlan(html, phrases, linkClass) {
  const segs = tokenize(html, linkClass);
  // Free ranges per text segment, in document order. A claim splits one range
  // into the part before it and the part after, which is precisely the pair of
  // text nodes splitText leaves either side of the new anchor.
  const free = segs.map(s => (s.kind === 'text' && s.linkable ? [[0, s.decoded.length]] : []));

  return phrases.map((phrase) => {
    if (!phrase) return null;
    for (let si = 0; si < segs.length; si++) {
      const ranges = free[si];
      if (!ranges.length) continue;
      const { decoded } = segs[si];
      for (let ri = 0; ri < ranges.length; ri++) {
        const [lo, hi] = ranges[ri];
        const at = decoded.indexOf(phrase, lo);
        if (at === -1 || at + phrase.length > hi) continue;
        const end = at + phrase.length;
        const replacement = [];
        if (at > lo) replacement.push([lo, at]);
        if (end < hi) replacement.push([end, hi]);
        ranges.splice(ri, 1, ...replacement);
        return { seg: si, start: at, end };
      }
    }
    return null;
  });
}

const escapeAttr = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The plan, rendered. `open(link)` returns the opening tag for a link; the
 * matched text between the tags is the ORIGINAL RAW SLICE, never a
 * re-encoding of the phrase, so nothing outside the inserted tags changes by
 * so much as a byte.
 */
export function applyCrossLinkPlan(html, links, linkClass, plan) {
  const segs = tokenize(html, linkClass);
  // Claims grouped by segment, ascending, so one pass emits each segment.
  const bySeg = new Map();
  plan.forEach((hit, i) => {
    if (!hit) return;
    if (!bySeg.has(hit.seg)) bySeg.set(hit.seg, []);
    bySeg.get(hit.seg).push({ ...hit, link: links[i] });
  });
  for (const list of bySeg.values()) list.sort((a, b) => a.start - b.start);

  let out = '';
  segs.forEach((s, si) => {
    if (s.kind === 'markup') { out += s.raw; return; }
    const claims = bySeg.get(si);
    if (!claims) { out += s.raw; return; }
    let cursor = 0;
    for (const c of claims) {
      out += s.raw.slice(s.map[cursor], s.map[c.start]);
      out += `<a class="${escapeAttr(linkClass)}" href="#${escapeAttr(c.link.to.scene)}/${escapeAttr(c.link.to.id)}"`
           + ` data-target-scene="${escapeAttr(c.link.to.scene)}" data-target-id="${escapeAttr(c.link.to.id)}">`
           + s.raw.slice(s.map[c.start], s.map[c.end])
           + '</a>';
      cursor = c.end;
    }
    out += s.raw.slice(s.map[cursor]);
  });
  return out;
}
