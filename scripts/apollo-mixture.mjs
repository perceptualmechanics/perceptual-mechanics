import { ELEMENTS, SOLAR_MIXTURE, VISIBLE_MIN, VISIBLE_MAX, visibleLines }
  from '../src/scenes/apollo/apollo.text.js';

const TAU_MAX = 4.6;
const RELATIVE_STRENGTH_EXPONENT = 0.55;
const LINE_SIGMA_FLOOR = 0.35;
const lineSigma = (bandW) => Math.max(LINE_SIGMA_FLOOR, (bandW / 1400) * 0.7);

function peakFor(el, density, bandW) {
  const sigma = lineSigma(bandW);
  const inv2s2 = 1 / (2 * sigma * sigma);
  const reach = Math.ceil(sigma * 4);
  const nmPerCol = (VISIBLE_MAX - VISIBLE_MIN) / Math.max(1, bandW - 1);
  const tau = new Float64Array(bandW);
  for (const [nm, rel] of visibleLines(el)) {
    const xc = (nm - VISIBLE_MIN) / nmPerCol;
    const amp = density * TAU_MAX * Math.pow(rel / 1000, RELATIVE_STRENGTH_EXPONENT);
    const lo = Math.max(0, Math.floor(xc - reach));
    const hi = Math.min(bandW - 1, Math.ceil(xc + reach));
    for (let x = lo; x <= hi; x++) {
      const dx = x - xc;
      tau[x] += amp * Math.exp(-dx * dx * inv2s2);
    }
  }
  let best = 0, at = 0;
  for (let x = 0; x < bandW; x++) if (tau[x] > best) { best = tau[x]; at = x; }
  return { tau: best, nm: VISIBLE_MIN + at * nmPerCol, transmission: Math.exp(-best) };
}

function table(bandW) {
  const rows = ELEMENTS
    .filter(el => (SOLAR_MIXTURE[el.key] ?? 0) > 0)
    .map(el => ({ key: el.key, d: SOLAR_MIXTURE[el.key], ...peakFor(el, SOLAR_MIXTURE[el.key], bandW) }))
    .sort((a, b) => b.tau - a.tau);
  console.log(`\nbandW ${bandW} device columns  (sigma ${lineSigma(bandW).toFixed(3)}${lineSigma(bandW) === LINE_SIGMA_FLOOR ? ', AT THE FLOOR' : ''})`);
  console.log('  el  fader   peak tau   at nm     transmission');
  for (const r of rows) {
    console.log(`  ${r.key.padEnd(3)} ${r.d.toFixed(2)}    ${r.tau.toFixed(2).padStart(6)}   ${r.nm.toFixed(1).padStart(6)}    ${(r.transmission * 100).toFixed(1).padStart(5)}%`);
  }
  console.log(`  order: ${rows.map(r => r.key).join(' > ')}`);
  return rows.map(r => r.key).join(' > ');
}

const widths = process.argv.slice(2).map(Number).filter(Number.isFinite);
const use = widths.length ? widths : [1400, 1126, 686];
const orders = use.map(table);
if (new Set(orders).size > 1) {
  console.log(`\nThe ordering is NOT the same at every width — see the sigma floor note above.`);
} else {
  console.log(`\nSame ordering at all ${use.length} widths.`);
}
