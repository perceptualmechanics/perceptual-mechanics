import { euphoniaFiles } from './verify-euphonia.mjs';
import { inline, blocks } from '../src/euphonia/euphonia.markdown.js';
import { slug } from '../src/euphonia/euphonia.places.js';
import { SYNODIC } from '../src/euphonia/euphonia.moon.js';
import { worldData, fixturesData, calendarsData } from './verify-euphonia-map.mjs';

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// The footer every Euphonia page carries, in the page's own text so a reader
// with scripting off and a crawler both have it: the copyright line, the ORC
// Notice and the SRD 5.2.1 attribution, all from Appendix E via the export.
export function euphoniaFooter(legal) {
  const slots = legal.orc_open_slots.length;
  return `<footer class="legal">
  <p><a href="/">perceptual mechanics</a> · <a href="/text/">All the writing</a></p>
  <p class="copyright">${esc(legal.copyright)}</p>
  <section aria-labelledby="orc-notice">
    <h2 id="orc-notice">ORC Notice</h2>
${legal.orc_notice_status === 'draft' ? `    <p class="draft">A draft${slots ? `: this notice still has ${slots} detail${slots === 1 ? '' : 's'} to fill in` : ''}.</p>\n` : ''}${legal.orc_notice.map(p => `    <p>${inline(p)}</p>`).join('\n')}
  </section>
  <section aria-labelledby="srd-attribution">
    <h2 id="srd-attribution">SRD 5.2.1</h2>
    <p>${inline(legal.srd_attribution)}</p>
  </section>
</footer>`;
}

function catalog(items) {
  return `<ul class="catalog">\n${items.join('\n')}\n</ul>`;
}

// The map's stage: it fills the screen, under the page's title. Its controls
// and discs wait for the script that draws them; without it, the stage says
// so and the caption below still describes the map.
function mapStage() {
  const discs = ['Occidens', 'Oriens'].map((name, i) => `<div class="map-cell"><div class="map-disc" tabindex="0" role="group" aria-label="${name}, the ${i ? 'eastern' : 'western'} hemisphere" aria-describedby="map-help">
<p class="map-name" aria-hidden="true">${name}</p>
<canvas aria-hidden="true"></canvas>
<div class="map-labels"></div>
</div></div>`).join('\n');
  return `<form class="map-controls" hidden>
<label>Date (Gregorian) <input name="date" type="date" min="1668-11-01" max="1669-11-01" required></label>
<label>Time, UT <input name="time" type="range" min="0" max="1439" step="5"> <output name="shown" for="time"></output></label>
<button type="button" name="play" aria-pressed="false">Play</button>
<label>Speed <select name="rate">
<option value="3600">an hour a second</option>
<option value="86400" selected>a day a second</option>
<option value="${SYNODIC * 86400}">a moon a second</option>
</select></label>
<button type="button" class="map-reset" hidden>Whole world</button>
</form>
<div class="map-hemispheres">
${discs}
</div>
<p class="map-help" id="map-help">Drag a hemisphere, or focus it and use the arrow keys, to turn the world; the wheel, a pinch, or + and − zoom; 0 shows the whole world again. A region's name zooms to it. Play runs time on; on a hemisphere, space plays and pauses, [ and ] step an hour, { and } a day.</p>
<noscript><p class="map-help">The map is drawn in the page by script; the text below describes it.</p></noscript>`;
}

