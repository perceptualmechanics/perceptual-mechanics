import { existsSync, readFileSync } from 'node:fs';
import { euphoniaFiles } from './verify-euphonia.mjs';
import { inline, blocks } from '../src/euphonia/euphonia.markdown.js';
import { slug } from '../src/euphonia/euphonia.places.js';
import { worldData, fixturesData, calendarsData, reliefData, rosesData, bordersData } from './verify-euphonia-map.mjs';
import { ribbonOrder, tonguesData } from './verify-euphonia-tongues.mjs';
import { THEMES, THEME_KEY, THEME_PARAM } from '../src/euphonia/euphonia.themes.js';
import { DRAFT_NOTE_HTML } from './euphonia-draft-note.mjs';

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
function mapStage({ classes, regions, adventures, hidden, people, sheets, welcome }, world, fixtures, calendars) {
  const globe = `<div class="map-cell"><div class="map-disc" tabindex="0" role="group" aria-label="The globe" aria-describedby="map-help">
<canvas class="map-ambient" aria-hidden="true"></canvas>
<canvas aria-hidden="true"></canvas>
<div class="map-labels"></div>
</div></div>`;
  return `<div class="map-globe">
${globe}
</div>
<div class="map-panel" role="dialog" aria-modal="false" aria-labelledby="map-panel-title">
<div class="map-panel-bar">
<p class="map-panel-back" hidden><button type="button">Contents</button></p>
<button type="button" class="map-panel-close" aria-label="Close panel">&#215;</button>
</div>
<h2 id="map-panel-title" class="map-panel-title" tabindex="-1"></h2>
${panelSections({ classes, regions, adventures, hidden, people, sheets, welcome }, world, fixtures, calendars)}
<section class="map-panel-pick" aria-labelledby="map-panel-pick-title" hidden>
<h3 id="map-panel-pick-title">The place you picked</h3>
<dl class="map-panel-facts"></dl>
<p class="map-panel-mention"></p>
<p class="map-panel-nearby" hidden><button type="button" class="map-panel-read"></button></p>
</section>
<div class="map-panel-region" hidden>
<p><button type="button" class="map-panel-zoom">Zoom to it</button></p>
<p class="map-panel-theme" hidden><button type="button"></button></p>
<h3 id="map-panel-places-title">Its places on the map</h3>
<ul class="map-panel-places" aria-labelledby="map-panel-places-title"></ul>
<div class="map-panel-content"></div>
${regions.status === 'draft' ? `${DRAFT_NOTE_HTML}\n` : ''}</div>
</div>
<p class="map-status" aria-live="polite"></p>
<div class="map-peek" hidden><p class="map-peek-label"></p><button type="button" class="map-peek-back">Back to entry</button></div>
<p class="map-help visually-hidden" id="map-help">Drag the globe across, or focus it and use the left and right arrows, to spin it on its axis; drag up or down, or use the up and down arrows, to slide its brass ring through the horizon and set it for a latitude, the pole raised that far. The wheel, a pinch, or + and − zoom; 0 sets it home again. The wooden horizon's calendar marks today beside the sun's place in the zodiac. A region's name opens its chapter beside the globe, and Contents lists every chapter and the rest of the book's pages. Click or tap a place, or press Enter on the globe for the place at its centre: the panel gives its time, its sun and its tide, and opens its region's chapter where the chapter names it.</p>
<noscript><p class="map-help">The map and its pages are drawn in the page by script.</p></noscript>`;
}

