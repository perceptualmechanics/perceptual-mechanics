// The deploy's dependency gate: npm audit at high, with named exceptions.
// An exception is for an advisory with no patched release that can't reach
// the shipped site, and it holds only while that stays true. Once the
// package publishes a version outside the advisory's range, or the audit
// stops reporting it, this fails until the exception is removed.
//   node scripts/audit-deps.mjs [audit.json]
// With a file, it reads that audit instead of running one (to test the gate).
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const EXCEPTIONS = {};

const audit = JSON.parse(process.argv[2]
  ? readFileSync(process.argv[2], 'utf8')
  : spawnSync('npm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 1 << 26 }).stdout);
if (!audit.vulnerabilities) throw new Error(`npm audit gave no report: ${JSON.stringify(audit).slice(0, 200)}`);

// Each advisory once, from the package it names; the packages that only
// depend on it list it by name, not as an object.
const advisories = new Map();
for (const v of Object.values(audit.vulnerabilities)) {
  for (const a of v.via) if (typeof a === 'object' && ['high', 'critical'].includes(a.severity)) advisories.set(a.url.split('/').pop(), a);
}

const npmView = spec => [JSON.parse(execFileSync('npm', ['view', spec, 'version', '--json'], { encoding: 'utf8' }) || '[]')].flat();
const failures = [];
for (const [id, a] of advisories) {
  if (!EXCEPTIONS[id]) { failures.push(`${a.severity}: ${a.name} ${a.range}, ${a.title} (${a.url})`); continue; }
  const [latest] = npmView(a.name), affected = npmView(`${a.name}@${a.range}`);
  if (!affected.includes(latest)) failures.push(`${id}: ${a.name} ${latest} is outside ${a.range}, so a patch exists; update to it and remove the exception`);
  else console.log(`excepted ${id} (${a.name} ${a.range}, latest ${latest}): ${EXCEPTIONS[id]}`);
}
for (const id of Object.keys(EXCEPTIONS)) if (!advisories.has(id)) failures.push(`${id}: excepted, but the audit no longer reports it; remove the exception`);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`npm audit: no high or critical advisories beyond ${Object.keys(EXCEPTIONS).length} named exception(s)`);
