// ─── The Theater ───────────────────────────────────────────────────────────
// A little rep cinema playing scenes from three of Scott's scripts: Truth
// and Beauty (2001), Paul Revere (c. 2009), and now You've Got a Friend in
// Satan (1996) — Scott's first play, not a screenplay, but it slots into
// this same movie-theater conceit without much friction. All dialogue is
// verbatim. The Truth and Beauty scenes were checked line-by-line against
// the authoritative script PDF Scott provided directly (no discrepancies
// found — the earlier extraction was already accurate). The Paul Revere
// scenes come from a scanned/image-only PDF with no text layer, OCR'd page
// by page; the two scenes below were spot-checked and cleaned of OCR noise,
// but Paul Revere hasn't been cross-checked against a second authoritative
// source the way Truth and Beauty has. You've Got a Friend in Satan is the
// same situation as Paul Revere — scanned, OCR'd, spot-checked (title page,
// cast page, and closing page all confirmed word-for-word against the
// source images) — but not cross-checked against a second source. The eight
// scenes below are a curated selection, not the whole play; the complete,
// unabridged script (all ~40 pages) lives as its own Word document.
//
// The reel is reshuffled every time you walk in — a different program each
// visit, like a real repertory house — and it starts playing immediately,
// no title card, as if you'd slipped into your seat just after the credits.
//
// No canvas, no WebGL, no images — everything is monospace text: a cowsay-
// style speech bubble, tiny 3-line stick figures, and a theater built out of
// curtain glyphs and CSS for the parts (the audience silhouette overlaying
// the bottom of the screen, MST3K-style, the marquee-bulb frame) where
// actual pixels are more honest than trying to fake them in text.
//
// As of 1.0.23, what happens and when is driven by bard.js (packages/
// bardjs) instead of a bespoke state machine — see the "bard.js wiring"
// comment further down for what changed and what didn't.

import { Player, compileLegacyScript, shuffle, asciiBubble } from 'bardjs';
import { escapeHtml } from '../utils/sceneKit.js';
// The cast list and the reel live in src/text/ now (2026-07-29) — see that
// file's header. They're content, not rendering, and the prerender step that
// builds /text/theater/ imports the same module, so the published script and
// the one performed on stage can't drift apart.
import { CHARACTERS, SCENES } from '../text/theaterScript.js';

// Stick-figure poses stay here: presentation, not script.
const POSES = {
  idle:     ['  O  ', ' /|\\ ', ' / \\ '],
  wave:     ['  O\\ ', ' /|  ', ' / \\ '],
  point:    ['  O  ', ' /|_ ', ' / \\ '],
  shrug:    [' \\O/ ', '  |  ', ' / \\ '],
  openarms: [' \\O/ ', '  |  ', ' / \\ '],
  facepalm: ['  O) ', ' /|  ', ' / \\ '],
  sheepish: ['  o  ', ' /|\\ ', ' / \\ '],
  heart:    [' O<3 ', ' /|\\ ', ' / \\ '],
  lean:     ['   O ', '  /|\\', '  / \\'],
};


