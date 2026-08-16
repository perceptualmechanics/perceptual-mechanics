// ─── Verify links: repeatable check for the shared link store ─────────────
// Two things it checks, both load-bearing and both silent failures
// otherwise:
//
//   1. Every scene's pieces carry a stable, unique-within-that-scene `id`
//      (the addressing scheme src/links.js's `{ scene, id }` pairs depend
//      on — see NOTES.md's "Linking & addressing" entry).
//   2. Every row in src/links.js resolves: `from` names a real piece with
//      the named field (and index, where the field is array-valued), the
//      `phrase` exists verbatim in that field's actual text, and `to`
//      names a real piece.
//
// This replaces a verification pass that used to be run by hand, once, and
// thrown away (see NOTES.md — the library-links round that grew
// LIBRARY_LINKS from 31 to 56 was checked this exact way but the check
// itself was never committed).
//
// Exported as a function, not just a CLI script, so vite.config.js can run
// it as a real build plugin (buildStart) — per this file's own standing
// rule (NOTES.md, "Hook the command people actually run, not the one the
// docs say to run": verification here is almost always a bare
// `npx vite build`, which skips anything only wired as an npm
// pre-lifecycle script). `npm run verify-links` (below) stays as a fast,
// standalone way to run just this check while editing.

import { fragments } from '../src/scenes/sphere/sphere.text.js';
import { poems } from '../src/scenes/orbiter/orbiter.text.js';
import { scrollPieces } from '../src/scenes/scroll/scroll.text.js';
import { BOUNCES } from '../src/scenes/beamline/beamline.text.js';
import { libraryItems, cdRackItems } from '../src/scenes/library/library.text.js';
import { PIECES as theaterPieces } from '../src/scenes/theater/theater.text.js';
import { ORRERY } from '../src/scenes/orrery/orrery.text.js';
import { LINKS } from '../src/links.js';

// Returns { ok, failures, log } — `log` is every line this would otherwise
// print, collected instead of written directly so a caller (the CLI
// wrapper below, or the vite plugin) decides how/whether to show it.
export function verifyLinks() {
  const log = [];
  let failures = 0;
  const fail = msg => { failures++; log.push(`FAIL: ${msg}`); };
  const ok = msg => log.push(`ok: ${msg}`);

  // ── 1. Per-scene id uniqueness ────────────────────────────────────────
  function checkIds(label, items) {
    const ids = items.map(i => i.id);
    const missing = items.filter(i => i.id === undefined).length;
    if (missing) fail(`${label}: ${missing} piece(s) with no id`);
    const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
    if (dupes.length) fail(`${label}: duplicate ids [${[...new Set(dupes)].join(', ')}]`);
    if (!missing && !dupes.length) ok(`${label}: ${items.length} pieces, ids unique`);
  }

  checkIds('sphere', fragments);
  checkIds('orbiter', poems);
  checkIds('scroll', scrollPieces);
  checkIds('beamline', BOUNCES);
  checkIds('library (items)', libraryItems);
  checkIds('library (cds)', cdRackItems);
  checkIds('theater', theaterPieces.flatMap(p => p.scenes));
  if (ORRERY.id === undefined) fail('orrery: ORRERY has no id');
  else ok('orrery: id present');

  // library items and cdRackItems are separate id namespaces sharing one
  // scene name — nothing in LINKS references a cd today, so this doesn't
  // break the checks below, but it's a real asymmetry with every other
  // scene (see NOTES.md) worth flagging every run rather than only once.
  const libraryItemIds = new Set(libraryItems.map(i => i.id));
  const cdIds = new Set(cdRackItems.map(i => i.id));
  const sharedIds = [...libraryItemIds].filter(id => cdIds.has(id));
  if (sharedIds.length) {
    log.push(`note: library items and cdRackItems share ${sharedIds.length} id value(s) — harmless today (no link targets a cd), but a { scene: 'library', id } pair is ambiguous between the two arrays. Flagged, not failed.`);
  }

  // ── 2. Every LINKS row resolves ───────────────────────────────────────
  const scenes = {
    sphere: { items: fragments, fields: { text: it => it.text } },
    orbiter: { items: poems, fields: { stanzas: (it, index) => it.stanzas?.[index] } },
    scroll: { items: scrollPieces, fields: { body: (it, index) => it.body?.[index] } },
    library: {
      items: libraryItems,
      fields: {
        note: it => it.note, scene: it => it.scene,
        excerpt: it => it.excerpt, excerpt_from: it => it.excerpt_from,
      },
    },
  };

  function findPiece(scene, id) {
    const s = scenes[scene];
    if (!s) return undefined;
    return s.items.find(it => it.id === id);
  }

  let checked = 0;
  LINKS.forEach((l, i) => {
    const where = `LINKS[${i}] (${l.from.scene}#${l.from.id} -> ${l.to.scene}#${l.to.id})`;
    const fromScene = scenes[l.from.scene];
    if (!fromScene) { fail(`${where}: unknown source scene "${l.from.scene}"`); return; }
    const fromPiece = findPiece(l.from.scene, l.from.id);
    if (!fromPiece) { fail(`${where}: no piece with id ${l.from.id} in ${l.from.scene}`); return; }
    const fieldFn = fromScene.fields[l.from.field];
    if (!fieldFn) { fail(`${where}: "${l.from.scene}" has no linkable field "${l.from.field}"`); return; }
    const text = fieldFn(fromPiece, l.from.index);
    if (typeof text !== 'string') { fail(`${where}: field "${l.from.field}"${l.from.index !== undefined ? `[${l.from.index}]` : ''} is not a string on piece ${l.from.id}`); return; }
    if (!text.includes(l.phrase)) { fail(`${where}: phrase "${l.phrase}" not found verbatim in ${l.from.scene}#${l.from.id}.${l.from.field}${l.from.index !== undefined ? `[${l.from.index}]` : ''}`); return; }
    const toPiece = findPiece(l.to.scene, l.to.id);
    if (!toPiece) { fail(`${where}: target ${l.to.scene}#${l.to.id} does not resolve`); return; }
    checked++;
  });
  if (checked === LINKS.length) ok(`links.js: all ${LINKS.length} rows resolve (source field + verbatim phrase + target)`);

  return { ok: failures === 0, failures, log };
}

// ─── CLI entry point ────────────────────────────────────────────────────────
// Only runs when this file is executed directly (`node scripts/verify-links.mjs`
// / `npm run verify-links`), not when vite.config.js imports verifyLinks().
if (import.meta.url === `file://${process.argv[1]}`) {
  const { ok, failures, log } = verifyLinks();
  log.forEach(line => console.log(line));
  console.log('');
  if (ok) {
    console.log('All checks passed.');
  } else {
    console.error(`${failures} check(s) failed.`);
    process.exit(1);
  }
}
