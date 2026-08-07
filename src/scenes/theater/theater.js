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
import { escapeHtml, parseHTML } from '../../utils/sceneKit.js';
import './theater.css';
import theaterHtml from './theater.html?raw';
// The cast list and the reel live alongside this scene in theater.text.js
// (moved out of the shared src/text/ 2026-07-29, then colocated here
// 2026-08-07) — content, not rendering. The prerender step that builds
// /text/theater/ imports the same module, so the published script and the
// one performed on stage can't drift apart.
import { CHARACTERS, SCENES } from './theater.text.js';

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


// Theater's CSS lives in styles/scenes/theater.css (imported above) —
// no runtime injection needed now that it's a real stylesheet.

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
// and `.tab-*` classes styles/scenes/theater.css already defines — nothing about the
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
  const shell = parseHTML(theaterHtml);

  if (preview) {
    const root = shell.querySelector('.tab-preview');
    const holes = [0, 60, 120, 180, 240, 300]
      .map(deg => `<div class="reel-hole" style="--a: ${deg}deg"></div>`)
      .join('');
    root.querySelector('.film-reel').innerHTML = holes;
    container.appendChild(root);
    return { dispose() { root.remove(); } };
  }

  const root = shell.querySelector('.tab-root');
  const curtain = root.querySelector('.tab-curtain');
  curtain.textContent = CURTAIN_ROW;

  const screenFrame = root.querySelector('.tab-screen-frame');
  const screen = root.querySelector('.tab-screen');
  const slugEl = root.querySelector('.tab-slug');
  const stage = root.querySelector('.tab-stage');
  const captionEl = root.querySelector('.tab-caption');
  const interstitialEl = root.querySelector('.tab-interstitial');
  const controls = root.querySelector('.tab-controls');
  const srLive = root.querySelector('.tab-sr-live');

  screenFrame.appendChild(buildHouseRow()); // overlays the bottom of the screen, MST3K-style

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