function buildStyles() {
  if (document.getElementById('tab-styles')) return;
  const style = document.createElement('style');
  style.id = 'tab-styles';
  style.textContent = `
    .tab-root {
      width: 100%; height: 100%; position: relative; overflow: hidden;
      background: radial-gradient(ellipse at 50% 15%, #241a12 0%, #0b0705 65%, #050302 100%);
      color: #d8cdb8;
      font-family: 'Courier New', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 1.6rem 1rem 0.6rem;
    }

    /* ── curtain, ASCII swags ── */
    .tab-curtain {
      width: 100%; max-width: 900px; text-align: center;
      color: #6b1f1f; font-size: clamp(0.6rem, 1.6vw, 1rem);
      letter-spacing: 0.05em; line-height: 1; white-space: pre; overflow: hidden;
      opacity: 0.85; margin-bottom: 0.3rem;
    }

    /* ── the screen ── */
    .tab-screen-frame {
      position: relative; width: 100%; max-width: 900px; flex: 0 0 auto;
      margin: 0.3rem 0 0.5rem;
      border-radius: 6px;
      padding: 10px;
      background: #1a120b;
      box-shadow: 0 0 0 1px #3a2a18, 0 10px 40px rgba(0,0,0,0.6);
    }
    .tab-screen-frame::before {
      content: ''; position: absolute; inset: 2px; border-radius: 4px;
      background-image: radial-gradient(circle, #e8b84b 1.5px, transparent 1.8px);
      background-size: 16px 16px;
      background-position: center;
      -webkit-mask: linear-gradient(#000 0 0);
      opacity: 0.35; pointer-events: none;
      padding: 8px; box-sizing: border-box;
    }
    .tab-screen {
      position: relative; width: 100%;
      aspect-ratio: 2 / 1; /* a proper widescreen picture, not a tower of headspace */
      min-height: 200px; max-height: 62vh;
      background:
        repeating-linear-gradient(0deg, rgba(0,0,0,0.05) 0 1px, transparent 1px 3px),
        radial-gradient(ellipse at 50% 40%, #f2ede0 0%, #ddd6c2 75%, #c9c1a8 100%);
      border-radius: 3px; overflow: visible; /* dialogue floats over the screen rather than being clipped by it */
      display: flex; flex-direction: column;
      padding-bottom: 54px; /* clear room for the audience silhouette overlay */
      animation: screen-flicker 4s steps(2) infinite;
    }
    @keyframes screen-flicker {
      0%, 96%, 100% { filter: brightness(1); }
      97% { filter: brightness(0.97); }
      98% { filter: brightness(1.02); }
    }
    .tab-slug {
      flex: 0 0 auto; text-align: center; padding: 0.7rem 0.6rem 0.2rem;
      font-size: clamp(0.62rem, 1.6vw, 0.85rem); letter-spacing: 0.08em;
      color: #4a4030; opacity: 0.8; white-space: pre-wrap;
    }
    .tab-stage {
      flex: 1 1 auto; position: relative; min-height: 0;
      display: flex; align-items: flex-end; justify-content: space-evenly;
      padding: 0 0.6rem 0.6rem;
    }
    .tab-actor {
      flex: 0 1 auto; display: flex; flex-direction: column; align-items: center;
      opacity: 0; transition: opacity 0.35s ease;
      color: #221c14; position: relative;
    }
    .tab-actor.on { opacity: 1; }
    .tab-actor pre.sf {
      margin: 0; font-size: clamp(0.7rem, 1.9vw, 1.05rem); line-height: 1.05;
      font-weight: bold; animation: sf-bob 2.8s ease-in-out infinite;
    }
    .tab-actor.talking pre.sf { animation: sf-bob 2.8s ease-in-out infinite, sf-talk 0.45s ease-in-out 2; }
    @keyframes sf-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
    @keyframes sf-talk { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
    .tab-actor .sf-name { font-size: 0.72em; margin-top: 0.1em; font-weight: bold; }
    .tab-actor .sf-tag { font-size: 0.6em; opacity: 0.65; font-style: italic; }

    .tab-bubble {
      position: absolute; left: 50%; bottom: 100%; margin-bottom: 6px;
      transform: translateX(-50%);
      white-space: pre; font-size: clamp(0.58rem, 1.5vw, 0.82rem); line-height: 1.25;
      color: #221c14; background: #f4efe0; /* fully opaque — it floats over dark backgrounds too */
      box-shadow: 0 2px 8px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.15);
      padding: 2px 4px; border-radius: 3px;
      opacity: 0; transition: opacity 0.25s ease;
      pointer-events: none; max-width: min(72vw, 380px); overflow-x: auto;
      z-index: 4; /* always float above the house overlay and frame texture */
    }
    .tab-bubble.on { opacity: 1; }
    .tab-bubble .bubble-name { display: block; font-weight: bold; opacity: 0.6; font-size: 0.85em; margin-bottom: 0.1em; }

    .tab-caption {
      flex: 0 0 auto; text-align: center; padding: 0.3rem 0.8rem 0.7rem;
      font-style: italic; font-size: clamp(0.66rem, 1.7vw, 0.88rem);
      color: #4a4030; opacity: 0; transition: opacity 0.3s ease; min-height: 1.4em;
    }
    .tab-caption.on { opacity: 0.85; }

    /* ── theater house: seat blocks split by aisles, a few occupied by
       patrons — overlaying the bottom of the screen itself, MST3K-style. ── */
    .tab-house {
      position: absolute; left: 10px; right: 10px; bottom: 10px; height: 46px;
      display: flex; align-items: flex-end; justify-content: center;
      gap: clamp(14px, 5vw, 34px); /* the aisles */
      padding: 0 0.6rem;
      pointer-events: none; z-index: 3;
    }
    .tab-house-section {
      display: flex; align-items: flex-end;
      gap: clamp(3px, 1.2vw, 10px);
    }
    .tab-seat {
      width: clamp(16px, 3vw, 26px); height: clamp(18px, 3.6vw, 30px);
      background: #100c08; border-radius: 6px 6px 1px 1px;
      opacity: 0.92;
      position: relative; flex: 0 0 auto;
    }
    .tab-seat.occupied::before {
      content: ''; position: absolute; left: 50%; bottom: 55%; transform: translateX(-50%);
      width: 46%; aspect-ratio: 1; background: #030201; border-radius: 50%;
    }
    .tab-seat.occupied::after {
      content: ''; position: absolute; left: 50%; bottom: -2px; transform: translateX(-50%);
      width: 78%; height: 60%; background: #030201; border-radius: 50% 50% 8% 8%;
    }
    /* the two silhouettes down front who won't stop talking through the movie */
    .tab-seat.host {
      opacity: 1;
      filter: drop-shadow(0 0 5px rgba(232,184,75,0.4));
    }
    .tab-seat.host::before {
      width: 54%; bottom: 62%;
    }
    .tab-seat.host::after {
      width: 86%; height: 66%;
    }
    .tab-seat-nub {
      position: absolute; left: 50%; bottom: 108%; transform: translateX(-50%);
      width: 18%; aspect-ratio: 1; background: #030201; border-radius: 50%;
    }

    /* ── end card ── */
    .tab-card {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center; text-align: center;
      background: #ddd6c2; z-index: 5; cursor: pointer; padding: 1rem;
      color: #221c14; border: none; width: 100%; font: inherit;
    }
    .tab-card h1 {
      font-family: 'Courier New', monospace; font-weight: bold;
      font-size: clamp(1.4rem, 6vw, 2.6rem); margin: 0 0 0.3em; letter-spacing: 0.04em;
    }
    .tab-card pre.tab-ascii-title { font-size: clamp(0.5rem, 1.6vw, 0.85rem); line-height: 1.15; margin: 0 0 0.6em; opacity: 0.75; }
    .tab-card p { font-size: clamp(0.85rem, 2.2vw, 1.05rem); margin: 0.2em 0; opacity: 0.75; max-width: 480px; }
    .tab-card .tab-tap { margin-top: 1.2em; font-size: 0.85rem; opacity: 0.5; }

    /* ── interstitial: a between-scenes theater bumper slide ── */
    .tab-interstitial {
      position: absolute; inset: 0; z-index: 6;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center; padding: 1rem;
      background: radial-gradient(ellipse at 50% 40%, #1a120b 0%, #0b0705 80%);
      color: #e8b84b;
      opacity: 0; pointer-events: none;
      transition: opacity 0.3s ease;
    }
    .tab-interstitial.on { opacity: 1; }
    .tab-inter-eyebrow {
      font-size: clamp(0.55rem, 1.6vw, 0.75rem); letter-spacing: 0.14em;
      opacity: 0.75; margin-bottom: 0.5em; text-transform: uppercase;
    }
    .tab-inter-main {
      font-weight: bold; font-size: clamp(1rem, 3.4vw, 1.6rem);
      max-width: 32ch; line-height: 1.3; margin-bottom: 0.4em;
    }
    .tab-inter-sub {
      font-size: clamp(0.62rem, 1.6vw, 0.8rem); opacity: 0.6; font-style: italic; max-width: 34ch;
    }

    /* ── transport controls ── */
    .tab-controls {
      flex: 0 0 auto; display: flex; align-items: center; justify-content: center;
      gap: 0.5rem; padding: 0.5rem 1rem; font-size: 0.88rem;
    }
    .tab-btn {
      font-family: 'Courier New', monospace; font-size: 0.88rem;
      background: #1a120b; border: 1px solid #6b5638; border-radius: 3px;
      padding: 0.3rem 0.7rem; cursor: pointer; color: #d8cdb8;
    }
    .tab-btn:hover, .tab-btn:focus-visible { background: #2a2018; border-color: #e8b84b; color: #e8b84b; }
    .tab-btn:active { transform: translateY(1px); }
    .tab-progress { opacity: 0.55; min-width: 5.5em; text-align: center; }

    /* Screen-reader-only live narration — visually hidden, announces each
       beat (scene changes, actions, and dialogue) as the reel plays. */
    .tab-sr-live {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
    }

    @media (prefers-reduced-motion: reduce) {
      pre.sf, .tab-screen, .film-reel, .tab-preview::before { animation: none !important; }
    }
    @media (max-width: 640px) {
      .tab-house { height: 32px; bottom: 6px; }
      .tab-screen { padding-bottom: 40px; }
    }

    /* ── vertical phones: narrow width, held in portrait ── */
    @media (max-width: 480px), (max-width: 700px) and (orientation: portrait) {
      .tab-root { padding: 0.9rem 0.4rem 0.4rem; }
      .tab-curtain { font-size: 0.42rem; margin-bottom: 0.15rem; }
      .tab-screen-frame { padding: 6px; margin: 0.2rem 0 0.4rem; }
      .tab-screen { aspect-ratio: 4 / 3; min-height: 240px; padding-bottom: 42px; }
      /* Design pass, 2026-07-17 (Scott: mobile readability check) — .tab-slug
         and .tab-caption were both being set here to a smaller font-size
         than their OWN desktop clamp() floor (0.62rem/0.66rem respectively)
         — backwards, since mobile is exactly where shrinking further hurts
         most. .tab-caption in particular is the italic per-beat description
         line, the thing most likely to actually be read start to finish, so
         it gets the larger bump of the two. Neither shrinks below its
         desktop floor anymore. */
      .tab-slug { font-size: 0.68rem; padding: 0.5rem 0.35rem 0.15rem; letter-spacing: 0.04em; }
      .tab-stage {
        flex-wrap: wrap; row-gap: 0.5rem; column-gap: 0.4rem;
        padding: 0 0.3rem 0.4rem; align-content: flex-end;
      }
      .tab-actor pre.sf { font-size: 0.6rem; }
      .tab-actor .sf-name { font-size: 0.58em; }
      .tab-actor .sf-tag { font-size: 0.5em; }
      .tab-bubble { max-width: 88vw; font-size: 0.54rem; }
      .tab-caption { font-size: 0.74rem; line-height: 1.35; padding: 0.2rem 0.4rem 0.5rem; min-height: 1.2em; }
      .tab-house { height: 24px; bottom: 4px; gap: 9px; }
      .tab-house-section { gap: 1.5px; }
      .tab-seat { width: 10px; height: 12px; }
      .tab-controls { gap: 0.3rem; padding: 0.4rem 0.4rem; flex-wrap: wrap; }
      .tab-btn { font-size: 0.74rem; padding: 0.26rem 0.5rem; }
      .tab-progress { min-width: auto; font-size: 0.7rem; }
      .tab-card h1 { font-size: 1.5rem; }
      .tab-card pre.tab-ascii-title { font-size: 0.42rem; }
      .tab-card p { font-size: 0.8rem; }
      /* The interstitial's own italic sub-line (.tab-inter-sub) had no
         mobile override at all — just the desktop clamp() floor (0.62rem)
         at opacity:0.6 on a near-black background. Same category of
         problem as .tab-caption above, same fix: a firmer floor and a
         touch more opacity so it holds up on a phone screen, not just a
         desktop monitor at a comfortable distance. */
      .tab-inter-sub { font-size: 0.78rem; line-height: 1.4; opacity: 0.75; }
    }
    @media (max-width: 480px) and (orientation: portrait) {
      /* portrait phones have height to spare — let the screen breathe a bit */
      .tab-screen { aspect-ratio: 1 / 1; min-height: 300px; }
    }

    /* ── preview: a rotating black & white film reel ── */
    .tab-preview {
      width: 100%; height: 100%; position: relative; overflow: hidden;
      background: radial-gradient(ellipse at 50% 35%, #2a2a2a 0%, #0d0d0d 70%, #020202 100%);
      display: flex; align-items: center; justify-content: center;
    }
    .tab-preview::before {
      /* faint scratched-film-stock grain */
      content: ''; position: absolute; inset: 0; z-index: 2; pointer-events: none;
      background-image:
        repeating-linear-gradient(115deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 38px),
        repeating-linear-gradient(68deg, rgba(255,255,255,0.045) 0 1px, transparent 1px 53px);
      mix-blend-mode: screen;
      animation: reel-flicker 1.8s steps(4) infinite;
    }
    .reel-glow {
      position: absolute; left: 50%; top: 50%; width: 72%; aspect-ratio: 1;
      transform: translate(-50%, -50%);
      background: radial-gradient(circle, rgba(255,255,255,0.16), transparent 70%);
      filter: blur(6px); pointer-events: none;
    }
    .film-reel {
      position: relative; z-index: 1;
      width: min(58%, 150px); aspect-ratio: 1;
      border-radius: 49% 51% 50% 50% / 51% 49% 51% 49%; /* a hair off true-round — well-worn, not machined */
      background: #161616;
      border: clamp(3px, 2.4%, 7px) solid #5c5c5c;
      box-shadow: 0 0 16px rgba(255,255,255,0.14), inset 0 0 14px rgba(0,0,0,0.7);
      animation: reel-spin 3.4s linear infinite;
    }
    .film-reel::after {
      content: ''; position: absolute; left: 50%; top: 50%;
      width: 20%; height: 20%; transform: translate(-50%, -50%);
      border-radius: 50%; background: #0a0a0a; border: 2px solid #5c5c5c;
    }
    .reel-hole {
      position: absolute; left: 50%; top: 50%;
      width: 20%; height: 20%; margin: -10% 0 0 -10%;
      border-radius: 50%;
      background: radial-gradient(circle, #eee 0%, #b0b0b0 55%, #4a4a4a 100%);
      box-shadow: 0 0 6px rgba(255,255,255,0.4);
      transform: rotate(var(--a, 0deg)) translateY(-170%);
    }
    @keyframes reel-spin { to { transform: rotate(360deg); } }
    @keyframes reel-flicker { 0%, 100% { opacity: 1; } 50% { opacity: 0.9; } }
  `;
  document.head.appendChild(style);
}

