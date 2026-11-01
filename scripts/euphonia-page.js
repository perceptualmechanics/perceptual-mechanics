import { euphoniaFiles } from './verify-euphonia.mjs';
import { inline } from '../src/euphonia/euphonia.markdown.js';
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
${legal.orc_notice_status === 'draft' ? `    <p class="draft">A draft: this notice still has ${slots} detail${slots === 1 ? '' : 's'} to fill in.</p>\n` : ''}${legal.orc_notice.map(p => `    <p>${inline(p)}</p>`).join('\n')}
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

// The map's frame: its controls stay hidden until the script that draws it
// runs, and its caption reads as the map's description either way.
function mapSection(world, fixtures, calendars) {
  const cited = Object.values(calendars.sources).map(s => `<a href="${esc(s.url)}">${esc(s.title)}</a>`).join(', ');
  const lakes = world.historic.map(l => `${esc(l.name)} (${esc(l.date)})`).join(', ');
  const versions = [...new Set(world.provenance.files.map(f => f.version))].join(' and ');
  return `<section class="map-section" aria-labelledby="map">
<h2 id="map">The world in 1668</h2>
<figure class="map" id="map-figure">
<form class="map-controls" hidden>
<label>Date (Gregorian) <input name="date" type="date" min="1668-11-01" max="1669-11-01" required></label>
<label>Time, UT <input name="time" type="range" min="0" max="1439" step="5"> <output name="shown" for="time"></output></label>
</form>
<div class="map-hemispheres"></div>
<figcaption>
<p class="map-readout">The world between Samhain 1668 and Samhain 1669, in two hemispheres, with the night where it fell. The map is drawn in the page by script.</p>
<table class="map-dates" hidden>
<caption>The same moment, as each kept the date</caption>
<thead><tr><th scope="col">Calendar</th><th scope="col">Date</th><th scope="col">Kept in</th></tr></thead>
<tbody></tbody>
</table>
<p class="map-moon" hidden><svg viewBox="-1.1 -1.1 2.2 2.2" aria-hidden="true" focusable="false"><circle class="face" r="1"/><path class="lit"/></svg><span></span></p>
<p class="note">Coasts, lakes and rivers are Natural Earth's (public domain, versions ${esc(versions)}), and modern. Natural Earth has no outlines from 1668; where it has older ones, the map draws them dashed, each with its own date: ${lakes}.</p>
<p class="note">The sun's place is NOAA's, checked against JPL Horizons; the moon's phases are checked against Espenak's catalogue. ${esc(fixtures.moon.acknowledgment)} The moon is drawn as it looked from north of the tropics; south of them it is mirrored.</p>
<p class="note">Each date is the one its seat's sundials gave at that moment, and the Hijri day begins at the seat's sunset. The Hijri dates are tabular (the 30-year cycle, from the civil epoch); months begun by sighting the new moon could differ by a day. Which calendar each polity kept: ${cited} (Wikipedia). The Safavids' and the Mughals' are not shown yet: no source in hand says which calendar their governments kept in 1668.</p>
</figcaption>
</figure>
</section>`;
}

function body({ classes, regions, adventures }, world, fixtures, calendars) {
  return `${mapSection(world, fixtures, calendars)}
<section aria-labelledby="classes">
<h2 id="classes">The classes</h2>
${catalog(classes.data.map(c => `<li><span class="t">${esc(c.name)}</span><span class="n">${inline(c.blurb)}</span></li>`))}
</section>
<section aria-labelledby="world">
<h2 id="world">The State of the World</h2>
${regions.status === 'draft' ? '<p class="note">A draft: these chapters were written by Claude, for Scott to rewrite, keep or cut.</p>\n' : ''}${catalog(regions.data.map(r => `<li><span class="t">${esc(r.name)}</span></li>`))}
</section>
<section aria-labelledby="games">
<h2 id="games">Adventures and Hooks</h2>
${catalog(adventures.data.map(g => `<li><span class="t">${esc(g.title)}</span>${g.regions.length ? `<span class="e">${g.regions.map(esc).join(' · ')}</span>` : ''}${g.open ? `<span class="n">${inline(g.open)}</span>` : ''}</li>`))}
</section>`;
}

// Fills euphonia/index.html's two markers from the vendored export, in dev and
// in build alike, the way landing.js fills the landing's.
export function injectEuphonia(html, d = euphoniaFiles(), world = worldData(), fixtures = fixturesData(), calendars = calendarsData()) {
  if (!html.includes('<!--euphonia-body-->') || !html.includes('<!--euphonia-footer-->')) {
    throw new Error('euphonia/index.html is missing <!--euphonia-body--> or <!--euphonia-footer--> — the page has nowhere to go');
  }
  return html
    .replace('<!--euphonia-body-->', body(d, world, fixtures, calendars))
    .replace('<!--euphonia-footer-->', euphoniaFooter(d.legal.data));
}
