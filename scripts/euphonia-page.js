import { euphoniaFiles } from './verify-euphonia.mjs';
import { inline, blocks } from '../src/euphonia/euphonia.markdown.js';
import { slug } from '../src/euphonia/euphonia.places.js';
import { worldData, fixturesData, calendarsData, reliefData, rosesData } from './verify-euphonia-map.mjs';
import { ribbonOrder, tonguesData } from './verify-euphonia-tongues.mjs';
import { THEMES, THEME_KEY, THEME_PARAM } from '../src/euphonia/euphonia.themes.js';

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
    <p>${inline(legal.independence)}</p>
  </section>
</footer>`;
}

// The State of the World, shown wherever a chapter is: Scott's world, written
// with Claude, and still growing (Scott, 15 November 2026; the books' front
// page, "Before You Read", says the same at more length).
const LIVING_NOTE = 'A living setting: Scott Cohen\'s world, written with Claude, an AI collaborator. These chapters keep growing.';

function catalog(items) {
  return `<ul class="catalog">\n${items.join('\n')}\n</ul>`;
}

// The map's stage: it fills the screen, under the page's title. Its globe
// waits for the script that draws it, and its two buttons, Whole world and
// Contents, sit in the bar over it (euphonia/index.html). How to work the
// globe is out of sight until the globe has the keyboard's focus, and always
// there for a screen reader. Everything to read is in
// its panel: the contents, each region's chapter, the moment shown, how the
// map is made, the classes and the games.
function mapStage({ classes, regions, adventures, hidden, people, sheets }, world, fixtures, calendars) {
  const globe = `<div class="map-cell"><div class="map-disc" tabindex="0" role="group" aria-label="The globe" aria-describedby="map-help">
<canvas class="map-ambient" aria-hidden="true"></canvas>
<canvas aria-hidden="true"></canvas>
<div class="map-labels"></div>
</div></div>`;
  return `<div class="map-globe">
${globe}
</div>
<div class="map-panel" role="dialog" aria-modal="false" aria-labelledby="map-panel-title">
<button type="button" class="map-panel-close" aria-label="Close panel">&#215;</button>
<p class="map-panel-back" hidden><button type="button">Contents</button></p>
<h2 id="map-panel-title" class="map-panel-title" tabindex="-1"></h2>
${panelSections({ classes, regions, adventures, hidden, people, sheets }, world, fixtures, calendars)}
<section class="map-panel-pick" aria-labelledby="map-panel-pick-title" hidden>
<h3 id="map-panel-pick-title">The place you picked</h3>
<dl class="map-panel-facts"></dl>
<p class="map-panel-mention"></p>
<p class="map-panel-nearby" hidden><button type="button" class="map-panel-read"></button></p>
</section>
<div class="map-panel-region" hidden>
${regions.status === 'draft' ? `<p class="map-panel-note">${LIVING_NOTE}</p>\n` : ''}<p><button type="button" class="map-panel-zoom">Zoom to it</button></p>
<p class="map-panel-theme" hidden><button type="button"></button></p>
<h3 id="map-panel-places-title">Its places on the map</h3>
<ul class="map-panel-places" aria-labelledby="map-panel-places-title"></ul>
<div class="map-panel-content"></div>
</div>
</div>
<p class="map-status" aria-live="polite"></p>
<p class="map-help visually-hidden" id="map-help">Drag the globe across, or focus it and use the left and right arrows, to spin it on its axis; drag up or down, or use the up and down arrows, to slide its brass ring through the horizon and set it for a latitude, the pole raised that far. The wheel, a pinch, or + and − zoom; 0 sets it home again. The wooden horizon's calendar marks today beside the sun's place in the zodiac. A region's name opens its chapter beside the globe, and Contents lists every chapter and the rest of the book's pages. Click or tap a place, or press Enter on the globe for the place at its centre: the panel gives its time, its sun and its tide, and opens its region's chapter where the chapter names it.</p>
<noscript><p class="map-help">The map and its pages are drawn in the page by script.</p></noscript>`;
}

// What Euphonia is, at the foot of the page, in the book's own words: the
// Setting's welcome and where its world goes (euphonia.welcome.json).
function colophon(welcome) {
  return `<section class="colophon" aria-labelledby="colophon-title">
