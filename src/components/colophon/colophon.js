// ─── Colophon ───────────────────────────────────────────────────────────────
// A persistent mark, bottom-right of the landing page — click it to open a
// single dialog covering three things a site like this should say somewhere
// but that don't belong inside any one scene: who made it, where the text in
// it actually came from, and how to get in touch. Lives outside the scene
// registry entirely, same as the wandering-hare component this replaced
// (`components/goldenHare.js`, retired 2026-07-17 — once the colophon's own
// mark became an actual hare, a second, separate wandering-hare easter egg
// was redundant; see NOTES.md's "1.0.1" entry). This one's fixed in place
// rather than wandering.
//
// Scoped to the landing page on purpose, not fixed to document.body: it's
// appended inside #landing, which main.js already sets to display:none
// while any scene is open (and restores on return) — so it needs no
// visibility logic of its own, and can't collide with any scene's own
// hint/caption/title the way a body-level element would (see the z-index
// scale comment at the top of styles/main.css).
//
// Icon: the real mark. public/hare-colophon.png — a hand-inked hare
// carrying a sun, the Venus and Mercury symbols, a crescent moon, and a
// star, each cut straight through the body as literal negative-space
// holes — is a piece
// by Abby Williams (https://abbywilliams.studio/), supplied by Scott and
// cropped tight to its own bounding box (the original export had a lot of
// transparent canvas margin around it, which would've left the glyph
// tiny and off-center inside the small round button). This is a
// deliberate, one-off exception to the site's usual "canvas textures
// only, no image assets" rule — crediting someone else's actual artwork
// means using the actual artwork, not redrawing it. The original,
// uncropped export and the paper scan it was drawn from both live in
// ../perceptualmechanics-source-material/ (untracked), not in public/,
// so nothing unused ships to production.

import { bindEscapeClose, parseHTML } from '../../utils/sceneKit.js';
import './colophon.css';
import colophonHtml from './colophon.html?raw';
import { BIBLIOGRAPHY } from './colophon.text.js';

// Colophon's markup+CSS live in colophon.html/colophon.css (imported
// above) — no runtime element construction or style injection needed now
// that all three are real files, pulled in via parseHTML.

function buildBibliographyHTML() {
  return BIBLIOGRAPHY.map(group => `
    <dt>${group.scene}</dt>
    <dd>${group.entries.join('<br><br>')}</dd>
  `).join('');
}

export function initColophon() {
  const landing = document.getElementById('landing');
  if (!landing) return;

  const shell = parseHTML(colophonHtml);
  const mark = shell.querySelector('.colophon-mark');
  const backdrop = shell.querySelector('.colophon-backdrop');
  const panel = backdrop.querySelector('.colophon-panel');
  landing.appendChild(mark);
  document.body.appendChild(backdrop);

  panel.querySelector('.colophon-bib').innerHTML = buildBibliographyHTML();

  const title = panel.querySelector('#colophon-title');
  const closeBtn = panel.querySelector('.colophon-close');

  // aria-modal="true" tells assistive tech everything outside is inert —
  // that's only true if Tab actually can't reach outside either. Nothing
  // else on the site enforces this (the in-scene panels are deliberately
  // aria-modal="false" and don't need it; #experience-overlay's own nav
  // is intentionally still reachable, a different tradeoff — see main.js).
  // This one really is a full-backdrop, nothing-else-reachable dialog, so
  // it's the one place a real trap belongs: Tab/Shift+Tab cycle between
  // the panel's own first and last focusable elements instead of escaping
  // into the hidden page behind the backdrop.
  function focusableEls() {
    return Array.from(panel.querySelectorAll('button, a[href], [tabindex]'))
      .filter(el => el.tabIndex !== -1 || el === title);
  }
  function onKeydown(e) {
    if (e.key !== 'Tab') return;
    const els = focusableEls();
    if (!els.length) return;
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  function open() {
    backdrop.classList.add('open');
    setTimeout(() => title.focus(), 50);
    backdrop.addEventListener('keydown', onKeydown);
  }
  function close() {
    backdrop.classList.remove('open');
    backdrop.removeEventListener('keydown', onKeydown);
    mark.focus();
  }

  mark.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
  bindEscapeClose(() => { if (backdrop.classList.contains('open')) close(); });
}
