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
// What happens and when is driven by bard.js (packages/bardjs) — see the
// "bard.js wiring" comment further down for how this scene uses it.

import { Player, compileLegacyScript, shuffle, asciiBubble } from 'bardjs';
import {
  escapeHtml, parseHTML, claimContainer, trackTimers,
  prefersReducedMotion, onReducedMotionChange, bindGuardedResize,
} from '../../utils/sceneKit.js';
import './theater.css';
import theaterHtml from './theater.html?raw';
// The cast list and the reel live alongside this scene in theater.text.js
// — content, not rendering. The prerender step that builds /text/theater/
// imports the same module, so the published script and the one performed
// on stage can't drift apart.
//
// theater.text.js organizes its three plays as separate pieces, but this
// scene's whole conceit is one shuffled reel drawing from all three at
// once — a repertory house running a mixed program, not three separate
// showings — so CHARACTERS/SCENES get flattened back out from it. This
// used to happen here, once, at module load via a static top-of-file
// import; now it's dynamically imported inside createTheater's full-mode
// branch instead (v3.10.4) — the preview branch is a static film-reel
// icon that never touches the cast or the reel, so it never needs this
// text. See buildCastAndReel() below.
//
// Two things this flattening can lose silently, both asserted below. Dev-only
// (`import.meta.env.DEV`, which Vite folds to `false` and Rollup then drops
// from the production chunk) and a throw rather than a console warning —
// same posture as prerender.js's library-section assertion: a content bug
// that only shows up as the wrong thing quietly rendering is exactly the
// kind that survives a QA pass, so it fails loudly at the moment the content
// is authored instead.
const DEV = import.meta.env?.DEV === true;

function buildCastAndReel(PIECES) {
  // Object.assign's last-writer-wins is kept as the runtime behaviour (this
  // is a hot-ish path in dev too, and changing it in production would trade
  // one silent wrong-speaker for another). The loop only exists so the
  // colliding key can be *named* in the dev assertion below.
  const CHARACTERS = {};
  const collisions = [];
  const owner = {};
  for (const piece of PIECES) {
    for (const [key, ch] of Object.entries(piece.characters)) {
      if (key in CHARACTERS) collisions.push(`${key} (${owner[key]} → ${piece.key})`);
      CHARACTERS[key] = ch;
      owner[key] = piece.key;
    }
  }
  const SCENES = PIECES.flatMap(p => p.scenes);

  if (DEV) {
    // theater.text.js's own header goes to some length about keeping its two
    // `id` namespaces from colliding; character keys have exactly the same
    // hazard with none of the guard. Zero collisions across the three plays
    // today — a fourth play with its own `narrator`, `man`, `woman` or
    // another `brian` would take over the earlier play's name/colour/tag and
    // onLine would render the wrong speaker, in the right colour, with
    // nothing logged anywhere.
    if (collisions.length) {
      throw new Error(
        `theater: character keys collide across PIECES — ${collisions.join(', ')}. ` +
        `Rename one of them; CHARACTERS is one flat namespace shared by all three plays.`
      );
    }
    // Every authored gesture must resolve to a real pose. onLine falls back
    // to POSES.idle, so a typo'd or never-added `g:` renders as the neutral
    // figure and reads as "the author didn't ask for a gesture here" —
    // indistinguishable from the real thing, at every viewport, forever.
    const unknown = new Map();
    for (const scene of SCENES) {
      for (const beat of scene.beats) {
        if (beat.g === undefined || beat.g in POSES) continue;
        if (!unknown.has(beat.g)) unknown.set(beat.g, []);
        unknown.get(beat.g).push(`${scene.slug} beat ${beat.id}`);
      }
    }
    if (unknown.size) {
      throw new Error(
        `theater: ${unknown.size} authored gesture(s) name no pose in POSES — ` +
        [...unknown].map(([g, where]) => `'${g}' (${where.join('; ')})`).join(', ') +
        `. Add the pose to POSES in theater.js, or fix the g: value.`
      );
    }
  }

  return { CHARACTERS, SCENES };
}

