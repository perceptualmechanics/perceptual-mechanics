
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export const ENTITY_RE = /&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g;

export const isSupportedEntity = (s) => {
  const m = /^&(#x([0-9a-fA-F]+)|#(\d+)|([a-zA-Z][a-zA-Z0-9]*));$/.exec(s);
  if (!m) return false;
  return m[2] !== undefined || m[3] !== undefined || m[4] in NAMED;
};

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
