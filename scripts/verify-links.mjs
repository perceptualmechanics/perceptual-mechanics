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
// Namespace import as well as the named one above, deliberately: a named
// `import { RENDERED_FIELDS }` of an export that doesn't exist yet is a
// link-time SyntaxError that takes down the whole build (and every other
// agent's build) rather than producing the specific, explainable failure
// check 4 below wants to produce. Same module instance either way.
import * as linkStore from '../src/links.js';
import { pathToFileURL } from 'node:url';

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


  // ── 3. Phrase collisions within a render group ────────────────────────
  // sceneKit.js's wireCrossLinks() wraps each link by doing a plain
  // first-occurrence String.replace over HTML it has already replaced into
  // for the earlier links in the same group. That makes two silent
  // wrong-text failures possible, neither of which any check above would
  // notice (every phrase in both cases still exists verbatim, so check 2
  // passes and the build ships a link pointing at the wrong words):
  //
  //   * One phrase is a substring of another in the same group. Whichever
  //     runs first eats text belonging to the other -- if the short one
  //     goes first it consumes the long one's opening words, and if the
  //     long one goes first the short one's replace then lands inside the
  //     anchor markup that was just injected.
  //   * A phrase occurs more times in the source text than there are links
  //     using it. First-occurrence replace silently picks occurrence #1;
  //     if the author meant the second one, the link renders on the wrong
  //     sentence and looks completely fine.
  //
  // There are zero of either today, but that's luck rather than design: 41
  // phrases are 12 characters or shorter and two are a bare em dash, so
  // the next short phrase added is one coincidence away from breaking a
  // neighbour. This check turns the accident into a guarantee.
  //
  // The group key includes `index`, not just { scene, id, field }: that is
  // exactly what getOutboundLinks(scene, id, field, index) filters on and
  // therefore exactly the set of links wireCrossLinks() is handed for one
  // string. Two links in different stanzas of the same poem are replaced
  // against two different strings and cannot collide, so keying without
  // the index would fail builds over pairs that are actually fine.
  function countOccurrences(haystack, needle) {
    if (!needle) return 0;
    let n = 0;
    let at = 0;
    for (;;) {
      const found = haystack.indexOf(needle, at);
      if (found === -1) return n;
      n++;
      at = found + needle.length;
    }
  }

  const groups = new Map();
  LINKS.forEach((l, i) => {
    const f = l.from;
    const key = JSON.stringify([f.scene, f.id, f.field, f.index]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ link: l, i });
  });

  let collisions = 0;
  groups.forEach(entries => {
    const f = entries[0].link.from;
    const slot = `${f.scene}#${f.id}.${f.field}${f.index !== undefined ? `[${f.index}]` : ''}`;

    for (let a = 0; a < entries.length; a++) {
      for (let b = 0; b < entries.length; b++) {
        if (a === b) continue;
        const pa = entries[a].link.phrase;
        const pb = entries[b].link.phrase;
        if (typeof pa !== 'string' || typeof pb !== 'string') continue;
        if (pa === pb) {
          if (a < b) {
            collisions++;
            fail(`${slot}: LINKS[${entries[a].i}] and LINKS[${entries[b].i}] use the identical phrase "${pa}" in the same render group — wireCrossLinks would wrap the same occurrence twice, nesting one anchor inside the other. Give them distinct phrases.`);
          }
        } else if (pb.includes(pa)) {
          collisions++;
          fail(`${slot}: phrase "${pa}" (LINKS[${entries[a].i}]) is a substring of "${pb}" (LINKS[${entries[b].i}]) in the same render group — first-occurrence replace makes one of them land on the other's text. Lengthen the shorter phrase so neither contains the other.`);
        }
      }
    }

    // Occurrence counts, for the groups whose source text resolves (any
    // that don't have already been failed by check 2 above).
    const sceneEntry = scenes[f.scene];
    const piece = findPiece(f.scene, f.id);
    const fieldFn = sceneEntry?.fields?.[f.field];
    if (!sceneEntry || !piece || !fieldFn) return;
    const text = fieldFn(piece, f.index);
    if (typeof text !== 'string') return;

    const wanted = new Map();
    entries.forEach(({ link }) => wanted.set(link.phrase, (wanted.get(link.phrase) ?? 0) + 1));
    wanted.forEach((expected, phrase) => {
      const actual = countOccurrences(text, phrase);
      if (actual !== expected) {
        collisions++;
        fail(`${slot}: phrase "${phrase}" occurs ${actual} time(s) in the source text but ${expected} link(s) use it — first-occurrence replace can't tell which occurrence was meant. Extend the phrase until it appears exactly ${expected} time(s).`);
      }
    });
  });
  if (!collisions) ok(`phrase collisions: none across ${groups.size} render group(s) (no phrase contains another, every phrase occurs exactly as often as it is linked)`);

  // ── 4. Every link is authored into a field its scene actually renders ──
  // A link whose `from.field` names content the scene withholds is the
  // worst kind of half-broken: verify checks 1-3 all pass (the piece is
  // real, the field is real, the phrase is verbatim), getInboundLinks()
  // reports it on the target side, so the target piece really does say
  // "Referenced from X" — but the source side has no clickable phrase
  // anywhere, because the text holding it is never put on screen. The
  // relationship exists in one direction only, and nothing errors.
  //
  // This is a live bug, not a hypothetical: 81 of Library's 85 links are
  // authored into `note`, a field the Library scene does not display.
  //
  // RENDERED_FIELDS (src/links.js) is the scene -> displayed-fields map
  // that makes this checkable. It is required, never optional: silently
  // skipping this check when the map is missing would restore exactly the
  // silent half-existence it exists to catch, so a missing map is a hard
  // stop rather than a degraded pass.
  const RENDERED_FIELDS = linkStore.RENDERED_FIELDS;
  if (!RENDERED_FIELDS) {
    throw new Error(
      'verify-links: src/links.js does not export RENDERED_FIELDS, so the ' +
      'rendered-field check below cannot run. It is deliberately NOT ' +
      'skippable — a link authored into a field its scene withholds passes ' +
      'every other check in this file while being invisible on the source ' +
      'side. Add `export const RENDERED_FIELDS` to src/links.js (scene name ' +
      '-> the set of content fields that scene actually displays) rather ' +
      'than removing this guard.'
    );
  }

  // Accepts a Set, an array, or a plain object of field -> truthy, so this
  // doesn't break over which container src/links.js picked.
  function rendersField(rendered, field) {
    if (rendered instanceof Set) return rendered.has(field);
    if (Array.isArray(rendered)) return rendered.includes(field);
    if (rendered && typeof rendered === 'object') return Boolean(rendered[field]);
    return false;
  }
  function renderedFieldNames(rendered) {
    if (rendered instanceof Set) return [...rendered];
    if (Array.isArray(rendered)) return rendered;
    if (rendered && typeof rendered === 'object') return Object.keys(rendered).filter(k => rendered[k]);
    return [];
  }

  // Two different states, deliberately kept apart. A field that appears in
  // NEITHER map is an error — a typo, or a field somebody added to the data
  // and never wired to anything. A field listed in WITHHELD_FIELDS is a
  // stated editorial decision (library's `note`, withheld 2026-07-23), so it
  // gets counted and reported rather than failing the build. Collapsing the
  // two would mean either failing on 81 rows that are deliberately the way
  // they are, or staying silent about a genuine mistake; the whole point of
  // the second map is that "we chose this" and "we mistyped this" stop
  // looking identical to the verifier.
  //
  // Since v4.0 getInboundLinks() also filters on RENDERED_FIELDS, so a link
  // from a withheld field is now invisible from BOTH ends rather than
  // dangling from one. That is what makes reporting sufficient here.
  const WITHHELD_FIELDS = linkStore.WITHHELD_FIELDS ?? {};
  let unknownFields = 0;
  const withheldRows = [];

  // isRenderedField() takes the piece id since v4.0.2, because "does the
  // scene show this field?" stopped having one answer for the whole field:
  // library renders a note only for the items whose note is load-bearing in
  // the link graph. Asking it per row, id included, is the only way this
  // check reflects what a visitor actually sees.
  const conditionalRows = [];
  LINKS.forEach((l, i) => {
    const rendered = RENDERED_FIELDS[l.from.scene];
    if (rendered === undefined) {
      unknownFields++;
      fail(`LINKS[${i}]: RENDERED_FIELDS has no entry for scene "${l.from.scene}" — add one (even an empty set) so it's a stated decision rather than an omission.`);
      return;
    }
    // Unconditionally rendered.
    if (rendersField(rendered, l.from.field)) return;

    // Conditionally rendered, and this particular piece qualifies.
    if (linkStore.isRenderedField(l.from.scene, l.from.field, l.from.id)) {
      conditionalRows.push(l);
      return;
    }

    // Declared withheld, and not rescued by a condition. Reported, not failed.
    if (rendersField(WITHHELD_FIELDS[l.from.scene], l.from.field)) {
      withheldRows.push(l);
      return;
    }
    unknownFields++;
    fail(`LINKS[${i}] (${l.from.scene}#${l.from.id} -> ${l.to.scene}#${l.to.id}): "${l.from.field}" is neither in RENDERED_FIELDS.${l.from.scene} (${renderedFieldNames(rendered).join(', ') || 'nothing'}) nor declared in WITHHELD_FIELDS.${l.from.scene}, and no conditional rule covers piece #${l.from.id}. Either the field name is wrong, or the scene gained a field nobody declared. A link into an undeclared field passes every other check in this file while being invisible on the source side.`);
  });

  // The invariant that makes conditional visibility safe. Every row authored
  // into a conditional field MUST have its source piece covered by that
  // condition — otherwise the link is invisible on the source side, which is
  // the whole failure this feature exists to prevent, quietly reintroduced.
  // No scene has a conditional field as of 4.11.21 — library's `note`, the
  // only one there has ever been, went with the notes themselves — so this
  // loop has nothing to iterate. It stays because the invariant is about the
  // mechanism, not about that field: the next scene to want per-item
  // visibility gets the check for free rather than rediscovering why it needs
  // one.
  const CONDITIONAL_FIELDS = linkStore.CONDITIONAL_FIELDS ?? {};
  let uncovered = 0;
  LINKS.forEach((l, i) => {
    const cond = CONDITIONAL_FIELDS[l.from.scene]?.[l.from.field];
    if (!cond) return;
    if (cond(l.from.id) === true) return;
    uncovered++;
    fail(`LINKS[${i}] (${l.from.scene}#${l.from.id} -> ${l.to.scene}#${l.to.id}): "${l.from.field}" is a conditionally-rendered field, but the condition does not cover piece #${l.from.id} — so this link's phrase is authored into content the scene will not display, and there is nothing to click.`);
  });
  if (!uncovered && conditionalRows.length) {
    ok(`conditional fields: ${conditionalRows.length} row(s) render from a conditional field, all covered`);
  }

  // ── 5. Nothing unpublishable rides along when a field is switched on ──
  // This scanned every library `note` that a cross-link was about to publish,
  // looking for the marks of a working note — "flag for Scott", a bare ISBN,
  // a dated quote — and failed the build rather than let one go out. It found
  // eight, and it was right about all eight.
  //
  // It is gone with the field, and the lesson it was built from is the one to
  // carry forward rather than the code: **turning a field on publishes every
  // word in it, not just the words you had in mind.** The check to write is
  // the one for whatever field gets switched on next; there is no way to
  // write it in advance, because the marks of "not meant to be read" are
  // specific to what the field was being used for.
  //
  // The deeper version, learned the hard way in 4.11.21: it was never really
  // a question about which notes were publishable. None of them should have
  // been there. A field nobody asked for is not made safe by scanning it.

  if (!unknownFields) {
    ok(`rendered fields: all ${LINKS.length} rows link from a field that is either rendered or explicitly declared withheld`);
  }
  if (withheldRows.length) {
    const byScene = new Map();
    withheldRows.forEach(l => {
      const key = `${l.from.scene}.${l.from.field}`;
      byScene.set(key, (byScene.get(key) ?? 0) + 1);
    });
    const summary = [...byScene].map(([k, n]) => `${n} from ${k}`).join(', ');
    ok(`withheld fields: ${withheldRows.length} row(s) link from deliberately unrendered content (${summary}) — invisible from both ends by design, see WITHHELD_FIELDS in src/links.js`);
  }

  return { ok: failures === 0, failures, log };
}

// ─── CLI entry point ────────────────────────────────────────────────────────
// Only runs when this file is executed directly (`node scripts/verify-links.mjs`
// / `npm run verify-links`), not when vite.config.js imports verifyLinks().
// pathToFileURL(), not a `file://` + argv[1] template. Building the URL by
// concatenation gets the escaping wrong for any path containing a space or
// a non-ASCII character (both need percent-encoding in a file URL), so the
// two strings never match and the guard is simply false -- the script
// exits 0 having verified nothing at all, which for a verification script
// is the worst available failure mode: a silent pass. This repo lives
// under a path with no space today, but "nobody will ever check this out
// into ~/My Projects/" is not a guarantee worth resting a build gate on.
// pathToFileURL does the encoding the same way import.meta.url already
// did, so the two are comparable for any path.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
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