// Stick-figure poses stay here: presentation, not script. Every pose is
// three rows of exactly five characters — the <pre> swaps the whole block in
// place, so a row of a different width shifts the figure sideways mid-scene.
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

  // ── prop poses ──────────────────────────────────────────────────────────
  // These six are keyed by a character's `tag`, not by an authored `g:`
  // gesture (see poseFor below and the note there for why). Each one is the
  // prop the tag already names, drawn at the scale the five-column grid
  // allows: a shape you'd recognize with the name printed underneath it,
  // which is exactly the condition it renders under.
  goth:       ['  Ø  ', ' /|\\ ', ' |_| '],  // hair over the face, long coat instead of legs
  wheelchair: ['  O  ', ' [|\\ ', ' (o) '],  // seated: backrest behind, one big wheel
  violin:     ['  O= ', ' /|- ', ' / \\ '],  // tucked under the chin, bow drawn across
  cello:      ['  O| ', ' /|8 ', ' / \\ '],  // neck up past the shoulder, figure-8 body at the knee
  negligee:   ['  O  ', ' (|) ', ' /_\\ '],  // draped sleeves, a gown where the legs were
  briefcase:  ['  O  ', ' /|▄ ', ' / \\ '],  // a case in the near hand
};

// A character whose `tag` names a pose stands in that pose by default,
// instead of the generic `idle` figure everyone else gets.
//
// Worth recording how this landed, because the obvious reading of the
// evidence is wrong. A grep for `g: '...'` across theater.text.js turns up
// seven gestures that resolve to nothing — goth (x2), wheelchair, violin,
// negligee, cello, briefcase — which looks like seven authored gestures
// silently flattening to POSES.idle. They aren't: `g: '` also matches the
// tail of `tag: '`, and those seven hits are all `tag:` values on character
// definitions. Every real `g:` in the file resolves (the dev assertion in
// buildCastAndReel now proves it, and would throw if that ever stopped
// being true).
//
// What the grep artifact did surface is a real gap: seven characters carry a
// prop in their tag — Kirstin's cello, Bjorn's violin, Sadler's wheelchair,
// Jeff and Susan's goth, Satan's briefcase, The Woman's negligee — and every
// one of them stood in the same neutral figure as everyone else. The prop is
// the resting pose only; an authored gesture still wins, on the theory that
// a beat marked `g: 'point'` was written about the pointing, not the cello.
// Tags with no matching pose ('winged sneakers', 'tri-corner hat', 'chicken
// salad', ...) fall through to idle exactly as before.
function poseFor(ch, mask) {
  return POSES[mask] || POSES[ch?.tag] || POSES.idle;
}


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

// CHARACTERS is threaded in as a parameter (not a module-scope const)
// since it's full-mode-only content now, resolved from theater.text.js's
// dynamic import inside createTheater — see buildCastAndReel() above.
function buildActorEl(key, CHARACTERS) {
  const ch = CHARACTERS[key];
  const el = document.createElement('div');
  el.className = 'tab-actor';
  el.dataset.char = key;
  el.style.color = ch.color;
  // escapeHtml on our own cast list is belt-and-braces — but the file
  // already imports the helper and escaped the bubble art with it, and
  // "escape everything that reaches innerHTML" is a rule you can hold
  // without re-deciding per site. The half-applied version is the one that
  // eventually gets it wrong.
  el.innerHTML = `
    <pre class="sf">${poseFor(ch).join('\n')}</pre>
    <div class="sf-name">${escapeHtml(ch.name)}</div>
    ${ch.tag ? `<div class="sf-tag">(${escapeHtml(ch.tag)})</div>` : ''}
  `;
  return el;
}

