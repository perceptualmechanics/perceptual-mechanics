// The landing page's per-scene markup, generated from the registry so that
// adding a scene means editing one list instead of three. Insertion order in
// SCENES is the display order, for the nav and the grid both.
import { SCENES, tileAria } from '../src/scenes/registry.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// `icon` is the whole <svg> element, indentation and all, not path data to be
// rebuilt: the icons differ in their open tags (stroke-width, stroke-linejoin),
// and a generator that reconstructs those can get them subtly wrong.
export function navIconsHtml() {
  return Object.entries(SCENES).map(([key, spec]) =>
    `    <button type="button" class="nav-icon" data-scene="${key}" aria-label="${esc(spec.label)}">`
    + `${spec.icon}\n    </button>`).join('\n\n');
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

export function injectLanding(html) {
  const missing = [NAV_MARKER, TILES_MARKER].filter(m => !html.includes(m));
  if (missing.length) {
    throw new Error(`index.html is missing ${missing.join(' and ')} — the landing markup has nowhere to go`);
  }
  return html.replace(NAV_MARKER, navIconsHtml()).replace(TILES_MARKER, previewTilesHtml());
}
