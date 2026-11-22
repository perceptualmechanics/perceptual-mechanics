
import { fragments } from '../src/scenes/sphere/sphere.text.js';
import { poems } from '../src/scenes/orbiter/orbiter.text.js';
import { scrollPieces } from '../src/scenes/scroll/scroll.text.js';
import { BOUNCES } from '../src/scenes/beamline/beamline.text.js';
import { libraryItems, cdRackItems } from '../src/scenes/library/library.text.js';
import { PIECES as theaterPieces } from '../src/scenes/theater/theater.text.js';
import { ORRERY } from '../src/scenes/orrery/orrery.text.js';
import { LINKS, RENDERED_FIELDS } from '../src/links.js';
import { crossLinkPlan, applyCrossLinkPlan, ENTITY_RE, isSupportedEntity } from '../src/utils/crossLinkMatch.js';
import { pathToFileURL } from 'node:url';

export function verifyLinks() {
  const log = [];
  let failures = 0;
  const fail = msg => { failures++; log.push(`FAIL: ${msg}`); };
  const ok = msg => log.push(`ok: ${msg}`);

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

  const libraryItemIds = new Set(libraryItems.map(i => i.id));
  const cdIds = new Set(cdRackItems.map(i => i.id));
  const sharedIds = [...libraryItemIds].filter(id => cdIds.has(id));
  if (sharedIds.length) {
    log.push(`note: library items and cdRackItems share ${sharedIds.length} id value(s) — harmless today (no link targets a cd), but a { scene: 'library', id } pair is ambiguous between the two arrays. Flagged, not failed.`);
  }

  // A link can only start in text its scene displays, so the fields a link
  // may name are RENDERED_FIELDS itself; this map only says where each
  // scene's pieces live.
  const items = { sphere: fragments, orbiter: poems, scroll: scrollPieces, library: libraryItems };
  for (const scene of Object.keys(RENDERED_FIELDS)) {
    if (!items[scene]) fail(`RENDERED_FIELDS names "${scene}", but this check has no piece list for it — add one to \`items\``);
  }
  const fieldText = (piece, field, index) => index === undefined ? piece[field] : piece[field]?.[index];

  function findPiece(scene, id) {
    return items[scene]?.find(it => it.id === id);
  }

  let checked = 0;
  LINKS.forEach((l, i) => {
    const where = `LINKS[${i}] (${l.from.scene}#${l.from.id} -> ${l.to.scene}#${l.to.id})`;
    const rendered = RENDERED_FIELDS[l.from.scene];
    if (!rendered || !items[l.from.scene]) { fail(`${where}: "${l.from.scene}" is not a scene links can start in (RENDERED_FIELDS has ${Object.keys(RENDERED_FIELDS).join(', ')})`); return; }
    const fromPiece = findPiece(l.from.scene, l.from.id);
    if (!fromPiece) { fail(`${where}: no piece with id ${l.from.id} in ${l.from.scene}`); return; }
    if (!rendered.has(l.from.field)) { fail(`${where}: "${l.from.scene}" does not display a field "${l.from.field}" (it displays ${[...rendered].join(', ')}), so the phrase would be invisible on the source side`); return; }
    const text = fieldText(fromPiece, l.from.field, l.from.index);
    if (typeof text !== 'string') { fail(`${where}: field "${l.from.field}"${l.from.index !== undefined ? `[${l.from.index}]` : ''} is not a string on piece ${l.from.id}`); return; }
    if (!text.includes(l.phrase)) { fail(`${where}: phrase "${l.phrase}" not found verbatim in ${l.from.scene}#${l.from.id}.${l.from.field}${l.from.index !== undefined ? `[${l.from.index}]` : ''}`); return; }
    const toPiece = findPiece(l.to.scene, l.to.id);
    if (!toPiece) { fail(`${where}: target ${l.to.scene}#${l.to.id} does not resolve`); return; }
    checked++;
  });
  if (checked === LINKS.length) ok(`links.js: all ${LINKS.length} rows resolve (a displayed source field + verbatim phrase + target)`);

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
            fail(`${slot}: LINKS[${entries[a].i}] and LINKS[${entries[b].i}] use the identical phrase "${pa}" in the same render group — both would claim the same words, so the second silently fails to link. Give them distinct phrases.`);
          }
        } else if (pb.includes(pa)) {
          collisions++;
          fail(`${slot}: phrase "${pa}" (LINKS[${entries[a].i}]) is a substring of "${pb}" (LINKS[${entries[b].i}]) in the same render group — whichever matches first takes the other's words, and the loser silently fails to link. Lengthen the shorter phrase so neither contains the other.`);
        }
      }
    }

    const piece = findPiece(f.scene, f.id);
    if (!piece || !RENDERED_FIELDS[f.scene]?.has(f.field)) return;
    const text = fieldText(piece, f.field, f.index);
    if (typeof text !== 'string') return;

    const wanted = new Map();
    entries.forEach(({ link }) => wanted.set(link.phrase, (wanted.get(link.phrase) ?? 0) + 1));
    wanted.forEach((expected, phrase) => {
      const actual = countOccurrences(text, phrase);
      if (actual !== expected) {
        collisions++;
        fail(`${slot}: phrase "${phrase}" occurs ${actual} time(s) in the source text but ${expected} link(s) use it — the match takes occurrence #1 and can't know which was meant. Extend the phrase until it appears exactly ${expected} time(s).`);
      }
    });
  });
  if (!collisions) ok(`phrase collisions: none across ${groups.size} render group(s) (no phrase contains another, every phrase occurs exactly as often as it is linked)`);

  let planned = 0, unplaced = 0;
  groups.forEach(entries => {
    const f = entries[0].link.from;
    const piece = findPiece(f.scene, f.id);
    if (!piece || !RENDERED_FIELDS[f.scene]?.has(f.field)) return;
    const text = fieldText(piece, f.field, f.index);
    if (typeof text !== 'string') return;
    const links = entries.map(e => e.link);
    const plan = crossLinkPlan(text, links.map(l => l.phrase), 'x-link');
    plan.forEach((hit, n) => {
      planned++;
      if (!hit) {
        unplaced++;
        fail(`${f.scene}#${f.id}.${f.field}: LINKS[${entries[n].i}] phrase "${links[n].phrase}" finds nowhere to land once the other links in its group have taken their text — this row would render as plain text with no error.`);
      }
    });
  });
  if (!unplaced) ok(`matcher: all ${planned} links find a distinct home when the real matcher is run over the real text`);

  const ALLOWED_TAGS = new Set(['p', 'em', 'i', 'br', 'strong', 'b', 'span']);
  let badEntities = 0, badTags = 0;
  groups.forEach(entries => {
    const f = entries[0].link.from;
    const piece = findPiece(f.scene, f.id);
    const text = piece && RENDERED_FIELDS[f.scene]?.has(f.field) ? fieldText(piece, f.field, f.index) : null;
    if (typeof text !== 'string') return;
    for (const m of text.matchAll(ENTITY_RE)) {
      if (!isSupportedEntity(m[0])) {
        badEntities++;
        fail(`${f.scene}#${f.id}.${f.field}: contains "${m[0]}", an entity crossLinkMatch.js does not decode — it would be matched as literal text, so a phrase spanning it would silently not link.`);
      }
    }
    for (const m of text.matchAll(/<\/?([a-zA-Z][\w-]*)/g)) {
      if (!ALLOWED_TAGS.has(m[1].toLowerCase())) {
        badTags++;
        fail(`${f.scene}#${f.id}.${f.field}: contains <${m[1]}>, outside the markup crossLinkMatch.js's tokenizer is written for. Widen the tokenizer deliberately, or keep the field to ${[...ALLOWED_TAGS].join(', ')}.`);
      }
    }
  });
  if (!badEntities && !badTags) ok('corpus: every linkable field stays inside the entity set and markup the matcher handles');

  const FIXTURE_HTML = '<p>Tom &amp; Jerry met a &lt;stranger&gt; at the fair, and Tom &amp; Jerry left.</p>';
  const FIXTURE = [
    { phrase: 'Tom & Jerry', to: { scene: 'sphere', id: 1 } },
    { phrase: '<stranger>', to: { scene: 'scroll', id: 2 } },
    { phrase: 'the fair', to: { scene: 'library', id: 3 } },
  ];
  const fplan = crossLinkPlan(FIXTURE_HTML, FIXTURE.map(l => l.phrase), 'x-link');
  const fout = applyCrossLinkPlan(FIXTURE_HTML, FIXTURE, 'x-link', fplan);
  const fixtureProblems = [];
  fplan.forEach((hit, i) => { if (!hit) fixtureProblems.push(`phrase ${JSON.stringify(FIXTURE[i].phrase)} did not match`); });
  if (!fout.includes('>Tom &amp; Jerry</a>')) fixtureProblems.push('the & phrase did not keep its source encoding inside the anchor');
  if (!fout.includes('>&lt;stranger&gt;</a>')) fixtureProblems.push('the angle-bracket phrase did not keep its source encoding inside the anchor');
  if (!/, and Tom &amp; Jerry left\.<\/p>$/.test(fout)) fixtureProblems.push('the second occurrence was not left untouched');
  if ((fout.match(/<a /g) || []).length !== 3) fixtureProblems.push(`expected 3 anchors, got ${(fout.match(/<a /g) || []).length}`);
  if (fout.replace(/<a [^>]*>|<\/a>/g, '') !== FIXTURE_HTML) fixtureProblems.push('text outside the inserted anchors was altered');
  if (fixtureProblems.length) {
    fixtureProblems.forEach(m => fail(`matcher fixture: ${m}`));
  } else {
    ok('matcher fixture: phrases containing & and < > link correctly, and nothing outside the anchors changes');
  }

  return { ok: failures === 0, failures, log };
}

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