const CURTAIN_ROW = '╭⌒╮'.repeat(40);
// Three seat blocks with aisles between them, like a real house. Flat seat
// indices run left block, then center block, then right block.
const SEAT_SECTIONS = [4, 8, 4];
// A sparse scatter of occupied seats among the empty ones — a few other patrons.
const OCCUPIED_SEATS = new Set([1, 2, 4, 7, 8, 11, 13, 14]);
// Front and center: a couple of silhouettes who talk through the whole movie.
const HOST_SEATS = new Set([7, 8]);

function buildHouseRow() {
  const house = document.createElement('div');
  house.className = 'tab-house';
  house.setAttribute('aria-hidden', 'true');
  let i = 0;
  SEAT_SECTIONS.forEach(sectionSize => {
    const section = document.createElement('div');
    section.className = 'tab-house-section';
    for (let s = 0; s < sectionSize; s++, i++) {
      const seat = document.createElement('div');
      const isHost = HOST_SEATS.has(i);
      seat.className = 'tab-seat' + (OCCUPIED_SEATS.has(i) || isHost ? ' occupied' : '') + (isHost ? ' host' : '');
      if (isHost) {
        const nub = document.createElement('div');
        nub.className = 'tab-seat-nub';
        seat.appendChild(nub);
      }
      section.appendChild(seat);
    }
    house.appendChild(section);
  });
  return house;
}

