// ─── Colophon ───────────────────────────────────────────────────────────────
// A persistent mark, bottom-right of the landing page — click it to open a
// single dialog covering three things a site like this should say somewhere
// but that don't belong inside any one scene: who made it, where the text in
// it actually came from, and how to get in touch. Lives outside the scene
// registry entirely, same reasoning as goldenHare.js, but as a fixed mark
// rather than a wandering one.
//
// Scoped to the landing page on purpose, not fixed to document.body: it's
// appended inside #landing, which main.js already sets to display:none
// while any scene is open (and restores on return) — so it needs no
// visibility logic of its own, and can't collide with any scene's own
// hint/caption/title the way a body-level element would (see the z-index
// scale comment at the top of styles/main.css).
//
// The bibliography below centralizes source information that used to live
// scattered per-scene — most directly, egg.js used to show a per-poem
// "source" line (which doc each poem came from) inside its own reading
// panel; that's been pulled out in favor of listing it all here, once,
// alongside every other scene's literary sourcing. See NOTES.md.
//
// Icon: placeholder. HARE_SVG (imported from goldenHare.js, exported there
// for this reuse) is the site's existing hand-drawn single-hare linework —
// serviceable stand-in, but not the actual mark. The real one is a hand-
// inked hare carrying the same four astrology marks (moon, two Venus
// circles, sun) plus a star, cut through with the Venus/moon/sun/star
// glyphs as literal negative-space holes in the body — a piece by Abby
// Williams (https://abbywilliams.studio/). Swap the button's innerHTML
// (marked below) for an <img> once that file is available as an asset —
// this is a deliberate, one-off exception to the site's usual "canvas
// textures only, no image assets" rule, since crediting someone else's
// actual artwork means using the actual artwork, not redrawing it.

import { bindEscapeClose } from '../utils/sceneKit.js';
import { HARE_SVG } from './goldenHare.js';

const BIBLIOGRAPHY = [
  {
    scene: 'The Orrery of Los Feliz',
    entries: [
      'A found short-short, author and provenance unknown, undated — transcribed in full and unedited.',
    ],
  },
  {
    scene: 'The Egg',
    entries: [
      '"sing, orbiter" — Richard Kenney, "The Invention of the Zero" (epigraph).',
      'Thirteen poems by Scott Jason Cohen, one per satellite: "Courtesans of the Old World," "Springtime in the Garden," "Prologue," "Raise a Glass," "Obvious," "Lament for the Future Never Realized," "Moon Song," "Last Words on the Sea Witch," "After Auden," "The Lovers," and "Haiku," all from Scott Jason Cohen’s Assembled Verse.doc; "DNA," from Nucleus.doc (© 2007 Scott Jason Cohen); and "thirty-six," the full unedited cycle "Lament," "Moon Song," and "Raise a Glass" were themselves drawn from (thirty-six.doc).',
    ],
  },
  {
    scene: 'Leaf',
    entries: [
      '"In The End It Falls Slowly Through The Aether" — Scott Cohen, from Cartography.doc.',
    ],
  },
  {
    scene: 'Selected Works (the illuminated manuscript)',
    entries: [
      'Essays and short fiction, Scott Cohen, 2000s–2010s.',
    ],
  },
  {
    scene: 'The Theater',
    entries: [
      'Truth and Beauty (2001), Paul Revere (c. 2009), and You’ve Got a Friend in Satan (1996) — three plays, Scott Cohen, performed here by ASCII actors.',
    ],
  },
  {
    scene: 'The Sphere',
    entries: [
      'Interconnected prose fragments, Scott Cohen.',
    ],
  },
  {
    scene: 'Elsewhere on the site',
    entries: [
      'The wandering Golden Hare’s line — "A Golden Hare ran across the sky, carrying the sun in its belly, where it would be safe. The hare ran up the ladder to the sky." — found, one sentence, complete as-is.',
    ],
  },
];

