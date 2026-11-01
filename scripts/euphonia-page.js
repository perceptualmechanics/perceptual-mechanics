import { euphoniaFiles } from './verify-euphonia.mjs';
import { inline } from '../src/euphonia/euphonia.markdown.js';

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

function body({ classes, regions, adventures }) {
  return `<section aria-labelledby="classes">
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
export function injectEuphonia(html, d = euphoniaFiles()) {
  if (!html.includes('<!--euphonia-body-->') || !html.includes('<!--euphonia-footer-->')) {
    throw new Error('euphonia/index.html is missing <!--euphonia-body--> or <!--euphonia-footer--> — the page has nowhere to go');
  }
  return html
    .replace('<!--euphonia-body-->', body(d))
    .replace('<!--euphonia-footer-->', euphoniaFooter(d.legal.data));
}