function buildActorEl(key) {
  const ch = CHARACTERS[key];
  const el = document.createElement('div');
  el.className = 'tab-actor';
  el.dataset.char = key;
  el.style.color = ch.color;
  el.innerHTML = `
    <pre class="sf">${POSES.idle.join('\n')}</pre>
    <div class="sf-name">${ch.name}</div>
    ${ch.tag ? `<div class="sf-tag">(${ch.tag})</div>` : ''}
  `;
  return el;
}

// Between-scenes bumper slides — classic repertory-house filler, plus a bit
// of in-universe trivia about the two screenplays.
const INTERSTITIALS = [
  { eyebrow: 'Now is a good time to', main: 'HIT THE REFRESHMENT COUNTER', sub: 'popcorn, candy, and beverages are available in the lobby (there is no lobby)' },
  { eyebrow: 'A gentle reminder', main: 'PLEASE SILENCE YOUR PAGER', sub: 'why on earth do you still have a pager' },
  { eyebrow: 'Movie trivia', main: 'Archibald Query was the actual, real inventor of Marshmallow Fluff.', sub: 'his romantic biography, as depicted here, remains unconfirmed.' },
  { eyebrow: 'Movie trivia', main: 'Paul Revere may or may not have actually shouted “The British are coming.”', sub: 'historians remain divided. the Duck Tour guide is not one of them.' },
  { eyebrow: 'Please note', main: 'THIS THEATER IS NOT RESPONSIBLE FOR LOST ASCII', sub: 'please check under your seat before leaving' },
  { eyebrow: '◆ Intermission ◆', main: 'STRETCH YOUR LEGS', sub: 'the show will resume in a moment' },
  { eyebrow: 'Movie trivia', main: 'This production used zero (0) real cellos.', sub: 'all string instruments performed by consenting ASCII glyphs.' },
  { eyebrow: 'A gentle reminder', main: 'NO FLASH PHOTOGRAPHY', sub: 'the screen is doing its best' },
];

