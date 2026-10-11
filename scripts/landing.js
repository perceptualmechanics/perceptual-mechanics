// The landing page's per-scene markup, generated from the registry so that
// adding a scene means editing one list instead of three. Insertion order in
// SCENES is the display order, for the nav and the grid both.
import { SCENES, tileAria } from '../src/scenes/registry.js';
import { ASSIGNMENTS } from '../src/bench/bench.text.js';
import { sigilSvg } from '../src/bench/bench.sigils.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// `icon` is the whole <svg> element, indentation and all, not path data to be
// rebuilt: the icons differ in their open tags (stroke-width, stroke-linejoin),
// and a generator that reconstructs those can get them subtly wrong.
//
// Each button carries the scene's icon and, layered over it, its sigil on the
// workbench, which hover and focus bring forward. Which sigil a scene carries is
// Scott's assignment (bench.text.js); it is resolved here, at build time, so the
// drawings never ship in the page's script.
const withClass = (svg, cls) => svg.replace('<svg ', `<svg class="${cls}" `);

export function navIconsHtml() {
  return Object.entries(SCENES).map(([key, spec]) => {
    const sigil = ASSIGNMENTS[key]?.sigil;
    if (!sigil) throw new Error(`landing: scene "${key}" has no sigil in bench.text.js ASSIGNMENTS`);
    return `    <button type="button" class="nav-icon" data-scene="${key}" data-sigil="${sigil}" aria-label="${esc(spec.label)}">`
      + `${withClass(spec.icon, 'nav-scene')}${withClass(sigilSvg(sigil), 'nav-sigil')}\n    </button>`;
  }).join('\n\n');
}

export function previewTilesHtml() {
  return Object.entries(SCENES).map(([key, spec]) =>
    `      <li class="preview-wrapper" data-scene="${key}">\n`
    + `        <button type="button" class="preview-container" id="preview-${key}"\n`
    + `             aria-label="${esc(tileAria(spec))}">\n`
    + `        </button>\n      </li>`).join('\n\n');
}

// The markers index.html carries in place of the markup. Exported so the gates
// can assert the shipped HTML no longer contains them.
export const NAV_MARKER = '<!--scene-nav-->';
export const TILES_MARKER = '<!--scene-tiles-->';

// A marker sits indented on a line of its own, so replacing the marker alone
// leaves that indentation in front of the first generated element while every
// later one starts at its own indent. Take the line's leading whitespace with
// the marker. The replacement is a function so a `$&` in the markup is literal.
const markerLine = (marker) =>
  new RegExp(`^[ \\t]*${marker.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}`, 'm');

export function injectLanding(html) {
  const missing = [NAV_MARKER, TILES_MARKER].filter(m => !html.includes(m));
  if (missing.length) {
    throw new Error(`index.html is missing ${missing.join(' and ')} — the landing markup has nowhere to go`);
  }
  return html
    .replace(markerLine(NAV_MARKER), () => navIconsHtml())
    .replace(markerLine(TILES_MARKER), () => previewTilesHtml());
}