// The map's caption, under the stage: what it shows at the chosen moment,
// the rule it reads and where everything comes from.
function mapCaption(world, fixtures, calendars, hidden) {
  const cited = Object.values(calendars.sources).map(s => `<a href="${esc(s.url)}">${esc(s.title)}</a>`).join(', ');
  const lakes = world.historic.map(l => `${esc(l.name)} (${esc(l.date)})`).join(', ');
  const versions = [...new Set(world.provenance.files.map(f => f.version))].join(' and ');
  return `<section class="map-caption" id="map-caption" aria-labelledby="map">
<h2 id="map">The world in 1668</h2>
<p class="map-readout">The world between Samhain 1668 and Samhain 1669, in two hemispheres, with the night where it fell.</p>
<table class="map-dates" hidden>
<caption>The same moment, as each kept the date</caption>
<thead><tr><th scope="col">Calendar</th><th scope="col">Date</th><th scope="col">The Hidden (Euphonia)</th><th scope="col">Kept in</th></tr></thead>
<tbody></tbody>
</table>
<p class="map-tide" hidden></p>
<p class="map-moon" hidden><svg viewBox="-1.1 -1.1 2.2 2.2" aria-hidden="true" focusable="false"><circle class="face" r="1"/><path class="lit"/></svg><span></span></p>
<blockquote class="map-rule">
<p>${inline(hidden.data.tide)}</p>
<p class="by">From Euphonia, Scott Cohen's setting: not history. ${esc(hidden.data.where)}.</p>
<p class="by">How the map reads it, where the rule says the DM decides (Scott, 1 November 2026): an open night is the eve, from sunset on 31 October or 30 April to the next sunrise, in each place's own calendar; the halves of the year turn at those sunsets; between the tropics it is the dark half in whichever hemisphere the sun isn't overhead. Where a place's calendar has no 31 October, its half and open nights are as the DM says. The moon, the sun and the dates the rule reads are computed; the rule is Scott's.</p>
</blockquote>
<p class="note">Coasts, lakes and rivers are Natural Earth's (public domain, versions ${esc(versions)}), and modern. Natural Earth has no outlines from 1668; where it has older ones, the map draws them dashed, each with its own date: ${lakes}. The regions glow round the places each chapter names, looked up in Natural Earth's populated places.</p>
<p class="note">The sun's place is NOAA's, checked against JPL Horizons; the moon's phases are checked against Espenak's catalogue. ${esc(fixtures.moon.acknowledgment)} The moon is drawn as it looked from north of the tropics; south of them it is mirrored.</p>
<p class="note">Each date is the one its seat's sundials gave at that moment, and the Hijri day begins at the seat's sunset. The Hijri dates are tabular (the 30-year cycle, from the civil epoch); months begun by sighting the new moon could differ by a day. Which calendar each polity kept: ${cited} (Wikipedia). The Safavids' and the Mughals' are not shown yet: no source in hand says which calendar their governments kept in 1668.</p>
</section>`;
}

function body({ classes, regions, adventures, hidden }, world, fixtures, calendars) {
  return `${mapCaption(world, fixtures, calendars, hidden)}
<section aria-labelledby="classes">
<h2 id="classes">The classes</h2>
${catalog(classes.data.map(c => `<li><span class="t">${esc(c.name)}</span><span class="n">${inline(c.blurb)}</span></li>`))}
</section>
<section aria-labelledby="world">
<h2 id="world">The State of the World</h2>
${regions.status === 'draft' ? '<p class="note">A draft: these chapters were written by Claude, for Scott to rewrite, keep or cut.</p>\n' : ''}${regions.data.map(r => `<details class="region" id="${slug(r.name)}">
<summary>${esc(r.name)}</summary>
${r.sections.map(sec => `<h3>${esc(sec.heading)}</h3>\n${blocks(sec.text)}`).join('\n')}
</details>`).join('\n')}
</section>
<section aria-labelledby="games">
<h2 id="games">Adventures and Hooks</h2>
${catalog(adventures.data.map(g => `<li><span class="t">${esc(g.title)}</span><span class="e">${[g.kind, g.where].filter(Boolean).map(inline).join(' · ')}</span>${g.summary ? `<span class="n">${inline(g.summary)}</span>` : ''}${g.hooks.length ? `<details><summary>Hooks</summary><ul>${g.hooks.map(h => `<li>${inline(h)}</li>`).join('')}</ul></details>` : ''}</li>`))}
</section>`;
}

// Fills euphonia/index.html's three markers from the vendored export, in dev
// and in build alike, the way landing.js fills the landing's.
const MARKERS = ['<!--euphonia-map-->', '<!--euphonia-body-->', '<!--euphonia-footer-->'];
export function injectEuphonia(html, d = euphoniaFiles(), world = worldData(), fixtures = fixturesData(), calendars = calendarsData()) {
  const missing = MARKERS.filter(m => !html.includes(m));
  if (missing.length) throw new Error(`euphonia/index.html is missing ${missing.join(' and ')}: the page has nowhere to go`);
  return html
    .replace('<!--euphonia-map-->', mapStage())
    .replace('<!--euphonia-body-->', body(d, world, fixtures, calendars))
    .replace('<!--euphonia-footer-->', euphoniaFooter(d.legal.data));
}