// ─── bard.js wiring ──────────────────────────────────────────────────────
// The reel now runs on bard.js's Player (packages/bardjs) instead of a
// bespoke state machine — compileLegacyScript converts these SCENES
// (unchanged, written years before bard.js existed) into the engine's
// chorus/enter/exit/line vocabulary, verified beat-for-beat against all
// 773 resulting events (see NOTES.md, 1.0.23) before this ever touched the
// live renderer. TheaterRenderer below reuses the exact same DOM structure
// and `.tab-*` classes buildStyles() already defines — nothing about the
// visuals, CSS, or hand-tuned mobile breakpoints changed, only what drives
// them. Actor figures, cowsay bubbles, and captions are all still drawn by
// this file; bard.js only owns "what happens next and when."
class TheaterRenderer {
  constructor({ stage, captionEl, slugEl, interstitialEl, srLive }) {
    this.stage = stage;
    this.captionEl = captionEl;
    this.slugEl = slugEl;
    this.interstitialEl = interstitialEl;
    this.srLive = srLive;
    this.actors = {};
  }

  ensureActor(key) {
    if (this.actors[key]) return this.actors[key];
    const el = buildActorEl(key);
    this.stage.appendChild(el);
    this.actors[key] = el;
    requestAnimationFrame(() => el.classList.add('on'));
    return el;
  }