<h2 id="colophon-title">What is Euphonia?</h2>
${[...welcome.opening, ...welcome.world].map(p => `<p>${inline(p)}</p>`).join('\n')}
</section>`;
}

// The theme switcher, beside Contents and Pause motion: a labelled list,
// hidden until the script that runs it does, and a line that says aloud what
// changed.
function themePick() {
  return `<label class="theme-pick" hidden>Theme <select id="theme-pick">${THEMES.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label><span class="visually-hidden" id="theme-said" aria-live="polite"></span>`;
}

// The tabs over the map and the builder. Hidden until the script that runs
// them does: without it, the page is the map and its text.
function tabs() {
  return `<div class="euphonia-tabs" role="tablist" aria-label="Euphonia" hidden>
<button type="button" role="tab" id="tab-map" aria-controls="map-figure" aria-selected="true">Globe</button>
<button type="button" role="tab" id="tab-builder" aria-controls="character-builder" aria-selected="false" tabindex="-1">Character builder</button>
</div>`;
}

// The ribbons in place of a title: Euphonia in the languages of the cultures
// the book names, ordered so look-alikes stand apart, as one line that runs
// leftward across the top ribbon and back rightward along the bottom, like a
// belt round a wheel at the window's left edge: the bottom carries the line
// in reverse and runs the same loop backwards, so a word leaving the top comes
// straight in on the bottom. Each carries the line twice, the second time
// hidden, so its drift can wrap without a seam. The top is the one a reader
// reaches; the bottom only repeats it, so it's hidden from them.
function ribbons(regions, tongues) {
  const order = regions.map(r => r.name);
  const words = ribbonOrder([...tongues.tongues].sort((a, b) => order.indexOf(a.region) - order.indexOf(b.region)));
  const item = t => `<li><span lang="${esc(t.lang)}" title="${esc(`${t.language}: ${t.sense}`)}">${esc(t.word)}</span></li>`;
  const list = words.map(item).join(''), back = words.toReversed().map(item).join('');
  const names = order.filter(name => words.some(t => t.region === name));
  return [`<div class="ribbon ribbon-top" role="region" tabindex="0" aria-label="Euphonia, in the languages of ${esc(names.join('; '))}">
<div class="ribbon-track"><ul class="ribbon-words">${list}</ul><ul class="ribbon-words ribbon-copy" aria-hidden="true">${list}</ul></div>
</div>`, `<div class="ribbon ribbon-bottom" aria-hidden="true">
<div class="ribbon-track"><ul class="ribbon-words ribbon-echo">${back}</ul><ul class="ribbon-words ribbon-copy">${back}</ul></div>
</div>`];
}

// Where each word on the ribbons comes from, and the languages whose
// dictionaries gave none.
function ribbonsPage(tongues) {
  const source = s => `<a href="${esc(s.url)}">${esc(s.title)}</a>, ${esc(s.by)}${s.year ? `, ${s.year}` : ''}`;
  return `<section class="map-panel-page" data-page="ribbons" data-title="The ribbons" hidden>
<p class="note">${esc(tongues.about)}</p>
${catalog(tongues.tongues.map(t => `<li><span class="t" lang="${esc(t.lang)}">${esc(t.word)}</span><span class="e">${esc(t.language)}${t.roman ? ` · <i>${esc(t.roman)}</i>` : ''}${t.dated ? ` · attested ${esc(t.dated)}` : ''}</span><span class="n">“${esc(t.sense)}” ${source(t.source)}</span></li>`))}
<p class="note">${esc(tongues.spelling)}</p>
<h3>No word found</h3>
${catalog(tongues.unfound.map(u => `<li><span class="t">${esc(u.language)}</span><span class="n">Searched: ${u.searched.map(esc).join('; ')}.</span></li>`))}
</section>`;
}

// Everyone the book names for a table to meet, on one page: each region's
// People, as its chapter has them, each with a link to that chapter, then the
// book's Notable People in its own order, subsections and hooks included
// (euphonia.people.json). A reader can narrow it to one region or search it
// by name (euphonia.people.js); without script it's all there, in order.
const PLAIN = s => s.replace(/\*+/g, '');
// Someone with a character sheet the site can show links to it, with the
// class its title gives (euphonia.sheets.json), wherever the book names them
// for a table: the People page and their region's chapter. The link opens
// the sheet in a dialog (euphonia.sheet.js), or as its own page without
// script.
function sheetLink(sheets, name) {
  const sh = sheets.find(x => x.name === name);
  return sh ? `<a class="sheet-link" href="/euphonia/sheets/${esc(sh.file)}">Character sheet</a> (${esc(sh.line)})` : '';
}
// A person the book places (their entry's @at line) is named by a button
// that turns the globe to them (euphonia.map.js); one it doesn't yet place,
// by their name alone.
function personName(name, at) {
  return at ? `<button type="button" class="map-person" data-person="${esc(name)}">${esc(name)}<span class="visually-hidden">, on the globe</span></button>` : esc(name);
}
// A region chapter's People: its intro, and each person as the chapter has
// them (verify-euphonia holds the two to one text), with their sheet.
function chapterPeople(r, sheets) {
  return `${r.intro ? `<p>${inline(r.intro)}</p>\n` : ''}${r.people.map(p => `<p><strong>${personName(p.name, p.at)}.</strong> ${inline(p.text)}${sheetLink(sheets, p.name) ? ` <span class="sheet-ref">${sheetLink(sheets, p.name)}</span>` : ''}</p>`).join('\n')}`;
}
function peoplePage(people, status, sheets) {
  const sheet = name => sheetLink(sheets, name);
  const groupOf = (id, title, body) => `<section class="people-group" data-group="${id}" aria-labelledby="people-${id}">
<h3 id="people-${id}">${esc(title)}</h3>
${body}
</section>`;
  const regional = people.regions.map(r => groupOf(slug(r.region), r.region, `${r.intro ? `<p class="note">${inline(r.intro)}</p>\n` : ''}<ul class="catalog people-list">
${r.people.map(p => `<li class="person" data-name="${esc(p.name)}"><span class="t">${personName(p.name, p.at)}</span><span class="e"><a href="#${slug(r.region)}">${esc(r.region)}</a>${sheet(p.name) ? ` · ${sheet(p.name)}` : ''}</span><p>${inline(p.text)}</p></li>`).join('\n')}
</ul>`));
  // Notable People's blocks, as the book has them: its sections (###) are
  // each a person or a pair, found by name; the paragraphs before them say
  // what the section is, and its cover list is a person to an item.
  let open = false;
  const notable = people.notable.blocks.map(b => {
    if (b.kind === 'heading' && b.level === 3) {
      const html = `${open ? '</div>\n' : ''}<div class="person" data-name="${esc(b.text)}"><h4>${personName(b.text, b.at)}</h4>${sheet(b.text) ? `<p class="note">${sheet(b.text)}</p>` : ''}`;
      open = true;
      return html;
    }
    if (b.kind === 'heading') return `<h5>${esc(b.text)}</h5>`;
    if (b.kind === 'paragraph') return `<p>${inline(b.text)}</p>`;
    return `<ul>${b.items.map(i => (open ? `<li>${inline(i)}</li>` : `<li class="person" data-name="${esc(PLAIN(i))}">${inline(i)}</li>`)).join('')}</ul>`;
  }).join('\n') + (open ? '\n</div>' : '');
  return `<section class="map-panel-page map-panel-people" data-page="people" data-title="People" hidden>
<div class="people-find" hidden>
<label>Region <select class="people-in"><option value="">Everyone</option>${people.regions.map(r => `<option value="${slug(r.region)}">${esc(r.region)}</option>`).join('')}<option value="notable-people">${esc(people.notable.title)}</option></select></label>
<label>Name <input type="search" class="people-name" autocomplete="off" spellcheck="false"></label>
</div>
<p class="people-said note" aria-live="polite" hidden></p>
${status === 'draft' ? `<p class="map-panel-note">${LIVING_NOTE}</p>\n` : ''}${regional.join('\n')}
<section class="people-group" data-group="notable-people" id="notable-people" aria-labelledby="people-notable-people">
<h3 id="people-notable-people">${esc(people.notable.title)}</h3>
${notable}
</section>
</section>`;
}

// In each section of a chapter, the first mention of each place its @places
// line names, and of each title, ruler or power its @names line places, is a
// button that turns the globe there (euphonia.map.js). A place is matched as
// the book writes it; a name, whatever its case ("The shah", "the shah").
// Text already in a link or a button is left as it is.
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function globeMarks(r) {
  const id = slug(r.name);
  const mark = (text, flags, attr) => ({
    re: new RegExp(`(?<![\\p{L}])${escapeRe(esc(text))}(?![\\p{L}])`, flags),
    button: shown => `<button type="button" class="map-mark" data-region="${id}" ${attr}>${shown}<span class="visually-hidden">, on the globe</span></button>`,
  });
  return [
    ...r.places.map(p => mark(p.name, 'u', `data-place="${esc(p.name)}"`)),
    ...(r.names ?? []).map(n => mark(n.name, 'iu', `data-name="${esc(n.name)}"`)),
  ];
}
function globeLinks(html, marks) {
  const left = [...marks];
  let inside = 0;
  return html.split(/(<[^>]+>)/).map(part => {
    if (part.startsWith('<')) {
      if (/^<(a|button)\b/i.test(part)) inside++;
      else if (/^<\/(a|button)>/i.test(part)) inside--;
      return part;
    }
    let out = '', rest = part;
    while (!inside && left.length) {
      let first = null;
      for (const m of left) {
        const found = m.re.exec(rest);
        if (found && (!first || found.index < first.found.index)) first = { m, found };
      }
      if (!first) break;
      out += rest.slice(0, first.found.index) + first.m.button(first.found[0]);
      rest = rest.slice(first.found.index + first.found[0].length);
      left.splice(left.indexOf(first.m), 1);
    }
    return out + rest;
  }).join('');
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
<article class="sheet" aria-labelledby="sheet-title" tabindex="0" hidden></article>
</section>`;
}

