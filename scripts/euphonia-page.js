import { euphoniaFiles } from './verify-euphonia.mjs';
import { inline, blocks } from '../src/euphonia/euphonia.markdown.js';
import { slug } from '../src/euphonia/euphonia.places.js';
import { SYNODIC } from '../src/euphonia/euphonia.moon.js';
import { worldData, fixturesData, calendarsData, reliefData, rosesData } from './verify-euphonia-map.mjs';

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

// The State of the World is Claude's draft of Scott's setting, shown as one
// (Scott, 2026-10-28), wherever a chapter is shown.
const DRAFT_NOTE = 'A draft: these chapters were written by Claude, for Scott to rewrite, keep or cut.';

function catalog(items) {
  return `<ul class="catalog">\n${items.join('\n')}\n</ul>`;
}

// The map's stage: it fills the screen, under the page's title. Its controls
// and discs wait for the script that draws them. Everything to read is in
// its panel: the contents, each region's chapter, the moment shown, how the
// map is made, the classes and the games.
function mapStage({ classes, regions, adventures, hidden }, world, fixtures, calendars) {
  const globe = `<div class="map-cell"><div class="map-disc" tabindex="0" role="group" aria-label="The globe" aria-describedby="map-help">
<canvas aria-hidden="true"></canvas>
<div class="map-labels"></div>
</div></div>`;
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
<button type="button" class="map-contents-open" aria-haspopup="dialog">Contents</button>
</form>
<div class="map-globe">
${globe}
</div>
<div class="map-panel" role="dialog" aria-modal="false" aria-labelledby="map-panel-title">
<button type="button" class="map-panel-close" aria-label="Close panel">&#10005;</button>
<p class="map-panel-back" hidden><button type="button">Contents</button></p>
<h2 id="map-panel-title" class="map-panel-title" tabindex="-1"></h2>
${panelSections({ classes, regions, adventures, hidden }, world, fixtures, calendars)}
<section class="map-panel-pick" aria-labelledby="map-panel-pick-title" hidden>
<h3 id="map-panel-pick-title">The place you picked</h3>
<dl class="map-panel-facts"></dl>
<p class="map-panel-mention"></p>
<p class="map-panel-nearby" hidden><button type="button" class="map-panel-read"></button></p>
</section>
<div class="map-panel-region" hidden>
${regions.status === 'draft' ? `<p class="map-panel-note">${DRAFT_NOTE}</p>\n` : ''}<p><button type="button" class="map-panel-zoom">Zoom to it</button></p>
<h3 id="map-panel-places-title">Its places on the map</h3>
<ul class="map-panel-places" aria-labelledby="map-panel-places-title"></ul>
<div class="map-panel-content"></div>
</div>
</div>
<p class="map-status" aria-live="polite"></p>
<p class="map-help" id="map-help">Drag the globe across, or focus it and use the left and right arrows, to spin it on its axis; drag up or down, or use the up and down arrows, to slide its brass ring through the horizon and set it for a latitude, the pole raised that far. The wheel, a pinch, or + and − zoom; 0 sets it home again. The wooden horizon's calendar marks today beside the sun's place in the zodiac. A region's name opens its chapter beside the globe, and Contents lists every chapter and the rest of the book's pages. Play runs time on; on the globe, space plays and pauses, [ and ] step an hour, { and } a day. Click or tap a place, or press Enter on the globe for the place at its centre: the panel gives its time, its sun and its tide, and opens its region's chapter where the chapter names it.</p>
<noscript><p class="map-help">The map and its pages are drawn in the page by script.</p></noscript>`;
}

// The tabs over the map and the builder. Hidden until the script that runs
// them does: without it, the page is the map and its text.
function tabs() {
  return `<div class="euphonia-tabs" role="tablist" aria-label="Euphonia" hidden>
<button type="button" role="tab" id="tab-map" aria-controls="map-figure" aria-selected="true">Map</button>
<button type="button" role="tab" id="tab-builder" aria-controls="character-builder" aria-selected="false" tabindex="-1">Character builder</button>
</div>`;
}

// The character builder's panel: its choices beside the sheet they make. The
// rules load when it first opens, and the script fills both sides. Its id
// isn't the address's #builder, which names the tab, so opening that address
// doesn't scroll the tabs away.
function builder() {
  return `<section class="builder" id="character-builder" role="tabpanel" aria-labelledby="tab-builder" tabindex="-1" hidden>
<form class="builder-form" aria-label="Your character's choices" novalidate>
<p class="builder-status" role="status">Loading the rules…</p>
</form>
<article class="sheet" aria-labelledby="sheet-title" hidden></article>
</section>`;
}

// The panel's pages, each shown on its own: the contents; the moment the
// map shows (its readouts, filled as time runs); how the map is made; the
// classes; the games; and each region's chapter, as a template the panel
// copies when the region opens.
function panelSections({ classes, regions, adventures, hidden }, world, fixtures, calendars, relief = reliefData()) {
  const cited = Object.values(calendars.sources).map(s => `<a href="${esc(s.url)}">${esc(s.title)}</a>`).join(', ');
  const lakes = world.historic.map(l => `${esc(l.name)} (${esc(l.date)})`).join(', ');
  const versions = [...new Set(world.provenance.files.map(f => f.version))].join(' and ');
  const pages = [['moment', 'This moment'], ['about', 'About the map'], ['classes', 'The classes'], ['games', 'Adventures and Hooks']];
  return `<nav class="map-panel-page map-panel-contents" aria-label="Contents" data-title="Contents" hidden>
<h3>The State of the World</h3>
${regions.status === 'draft' ? `<p class="map-panel-note">${DRAFT_NOTE}</p>\n` : ''}<ul>
${regions.data.map(r => `<li><button type="button" data-region="${slug(r.name)}">${esc(r.name)}</button></li>`).join('\n')}
</ul>
<h3>The book</h3>
<ul>
${pages.map(([id, name]) => `<li><button type="button" data-page="${id}">${name}</button></li>`).join('\n')}
</ul>
</nav>
<section class="map-panel-page map-panel-moment" data-page="moment" data-title="This moment" hidden>
<p class="map-readout">The world between Samhain 1668 and Samhain 1669, on one globe.</p>
<table class="map-dates" hidden>
<caption>The same moment, as each kept the date</caption>
<thead><tr><th scope="col">Calendar</th><th scope="col">Date</th><th scope="col">The Hidden (Euphonia)</th><th scope="col">Kept in</th></tr></thead>
<tbody></tbody>
</table>
<p class="map-tide" hidden></p>
<p class="map-moon" hidden><svg viewBox="-1.1 -1.1 2.2 2.2" aria-hidden="true" focusable="false"><circle class="face" r="1"/><path class="lit"/></svg><span></span></p>
</section>
<section class="map-panel-page" data-page="about" data-title="About the map" hidden>
<blockquote class="map-rule">
<p>${inline(hidden.data.tide)}</p>
<p class="by">From Euphonia, Scott Cohen's setting: not history. ${esc(hidden.data.where)}.</p>
<p class="by">How the map reads it, where the rule says the DM decides (Scott, 1 November 2026): an open night is the eve, from sunset on 31 October or 30 April to the next sunrise, in each place's own calendar; the halves of the year turn at those sunsets; between the tropics it is the dark half in whichever hemisphere the sun isn't overhead. Where a place's calendar has no 31 October, its half and open nights are as the DM says. The moon, the sun and the dates the rule reads are computed; the rule is Scott's.</p>
</blockquote>
<p class="note">Coasts, lakes and rivers are Natural Earth's (public domain, versions ${esc(versions)}), and modern. Natural Earth has no outlines from 1668; where it has older ones, the map draws them dashed, each with its own date: ${lakes}. The regions glow round the places each chapter names, looked up in Natural Earth's populated places.</p>
<p class="note">Relief and ocean depths are ${esc(relief.provenance.source)}, averaged to a quarter degree; its detail is ${esc(relief.provenance.note.split(';')[0].replace(/^Five-minute resolution/, 'five-minute'))}, and coarser elsewhere. The land is lit from the northwest, its slopes steepened ${relief.shading.exaggeration.toFixed(0)} times, so the steepest hundredth of them shade as 45°; the sea is banded at Natural Earth's bathymetric depths. The wind roses stand at the ${rosesData().roses.length} points of open sea farthest from the coasts this map draws.</p>
<p class="note">The sun's place is NOAA's, checked against JPL Horizons; the moon's phases are checked against Espenak's catalogue. ${esc(fixtures.moon.acknowledgment)} The moon is drawn as it looked from north of the tropics; south of them it is mirrored.</p>
<p class="note">Each date is the one its seat's sundials gave at that moment, and the Hijri day begins at the seat's sunset. The Hijri dates are tabular (the 30-year cycle, from the civil epoch); months begun by sighting the new moon could differ by a day. Which calendar each polity kept: ${cited} (Wikipedia). The Safavids' and the Mughals' are not shown yet: no source in hand says which calendar their governments kept in 1668.</p>
</section>
<section class="map-panel-page" data-page="classes" data-title="The classes" hidden>
${catalog(classes.data.map(c => `<li><span class="t">${esc(c.name)}</span><span class="n">${inline(c.blurb)}</span></li>`))}
</section>
<section class="map-panel-page" data-page="games" data-title="Adventures and Hooks" hidden>
${catalog(adventures.data.map(g => `<li><span class="t">${esc(g.title)}</span><span class="e">${[g.kind, g.where].filter(Boolean).map(inline).join(' · ')}</span>${g.summary ? `<span class="n">${inline(g.summary)}</span>` : ''}${g.hooks.length ? `<details><summary>Hooks</summary><ul>${g.hooks.map(h => `<li>${inline(h)}</li>`).join('')}</ul></details>` : ''}</li>`))}
</section>
${regions.data.map(r => `<template class="map-chapter" data-region="${slug(r.name)}">
${r.sections.map(sec => `<h3>${esc(sec.heading)}</h3>\n${blocks(sec.text)}`).join('\n')}
</template>`).join('\n')}`;
}

// Fills euphonia/index.html's markers from the vendored export, in dev
// and in build alike, the way landing.js fills the landing's.
const MARKERS = ['<!--euphonia-tabs-->', '<!--euphonia-map-->', '<!--euphonia-builder-->', '<!--euphonia-footer-->'];
export function injectEuphonia(html, d = euphoniaFiles(), world = worldData(), fixtures = fixturesData(), calendars = calendarsData()) {
  const missing = MARKERS.filter(m => !html.includes(m));
  if (missing.length) throw new Error(`euphonia/index.html is missing ${missing.join(' and ')}: the page has nowhere to go`);
  return html
    .replace('<!--euphonia-tabs-->', tabs())
    .replace('<!--euphonia-map-->', mapStage(d, world, fixtures, calendars))
    .replace('<!--euphonia-builder-->', builder())
    .replace('<!--euphonia-footer-->', euphoniaFooter(d.legal.data));
}
