// ─── Build the harmonics resonances review document ────────────────────
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
//
// Quoting rule (fixed after round-1 review flagged several rationales as
// unverifiable from the doc itself): a rationale that claims specific
// overlapping language is only checkable if the doc actually shows that
// language. So instead of always truncating from the start of a piece,
// this pulls every quoted span out of the rationale and, for each
// endpoint, shows a window CENTERED on whichever quote actually appears
// in that piece's text (full text if the piece is short enough that
// there's no point windowing at all). If no quote from the rationale
// matches a given endpoint's text, that's worth knowing too — the
// fallback snippet is clearly labeled as such rather than silently
// passing off an arbitrary opening excerpt as if it were the relevant
// part.
//
// 2026-08-18: the windowing functions themselves (stripHtml, extractQuotes,
// snippetFor) moved into src/utils/resonanceExcerpts.js — Harmonics' own
// live payoff panel needs the exact same logic to show real side-by-side
// passages, not a second reimplementation that could quietly drift from
// what this doc shows.

import { fragments } from '../src/scenes/sphere/sphere.text.js';
import { poems } from '../src/scenes/orbiter/orbiter.text.js';
import { scrollPieces } from '../src/scenes/scroll/scroll.text.js';
import { BOUNCES } from '../src/scenes/beamline/beamline.text.js';
import { libraryItems, cdRackItems } from '../src/scenes/library/library.text.js';
import { PIECES as theaterPieces, BEATS as theaterBeats } from '../src/scenes/theater/theater.text.js';
import { ORRERY } from '../src/scenes/orrery/orrery.text.js';
import { BUTTERFLY } from '../src/scenes/butterfly/butterfly.text.js';
import { RESONANCES } from '../src/resonances.js';
import { stripHtml, extractQuotes, snippetFor, quoteMatched } from '../src/utils/resonanceExcerpts.js';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Returns { title, rawText } for one resonance endpoint — the raw text is
// windowed into a snippet later, once we know which quotes to look for.
function resolveEndpoint(ep) {
  switch (ep.scene) {
    case 'sphere': {
      const p = fragments.find(f => f.id === ep.id);
      return { title: `Sphere — "${p.title}" (#${p.id})`, rawText: stripHtml(p.text) };
    }
    case 'orbiter': {
      const p = poems.find(f => f.id === ep.id);
      return { title: `Orbiter — "${p.title}" (#${p.id})`, rawText: p.stanzas.join(' / ').replace(/\s+/g, ' ') };
    }
    case 'scroll': {
      const p = scrollPieces.find(f => f.id === ep.id);
      return { title: `Scroll — "${p.title}" (#${p.id})`, rawText: p.body.join(' ') };
    }
    case 'library': {
      const p = libraryItems.find(f => f.id === ep.id) ?? cdRackItems.find(f => f.id === ep.id);
      const rawText = [p.excerpt, p.note].filter(Boolean).join(' — ') || '(no excerpt/note on this catalog entry)';
      return { title: `Library — "${p.title}" (#${p.id})`, rawText };
    }
    case 'beamline': {
      const p = BOUNCES.find(f => f.id === ep.id);
      return { title: `Beamline — bounce #${p.id}`, rawText: p.text };
    }
    case 'orrery': {
      return { title: `Orrery — "${ORRERY.name}"`, rawText: ORRERY.note };
    }
    case 'butterfly': {
      return { title: `Butterfly — "${BUTTERFLY.title}"`, rawText: BUTTERFLY.text };
    }
    case 'theater': {
      if (ep.beatId !== undefined) {
        const b = theaterBeats.find(x => x.id === ep.beatId);
        const speaker = b.type === 'line' ? `${b.character}: ` : '';
        return {
          title: `Theater — ${b.playTitle}, "${b.sceneSlug}" (beat #${b.id})`,
          rawText: `${speaker}${b.text}`,
        };
      }
      const s = theaterPieces.flatMap(p => p.scenes).find(x => x.id === ep.id);
      return { title: `Theater — scene "${s.slug}" (#${s.id})`, rawText: '(whole-scene reference, no single beat)' };
    }
    default:
      return { title: `${ep.scene}#${ep.id}`, rawText: '(unknown scene)' };
  }
}

const STATUS_LABEL = { pending: 'PENDING', approved: 'APPROVED', rejected: 'REJECTED' };
const BASIS_LABEL = { verbatim: 'Verbatim — mechanically confirmed shared text', connotative: 'Connotative — thematic/associative, no shared text' };

