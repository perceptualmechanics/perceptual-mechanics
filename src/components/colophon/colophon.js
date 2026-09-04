// ─── Colophon ───────────────────────────────────────────────────────────────
// A persistent mark, bottom-right of the landing page — click it to open a
// single dialog covering three things a site like this should say somewhere
// but that don't belong inside any one scene: who made it, where the text in
// it actually came from, and how to get in touch. Lives outside the scene
// registry entirely. Fixed in place, not wandering.
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

// One <dd> per entry, which a <dt> is allowed any number of. It used to be a
// single <dd> with the entries joined by `<br><br>`, so a scene citing two
// distinct sources — Orbiter does — published them as one run-on definition
// whose separation existed only as visual whitespace. The blank line is now
// `dd + dd` in the stylesheet, where a gap between two things belongs.
function buildBibliographyHTML() {
  return BIBLIOGRAPHY.map(group => `
    <dt>${group.scene}</dt>
    ${group.entries.map(entry => `<dd>${entry}</dd>`).join('')}
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

  // `inert`, alongside colophon.css's visibility:hidden — deliberately both,
  // and they are not redundant.
  //
  // The bug being fixed: a closed colophon used to be hidden by opacity:0 +
  // pointer-events:none alone, which hides it from the eye and the mouse and
  // nothing else. All six of its focusable elements stayed in the tab order
  // and all five of its headings stayed in the heading tree, on the landing
  // page AND — since the backdrop is appended to document.body after
  // #experience-overlay — at the end of the tab order during a scene.
  //
  // The CSS fix (visibility, transitioned so the fade survives) is the one
  // that keeps working with no JavaScript at all, but it hands the moment of
  // removal to a transition, and a transition is not a guarantee: in a
  // background tab the browser stops advancing them entirely, which was
  // observed live — 650ms after close(), computed visibility was still
  // `visible` and all six elements were still focusable, because the tab
  // wasn't rendering. `inert` is the version that takes effect the instant
  // it's set, whatever the compositor is or isn't doing, and it covers the
  // AT tree and pointer input in the same stroke. Set here rather than in
  // markup so the element is inert from mount, before it has ever opened.
  backdrop.inert = true;

  function open() {
    backdrop.inert = false;
    backdrop.classList.add('open');
    setTimeout(() => title.focus(), 50);
    backdrop.addEventListener('keydown', onKeydown);
  }
  function close() {
    backdrop.classList.remove('open');
    // Inert immediately, not after the fade: nobody tabs into a dialog that
    // is on its way out, and waiting would reintroduce exactly the window
    // this is here to close.
    backdrop.inert = true;
    backdrop.removeEventListener('keydown', onKeydown);
    mark.focus();
  }

  mark.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
  bindEscapeClose(() => { if (backdrop.classList.contains('open')) close(); });
}
