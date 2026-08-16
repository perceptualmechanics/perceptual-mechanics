// ─── Build the Constellation resonances review document ────────────────────
// Generates docs/constellation_resonances.md FROM src/resonances.js — the
// doc is a rendering of that data, not a second copy of it, so the two
// can't drift out of sync the way the historical (never-committed)
// library_resonances.md apparently did. Run after any change to
// RESONANCES: `node scripts/build-resonances-doc.mjs`.
//
// This is the durable, committed artifact Scott actually reads: every
// candidate resonance the discovery pass proposed, both pieces' real
// text (not just their ids), the rationale, and current status. Marking
// a row approved or rejected happens in src/resonances.js itself (this
// script only reads that file) — regenerate the doc after any status
// change so the committed copy stays current.

import { fragments } from '../src/scenes/sphere/sphere.text.js';
import { poems } from '../src/scenes/orbiter/orbiter.text.js';
import { scrollPieces } from '../src/scenes/scroll/scroll.text.js';
import { BOUNCES } from '../src/scenes/beamline/beamline.text.js';
import { libraryItems, cdRackItems } from '../src/scenes/library/library.text.js';
import { PIECES as theaterPieces, BEATS as theaterBeats } from '../src/scenes/theater/theater.text.js';
import { ORRERY } from '../src/scenes/orrery/orrery.text.js';
import { RESONANCES } from '../src/resonances.js';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function stripHtml(s) {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(s, n = 220) {
  if (s.length <= n) return s;
  return s.slice(0, n).replace(/\s+\S*$/, '') + '…';
}

// Returns { title, snippet } for one resonance endpoint.
function describe(ep) {
  switch (ep.scene) {
    case 'sphere': {
      const p = fragments.find(f => f.id === ep.id);
      return { title: `Sphere — "${p.title}" (#${p.id})`, snippet: truncate(stripHtml(p.text)) };
    }
    case 'orbiter': {
      const p = poems.find(f => f.id === ep.id);
      return { title: `Orbiter — "${p.title}" (#${p.id})`, snippet: truncate(p.stanzas.join(' / ').replace(/\s+/g, ' ')) };
    }
    case 'scroll': {
      const p = scrollPieces.find(f => f.id === ep.id);
      return { title: `Scroll — "${p.title}" (#${p.id})`, snippet: truncate(p.body[0]) };
    }
    case 'library': {
      const p = libraryItems.find(f => f.id === ep.id) ?? cdRackItems.find(f => f.id === ep.id);
      const snippet = p.excerpt ?? p.note ?? '(no excerpt/note on this catalog entry)';
      return { title: `Library — "${p.title}" (#${p.id})`, snippet: truncate(snippet) };
    }
    case 'beamline': {
      const p = BOUNCES.find(f => f.id === ep.id);
      return { title: `Beamline — bounce #${p.id}`, snippet: truncate(p.text) };
    }
    case 'orrery': {
      return { title: `Orrery — "${ORRERY.name}"`, snippet: truncate(ORRERY.note) };
    }
    case 'theater': {
      if (ep.beatId !== undefined) {
        const b = theaterBeats.find(x => x.id === ep.beatId);
        const speaker = b.type === 'line' ? `${b.character}: ` : '';
        return {
          title: `Theater — ${b.playTitle}, "${b.sceneSlug}" (beat #${b.id})`,
          snippet: truncate(`${speaker}${b.text}`),
        };
      }
      const s = theaterPieces.flatMap(p => p.scenes).find(x => x.id === ep.id);
      return { title: `Theater — scene "${s.slug}" (#${s.id})`, snippet: '(whole-scene reference, no single beat)' };
    }
    default:
      return { title: `${ep.scene}#${ep.id}`, snippet: '(unknown scene)' };
  }
}

const STATUS_LABEL = { pending: 'PENDING', approved: 'APPROVED', rejected: 'REJECTED' };

const counts = { pending: 0, approved: 0, rejected: 0 };
const sections = RESONANCES.map(r => {
  counts[r.status]++;
  const a = describe(r.a);
  const b = describe(r.b);
  return `### ${r.id}. [${STATUS_LABEL[r.status]}]\n\n**${a.title}**\n> ${a.snippet}\n\n**${b.title}**\n> ${b.snippet}\n\n**Rationale:** ${r.rationale}\n`;
}).join('\n---\n\n');

const doc = `# Constellation resonances — candidate review

Generated from \`src/resonances.js\` by \`scripts/build-resonances-doc.mjs\` — do not
hand-edit this file, edit \`RESONANCES\` and regenerate instead. This is the
durable, committed review document the Constellation's Layer 2 (cross-scene,
connotative) links depend on: nothing here ships to the live scene until
Scott has read the rationale for a given row and marked it \`approved\` in
\`src/resonances.js\` (a \`rejected\` row stays in the data — kept, not deleted —
so the full discovery pass output stays auditable).

**${RESONANCES.length} candidates: ${counts.approved} approved, ${counts.pending} pending, ${counts.rejected} rejected.**

Every row was proposed by a single full-corpus reading pass across all seven
found-text scenes (sphere, orbiter, library, scroll, beamline, theater,
orrery — butterfly has no found text) — not a keyword match, an actual
comparative read looking for real thematic, imagistic, or (in a few cases)
literally shared-source-text connections between specific pieces. The list
is deliberately not exhaustive: quality over coverage, per the standing
instruction that a smaller, defensible list beats a large, noisy one.

---

${sections}
`;

const outPath = resolve(__dirname, '../docs/constellation_resonances.md');
writeFileSync(outPath, doc);
console.log(`Wrote ${outPath} (${RESONANCES.length} rows: ${counts.approved} approved, ${counts.pending} pending, ${counts.rejected} rejected)`);
