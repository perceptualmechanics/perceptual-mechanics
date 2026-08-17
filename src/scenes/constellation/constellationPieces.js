// ─── Cross-scene piece title resolution ─────────────────────────────────────
// The Constellation is the one scene whose whole premise is synthesizing
// across every other scene at once, so it's the one place on the site
// where importing every other scene's <scene>.text.js is architecturally
// correct rather than bundle bloat — main.js already imports every scene's
// own .js module eagerly (no code-splitting exists yet; see its own static
// import list), so these data-only imports don't add a new eager-load cost,
// only new weight to a bundle that already includes everything.
//
// `resolveEndpointTitle` is deliberately modeled on
// scripts/build-resonances-doc.mjs's own `resolveEndpoint` (same title
// format per scene — "Sphere — "Title" (#14)" and so on) so a strand's
// on-screen payoff panel names a piece exactly the way the reviewed
// doc already does, rather than inventing a second title style. That
// script's version also computes a windowed text excerpt, which this
// doesn't need — the payoff panel shows the resonance's own `rationale`
// (src/resonances.js), not the piece's full text.
import { fragments } from '../sphere/sphere.text.js';
import { poems } from '../orbiter/orbiter.text.js';
import { scrollPieces } from '../scroll/scroll.text.js';
import { BOUNCES } from '../beamline/beamline.text.js';
import { libraryItems, cdRackItems } from '../library/library.text.js';
import { PIECES as theaterPieces, BEATS as theaterBeats } from '../theater/theater.text.js';
import { ORRERY } from '../orrery/orrery.text.js';
import { BUTTERFLY } from '../butterfly/butterfly.text.js';

// Returns { title, pieceId } — `pieceId` is what main.js's pm:navigate
// listener expects as its own `pieceId` (null for theater's beat-addressed
// endpoints and library CD-rack items, neither of which the live site can
// deep-link to at that granularity yet; the jump still lands on the right
// scene, just not pre-opened to that exact item — see each scene's own
// `create()` for what it currently accepts as `initialPieceId`).
export function resolveEndpointTitle(ep) {
  switch (ep.scene) {
    case 'sphere': {
      const p = fragments.find(f => f.id === ep.id);
      return { title: `Sphere — "${p?.title ?? '?'}"`, pieceId: ep.id };
    }
    case 'orbiter': {
      const p = poems.find(f => f.id === ep.id);
      return { title: `Orbiter — "${p?.title ?? '?'}"`, pieceId: ep.id };
    }
    case 'scroll': {
      const p = scrollPieces.find(f => f.id === ep.id);
      return { title: `Scroll — "${p?.title ?? '?'}"`, pieceId: ep.id };
    }
    case 'library': {
      const p = libraryItems.find(f => f.id === ep.id);
      if (p) return { title: `Library — "${p.title}"`, pieceId: ep.id };
      const cd = cdRackItems.find(f => f.id === ep.id);
      // No live deep-link into the CD rack sub-view yet — same caveat as
      // theater's beat addressing below.
      return { title: `Library — "${cd?.album ?? '?'}"`, pieceId: null };
    }
    case 'beamline': {
      const p = BOUNCES.find(f => f.id === ep.id);
      return { title: `Beamline — waypoint #${p?.id ?? ep.id}`, pieceId: ep.id };
    }
    case 'orrery': {
      return { title: `Orrery — "${ORRERY.name}"`, pieceId: ORRERY.id };
    }
    case 'butterfly': {
      return { title: `Butterfly — "${BUTTERFLY.title}"`, pieceId: BUTTERFLY.id };
    }
    case 'theater': {
      if (ep.beatId !== undefined) {
        const b = theaterBeats.find(x => x.id === ep.beatId);
        return { title: `Theater — ${b?.playTitle ?? '?'}, "${b?.sceneSlug ?? '?'}"`, pieceId: null };
      }
      const s = theaterPieces.flatMap(p => p.scenes).find(x => x.id === ep.id);
      return { title: `Theater — scene "${s?.slug ?? '?'}"`, pieceId: null };
    }
    default:
      return { title: `${ep.scene} #${ep.id}`, pieceId: ep.id ?? null };
  }
}