// The panel's pages, each shown on its own: the contents; the moment the
// map shows (its readouts, filled as time runs); how the map is made; the
// classes; the games; and each region's chapter, as a template the panel
// copies when the region opens.
function panelSections({ classes, regions, adventures, hidden, people, sheets }, world, fixtures, calendars, relief = reliefData()) {
  const cited = Object.values(calendars.sources).map(s => `<a href="${esc(s.url)}">${esc(s.title)}</a>`).join(', ');
  const lakes = world.historic.map(l => `${esc(l.name)} (${esc(l.date)})`).join(', ');
  const versions = [...new Set(world.provenance.files.map(f => f.version))].join(' and ');
  const pages = [['moment', 'This moment'], ['about', 'About the map'], ['classes', 'The classes'], ['people', 'People'], ['games', 'Adventures and Hooks'], ['ribbons', 'The ribbons']];
  return `<nav class="map-panel-page map-panel-contents" aria-label="Contents" data-title="Contents" hidden>
<h3>The State of the World</h3>
${regions.status === 'draft' ? `<p class="map-panel-note">${LIVING_NOTE}</p>\n` : ''}<ul>
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
${peoplePage(people.data, regions.status, sheets.data)}
${ribbonsPage(tonguesData())}
${regions.data.map(r => `<template class="map-chapter" data-region="${slug(r.name)}">
${r.sections.map(sec => `<h3>${esc(sec.heading)}</h3>\n${globeLinks(sec.heading === 'People' ? chapterPeople(people.data.regions.find(x => x.region === r.name), sheets.data) : blocks(sec.text), globeMarks(r))}`).join('\n')}
</template>`).join('\n')}`;
}

