// The page's theme: its tokens, as custom properties the build makes from
// euphonia.themes.json, which the stylesheet and the globe's drawing read;
// and the switcher. The theme the page opens in is set before it's drawn
// (public/euphonia/theme-first.js). Choosing one here keeps it for this
// reader where the browser allows, puts it in the address so a link carries
// it, says so aloud, and tells the globe, which recolours itself.
import 'virtual:euphonia-themes.css';
import { THEMES, THEME_KEY, THEME_PARAM } from './euphonia.themes.js';
import { ORNAMENTS } from './euphonia.ornament.js';

const root = document.documentElement;
const pick = document.getElementById('theme-pick'), said = document.getElementById('theme-said');
const tint = document.querySelector('meta[name="theme-color"]');

export const currentTheme = () => THEMES.find(t => t.id === root.dataset.theme) ?? THEMES[0];
// The browser's own chrome in the theme's ground; and the theme's ornament,
// drawn in its own colours at its own size, for the bar's rule and the
// sheet's head (euphonia.css). A theme without one has none.
function paint() {
  const t = currentTheme(), o = t.ornament;
  tint?.setAttribute('content', t.tokens.ground);
  if (!o) { delete root.dataset.ornament; return; }
  const css = getComputedStyle(root), course = parseFloat(css.fontSize) * o.course;
  const colors = { stone: css.getPropertyValue('--frame').trim(), joint: css.getPropertyValue('--frame-edge').trim() };
  for (const part of ['rule', 'band']) {
    const { svg, height } = ORNAMENTS[o.kind](o[part], course, colors);
    root.style.setProperty(`--ornament-${part}`, `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
    root.style.setProperty(`--ornament-${part}-height`, `${height}px`);
  }
  root.dataset.ornament = o.kind;
}

export function setTheme(id) {
  if (id === root.dataset.theme || !THEMES.some(t => t.id === id)) return;
  root.dataset.theme = id;
  delete root.dataset.themeFirst;
  try { localStorage.setItem(THEME_KEY, id); } catch { /* not kept: the address still carries it */ }
  const url = new URL(location.href);
  url.searchParams.set(THEME_PARAM, id);
  history.replaceState(history.state, '', url);
  if (pick) pick.value = id;
  paint();
  if (said) said.textContent = `The page is now in the colours of ${currentTheme().name}.`;
  document.dispatchEvent(new CustomEvent('euphonia:theme', { detail: currentTheme() }));
}

if (pick) {
  pick.value = currentTheme().id;
  pick.addEventListener('change', () => setTheme(pick.value));
  pick.closest('label').hidden = false;
}
paint();
