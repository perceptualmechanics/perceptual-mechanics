// Writes src/euphonia/euphonia.ribbon.json, the ribbons' line as the page
// sets it, for the books' PDFs to read (class-kit vendors it with the theme
// files). npm run euphonia:refresh runs it; verify-euphonia-tongues fails the
// build if it's stale.
//   node scripts/euphonia-ribbon.mjs
import { writeFileSync } from 'node:fs';
import { RIBBON, ribbonFile, tonguesData } from './verify-euphonia-tongues.mjs';
import { euphoniaFiles } from './verify-euphonia.mjs';

const file = ribbonFile(euphoniaFiles().regions.data, tonguesData());
writeFileSync(new URL(`../${RIBBON}`, import.meta.url), `${JSON.stringify(file, null, 1)}\n`);
console.log(`${RIBBON}: ${file.words.length} words`);