let styleInjected = false;
function injectStyles() {
  if (styleInjected || document.getElementById('colophon-styles')) { styleInjected = true; return; }
  styleInjected = true;
  const style = document.createElement('style');
  style.id = 'colophon-styles';
  style.textContent = `
    #colophon-mark {
      position: fixed; right: 1.5rem; bottom: 1.5rem;
      /* Same ~44px touch-target reasoning as .nav-icon in main.css. */
      width: 48px; height: 48px; min-width: 44px; min-height: 44px;
      display: flex; align-items: center; justify-content: center;
      background: rgba(10,8,6,0.35); border: 1px solid rgba(220,190,140,0.25);
      border-radius: 50%; cursor: pointer; z-index: 60;
      color: rgba(230,205,160,0.7);
      transition: opacity 0.25s, transform 0.2s, background 0.2s;
      opacity: 0.55;
    }
    #colophon-mark svg { width: 62%; height: 62%; display: block; }
    #colophon-mark:hover, #colophon-mark:focus-visible {
      opacity: 1; transform: scale(1.08); background: rgba(10,8,6,0.55);
    }
    #colophon-mark:focus-visible {
      outline: 2px solid rgba(255,255,255,0.6); outline-offset: 3px;
    }

    #colophon-backdrop {
      position: fixed; inset: 0; z-index: 9000;
      background: rgba(4,3,2,0.75);
      opacity: 0; pointer-events: none;
      transition: opacity 0.35s ease;
      display: flex; align-items: center; justify-content: center;
      padding: 4vh 1.5rem;
    }
    #colophon-backdrop.open { opacity: 1; pointer-events: all; }

    #colophon-panel {
      width: min(640px, 100%); max-height: 88vh; overflow-y: auto;
      background:
        radial-gradient(ellipse at 30% 0%, rgba(60,48,32,0.3), transparent 60%),
        #0d0a07;
      border: 1px solid rgba(220,200,180,0.15);
      border-radius: 6px;
      padding: 2.75rem 2.25rem 2.25rem;
      position: relative;
      font-family: 'Times New Roman', serif;
      color: rgba(225,218,205,0.75);
      transform: translateY(10px); transition: transform 0.35s ease;
      scrollbar-color: rgba(220,200,180,0.3) #0a0908; scrollbar-width: thin;
    }
    #colophon-backdrop.open #colophon-panel { transform: translateY(0); }

    #colophon-close {
      position: absolute; top: 1.2rem; right: 1.2rem; background: none;
      border: none; color: rgba(255,255,255,0.4); font-size: 1.2rem;
      cursor: pointer; padding: .5rem; line-height: 1;
    }
    #colophon-close:hover { color: rgba(255,255,255,0.9); }

    #colophon-panel h2 {
      font-size: 1.3rem; letter-spacing: 0.1em; text-transform: uppercase;
      color: rgba(238,225,205,0.85); margin-bottom: 0.3rem; font-weight: normal;
    }
    #colophon-panel .colophon-sub {
      font-size: 0.8rem; font-style: italic; color: rgba(225,215,195,0.4);
      margin-bottom: 1.6rem;
    }
    #colophon-panel h3 {
      font-size: 0.78rem; letter-spacing: 0.18em; text-transform: uppercase;
      color: rgba(230,205,160,0.8); font-weight: normal;
      margin: 2rem 0 0.8rem; padding-top: 1.6rem;
      border-top: 1px solid rgba(220,200,180,0.15);
    }
    #colophon-panel section:first-of-type h3 { border-top: none; padding-top: 0; }
    #colophon-panel p { font-size: 0.92rem; line-height: 1.75; margin: 0 0 0.9rem; }
    #colophon-panel a { color: rgba(230,205,160,0.85); }
    #colophon-panel a:hover, #colophon-panel a:focus-visible { color: rgba(255,235,190,1); }

    #colophon-bib dt {
      font-size: 0.8rem; letter-spacing: 0.03em; color: rgba(190,255,210,0.7);
      margin-top: 1.1rem;
    }
    #colophon-bib dd {
      font-size: 0.86rem; line-height: 1.7; color: rgba(210,215,205,0.65);
      margin: 0.3rem 0 0; padding-left: 0;
    }
    #colophon-bib dd + dt { margin-top: 1.3rem; }

    #colophon-feedback-link {
      display: inline-block; margin-top: 0.3rem;
      font-size: 0.92rem; padding: 0.5rem 0;
    }

    @media (max-width: 600px) {
      #colophon-panel { padding: 3.5rem 1.4rem 1.6rem; }
    }
    @media (prefers-reduced-motion: reduce) {
      #colophon-mark { transition: none; }
      #colophon-mark:hover { transform: none; }
      #colophon-backdrop, #colophon-panel { transition: none; }
    }
  `;
  document.head.appendChild(style);
}

function buildBibliographyHTML() {
  return BIBLIOGRAPHY.map(group => `
    <dt>${group.scene}</dt>
    <dd>${group.entries.join('<br><br>')}</dd>
  `).join('');
}

function buildPanel() {
  const panel = document.createElement('div');
  panel.id = 'colophon-panel';
  panel.setAttribute('role', 'document');
  panel.innerHTML = `
    <button id="colophon-close" aria-label="Close colophon">✕</button>

    <section>
      <h2 id="colophon-title" tabindex="-1">Colophon</h2>
      <div class="colophon-sub">perceptual mechanics</div>
      <p>A personal site by Scott Jason Cohen — nine small experiences built
      around found and written text, each its own self-contained piece of
      code, none of it built from image assets: everything on screen is
      drawn live, in the browser, from geometry and canvas-generated
      texture. Built with Three.js and vanilla JavaScript.</p>
      <h3>The mark</h3>
      <p>The leaping hare used as this site's colophon — carrying the moon,
      two Venus circles, a sun, and a star cut straight through its body —
      is drawn by <a href="https://abbywilliams.studio/" target="_blank" rel="noopener noreferrer">Abby Williams</a>.</p>
    </section>

    <section>
      <h3>Bibliography</h3>
      <p class="colophon-sub" style="margin-bottom:1rem;">Where the text in each piece actually comes from.</p>
      <dl id="colophon-bib">${buildBibliographyHTML()}</dl>
    </section>

    <section>
      <h3>Feedback</h3>
      <p>Found a bug, or just want to say something about one of these?</p>
      <a id="colophon-feedback-link" href="mailto:scottjasoncohen@gmail.com?subject=perceptualmechanics.com">scottjasoncohen@gmail.com</a>
    </section>
  `;
  return panel;
}

export function initColophon() {
  const landing = document.getElementById('landing');
  if (!landing) return;

  injectStyles();

  const mark = document.createElement('button');
  mark.id = 'colophon-mark';
  mark.innerHTML = HARE_SVG;
  mark.setAttribute('aria-label', 'Colophon, bibliography, and feedback');
  mark.setAttribute('aria-haspopup', 'dialog');
  landing.appendChild(mark);

  const backdrop = document.createElement('div');
  backdrop.id = 'colophon-backdrop';
  const panel = buildPanel();
  backdrop.appendChild(panel);
  document.body.appendChild(backdrop);

  const title = panel.querySelector('#colophon-title');
  const closeBtn = panel.querySelector('#colophon-close');

  function open() {
    backdrop.classList.add('open');
    setTimeout(() => title.focus(), 50);
  }
  function close() {
    backdrop.classList.remove('open');
    mark.focus();
  }

  mark.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
  bindEscapeClose(() => { if (backdrop.classList.contains('open')) close(); });
}
