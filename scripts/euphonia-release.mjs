// Which master the site may ship: the one the book's last release was built
// from, pinned in src/euphonia/euphonia.release.json so a deploy, which
// can't see the master, can still hold every export to it. A deliberate
// step at release (PROCESS.md section 6, step 9), never part of the build:
//   node scripts/euphonia-release.mjs
// It reads the book's stamps (build-stamps.json, beside the master), where
// every generator records the master it read. The released master is the
// one they all name, which bookcheck passed, and which is installed here.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const MASTER = 'euphonia/Euphonia.md';
export const RELEASE = new URL('../src/euphonia/euphonia.release.json', import.meta.url);
export const STAMPS = 'build-stamps.json';

// The master every stamp names, and that bookcheck checked; or why there
// isn't one.
export function releasedMaster(stamps) {
  const named = new Set(Object.values(stamps).map(s => s.sources?.[MASTER]).filter(Boolean));
  if (named.size !== 1) return { error: `the book's stamps name ${named.size} masters, not one; its release isn't finished` };
  const [sha256] = named, check = stamps['check:bookcheck'];
  if (check?.sources?.[MASTER] !== sha256) return { error: 'bookcheck has no stamp for the master the book was built from' };
  return { sha256, checked: check.at };
}

// The stamps beside the master a pin or an export names, where this
// machine has them.
export function stampsBeside(master) {
  const path = master && join(dirname(master.replace(/^~(?=\/)/, homedir())), STAMPS);
  return path && existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const master = JSON.parse(readFileSync(new URL('../src/euphonia/euphonia.classes.json', import.meta.url), 'utf8')).provenance.master;
  const stamps = stampsBeside(master);
  if (!stamps) throw new Error(`no ${STAMPS} beside ${master}; the release step runs where the book is`);
  const released = releasedMaster(stamps);
  if (released.error) throw new Error(released.error);
  const installed = createHash('sha256').update(readFileSync(master.replace(/^~(?=\/)/, homedir()))).digest('hex');
  if (installed !== released.sha256) throw new Error(`the installed master (${installed.slice(0, 12)}…) isn't the released one (${released.sha256.slice(0, 12)}…); sync the book first`);
  writeFileSync(RELEASE, `${JSON.stringify({ master, sha256: released.sha256, checked: released.checked, from: `${STAMPS}, beside the master` }, null, 2)}\n`);
  console.log(`euphonia.release.json: master ${released.sha256.slice(0, 12)}…, checked ${released.checked}`);
}
