// ─── Cross-scene piece resolution ───────────────────────────────────────────
// Harmonics is the one scene whose whole premise is synthesizing across
// every other scene at once, so it's the one place on the site where
// importing every other scene's <scene>.text.js is architecturally correct
// rather than bundle bloat — but it's real weight (~280kB combined,
// confirmed via build output), so as of v3.10.1 this module itself is
// dynamic-imported from harmonics.js (loadResolveEndpoint(), called only
// in full mode, only once a node/pending panel is actually opened), not
// pulled in just to draw the landing-tile graph shape. Before that, this
// comment's own reasoning ("main.js already imports every scene eagerly,
// so this doesn't add a new cost") was true under the pre-v3.10.0
// architecture but went stale the moment scenes were split behind
// dynamic import() — a caution for future readers of comments like this
// one: a "this is free because X" justification needs rechecking whenever
// X (here, "every scene loads eagerly anyway") stops being true.
//
// `resolveEndpoint` is deliberately modeled on scripts/build-resonances-
// doc.mjs's own function of the same name (same title format per scene —
// "Sphere — "Title" (#14)" and so on, same per-scene rawText extraction) so
// the live scene shows a piece exactly the way the reviewed doc already
// does, rather than inventing a second convention. Originally
// (`resolveEndpointTitle`, through round 8) this only returned a title —
// the payoff panel showed just the resonance's own `rationale`, not the
// piece's own text. Round 10 (2026-08-18) added real side-by-side passage
// excerpts to the panel, which needs each endpoint's actual raw text too;
// renamed to match what it now returns, and the windowing logic that turns
// `rawText` into a displayed excerpt (given a rationale's quoted spans)
// lives in src/utils/resonanceExcerpts.js, shared with the build script
// rather than reimplemented here.
import { fragments } from '../sphere/sphere.text.js';
import { poems } from '../orbiter/orbiter.text.js';
import { scrollPieces } from '../scroll/scroll.text.js';
import { BOUNCES } from '../beamline/beamline.text.js';
import { libraryItems, cdRackItems } from '../library/library.text.js';
import { PIECES as theaterPieces, BEATS as theaterBeats } from '../theater/theater.text.js';
import { ORRERY } from '../orrery/orrery.text.js';
import { BUTTERFLY } from '../butterfly/butterfly.text.js';
import { stripHtml } from '../../utils/resonanceExcerpts.js';

// Returns { title, pieceId, rawText } — `pieceId` is what main.js's
// pm:navigate listener expects as its own `pieceId` (null for theater's
// beat-addressed endpoints and library CD-rack items, neither of which the
// live site can deep-link to at that granularity yet; the jump still lands
// on the right scene, just not pre-opened to that exact item — see each
// scene's own `create()` for what it currently accepts as `initialPieceId`).
// `rawText` is the same per-scene text extraction build-resonances-doc.mjs
// uses (stripped of HTML for sphere, stanzas/body joined into one string
// for orbiter/scroll, etc.) — turning it into a displayed excerpt is the
// caller's job, via resonanceExcerpts.js's own snippetFor().
export function resolveEndpoint(ep) {
  switch (ep.scene) {
    case 'sphere': {
      const p = fragments.find(f => f.id === ep.id);
      return { title: `Sphere — "${p?.title ?? '?'}"`, pieceId: ep.id, rawText: p ? stripHtml(p.text) : '' };
    }
    case 'orbiter': {
      const p = poems.find(f => f.id === ep.id);
      return { title: `Orbiter — "${p?.title ?? '?'}"`, pieceId: ep.id, rawText: p ? p.stanzas.join(' / ').replace(/\s+/g, ' ') : '' };
    }
    case 'scroll': {
      const p = scrollPieces.find(f => f.id === ep.id);
      return { title: `Scroll — "${p?.title ?? '?'}"`, pieceId: ep.id, rawText: p ? p.body.join(' ') : '' };
    }
    case 'library': {
      // Fall through every field that carries prose, not just the two the
      // shelf usually has. Four of the 128 endpoints resolved to an empty
      // string once the library's `note` field was removed in 4.11, and an
      // empty rawText renders as an empty bordered quote box in the panel.
      // `catalog` is the note a book carries when it has no excerpt (why
      // there is none, usually); `scene` is a film's described scene.
      const p = libraryItems.find(f => f.id === ep.id);
      if (p) return { title: `Library — "${p.title}"`, pieceId: ep.id, rawText: [p.excerpt, p.note, p.scene, p.catalog].filter(Boolean).join(' — ') || '' };
      const cd = cdRackItems.find(f => f.id === ep.id);
      // No live deep-link into the CD rack sub-view yet — same caveat as
      // theater's beat addressing below.
      return { title: `Library — "${cd?.album ?? '?'}"`, pieceId: null, rawText: cd?.note ?? '' };
    }
    case 'beamline': {
      const p = BOUNCES.find(f => f.id === ep.id);
      return { title: `Beamline — waypoint #${p?.id ?? ep.id}`, pieceId: ep.id, rawText: p?.text ?? '' };
    }
    case 'orrery': {
      return { title: `Orrery — "${ORRERY.name}"`, pieceId: ORRERY.id, rawText: ORRERY.note };
    }
    case 'butterfly': {
      return { title: `Butterfly — "${BUTTERFLY.title}"`, pieceId: BUTTERFLY.id, rawText: BUTTERFLY.text };
    }
    case 'theater': {
      if (ep.beatId !== undefined) {
        const b = theaterBeats.find(x => x.id === ep.beatId);
        const speaker = b?.type === 'line' ? `${b.character}: ` : '';
        return { title: `Theater — ${b?.playTitle ?? '?'}, "${b?.sceneSlug ?? '?'}"`, pieceId: null, rawText: b ? `${speaker}${b.text}` : '' };
      }
      // A scene-level endpoint, addressed by scene rather than by beat. Its
      // text is its beats', joined — `rawText: ''` here would render an empty
      // quote box the moment a resonance used one.
      const s = theaterPieces.flatMap(p => p.scenes).find(x => x.id === ep.id);
      const beats = s ? theaterBeats.filter(b => b.sceneSlug === s.slug && b.text) : [];
      return {
        title: `Theater — scene "${s?.slug ?? '?'}"`, pieceId: null,
        rawText: beats.map(b => (b.type === 'line' ? `${b.character}: ` : '') + b.text).join(' ').trim(),
      };
    }
    default:
      return { title: `${ep.scene} #${ep.id}`, pieceId: ep.id ?? null, rawText: '' };
  }
}