// Fills euphonia/index.html's markers from the vendored export, in dev
// and in build alike, the way landing.js fills the landing's.
const MARKERS = ['<!--euphonia-colophon-->', '<!--euphonia-theme-ids-->', '<!--euphonia-theme-key-->', '<!--euphonia-theme-param-->', '<!--euphonia-theme-pick-->', '<!--euphonia-theme-color-->', '<!--euphonia-ribbon-top-->', '<!--euphonia-tabs-->', '<!--euphonia-map-->', '<!--euphonia-builder-->', '<!--euphonia-ribbon-bottom-->', '<!--euphonia-footer-->'];
export function injectEuphonia(html, d = euphoniaFiles(), world = worldData(), fixtures = fixturesData(), calendars = calendarsData(), tongues = tonguesData()) {
  const missing = MARKERS.filter(m => !html.includes(m));
  if (missing.length) throw new Error(`euphonia/index.html is missing ${missing.join(' and ')}: the page has nowhere to go`);
  const [top, bottom] = ribbons(d.regions.data, tongues);
  return html
    // The browser's own chrome takes the page's ground, from the theme it opens in.
    .replace('<!--euphonia-theme-color-->', THEMES[0].tokens.ground)
    // The themes, for the page's first script, which picks one before the
    // page is drawn (public/euphonia/theme-first.js), and the switcher.
    .replace('<!--euphonia-theme-ids-->', THEMES.map(t => t.id).join(' '))
    .replace('<!--euphonia-theme-key-->', THEME_KEY)
    .replace('<!--euphonia-theme-param-->', THEME_PARAM)
    .replace('<!--euphonia-theme-pick-->', themePick())
    .replace('<!--euphonia-ribbon-top-->', top)
    .replace('<!--euphonia-ribbon-bottom-->', bottom)
    .replace('<!--euphonia-tabs-->', tabs())
    .replace('<!--euphonia-map-->', mapStage(d, world, fixtures, calendars))
    .replace('<!--euphonia-builder-->', builder())
    .replace('<!--euphonia-colophon-->', colophon(d.welcome.data))
    .replace('<!--euphonia-footer-->', euphoniaFooter(d.legal.data));
}