  clearActors() {
    Object.values(this.actors).forEach(a => a.remove());
    this.actors = {};
  }

  clearBubbles() {
    this.stage.querySelectorAll('.tab-bubble').forEach(b => b.remove());
    Object.values(this.actors).forEach(a => a.classList.remove('talking'));
    this.captionEl.classList.remove('on');
  }

  onSceneChange(scene) {
    this.clearActors();
    this.slugEl.textContent = '[ ' + scene.slug + ' ]';
    this.interstitialEl.classList.remove('on');
  }

  onEnter(keys) {
    // Fixes a real bug (Scott, 2026-07-23: "on some of the interstitials,
    // the next button isn't working"): compileScript tags the intermission
    // event with the *upcoming* scene's sceneIndex, not the outgoing one,
    // so Player only fires onSceneChange (the only other place that clears
    // '.on' here) once -- when landing ON the interstitial, not when
    // leaving it. The new scene's first real event shares that same
    // sceneIndex, so nothing dismissed the card; the whole scene played
    // out silently behind it while "next" looked dead. Every real stage
    // event now clears the card itself instead of relying on a scene
    // boundary that may not exist between it and the interstitial.
    this.interstitialEl.classList.remove('on');
    keys.forEach(k => this.ensureActor(k));
  }

  onExit(keys) {
    this.interstitialEl.classList.remove('on');
    keys.forEach(k => { this.actors[k]?.remove(); delete this.actors[k]; });
  }

  onChorus(text) {
    this.interstitialEl.classList.remove('on');
    this.clearBubbles();
    this.captionEl.textContent = text;
    this.captionEl.classList.add('on');
    this.srLive.textContent = text;
  }

