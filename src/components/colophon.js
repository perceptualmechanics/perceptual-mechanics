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
// The bibliography below centralizes source information that used to live
// scattered per-scene — most directly, egg.js used to show a per-poem
// "source" line (which doc each poem came from) inside its own reading
// panel; that's been pulled out in favor of listing it all here, once,
// alongside every other scene's literary sourcing. See NOTES.md.
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

import { bindEscapeClose } from '../utils/sceneKit.js';

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
      'Fourteen poems by Scott Jason Cohen — eight shown, one per satellite, a different slice of the full set each visit: "Courtesans of the Old World," "Springtime in the Garden," "Prologue," "Raise a Glass," "Lament for the Future Never Realized," "Moon Song," "After Auden," "The Lovers," and "Haiku," all from Scott Jason Cohen’s Assembled Verse.doc; "DNA," from Nucleus.doc (© 2007 Scott Jason Cohen); and four verse openings that each run on into prose after a few lines — "Apocrypha," "The way her hips sway is unique," "here comes no sun today," and "(Underneath scams and heart attacks," — each its own separate source file.',
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
];
// The Golden Hare's found line — "A Golden Hare ran across the sky, carrying
// the sun in its belly, where it would be safe. The hare ran up the ladder
// to the sky." — used to have its own "Elsewhere on the site" entry here,
// crediting the wandering-hare component that used to carry it. That
// component's retired now (see the file header comment), so the line moved
// into the credits section itself instead, right next to the mark it's
// named after — see buildPanel()'s "The mark" section below.

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
      transition: opacity 0.25s, transform 0.2s, background 0.2s;
      opacity: 0.6;
    }
    #colophon-mark img {
      width: 78%; height: auto; display: block; position: relative;
      /* Burnished-gold read: warm the ink's browns toward true gold and
         add a soft gold halo, rather than leaving it at flat scan colors. */
      filter: sepia(0.4) saturate(2) brightness(1.1) contrast(1.05)
              drop-shadow(0 0 4px rgba(255,195,90,0.55));
    }
    /* The actual "gleam" — a bright highlight sweeping across the hare on
       a slow cycle, masked to the hare's own silhouette (same PNG, reused
       as an alpha mask) so the shine only crosses the metal, not the
       transparent gaps between the scrollwork. mix-blend-mode:screen
       lays the highlight on top of the already-gold-filtered image
       underneath rather than replacing it. */
    #colophon-mark::after {
      content: '';
      position: absolute; inset: 0;
      -webkit-mask-image: url('/hare-colophon.png');
      mask-image: url('/hare-colophon.png');
      -webkit-mask-size: 78% auto; mask-size: 78% auto;
      -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
      -webkit-mask-position: center; mask-position: center;
      background: linear-gradient(115deg,
        transparent 25%, rgba(255,244,210,0.95) 47%,
        rgba(255,215,130,1) 50%, rgba(255,244,210,0.95) 53%, transparent 75%);
      background-size: 300% 300%;
      background-position: 0% 50%;
      mix-blend-mode: screen;
      opacity: 0;
      pointer-events: none;
      animation: colophon-gleam 5s ease-in-out infinite;
    }
    @keyframes colophon-gleam {
      0%, 75%  { opacity: 0;   background-position: 0% 50%; }
      82%      { opacity: 0.9; }
      92%      { opacity: 0.9; background-position: 100% 50%; }
      100%     { opacity: 0;   background-position: 100% 50%; }
    }
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
      /* Gold filter on the img itself stays (that's color, not motion) —
         only the sweeping gleam animation is autonomous motion, so only
         that gets switched off. */
      #colophon-mark::after { animation: none; opacity: 0; }
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
      <p>A personal site by Scott Jason Cohen — seven small experiences built
      around found and written text, each its own self-contained piece of
      code, none of it built from image assets: everything on screen is
      drawn live, in the browser, from geometry and canvas-generated
      texture. Built with Three.js and vanilla JavaScript.</p>
      <h3>The mark</h3>
      <p>The leaping hare used as this site's colophon — carrying the moon,
      Venus, Mercury, a sun, and a star cut straight through its body —
      is drawn by <a href="https://abbywilliams.studio/" target="_blank" rel="noopener noreferrer">Abby Williams</a>.
      It's also a found line of Scott's own, the reason a hare is the mark
      at all: "A Golden Hare ran across the sky, carrying the sun in its
      belly, where it would be safe. The hare ran up the ladder to the sky."</p>
      <h3>Elsewhere</h3>
      <p>More perceptual mechanics on
      <a href="https://www.youtube.com/channel/UCzALlcscmGHgXJVyN6lMInw" target="_blank" rel="noopener noreferrer">YouTube</a>
      and <a href="https://www.patreon.com/cw/perceptualmechanics" target="_blank" rel="noopener noreferrer">Patreon</a>.</p>
    </section>

    <section>
      <h3>Bibliography</h3>
      <p class="colophon-sub" style="margin-bottom:1rem;">Where the text in each piece actually comes from.</p>
      <dl id="colophon-bib">${buildBibliographyHTML()}</dl>
    </section>

    <section>
      <h3>Feedback</h3>
      <p>Found a bug, or just want to say something about one of these?</p>
      <a id="colophon-feedback-link" href="mailto:perceptualmechanics@gmail.com?subject=perceptualmechanics.com">perceptualmechanics@gmail.com</a>
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
  mark.setAttribute('aria-label', 'Colophon, bibliography, and feedback');
  mark.setAttribute('aria-haspopup', 'dialog');
  const markImg = document.createElement('img');
  markImg.src = '/hare-colophon.png';
  markImg.alt = ''; // decorative — the button's own aria-label already says what this opens
  mark.appendChild(markImg);
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
