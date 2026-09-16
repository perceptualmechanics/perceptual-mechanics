
import { fragments } from '../src/scenes/sphere/sphere.text.js';
import { poems } from '../src/scenes/orbiter/orbiter.text.js';
import { scrollPieces } from '../src/scenes/scroll/scroll.text.js';
import { BOUNCES } from '../src/scenes/beamline/beamline.text.js';
import { libraryItems, cdRackItems } from '../src/scenes/library/library.text.js';
import { PIECES as theaterPieces, BEATS as theaterBeats } from '../src/scenes/theater/theater.text.js';
import { ORRERY } from '../src/scenes/orrery/orrery.text.js';
import { BUTTERFLY } from '../src/scenes/butterfly/butterfly.text.js';
import { RESONANCES } from '../src/resonances.js';
import { resolveEndpoint } from '../src/scenes/harmonics/harmonicsPieces.js';
import { pathToFileURL } from 'node:url';

const STATUSES = new Set(['pending', 'approved', 'rejected']);
const BASES = new Set(['verbatim', 'connotative']);

const RESOLVERS = {
  sphere: ep => fragments.find(it => it.id === ep.id),
  orbiter: ep => poems.find(it => it.id === ep.id),
  scroll: ep => scrollPieces.find(it => it.id === ep.id),
  beamline: ep => BOUNCES.find(it => it.id === ep.id),
  orrery: ep => (ORRERY.id === ep.id ? ORRERY : undefined),
  butterfly: ep => (BUTTERFLY.id === ep.id ? BUTTERFLY : undefined),
  library: ep => libraryItems.find(it => it.id === ep.id) ?? cdRackItems.find(it => it.id === ep.id),
  theater: ep => {
    if (ep.beatId !== undefined) return theaterBeats.find(b => b.id === ep.beatId);
    return theaterPieces.flatMap(p => p.scenes).find(s => s.id === ep.id);
  },
};

function describe(ep) {
  if (ep.scene === 'theater' && ep.beatId !== undefined) return `theater#beat${ep.beatId}`;
  return `${ep.scene}#${ep.id}`;
}

function sameEndpoint(x, y) {
  if (x.scene !== y.scene) return false;
  if (x.scene === 'theater') return x.beatId === y.beatId && x.id === y.id;
  return x.id === y.id;
}

export function verifyResonances() {
  const log = [];
  let failures = 0;
  const fail = msg => { failures++; log.push(`FAIL: ${msg}`); };
  const ok = msg => log.push(`ok: ${msg}`);

  let checked = 0;
  const seenPairs = [];
  const statusCounts = { pending: 0, approved: 0, rejected: 0 };
  const basisCounts = { verbatim: 0, connotative: 0 };

  RESONANCES.forEach((r, i) => {
    const where = `RESONANCES[${i}] (${describe(r.a)} <-> ${describe(r.b)})`;

    if (!STATUSES.has(r.status)) {
      fail(`${where}: invalid status "${r.status}" (must be pending/approved/rejected)`);
      return;
    }
    if (!BASES.has(r.basis)) {
      fail(`${where}: invalid basis "${r.basis}" (must be verbatim/connotative)`);
      return;
    }
    if (typeof r.rationale !== 'string' || r.rationale.trim().length === 0) {
      fail(`${where}: missing or empty rationale`);
      return;
    }

    const resolverA = RESOLVERS[r.a.scene];
    const resolverB = RESOLVERS[r.b.scene];
    if (!resolverA) { fail(`${where}: unknown scene "${r.a.scene}" on a`); return; }
    if (!resolverB) { fail(`${where}: unknown scene "${r.b.scene}" on b`); return; }

    const pieceA = resolverA(r.a);
    const pieceB = resolverB(r.b);
    if (!pieceA) { fail(`${where}: endpoint a (${describe(r.a)}) does not resolve`); return; }
    if (!pieceB) { fail(`${where}: endpoint b (${describe(r.b)}) does not resolve`); return; }

    if (sameEndpoint(r.a, r.b)) { fail(`${where}: a and b are the same piece`); return; }

    const dupe = seenPairs.some(([x, y]) =>
      (sameEndpoint(x, r.a) && sameEndpoint(y, r.b)) ||
      (sameEndpoint(x, r.b) && sameEndpoint(y, r.a))
    );
    if (dupe) { fail(`${where}: duplicate of an already-checked pair`); return; }
    seenPairs.push([r.a, r.b]);

    statusCounts[r.status]++;
    basisCounts[r.basis]++;
    checked++;
  });

  if (checked === RESONANCES.length && RESONANCES.length > 0) {
    ok(`resonances.js: all ${RESONANCES.length} rows resolve (${basisCounts.verbatim} verbatim, ${basisCounts.connotative} connotative; ${statusCounts.approved} approved, ${statusCounts.pending} pending, ${statusCounts.rejected} rejected)`);
  } else if (RESONANCES.length === 0) {
    ok('resonances.js: empty (no rows yet)');
  }

  {
    const degree = new Map();
    for (const r of RESONANCES) {
      for (const ep of [r.a, r.b]) {
        const key = `${ep.scene}:${ep.beatId !== undefined ? `b${ep.beatId}` : ep.id}`;
        degree.set(key, (degree.get(key) ?? 0) + 1);
      }
    }
    const ranked = [...degree.entries()].sort((a, b) => b[1] - a[1]);
    if (ranked.length) {
      ok(`resonances.js: ${degree.size} nodes; the hub is ${ranked[0][0]} with ${ranked[0][1]} connections (Harmonics' panel stacks that many cards)`);
    }

    const textless = new Set();
    for (const r of RESONANCES) {
      for (const ep of [r.a, r.b]) {
        const resolved = resolveEndpoint(ep);
        if (!resolved.rawText || !resolved.rawText.trim()) textless.add(resolved.title);
      }
    }
    if (textless.size) {
      ok(`resonances.js: ${textless.size} endpoint(s) carry no prose, so Harmonics shows their label alone — ${[...textless].join('; ')}`);
    }
  }

  return { ok: failures === 0, failures, log };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ok, failures, log } = verifyResonances();
  log.forEach(line => console.log(line));
  console.log('');
  if (ok) {
    console.log('All checks passed.');
  } else {
    console.error(`${failures} check(s) failed.`);
    process.exit(1);
  }
}