  onLine(key, text, { mask, voice, silent } = {}) {
    this.interstitialEl.classList.remove('on');
    this.clearBubbles();
    const ch = CHARACTERS[key];
    const el = this.actors[key]; // absent for a true offstage voice — nothing to attach a figure to
    if (el) {
      el.querySelector('pre.sf').textContent = (POSES[mask] || POSES.idle).join('\n');
    }

    const speakerLine = `${ch.name}${voice ? ' (voice)' : ''}: ${text}`;
    this.srLive.textContent = speakerLine;
    if (silent) return; // wordless reaction beat — direction is still announced above, no bubble

    if (el) {
      el.classList.add('talking');
      setTimeout(() => el?.classList.remove('talking'), 900);
    }
    const bubbleWidth = (typeof window !== 'undefined' && window.innerWidth < 480) ? 24 : 40;
    const bubble = document.createElement('div');
    bubble.className = 'tab-bubble';
    bubble.innerHTML = `<span class="bubble-name">${ch.name}${voice ? ' (voice)' : ''}</span>${escapeHtml(asciiBubble(text, false, bubbleWidth))}`;
    (el || this.stage).appendChild(bubble);
    requestAnimationFrame(() => bubble.classList.add('on'));
  }

  onIntermission() {
    this.clearBubbles();
    this.captionEl.textContent = '';
    const card = INTERSTITIALS[Math.floor(Math.random() * INTERSTITIALS.length)];
    this.interstitialEl.innerHTML = `
      <div class="tab-inter-eyebrow">${escapeHtml(card.eyebrow)}</div>
      <div class="tab-inter-main">${escapeHtml(card.main)}</div>
      ${card.sub ? `<div class="tab-inter-sub">${escapeHtml(card.sub)}</div>` : ''}
    `;
    this.interstitialEl.classList.add('on');
    this.srLive.textContent = [card.eyebrow, card.main, card.sub].filter(Boolean).join('. ');
  }

  dispose() {
    this.clearActors();
  }
}