// The front door (the front-door brief, 16 November 2026), the panel's first
// page on a first visit: what Euphonia is, in the first sentences of the
// book's Welcome and its Pitch; one moment of it, warmth before rules, from
// Life in 1668; three ways in, by who the reader is, the first the games a
// table can play tonight; and what the books leave open to build on
// (euphonia.welcome.json, euphonia.adventures.json). Every word of it is the
// book's but the doors' names.
// A sentence ends at its stop, before the space and the capital (or the
// emphasis) the next begins with.
const sentences = md => md.split(/(?<=[.?!])\s+(?=[*“A-Z])/);
// The moment stops before the sentence that sends the reader elsewhere in the
// book: a cross-reference in parentheses, "(The World in 1668, The Mark)".
const CROSS_REFERENCE = /\([A-Z][^)]*,[^)]*\)/;
// A paragraph's bold lead ("**Ready to run.**"), which names it rather than says it.
const LEAD = /^\*\*[^*]+\*\*\s*/;
const TONIGHT_DOOR = 'Play tonight', WORLD_DOOR = 'Explore the world';
// The quiet line for those who build on the setting, on either front door.
const forBuilders = welcome => `<p class="welcome-open">${inline(sentences(welcome.building.replace(LEAD, ''))[0])} <a href="#orc-notice">The ORC Notice</a></p>`;
function welcomePage(welcome, games) {
  const tonight = games.filter(g => g.ready);
  if (!tonight.length) throw new Error('euphonia: no game in Adventures and Hooks is Ready to run, for the front door\'s first way in');
  const moment = sentences(welcome.moment.text);
  const cut = moment.findIndex(t => CROSS_REFERENCE.test(t)), told = cut < 0 ? moment : moment.slice(0, cut);
  const door = (title, body) => `<h3>${title}</h3>\n${body}`;
  const ways = items => `<ul class="welcome-ways">${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
  const page = (id, name) => `<button type="button" data-page="${id}">${name}</button>`;
  return `<section class="map-panel-page map-panel-welcome" data-page="welcome" data-title="Welcome to Euphonia" hidden>
<p class="welcome-lead">${inline(sentences(welcome.opening[0])[0])}</p>
<p>${inline(sentences(welcome.pitch[0])[0])}</p>
<figure class="welcome-moment">
<blockquote><p>${inline(told.join(' '))}</p></blockquote>
<figcaption>${esc(welcome.moment.where.replace(/^The Setting, /, ''))}</figcaption>
</figure>
<details class="welcome-more"><summary>More about Euphonia</summary>
${[...welcome.opening, ...welcome.world].map(p => `<p>${inline(p)}</p>`).join('\n')}
</details>
${door(TONIGHT_DOOR, `${tonight.map(g => `<p>${inline(g.ready.replace(LEAD, ''))}</p>`).join('\n')}
${ways([page('games', 'Adventures and Hooks')])}`)}
${door('Make a character', ways([...(hasReading() ? ['<a href="#reading" data-leave="tab-reading">The Reading</a>'] : []), '<a href="#builder" data-leave="tab-builder">The character builder</a>']))}
${door(WORLD_DOOR, ways(['<button type="button" data-leave>The globe</button>', page('contents', 'The State of the World'), page('people', 'People')]))}
${forBuilders(welcome)}
</section>`;
}

// What Euphonia is, at the foot of every tab, in the book's first paragraph;
// the rest of its welcome is the Welcome page's (euphonia.welcome.json).
function colophon(welcome) {
  return `<section class="colophon" aria-labelledby="colophon-title">
<h2 id="colophon-title">What is Euphonia?</h2>
<p>${inline(welcome.opening[0])} <a href="#welcome">Welcome to Euphonia</a></p>
</section>`;
}

// The theme switcher, beside Contents and Pause motion: a labelled list,
// hidden until the script that runs it does, and a line that says aloud what
// changed.
function themePick() {
  return `<label class="theme-pick" hidden>Theme <select id="theme-pick">${THEMES.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label><span class="visually-hidden" id="theme-said" aria-live="polite"></span>`;
}

// The Reading appears only once the book has exported it, and is then the
// front door: its first screen carries the other ways in, in the page itself
// so they stand even if the Reading's data doesn't load.
const READING = new URL('../src/euphonia/euphonia.reading.json', import.meta.url);
const hasReading = () => existsSync(READING);
function reading(welcome) {
  return hasReading() ? `<section class="reading" id="the-reading" role="tabpanel" aria-labelledby="tab-reading" tabindex="-1" hidden>
<div class="r-bar"><span class="r-act"></span><ol class="r-road" aria-hidden="true"></ol><a class="r-door" href="#builder">I know what I want</a></div>
<div class="r-stage"><p role="status">Opening the reading…</p></div>
<nav class="r-doors" aria-label="Other ways in">
<ul>
<li><a href="#games">${TONIGHT_DOOR}</a></li>
<li><a href="#contents">${WORLD_DOOR}</a></li>
<li><a href="#builder">I know what I want</a></li>
</ul>
${forBuilders(welcome)}
</nav>
</section>` : '';
}

// The tabs over the map and the builder. Hidden until the script that runs
// them does: without it, the page is the map and its text.
function tabs() {
  return `<div class="euphonia-tabs" role="tablist" aria-label="Euphonia" hidden>
<button type="button" role="tab" id="tab-map" aria-controls="map-figure" aria-selected="true">Globe</button>
<button type="button" role="tab" id="tab-builder" aria-controls="character-builder" aria-selected="false" tabindex="-1" aria-label="Character builder"><span class="tab-long">Character </span>builder</button>
${hasReading() ? '<button type="button" role="tab" id="tab-reading" aria-controls="the-reading" aria-selected="false" tabindex="-1">The Reading</button>\n' : ''}</div>`;
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
// A person's sheets: their level 3 build from the Reading first, which a
// newcomer can play, opened in the builder by id; then the book's sheet at
// their full level.
let levelThree = null;
function sheetLink(sheets, name) {
  levelThree ??= new Map(hasReading() ? JSON.parse(readFileSync(READING, 'utf8')).data.roster.filter(p => p.build).map(p => [p.name, p.id]) : []);
  const sh = sheets.find(x => x.name === name), id = levelThree.get(name);
  const full = sh ? `<a class="sheet-link" href="/euphonia/sheets/${esc(sh.file)}">${id ? 'At full strength' : 'Character sheet'}</a> (${esc(sh.line)})` : '';
  return id ? `<a href="/euphonia/?person=${esc(id)}#builder">Character sheet</a>${full ? ` · ${full}` : ''}` : full;
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
${regional.join('\n')}
<section class="people-group" data-group="notable-people" id="notable-people" aria-labelledby="people-notable-people">
<h3 id="people-notable-people">${esc(people.notable.title)}</h3>
${notable}
</section>
${status === 'draft' ? DRAFT_NOTE_HTML : ''}
</section>`;
}

// In each section of a chapter, the first mention of each place its @places
// line names, and of each title, ruler or power its @names line places, is a
// button that turns the globe there (euphonia.map.js). A place is matched as
// the book writes it, a name whatever its case ("The shah", "the shah"), and
// both accents aside, as the map finds a place in a chapter ("Nojpeten"
// finds "Nojpetén"). Text already in a link or a button is left as it is.
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fold = s => s.normalize('NFD').replace(/\p{M}/gu, '');
function globeMarks(r) {
  const id = slug(r.name);
  const mark = (text, flags, attr) => ({
    re: new RegExp(`(?<![\\p{L}])${escapeRe(fold(esc(text)))}(?![\\p{L}])`, flags),
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
      // Matched in the text with its accents folded away, each folded
      // character keeping the index of the one it came from, and cut from
      // the text as written.
      let folded = '';
      const from = [];
      [...rest].reduce((at, ch) => { for (const f of fold(ch)) { folded += f; from.push(at); } return at + ch.length; }, 0);
      let first = null;
      for (const m of left) {
        const found = m.re.exec(folded);
        if (found && (!first || found.index < first.found.index)) first = { m, found };
      }
      if (!first) break;
      const start = from[first.found.index], end = from[first.found.index + first.found[0].length - 1] + 1;
      out += rest.slice(0, start) + first.m.button(rest.slice(start, end));
      rest = rest.slice(end);
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
// The states of 1668: whose they are, under what licence, how they're drawn,
// and every change from the record, from the vendored provenance.
function bordersNote({ provenance: b, polities, fronts }) {
  const changes = b.corrections.map(c => `${esc(c.row)} ${c.at ? `at ${esc(c.at.name)}` : `in ${esc(c.within.country)}${c.within.southOf ? ` south of ${esc(c.within.southOf.name)}` : ''}`} ${c.to ? `to ${esc(c.to)}` : 'dropped'} (${c.region ? `the book: “${esc(c.because[0])}”` : `<a href="${esc(c.source.url)}">${esc(c.source.title)}</a>`})`).join('; ');
  const departs = [...polities.filter(q => q.kind === 'departs'), ...fronts].map(d => esc(d.star.replace(/^✦\s*/, ''))).join(' ');
  return `<p class="note">The states of ${b.year} are Seshat's Cliopatria (<a href="https://github.com/Seshat-Global-History-Databank/cliopatria">release ${esc(b.release)}</a>, <a href="${esc(b.licence)}">CC BY 4.0</a>; ${esc(b.cite)}), cut back from the shore this map draws and simplified as its coasts are. Each region's chapter says which of its states had firm edges and which were zones. A fine line is a firm edge, drawn and argued over. Elsewhere a band of wash runs along the inside of a state's edge, as Dutch colourists coloured boundaries, with no line under it: a people's country, not a surveyor's mark. Changed from the record: ${changes}.</p>
<p class="note">✦ marks where the book departs from the record, drawn from its chapters: dashed where the book names a firm side, washed where it names a zone, and a dotted ring for a front. ${departs}</p>`;
}
function panelSections({ classes, regions, adventures, hidden, people, sheets, welcome }, world, fixtures, calendars, relief = reliefData()) {
  const cited = Object.values(calendars.sources).map(s => `<a href="${esc(s.url)}">${esc(s.title)}</a>`).join(', ');
  const lakes = world.historic.map(l => `${esc(l.name)} (${esc(l.date)})`).join(', ');
  const versions = [...new Set(world.provenance.files.map(f => f.version))].join(' and ');
  const pages = [['welcome', 'Welcome'], ['moment', 'This moment'], ['about', 'About the map'], ['classes', 'The classes'], ['people', 'People'], ['games', 'Adventures and Hooks'], ['ribbons', 'The ribbons']];
  return `<nav class="map-panel-page map-panel-contents" aria-label="Contents" data-title="Contents" hidden>
<h3>The State of the World</h3>
<ul>
${regions.data.map(r => `<li><button type="button" data-region="${slug(r.name)}">${esc(r.name)}</button></li>`).join('\n')}
</ul>
<h3>The book</h3>
<ul>
${hasReading() ? '<li><button type="button" data-go="#reading">The Reading</button></li>\n' : ''}${pages.map(([id, name]) => `<li><button type="button" data-page="${id}">${name}</button></li>`).join('\n')}
</ul>
${regions.status === 'draft' ? `${DRAFT_NOTE_HTML}\n` : ''}</nav>
${welcomePage(welcome.data, adventures.data)}
<section class="map-panel-page map-panel-moment" data-page="moment" data-title="This moment" hidden>
<p class="map-readout">The world between 1 November 1668 and 31 October 1669, on one globe.</p>
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
${hidden.data.tide.map(p => `<p>${inline(p)}</p>`).join('\n')}
<p class="by">From Euphonia, Scott Cohen's setting: not history. ${esc(hidden.data.where)}.</p>
<p class="by">How the map reads it, where the rule leaves it to the DM (Scott, 1 November 2026): a night runs from sunset to sunrise in each place's own calendar, so the dark half begins at sunset on its first night and ends at sunrise after its last. Where a place's calendar has no 31 October, its half and open nights are as the DM says. The moon, the sun and the dates the rule reads are computed; the rule is Scott's.</p>
</blockquote>
<p class="note">Coasts, lakes and rivers are Natural Earth's (public domain, versions ${esc(versions)}), and modern. Natural Earth has no outlines from 1668; where it has older ones, the map draws them dashed, each with its own date: ${lakes}. The regions glow round the places each chapter names, looked up in Natural Earth's populated places.</p>
<p class="note">Relief and ocean depths are ${esc(relief.provenance.source)}, averaged to a quarter degree; its detail is ${esc(relief.provenance.note.split(';')[0].replace(/^Five-minute resolution/, 'five-minute'))}, and coarser elsewhere. The land is lit from the northwest, its slopes steepened ${relief.shading.exaggeration.toFixed(0)} times, so the steepest hundredth of them shade as 45°; the sea is banded at Natural Earth's bathymetric depths. The wind roses stand at the ${rosesData().roses.length} points of open sea farthest from the coasts this map draws.</p>
${bordersNote(bordersData())}
<p class="note">The sun's place is NOAA's, checked against JPL Horizons; the moon's phases are checked against Espenak's catalogue. ${esc(fixtures.moon.acknowledgment)} The moon is drawn as it looked from north of the tropics; south of them it is mirrored.</p>
<p class="note">Each date is the one its seat's sundials gave at that moment, and the Hijri day begins at the seat's sunset. The Hijri dates are tabular (the 30-year cycle, from the civil epoch); months begun by sighting the new moon could differ by a day. Which calendar each polity kept: ${cited} (Wikipedia). The Safavids' and the Mughals' are not shown yet: no source in hand says which calendar their governments kept in 1668.</p>
</section>
<section class="map-panel-page" data-page="classes" data-title="The classes" hidden>
${catalog(classes.data.map(c => `<li><span class="t">${esc(c.name)}</span><span class="n">${inline(c.blurb)}</span></li>`))}
</section>
<section class="map-panel-page" data-page="games" data-title="Adventures and Hooks" hidden>
${catalog(adventures.data.map(g => `<li><span class="t">${esc(g.title)}</span><span class="e">${[g.kind, g.where].filter(Boolean).map(inline).join(' · ')}</span>${g.summary ? `<span class="n">${inline(g.summary)}</span>` : ''}${g.ready ? `<span class="n">${inline(g.ready)}</span>` : ''}${g.hooks.length ? `<details><summary>Hooks</summary><ul>${g.hooks.map(h => `<li>${inline(h)}</li>`).join('')}</ul></details>` : ''}</li>`))}
</section>
${peoplePage(people.data, regions.status, sheets.data)}
${ribbonsPage(tonguesData())}
${regions.data.map(r => `<template class="map-chapter" data-region="${slug(r.name)}">
${r.sections.map((sec, i) => {
    const body = globeLinks(sec.heading === 'People' ? chapterPeople(people.data.regions.find(x => x.region === r.name), sheets.data) : blocks(sec.text), globeMarks(r));
    // A chapter opens on its first section, At a Glance; the rest wait, each
    // under its heading, until the reader opens it.
    return i ? `<details class="map-chapter-more"><summary><h3>${esc(sec.heading)}</h3></summary>\n${body}\n</details>` : `<h3>${esc(sec.heading)}</h3>\n${body}`;
  }).join('\n')}
</template>`).join('\n')}`;
}

// Fills euphonia/index.html's markers from the vendored export, in dev
// and in build alike, the way landing.js fills the landing's.
const MARKERS = ['<!--euphonia-colophon-->', '<!--euphonia-theme-ids-->', '<!--euphonia-theme-key-->', '<!--euphonia-theme-param-->', '<!--euphonia-theme-pick-->', '<!--euphonia-theme-color-->', '<!--euphonia-ribbon-top-->', '<!--euphonia-tabs-->', '<!--euphonia-reading-->', '<!--euphonia-map-->', '<!--euphonia-builder-->', '<!--euphonia-ribbon-bottom-->', '<!--euphonia-footer-->'];
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
    .replace('<!--euphonia-reading-->', reading(d.welcome.data))
    .replace('<!--euphonia-colophon-->', colophon(d.welcome.data))
    .replace('<!--euphonia-footer-->', euphoniaFooter(d.legal.data));
}
