// ─── Verify resonances: repeatable check for the Layer 2 (harmonics)
// link store ─────────────────────────────────────────────────────────────
// Same discipline as verify-links.mjs, for src/resonances.js instead of
// src/links.js. Checks, per row:
//
//   1. Both endpoints (`a`, `b`) resolve to a real piece — for theater,
//      via `beatId` into theater.text.js's BEATS, for every other scene
//      via the normal { scene, id } pair.
//   2. `a` and `b` aren't the same piece (a resonance needs two things).
//   3. No duplicate unordered pair — { a, b } and { a: b, b: a } both
//      count as the same row already existing.
//   4. `status` is one of 'pending' | 'approved' | 'rejected'.
//   5. `rationale` is a real, non-empty string — a resonance with no
//      stated reason isn't reviewable, so it isn't valid.
//
// Exported as a function, same reason as verify-links.mjs: vite.config.js
// can run it as a build plugin, and `npm run verify-resonances` gives a
// fast standalone check while editing docs/harmonics_resonances.md or
// src/resonances.js by hand.

import { fragments } from '../src/scenes/sphere/sphere.text.js';
import { poems } from '../src/scenes/orbiter/orbiter.text.js';
import { scrollPieces } from '../src/scenes/scroll/scroll.text.js';
import { BOUNCES } from '../src/scenes/beamline/beamline.text.js';
import { libraryItems, cdRackItems } from '../src/scenes/library/library.text.js';
import { PIECES as theaterPieces, BEATS as theaterBeats } from '../src/scenes/theater/theater.text.js';
import { ORRERY } from '../src/scenes/orrery/orrery.text.js';
import { BUTTERFLY } from '../src/scenes/butterfly/butterfly.text.js';
import { RESONANCES } from '../src/resonances.js';
import { pathToFileURL } from 'node:url';

const STATUSES = new Set(['pending', 'approved', 'rejected']);
const BASES = new Set(['verbatim', 'connotative']);

// Per-scene id resolvers, one function each: (endpoint) => piece | undefined.
// Deliberately separate from verify-links.mjs's `scenes` map rather than
// shared — that map is keyed for phrase-field lookups Layer 1 needs and
// Layer 2 doesn't have; this one just needs "does this address resolve."
const RESOLVERS = {
  sphere: ep => fragments.find(it => it.id === ep.id),
  orbiter: ep => poems.find(it => it.id === ep.id),
  scroll: ep => scrollPieces.find(it => it.id === ep.id),
  beamline: ep => BOUNCES.find(it => it.id === ep.id),
  orrery: ep => (ORRERY.id === ep.id ? ORRERY : undefined),
  butterfly: ep => (BUTTERFLY.id === ep.id ? BUTTERFLY : undefined),
  library: ep => libraryItems.find(it => it.id === ep.id) ?? cdRackItems.find(it => it.id === ep.id),
  // Theater is the one scene where a Layer 2 endpoint should carry beatId,
  // not id — see resonances.js's own header. Still accepts a bare `id`
  // (whole-scene granularity) so a row isn't forced to invent false
  // precision if that's ever genuinely what's meant, but the discovery
  // pass should be reaching for beatId in essentially every real row.
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

  return { ok: failures === 0, failures, log };
}

// ─── CLI entry point ────────────────────────────────────────────────────────
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