function renderRow(r) {
  const quotes = extractQuotes(r.rationale);
  const a = resolveEndpoint(r.a);
  const b = resolveEndpoint(r.b);
  // The apparatus belongs here, in the document a reviewer reads, and not in
  // the scene — see quoteMatched()'s comment in resonanceExcerpts.js.
  const unmatched = ' *(no rationale quote matched this piece — opening text shown instead)*';
  const aSnippet = snippetFor(a.rawText, quotes) + (quoteMatched(a.rawText, quotes) ? '' : unmatched);
  const bSnippet = snippetFor(b.rawText, quotes) + (quoteMatched(b.rawText, quotes) ? '' : unmatched);
  return `### ${r.id}. [${STATUS_LABEL[r.status]}]\n\n**${a.title}**\n> ${aSnippet}\n\n**${b.title}**\n> ${bSnippet}\n\n**Rationale:** ${r.rationale}\n`;
}

const counts = { pending: 0, approved: 0, rejected: 0 };
const basisCounts = { verbatim: 0, connotative: 0 };
RESONANCES.forEach(r => { counts[r.status]++; basisCounts[r.basis]++; });

const verbatimRows = RESONANCES.filter(r => r.basis === 'verbatim');
const connotativeRows = RESONANCES.filter(r => r.basis === 'connotative');

function renderSection(rows) {
  return rows.map(renderRow).join('\n---\n\n');
}

const doc = `# harmonics resonances — candidate review

Generated from \`src/resonances.js\` by \`scripts/build-resonances-doc.mjs\` — do not
hand-edit this file, edit \`RESONANCES\` and regenerate instead. This is the
durable, committed review document the harmonics's Layer 2 (cross-scene,
connotative) links depend on: nothing here ships to the live scene until
Scott has read the rationale for a given row and marked it \`approved\` in
\`src/resonances.js\` (a \`rejected\` row stays in the data — kept, not deleted —
so the full discovery pass output stays auditable).

**${RESONANCES.length} candidates: ${basisCounts.verbatim} verbatim, ${basisCounts.connotative} connotative — ${counts.approved} approved, ${counts.pending} pending, ${counts.rejected} rejected.**

Two different kinds of claim, reviewed differently:

- **Verbatim** rows claim two spans of text are mechanically, provably the
  same found passage appearing in two different pieces — checked by
  \`scripts/find-verbatim-overlaps.mjs\` (corpus-wide word-shingle matching),
  not a judgment call. These don't need a close read to confirm; they need
  a decision about whether the connection is worth showing, since the fact
  of it isn't in question.
- **Connotative** rows claim genuine thematic/imagistic/associative
  resonance with no shared source text — the rationale is doing real
  interpretive work here, and is the only thing that makes the claim
  checkable. These need an actual read.

Every quoted phrase in a rationale below is shown, in context, in the
excerpt above it — where a piece is short enough, in full; where it isn't,
centered on the actual matched text rather than truncated from the start.
If an excerpt is instead labeled as not matching any rationale quote,
that's flagged explicitly rather than silently passed off as relevant.

Proposed by two passes: a corpus-wide read across all seven prose/verse
found-text scenes (sphere, orbiter, library, scroll, beamline, theater,
orrery) for connotative candidates, and the mechanical scan above for
verbatim ones. Butterfly was added afterward, addressed by its single line
of found text — its own placard title, "Chaos Butterfly in Phase Space,
2026" — once it was pointed out that the title itself is worth checking
against the corpus, not just the seven scenes with body copy. Deliberately
not exhaustive — quality over coverage, per the standing instruction that a
smaller, defensible list beats a large, noisy one.

---

## Verbatim (${basisCounts.verbatim})

${renderSection(verbatimRows)}

---

## Connotative (${basisCounts.connotative})

${renderSection(connotativeRows)}
`;

// The file in the tree is docs/constellation_resonances.md, from before the
// 2026-08-18 rename. This script pointed at docs/harmonics_resonances.md, so
// running it would have written a SECOND document and orphaned the committed
// one — whose own header says "do not hand-edit, regenerate instead". The
// document keeps its name; only the internal names moved.
const outPath = resolve(__dirname, '../docs/constellation_resonances.md');
writeFileSync(outPath, doc);
console.log(`Wrote ${outPath} (${RESONANCES.length} rows: ${basisCounts.verbatim} verbatim, ${basisCounts.connotative} connotative; ${counts.approved} approved, ${counts.pending} pending, ${counts.rejected} rejected)`);