// Narrow phones get a narrower cowsay wrap so the monospace block fits the
// screen. Read per line AND on resize (see TheaterRenderer.relayout) rather
// than once at mount.
function bubbleWidthFor() {
  return (typeof window !== 'undefined' && window.innerWidth < 480) ? 24 : 40;
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
// The reel runs on bard.js's Player (packages/bardjs) — compileLegacyScript
// converts these SCENES into the engine's chorus/enter/exit/line
// vocabulary. TheaterRenderer below draws actor figures, cowsay bubbles,
// and captions using the same DOM structure and `.tab-*` classes
// theater.css defines; bard.js only owns "what happens next and when."
class TheaterRenderer {
  constructor({ stage, captionEl, slugEl, interstitialEl, srLive, characters, clipEl, timers }) {
    this.stage = stage;
    this.captionEl = captionEl;
    this.slugEl = slugEl;
    this.interstitialEl = interstitialEl;
    this.srLive = srLive;
    this.characters = characters;
    // The element whose overflow:hidden actually clips a bubble — see
    // _placeBubble(). Not the screen: the screen deliberately lets dialogue
    // float outside it (theater.css says so at .tab-screen's overflow rule).
    this.clipEl = clipEl;
    // Shared with the scene (see createTheater) so one dispose() drops every
    // pending handle at once. The 900ms 'talking' class removal below was
    // untracked, and fired against a detached figure on any scene switch
    // mid-line.
    this.timers = timers;
    this.actors = {};
    // The bubble currently on stage, kept so a resize can re-wrap it at the
    // new width — see relayout().
    this.currentLine = null;
    this.bubbleWidth = bubbleWidthFor();
  }

  ensureActor(key) {
    if (this.actors[key]) return this.actors[key];
    const el = buildActorEl(key, this.characters);
    this.stage.appendChild(el);
    this.actors[key] = el;
    this.timers.nextFrame(() => el.classList.add('on'));
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
    this.currentLine = null;
  }

  onSceneChange(scene) {
    this.clearActors();
    this.slugEl.textContent = '[ ' + scene.slug + ' ]';
    this.interstitialEl.classList.remove('on');
  }

  onEnter(keys) {
    // compileScript tags the intermission event with the *upcoming*
    // scene's sceneIndex, not the outgoing one, so Player only fires
    // onSceneChange (the only other place that clears '.on' here) once --
    // when landing ON the interstitial, not when leaving it. The new
    // scene's first real event shares that same sceneIndex, so nothing
    // would dismiss the card on its own; every real stage event clears
    // the card itself instead of relying on a scene boundary that may not
    // exist between it and the interstitial.
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
    const ch = this.characters[key];
    const el = this.actors[key]; // absent for a true offstage voice — nothing to attach a figure to
    if (el) {
      el.querySelector('pre.sf').textContent = poseFor(ch, mask).join('\n');
    }

    const speakerLine = `${ch.name}${voice ? ' (voice)' : ''}: ${text}`;
    this.srLive.textContent = speakerLine;
    if (silent) return; // wordless reaction beat — direction is still announced above, no bubble

    if (el) {
      el.classList.add('talking');
      this.timers.after(900, () => el.classList.remove('talking'));
    }
    this.bubbleWidth = bubbleWidthFor();
    this.currentLine = { key, text, voice }; // no `el`: relayout() re-queries the bubble, and nothing else read it
    const bubble = document.createElement('div');
    bubble.className = 'tab-bubble';
    bubble.innerHTML = this._bubbleHtml(ch, text, voice);
    (el || this.stage).appendChild(bubble);
    this._placeBubble(bubble);
    this.timers.nextFrame(() => bubble.classList.add('on'));
  }

  _bubbleHtml(ch, text, voice) {
    return `<span class="bubble-name">${escapeHtml(ch.name)}${voice ? ' (voice)' : ''}</span>`
      + escapeHtml(asciiBubble(text, false, this.bubbleWidth));
  }

  // A bubble is placed relative to its SPEAKER — centred on them
  // (left:50% + translateX(-50%), the "anchor a decorative element at an
  // offset inside its own positioned ancestor" job STANDARDS.md keeps that
  // pattern for) and grown upward from their head (bottom:100%). .tab-root
  // clips with overflow:hidden, so a speaker near an edge sends part of the
  // block outside it, and neither axis is safe:
  //   * horizontally, the figures at the ends of a four-actor stage lose
  //     40px of monospace art at 375px, shaved mid-glyph;
  //   * vertically, the tallest speeches are taller than the headroom above
  //     an actor — the longest is 343px against 313px at 375x667, and eleven
  //     of the 736 beats clear 200px, so a shorter phone loses more of them.
  // Nothing can scroll it back into view: the bubble is pointer-events:none
  // and has no tabindex. So the placement is nudged per bubble by however
  // much it overhangs.
  //
  // Written through .style.setProperty() rather than a style="" attribute for
  // the same CSP reason as the preview's reel holes (see createTheater), and
  // read back in one getBoundingClientRect per line — a few times a minute,
  // not per frame.
  _placeBubble(bubble) {
    if (!this.clipEl) return;
    const bounds = this.clipEl.getBoundingClientRect();
    const r = bubble.getBoundingClientRect();
    if (!r.width || !bounds.width) return;
    const margin = 4;
    let dx = 0;
    if (r.right > bounds.right - margin) dx = (bounds.right - margin) - r.right;
    // Left last, so a bubble wider than the frame pins to the left edge and
    // reads from its first character rather than its last.
    if (r.left + dx < bounds.left + margin) dx = (bounds.left + margin) - r.left;
    bubble.style.setProperty('--bubble-shift', `${Math.round(dx)}px`);

    // Down only. A bubble that fits above its speaker is left exactly where
    // it is — pulling short ones down would cover the actor for no reason.
    // One that doesn't fit is pushed down until its first line is inside the
    // frame, which does overlap the figure; a speech that is cut off at the
    // top is unreadable, and one drawn over its speaker is merely crowded.
    let dy = 0;
    if (r.top < bounds.top + margin) dy = (bounds.top + margin) - r.top;
    bubble.style.setProperty('--bubble-lift', `${Math.round(dy)}px`);
  }

  // bubbleWidthFor() used to be read once per line and never again, and the
  // scene bound no resize listener at all — so rotating a phone mid-scene
  // left the bubble on screen wrapped to the width of the orientation you
  // were in when the line started. Re-wraps in place (no class toggle, no
  // re-entry into onLine) so a resize doesn't restart the fade-in or the
  // talking animation.
  relayout() {
    if (!this.currentLine) return;
    const bubble = this.stage.querySelector('.tab-bubble');
    if (!bubble) return;
    const width = bubbleWidthFor();
    const { key, text, voice } = this.currentLine;
    if (width !== this.bubbleWidth) {
      this.bubbleWidth = width;
      bubble.innerHTML = this._bubbleHtml(this.characters[key], text, voice);
    }
    // Always re-run: the overhang depends on the viewport, not just the wrap
    // width, so a resize that doesn't cross the 480px line still moves it.
    bubble.style.removeProperty('--bubble-shift');
    this._placeBubble(bubble);
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
    // this.timers is owned by createTheater (it outlives the renderer by a
    // few lines and also holds the scene's own end-card handles), so it's
    // disposed there, once, rather than here.
  }
}

export function createTheater(container, { preview = false } = {}) {
  const shell = parseHTML(theaterHtml);

  if (preview) {
    const root = shell.querySelector('.tab-preview');
    // Built as real elements with .style.setProperty() rather than an
    // innerHTML string with style="--a: ...deg" baked in, so style-src can
    // stay 'self' with no inline exceptions (CSP hardening, 2026-09-01).
    const filmReel = root.querySelector('.film-reel');
    for (const deg of [0, 60, 120, 180, 240, 300]) {
      const hole = document.createElement('div');
      hole.className = 'reel-hole';
      hole.style.setProperty('--a', `${deg}deg`);
      filmReel.appendChild(hole);
    }
    container.appendChild(root);
    return {
      // The preview reel is pure CSS animation, so there's no timer to stop —
      // but the contract is the contract, and a spinning reel on a tile
      // that's scrolled out of view is still work. A class rather than an
      // inline animation-play-state: the scratched-film-stock grain lives on
      // .tab-preview::before, which CSSOM can't reach.
      setPaused(paused) { root.classList.toggle('paused', !!paused); },
      dispose() { root.remove(); },
    };
  }

  // The cast list + reel (theater.text.js) are dynamically imported below
  // rather than statically at the top of this file — the preview branch
  // above already returned, so a preview thumbnail (a static film-reel
  // icon) never needs this text (v3.10.4, same shape as sphere.js/
  // scroll.js/harmonics.js). `disposed` lets the async continuation no-op
  // if the scene is torn down before the import resolves (a fast scene
  // switch).
  let disposed = false;
  let root = null;
  let player = null;
  let claim = null;
  let resize = null;
  let reducedMotion = null;
  // One tracker for every deferred handle this scene owns — the renderer's
  // 900ms 'talking' reset, the end-card timer and its focus nudge, and the
  // initial focus on the screen. Created out here rather than inside the
  // dynamic import's continuation so dispose() can drop them even if the
  // scene is torn down before theater.text.js resolves.
  const timers = trackTimers();

  // main.js parks a scene while its tile is off-screen or the tab is hidden.
  // Theater has no WebGL context to lose, but it does have a reel that keeps
  // advancing — and a visitor who came back to find they'd missed four beats
  // of dialogue would have no way to tell that had happened. `resumeOnShow`
  // is the half that matters: a reel the visitor paused themselves must stay
  // paused when the tile comes back, so pausing is only undone if we were
  // the ones who paused it.
  let hostPaused = false;
  let resumeOnShow = false;
  let applyHostPaused = null;

  import('./theater.text.js').then(({ PIECES }) => {
    if (disposed) return;

    const { CHARACTERS, SCENES } = buildCastAndReel(PIECES);

    root = shell.querySelector('.tab-root');
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
    // position/overflow used to be written straight onto the shared
    // #experience-container and left there for whatever scene came next;
    // claimContainer records what was there first and hands back the
    // restore() that kept getting forgotten (sceneKit, v4.0).
    claim = claimContainer(container);

    const renderer = new TheaterRenderer({
      stage, captionEl, slugEl, interstitialEl, srLive,
      characters: CHARACTERS, clipEl: root, timers,
    });
    let endCard = null;

    // Cached next to the other element refs: updateProgress and setPlayLabel
    // run on every advance — every few seconds for the whole time the scene
    // is open — and re-queried their own element each time.
    const progressEl = controls.querySelector('.tab-progress');
    const playBtn = controls.querySelector('[data-act="play"]');

    function updateProgress() {
      progressEl.textContent =
        player.index < 0 ? 'start' : `${player.index + 1} / ${player.length}`;
    }

    function setPlayLabel() {
      playBtn.textContent = player.playing ? '|| pause' : '> play';
      playBtn.setAttribute('aria-label', player.playing ? 'Pause' : 'Play');
    }

    function showEndCard() {
      // Guarded against re-entry: without this, repeatedly triggering the
      // end state (unlikely in practice, but possible) could stack up
      // duplicate end cards, with a click on an older one calling restart()
      // while a newer one silently stayed put.
      if (!player.isAtEnd || endCard) return;
      endCard = document.createElement('button');
      endCard.type = 'button';
      endCard.className = 'tab-card';
      endCard.setAttribute('aria-label', 'The end. Press Enter to reshuffle the reel and start tonight’s next showing.');
      // All three children are spans, and that is the content model rather
      // than a preference: a <button>'s content model is PHRASING content, and
      // <pre>, <h1> and <p> are all flow content, so the previous version was
      // three violations in four lines. Nothing about the look depends on the
      // old tags — .tab-card is a flex column, which blockifies every child
      // whatever it is — so the CSS carries what the user-agent stylesheet used
      // to (white-space and the monospace family for the ASCII block).
      //
      // The <h1> was the one that mattered beyond validity. index.html's
      // #experience-heading is already the page's h1 while a scene is open, so
      // this was a second one competing with it; and because the button carries
      // an aria-label, the whole subtree is overridden and the heading was
      // never announced at all. It contributed a phantom outline entry and
      // nothing else.
      endCard.innerHTML = `
        <span class="tab-ascii-title" aria-hidden="true">-------------------------\n     F A D E   T O   B L A C K\n-------------------------</span>
        <span class="tab-end-title">THE END</span>
        <span class="tab-tap">click for tonight’s next showing</span>
      `;
      // Native <button> already fires 'click' for both Enter and Space, so
      // no manual keydown handler is needed.
      endCard.addEventListener('click', restart);
      screen.appendChild(endCard);
      setPlayLabel();
      srLive.textContent = 'The end. Press Enter to reshuffle the reel and start tonight’s next showing.';
      timers.after(50, () => endCard?.focus());
    }

    // The 2s end-card delay goes through `timers` (sceneKit's trackTimers)
    // along with everything else deferred here — without tracking, closing
    // the scene inside that window still fires showEndCard() afterward
    // against a detached `screen`/`endCard`, the same class of bug the
    // Player class guards against internally (see its own dispose()).
    player = new Player(compileLegacyScript(shuffle(SCENES)), renderer, {
      onAdvance: () => { endCard?.remove(); endCard = null; updateProgress(); setPlayLabel(); },
      onEnd: () => { timers.after(2000, showEndCard); },
    });

    // Reshuffle the reel and start again — a different program each showing.
    // `autoplay` carries the reduced-motion decision through: clicking the
    // end card is an explicit "show me the next one", but it still isn't a
    // request to have the reel advance itself.
    function restart() {
      endCard?.remove();
      endCard = null;
      player.restart(compileLegacyScript(shuffle(SCENES)), { autoplay: !prefersReducedMotion() });
      setPlayLabel();
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

    // A resize doesn't change the layout of anything the scene draws itself
    // (that's all CSS), but it does change how wide the cowsay block should
    // wrap and how far a side actor's bubble overhangs the frame — neither
    // of which anything re-derived before. bindGuardedResize also brings the
    // orientationchange retry, which is the case that actually matters here:
    // rotating a phone is exactly when 24 columns stops being the right
    // answer.
    resize = bindGuardedResize(container, () => renderer.relayout());

    // Start immediately, mid-program — no title card, as if you'd just found
    // your seat. Except under prefers-reduced-motion: the reel swapping the
    // whole stage every few seconds is motion whatever the CSS says, and
    // theater.css's reduced-motion block only ever killed the animations, so
    // content kept moving on its own. The pause button means WCAG 2.2.2 was
    // technically satisfied either way; starting paused, with '> play'
    // showing, is the honest reading of the setting.
    //
    // goTo(0), not just "don't call play()": play() is what puts the first
    // beat on the stage, so skipping it outright left a reduced-motion
    // visitor looking at an empty screen with an empty progress counter and
    // no indication that anything was meant to be there. goTo() renders the
    // beat and, with playing still false, schedules nothing after it.
    if (prefersReducedMotion()) player.goTo(0);
    else player.play();
    setPlayLabel();
    timers.after(100, () => screen.focus());

    // The setting can be turned on while the scene is already open, and this
    // is one of the cases sceneKit's onReducedMotionChange note calls cheap
    // to honour live. Only the on-switch acts: turning the preference OFF is
    // permission for motion, not a request for it, and silently starting a
    // reel someone is reading would be its own surprise.
    reducedMotion = onReducedMotionChange(reduce => {
      if (reduce && player.playing) { player.pause(); setPlayLabel(); }
    });

    // Wire the host's pause up to the real player, and apply anything that
    // arrived while theater.text.js was still loading.
    applyHostPaused = () => {
      if (hostPaused) {
        if (player.playing) { resumeOnShow = true; player.pause(); }
      } else if (resumeOnShow) {
        resumeOnShow = false;
        player.play();
      }
      setPlayLabel();
    };
    applyHostPaused();
  });

  return {
    setPaused(paused) {
      hostPaused = !!paused;
      applyHostPaused?.();
    },
    dispose() {
      disposed = true;
      timers.dispose();
      resize?.dispose();
      reducedMotion?.dispose();
      if (player) player.dispose();
      claim?.restore();
      if (root) root.remove();
    }
  };
}