export function createTheater(container, { preview = false } = {}) {
  buildStyles();

  if (preview) {
    const root = document.createElement('div');
    root.className = 'tab-preview';
    root.setAttribute('aria-hidden', 'true');
    const holes = [0, 60, 120, 180, 240, 300]
      .map(deg => `<div class="reel-hole" style="--a: ${deg}deg"></div>`)
      .join('');
    root.innerHTML = `
      <div class="reel-glow"></div>
      <div class="film-reel">${holes}</div>
    `;
    container.appendChild(root);
    return { dispose() { root.remove(); } };
  }

  const root = document.createElement('div');
  root.className = 'tab-root';

  const curtain = document.createElement('div');
  curtain.className = 'tab-curtain';
  curtain.setAttribute('aria-hidden', 'true');
  curtain.textContent = CURTAIN_ROW;

  const screenFrame = document.createElement('div');
  screenFrame.className = 'tab-screen-frame';

  const screen = document.createElement('div');
  screen.className = 'tab-screen';
  screen.setAttribute('tabindex', '-1');
  screen.setAttribute('role', 'region');
  screen.setAttribute('aria-label', 'The Theater — scenes from Truth and Beauty and Paul Revere, performed by ASCII actors. Click to advance, or use the controls below.');

  const slugEl = document.createElement('div');
  slugEl.className = 'tab-slug';
  slugEl.setAttribute('aria-hidden', 'true');

  const stage = document.createElement('div');
  stage.className = 'tab-stage';
  // The ASCII figures and their speech bubbles are a visual performance —
  // the sr-live region below carries the same content as real text, so the
  // raw glyphs are hidden from assistive tech rather than read character by
  // character.
  stage.setAttribute('aria-hidden', 'true');

  const captionEl = document.createElement('div');
  captionEl.className = 'tab-caption';

  const interstitialEl = document.createElement('div');
  interstitialEl.className = 'tab-interstitial';
  interstitialEl.setAttribute('aria-hidden', 'true'); // narrated via sr-live instead

  screen.appendChild(slugEl);
  screen.appendChild(stage);
  screen.appendChild(captionEl);
  screen.appendChild(interstitialEl);
  screenFrame.appendChild(screen);
  screenFrame.appendChild(buildHouseRow()); // overlays the bottom of the screen, MST3K-style

  const srLive = document.createElement('div');
  srLive.className = 'tab-sr-live';
  srLive.setAttribute('aria-live', 'polite');
  srLive.setAttribute('aria-atomic', 'true');

  const controls = document.createElement('div');
  controls.className = 'tab-controls';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Theater playback controls');
  controls.innerHTML = `
    <button type="button" class="tab-btn" data-act="prev" aria-label="Previous line">&lt; prev</button>
    <button type="button" class="tab-btn" data-act="play" aria-label="Pause">&gt; play</button>
    <button type="button" class="tab-btn" data-act="next" aria-label="Next line">next &gt;</button>
    <span class="tab-progress"></span>
  `;

  root.appendChild(curtain);
  root.appendChild(screenFrame);
  root.appendChild(controls);
  root.appendChild(srLive);
  container.appendChild(root);
  container.style.position = 'relative';
  container.style.overflow = 'hidden';

  const renderer = new TheaterRenderer({ stage, captionEl, slugEl, interstitialEl, srLive });
  let endCard = null;

  function updateProgress() {
    controls.querySelector('.tab-progress').textContent =
      player.index < 0 ? 'start' : `${player.index + 1} / ${player.length}`;
  }

  function setPlayLabel() {
    const btn = controls.querySelector('[data-act="play"]');
    btn.textContent = player.playing ? '|| pause' : '> play';
    btn.setAttribute('aria-label', player.playing ? 'Pause' : 'Play');
  }

  function showEndCard() {
    // Pre-existing latent bug fixed here in passing: the old goTo() scheduled
    // another setTimeout(showEndCard, 2000) on every call once already at
    // the last index, so repeatedly clicking past the end (unlikely in
    // practice, but possible) could stack up duplicate end cards, and a
    // click on an older one would restart() while a newer one silently
    // stayed put. Guard against re-entry instead.
    if (!player.isAtEnd || endCard) return;
    endCard = document.createElement('button');
    endCard.type = 'button';
    endCard.className = 'tab-card';
    endCard.setAttribute('aria-label', 'The end. Press Enter to reshuffle the reel and start tonight’s next showing.');
    endCard.innerHTML = `
      <pre class="tab-ascii-title" aria-hidden="true">-------------------------\n     F A D E   T O   B L A C K\n-------------------------</pre>
      <h1>THE END</h1>
      <p class="tab-tap">click for tonight’s next showing</p>
    `;
    // Native <button> already fires 'click' for both Enter and Space, so
    // no manual keydown handler is needed (that was only required back
    // when this was a div[role=button]).
    endCard.addEventListener('click', restart);
    screen.appendChild(endCard);
    setPlayLabel();
    srLive.textContent = 'The end. Press Enter to reshuffle the reel and start tonight’s next showing.';
    setTimeout(() => endCard?.focus(), 50);
  }

  // Tracked so dispose() can cancel it — without this, closing the scene
  // within the 2s window still fires showEndCard() afterward against a
  // detached `screen`/`endCard`, same class of bug the Player class itself
  // already guards against internally (see its own dispose()).
  let endCardTimer = null;
  const player = new Player(compileLegacyScript(shuffle(SCENES)), renderer, {
    onAdvance: () => { endCard?.remove(); endCard = null; updateProgress(); setPlayLabel(); },
    onEnd: () => { endCardTimer = setTimeout(showEndCard, 2000); },
  });

  // Reshuffle the reel and start again — a different program each showing.
  function restart() {
    endCard?.remove();
    endCard = null;
    player.restart(compileLegacyScript(shuffle(SCENES)));
  }

  controls.addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'prev') player.prev();
    else if (act === 'next') player.next();
    else if (act === 'play') { player.toggle(); setPlayLabel(); }
  });

  screen.addEventListener('click', e => {
    if (e.target.closest('.tab-btn') || e.target.closest('.tab-card')) return;
    if (!player.isAtEnd) player.next();
  });

  // Start immediately, mid-program — no title card, as if you'd just found your seat.
  player.play();
  setPlayLabel();
  setTimeout(() => screen.focus(), 100);

  return {
    dispose() {
      clearTimeout(endCardTimer);
      player.dispose();
      root.remove();
    }
  };
}
