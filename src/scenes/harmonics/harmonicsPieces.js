import { fragments } from '../sphere/sphere.text.js';
import { poems } from '../orbiter/orbiter.text.js';
import { scrollPieces } from '../scroll/scroll.text.js';
import { BOUNCES } from '../beamline/beamline.text.js';
import { libraryItems, cdRackItems } from '../library/library.text.js';
import { PIECES as theaterPieces, BEATS as theaterBeats } from '../theater/theater.text.js';
import { ORRERY } from '../orrery/orrery.text.js';
import { BUTTERFLY } from '../butterfly/butterfly.text.js';
import { stripHtml } from '../../utils/resonanceExcerpts.js';

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
      const p = libraryItems.find(f => f.id === ep.id);
      if (p) return { title: `Library — "${p.title}"`, pieceId: ep.id, rawText: [p.excerpt, p.note, p.scene, p.catalog].filter(Boolean).join(' — ') || '' };
      const cd = cdRackItems.find(f => f.id === ep.id);
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
