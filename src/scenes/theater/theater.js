
import { Player, compileLegacyScript, shuffle, asciiBubble } from 'bardjs';
import {
  escapeHtml, parseHTML, claimContainer, trackTimers,
  prefersReducedMotion, onReducedMotionChange, bindGuardedResize,
} from '../../utils/sceneKit.js';
import './theater.css';
import theaterHtml from './theater.html?raw';
const DEV = import.meta.env?.DEV === true;

function buildCastAndReel(PIECES) {
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
    if (collisions.length) {
      throw new Error(
        `theater: character keys collide across PIECES — ${collisions.join(', ')}. ` +
        `Rename one of them; CHARACTERS is one flat namespace shared by all three plays.`
      );
    }
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

  goth:       ['  Ø  ', ' /|\\ ', ' |_| '],  // hair over the face, long coat instead of legs
  wheelchair: ['  O  ', ' [|\\ ', ' (o) '],  // seated: backrest behind, one big wheel
  violin:     ['  O= ', ' /|- ', ' / \\ '],  // tucked under the chin, bow drawn across
  cello:      ['  O| ', ' /|8 ', ' / \\ '],  // neck up past the shoulder, figure-8 body at the knee
  negligee:   ['  O  ', ' (|) ', ' /_\\ '],  // draped sleeves, a gown where the legs were
  briefcase:  ['  O  ', ' /|▄ ', ' / \\ '],  // a case in the near hand
};

function poseFor(ch, mask) {
  return POSES[mask] || POSES[ch?.tag] || POSES.idle;
}



const CURTAIN_ROW = '╭⌒╮'.repeat(40);
const SEAT_SECTIONS = [4, 8, 4];
const OCCUPIED_SEATS = new Set([1, 2, 4, 7, 8, 11, 13, 14]);
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

function buildActorEl(key, CHARACTERS) {
  const ch = CHARACTERS[key];
  const el = document.createElement('div');
  el.className = 'tab-actor';
  el.dataset.char = key;
  el.style.color = ch.color;
  el.innerHTML = `
    <pre class="sf">${poseFor(ch).join('\n')}</pre>
    <div class="sf-name">${escapeHtml(ch.name)}</div>
    ${ch.tag ? `<div class="sf-tag">(${escapeHtml(ch.tag)})</div>` : ''}
  `;
  return el;
}

function bubbleWidthFor() {
  return (typeof window !== 'undefined' && window.innerWidth < 480) ? 24 : 40;
}

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

class TheaterRenderer {
  constructor({ stage, captionEl, slugEl, interstitialEl, srLive, characters, clipEl, timers }) {
    this.stage = stage;
    this.captionEl = captionEl;
    this.slugEl = slugEl;
    this.interstitialEl = interstitialEl;
    this.srLive = srLive;
    this.characters = characters;
    this.clipEl = clipEl;
    this.timers = timers;
    this.actors = {};
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
    this.srLive.textContent = scene.slug;
    this.interstitialEl.classList.remove('on');
  }

  onEnter(keys) {
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

  _placeBubble(bubble) {
    if (!this.clipEl) return;
    const bounds = this.clipEl.getBoundingClientRect();
    const r = bubble.getBoundingClientRect();
    if (!r.width || !bounds.width) return;
    const margin = 4;
    let dx = 0;
    if (r.right > bounds.right - margin) dx = (bounds.right - margin) - r.right;
    if (r.left + dx < bounds.left + margin) dx = (bounds.left + margin) - r.left;
    bubble.style.setProperty('--bubble-shift', `${Math.round(dx)}px`);

    let dy = 0;
    if (r.top < bounds.top + margin) dy = (bounds.top + margin) - r.top;
    bubble.style.setProperty('--bubble-lift', `${Math.round(dy)}px`);
  }

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
  }
}

export function createTheater(container, { preview = false } = {}) {
  const shell = parseHTML(theaterHtml);

  if (preview) {
    const root = shell.querySelector('.tab-preview');
    const filmReel = root.querySelector('.film-reel');
    for (const deg of [0, 60, 120, 180, 240, 300]) {
      const hole = document.createElement('div');
      hole.className = 'reel-hole';
      hole.style.setProperty('--a', `${deg}deg`);
      filmReel.appendChild(hole);
    }
    container.appendChild(root);
    return {
      setPaused(paused) { root.classList.toggle('paused', !!paused); },
      dispose() { root.remove(); },
    };
  }

  let disposed = false;
  let root = null;
  let player = null;
  let claim = null;
  let resize = null;
  let reducedMotion = null;
  const timers = trackTimers();

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
    claim = claimContainer(container);

    const renderer = new TheaterRenderer({
      stage, captionEl, slugEl, interstitialEl, srLive,
      characters: CHARACTERS, clipEl: root, timers,
    });
    let endCard = null;

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
      if (!player.isAtEnd || endCard) return;
      endCard = document.createElement('button');
      endCard.type = 'button';
      endCard.className = 'tab-card';
      endCard.setAttribute('aria-label', 'The end. Press Enter to reshuffle the reel and start tonight’s next showing.');
      endCard.innerHTML = `
        <span class="tab-ascii-title" aria-hidden="true">-------------------------\n     F A D E   T O   B L A C K\n-------------------------</span>
        <span class="tab-end-title">THE END</span>
        <span class="tab-tap">click for tonight’s next showing</span>
      `;
      endCard.addEventListener('click', restart);
      screen.appendChild(endCard);
      setPlayLabel();
      srLive.textContent = 'The end. Press Enter to reshuffle the reel and start tonight’s next showing.';
      timers.after(50, () => endCard?.focus());
    }

    player = new Player(compileLegacyScript(shuffle(SCENES)), renderer, {
      onAdvance: () => { endCard?.remove(); endCard = null; updateProgress(); setPlayLabel(); },
      onEnd: () => { timers.after(2000, showEndCard); },
    });

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

    resize = bindGuardedResize(container, () => renderer.relayout());

    if (prefersReducedMotion()) player.goTo(0);
    else player.play();
    setPlayLabel();
    timers.after(100, () => screen.focus());

    reducedMotion = onReducedMotionChange(reduce => {
      if (reduce && player.playing) { player.pause(); setPlayLabel(); }
    });

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
