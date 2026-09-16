
import { fragments } from '../src/scenes/sphere/sphere.text.js';
import { poems } from '../src/scenes/orbiter/orbiter.text.js';
import { scrollPieces } from '../src/scenes/scroll/scroll.text.js';
import { BOUNCES } from '../src/scenes/beamline/beamline.text.js';
import { libraryItems, cdRackItems } from '../src/scenes/library/library.text.js';
import { PIECES as theaterPieces } from '../src/scenes/theater/theater.text.js';
import { ORRERY } from '../src/scenes/orrery/orrery.text.js';
import { readFileSync } from 'node:fs';
import { LINKS } from '../src/links.js';
import * as linkStore from '../src/links.js';
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

  {
    const src = readFileSync(new URL('../src/links.js', import.meta.url), 'utf8');
    const actual = {};
    for (const l of LINKS) actual[l.from.scene] = (actual[l.from.scene] ?? 0) + 1;
    const headers = [...src.matchAll(/^\s*\/\/ ── (\S+) \((\d+)\) ──/gm)];
    if (!headers.length) {
      log.push('note: no `// ── scene (n) ──` section headers found in links.js — nothing to check');
    } else {
      let bad = 0;
      for (const [, scene, stated] of headers) {
        const real = actual[scene] ?? 0;
        if (Number(stated) !== real) { bad++; fail(`links.js: the "${scene}" section header says ${stated}, but ${real} row(s) have \`from.scene\` "${scene}"`); }
      }
      if (!bad) ok(`links.js: all ${headers.length} section headers match their sections`);
    }
  }


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
        fail(`${slot}: phrase "${phrase}" occurs ${actual} time(s) in the source text but ${expected} link(s) use it — the match takes occurrence #1 and can't know which was meant. Extend the phrase until it appears exactly ${expected} time(s).`);
      }
    });
  });
  if (!collisions) ok(`phrase collisions: none across ${groups.size} render group(s) (no phrase contains another, every phrase occurs exactly as often as it is linked)`);

  let planned = 0, unplaced = 0;
  groups.forEach(entries => {
    const f = entries[0].link.from;
    const sceneEntry = scenes[f.scene];
    const piece = findPiece(f.scene, f.id);
    const fieldFn = sceneEntry?.fields?.[f.field];
    if (!sceneEntry || !piece || !fieldFn) return;
    const text = fieldFn(piece, f.index);
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
    const fieldFn = scenes[f.scene]?.fields?.[f.field];
    const piece = findPiece(f.scene, f.id);
    const text = fieldFn && piece ? fieldFn(piece, f.index) : null;
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

  const WITHHELD_FIELDS = linkStore.WITHHELD_FIELDS ?? {};
  let unknownFields = 0;
  const withheldRows = [];

  const conditionalRows = [];
  LINKS.forEach((l, i) => {
    const rendered = RENDERED_FIELDS[l.from.scene];
    if (rendered === undefined) {
      unknownFields++;
      fail(`LINKS[${i}]: RENDERED_FIELDS has no entry for scene "${l.from.scene}" — add one (even an empty set) so it's a stated decision rather than an omission.`);
      return;
    }
    if (rendersField(rendered, l.from.field)) return;

    if (linkStore.isRenderedField(l.from.scene, l.from.field, l.from.id)) {
      conditionalRows.push(l);
      return;
    }

    if (rendersField(WITHHELD_FIELDS[l.from.scene], l.from.field)) {
      withheldRows.push(l);
      return;
    }
    unknownFields++;
    fail(`LINKS[${i}] (${l.from.scene}#${l.from.id} -> ${l.to.scene}#${l.to.id}): "${l.from.field}" is neither in RENDERED_FIELDS.${l.from.scene} (${renderedFieldNames(rendered).join(', ') || 'nothing'}) nor declared in WITHHELD_FIELDS.${l.from.scene}, and no conditional rule covers piece #${l.from.id}. Either the field name is wrong, or the scene gained a field nobody declared. A link into an undeclared field passes every other check in this file while being invisible on the source side.`);
  });

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
